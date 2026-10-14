import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PRAZAN_KATALOG, grupisiSerije, osveziKatalog } from "../src/katalog.mjs";
import { GreskaYouTube } from "../src/youtube.mjs";

const SADA = new Date("2026-10-14T04:00:00Z");
const DAN = 86_400_000;

/**
 * Lažni YouTube sa istim interfejsom kao napraviKlijent().
 * svet.kanali: @ime → { id, ime, otpremljeno: [videoId, ...] od najnovijeg }
 * svet.videi:  videoId → { naslov, trajanje, vidljivost, ugradiv, titlovi, zabranjeno, obrisan }
 */
function lazniYouTube(svet) {
  const pozivi = { kanal: [], stranice: 0, videi: [] };
  let potroseno = 0;

  const stavka = (id) => {
    const v = svet.videi[id];
    return {
      snippet: {
        title: v.naslov,
        publishedAt: v.objavljeno,
        resourceId: { videoId: id },
        thumbnails: {
          medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` },
          maxres: { url: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` },
        },
      },
      contentDetails: { videoId: id, videoPublishedAt: v.objavljeno },
      status: { privacyStatus: v.vidljivost ?? "public" },
    };
  };

  return {
    pozivi,
    get potroseno() {
      return potroseno;
    },
    async kanal(handle) {
      potroseno++;
      pozivi.kanal.push(handle);
      if (svet.greske?.[handle]) throw svet.greske[handle];
      const k = svet.kanali[handle];
      if (!k) return null;
      return {
        id: k.id,
        snippet: { title: k.ime, thumbnails: { medium: { url: `https://yt3.ggpht.com/${k.id}` } } },
        statistics: { subscriberCount: "1500000" },
        contentDetails: { relatedPlaylists: { uploads: `UU${k.id}` } },
      };
    },
    async stavkePlejliste(playlistId, nastavi = () => true) {
      const kanal = Object.values(svet.kanali).find((k) => `UU${k.id}` === playlistId);
      const stavke = [];
      for (let i = 0; i < kanal.otpremljeno.length; i += 50) {
        potroseno++;
        pozivi.stranice++;
        const stranica = kanal.otpremljeno.slice(i, i + 50).map(stavka);
        stavke.push(...stranica);
        if (!nastavi(stranica)) break;
      }
      return stavke;
    },
    async videi(ids) {
      potroseno += Math.ceil(ids.length / 50);
      pozivi.videi.push(...ids);
      return ids
        .filter((id) => !svet.videi[id].obrisan)
        .map((id) => {
          const v = svet.videi[id];
          return {
            id,
            contentDetails: {
              duration: v.trajanje ?? "PT2H",
              caption: v.titlovi ? "true" : "false",
              ...(v.zabranjeno ? { regionRestriction: { blocked: v.zabranjeno } } : {}),
            },
            status: { embeddable: v.ugradiv ?? true, privacyStatus: v.vidljivost ?? "public" },
          };
        });
    },
  };
}

const video = (naslov, dodatno = {}) => ({
  naslov,
  objavljeno: "2026-10-01T18:00:00Z",
  ...dodatno,
});

/** Kanal sa n epizoda iste serije, od najnovije. */
function kanalSaEpizodama(id, n) {
  const videi = {};
  const otpremljeno = [];
  for (let i = n; i >= 1; i--) {
    const vid = `${id}-e${i}`;
    videi[vid] = video(`Mavi Rüzgâr ${i}. Bölüm`, {
      objavljeno: new Date(Date.UTC(2026, 0, 1) + i * DAN).toISOString(),
    });
    otpremljeno.push(vid);
  }
  return { kanal: { id, ime: `Kanal ${id}`, otpremljeno }, videi };
}

const potvrdjen = (handle) => ({ handle, potvrdjeno: true, jezik: "tr", titlovi: [] });

