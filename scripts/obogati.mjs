#!/usr/bin/env node
// Dopunjava data/tmdb.json podacima sa TMDB-a (poster, opisi, žanrovi, glumci,
// gde se serija još legalno gleda).
// Upotreba: TMDB_API_KEY=... node scripts/obogati.mjs

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { PRAZAN_KATALOG, grupisiSerije } from "../src/katalog.mjs";
import { PRAZNO_OBOGACIVANJE, napraviTmdbKlijent, obogati } from "../src/tmdb.mjs";

const PUTANJA_KATALOGA = "data/katalog.json";
const PUTANJA_TMDB = "data/tmdb.json";
const PUTANJA_ISPRAVKI = "katalog/serije.json";

const kljuc = process.env.TMDB_API_KEY?.trim();
if (!kljuc) {
  console.error("Nedostaje TMDB_API_KEY. Uputstvo za ključ je u UPUTSTVO.md.");
  process.exit(1);
}

const katalog = await procitaj(PUTANJA_KATALOGA, PRAZAN_KATALOG);
const stari = await procitaj(PUTANJA_TMDB, PRAZNO_OBOGACIVANJE);
const { ispravke = {} } = await procitaj(PUTANJA_ISPRAVKI, {});

const { podaci, prekid } = await obogati({
  klijent: napraviTmdbKlijent({ kljuc }),
  serije: grupisiSerije(katalog),
  stari,
  ispravke,
  // Nazivi serija dolaze sa YouTube-a: nijedan red loga ne sme da počne njima.
  log: (poruka) => console.log("• " + String(poruka).replace(/[\u0000-\u001f\u007f]+/g, " ")),
});

const isti = (a, b) =>
  JSON.stringify({ ...a, osvezeno: null }) === JSON.stringify({ ...b, osvezeno: null });
if (isti(stari, podaci)) {
  console.log("TMDB podaci su isti kao pre, fajl nije menjan.");
} else {
  await mkdir(dirname(PUTANJA_TMDB), { recursive: true });
  await writeFile(PUTANJA_TMDB, JSON.stringify(podaci, null, 1) + "\n", "utf8");
  const nadjeno = Object.values(podaci.serije).filter((z) => z.tmdbId).length;
  console.log(`Sačuvano: ${nadjeno} od ${Object.keys(podaci.serije).length} serija ima TMDB podatke.`);
}

if (prekid) {
  console.error(`Obogaćivanje nije završeno: ${prekid}`);
  process.exitCode = 1;
}

async function procitaj(putanja, podrazumevano) {
  try {
    return JSON.parse(await readFile(putanja, "utf8"));
  } catch (greska) {
    if (greska.code === "ENOENT") return podrazumevano;
    throw greska;
  }
}
