#!/usr/bin/env node
// Komanda: node analiza.mjs <adresa> [još adresa...] [opcije]

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { GreskaAnalize, analizirajSajt } from "./src/analizator.mjs";
import { htmlIzvestaj } from "./src/izvestaj-html.mjs";
import { tekstualniIzvestaj } from "./src/izvestaj-tekst.mjs";

const POMOC = `Analiza sajta: tehnologije, skripte, spoljni servisi, veličina, SEO i bezbednost.

Upotreba:
  node analiza.mjs <adresa> [još adresa...] [opcije]

Primeri:
  node analiza.mjs primer.rs
  node analiza.mjs https://primer.rs drugi-sajt.com --bez-merenja

Opcije:
  --json           Ispiši rezultat kao JSON umesto teksta
  --bez-html       Ne pravi HTML izveštaj
  --bez-merenja    Ne preuzimaj skripte, stilove i slike radi merenja veličine (brže)
  --izlaz <folder> Gde se čuvaju HTML izveštaji (podrazumevano: izvestaji)
  -h, --pomoc      Prikaži ovu pomoć`;

async function main(argumenti) {
  let opcije;
  try {
    opcije = parseArgs({
      args: argumenti,
      allowPositionals: true,
      options: {
        json: { type: "boolean", default: false },
        "bez-html": { type: "boolean", default: false },
        "bez-merenja": { type: "boolean", default: false },
        izlaz: { type: "string", default: "izvestaji" },
        pomoc: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (greska) {
    console.error(`${greska.message}\n\n${POMOC}`);
    return 2;
  }

  const { values: o, positionals: adrese } = opcije;
  if (o.pomoc) {
    console.log(POMOC);
    return 0;
  }
  if (adrese.length === 0) {
    console.error(POMOC);
    return 2;
  }

  const rezultati = [];
  let biloGresaka = false;

  for (const adresa of adrese) {
    process.stderr.write(`Analiziram ${adresa}…\n`);
    let rezultat;
    try {
      rezultat = await analizirajSajt(adresa, { meriVelicinu: !o["bez-merenja"] });
    } catch (greska) {
      if (!(greska instanceof GreskaAnalize)) throw greska;
      console.error(`Greška: ${greska.message}`);
      biloGresaka = true;
      continue;
    }

    const putanja = o["bez-html"] ? null : await sacuvajHtml(rezultat, o.izlaz);
    if (o.json) {
      rezultati.push(rezultat);
      if (putanja) process.stderr.write(`Izveštaj sačuvan: ${putanja}\n`);
    } else {
      console.log(tekstualniIzvestaj(rezultat));
      if (putanja) console.log(`\nIzveštaj sačuvan: ${putanja}`);
      console.log();
    }
  }

  if (o.json && rezultati.length > 0) {
    const izlaz = adrese.length === 1 ? rezultati[0] : rezultati;
    console.log(JSON.stringify(izlaz, null, 2));
  }
  return biloGresaka ? 1 : 0;
}

async function sacuvajHtml(rezultat, folder) {
  const host = new URL(rezultat.konacnaAdresa).hostname.replace(/[^a-z0-9.-]/gi, "_");
  await mkdir(folder, { recursive: true });
  const putanja = join(folder, `${host}.html`);
  await writeFile(putanja, htmlIzvestaj(rezultat), "utf8");
  return putanja;
}

process.exitCode = await main(process.argv.slice(2));
