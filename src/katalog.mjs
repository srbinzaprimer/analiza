// Osvežavanje kataloga sa YouTube-a i grupisanje epizoda u serije.

import {
  MINIMALNO_TRAJANJE_S,
  kljucSerije,
  procitajNaslov,
  slug,
  trajanjeUSekundama,
} from "./epizode.mjs";
import { GreskaYouTube } from "./youtube.mjs";

export const PRAZAN_KATALOG = Object.freeze({
  verzija: 1,
  osvezeno: null,
  kanali: [],
  epizode: [],
});

// Jednom nedeljno kanal pregledamo ceo, da uklonimo obrisane videe i osvežimo
// podatke (YouTube pravila traže osvežavanje sačuvanih podataka bar na 30 dana).
const CELO_OSVEZAVANJE_MS = 7 * 24 * 60 * 60 * 1000;
const ZAPAMCENIH_NAJNOVIJIH = 20;
const DOZVOLJENA_VIDLJIVOST = new Set(["public", "unlisted"]);

/**
 * @param {{
 *   klijent: ReturnType<import("./youtube.mjs").napraviKlijent>,
 *   kanali: { handle: string, potvrdjeno?: boolean, jezik?: string, titlovi?: string[] }[],
 *   stari?: typeof PRAZAN_KATALOG,
 *   sada?: Date,
 *   budzet?: number,
 *   log?: (poruka: string) => void,
 * }} opcije
 */
export async function osveziKatalog({
  klijent,
  kanali,
  stari = PRAZAN_KATALOG,
  sada = new Date(),
  budzet = 9_000,
  log = () => {},
}) {
  const noviKanali = [];
  const epizode = [];
  let prekid = null;

  // Stari podaci se zadržavaju samo za kanale koji su i dalje potvrđeni.
  const zadrziStaro = (izvor, stariKanal, greska) => {
    if (!stariKanal || !izvor.potvrdjeno) return;
    noviKanali.push({ ...stariKanal, greska });
    epizode.push(...stari.epizode.filter((e) => e.kanal === stariKanal.id));
  };

  for (const izvor of kanali) {
    const stariKanal = stari.kanali.find(
      (k) => k.handle.toLowerCase() === izvor.handle.toLowerCase(),
    );

    if (!prekid && klijent.potroseno >= budzet) {
      prekid = `potrošen je dnevni budžet od ${budzet} jedinica kvote`;
      log(`Zaustavljam: ${prekid}. Ostali kanali zadržavaju stare podatke.`);
    }
    if (prekid) {
      zadrziStaro(izvor, stariKanal, stariKanal?.greska ?? null);
      continue;
    }

    try {
      if (!izvor.potvrdjeno) {
        await prijaviKandidata(klijent, izvor, log);
        continue;
      }
      const rezultat = await osveziKanal({ klijent, izvor, stariKanal, stari, sada });
      noviKanali.push(rezultat.kanal);
      epizode.push(...rezultat.epizode);
      log(
        `${izvor.handle} (${rezultat.kanal.ime}): ${rezultat.novih} novih epizoda, ` +
          `ukupno ${rezultat.epizode.length}${rezultat.celo ? " (ceo pregled)" : ""}`,
      );
    } catch (greska) {
      if (!(greska instanceof GreskaYouTube)) throw greska;
      log(`Greška za ${izvor.handle}: ${greska.message}`);
      zadrziStaro(izvor, stariKanal, greska.message);
      if (greska.kobna) {
        prekid = greska.message;
        log("Problem sa ključem ili kvotom, ostali kanali zadržavaju stare podatke.");
      }
    }
  }

  // Stalan redosled, da izmene u sačuvanom katalogu budu pregledne.
  const redKanala = new Map(noviKanali.map((k, i) => [k.id, i]));
  epizode.sort(
    (a, b) =>
      redKanala.get(a.kanal) - redKanala.get(b.kanal) ||
      kljucSerije(a.serija).localeCompare(kljucSerije(b.serija), "tr") ||
      a.sezona - b.sezona ||
      a.epizoda - b.epizoda ||
      a.id.localeCompare(b.id),
  );

  return {
    katalog: { verzija: 1, osvezeno: sada.toISOString(), kanali: noviKanali, epizode },
    prekid,
    potroseno: klijent.potroseno,
  };
}

