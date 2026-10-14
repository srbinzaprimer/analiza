// Obogaćivanje serija podacima sa TMDB-a (themoviedb.org): poster, pozadina,
// opisi na jezicima sajta, žanrovi, ocena, glumci i gde se serija još legalno
// gleda (podaci o platformama dolaze od JustWatch-a preko TMDB-a).

import { kljucSerije } from "./epizode.mjs";

const API = "https://api.themoviedb.org/3";
export const JEZICI_SAJTA = ["en", "sr", "tr", "es"];
const TMDB_JEZIK = { en: "en-US", sr: "sr-RS", tr: "tr-TR", es: "es-ES" };
const OSVEZAVANJE_MS = 7 * 24 * 60 * 60 * 1000;
const NAJVISE_GLUMACA = 12;

export const PRAZNO_OBOGACIVANJE = Object.freeze({
  verzija: 1,
  osvezeno: null,
  serije: {},
  provajderi: {},
  zanrovi: {},
  zanroviOsvezeno: null,
});

export class GreskaTmdb extends Error {
  constructor(poruka, { status = 0 } = {}) {
    super(poruka);
    this.status = status;
  }

  /** Neispravan ključ: nema smisla nastavljati. */
  get kobna() {
    return this.status === 401;
  }
}

export function napraviTmdbKlijent({ kljuc, fetchFn = fetch, pokusaja = 4, cekaj = pauza }) {
  if (!kljuc) throw new GreskaTmdb("Nedostaje TMDB ključ.");
  // TMDB izdaje dve vrste ključa: kratak "API Key" i dugačak "Read Access Token".
  const token = kljuc.startsWith("eyJ");

  async function zahtev(putanja, parametri = {}) {
    const url = new URL(API + putanja);
    for (const [ime, vrednost] of Object.entries(parametri)) url.searchParams.set(ime, vrednost);
    if (!token) url.searchParams.set("api_key", kljuc);
    const zaglavlja = { accept: "application/json" };
    if (token) zaglavlja.authorization = `Bearer ${kljuc}`;

    for (let pokusaj = 1; ; pokusaj++) {
      let odgovor;
      try {
        odgovor = await fetchFn(url, { headers: zaglavlja, signal: AbortSignal.timeout(20_000) });
      } catch (greska) {
        if (pokusaj < pokusaja) {
          await cekaj(pokusaj);
          continue;
        }
        throw new GreskaTmdb(`Mreža: ${greska.message}`);
      }
      if (odgovor.status === 404) return null;
      if ((odgovor.status === 429 || odgovor.status >= 500) && pokusaj < pokusaja) {
        await cekaj(pokusaj, Number(odgovor.headers.get("retry-after")));
        continue;
      }
      const telo = await odgovor.json().catch(() => null);
      if (!odgovor.ok) {
        throw new GreskaTmdb(telo?.status_message ?? `HTTP ${odgovor.status}`, {
          status: odgovor.status,
        });
      }
      return telo;
    }
  }

  return {
    async trazi(naziv) {
      const telo = await zahtev("/search/tv", {
        query: naziv,
        language: "en-US",
        include_adult: "false",
      });
      return telo?.results ?? [];
    },
    detalji(id) {
      return zahtev(`/tv/${encodeURIComponent(id)}`, {
        language: "en-US",
        append_to_response: "translations,aggregate_credits,external_ids,watch/providers",
      });
    },
    async zanrovi(jezik) {
      const telo = await zahtev("/genre/tv/list", { language: TMDB_JEZIK[jezik] });
      return telo?.genres ?? [];
    },
  };
}

function pauza(pokusaj, sekundi) {
  const ms = Number.isFinite(sekundi) && sekundi > 0 ? sekundi * 1000 : 500 * 2 ** pokusaj;
  return new Promise((gotovo) => setTimeout(gotovo, Math.min(ms, 30_000)));
}

// ── Uparivanje ──────────────────────────────────────────────────────

function zaPoredjenje(tekst) {
  return kljucSerije(String(tekst ?? ""))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Bira TMDB seriju koja odgovara našoj. Prihvata samo tačno poklapanje imena
 * turske serije (pogrešni podaci su gori od nikakvih). Kad postoji više serija
 * istog imena (rimejk), bira onu koja je počela najbliže prvoj epizodi.
 */
export function izaberiPogodak(ime, rezultati, prvaEpizoda = null) {
  const cilj = zaPoredjenje(ime);
  if (!cilj) return null;
  const tacni = rezultati.filter(
    (r) =>
      (r.original_language === "tr" || r.origin_country?.includes("TR")) &&
      (zaPoredjenje(r.original_name) === cilj || zaPoredjenje(r.name) === cilj),
  );
  if (tacni.length <= 1) return tacni[0] ?? null;

  const pocetak = Date.parse(prvaEpizoda ?? "");
  if (Number.isFinite(pocetak)) {
    const razlika = (r) => {
      const d = Date.parse(r.first_air_date ?? "");
      return Number.isFinite(d) ? Math.abs(d - pocetak) : Infinity;
    };
    return [...tacni].sort((a, b) => razlika(a) - razlika(b))[0];
  }
  return [...tacni].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];
}

