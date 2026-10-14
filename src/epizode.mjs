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

// Kanali često u naslovu navode titlove: "(English Subtitles)", "Sub Español"…
const TITLOVI_U_NASLOVU = [
  ["en", /english\s+sub(?:title)?s?|\beng\.?\s*subs?\b|\bsub\s+eng\b|english\s+subbed/iu],
  ["es", /subt[ií]tul(?:os|ado|ada)|\bsubs?\s+(?:en\s+)?espa[ñn]ol|\bsub\s+esp\b/iu],
  ["ar", /مترجم|ترجمة\s+عربية/u],
  ["pt", /legendad[oa]|legendas?\s+em\s+portugu[eê]s|\bsub\s+pt\b/iu],
  ["fr", /sous[-\s]titr[eé]s?|\bvostfr\b/iu],
  ["de", /untertitel/iu],
  ["it", /sottotitol[oi]|\bsub\s+ita\b/iu],
  ["ru", /субтитр(?:ы|ами)/iu],
  ["bg", /субтитри/iu],
  ["pl", /\bnapisy\b/iu],
  ["ro", /subtitrat|subtitrare/iu],
  ["hu", /feliratos|magyar\s+felirat/iu],
  ["el", /υπότιτλ/iu],
  ["fa", /زیرنویس/u],
  ["id", /subtitle\s+indonesia|\bsub\s+indo\b/iu],
  ["sr", /titlovan[oa]?\b|sa\s+titlovima|\bprevod\b/iu],
];

// Ime jezika na engleskom ili turskom ispred reči "titlovi": "Arabic Subtitles",
// "Arapça Altyazılı". Sinhronizacija ("Arabic Dubbed", "Dublaj") se ne računa.
const IMENA_JEZIKA = {
  en: "english|[iİ]ngilizce",
  es: "spanish|[iİ]spanyolca",
  ar: "arabic|arap[çc]a",
  pt: "portuguese|portekizce",
  fr: "french|frans[ıi]zca",
  de: "german|almanca",
  it: "italian|[iİ]talyanca",
  ru: "russian|rus[çc]a",
  bg: "bulgarian|bulgarca",
  pl: "polish|leh[çc]e",
  ro: "romanian|romence",
  hu: "hungarian|macarca",
  el: "greek|yunanca",
  fa: "persian|farsi|far[sş][çc]a",
  id: "indonesian|endonezce",
  sr: "serbian|s[ıi]rp[çc]a",
};
const IME_PA_TITLOVI = Object.entries(IMENA_JEZIKA).map(([jezik, imena]) => [
  jezik,
  // \b u JS-u ne radi posle "ı", pa se kraj reči proverava preko \p{L}.
  new RegExp(`(?<!\\p{L})(?:${imena})[\\s-]*(?:sub(?:title)?s?|subbed|altyaz[ıi](?:l[ıi])?)(?!\\p{L})`, "iu"),
]);

/** Jezici titlova koje naslov videa pominje, npr. ["en"]. */
export function titloviIzNaslova(naslov) {
  const tekst = String(naslov ?? "");
  const jezici = new Set();
  for (const [jezik, obrazac] of [...TITLOVI_U_NASLOVU, ...IME_PA_TITLOVI]) {
    if (obrazac.test(tekst)) jezici.add(jezik);
  }
  return [...jezici];
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
