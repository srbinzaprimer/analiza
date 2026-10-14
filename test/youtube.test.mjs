import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { GreskaYouTube, napraviKlijent } from "../src/youtube.mjs";

/** Lažni fetch: beleži zahteve i vraća unapred zadate odgovore. */
function lazniFetch(odgovori) {
  const zahtevi = [];
  const fetchFn = async (url) => {
    zahtevi.push(new URL(url));
    const sledeci = odgovori.shift();
    if (sledeci instanceof Error) throw sledeci;
    const { status = 200, telo } = sledeci;
    return new Response(JSON.stringify(telo), { status });
  };
  return { fetchFn, zahtevi };
}

const bezCekanja = () => Promise.resolve();

describe("napraviKlijent", () => {
  test("bez ključa odmah javlja grešku", () => {
    assert.throws(() => napraviKlijent({ kljuc: "" }), GreskaYouTube);
  });

  test("kanal() traži po @imenu i broji potrošnju", async () => {
    const { fetchFn, zahtevi } = lazniFetch([{ telo: { items: [{ id: "UC1" }] } }, { telo: {} }]);
    const yt = napraviKlijent({ kljuc: "K", fetchFn });

    assert.deepEqual(await yt.kanal("@primer"), { id: "UC1" });
    assert.equal(await yt.kanal("@nema"), null);
    assert.equal(yt.potroseno, 2);

    const url = zahtevi[0];
    assert.equal(url.pathname, "/youtube/v3/channels");
    assert.equal(url.searchParams.get("forHandle"), "@primer");
    assert.equal(url.searchParams.get("key"), "K");
  });

  test("stavkePlejliste prati stranice i staje kad se zatraži", async () => {
    const strana = (ids, nextPageToken) => ({
      telo: { items: ids.map((id) => ({ snippet: { resourceId: { videoId: id } } })), nextPageToken },
    });
    const { fetchFn, zahtevi } = lazniFetch([strana(["a", "b"], "T2"), strana(["c"], "T3"), strana(["d"])]);
    const yt = napraviKlijent({ kljuc: "K", fetchFn });

    const stavke = await yt.stavkePlejliste("UU1", (s) => !s.some((x) => x.snippet.resourceId.videoId === "c"));
    assert.deepEqual(
      stavke.map((s) => s.snippet.resourceId.videoId),
      ["a", "b", "c"],
    );
    assert.equal(zahtevi.length, 2);
    assert.equal(zahtevi[1].searchParams.get("pageToken"), "T2");
  });

  test("videi() šalje najviše 50 ID-jeva po zahtevu", async () => {
    const { fetchFn, zahtevi } = lazniFetch([{ telo: { items: [] } }, { telo: { items: [] } }]);
    const yt = napraviKlijent({ kljuc: "K", fetchFn });
    const ids = Array.from({ length: 51 }, (_, i) => `v${i}`);
    await yt.videi(ids);
    assert.equal(zahtevi.length, 2);
    assert.equal(zahtevi[0].searchParams.get("id").split(",").length, 50);
    assert.equal(zahtevi[1].searchParams.get("id"), "v50");
  });

  test("ponavlja zahtev posle greške servera ili mreže", async () => {
    const { fetchFn, zahtevi } = lazniFetch([
      { status: 503, telo: {} },
      new TypeError("fetch failed"),
      { telo: { items: [{ id: "UC1" }] } },
    ]);
    const yt = napraviKlijent({ kljuc: "K", fetchFn, cekaj: bezCekanja });
    assert.deepEqual(await yt.kanal("@primer"), { id: "UC1" });
    assert.equal(zahtevi.length, 3);
  });

  test("prepoznaje kobne greške (kvota, ključ) i obične", async () => {
    const greska = (status, poruka, razlog) => ({
      status,
      telo: { error: { message: poruka, errors: [{ reason: razlog }] } },
    });
    const { fetchFn } = lazniFetch([
      greska(403, "The request cannot be completed because you have exceeded your quota.", "quotaExceeded"),
      greska(400, "API key not valid. Please pass a valid API key.", "badRequest"),
      greska(404, "The playlist identified with the request's playlistId parameter cannot be found.", "playlistNotFound"),
    ]);
    const yt = napraviKlijent({ kljuc: "K", fetchFn, cekaj: bezCekanja });

    const kvota = await yt.kanal("@a").catch((g) => g);
    assert.ok(kvota instanceof GreskaYouTube);
    assert.equal(kvota.razlog, "quotaExceeded");
    assert.equal(kvota.kobna, true);

    assert.equal((await yt.kanal("@b").catch((g) => g)).kobna, true);
    assert.equal((await yt.kanal("@c").catch((g) => g)).kobna, false);
  });
});
