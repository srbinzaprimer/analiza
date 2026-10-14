// Spajanje YouTube epizoda i TMDB podataka (src/spoj.mjs).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { popularne, pripremiSerije, tmdbSlika } from "../src/spoj.mjs";
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

  test("tmdbSlika ne pravi adresu bez putanje", () => {
    assert.equal(tmdbSlika(null, "w342"), null);
  });
});