// ── Pretvaranje TMDB odgovora ───────────────────────────────────────

const CIRILICA = {
  А: "A", Б: "B", В: "V", Г: "G", Д: "D", Ђ: "Đ", Е: "E", Ж: "Ž", З: "Z", И: "I",
  Ј: "J", К: "K", Л: "L", Љ: "Lj", М: "M", Н: "N", Њ: "Nj", О: "O", П: "P", Р: "R",
  С: "S", Т: "T", Ћ: "Ć", У: "U", Ф: "F", Х: "H", Ц: "C", Ч: "Č", Џ: "Dž", Ш: "Š",
  а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "đ", е: "e", ж: "ž", з: "z", и: "i",
  ј: "j", к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r",
  с: "s", т: "t", ћ: "ć", у: "u", ф: "f", х: "h", ц: "c", ч: "č", џ: "dž", ш: "š",
};

/** Sajt je na latinici, a srpski prevodi na TMDB-u su često na ćirilici. */
export function uLatinicu(tekst) {
  return String(tekst ?? "").replace(/[\u0400-\u04ff]/g, (z) => CIRILICA[z] ?? z);
}

/** Prevod za jezik sajta; za srpski prihvata i hrvatski/bosanski ako srpskog nema. */
function prevod(prevodi, jezik, polje) {
  const zamene = { sr: ["sr", "hr", "bs"], es: ["es"], tr: ["tr"], en: ["en"] }[jezik];
  for (const kod of zamene) {
    const kandidati = prevodi.filter((p) => p.iso_639_1 === kod && p.data?.[polje]?.trim());
    // Za španski prvo Španija, pa Latinska Amerika.
    kandidati.sort((a, b) => Number(b.iso_3166_1 === "ES") - Number(a.iso_3166_1 === "ES"));
    const vrednost = kandidati[0]?.data[polje]?.trim();
    if (vrednost) return jezik === "sr" ? uLatinicu(vrednost) : vrednost;
  }
  return null;
}

const VRSTE_PONUDE = { flatrate: "pretplata", free: "besplatno", ads: "uzReklame", rent: "najam", buy: "kupovina" };
const NAJVISE_MREZA = 3;

