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
 * @returns {{ serije: object[], zanrovi: object, provajderi: object, aliasi: Record<string, string> }}
 */
export function pripremiSerije(katalog, tmdb = PRAZNO_OBOGACIVANJE, { slika = tmdbSlika } = {}) {
  const sada = Date.parse(katalog.osvezeno ?? "") || Date.now();
  const koriscenihZanrova = new Set();
  const koriscenihPlatformi = new Set();

  const pojedinacne = grupisiSerije(katalog).map((s) => {
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
      sajt: t?.sajt ?? null,
      mreze: (t?.mreze ?? []).map((m) => ({ ime: m.ime, logo: slika(m.logo, "w154") })),
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

  const { serije, aliasi } = spojiVerzije(pojedinacne);
  return { serije, zanrovi, provajderi, aliasi };
}

const prvaObjava = (s) => s.epizode.map((e) => String(e.objavljeno ?? "")).sort()[0] ?? "";
const verzija = (s) => ({
  id: s.id,
  kanal: s.kanal,
  jeziciTitlova: s.jeziciTitlova,
  epizode: s.epizode,
});

/**
 * Ista serija često postoji na više zvaničnih kanala: original na turskom i
 * međunarodni kanali sa engleskim, arapskim ili španskim titlovima (često pod
 * prevedenim imenom). Serije sa istim TMDB ID-jem postaju jedna serija sa
 * više verzija. Glavna je verzija sa najviše epizoda (obično originalna).
 * Epizode verzija se ne spajaju po broju, jer međunarodni kanali često seku
 * epizode drugačije.
 *
 * @returns {{ serije: object[], aliasi: Record<string, string> }} aliasi: stari ID → ID spojene serije
 */
export function spojiVerzije(serije) {
  const poTmdb = new Map();
  for (const s of serije) {
    if (!s.tmdbId) continue;
    if (!poTmdb.has(s.tmdbId)) poTmdb.set(s.tmdbId, []);
    poTmdb.get(s.tmdbId).push(s);
  }

  const aliasi = {};
  const spojene = new Map();
  for (const grupa of poTmdb.values()) {
    if (grupa.length < 2) continue;
    const [glavna, ...ostale] = [...grupa].sort(
      (a, b) => b.brojEpizoda - a.brojEpizoda || prvaObjava(a).localeCompare(prvaObjava(b)),
    );
    for (const o of ostale) aliasi[o.id] = glavna.id;
    spojene.set(glavna.id, {
      ...glavna,
      verzije: [glavna, ...ostale].map(verzija),
      jeziciTitlova: [...new Set(grupa.flatMap((v) => v.jeziciTitlova))].sort(),
      imaTitlove: grupa.some((v) => v.imaTitlove),
      pregleda: grupa.reduce((zbir, v) => zbir + v.pregleda, 0),
      trend: Math.max(...grupa.map((v) => v.trend)),
    });
  }

  return {
    serije: serije
      .filter((s) => !(s.id in aliasi))
      .map((s) => spojene.get(s.id) ?? { ...s, verzije: [verzija(s)] }),
    aliasi,
  };
}

/** Serije po trendu; ako nedostaje svežih podataka, dopunjava ukupnim pregledima. */
export function popularne(serije) {
  return [...serije].sort((a, b) => b.trend - a.trend || b.pregleda - a.pregleda);
}