describe("osveziKatalog: prvi prolaz", () => {
  const svet = {
    kanali: {
      "@a": {
        id: "UCa",
        ime: "Kanal A",
        otpremljeno: [
          "najava", "v3", "v3kraci", "v2", "isecak", "privatan", "neugradiv", "v1", "obrisan",
        ],
      },
      "@b": { id: "UCb", ime: "Kanal B", otpremljeno: [] },
    },
    videi: {
      najava: video("Mavi Rüzgâr 3. Bölüm Fragmanı"),
      v3: video("Mavi Rüzgâr 3. Bölüm", { trajanje: "PT2H10M" }),
      v3kraci: video("Mavi Rüzgâr 3. Bölüm", { trajanje: "PT1H50M" }),
      v2: video("Mavi Rüzgâr 2. Bölüm", { titlovi: true, zabranjeno: ["DE"] }),
      isecak: video("Mavi Rüzgâr 2. Bölüm", { trajanje: "PT5M" }),
      privatan: video("Mavi Rüzgâr 1. Bölüm", { vidljivost: "private" }),
      neugradiv: video("Kayıp Şehir 1. Bölüm", { ugradiv: false }),
      v1: video("Mavi Rüzgâr 1. Bölüm"),
      obrisan: video("Kayıp Şehir 2. Bölüm", { obrisan: true }),
    },
  };
  const yt = lazniYouTube(svet);
  const poruke = [];
  const rezultat = osveziKatalog({
    klijent: yt,
    kanali: [potvrdjen("@a"), { handle: "@b", potvrdjeno: false }],
    sada: SADA,
    log: (p) => poruke.push(p),
  });

  test("zadržava samo cele, javne i ugradive epizode", async () => {
    const { katalog, prekid } = await rezultat;
    assert.equal(prekid, null);
    assert.deepEqual(
      katalog.epizode.map((e) => e.id),
      ["v1", "v2", "v3"],
    );
  });

  test("od dve verzije iste epizode čuva dužu", async () => {
    const { katalog } = await rezultat;
    assert.equal(katalog.epizode.find((e) => e.epizoda === 3).trajanje, 7800);
  });

  test("ne traži detalje za najave i privatne videe", async () => {
    await rezultat;
    assert.ok(!yt.pozivi.videi.includes("najava"));
    assert.ok(!yt.pozivi.videi.includes("privatan"));
  });

  test("beleži titlove, ograničenja i sličice", async () => {
    const { katalog } = await rezultat;
    const v2 = katalog.epizode.find((e) => e.id === "v2");
    assert.equal(v2.titlovi, true);
    assert.deepEqual(v2.ograniceno, { dozvoljeno: null, zabranjeno: ["DE"] });
    assert.equal(v2.slika, "https://i.ytimg.com/vi/v2/mqdefault.jpg");
    assert.equal(v2.slikaVelika, "https://i.ytimg.com/vi/v2/maxresdefault.jpg");
    assert.equal(v2.serija, "Mavi Rüzgâr");
    assert.equal(v2.kanal, "UCa");
  });

  test("nepotvrđen kanal se ne dodaje, ali se prijavljuje u logu", async () => {
    const { katalog } = await rezultat;
    assert.deepEqual(katalog.kanali.map((k) => k.handle), ["@a"]);
    assert.ok(poruke.some((p) => p.includes('"Kanal B"') && p.includes("Nije potvrđen")));
  });

  test("pamti najnovije videe i vreme celog pregleda", async () => {
    const { katalog } = await rezultat;
    const [kanal] = katalog.kanali;
    assert.equal(kanal.najnoviji.length, 9);
    assert.equal(kanal.najnoviji[0], "najava");
    assert.equal(kanal.celoOsvezavanje, SADA.toISOString());
  });
});

describe("osveziKatalog: kasniji prolazi", () => {
  test("posle dan čita samo novu stranicu i detalje novih videa", async () => {
    const { kanal, videi } = kanalSaEpizodama("UCa", 120);
    const svet = { kanali: { "@a": kanal }, videi };
    const prvi = await osveziKatalog({ klijent: lazniYouTube(svet), kanali: [potvrdjen("@a")], sada: SADA });
    assert.equal(prvi.katalog.epizode.length, 120);

    videi["UCa-e121"] = video("Mavi Rüzgâr 121. Bölüm");
    kanal.otpremljeno.unshift("UCa-e121");
    const yt = lazniYouTube(svet);
    const drugi = await osveziKatalog({
      klijent: yt,
      kanali: [potvrdjen("@a")],
      stari: prvi.katalog,
      sada: new Date(SADA.getTime() + DAN),
    });

    assert.equal(drugi.katalog.epizode.length, 121);
    assert.equal(yt.pozivi.stranice, 1);
    assert.deepEqual(yt.pozivi.videi, ["UCa-e121"]);
    assert.equal(drugi.katalog.kanali[0].celoOsvezavanje, SADA.toISOString());
    assert.equal(drugi.katalog.kanali[0].najnoviji[0], "UCa-e121");
  });

  test("jednom nedeljno pregleda sve i uklanja obrisane videe", async () => {
    const { kanal, videi } = kanalSaEpizodama("UCa", 60);
    const svet = { kanali: { "@a": kanal }, videi };
    const prvi = await osveziKatalog({ klijent: lazniYouTube(svet), kanali: [potvrdjen("@a")], sada: SADA });

    kanal.otpremljeno.splice(kanal.otpremljeno.indexOf("UCa-e5"), 1);
    const kasnije = new Date(SADA.getTime() + 8 * DAN);
    const yt = lazniYouTube(svet);
    const drugi = await osveziKatalog({
      klijent: yt,
      kanali: [potvrdjen("@a")],
      stari: prvi.katalog,
      sada: kasnije,
    });

    assert.equal(yt.pozivi.stranice, 2);
    assert.equal(drugi.katalog.epizode.length, 59);
    assert.ok(!drugi.katalog.epizode.some((e) => e.id === "UCa-e5"));
    assert.equal(drugi.katalog.kanali[0].celoOsvezavanje, kasnije.toISOString());
  });
});

