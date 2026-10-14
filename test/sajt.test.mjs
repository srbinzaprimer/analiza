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
    assert.deepEqual(skladiste.podesavanja(), { titlovi: true, autoSledeca: true, bioskop: false, zemlja: null });
    skladiste.sacuvajPodesavanje("bioskop", true);
    skladiste.sacuvajPodesavanje("zemlja", "TR");
    assert.deepEqual(skladiste.podesavanja(), { titlovi: true, autoSledeca: true, bioskop: true, zemlja: "TR" });
    localStorage.setItem(
      "bolum:podesavanja",
      JSON.stringify({ titlovi: "da", bioskop: 1, zemlja: "<script>" }),
    );
    assert.deepEqual(skladiste.podesavanja(), { titlovi: true, autoSledeca: true, bioskop: false, zemlja: null });
  });
});
