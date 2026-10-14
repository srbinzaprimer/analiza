#!/usr/bin/env node
// Osvežava data/katalog.json sa YouTube-a.
// Upotreba: YOUTUBE_API_KEY=... node scripts/osvezi.mjs

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { PRAZAN_KATALOG, osveziKatalog } from "../src/katalog.mjs";
import { procitajKanale } from "../src/kanali.mjs";
import { napraviKlijent } from "../src/youtube.mjs";

const PUTANJA_KANALA = "katalog/kanali.json";
const PUTANJA_KATALOGA = "data/katalog.json";

const kljuc = process.env.YOUTUBE_API_KEY?.trim();
if (!kljuc) {
  console.error(
    "Nedostaje YOUTUBE_API_KEY. Uputstvo za pravljenje ključa je u UPUTSTVO.md.",
  );
  process.exit(1);
}

const kanali = procitajKanale(JSON.parse(await readFile(PUTANJA_KANALA, "utf8")));
const stari = await procitajKatalog();

const { katalog, prekid, potroseno } = await osveziKatalog({
  klijent: napraviKlijent({ kljuc }),
  kanali,
  stari,
  log: (poruka) => console.log(bezbedanRed(poruka)),
});
console.log(`Potrošeno jedinica YouTube kvote: ${potroseno}`);

if (bezIzmena(stari, katalog)) {
  console.log("Katalog je isti kao pre, fajl nije menjan.");
} else {
  await mkdir(dirname(PUTANJA_KATALOGA), { recursive: true });
  await writeFile(PUTANJA_KATALOGA, JSON.stringify(katalog, null, 1) + "\n", "utf8");
  console.log(
    `Sačuvano: ${katalog.kanali.length} kanala, ${katalog.epizode.length} epizoda.`,
  );
}

if (prekid) {
  console.error(`Osvežavanje nije završeno: ${prekid}`);
  process.exitCode = 1;
}

/**
 * Imena kanala i poruke dolaze sa YouTube-a. GitHub Actions tumači redove koji
 * počinju sa "::" kao komande, pa nijedan red ne sme da počne tuđim tekstom.
 */
function bezbedanRed(tekst) {
  return "• " + String(tekst).replace(/[\u0000-\u001f\u007f]+/g, " ");
}

async function procitajKatalog() {
  try {
    return JSON.parse(await readFile(PUTANJA_KATALOGA, "utf8"));
  } catch (greska) {
    if (greska.code === "ENOENT") return PRAZAN_KATALOG;
    throw greska;
  }
}

/** Isti katalog, ne računajući vreme osvežavanja. */
function bezIzmena(a, b) {
  return (
    JSON.stringify({ ...a, osvezeno: null }) === JSON.stringify({ ...b, osvezeno: null })
  );
}
