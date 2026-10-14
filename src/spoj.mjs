// Spaja epizode sa YouTube-a i TMDB podatke u serije spremne za sajt i Stremio.

import { grupisiSerije } from "./katalog.mjs";
import { PRAZNO_OBOGACIVANJE } from "./tmdb.mjs";

const TMDB_SLIKE = "https://image.tmdb.org/t/p/";
const DAN = 86_400_000;
// "U trendu": koliko pregleda dnevno skupljaju epizode iz poslednjih 10 dana.
const TREND_DANA = 10;

export const tmdbSlika = (putanja, velicina) =>
  putanja ? `${TMDB_SLIKE}${velicina}${putanja}` : null;

/**
 * @param {object} katalog data/katalog.json
 * @param {object} [tmdb] data/tmdb.json
 * @param {{ slika?: (putanja: string|null, velicina: string) => string|null }} [opcije]
 *   adresa TMDB slike; demo podaci koriste lokalne slike
 * @returns {{ serije: object[], zanrovi: object, provajderi: object }}
 */
export function pripremiSerije(katalog, tmdb = PRAZNO_OBOGACIVANJE, { slika = tmdbSlika } = {}) {
  const sada = Date.parse(katalog.osvezeno ?? "") || Date.now();
  const koriscenihZanrova = new Set();
  const koriscenihPlatformi = new Set();

  const serije = grupisiSerije(katalog).map((s) => {
    const t = tmdb.serije?.[s.id]?.tmdbId ? tmdb.serije[s.id] : null;
    const jeziciTitlova = [
      ...new Set([...(s.titlovi ?? []), ...s.epizode.flatMap((e) => e.jeziciTitlova ?? [])]),
    ].sort();

    let trend = 0;
    let pregleda = 0;
    for (const e of s.epizode) {
      pregleda += e.pregleda ?? 0;
      const dana = (sada - Date.parse(e.objavljeno ?? "")) / DAN;
      if (dana >= 0 && dana <= TREND_DANA && e.pregleda) {
        trend = Math.max(trend, Math.round(e.pregleda / Math.max(1, dana)));
      }
    }

    t?.zanrovi?.forEach((z) => koriscenihZanrova.add(z));
    for (const ponuda of Object.values(t?.gledanje ?? {})) {
      Object.values(ponuda).flat().forEach((p) => koriscenihPlatformi.add(p));
    }

    return {
      ...s,
      ime: t?.originalniNaziv || s.ime,
      nazivi: t?.nazivi ?? null,
      opisi: t?.opisi ?? null,
      godina: t?.godina ?? null,
      zavrsena: t?.zavrsena ?? null,
      zanrovi: t?.zanrovi ?? [],
      ocena: t?.ocena ?? null,
      imdb: t?.imdb ?? null,
      tmdbId: t?.tmdbId ?? null,
      poster: slika(t?.poster, "w342"),
      posterVeliki: slika(t?.poster, "w780"),
      // TMDB pozadine su bez natpisa, lepše od YouTube sličica.
      slika: slika(t?.pozadina, "w780") ?? s.slika,
      pozadina: slika(t?.pozadina, "w1280") ?? s.slika,
      glumci: (t?.glumci ?? []).map((g) => ({ ...g, slika: slika(g.slika, "w185") })),
      gledanje: t?.gledanje ?? {},
      jeziciTitlova,
      pregleda,
      trend,
    };
  });

  const zanrovi = {};
  for (const [jezik, imena] of Object.entries(tmdb.zanrovi ?? {})) {
    zanrovi[jezik] = Object.fromEntries(
      Object.entries(imena).filter(([id]) => koriscenihZanrova.has(Number(id))),
    );
  }
  const provajderi = Object.fromEntries(
    Object.entries(tmdb.provajderi ?? {})
      .filter(([id]) => koriscenihPlatformi.has(Number(id)))
      .map(([id, p]) => [id, { ime: p.ime, logo: slika(p.logo, "w92") }]),
  );

  return { serije, zanrovi, provajderi };
}

/** Serije po trendu; ako nedostaje svežih podataka, dopunjava ukupnim pregledima. */
export function popularne(serije) {
  return [...serije].sort((a, b) => b.trend - a.trend || b.pregleda - a.pregleda);
}
