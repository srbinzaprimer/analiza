import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  GreskaTmdb,
  PRAZNO_OBOGACIVANJE,
  izaberiPogodak,
  napraviTmdbKlijent,
  napraviZapis,
  obogati,
  uLatinicu,
} from "../src/tmdb.mjs";

const SADA = new Date("2026-10-14T05:00:00Z");
const DAN = 86_400_000;

describe("izaberiPogodak", () => {
  const rezultat = (id, original_name, dodatno = {}) => ({
    id,
    name: original_name,
    original_name,
    original_language: "tr",
    origin_country: ["TR"],
    popularity: 10,
    ...dodatno,
  });

  test("prihvata samo tačno ime turske serije", () => {
    const rezultati = [
      rezultat(1, "Kayıp Şehir Efsanesi"),
      rezultat(2, "Kayıp Şehir", { original_language: "en", origin_country: ["US"] }),
      rezultat(3, "Kayıp Şehir"),
    ];
    assert.equal(izaberiPogodak("Kayıp Şehir", rezultati).id, 3);
    assert.equal(izaberiPogodak("KAYIP ŞEHİR", rezultati).id, 3);
    assert.equal(izaberiPogodak("Kayip Sehir", rezultati).id, 3);
    assert.equal(izaberiPogodak("Kayıp", rezultati), null);
  });

  test("kod rimejka bira seriju koja je počela najbliže prvoj epizodi", () => {
    const rezultati = [
      rezultat(10, "Mavi Rüzgâr", { first_air_date: "1998-01-01", popularity: 90 }),
      rezultat(11, "Mavi Rüzgâr", { first_air_date: "2025-09-10", popularity: 5 }),
    ];
    assert.equal(izaberiPogodak("Mavi Rüzgâr", rezultati, "2025-09-12T18:00:00Z").id, 11);
    assert.equal(izaberiPogodak("Mavi Rüzgâr", rezultati).id, 10, "bez datuma: popularnija");
  });
});

test("uLatinicu prebacuje srpsku ćirilicu", () => {
  assert.equal(uLatinicu("Љубав и џез у Ђурђевом граду"), "Ljubav i džez u Đurđevom gradu");
  assert.equal(uLatinicu("Mavi Rüzgâr"), "Mavi Rüzgâr");
});

