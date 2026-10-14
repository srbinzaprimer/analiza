// Napredak gledanja i "moja lista", samo u pregledaču korisnika (localStorage).

const NAPREDAK = "bolum:napredak";
const LISTA = "bolum:lista";
const NAJVISE_ZAPISA = 400;

// Epizoda se računa kao odgledana pred kraj (odjavna špica).
export const ODGLEDANO_UDEO = 0.95;

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

/** Započete, a nezavršene epizode: najviše jedna po seriji, najskorije prvo. */
export function nastaviGledanje(najvise = 12) {
  const poSeriji = new Map();
  const zapisi = Object.entries(sviZapisi())
    .filter(([, z]) => ispravanZapis(z) && !z.kraj && z.t >= 30)
    .sort((a, b) => b[1].kada - a[1].kada);
  for (const [videoId, zapis] of zapisi) {
    if (!poSeriji.has(zapis.serija)) poSeriji.set(zapis.serija, { videoId, ...zapis });
  }
  return [...poSeriji.values()].slice(0, najvise);
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
