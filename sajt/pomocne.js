// Zajedničke pomoćne funkcije interfejsa.

import { jezik } from "./prevodi.js";

export const BAZA = new URL(document.baseURI);

export function esc(vrednost) {
  return String(vrednost ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const adresa = (putanja) => new URL(putanja, BAZA).href;

export const putanjaSerije = (id, videoId) =>
  `serija/${encodeURIComponent(id)}/` + (videoId ? `?e=${encodeURIComponent(videoId)}` : "");

export const youtubeAdresa = (id) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

const TURSKA_SLOVA = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

/** Za pretragu: "Yalı Çapkını" i "yali capkini" postaju isti tekst. */
export function zaPretragu(tekst) {
  return String(tekst ?? "")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (s) => TURSKA_SLOVA[s])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

/** Naziv serije na jeziku sajta, ako se razlikuje od originalnog. */
export function prevedenNaziv(s) {
  const naziv = s.nazivi?.[jezik()];
  return naziv && zaPretragu(naziv) !== zaPretragu(s.ime) ? naziv : null;
}

export function opisSerije(s) {
  return s.opisi?.[jezik()] ?? s.opisi?.en ?? null;
}

const LOKALI = { en: "en", sr: "sr-Latn", tr: "tr", es: "es" };

/** "engleski", "španski"… za kod jezika, na jeziku sajta. */
export function imeJezika(kod) {
  try {
    const ime = new Intl.DisplayNames([LOKALI[jezik()]], { type: "language" }).of(kod);
    return ime ? ime.charAt(0).toLocaleUpperCase(LOKALI[jezik()]) + ime.slice(1) : kod;
  } catch {
    return kod.toUpperCase();
  }
}

export function imeZemlje(kod) {
  try {
    return new Intl.DisplayNames([LOKALI[jezik()]], { type: "region" }).of(kod) ?? kod;
  } catch {
    return kod;
  }
}

/** Broj na jeziku sajta: 1,2 mil. / 1.2M … */
export function kratakBroj(n) {
  return new Intl.NumberFormat(LOKALI[jezik()], { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Dve stalne boje iz imena, za umetnički okvir serije bez slike. */
export function bojeZaIme(ime) {
  let h = 0;
  for (const znak of String(ime)) h = (Math.imul(h, 31) + znak.codePointAt(0)) >>> 0;
  return [h % 360, (h >>> 9) % 360];
}

export const IKONE = {
  pusti: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z"/></svg>',
  dodaj: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  stiklirano: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/></svg>',
  podeli:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z"/></svg>',
  levo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z"/></svg>',
  desno: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z"/></svg>',
  spolja:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6h-2V7.4l-7.3 7.3-1.4-1.4L16.6 6H14zM5 6h6v2H6v10h10v-5h2v7H4V6z"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z"/></svg>',
  trazi:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a6 6 0 1 0 3.6 10.8l4.3 4.3 1.4-1.4-4.3-4.3A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/></svg>',
  kuca: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 10.5V21h6v-6h6v6h6V10.5z"/></svg>',
  mreza: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/></svg>',
  srce: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v17l-7-4.5L5 21z"/></svg>',
  zvezda: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
  titlovi:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm2 8v2h5v-2zm7 0v2h5v-2zM6 10v1.5h12V10z"/></svg>',
  kocka:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM7.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
  zatvori: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z"/></svg>',
  pauza: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z"/></svg>',
  oko: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6.5 5 2.7 9.4 1.5 12c1.2 2.6 5 7 10.5 7s9.3-4.4 10.5-7C21.3 9.4 17.5 5 12 5zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>',
  bioskop:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm2 0v12h14V6zm2 2h4v2H9v2H7zm10 8h-4v-2h2v-2h2z"/></svg>',
  lista: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h12v2H3zm0 6h12v2H3zm0 6h8v2H3zm14-4 5 3.5-5 3.5z"/></svg>',
};

/**
 * Stilovi koje CSP ne dozvoljava u HTML-u (style="…") postavljaju se ovde:
 * širina trake napretka i boje umetničkog okvira.
 */
export function primeniStilove(koren) {
  for (const el of koren.querySelectorAll("[data-udeo]")) {
    el.style.setProperty("--udeo", String(Math.min(1, Number(el.dataset.udeo) || 0)));
    el.removeAttribute("data-udeo");
  }
  for (const el of koren.querySelectorAll("[data-boje]")) {
    const [a, b] = el.dataset.boje.split(",").map(Number);
    el.style.setProperty("--boja-a", String(a));
    el.style.setProperty("--boja-b", String(b));
    el.removeAttribute("data-boje");
  }
}
