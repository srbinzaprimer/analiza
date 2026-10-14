// Spajanje YouTube epizoda i TMDB podataka (src/spoj.mjs).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { popularne, pripremiSerije, spojiVerzije, tmdbSlika } from "../src/spoj.mjs";
import { PRAZNO_OBOGACIVANJE } from "../src/tmdb.mjs";

const OSVEZENO = "2026-10-14T04:00:00.000Z";
const DAN = 86_400_000;
const pre = (dana) => new Date(Date.parse(OSVEZENO) - dana * DAN).toISOString();

const katalog = {
  verzija: 1,
  osvezeno: OSVEZENO,
  kanali: [
    { id: "UC1", ime: "Prvi", handle: "@prvi", slika: null, jezik: "tr", titlovi: ["en"] },
    { id: "UC2", ime: "Drugi", handle: "@drugi", slika: null, jezik: "tr", titlovi: [] },
  ],
  epizode: [
    epizoda("aaaaaa1", "UC1", "Mavi Rüzgâr", 1, 40, 90_000, ["ar"]),
    epizoda("aaaaaa2", "UC1", "Mavi Rüzgâr", 2, 2, 40_000, ["es"]),
    epizoda("bbbbbb1", "UC2", "Eski Konak", 1, 30, 900_000),
    epizoda("bbbbbb2", "UC2", "Eski Konak", 2, 20, 800_000),
  ],
};

function epizoda(id, kanal, serija, broj, danaStara, pregleda, jeziciTitlova = []) {
  return {
    id,
    kanal,
    serija,
    sezona: 1,
    epizoda: broj,
    naslov: `${serija} ${broj}. Bölüm`,
    objavljeno: pre(danaStara),
    trajanje: 7200,
    titlovi: jeziciTitlova.length > 0,
    jeziciTitlova,
    pregleda,
    ograniceno: null,
    slika: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    slikaVelika: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
  };
}

const tmdb = {
  ...PRAZNO_OBOGACIVANJE,
  serije: {
    "prvi-mavi-ruzgar": {
      tmdbId: 101,
      originalniNaziv: "Mavi Rüzgâr",
      nazivi: { en: "Blue Wind", sr: "Plavi vetar", tr: "Mavi Rüzgâr", es: "Viento azul" },
      opisi: { en: "Sea.", sr: "More.", tr: "Deniz.", es: "Mar." },
      godina: 2025,
      zavrsena: false,
      zanrovi: [18],
      ocena: 7.9,
      poster: "/p.jpg",
      pozadina: "/b.jpg",
      glumci: [{ ime: "A", uloga: "B", slika: "/g.jpg" }],
      gledanje: { RS: { pretplata: [8], besplatno: [], uzReklame: [], najam: [], kupovina: [] } },
      sajt: "https://tv.example/mavi-ruzgar",
      mreze: [{ ime: "Prva TV", logo: "/m.png" }],
    },
    // Serija koju TMDB nije pronašao.
    "drugi-eski-konak": { tmdbId: null, osvezeno: OSVEZENO },
  },
  provajderi: {
    8: { ime: "Netflix", logo: "/n.png" },
    9: { ime: "Neiskorišćen", logo: "/x.png" },
  },
  zanrovi: { en: { 18: "Drama", 35: "Comedy" }, sr: { 18: "Drama", 35: "Komedija" } },
};

