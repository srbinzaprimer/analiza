// Stremio dodatak kao statični JSON fajlovi.
// Stremio traži <adresa>/manifest.json, pa catalog/, meta/ i stream/ putanje
// relativno od nje, tako da dodatak radi sa običnog statičnog hostinga.

export const ID_DODATKA = "community.bolum";
const PREFIKS = "bolum";
const ID_KATALOGA = "bolum-sve";
const SAT = 60 * 60;

export const idSerije = (serija) => `${PREFIKS}-${serija.id}`;
export const idEpizode = (epizoda) => `${PREFIKS}-v-${epizoda.id}`;

/**
 * @param {ReturnType<import("./katalog.mjs").grupisiSerije>} serije
 * @param {{ adresa: string, verzija: string }} opcije adresa sajta sa "/" na kraju
 * @returns {Map<string, object>} putanja fajla → sadržaj
 */
export function stremioFajlovi(serije, { adresa, verzija }) {
  const fajlovi = new Map();

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
    catalogs: [{ type: "series", id: ID_KATALOGA, name: "Turkish dramas · official YouTube" }],
    behaviorHints: { configurable: false, configurationRequired: false },
  });

  fajlovi.set(`catalog/series/${ID_KATALOGA}.json`, {
    metas: serije.map((s) => ({
      id: idSerije(s),
      type: "series",
      name: s.ime,
      poster: s.slika,
      posterShape: "landscape",
      description: opis(s),
      genres: [s.kanal.ime],
    })),
    cacheMaxAge: 6 * SAT,
  });

  for (const s of serije) {
    fajlovi.set(`meta/series/${idSerije(s)}.json`, {
      meta: {
        id: idSerije(s),
        type: "series",
        name: s.ime,
        poster: s.slika,
        posterShape: "landscape",
        background: s.slika,
        description: opis(s),
        genres: [s.kanal.ime],
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

    for (const e of s.epizode) {
      fajlovi.set(`stream/series/${idEpizode(e)}.json`, {
        streams: [
          {
            ytId: e.id,
            name: "YouTube",
            description: `${e.naslov}\nOfficial channel: ${s.kanal.ime}`,
          },
        ],
        cacheMaxAge: 24 * SAT,
      });
    }
  }

  return fajlovi;
}

function opis(serija) {
  return `${serija.brojEpizoda} episodes · official channel: ${serija.kanal.ime}`;
}