async function prijaviKandidata(klijent, izvor, log) {
  const kanal = await klijent.kanal(izvor.handle);
  if (!kanal) {
    log(`Kandidat ${izvor.handle}: kanal ne postoji. Proveri @ime.`);
    return;
  }
  const pretplatnika = Number(kanal.statistics?.subscriberCount ?? 0).toLocaleString("sr-Latn");
  log(
    `Kandidat ${izvor.handle}: "${kanal.snippet?.title}" (${pretplatnika} pretplatnika). ` +
      `Nije potvrđen kao zvaničan, pa se preskače.`,
  );
}

async function osveziKanal({ klijent, izvor, stariKanal, stari, sada }) {
  const podaci = await klijent.kanal(izvor.handle);
  if (!podaci) throw new GreskaYouTube(`kanal ${izvor.handle} ne postoji`);
  const otpremljeno = podaci.contentDetails?.relatedPlaylists?.uploads;
  if (!otpremljeno) throw new GreskaYouTube(`kanal ${izvor.handle} nema javne videe`);

  const celo =
    !stariKanal ||
    stariKanal.id !== podaci.id ||
    !stariKanal.celoOsvezavanje ||
    sada - new Date(stariKanal.celoOsvezavanje) >= CELO_OSVEZAVANJE_MS;

  // Otpremljeni videi stižu od najnovijeg. Kad naiđemo na video koji smo već
  // videli, starije stranice ne moramo ponovo da čitamo.
  const vidjeni = new Set(celo ? [] : stariKanal.najnoviji ?? []);
  const stavke = await klijent.stavkePlejliste(
    otpremljeno,
    (stranica) => celo || !stranica.some((s) => vidjeni.has(idVidea(s))),
  );

  const zadrzane = new Map(
    celo ? [] : stari.epizode.filter((e) => e.kanal === podaci.id).map((e) => [e.id, e]),
  );
  const kandidati = [];
  for (const stavka of stavke) {
    const id = idVidea(stavka);
    if (!id || zadrzane.has(id)) continue;
    if (!DOZVOLJENA_VIDLJIVOST.has(stavka.status?.privacyStatus)) continue;
    const procitano = procitajNaslov(stavka.snippet?.title);
    if (procitano) kandidati.push({ id, stavka, ...procitano });
  }

  const detalji = new Map(
    (await klijent.videi([...new Set(kandidati.map((k) => k.id))])).map((v) => [v.id, v]),
  );
  const nove = [];
  for (const k of kandidati) {
    const epizoda = napraviEpizodu(k, detalji.get(k.id), podaci.id);
    if (epizoda) nove.push(epizoda);
  }

  const najnovijiSada = stavke.slice(0, ZAPAMCENIH_NAJNOVIJIH).map(idVidea).filter(Boolean);
  const kanal = {
    handle: izvor.handle,
    id: podaci.id,
    ime: podaci.snippet?.title ?? izvor.handle,
    slika: podaci.snippet?.thumbnails?.medium?.url ?? null,
    pretplatnika: Number(podaci.statistics?.subscriberCount) || null,
    jezik: izvor.jezik ?? "tr",
    titlovi: izvor.titlovi ?? [],
    najnoviji: [...new Set([...najnovijiSada, ...(celo ? [] : stariKanal.najnoviji ?? [])])].slice(
      0,
      ZAPAMCENIH_NAJNOVIJIH,
    ),
    celoOsvezavanje: celo ? sada.toISOString() : stariKanal.celoOsvezavanje,
    greska: null,
  };

  const ranije = new Set(stari.epizode.filter((e) => e.kanal === podaci.id).map((e) => e.id));
  return {
    kanal,
    epizode: bezDuplikata([...zadrzane.values(), ...nove]),
    novih: nove.filter((e) => !ranije.has(e.id)).length,
    celo,
  };
}

function idVidea(stavka) {
  return stavka?.snippet?.resourceId?.videoId ?? stavka?.contentDetails?.videoId ?? null;
}

