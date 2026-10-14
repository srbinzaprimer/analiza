// Stremio dodatak kao statični JSON fajlovi.
// Stremio traži <adresa>/manifest.json, pa catalog/, meta/ i stream/ putanje
// relativno od nje, tako da dodatak radi sa običnog statičnog hostinga.

import { popularne } from "./spoj.mjs";

export const ID_DODATKA = "community.bolum";
const PREFIKS = "bolum";
const SAT = 60 * 60;
// Žanr dobija svoj katalog tek kad ima dovoljno serija.
const MINIMALNO_U_ZANRU = 3;

export const idSerije = (serija) => `${PREFIKS}-${serija.id}`;
export const idEpizode = (epizoda) => `${PREFIKS}-v-${epizoda.id}`;

/**
 * @param {ReturnType<import("./spoj.mjs").pripremiSerije>["serije"]} serije
 * @param {{ adresa: string, verzija: string, zanrovi?: Record<string, Record<string, string>> }} opcije
 * @returns {Map<string, object>} putanja fajla → sadržaj
 */
export function stremioFajlovi(serije, { adresa, verzija, zanrovi = {} }) {
  const fajlovi = new Map();
  const imeZanra = (id) => zanrovi.en?.[id] ?? null;

  const katalozi = [
    { id: "bolum-novo", name: "Bölüm · New episodes", serije },
    { id: "bolum-popularno", name: "Bölüm · Trending", serije: popularne(serije) },
  ];
  const poZanru = new Map();
  for (const s of serije) {
    for (const z of s.zanrovi ?? []) {
      if (!imeZanra(z)) continue;
      if (!poZanru.has(z)) poZanru.set(z, []);
      poZanru.get(z).push(s);
    }
  }
  for (const [z, lista] of poZanru) {
    if (lista.length >= MINIMALNO_U_ZANRU) {
      katalozi.push({ id: `bolum-zanr-${z}`, name: `Bölüm · ${imeZanra(z)}`, serije: lista });
    }
  }

  fajlovi.set("manifest.json", {
    id: ID_DODATKA,
    version: verzija,
    name: "Bölüm",
    description:
      "Full episodes of Turkish dramas, published for free on the broadcasters' official YouTube channels.",
    logo: `${adresa}ikonica-256.png`,
    background: `${adresa}deljenje.png`,
    resources: ["catalog", "meta", "stream"],
    types: ["series"],
    idPrefixes: [PREFIKS],
    catalogs: katalozi.map((k) => ({ type: "series", id: k.id, name: k.name })),
    behaviorHints: { configurable: false, configurationRequired: false },
  });

  for (const k of katalozi) {
    fajlovi.set(`catalog/series/${k.id}.json`, {
      metas: k.serije.map((s) => ({
        id: idSerije(s),
        type: "series",
        name: s.ime,
        ...slike(s),
        description: opis(s),
        genres: zanroviSerije(s, imeZanra),
        releaseInfo: s.godina ? String(s.godina) : undefined,
      })),
      cacheMaxAge: 6 * SAT,
    });
  }

  for (const s of serije) {
    fajlovi.set(`meta/series/${idSerije(s)}.json`, {
      meta: {
        id: idSerije(s),
        type: "series",
        name: s.ime,
        ...slike(s),
        background: s.pozadina ?? s.slika,
        description: opis(s),
        genres: zanroviSerije(s, imeZanra),
        releaseInfo: s.godina ? String(s.godina) : undefined,
        cast: s.glumci?.length ? s.glumci.slice(0, 6).map((g) => g.ime) : undefined,
        website: `${adresa}serija/${encodeURIComponent(s.id)}/`,
        videos: s.epizode.map((e) => ({
          id: idEpizode(e),
          title: e.naslov,
          season: e.sezona,
          episode: e.epizoda,
          released: e.objavljeno,
          thumbnail: e.slika,
        })),
      },
      cacheMaxAge: 6 * SAT,
    });

    // Gde se serija još legalno gleda (Netflix, tabii…): TMDB stranica sa
    // platformama po zemlji; podaci o platformama su od JustWatch-a.
    const platforme =
      s.tmdbId && Object.keys(s.gledanje ?? {}).length > 0
        ? {
            name: "Official platforms",
            description: "Netflix, tabii and other legal platforms in your country (data: JustWatch)",
            externalUrl: `https://www.themoviedb.org/tv/${s.tmdbId}/watch`,
          }
        : null;

    for (const e of s.epizode) {
      const titlovi = e.jeziciTitlova?.length
        ? `\nSubtitles: ${e.jeziciTitlova.join(", ").toUpperCase()}`
        : "";
      fajlovi.set(`stream/series/${idEpizode(e)}.json`, {
        streams: [
          {
            ytId: e.id,
            name: "YouTube",
            description: `${e.naslov}\nOfficial channel: ${s.kanal.ime}${titlovi}`,
          },
          ...(platforme ? [platforme] : []),
        ],
        cacheMaxAge: 24 * SAT,
      });
    }
  }

  return fajlovi;
}

function slike(s) {
  return s.poster
    ? { poster: s.poster, posterShape: "poster" }
    : { poster: s.slika, posterShape: "landscape" };
}

function zanroviSerije(s, imeZanra) {
  const imena = (s.zanrovi ?? []).map(imeZanra).filter(Boolean);
  return imena.length ? imena : [s.kanal.ime];
}

function opis(s) {
  const osnovno = `${s.brojEpizoda} episodes · official channel: ${s.kanal.ime}`;
  return s.opisi?.en ? `${s.opisi.en}\n\n${osnovno}` : osnovno;
}
