// Delovi web aplikacije koji ne zavise od stranice: prevodi i pamćenje gledanja.

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

// Najjednostavniji localStorage za Node.
const memorija = new Map();
globalThis.localStorage = {
  getItem: (k) => (memorija.has(k) ? memorija.get(k) : null),
  setItem: (k, v) => memorija.set(k, String(v)),
  removeItem: (k) => memorija.delete(k),
};

const prevodi = await import("../sajt/prevodi.js");
const skladiste = await import("../sajt/skladiste.js");
const { izaberiTitl } = await import("../sajt/plejer.js");
// Stranica serije čita samo adresu sajta iz dokumenta.
globalThis.document = { baseURI: "https://primer.github.io/bolum/" };
const { izaberiVerziju, preporuci } = await import("../sajt/strane/serija.js");

describe("prevodi", () => {
  test("svaki jezik ima sve ključeve kao engleski", async () => {
    const izvor = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../sajt/prevodi.js", import.meta.url), "utf8"),
    );
    const kljucevi = (jezik) => {
      const blok = izvor.split(new RegExp(`\\n  ${jezik}: \\{`))[1].split(/\n  \},?\n/)[0];
      return [...blok.matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]).sort();
    };
    const engleski = kljucevi("en");
    for (const jezik of prevodi.JEZICI) {
      assert.deepEqual(kljucevi(jezik), engleski, `jezik ${jezik}`);
    }
  });

  test("množina na srpskom", () => {
    prevodi.postaviJezik("sr");
    assert.deepEqual(
      [1, 2, 5, 11, 21, 22, 25].map((n) => prevodi.t("brojEpizoda", { n })),
      ["1 epizoda", "2 epizode", "5 epizoda", "11 epizoda", "21 epizoda", "22 epizode", "25 epizoda"],
    );
  });

  test("množina i parametri na drugim jezicima", () => {
    prevodi.postaviJezik("tr");
    assert.equal(prevodi.t("brojEpizoda", { n: 45 }), "45 bölüm");
    assert.equal(prevodi.t("epizoda", { n: 7 }), "7. Bölüm");
    prevodi.postaviJezik("es");
    assert.equal(prevodi.t("brojEpizoda", { n: 1 }), "1 episodio");
    assert.equal(prevodi.t("brojEpizoda", { n: 1_000_000 }), "1000000 episodios");
    prevodi.postaviJezik("en");
    assert.equal(prevodi.t("nemaRezultata", { q: "x" }), "No series match “x”.");
  });

  test("nepoznat jezik se ignoriše i izbor se pamti", () => {
    prevodi.postaviJezik("sr");
    prevodi.postaviJezik("xx");
    assert.equal(prevodi.jezik(), "sr");
    assert.equal(localStorage.getItem("bolum:jezik"), "sr");
  });

  test("trajanje i relativno vreme", () => {
    assert.equal(prevodi.trajanje(7512), "2:05:12");
    assert.equal(prevodi.trajanje(59), "0:59");
    assert.equal(prevodi.trajanje(0), "");
    prevodi.postaviJezik("en");
    const sada = Date.parse("2026-10-14T12:00:00Z");
    assert.equal(prevodi.relativno("2026-10-13T12:00:00Z", sada), "yesterday");
    assert.equal(prevodi.relativno("2026-10-11T12:00:00Z", sada), "3 days ago");
    assert.equal(prevodi.relativno("nije datum", sada), "");
  });
});