function napraviEpizodu(kandidat, video, kanalId) {
  if (!video) return null; // obrisan ili privatan u međuvremenu
  if (video.status?.embeddable === false) return null;
  if (video.status?.privacyStatus && !DOZVOLJENA_VIDLJIVOST.has(video.status.privacyStatus)) {
    return null;
  }
  const trajanje = trajanjeUSekundama(video.contentDetails?.duration);
  if (!trajanje || trajanje < MINIMALNO_TRAJANJE_S) return null;

  const slike = kandidat.stavka.snippet?.thumbnails ?? {};
  const ogranicenje = video.contentDetails?.regionRestriction;
  return {
    id: kandidat.id,
    kanal: kanalId,
    serija: kandidat.serija,
    sezona: kandidat.sezona,
    epizoda: kandidat.epizoda,
    naslov: kandidat.stavka.snippet.title,
    objavljeno:
      kandidat.stavka.contentDetails?.videoPublishedAt ??
      kandidat.stavka.snippet?.publishedAt ??
      null,
    trajanje,
    titlovi: video.contentDetails?.caption === "true",
    ograniceno: ogranicenje
      ? { dozvoljeno: ogranicenje.allowed ?? null, zabranjeno: ogranicenje.blocked ?? null }
      : null,
    slika: (slike.medium ?? slike.high ?? slike.default)?.url ?? null,
    slikaVelika: (slike.maxres ?? slike.standard ?? slike.high ?? slike.medium)?.url ?? null,
  };
}

/** Ista epizoda objavljena dvaput: zadržavamo dužu verziju. */
function bezDuplikata(epizode) {
  const poEpizodi = new Map();
  for (const e of epizode) {
    const kljuc = `${kljucSerije(e.serija)}|${e.sezona}|${e.epizoda}`;
    const postojeca = poEpizodi.get(kljuc);
    if (!postojeca || e.trajanje > postojeca.trajanje) poEpizodi.set(kljuc, e);
  }
  return [...poEpizodi.values()];
}

// ── Serije ──────────────────────────────────────────────────────────

// Jedan video sa brojem epizode još nije serija (može biti slučajan pogodak).
const MINIMALNO_EPIZODA = 2;
// ID YouTube videa; od njega se prave imena fajlova, pa drugačiji ne puštamo dalje.
const ID_VIDEA = /^[A-Za-z0-9_-]{6,20}$/;

/** Grupiše epizode po kanalu i seriji, od serije sa najnovijom epizodom. */
export function grupisiSerije(katalog) {
  const kanali = new Map(katalog.kanali.map((k) => [k.id, k]));
  const grupe = new Map();
  for (const e of katalog.epizode) {
    if (!kanali.has(e.kanal) || !ID_VIDEA.test(e.id)) continue;
    const kljuc = `${e.kanal}|${kljucSerije(e.serija)}`;
    if (!grupe.has(kljuc)) grupe.set(kljuc, []);
    grupe.get(kljuc).push(e);
  }

  const zauzeto = new Set();
  const serije = [];
  for (const epizode of grupe.values()) {
    if (epizode.length < MINIMALNO_EPIZODA) continue;
    const kanal = kanali.get(epizode[0].kanal);
    const ime = najcesceIme(epizode);
    epizode.sort(
      (a, b) =>
        a.sezona - b.sezona ||
        a.epizoda - b.epizoda ||
        String(a.objavljeno).localeCompare(String(b.objavljeno)),
    );
    const poslednja = epizode.reduce((p, e) =>
      String(e.objavljeno) > String(p.objavljeno) ? e : p,
    );

    // Ime bez latiničnih slova (npr. arapsko) daje prazan slug, pa koristimo heš.
    const osnova = `${slug(kanal.handle)}-${slug(ime) || `s${hes(kljucSerije(ime))}`}`;
    let id = osnova;
    for (let i = 2; zauzeto.has(id); i++) id = `${osnova}-${i}`;
    zauzeto.add(id);

    serije.push({
      id,
      ime,
      kanal: { ime: kanal.ime, handle: kanal.handle, slika: kanal.slika },
      jezik: kanal.jezik,
      titlovi: kanal.titlovi,
      imaTitlove: epizode.some((e) => e.titlovi),
      brojEpizoda: epizode.length,
      sezone: [...new Set(epizode.map((e) => e.sezona))],
      poslednja: { id: poslednja.id, epizoda: poslednja.epizoda, objavljeno: poslednja.objavljeno },
      slika: poslednja.slikaVelika ?? poslednja.slika,
      epizode,
    });
  }
  return serije.sort((a, b) =>
    String(b.poslednja.objavljeno).localeCompare(String(a.poslednja.objavljeno)),
  );
}

/** Kratak, stalan heš teksta (FNV-1a), za ID-jeve. */
function hes(tekst) {
  let h = 0x811c9dc5;
  for (const znak of tekst) {
    h ^= znak.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function najcesceIme(epizode) {
  const broj = new Map();
  for (const e of epizode) broj.set(e.serija, (broj.get(e.serija) ?? 0) + 1);
  return [...broj.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