const DETALJI = {
  id: 77,
  name: "Blue Wind",
  original_name: "Mavi Rüzgâr",
  overview: "An English overview.",
  first_air_date: "2025-09-10",
  status: "Returning Series",
  genres: [{ id: 18, name: "Drama" }],
  vote_average: 7.84,
  vote_count: 120,
  poster_path: "/poster.jpg",
  backdrop_path: "/pozadina.jpg",
  external_ids: { imdb_id: "tt0000001" },
  translations: {
    translations: [
      { iso_639_1: "sr", iso_3166_1: "RS", data: { name: "Плави ветар", overview: "Опис на српском." } },
      { iso_639_1: "es", iso_3166_1: "MX", data: { name: "Viento azul (MX)", overview: "Descripción MX." } },
      { iso_639_1: "es", iso_3166_1: "ES", data: { name: "Viento azul", overview: "Descripción ES." } },
      { iso_639_1: "tr", iso_3166_1: "TR", data: { name: "Mavi Rüzgâr", overview: "" } },
    ],
  },
  aggregate_credits: {
    cast: Array.from({ length: 15 }, (_, i) => ({
      name: `Glumac ${i}`,
      order: 14 - i,
      profile_path: `/g${i}.jpg`,
      roles: [{ character: `Uloga ${i}` }],
    })),
  },
  "watch/providers": {
    results: {
      RS: { link: "https://tmdb/rs", flatrate: [{ provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg", display_priority: 1 }] },
      TR: {
        link: "https://tmdb/tr",
        free: [{ provider_id: 500, provider_name: "Primer TV", logo_path: "/t.jpg", display_priority: 2 }],
        ads: [],
      },
      XX: { link: "https://tmdb/xx" },
    },
  },
};

describe("napraviZapis", () => {
  const provajderi = {};
  const zapis = napraviZapis(DETALJI, provajderi, SADA);

  test("bira prevode po jeziku sajta, srpski na latinici", () => {
    assert.deepEqual(zapis.nazivi, {
      en: "Blue Wind",
      sr: "Plavi vetar",
      tr: "Mavi Rüzgâr",
      es: "Viento azul",
    });
    assert.equal(zapis.opisi.sr, "Opis na srpskom.");
    assert.equal(zapis.opisi.es, "Descripción ES.");
    assert.equal(zapis.opisi.tr, null, "prazan opis se ne računa");
    assert.equal(zapis.opisi.en, "An English overview.");
  });

  test("osnovni podaci, ocena i glumci po redosledu", () => {
    assert.equal(zapis.tmdbId, 77);
    assert.equal(zapis.imdb, "tt0000001");
    assert.equal(zapis.godina, 2025);
    assert.equal(zapis.ocena, 7.8);
    assert.deepEqual(zapis.zanrovi, [18]);
    assert.equal(zapis.glumci.length, 12);
    assert.equal(zapis.glumci[0].ime, "Glumac 14");
    assert.equal(zapis.glumci[0].uloga, "Uloga 14");
  });

  test("platforme po zemljama i zajednički rečnik", () => {
    assert.deepEqual(zapis.gledanje, { RS: { pretplata: [8] }, TR: { besplatno: [500] } });
    assert.deepEqual(provajderi[8], { ime: "Netflix", logo: "/n.jpg" });
  });

  test("ocena sa premalo glasova se ne prikazuje", () => {
    assert.equal(napraviZapis({ ...DETALJI, vote_count: 3 }, {}, SADA).ocena, null);
  });
});

/** Lažni TMDB klijent koji broji pozive. */
function lazniTmdb({ pretraga = {}, detalji = {}, greska = null } = {}) {
  const pozivi = { trazi: [], detalji: [], zanrovi: 0 };
  return {
    pozivi,
    async trazi(naziv) {
      pozivi.trazi.push(naziv);
      if (greska) throw greska;
      return pretraga[naziv] ?? [];
    },
    async detalji(id) {
      pozivi.detalji.push(id);
      if (greska) throw greska;
      return detalji[id] ?? null;
    },
    async zanrovi(jezik) {
      pozivi.zanrovi++;
      return [{ id: 18, name: jezik === "sr" ? "Драма" : "Drama" }];
    },
  };
}

const serija = (id, ime) => ({ id, ime, epizode: [{ objavljeno: "2025-09-12T18:00:00Z" }] });
const pogodak = { id: 77, name: "Blue Wind", original_name: "Mavi Rüzgâr", original_language: "tr" };

describe("obogati", () => {
  test("prvi put traži, uparuje i preuzima detalje i žanrove", async () => {
    const tmdb = lazniTmdb({ pretraga: { "Mavi Rüzgâr": [pogodak] }, detalji: { 77: DETALJI } });
    const { podaci, prekid } = await obogati({
      klijent: tmdb,
      serije: [serija("a-mavi", "Mavi Rüzgâr"), serija("a-nema", "Nepoznata")],
      sada: SADA,
    });
    assert.equal(prekid, null);
    assert.equal(podaci.serije["a-mavi"].tmdbId, 77);
    assert.deepEqual(podaci.serije["a-nema"], { tmdbId: null, osvezeno: SADA.toISOString() });
    assert.equal(podaci.zanrovi.sr[18], "Drama");
    assert.ok(podaci.provajderi[8]);
    assert.equal(tmdb.pozivi.zanrovi, 4);
  });

  test("u roku od nedelju dana koristi sačuvano, posle toga osvežava", async () => {
    const prvi = await obogati({
      klijent: lazniTmdb({ pretraga: { "Mavi Rüzgâr": [pogodak] }, detalji: { 77: DETALJI } }),
      serije: [serija("a-mavi", "Mavi Rüzgâr")],
      sada: SADA,
    });

    const posleDan = lazniTmdb();
    await obogati({
      klijent: posleDan,
      serije: [serija("a-mavi", "Mavi Rüzgâr")],
      stari: prvi.podaci,
      sada: new Date(SADA.getTime() + DAN),
    });
    assert.deepEqual(posleDan.pozivi.detalji, []);
    assert.deepEqual(posleDan.pozivi.trazi, []);

    const posleNedelju = lazniTmdb({ detalji: { 77: DETALJI } });
    await obogati({
      klijent: posleNedelju,
      serije: [serija("a-mavi", "Mavi Rüzgâr")],
      stari: prvi.podaci,
      sada: new Date(SADA.getTime() + 8 * DAN),
    });
    assert.deepEqual(posleNedelju.pozivi.trazi, [], "poznat ID se ne traži ponovo");
    assert.deepEqual(posleNedelju.pozivi.detalji, [77]);
  });

  test("ručna ispravka: tačan ID ili isključivanje", async () => {
    const tmdb = lazniTmdb({ detalji: { 99: { ...DETALJI, id: 99 } } });
    const { podaci } = await obogati({
      klijent: tmdb,
      serije: [serija("a-mavi", "Mavi Rüzgâr"), serija("a-druga", "Druga")],
      ispravke: { "a-mavi": { tmdb: 99 }, "a-druga": { tmdb: null } },
      sada: SADA,
    });
    assert.equal(podaci.serije["a-mavi"].tmdbId, 99);
    assert.equal(podaci.serije["a-druga"], undefined);
    assert.deepEqual(tmdb.pozivi.trazi, []);
  });

  test("ručna ispravka upisana kao tekst važi, a neispravna se zanemaruje", async () => {
    const prvi = await obogati({
      klijent: lazniTmdb({ detalji: { 99: { ...DETALJI, id: 99 } } }),
      serije: [serija("a-mavi", "Mavi Rüzgâr")],
      ispravke: { "a-mavi": { tmdb: "99" } },
      sada: SADA,
    });
    assert.equal(prvi.podaci.serije["a-mavi"].tmdbId, 99);
    // Sledeći dan: zapis se slaže sa ispravkom, pa nema novih zahteva.
    const drugi = lazniTmdb();
    await obogati({
      klijent: drugi,
      serije: [serija("a-mavi", "Mavi Rüzgâr")],
      ispravke: { "a-mavi": { tmdb: "99" } },
      stari: prvi.podaci,
      sada: new Date(SADA.getTime() + DAN),
    });
    assert.deepEqual(drugi.pozivi.detalji, []);

    const poruke = [];
    const treci = lazniTmdb({ pretraga: { "Mavi Rüzgâr": [pogodak] }, detalji: { 77: DETALJI } });
    const { podaci } = await obogati({
      klijent: treci,
      serije: [serija("a-mavi", "Mavi Rüzgâr")],
      ispravke: { "a-mavi": { tmdb: "nešto" } },
      sada: SADA,
      log: (p) => poruke.push(p),
    });
    assert.equal(podaci.serije["a-mavi"].tmdbId, 77, "uparuje se po imenu");
    assert.ok(poruke.some((p) => p.includes("neispravna ispravka")));
  });

  test("neispravan ključ: staje i zadržava stare podatke", async () => {
    const stari = {
      ...PRAZNO_OBOGACIVANJE,
      serije: { "a-mavi": { tmdbId: 77, osvezeno: "2026-01-01T00:00:00Z", gledanje: {} } },
      zanrovi: { en: { 18: "Drama" } },
      zanroviOsvezeno: SADA.toISOString(),
    };
    const tmdb = lazniTmdb({ greska: new GreskaTmdb("Invalid API key", { status: 401 }) });
    const { podaci, prekid } = await obogati({
      klijent: tmdb,
      serije: [serija("a-mavi", "Mavi Rüzgâr"), serija("a-b", "B"), serija("a-c", "C")],
      stari,
      sada: SADA,
    });
    assert.equal(prekid, "Invalid API key");
    assert.equal(podaci.serije["a-mavi"].tmdbId, 77);
    assert.equal(tmdb.pozivi.detalji.length + tmdb.pozivi.trazi.length, 1, "posle kobne greške nema poziva");
  });
});

describe("napraviTmdbKlijent", () => {
  test("kratak ključ ide u adresu, token u zaglavlje", async () => {
    const zahtevi = [];
    const fetchFn = async (url, opcije) => {
      zahtevi.push({ url: new URL(url), opcije });
      return new Response(JSON.stringify({ results: [] }));
    };
    await napraviTmdbKlijent({ kljuc: "abc123", fetchFn }).trazi("Mavi");
    await napraviTmdbKlijent({ kljuc: "eyJtoken", fetchFn }).trazi("Mavi");
    assert.equal(zahtevi[0].url.searchParams.get("api_key"), "abc123");
    assert.equal(zahtevi[0].url.searchParams.get("query"), "Mavi");
    assert.equal(zahtevi[1].url.searchParams.get("api_key"), null);
    assert.equal(zahtevi[1].opcije.headers.authorization, "Bearer eyJtoken");
  });

  test("404 je null, 429 se ponavlja, 401 je kobna greška", async () => {
    const odgovori = [
      new Response("{}", { status: 404 }),
      new Response("{}", { status: 429, headers: { "retry-after": "1" } }),
      new Response(JSON.stringify({ id: 5 })),
      new Response(JSON.stringify({ status_message: "Invalid API key" }), { status: 401 }),
    ];
    const cekanja = [];
    const tmdb = napraviTmdbKlijent({
      kljuc: "k",
      fetchFn: async () => odgovori.shift(),
      cekaj: async (pokusaj, sekundi) => cekanja.push(sekundi),
    });
    assert.equal(await tmdb.detalji(1), null);
    assert.deepEqual(await tmdb.detalji(5), { id: 5 });
    assert.deepEqual(cekanja, [1]);
    const greska = await tmdb.detalji(6).catch((g) => g);
    assert.ok(greska instanceof GreskaTmdb);
    assert.equal(greska.kobna, true);
  });
});
