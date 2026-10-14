#!/usr/bin/env node
// Pravi sajt, podatke i Stremio dodatak u folderu dist/.
// Upotreba: node scripts/napravi.mjs [--katalog data/katalog.json] [--adresa https://.../]

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

import { PRAZAN_KATALOG, grupisiSerije } from "../src/katalog.mjs";
import { esc, napraviStrane } from "../src/strane.mjs";
import { stremioFajlovi } from "../src/stremio.mjs";

const { values: o } = parseArgs({
  options: {
    katalog: { type: "string", default: "data/katalog.json" },
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
const katalog = await procitajKatalog(o.katalog);
const serije = grupisiSerije(katalog);
const { version: verzija } = JSON.parse(await readFile("package.json", "utf8"));

const fajlovi = new Map();
const sablon = await readFile("sajt/sablon.html", "utf8");
for (const [putanja, html] of napraviStrane({ sablon, serije, adresa, baza, izvor: o.izvor })) {
  fajlovi.set(putanja, html);
}

fajlovi.set(
  "podaci/serije.json",
  json({ osvezeno: katalog.osvezeno, serije: serije.map(sazetak) }),
);
for (const s of serije) {
  fajlovi.set(
    `podaci/serija/${s.id}.json`,
    json({ ...sazetak(s), epizode: s.epizode.map(epizodaZaSajt) }),
  );
}

for (const [putanja, sadrzaj] of stremioFajlovi(serije, { adresa, verzija })) {
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

async function procitajKatalog(putanja) {
  try {
    return JSON.parse(await readFile(putanja, "utf8"));
  } catch (greska) {
    if (greska.code !== "ENOENT") throw greska;
    console.log(`${putanja} ne postoji, pravim sajt sa praznim katalogom.`);
    return PRAZAN_KATALOG;
  }
}

function json(podaci) {
  return JSON.stringify(podaci);
}

function sazetak(s) {
  return {
    id: s.id,
    ime: s.ime,
    kanal: s.kanal,
    jezik: s.jezik,
    titlovi: s.titlovi,
    imaTitlove: s.imaTitlove,
    brojEpizoda: s.brojEpizoda,
    sezone: s.sezone,
    poslednja: s.poslednja,
    slika: s.slika,
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
    serije
      .map((s) => url(`${adresa}serija/${encodeURIComponent(s.id)}/`, s.poslednja.objavljeno))
      .join("") +
    "</urlset>\n"
  );
}
