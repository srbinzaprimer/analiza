#!/usr/bin/env node
// Lokalni pregled napravljenog sajta (dist/), ponaša se kao GitHub Pages.
// Upotreba: node scripts/server.mjs [folder]   (PORT=8080 podrazumevano)

import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const KOREN = resolve(process.argv[2] ?? "dist");
const PORT = Number(process.env.PORT ?? 8080);

const TIPOVI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

createServer((zahtev, odgovor) => {
  posluzi(zahtev, odgovor).catch(() => {
    if (!odgovor.headersSent) odgovor.writeHead(500);
    odgovor.end();
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Sajt:    http://localhost:${PORT}/`);
  console.log(`Stremio: http://localhost:${PORT}/stremio/manifest.json`);
});

async function posluzi(zahtev, odgovor) {
  // Stremio i drugi sajtovi čitaju podatke sa druge adrese, kao i na GitHub Pages.
  odgovor.setHeader("access-control-allow-origin", "*");

  const kodirana = new URL(zahtev.url, "http://localhost").pathname;
  let putanja;
  try {
    putanja = decodeURIComponent(kodirana);
  } catch {
    odgovor.writeHead(400).end("Neispravna adresa");
    return;
  }
  let fajl = resolve(KOREN, "." + putanja);
  if (fajl !== KOREN && !fajl.startsWith(KOREN + sep)) {
    odgovor.writeHead(403).end("Zabranjeno");
    return;
  }

  try {
    if ((await stat(fajl)).isDirectory()) {
      if (!putanja.endsWith("/")) {
        odgovor.writeHead(301, { location: `${kodirana}/` }).end();
        return;
      }
      fajl = join(fajl, "index.html");
    }
    const telo = await readFile(fajl);
    odgovor.writeHead(200, { "content-type": TIPOVI[extname(fajl)] ?? "application/octet-stream" });
    odgovor.end(telo);
  } catch {
    const telo = await readFile(join(KOREN, "404.html")).catch(() => "404");
    odgovor.writeHead(404, { "content-type": TIPOVI[".html"] }).end(telo);
  }
}
