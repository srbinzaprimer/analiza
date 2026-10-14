// Stremio dodatak, HTML stranice, spisak kanala i ceo build.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { procitajKanale } from "../src/kanali.mjs";
import { esc, napraviStrane } from "../src/strane.mjs";
import { ID_DODATKA, stremioFajlovi } from "../src/stremio.mjs";
import { pripremiSerije } from "../src/spoj.mjs";

const KOREN = fileURLToPath(new URL("..", import.meta.url));
const pokreni = promisify(execFile);

const serija = (dodatno = {}) => ({
  id: "primerkanal-mavi-ruzgar",
  ime: "Mavi Rüzgâr",
  kanal: { ime: "Primer Kanal", handle: "@primerkanal", slika: null },
  jezik: "tr",
  titlovi: [],
  imaTitlove: false,
  brojEpizoda: 2,
  sezone: [1],
  poslednja: { id: "vid00000002", epizoda: 2, objavljeno: "2026-10-08T18:00:00Z" },
  slika: "https://i.ytimg.com/vi/vid00000002/maxresdefault.jpg",
  epizode: [1, 2].map((n) => ({
    id: `vid0000000${n}`,
    sezona: 1,
    epizoda: n,
    naslov: `Mavi Rüzgâr ${n}. Bölüm`,
    objavljeno: `2026-10-0${n}T18:00:00Z`,
    trajanje: 7200,
    titlovi: false,
    ograniceno: null,
    slika: `https://i.ytimg.com/vi/vid0000000${n}/mqdefault.jpg`,
  })),
  ...dodatno,
});

describe("Stremio dodatak", () => {
  const fajlovi = stremioFajlovi([serija()], {
    adresa: "https://primer.github.io/bolum/",
    verzija: "1.2.3",
  });

  test("manifest opisuje katalog serija", () => {
    const m = fajlovi.get("manifest.json");
    assert.equal(m.id, ID_DODATKA);
    assert.equal(m.version, "1.2.3");
    assert.deepEqual(m.resources, ["catalog", "meta", "stream"]);
    assert.deepEqual(m.types, ["series"]);
    assert.equal(m.logo, "https://primer.github.io/bolum/ikonica-256.png");
    assert.deepEqual(
      m.catalogs.map((k) => k.id),
      ["bolum-novo", "bolum-popularno"],
    );
  });

  test("katalog, meta i stream fajlovi se međusobno slažu", () => {
    const { metas } = fajlovi.get("catalog/series/bolum-novo.json");
    assert.equal(metas.length, 1);
    const id = metas[0].id;
    assert.ok(id.startsWith(fajlovi.get("manifest.json").idPrefixes[0]));

    const { meta } = fajlovi.get(`meta/series/${id}.json`);
    assert.equal(meta.videos.length, 2);
    assert.deepEqual(
      meta.videos.map((v) => [v.season, v.episode]),
      [
        [1, 1],
        [1, 2],
      ],
    );

    for (const v of meta.videos) {
      const { streams } = fajlovi.get(`stream/series/${v.id}.json`);
      assert.equal(streams.length, 1);
      assert.match(streams[0].ytId, /^vid0000000\d$/);
    }
  });
});

describe("Stremio: druge verzije i zvanični sajt", () => {
  const osnova = serija();
  const englesko = {
    id: "primerenglish-blue-wind",
    kanal: { ime: "Primer English", handle: "@primerenglish", slika: null },
    jeziciTitlova: ["en"],
    epizode: [
      // Ista epizoda (broj i trajanje) i jedna isečena drugačije (kraće trajanje).
      { ...osnova.epizode[0], id: "eng0000001", naslov: "Blue Wind Episode 1", jeziciTitlova: ["en"] },
      { ...osnova.epizode[1], id: "eng0000002", naslov: "Blue Wind Episode 2", trajanje: 2700 },
    ],
  };
  const fajlovi = stremioFajlovi(
    [
      serija({
        tmdbId: 77,
        sajt: "https://tv.example/mavi",
        mreze: [{ ime: "Primer TV", logo: null }],
        verzije: [{ id: osnova.id, kanal: osnova.kanal, jeziciTitlova: [], epizode: osnova.epizode }, englesko],
      }),
    ],
    { adresa: "https://primer.github.io/bolum/", verzija: "1.2.3" },
  );

  test("ista epizoda sa drugog kanala je dodatni izvor, sa titlovima", () => {
    const { streams } = fajlovi.get("stream/series/bolum-v-vid00000001.json");
    assert.deepEqual(
      streams.map((x) => x.ytId ?? x.externalUrl),
      ["vid00000001", "eng0000001", "https://tv.example/mavi"],
    );
    assert.match(streams[1].description, /Primer English[\s\S]*Subtitles: EN/);
  });

  test("drugačije isečena epizoda se ne nudi kao ista", () => {
    const { streams } = fajlovi.get("stream/series/bolum-v-vid00000002.json");
    assert.deepEqual(
      streams.map((x) => x.ytId ?? x.externalUrl),
      ["vid00000002", "https://tv.example/mavi"],
    );
  });
});