describe("osveziKatalog: greške", () => {
  async function triKanala() {
    const svet = { kanali: {}, videi: {} };
    for (const ime of ["a", "c", "d"]) {
      const { kanal, videi } = kanalSaEpizodama(`UC${ime}`, 3);
      svet.kanali[`@${ime}`] = kanal;
      Object.assign(svet.videi, videi);
    }
    const kanali = ["@a", "@c", "@d"].map(potvrdjen);
    const { katalog } = await osveziKatalog({ klijent: lazniYouTube(svet), kanali, sada: SADA });
    return { svet, kanali, stari: katalog };
  }

  test("istrošena kvota: ostali kanali zadržavaju stare podatke", async () => {
    const { svet, kanali, stari } = await triKanala();
    svet.greske = {
      "@c": new GreskaYouTube("quota", { status: 403, razlog: "quotaExceeded" }),
    };
    const yt = lazniYouTube(svet);
    const { katalog, prekid } = await osveziKatalog({ klijent: yt, kanali, stari, sada: SADA });

    assert.equal(prekid, "quota");
    assert.deepEqual(yt.pozivi.kanal, ["@a", "@c"]);
    assert.deepEqual(katalog.kanali.map((k) => k.handle), ["@a", "@c", "@d"]);
    assert.equal(katalog.kanali[1].greska, "quota");
    assert.equal(katalog.epizode.length, 9);
  });

  test("kanal koji više ne postoji ne ruši osvežavanje ostalih", async () => {
    const { svet, kanali, stari } = await triKanala();
    delete svet.kanali["@c"];
    const yt = lazniYouTube(svet);
    const poruke = [];
    const { katalog, prekid } = await osveziKatalog({
      klijent: yt,
      kanali,
      stari,
      sada: SADA,
      log: (p) => poruke.push(p),
    });

    assert.equal(prekid, null);
    assert.deepEqual(yt.pozivi.kanal, ["@a", "@c", "@d"]);
    assert.match(katalog.kanali[1].greska, /ne postoji/);
    assert.equal(katalog.epizode.length, 9);
    assert.ok(poruke.some((p) => p.startsWith("Greška za @c")));
  });

  test("posle potrošenog budžeta ostali kanali se ne diraju", async () => {
    const { svet, kanali, stari } = await triKanala();
    const yt = lazniYouTube(svet);
    const { katalog, prekid } = await osveziKatalog({
      klijent: yt,
      kanali,
      stari,
      sada: SADA,
      budzet: 2,
    });

    assert.match(prekid, /budžet/);
    assert.deepEqual(yt.pozivi.kanal, ["@a"]);
    assert.equal(katalog.epizode.length, 9);
  });

  test("kanal koji više nije potvrđen gubi stare podatke i kad osvežavanje stane", async () => {
    const { svet, kanali, stari } = await triKanala();
    svet.greske = {
      "@a": new GreskaYouTube("quota", { status: 403, razlog: "quotaExceeded" }),
    };
    const { katalog, prekid } = await osveziKatalog({
      klijent: lazniYouTube(svet),
      kanali: [potvrdjen("@a"), { ...potvrdjen("@c"), potvrdjeno: false }, potvrdjen("@d")],
      stari,
      sada: SADA,
    });
    assert.equal(prekid, "quota");
    assert.deepEqual(katalog.kanali.map((k) => k.handle), ["@a", "@d"]);
    assert.ok(!katalog.epizode.some((e) => e.kanal === "UCc"));
  });

  test("prazan katalog i bez kanala daje prazan rezultat", async () => {
    const { katalog } = await osveziKatalog({
      klijent: lazniYouTube({ kanali: {}, videi: {} }),
      kanali: [],
      stari: PRAZAN_KATALOG,
      sada: SADA,
    });
    assert.deepEqual(katalog.kanali, []);
    assert.deepEqual(katalog.epizode, []);
  });
});