describe("skladište", () => {
  beforeEach(() => memorija.clear());

  const zapis = (serija, t, d = 7200) => ({ serija, ime: serija, epizoda: 1, slika: null, t, d });

  test("pamti napredak i označava odgledano pred kraj", () => {
    skladiste.sacuvajNapredak("v1", zapis("s", 600));
    assert.equal(skladiste.napredak("v1").kraj, false);
    skladiste.sacuvajNapredak("v1", zapis("s", 7000));
    assert.equal(skladiste.napredak("v1").kraj, true);
    // Ponovno gledanje od početka ne briše oznaku.
    skladiste.sacuvajNapredak("v1", zapis("s", 10));
    assert.equal(skladiste.napredak("v1").kraj, true);
  });

  test("nastavak gledanja: jedna epizoda po seriji, bez završenih i tek započetih", (t) => {
    let vreme = Date.parse("2026-10-14T12:00:00Z");
    t.mock.method(Date, "now", () => (vreme += 1000));
    skladiste.sacuvajNapredak("a1", zapis("a", 600));
    skladiste.sacuvajNapredak("a2", zapis("a", 900));
    skladiste.sacuvajNapredak("b1", zapis("b", 7100));
    skladiste.sacuvajNapredak("c1", zapis("c", 5));
    const lista = skladiste.nastaviGledanje();
    assert.deepEqual(
      lista.map((z) => z.videoId),
      ["a2"],
    );
  });

  test("ograničava broj zapisa", () => {
    for (let i = 0; i < 450; i++) skladiste.sacuvajNapredak(`v${i}`, zapis("s", 100));
    const sve = JSON.parse(localStorage.getItem("bolum:napredak"));
    assert.equal(Object.keys(sve).length, 400);
  });

  test("oštećeni podaci ne ruše aplikaciju", () => {
    localStorage.setItem("bolum:napredak", "{ne json");
    localStorage.setItem("bolum:lista", '{"nije":"niz"}');
    assert.equal(skladiste.napredak("v1"), null);
    assert.deepEqual(skladiste.lista(), []);
    localStorage.setItem("bolum:napredak", JSON.stringify({ v1: { serija: 5 } }));
    assert.equal(skladiste.napredak("v1"), null);
  });

  test("moja lista: dodavanje i uklanjanje", () => {
    assert.equal(skladiste.prebaciListu("s1"), true);
    assert.equal(skladiste.prebaciListu("s2"), true);
    assert.deepEqual(skladiste.lista(), ["s2", "s1"]);
    assert.equal(skladiste.prebaciListu("s1"), false);
    assert.equal(skladiste.uListi("s1"), false);
  });

  test("podešavanja: podrazumevane vrednosti, čuvanje i odbacivanje loših", () => {
    const osnovno = { titlovi: true, jezikTitlova: null, autoSledeca: true, bioskop: false, zemlja: null };
    assert.deepEqual(skladiste.podesavanja(), osnovno);
    skladiste.sacuvajPodesavanje("bioskop", true);
    skladiste.sacuvajPodesavanje("zemlja", "TR");
    skladiste.sacuvajPodesavanje("jezikTitlova", "ar");
    assert.deepEqual(skladiste.podesavanja(), { ...osnovno, bioskop: true, zemlja: "TR", jezikTitlova: "ar" });
    localStorage.setItem(
      "bolum:podesavanja",
      JSON.stringify({ titlovi: "da", bioskop: 1, zemlja: "<script>", jezikTitlova: "x<y" }),
    );
    assert.deepEqual(skladiste.podesavanja(), osnovno);
  });
});

describe("izbor titlova u plejeru", () => {
  const spisak = {
    izvorni: [
      { languageCode: "tr", kind: "asr", is_translateable: true },
      { languageCode: "en-GB", kind: "", is_translateable: true },
      { languageCode: "ar", kind: "", is_translateable: false },
    ],
    prevodi: [
      { languageCode: "sr", languageName: "Serbian" },
      { languageCode: "es", languageName: "Spanish" },
    ],
  };

  test("titl kanala na traženom jeziku ima prednost", () => {
    assert.deepEqual(izaberiTitl(spisak, "en"), { titl: spisak.izvorni[1], prevod: false });
    assert.deepEqual(izaberiTitl(spisak, "ar"), { titl: spisak.izvorni[2], prevod: false });
  });

  test("bez titla na tom jeziku: automatski prevod ručno pravljenog titla", () => {
    const izbor = izaberiTitl(spisak, "sr");
    assert.equal(izbor.prevod, true);
    assert.equal(izbor.titl.languageCode, "en-GB");
    assert.deepEqual(izbor.titl.translationLanguage, { languageCode: "sr", languageName: "Serbian" });
  });

  test("bez titlova ili bez prevoda nema izbora", () => {
    assert.equal(izaberiTitl({ izvorni: [], prevodi: spisak.prevodi }, "sr"), null);
    assert.equal(izaberiTitl(spisak, "ja"), null);
  });
});