describe("HTML stranice", () => {
  const sablon = `<base href="{{BAZA}}"><title>{{NASLOV}}</title><meta content="{{OPIS}}"><link href="{{URL}}"><meta content="{{SLIKA}}">{{ROBOTS}}{{JSONLD}}<main>{{SADRZAJ}}</main>`;

  test("prave se početna, stranica serije, lista i 404", () => {
    const strane = napraviStrane({
      sablon,
      serije: [serija()],
      adresa: "https://primer.github.io/bolum/",
      baza: "/bolum/",
    });
    assert.deepEqual([...strane.keys()].sort(), [
      "404.html",
      "index.html",
      "istrazi/index.html",
      "lista/index.html",
      "serija/primerkanal-mavi-ruzgar/index.html",
    ]);
    const s = strane.get("serija/primerkanal-mavi-ruzgar/index.html");
    assert.ok(s.includes('<base href="/bolum/">'));
    assert.ok(s.includes("https://primer.github.io/bolum/serija/primerkanal-mavi-ruzgar/"));
    assert.ok(s.includes('"@type":"TVSeries"'));
    assert.ok(s.includes("https://www.youtube.com/watch?v=vid00000001"));
    assert.ok(strane.get("lista/index.html").includes('content="noindex"'));
  });

  test("tekst sa YouTube-a ne može da ubaci HTML ni da izađe iz JSON-LD", () => {
    const zla = serija({
      ime: '</script><img src=x onerror="alert(1)">',
      epizode: serija().epizode.map((e) => ({ ...e, naslov: "<b>x</b></script>" })),
    });
    const html = napraviStrane({ sablon, serije: [zla], adresa: "", baza: "/" }).get(
      "serija/primerkanal-mavi-ruzgar/index.html",
    );
    assert.ok(!html.includes("<img src=x"));
    assert.ok(!html.includes("<b>x</b>"));
    assert.equal(html.match(/<\/script>/g)?.length ?? 0, 1, "samo jedna zatvorena script oznaka");
  });

  test("stara adresa spojene serije vodi na spojenu, bez indeksiranja", () => {
    const strane = napraviStrane({
      sablon,
      serije: [serija()],
      aliasi: { "primerenglish-blue-wind": "primerkanal-mavi-ruzgar" },
      adresa: "https://primer.github.io/bolum/",
      baza: "/bolum/",
    });
    const html = strane.get("serija/primerenglish-blue-wind/index.html");
    assert.ok(html.includes("https://primer.github.io/bolum/serija/primerkanal-mavi-ruzgar/"));
    assert.ok(html.includes('content="noindex"'));
  });

  test("nepoznata oznaka u šablonu je greška", () => {
    assert.throws(
      () => napraviStrane({ sablon: "{{NEPOZNATO}}", serije: [], adresa: "", baza: "/" }),
      /NEPOZNATO/,
    );
  });

  test("esc menja sve opasne znakove", () => {
    assert.equal(esc(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("procitajKanale", () => {
  test("prihvata ispravan spisak i popunjava podrazumevane vrednosti", () => {
    assert.deepEqual(procitajKanale({ kanali: [{ handle: "@primer", potvrdjeno: true }] }), [
      { handle: "@primer", ime: null, jezik: "tr", titlovi: [], potvrdjeno: true },
    ]);
  });

  test("odbija neispravne unose i navodi sve greške", () => {
    assert.throws(
      () =>
        procitajKanale({
          kanali: [
            { handle: "primer" },
            { handle: "@dupli" },
            { handle: "@DUPLI" },
            { handle: "@jezik", jezik: "Turski" },
            { handle: "@potvrda", potvrdjeno: "da" },
          ],
        }),
      (greska) =>
        /kanal #1/.test(greska.message) &&
        /dvaput/.test(greska.message) &&
        /"jezik"/.test(greska.message) &&
        /"potvrdjeno"/.test(greska.message),
    );
    assert.throws(() => procitajKanale({}), /listu "kanali"/);
  });

  test("katalog/kanali.json u repozitorijumu je ispravan", async () => {
    const sadrzaj = JSON.parse(await readFile(join(KOREN, "katalog/kanali.json"), "utf8"));
    assert.ok(procitajKanale(sadrzaj).length > 0);
  });
});

describe("build (scripts/napravi.mjs)", () => {
  test("pravi sajt, podatke, Stremio dodatak i mapu sajta (demo podaci)", async () => {
    const izlaz = await mkdtemp(join(tmpdir(), "bolum-"));
    try {
      await pokreni(
        process.execPath,
        ["scripts/napravi.mjs", "--primer", "--izlaz", izlaz, "--adresa", "https://primer.github.io/bolum"],
        { cwd: KOREN },
      );
      const procitaj = (p) => readFile(join(izlaz, p), "utf8");

      const index = await procitaj("index.html");
      assert.ok(index.includes('<base href="/bolum/">'));
      assert.ok(!/\{\{[A-Z]+\}\}/.test(index), "sve oznake šablona su popunjene");

      const podaci = JSON.parse(await procitaj("podaci/serije.json"));
      const { serije } = podaci;
      assert.equal(serije.length, 8);
      assert.ok(serije.every((s) => !("epizode" in s)), "spisak ne nosi sve epizode");
      assert.ok(serije.every((s) => !("opisi" in s)), "opisi idu tek na stranicu serije");
      assert.ok(podaci.istaknute.length > 0 && podaci.istaknute.length <= 6);
      assert.ok(podaci.istaknute.every((s) => s.pozadina && serije.some((x) => x.id === s.id)));
      assert.ok(Object.keys(podaci.zanrovi.sr).length > 0, "nazivi žanrova na srpskom");
      assert.ok(Object.values(podaci.provajderi).every((p) => p.ime && p.logo?.startsWith("https://primer.github.io/bolum/primer/")));

      const prva = JSON.parse(await procitaj(`podaci/serija/${serije[0].id}.json`));
      assert.equal(prva.verzije[0].epizode.length, prva.brojEpizoda);
      assert.ok(!("epizode" in prva), "epizode su samo u verzijama");
      assert.ok(prva.opisi.sr && prva.glumci.length > 0);
      await procitaj(`serija/${serije[0].id}/index.html`);
      // Demo slike se kopiraju uz sajt.
      await readFile(join(izlaz, prva.posterVeliki.replace("https://primer.github.io/bolum/", "")));

      const manifest = JSON.parse(await procitaj("stremio/manifest.json"));
      assert.equal(manifest.logo, "https://primer.github.io/bolum/ikonica-256.png");
      assert.ok(manifest.catalogs.some((k) => k.id.startsWith("bolum-zanr-")), "katalozi po žanru");

      const mapa = await procitaj("sitemap.xml");
      assert.equal(mapa.match(/<url>/g).length, 2 + serije.length);
      assert.ok((await procitaj("robots.txt")).includes("sitemap.xml"));
      await procitaj(".nojekyll");
      await assert.rejects(procitaj("sablon.html"), { code: "ENOENT" });
    } finally {
      await rm(izlaz, { recursive: true, force: true });
    }
  });

  test("odbija izlazni folder koji bi obrisao projekat", async () => {
    for (const izlaz of [".", "sajt", "src/nesto", ".."]) {
      await assert.rejects(
        pokreni(process.execPath, ["scripts/napravi.mjs", "--izlaz", izlaz], { cwd: KOREN }),
        (greska) => greska.code === 1 && /obrisao deo projekta/.test(greska.stderr),
      );
    }
    await readFile(join(KOREN, "sajt/app.js"));
  });

  test("bez kataloga pravi prazan, ispravan sajt", async () => {
    const izlaz = await mkdtemp(join(tmpdir(), "bolum-"));
    try {
      await pokreni(
        process.execPath,
        ["scripts/napravi.mjs", "--katalog", join(izlaz, "nema.json"), "--izlaz", join(izlaz, "dist")],
        { cwd: KOREN },
      );
      const { serije } = JSON.parse(await readFile(join(izlaz, "dist/podaci/serije.json"), "utf8"));
      assert.deepEqual(serije, []);
    } finally {
      await rm(izlaz, { recursive: true, force: true });
    }
  });
});
