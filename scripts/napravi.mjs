#!/usr/bin/env node
// Pravi sajt, podatke i Stremio dodatak u folderu dist/.
// Upotreba: node scripts/napravi.mjs [--katalog data/katalog.json] [--adresa https://.../]
//          node scripts/napravi.mjs --primer   (izmišljeni demo podaci i slike iz test/)

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

import { PRAZAN_KATALOG } from "../src/katalog.mjs";
import { popularne, pripremiSerije } from "../src/spoj.mjs";
import { esc, napraviStrane } from "../src/strane.mjs";
import { stremioFajlovi } from "../src/stremio.mjs";
import { PRAZNO_OBOGACIVANJE } from "../src/tmdb.mjs";

const { values: o } = parseArgs({
  options: {
    katalog: { type: "string", default: "data/katalog.json" },
    tmdb: { type: "string", default: "data/tmdb.json" },
    primer: { type: "boolean", default: false },
    izlaz: { type: "string", default: "dist" },
    adresa: { type: "string", default: "" },
    // U GitHub Actions repozitorijum je poznat, pa i forkovi linkuju na sebe.
    izvor: {
      type: "string",
      default: process.env.GITHUB_REPOSITORY
        ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${process.env.GITHUB_REPOSITORY}`
        : "https://github.com/srbinzaprimer/analiza",
    },
  },
});

proveriIzlaz(o.izlaz);
const adresa = normalizujAdresu(o.adresa);
const baza = adresa ? new URL(adresa).pathname : "/";
// Demo: izmišljene serije sa lokalnim slikama, za pregled izgleda bez ključeva.
if (o.primer) {
  o.katalog = "test/primer-katalog.json";
  o.tmdb = "test/primer-tmdb.json";
}
const katalog = await procitajJson(o.katalog, PRAZAN_KATALOG);
const tmdb = await procitajJson(o.tmdb, PRAZNO_OBOGACIVANJE);
const { serije, zanrovi, provajderi } = pripremiSerije(
  katalog,
  tmdb,
  o.primer ? { slika: (putanja) => (putanja ? `${adresa}primer${putanja}` : null) } : {},
);
const { version: verzija } = JSON.parse(await readFile("package.json", "utf8"));

const fajlovi = new Map();
const sablon = await readFile("sajt/sablon.html", "utf8");
for (const [putanja, html] of napraviStrane({ sablon, serije, zanrovi, adresa, baza, izvor: o.izvor })) {
  fajlovi.set(putanja, html);
}

// Naslovni karusel: serije u trendu koje imaju lepu pozadinu, sa opisima.
const istaknute = popularne(serije)
  .filter((s) => s.pozadina)
  .slice(0, 6)
  .map((s) => ({ id: s.id, opisi: s.opisi, pozadina: s.pozadina }));

fajlovi.set(
  "podaci/serije.json",
  json({ osvezeno: katalog.osvezeno, zanrovi, provajderi, istaknute, serije: serije.map(sazetak) }),
);
for (const s of serije) {
  fajlovi.set(
    `podaci/serija/${s.id}.json`,
    json({
      ...sazetak(s),
      opisi: s.opisi,
      pozadina: s.pozadina,
      posterVeliki: s.posterVeliki,
      glumci: s.glumci,
      gledanje: s.gledanje,
      imdb: s.imdb,
      tmdbId: s.tmdbId,
      epizode: s.epizode.map(epizodaZaSajt),
    }),
  );
}

for (const [putanja, sadrzaj] of stremioFajlovi(serije, { adresa, verzija, zanrovi })) {
  fajlovi.set(`stremio/${putanja}`, json(sadrzaj));
}

// Ako se sajt ikad objavi iz grane umesto preko Actions, ovo isključuje Jekyll.
fajlovi.set(".nojekyll", "");
if (adresa) {
  fajlovi.set("sitemap.xml", mapaSajta(serije));
  fajlovi.set("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${adresa}sitemap.xml\n`);
}

await rm(o.izlaz, { recursive: true, force: true });
await cp("sajt", o.izlaz, {
  recursive: true,
  filter: (izvor) => !izvor.endsWith("sablon.html"),
});
if (o.primer) await cp("test/primer-slike", join(o.izlaz, "primer"), { recursive: true });
for (const [putanja, sadrzaj] of fajlovi) {
  const cilj = join(o.izlaz, putanja);
  await mkdir(dirname(cilj), { recursive: true });
  await writeFile(cilj, sadrzaj, "utf8");
}

const epizoda = serije.reduce((zbir, s) => zbir + s.brojEpizoda, 0);
console.log(
  `Napravljeno u ${o.izlaz}/: ${serije.length} serija, ${epizoda} epizoda` +
    (adresa ? `, adresa ${adresa}` : ", bez javne adrese (lokalno)"),
);

function prekini(poruka) {
  console.error(poruka);
  process.exit(1);
}

/** Izlazni folder se briše pre build-a, pa ne sme da bude projekat ni njegov deo. */
function proveriIzlaz(izlaz) {
  const cilj = resolve(izlaz);
  const projekat = resolve(".");
  const zasticeni = ["sajt", "src", "scripts", "test", "katalog", "data", ".github", ".git"];
  if (
    cilj === projekat ||
    projekat.startsWith(cilj + sep) ||
    zasticeni.some((ime) => cilj === resolve(ime) || cilj.startsWith(resolve(ime) + sep))
  ) {
    prekini(`--izlaz "${izlaz}" bi obrisao deo projekta. Izaberi npr. "dist".`);
  }
}

function normalizujAdresu(tekst) {
  if (!tekst) return "";
  let url;
  try {
    url = new URL(tekst);
  } catch {
    prekini(`--adresa "${tekst}" nije ispravna adresa.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    prekini(`--adresa mora da počinje sa https://, a ne "${tekst}".`);
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  url.search = "";
  url.hash = "";
  return url.href;
}

async function procitajJson(putanja, podrazumevano) {
  try {
    return JSON.parse(await readFile(putanja, "utf8"));
  } catch (greska) {
    if (greska.code !== "ENOENT") throw greska;
    console.log(`${putanja} ne postoji, koristim prazne podatke.`);
    return podrazumevano;
  }
}

function json(podaci) {
  return JSON.stringify(podaci);
}

function sazetak(s) {
  return {
    id: s.id,
    ime: s.ime,
    nazivi: s.nazivi,
    kanal: s.kanal,
    jezik: s.jezik,
    jeziciTitlova: s.jeziciTitlova,
    imaTitlove: s.imaTitlove,
    brojEpizoda: s.brojEpizoda,
    sezone: s.sezone,
    poslednja: s.poslednja,
    slika: s.slika,
    poster: s.poster,
    godina: s.godina,
    zanrovi: s.zanrovi,
    ocena: s.ocena,
    zavrsena: s.zavrsena,
    pregleda: s.pregleda,
    trend: s.trend,
  };
}

function epizodaZaSajt(e) {
  return {
    id: e.id,
    sezona: e.sezona,
    epizoda: e.epizoda,
    naslov: e.naslov,
    objavljeno: e.objavljeno,
    trajanje: e.trajanje,
    titlovi: e.titlovi,
    jeziciTitlova: e.jeziciTitlova ?? [],
    pregleda: e.pregleda ?? null,
    ograniceno: e.ograniceno,
    slika: e.slika,
  };
}

function mapaSajta(serije) {
  const url = (loc, izmena) =>
    `<url><loc>${esc(loc)}</loc>${izmena ? `<lastmod>${esc(izmena.slice(0, 10))}</lastmod>` : ""}</url>`;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    url(adresa, serije[0]?.poslednja.objavljeno) +
    url(`${adresa}istrazi/`, serije[0]?.poslednja.objavljeno) +
    serije
      .map((s) => url(`${adresa}serija/${encodeURIComponent(s.id)}/`, s.poslednja.objavljeno))
      .join("") +
    "</urlset>\n"
  );
}
