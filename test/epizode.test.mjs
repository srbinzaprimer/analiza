import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  kljucSerije,
  procitajNaslov,
  slug,
  trajanjeUSekundama,
} from "../src/epizode.mjs";

describe("procitajNaslov", () => {
  const slucajevi = [
    ["Mavi Rüzgâr 45. Bölüm", { serija: "Mavi Rüzgâr", sezona: 1, epizoda: 45 }],
    ["Kayıp Şehir 2. Sezon 12. Bölüm @primerkanal", { serija: "Kayıp Şehir", sezona: 2, epizoda: 12 }],
    ["MAVİ RÜZGÂR 7. BÖLÜM", { serija: "MAVİ RÜZGÂR", sezona: 1, epizoda: 7 }],
    ["Eski Konak Episode 45 (English Subtitles)", { serija: "Eski Konak", sezona: 1, epizoda: 45 }],
    ["Eski Konak | Episode 12", { serija: "Eski Konak", sezona: 1, epizoda: 12 }],
    ["Gece Yarısı Season 2 Episode 3 [4K]", { serija: "Gece Yarısı", sezona: 2, epizoda: 3 }],
    ["Bölüm 12 - Sahil Kasabası", { serija: "Sahil Kasabası", sezona: 1, epizoda: 12 }],
    ["Sahil Kasabası Capítulo 3", { serija: "Sahil Kasabası", sezona: 1, epizoda: 3 }],
    ["Sahil Kasabası Temporada 2 Capítulo 30", { serija: "Sahil Kasabası", sezona: 2, epizoda: 30 }],
    ["مسلسل الريح الزرقاء الحلقة 5", { serija: "مسلسل الريح الزرقاء", sezona: 1, epizoda: 5 }],
  ];
  for (const [naslov, ocekivano] of slucajevi) {
    test(naslov, () => assert.deepEqual(procitajNaslov(naslov), ocekivano));
  }

  const odbaceni = [
    "Mavi Rüzgâr 45. Bölüm Fragmanı",
    "Mavi Rüzgâr 46. Bölüm 2. Fragman",
    "Kayıp Şehir 44. Bölüm Özel Klip",
    "Kayıp Şehir 44. Bölüm | Final Sahnesi",
    "Mavi Rüzgâr 45. Bölüm #shorts",
    "Eski Konak Episode 4 Trailer",
    "Mavi Rüzgâr 45. Bölüm Özet",
    "Mavi Rüzgâr Kamera Arkası",
    "Mavi Rüzgâr Tüm Bölümler",
    "Mavi Rüzgâr 0. Bölüm",
    "45. Bölüm",
    "",
  ];
  for (const naslov of odbaceni) {
    test(`odbacuje: "${naslov}"`, () => assert.equal(procitajNaslov(naslov), null));
  }
});

test("kljucSerije ne zavisi od velikih slova (i turskog I)", () => {
  assert.equal(kljucSerije("KAYIP ŞEHİR"), kljucSerije("Kayıp Şehir"));
  assert.equal(kljucSerije("Mavi  Rüzgâr "), "mavi rüzgâr");
});

test("slug pravi adrese bez posebnih znakova", () => {
  assert.equal(slug("Kayıp Şehir"), "kayip-sehir");
  assert.equal(slug("Mavi Rüzgâr"), "mavi-ruzgar");
  assert.equal(slug("Aşk-ı Gece!"), "ask-i-gece");
  assert.equal(slug("@primerkanal"), "primerkanal");
});

test("trajanjeUSekundama čita ISO 8601 trajanja", () => {
  assert.equal(trajanjeUSekundama("PT2H5M12S"), 7512);
  assert.equal(trajanjeUSekundama("PT45M"), 2700);
  assert.equal(trajanjeUSekundama("P1DT1H"), 90_000);
  assert.equal(trajanjeUSekundama("PT0S"), 0);
  assert.equal(trajanjeUSekundama("P0D"), 0);
  assert.equal(trajanjeUSekundama("2 sata"), null);
  assert.equal(trajanjeUSekundama(undefined), null);
});
