// Napredak gledanja i "moja lista", samo u pregledaču korisnika (localStorage).

const NAPREDAK = "bolum:napredak";
const LISTA = "bolum:lista";
const NAJVISE_ZAPISA = 400;

// Epizoda se računa kao odgledana pred kraj (odjavna špica).
export const ODGLEDANO_UDEO = 0.95;
// Kraće od ovoga je samo zavirivanje: ne menja gde se stalo.
export const POCETAK_S = 30;

function citaj(kljuc, podrazumevano) {
  try {
    const vrednost = JSON.parse(localStorage.getItem(kljuc));
    return vrednost ?? podrazumevano;
  } catch {
    return podrazumevano;
  }
}

function pisi(kljuc, vrednost) {
  try {
    localStorage.setItem(kljuc, JSON.stringify(vrednost));
  } catch {
    // Pun ili zabranjen localStorage: aplikacija radi i bez pamćenja.
  }
}

function sviZapisi() {
  const sve = citaj(NAPREDAK, {});
  return sve && typeof sve === "object" && !Array.isArray(sve) ? sve : {};
}

function ispravanZapis(z) {
  return (
    z &&
    typeof z === "object" &&
    typeof z.serija === "string" &&
    Number.isFinite(z.t) &&
    Number.isFinite(z.d) &&
    Number.isFinite(z.kada)
  );
}

/** @returns {{ serija: string, ime: string, epizoda: number, slika: string|null, t: number, d: number, kraj: boolean, kada: number } | null} */
export function napredak(videoId) {
  const zapis = sviZapisi()[videoId];
  return ispravanZapis(zapis) ? zapis : null;
}

export function sacuvajNapredak(videoId, podaci) {
  const sve = sviZapisi();
  const stari = ispravanZapis(sve[videoId]) ? sve[videoId] : {};
  sve[videoId] = {
    ...stari,
    ...podaci,
    // Jednom odgledana epizoda ostaje odgledana i kad se ponovo pusti.
    kraj: Boolean(stari.kraj || podaci.kraj || podaci.t / podaci.d >= ODGLEDANO_UDEO),
    kada: Date.now(),
  };

  const kljucevi = Object.keys(sve);
  if (kljucevi.length > NAJVISE_ZAPISA) {
    kljucevi
      .sort((a, b) => (sve[a]?.kada ?? 0) - (sve[b]?.kada ?? 0))
      .slice(0, kljucevi.length - NAJVISE_ZAPISA)
      .forEach((k) => delete sve[k]);
  }
  pisi(NAPREDAK, sve);
}

/** Zapisi jedne serije: videoId → zapis. */
export function napredakSerije(serijaId) {
  const rezultat = new Map();
  for (const [id, zapis] of Object.entries(sviZapisi())) {
    if (ispravanZapis(zapis) && zapis.serija === serijaId) rezultat.set(id, zapis);
  }
  return rezultat;
}

/**
 * Serije u kojima je poslednja gledana epizoda započeta, a nije završena:
 * najviše jedna po seriji, najskorije prvo. Ako je posle nje završena neka
 * druga epizode iste serije, serija se ovde ne nudi (stranica serije nudi sledeću).
 */
export function nastaviGledanje(najvise = 12) {
  const poSeriji = new Map();
  const zapisi = Object.entries(sviZapisi())
    .filter(([, z]) => ispravanZapis(z) && (z.kraj || z.t >= POCETAK_S))
    .sort((a, b) => b[1].kada - a[1].kada);
  for (const [videoId, zapis] of zapisi) {
    if (!poSeriji.has(zapis.serija)) poSeriji.set(zapis.serija, zapis.kraj ? null : { videoId, ...zapis });
  }
  return [...poSeriji.values()].filter(Boolean).slice(0, najvise);
}

export function lista() {
  const sacuvana = citaj(LISTA, []);
  return Array.isArray(sacuvana) ? sacuvana.filter((id) => typeof id === "string") : [];
}

export function uListi(serijaId) {
  return lista().includes(serijaId);
}

/** Dodaje ili uklanja seriju; vraća da li je sada u listi. */
export function prebaciListu(serijaId) {
  const sadasnja = lista();
  const sada = !sadasnja.includes(serijaId);
  pisi(LISTA, sada ? [serijaId, ...sadasnja] : sadasnja.filter((id) => id !== serijaId));
  return sada;
}

// ── Podešavanja ─────────────────────────────────────────────────────

const PODESAVANJA = "bolum:podesavanja";
const PODRAZUMEVANO = Object.freeze({
  titlovi: true,
  jezikTitlova: null, // null: jezik sajta
  autoSledeca: true,
  bioskop: false,
  zemlja: null,
});

/**
 * @returns {{ titlovi: boolean, jezikTitlova: string | null, autoSledeca: boolean,
 *   bioskop: boolean, zemlja: string | null }}
 */
export function podesavanja() {
  const sacuvano = citaj(PODESAVANJA, {});
  const p = sacuvano && typeof sacuvano === "object" ? sacuvano : {};
  return {
    titlovi: typeof p.titlovi === "boolean" ? p.titlovi : PODRAZUMEVANO.titlovi,
    jezikTitlova:
      typeof p.jezikTitlova === "string" && /^[a-z]{2,3}$/.test(p.jezikTitlova) ? p.jezikTitlova : null,
    autoSledeca: typeof p.autoSledeca === "boolean" ? p.autoSledeca : PODRAZUMEVANO.autoSledeca,
    bioskop: typeof p.bioskop === "boolean" ? p.bioskop : PODRAZUMEVANO.bioskop,
    zemlja: typeof p.zemlja === "string" && /^[A-Z]{2}$/.test(p.zemlja) ? p.zemlja : null,
  };
}

export function sacuvajPodesavanje(ime, vrednost) {
  pisi(PODESAVANJA, { ...podesavanja(), [ime]: vrednost });
}
