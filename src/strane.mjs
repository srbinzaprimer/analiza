// Statične HTML stranice: početna, po jedna za svaku seriju, lista i 404.
// Svaka nosi svoje meta oznake (za pretraživače i deljenje) i osnovni
// sadržaj koji radi i bez JavaScript-a. Aplikacija ga zatim zameni.

export function esc(vrednost) {
  return String(vrednost ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** JSON za <script type="application/ld+json">, bez mogućnosti izlaska iz oznake. */
function jsonZaSkriptu(podaci) {
  return JSON.stringify(podaci)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

const OPIS_SAJTA =
  "Full episodes of Turkish dramas that broadcasters publish for free on their official YouTube channels, organized by series. Track what you watched and continue where you left off.";

export const youtubeAdresa = (id) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

/**
 * @param {{
 *   sablon: string,
 *   serije: ReturnType<import("./katalog.mjs").grupisiSerije>,
 *   adresa: string,   apsolutna adresa sajta sa "/" na kraju, ili "" lokalno
 *   baza: string,     putanja sajta, npr. "/bolum/"
 *   izvor?: string,   adresa izvornog koda (repozitorijuma)
 * }} opcije
 * @returns {Map<string, string>} putanja → HTML
 */
export function napraviStrane({ sablon, serije, adresa, baza, izvor = "" }) {
  const strana = (putanja, podaci) =>
    popuni(sablon, {
      baza,
      izvor,
      url: adresa + putanja,
      slika: podaci.slika ?? `${adresa}deljenje.png`,
      ...podaci,
    });

  const strane = new Map();

  strane.set(
    "index.html",
    strana("", {
      naslov: "Bölüm — Turkish dramas, full episodes, official and free",
      opis: OPIS_SAJTA,
      jsonld: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Bölüm",
        url: adresa || undefined,
        description: OPIS_SAJTA,
      },
      sadrzaj: pocetnaBezSkripte(serije),
    }),
  );

  for (const s of serije) {
    const putanja = `serija/${encodeURIComponent(s.id)}/`;
    const poslednja = s.epizode.find((e) => e.id === s.poslednja.id);
    strane.set(
      `serija/${s.id}/index.html`,
      strana(putanja, {
        naslov: `${s.ime} — all ${s.brojEpizoda} episodes free | Bölüm`,
        opis:
          `${s.ime}: ${s.brojEpizoda} full episodes from the official ${s.kanal.ime} YouTube channel` +
          (poslednja ? `. Latest: episode ${poslednja.epizoda}.` : "."),
        slika: s.slika,
        jsonld: serijaJsonLd(s, adresa + putanja),
        sadrzaj: serijaBezSkripte(s),
      }),
    );
  }

  strane.set(
    "lista/index.html",
    strana("lista/", {
      naslov: "My list | Bölüm",
      opis: OPIS_SAJTA,
      robots: "noindex",
      sadrzaj: "<h1>My list</h1>",
    }),
  );
  strane.set(
    "404.html",
    strana("404.html", {
      naslov: "Not found | Bölüm",
      opis: OPIS_SAJTA,
      robots: "noindex",
      sadrzaj: '<h1>Page not found</h1><p><a href="./">Bölüm</a></p>',
    }),
  );

  return strane;
}

function popuni(sablon, p) {
  const zamene = {
    BAZA: esc(p.baza),
    IZVOR: esc(p.izvor),
    NASLOV: esc(p.naslov),
    OPIS: esc(p.opis),
    URL: esc(p.url),
    SLIKA: esc(p.slika),
    ROBOTS: p.robots ? `<meta name="robots" content="${esc(p.robots)}">` : "",
    JSONLD: p.jsonld
      ? `<script type="application/ld+json">${jsonZaSkriptu(p.jsonld)}</script>`
      : "",
    SADRZAJ: p.sadrzaj,
  };
  return sablon.replace(/\{\{([A-Z]+)\}\}/g, (oznaka, ime) => {
    if (!(ime in zamene)) throw new Error(`Nepoznata oznaka u šablonu: ${oznaka}`);
    return zamene[ime];
  });
}

function pocetnaBezSkripte(serije) {
  const stavke = serije
    .map(
      (s) =>
        `<li><a href="serija/${esc(encodeURIComponent(s.id))}/">${esc(s.ime)}</a> · ${esc(s.kanal.ime)} · ${s.brojEpizoda} episodes</li>`,
    )
    .join("");
  return `<h1>Bölüm</h1><p>${esc(OPIS_SAJTA)}</p>${stavke ? `<ul>${stavke}</ul>` : ""}`;
}

function serijaBezSkripte(s) {
  const epizode = s.epizode
    .map(
      (e) =>
        `<li><a href="${esc(youtubeAdresa(e.id))}" rel="noopener">${esc(e.naslov)}</a></li>`,
    )
    .join("");
  return `<h1>${esc(s.ime)}</h1><p>${esc(s.kanal.ime)} · ${s.brojEpizoda} episodes</p><ol>${epizode}</ol>`;
}

function serijaJsonLd(s, url) {
  return {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: s.ime,
    url: url || undefined,
    image: s.slika ?? undefined,
    numberOfEpisodes: s.brojEpizoda,
    inLanguage: s.jezik,
    episode: s.epizode.map((e) => ({
      "@type": "TVEpisode",
      name: e.naslov,
      episodeNumber: e.epizoda,
      partOfSeason: { "@type": "TVSeason", seasonNumber: e.sezona },
      datePublished: e.objavljeno ?? undefined,
      url: youtubeAdresa(e.id),
    })),
  };
}
