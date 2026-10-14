// Prepoznavanje epizoda iz naslova YouTube videa.
//
// Zvanični kanali objavljuju cele epizode sa naslovima poput
// "Yalı Çapkını 45. Bölüm" ili "Golden Boy Episode 45 (English Subtitles)".
// Iz naslova izvlačimo ime serije, sezonu i broj epizode, a odbacujemo
// najave, isečke i scene.

// Oznake broja epizode na jezicima na kojima kanali objavljuju serije.
const OZNAKE_EPIZODE = [
  /(\d{1,4})\s*\.\s*bölüm/iu,
  /\bbölüm\s*(\d{1,4})\b/iu,
  /\bepisode\s*(\d{1,4})\b/iu,
  /\bep\.?\s*(\d{1,4})\b/iu,
  /\bcap[ií]tulo\s*(\d{1,4})\b/iu,
  /\bepis[oó]dio\s*(\d{1,4})\b/iu,
  /الحلقة\s*(\d{1,4})/u,
];

const OZNAKE_SEZONE = [
  /(\d{1,2})\s*\.\s*sezon/iu,
  /\bsezon\s*(\d{1,2})\b/iu,
  /\bseason\s*(\d{1,2})\b/iu,
  /\btemporada\s*(\d{1,2})\b/iu,
];

// Videi koji pominju epizodu, a nisu cela epizoda.
const NIJE_EPIZODA =
  /fragman|tanıtım|teaser|trailer|tráiler|özel klip|\bklip\b|\bclip\b|sahne|kamera arkası|behind the scenes|kolaj|#shorts|\bshorts\b|özet|recap|resumen|reaction|tepki/iu;

// Cela epizoda turske serije traje oko dva sata; ovo odbacuje isečke.
export const MINIMALNO_TRAJANJE_S = 20 * 60;

/**
 * Iz naslova izvlači seriju i broj epizode.
 * Vraća null ako naslov ne izgleda kao cela epizoda.
 *
 * @returns {{ serija: string, sezona: number, epizoda: number } | null}
 */
export function procitajNaslov(naslov) {
  const tekst = String(naslov ?? "").replace(/\s+/g, " ").trim();
  if (!tekst || NIJE_EPIZODA.test(tekst)) return null;

  let pogodak = null;
  for (const obrazac of OZNAKE_EPIZODE) {
    pogodak = obrazac.exec(tekst);
    if (pogodak) break;
  }
  if (!pogodak) return null;

  const epizoda = Number(pogodak[1]);
  if (!Number.isInteger(epizoda) || epizoda < 1) return null;

  const pre = tekst.slice(0, pogodak.index);
  const posle = tekst.slice(pogodak.index + pogodak[0].length);
  const serija = ocistiIme(bezSezone(pre)) || prviDeo(bezSezone(posle));
  if (!serija) return null;

  return { serija, sezona: procitajSezonu(tekst) ?? 1, epizoda };
}

function procitajSezonu(tekst) {
  for (const obrazac of OZNAKE_SEZONE) {
    const m = obrazac.exec(tekst);
    if (m) return Number(m[1]);
  }
  return null;
}

function bezSezone(tekst) {
  return OZNAKE_SEZONE.reduce((t, obrazac) => t.replace(obrazac, " "), tekst);
}

/** Kad je oznaka epizode na početku ("45. Bölüm | Serija"), ime je posle nje. */
function prviDeo(tekst) {
  for (const deo of tekst.split(/[|–—:]|\s-\s/)) {
    const ime = ocistiIme(deo);
    if (ime) return ime;
  }
  return "";
}

function ocistiIme(tekst) {
  const ime = tekst
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ") // "(English Subtitles)", "[4K]"
    .replace(/@\S+/g, " ") // "@showtv"
    .replace(/#\S+/g, " ")
    .replace(/\b(?:full hd|hd|4k|tek parça|yeni)\b/giu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s|–—:,.\-]+|[\s|–—:,.\-]+$/g, "")
    .trim();
  return /\p{L}/u.test(ime) ? ime : "";
}

/** Ključ za grupisanje: isti naziv bez obzira na velika slova i razmake. */
export function kljucSerije(ime) {
  return ime.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
}

const TURSKA_SLOVA = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

/** "Yalı Çapkını" → "yali-capkini" */
export function slug(tekst) {
  return tekst
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (s) => TURSKA_SLOVA[s])
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** ISO 8601 trajanje sa YouTube-a ("PT1H45M12S") u sekunde. */
export function trajanjeUSekundama(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? "");
  if (!m) return null;
  const [, d = 0, h = 0, min = 0, s = 0] = m.map((x) => Number(x ?? 0));
  return ((d * 24 + h) * 60 + min) * 60 + s;
}