describe("pripremiSerije", () => {
  const { serije, zanrovi, provajderi } = pripremiSerije(katalog, tmdb);
  const mavi = serije.find((s) => s.id === "prvi-mavi-ruzgar");
  const konak = serije.find((s) => s.id === "drugi-eski-konak");

  test("dodaje TMDB podatke i prave adrese slika", () => {
    assert.equal(mavi.tmdbId, 101);
    assert.equal(mavi.nazivi.sr, "Plavi vetar");
    assert.equal(mavi.ocena, 7.9);
    assert.equal(mavi.poster, "https://image.tmdb.org/t/p/w342/p.jpg");
    assert.equal(mavi.posterVeliki, "https://image.tmdb.org/t/p/w780/p.jpg");
    assert.equal(mavi.pozadina, "https://image.tmdb.org/t/p/w1280/b.jpg");
    assert.equal(mavi.glumci[0].slika, "https://image.tmdb.org/t/p/w185/g.jpg");
    assert.equal(mavi.brojEpizoda, 2, "epizode ostaju sa YouTube-a");
  });

  test("bez TMDB pogotka ostaju YouTube ime i sličica", () => {
    assert.equal(konak.tmdbId, null);
    assert.equal(konak.poster, null);
    assert.equal(konak.pozadina, "https://i.ytimg.com/vi/bbbbbb2/maxresdefault.jpg");
    assert.deepEqual(konak.zanrovi, []);
    assert.deepEqual(konak.gledanje, {});
  });

  test("jezici titlova spajaju kanal i epizode", () => {
    assert.deepEqual(mavi.jeziciTitlova, ["ar", "en", "es"]);
    assert.deepEqual(konak.jeziciTitlova, []);
  });

  test("trend gleda samo sveže epizode, pregledi se sabiraju", () => {
    // Epizoda stara 2 dana sa 40.000 pregleda → 20.000 dnevno; starije se ne računaju.
    assert.equal(mavi.trend, 20_000);
    assert.equal(mavi.pregleda, 130_000);
    assert.equal(konak.trend, 0);
    assert.equal(konak.pregleda, 1_700_000);
  });

  test("popularne: prvo trend, pa ukupni pregledi", () => {
    assert.deepEqual(
      popularne(serije).map((s) => s.id),
      ["prvi-mavi-ruzgar", "drugi-eski-konak"],
    );
    const bezTrenda = serije.map((s) => ({ ...s, trend: 0 }));
    assert.deepEqual(
      popularne(bezTrenda).map((s) => s.id),
      ["drugi-eski-konak", "prvi-mavi-ruzgar"],
    );
  });

  test("šalje samo žanrove i platforme koje se koriste", () => {
    assert.deepEqual(zanrovi, { en: { 18: "Drama" }, sr: { 18: "Drama" } });
    assert.deepEqual(provajderi, {
      8: { ime: "Netflix", logo: "https://image.tmdb.org/t/p/w92/n.png" },
    });
  });

  test("radi i bez TMDB podataka", () => {
    const { serije: bez, zanrovi: z, provajderi: p } = pripremiSerije(katalog);
    assert.equal(bez.length, 2);
    assert.ok(bez.every((s) => s.tmdbId === null && s.poster === null));
    assert.deepEqual(z, {});
    assert.deepEqual(p, {});
  });

  test("zvanični sajt i televizija", () => {
    assert.equal(mavi.sajt, "https://tv.example/mavi-ruzgar");
    assert.deepEqual(mavi.mreze, [{ ime: "Prva TV", logo: "https://image.tmdb.org/t/p/w154/m.png" }]);
    assert.equal(konak.sajt, null);
  });

  test("serija bez drugih kanala ima jednu verziju", () => {
    assert.equal(mavi.verzije.length, 1);
    assert.equal(mavi.verzije[0].epizode, mavi.epizode);
  });

  test("tmdbSlika ne pravi adresu bez putanje", () => {
    assert.equal(tmdbSlika(null, "w342"), null);
  });
});

describe("spojiVerzije", () => {
  // Međunarodni kanal objavljuje istu seriju pod engleskim imenom, sa titlovima.
  const saMedjunarodnim = {
    ...katalog,
    kanali: [
      ...katalog.kanali,
      { id: "UC3", ime: "Prvi English", handle: "@prvien", slika: null, jezik: "tr", titlovi: ["en"] },
    ],
    epizode: [
      ...katalog.epizode,
      epizoda("cccccc1", "UC3", "Blue Wind", 1, 3, 5_000, ["en"]),
      epizoda("cccccc2", "UC3", "Blue Wind", 2, 1, 9_000, ["en"]),
    ],
  };
  const tmdbSaVerzijom = {
    ...tmdb,
    serije: { ...tmdb.serije, "prvien-blue-wind": { ...tmdb.serije["prvi-mavi-ruzgar"] } },
  };
  const { serije, aliasi } = pripremiSerije(saMedjunarodnim, tmdbSaVerzijom);

  test("ista TMDB serija sa dva kanala postaje jedna serija sa dve verzije", () => {
    assert.equal(serije.length, 2);
    const mavi = serije.find((s) => s.id === "prvi-mavi-ruzgar");
    assert.deepEqual(
      mavi.verzije.map((v) => v.kanal.handle),
      ["@prvi", "@prvien"],
    );
    assert.deepEqual(mavi.verzije[1].epizode.map((e) => e.id), ["cccccc1", "cccccc2"]);
    assert.deepEqual(aliasi, { "prvien-blue-wind": "prvi-mavi-ruzgar" });
  });

  test("spojena serija sabira preglede i titlove svih verzija", () => {
    const mavi = serije.find((s) => s.id === "prvi-mavi-ruzgar");
    assert.equal(mavi.pregleda, 130_000 + 14_000);
    assert.deepEqual(mavi.jeziciTitlova, ["ar", "en", "es"]);
    assert.equal(mavi.epizode, mavi.verzije[0].epizode, "glavna verzija ostaje osnova serije");
  });

  test("glavna je verzija sa najviše epizoda, a serije bez TMDB-a se ne spajaju", () => {
    const a = { id: "a", tmdbId: 5, brojEpizoda: 2, epizode: [], jeziciTitlova: [], pregleda: 0, trend: 0 };
    const b = { id: "b", tmdbId: 5, brojEpizoda: 9, epizode: [], jeziciTitlova: [], pregleda: 0, trend: 0 };
    const c = { id: "c", tmdbId: null, brojEpizoda: 1, epizode: [], jeziciTitlova: [], pregleda: 0, trend: 0 };
    const d = { ...c, id: "d" };
    const { serije: s, aliasi: a2 } = spojiVerzije([a, b, c, d]);
    assert.deepEqual(s.map((x) => x.id), ["b", "c", "d"]);
    assert.deepEqual(a2, { a: "b" });
  });
});