describe("grupisiSerije", () => {
  const kanal = (id, handle) => ({ id, handle, ime: handle.slice(1), slika: null, jezik: "tr", titlovi: [] });
  // Realni YouTube ID-jevi imaju 11 znakova; "video_a1" je dovoljno blizu.
  const vid = (x) => `video_${x}`;
  const ep = (id, kanalId, serija, epizoda, objavljeno, sezona = 1) => ({
    id: vid(id),
    kanal: kanalId,
    serija,
    sezona,
    epizoda,
    naslov: `${serija} ${epizoda}. Bölüm`,
    objavljeno,
    trajanje: 7200,
    titlovi: false,
    ograniceno: null,
    slika: `s-${id}`,
    slikaVelika: `v-${id}`,
  });
  const katalog = {
    kanali: [kanal("UCa", "@a"), kanal("UCb", "@b")],
    epizode: [
      ep("a1", "UCa", "Mavi Rüzgâr", 1, "2026-09-01"),
      ep("a2", "UCa", "MAVİ RÜZGÂR", 2, "2026-09-08"),
      ep("a3", "UCa", "Mavi Rüzgâr", 3, "2026-09-15"),
      ep("b1", "UCb", "Mavi Rüzgâr", 1, "2026-10-01"),
      ep("b2", "UCb", "Mavi Rüzgâr", 2, "2026-10-08"),
      ep("x1", "UCb", "Jedna Epizoda", 1, "2026-10-10"),
      ep("k1", "UCa", "Aşk", 1, "2026-01-01"),
      ep("k2", "UCa", "Aşk", 2, "2026-01-08"),
      ep("s1", "UCa", "Ask", 1, "2026-02-01"),
      ep("s2", "UCa", "Ask", 2, "2026-02-08"),
      ep("bez-kanala", "UCz", "Mavi Rüzgâr", 9, "2026-10-12"),
    ],
  };
  const serije = grupisiSerije(katalog);

  test("ista serija na dva kanala su dve serije, najnovija prva", () => {
    assert.deepEqual(
      serije.map((s) => s.id),
      ["b-mavi-ruzgar", "a-mavi-ruzgar", "a-ask-2", "a-ask"],
    );
  });

  test("spaja različito napisana imena i bira najčešće", () => {
    const s = serije.find((x) => x.id === "a-mavi-ruzgar");
    assert.equal(s.ime, "Mavi Rüzgâr");
    assert.equal(s.brojEpizoda, 3);
    assert.deepEqual(s.poslednja, { id: vid("a3"), epizoda: 3, objavljeno: "2026-09-15" });
    assert.equal(s.slika, "v-a3");
  });

  test("ime bez latiničnih slova dobija ispravan i stalan ID", () => {
    const arapski = grupisiSerije({
      kanali: [kanal("UCa", "@a")],
      epizode: [
        ep("r1", "UCa", "مسلسل الريح الزرقاء", 1, "2026-09-01"),
        ep("r2", "UCa", "مسلسل الريح الزرقاء", 2, "2026-09-08"),
        ep("q1", "UCa", "مسلسل آخر", 1, "2026-09-01"),
        ep("q2", "UCa", "مسلسل آخر", 2, "2026-09-08"),
      ],
    });
    const ids = arapski.map((s) => s.id);
    assert.equal(new Set(ids).size, 2);
    for (const id of ids) assert.match(id, /^a-s[0-9a-z]+$/);
    assert.deepEqual(grupisiSerije({ kanali: [kanal("UCa", "@a")], epizode: arapski.flatMap((s) => s.epizode) }).map((s) => s.id), ids);
  });

  test("serija sa jednom epizodom i epizode nepoznatog kanala se preskaču", () => {
    assert.ok(!serije.some((s) => s.ime === "Jedna Epizoda"));
    assert.ok(!serije.some((s) => s.epizode.some((e) => e.id === vid("bez-kanala"))));
  });

  test("epizoda sa neispravnim ID-jem videa se ne koristi (ID postaje ime fajla)", () => {
    const sumnjive = grupisiSerije({
      kanali: [kanal("UCa", "@a")],
      epizode: [
        ep("m1", "UCa", "Mavi", 1, "2026-09-01"),
        ep("m2", "UCa", "Mavi", 2, "2026-09-08"),
        { ...ep("m3", "UCa", "Mavi", 3, "2026-09-15"), id: "../../../x" },
      ],
    });
    assert.deepEqual(sumnjive[0].epizode.map((e) => e.id), [vid("m1"), vid("m2")]);
  });
});