describe("šta dalje gledati", () => {
  const epizode = Array.from({ length: 10 }, (_, i) => ({ id: `e${i + 1}`, epizoda: i + 1, sezona: 1 }));
  const s = { id: "s", epizode };
  const z = (t, kraj, kada) => ({ serija: "s", t, d: 7200, kraj, kada });

  test("nastavlja započetu epizodu gledanu posle poslednje završene", () => {
    const zapisi = new Map([["e3", z(7200, true, 1)], ["e4", z(1800, false, 2)]]);
    assert.deepEqual(preporuci(s, zapisi), { epizoda: epizode[3], nastavak: true });
  });

  test("kratko zavirivanje se ne računa kao započeta epizoda", () => {
    const zapisi = new Map([["e4", z(7200, true, 1)], ["e9", z(4, false, 2)]]);
    assert.deepEqual(preporuci(s, zapisi), { epizoda: epizode[4], nastavak: false });
  });

  test("ponovno gledanje stare epizode ne vraća preporuku nazad", () => {
    const zapisi = new Map([["e6", z(7200, true, 1)], ["e1", z(7200, true, 2)]]);
    assert.deepEqual(preporuci(s, zapisi), { epizoda: epizode[6], nastavak: false });
  });

  test("bez zapisa prva, a posle poslednje epizode poslednja", () => {
    assert.equal(preporuci(s, new Map()).epizoda, epizode[0]);
    assert.equal(preporuci(s, new Map([["e10", z(7200, true, 1)]])).epizoda, epizode[9]);
  });

  test("red 'nastavi gledanje' se slaže sa stranicom serije", (t) => {
    memorija.clear();
    let vreme = Date.parse("2026-10-14T12:00:00Z");
    t.mock.method(Date, "now", () => (vreme += 1000));
    const zapis = (serija, sekundi) => ({ serija, ime: serija, epizoda: 1, slika: null, t: sekundi, d: 7200 });
    // Serija a: epizoda 3 do pola, pa 4 i 5 do kraja → ništa za nastavak.
    skladiste.sacuvajNapredak("a3", zapis("a", 3600));
    skladiste.sacuvajNapredak("a4", zapis("a", 7200));
    skladiste.sacuvajNapredak("a5", zapis("a", 7200));
    // Serija b: epizoda do pola, pa zavirivanje u drugu → i dalje nastavak prve.
    skladiste.sacuvajNapredak("b1", zapis("b", 3600));
    skladiste.sacuvajNapredak("b7", zapis("b", 3));
    assert.deepEqual(
      skladiste.nastaviGledanje().map((x) => x.videoId),
      ["b1"],
    );
  });
});

describe("izbor verzije serije", () => {
  const v = (n, jezici) => ({ jeziciTitlova: jezici, epizode: Array.from({ length: n }, (_, i) => ({ id: `${jezici[0] ?? "o"}${i}` })) });
  const k = { stanje: {} };

  test("verzija sa titlovima na jeziku korisnika samo ako je skoro cela", () => {
    memorija.clear();
    prevodi.postaviJezik("en");
    assert.equal(izaberiVerziju(k, { id: "s", jezik: "tr", verzije: [v(40, []), v(14, ["en"])] }), 0);
    assert.equal(izaberiVerziju(k, { id: "s", jezik: "tr", verzije: [v(40, []), v(38, ["en"])] }), 1);
  });

  test("izabrana epizoda određuje verziju", () => {
    assert.equal(izaberiVerziju(k, { id: "s", jezik: "tr", verzije: [v(40, []), v(14, ["en"])] }, "en3"), 1);
  });
});