/** Zvanični sajt serije sa TMDB-a; podatke tamo menjaju korisnici, pa samo http(s). */
export function bezbednaAdresa(tekst) {
  try {
    const url = new URL(String(tekst ?? "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Pretvara TMDB detalje u naš zapis; provajdere upisuje u zajednički rečnik. */
export function napraviZapis(d, provajderi, sada) {
  const prevodi = d.translations?.translations ?? [];
  const nazivi = {};
  const opisi = {};
  for (const jezik of JEZICI_SAJTA) {
    nazivi[jezik] = prevod(prevodi, jezik, "name") ?? (jezik === "en" ? d.name : null);
    opisi[jezik] = prevod(prevodi, jezik, "overview") ?? (jezik === "en" ? d.overview || null : null);
  }

  const gledanje = {};
  for (const [zemlja, ponuda] of Object.entries(d["watch/providers"]?.results ?? {})) {
    const zapis = {};
    for (const [vrsta, nase] of Object.entries(VRSTE_PONUDE)) {
      const lista = (ponuda[vrsta] ?? [])
        .slice()
        .sort((a, b) => (a.display_priority ?? 0) - (b.display_priority ?? 0));
      if (lista.length === 0) continue;
      zapis[nase] = lista.map((p) => {
        provajderi[p.provider_id] = { ime: p.provider_name, logo: p.logo_path ?? null };
        return p.provider_id;
      });
    }
    if (Object.keys(zapis).length > 0) gledanje[zemlja] = zapis;
  }

  const glumci = (d.aggregate_credits?.cast ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, NAJVISE_GLUMACA)
    .map((c) => ({
      ime: c.name,
      uloga: c.roles?.[0]?.character || null,
      slika: c.profile_path ?? null,
    }));

  return {
    tmdbId: d.id,
    osvezeno: sada.toISOString(),
    imdb: d.external_ids?.imdb_id || null,
    originalniNaziv: d.original_name ?? null,
    nazivi,
    opisi,
    godina: d.first_air_date ? Number(d.first_air_date.slice(0, 4)) : null,
    zavrsena: d.status === "Ended" || d.status === "Canceled",
    zanrovi: (d.genres ?? []).map((z) => z.id),
    ocena: d.vote_count >= 20 ? Math.round(d.vote_average * 10) / 10 : null,
    glasova: d.vote_count ?? 0,
    poster: d.poster_path ?? null,
    pozadina: d.backdrop_path ?? null,
    glumci,
    gledanje,
    // Sajt televizije: tamo se epizode često gledaju besplatno, i van YouTube-a.
    sajt: bezbednaAdresa(d.homepage),
    mreze: (d.networks ?? []).slice(0, NAJVISE_MREZA).map((m) => ({
      ime: m.name,
      logo: m.logo_path ?? null,
    })),
  };
}

// ── Obogaćivanje ────────────────────────────────────────────────────

/** "tmdb" iz katalog/serije.json: broj (i "12345" kao tekst), null, ili ništa. */
function procitajIspravku(vrednost, id, log) {
  if (vrednost === undefined || vrednost === null) return vrednost;
  const broj = typeof vrednost === "string" && /^\d+$/.test(vrednost.trim()) ? Number(vrednost) : vrednost;
  if (Number.isSafeInteger(broj) && broj > 0) return broj;
  log(`${id}: neispravna ispravka "tmdb" (${JSON.stringify(vrednost)}), zanemarena`);
  return undefined;
}

/**
 * @param {{
 *   klijent: ReturnType<typeof napraviTmdbKlijent>,
 *   serije: { id: string, ime: string, epizode: { objavljeno: string|null }[] }[],
 *   stari?: typeof PRAZNO_OBOGACIVANJE,
 *   ispravke?: Record<string, { tmdb?: number | null }>,
 *   sada?: Date,
 *   log?: (poruka: string) => void,
 * }} opcije
 */
export async function obogati({
  klijent,
  serije,
  stari = PRAZNO_OBOGACIVANJE,
  ispravke = {},
  sada = new Date(),
  log = () => {},
}) {
  const novo = {
    verzija: 1,
    osvezeno: sada.toISOString(),
    serije: {},
    provajderi: { ...stari.provajderi },
    zanrovi: stari.zanrovi ?? {},
    zanroviOsvezeno: stari.zanroviOsvezeno ?? null,
  };
  const zastarelo = (vreme) => !vreme || sada - new Date(vreme) >= OSVEZAVANJE_MS;
  let prekid = null;

  for (const s of serije) {
    const stara = stari.serije[s.id];
    // Ručna ispravka: broj = tačan TMDB ID, null = bez TMDB podataka.
    const rucno = procitajIspravku(ispravke[s.id]?.tmdb, s.id, log);
    if (rucno === null) continue;

    // Stari zapis važi ako se slaže sa ispravkom; osvežava se kad zastari
    // (i "nije pronađeno" se ponovo proverava posle nedelju dana).
    const odgovara = stara && (rucno === undefined || stara.tmdbId === rucno);
    if (odgovara && (prekid || !zastarelo(stara.osvezeno))) {
      novo.serije[s.id] = stara;
      continue;
    }
    if (prekid) continue;

    try {
      // Već upareni ID se samo osvežava; ime se ponovo traži samo ako ga nema.
      let id = rucno ?? stara?.tmdbId ?? null;
      if (id === null) {
        const prva = s.epizode.map((e) => e.objavljeno).filter(Boolean).sort()[0] ?? null;
        id = izaberiPogodak(s.ime, await klijent.trazi(s.ime), prva)?.id ?? null;
      }
      if (id === null) {
        novo.serije[s.id] = { tmdbId: null, osvezeno: sada.toISOString() };
        log(`${s.id}: nema pouzdanog pogotka na TMDB-u za "${s.ime}"`);
        continue;
      }
      const detalji = await klijent.detalji(id);
      if (!detalji) {
        novo.serije[s.id] = { tmdbId: null, osvezeno: sada.toISOString() };
        log(`${s.id}: TMDB serija ${id} ne postoji`);
        continue;
      }
      novo.serije[s.id] = napraviZapis(detalji, novo.provajderi, sada);
      log(`${s.id}: TMDB ${id} "${detalji.original_name}"`);
    } catch (greska) {
      if (!(greska instanceof GreskaTmdb)) throw greska;
      log(`${s.id}: greška ${greska.message}`);
      if (stara) novo.serije[s.id] = stara;
      if (greska.kobna) prekid = greska.message;
    }
  }

  const bezZanrova = Object.keys(novo.zanrovi).length === 0;
  if (!prekid && (bezZanrova || zastarelo(novo.zanroviOsvezeno))) {
    try {
      const zanrovi = {};
      for (const jezik of JEZICI_SAJTA) {
        const lista = await klijent.zanrovi(jezik);
        zanrovi[jezik] = Object.fromEntries(
          lista.map((z) => [z.id, jezik === "sr" ? uLatinicu(z.name) : z.name]),
        );
      }
      novo.zanrovi = zanrovi;
      novo.zanroviOsvezeno = sada.toISOString();
    } catch (greska) {
      if (!(greska instanceof GreskaTmdb)) throw greska;
      log(`žanrovi: greška ${greska.message}`);
    }
  }

  // Rečnik platformi zadržava samo one koje se još negde koriste.
  const koriscene = new Set(
    Object.values(novo.serije).flatMap((z) =>
      Object.values(z.gledanje ?? {}).flatMap((p) => Object.values(p).flat()),
    ),
  );
  for (const id of Object.keys(novo.provajderi)) {
    if (!koriscene.has(Number(id))) delete novo.provajderi[id];
  }

  return { podaci: novo, prekid };
}
