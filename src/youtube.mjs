// Mali klijent za YouTube Data API v3.
// Svaki poziv koji koristimo (channels, playlistItems, videos) košta 1 jedinicu
// od dnevne kvote od 10.000, pa ih brojimo.

const API = "https://www.googleapis.com/youtube/v3";

const KOBNI_RAZLOZI = new Set([
  "quotaExceeded",
  "dailyLimitExceeded",
  "keyInvalid",
  "keyExpired",
  "accessNotConfigured",
]);

export class GreskaYouTube extends Error {
  constructor(poruka, { status = 0, razlog = null } = {}) {
    super(poruka);
    this.status = status;
    this.razlog = razlog;
  }

  /** Problem sa ključem ili kvotom: posle ovoga nema smisla nastavljati. */
  get kobna() {
    return (
      KOBNI_RAZLOZI.has(this.razlog) ||
      /api key/i.test(this.message) ||
      (this.status === 403 && /has not been used|is disabled/i.test(this.message))
    );
  }
}

export function napraviKlijent({ kljuc, fetchFn = fetch, pokusaja = 3, cekaj = pauza }) {
  if (!kljuc) throw new GreskaYouTube("Nedostaje YouTube API ključ.");
  let potroseno = 0;

  async function zahtev(putanja, parametri) {
    const url = new URL(`${API}/${putanja}`);
    for (const [ime, vrednost] of Object.entries(parametri)) {
      if (vrednost !== undefined && vrednost !== null) url.searchParams.set(ime, vrednost);
    }
    url.searchParams.set("key", kljuc);

    for (let pokusaj = 1; ; pokusaj++) {
      potroseno++;
      let odgovor;
      try {
        odgovor = await fetchFn(url, { signal: AbortSignal.timeout(30_000) });
      } catch (greska) {
        if (pokusaj < pokusaja) {
          await cekaj(pokusaj);
          continue;
        }
        throw new GreskaYouTube(`Mreža: ${greska.message}`);
      }
      const telo = await odgovor.json().catch(() => null);
      if (odgovor.ok) return telo;
      if (odgovor.status >= 500 && pokusaj < pokusaja) {
        await cekaj(pokusaj);
        continue;
      }
      throw new GreskaYouTube(telo?.error?.message ?? `HTTP ${odgovor.status}`, {
        status: odgovor.status,
        razlog: telo?.error?.errors?.[0]?.reason ?? null,
      });
    }
  }

  return {
    get potroseno() {
      return potroseno;
    },

    /** Kanal po @imenu, ili null ako ne postoji. */
    async kanal(handle) {
      const telo = await zahtev("channels", {
        part: "snippet,contentDetails,statistics",
        forHandle: handle,
      });
      return telo?.items?.[0] ?? null;
    },

    /**
     * Stavke plejliste, stranicu po stranicu (najviše 50 po stranici).
     * Prekida se kad `nastavi(stranica)` vrati false.
     */
    async stavkePlejliste(playlistId, nastavi = () => true) {
      const stavke = [];
      let pageToken;
      do {
        const telo = await zahtev("playlistItems", {
          part: "snippet,contentDetails,status",
          playlistId,
          maxResults: 50,
          pageToken,
        });
        const stranica = telo?.items ?? [];
        stavke.push(...stranica);
        if (!nastavi(stranica)) break;
        pageToken = telo?.nextPageToken;
      } while (pageToken);
      return stavke;
    },

    /** Detalji videa (trajanje, ugrađivanje, ograničenja po zemljama). */
    async videi(ids) {
      const rezultat = [];
      for (let i = 0; i < ids.length; i += 50) {
        const telo = await zahtev("videos", {
          part: "contentDetails,status",
          id: ids.slice(i, i + 50).join(","),
          maxResults: 50,
        });
        rezultat.push(...(telo?.items ?? []));
      }
      return rezultat;
    },
  };
}

function pauza(pokusaj) {
  return new Promise((gotovo) => setTimeout(gotovo, 500 * 2 ** pokusaj));
}
