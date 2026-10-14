// Pokretanje aplikacije: ruter, zaglavlje, donja navigacija, podnožje.

import { IKONE, BAZA, adresa, esc } from "./pomocne.js";
import { JEZICI, datum, imeJezika, jezik, postaviJezik, t } from "./prevodi.js";
import { otvoriPretragu } from "./pretraga.js";
import { prikaziIstrazi } from "./strane/istrazi.js";
import { prikaziListu } from "./strane/lista.js";
import { prikaziPocetnu } from "./strane/pocetna.js";
import { prikaziSeriju } from "./strane/serija.js";

const IZVORNI_KOD =
  document.querySelector('meta[name="izvorni-kod"]')?.content ||
  "https://github.com/srbinzaprimer/analiza";
const STRANE = new Set(["", "serija", "istrazi", "lista"]);

const glavni = document.getElementById("sadrzaj");
const zaglavlje = document.getElementById("zaglavlje");
const podnozje = document.getElementById("podnozje");
const donjaTraka = document.createElement("nav");

const stanje = {
  katalog: null, // obećanje sa { osvezeno, zanrovi, provajderi, istaknute, serije }
  serije: new Map(), // id → obećanje pune serije
  sezona: null,
  redosled: "rastuce",
  plejer: null,
  odbrojavanje: null,
  prikaz: 0,
  prethodna: null,
  ciscenje: [],
};

// ── Podaci ──────────────────────────────────────────────────────────

async function preuzmiJson(putanja) {
  const odgovor = await fetch(adresa(putanja));
  if (odgovor.status === 404) return null;
  if (!odgovor.ok) throw new Error(`HTTP ${odgovor.status}`);
  return odgovor.json();
}

function katalog() {
  if (!stanje.katalog) {
    const obecanje = preuzmiJson("podaci/serije.json").then((podaci) => {
      if (!podaci) throw new Error("nema kataloga");
      return podaci;
    });
    // Posle greške sledeći poziv pokušava ponovo.
    obecanje.catch(() => {
      if (stanje.katalog === obecanje) stanje.katalog = null;
    });
    stanje.katalog = obecanje;
  }
  return stanje.katalog;
}

function serija(id) {
  if (!/^[a-z0-9-]+$/.test(id)) return Promise.resolve(null);
  if (!stanje.serije.has(id)) {
    const obecanje = preuzmiJson(`podaci/serija/${id}.json`);
    obecanje.catch(() => {
      if (stanje.serije.get(id) === obecanje) stanje.serije.delete(id);
    });
    stanje.serije.set(id, obecanje);
  }
  return stanje.serije.get(id);
}

// ── Obaveštenja ─────────────────────────────────────────────────────

function obavesti(poruka) {
  let polje = document.getElementById("obavestenje");
  if (!polje) {
    polje = document.createElement("div");
    polje.id = "obavestenje";
    polje.className = "obavestenje";
    polje.setAttribute("role", "status");
    polje.setAttribute("aria-live", "polite");
    document.body.append(polje);
  }
  polje.textContent = poruka;
  polje.classList.add("vidljivo");
  clearTimeout(obavesti.tajmer);
  obavesti.tajmer = setTimeout(() => polje.classList.remove("vidljivo"), 2500);
}

async function kopiraj(tekst) {
  try {
    await navigator.clipboard.writeText(tekst);
    obavesti(t("linkKopiran"));
  } catch {
    window.prompt("", tekst);
  }
}

// Slika koja ne može da se učita (obrisan video, bez mreže): ostaje umetnički okvir.
document.addEventListener(
  "error",
  (d) => {
    if (d.target instanceof HTMLImageElement) d.target.remove();
  },
  true,
);

// ── Navigacija ──────────────────────────────────────────────────────

function ruta(url = location) {
  const putanja = url.pathname.startsWith(BAZA.pathname) ? url.pathname.slice(BAZA.pathname.length) : "";
  let delovi = putanja.split("/").filter(Boolean);
  if (delovi.at(-1) === "index.html") delovi.pop();
  try {
    delovi = delovi.map(decodeURIComponent);
  } catch {
    // Neispravno kodirana adresa: tretiramo je kao nepoznatu stranu.
  }
  const strana = delovi[0] ?? "";
  return {
    strana,
    id: delovi[1] ?? null,
    epizoda: new URLSearchParams(url.search).get("e"),
    visak: delovi.length > (strana === "serija" ? 2 : 1),
  };
}

function jeRutaAplikacije(url) {
  if (url.origin !== location.origin || !url.pathname.startsWith(BAZA.pathname)) return false;
  return STRANE.has(ruta(url).strana);
}

function idi(href, { zameni = false } = {}) {
  const url = new URL(href, BAZA);
  if (url.pathname + url.search === location.pathname + location.search) return;
  history[zameni ? "replaceState" : "pushState"](null, "", url.pathname + url.search);
  prikazi();
}

document.addEventListener("click", (d) => {
  const link = d.target.closest("a[href]");
  if (!link || d.defaultPrevented || d.button !== 0) return;
  if (d.metaKey || d.ctrlKey || d.shiftKey || d.altKey) return;
  if (link.hasAttribute("data-preskoci")) {
    d.preventDefault();
    glavni.focus();
    return;
  }
  if (link.target || link.hasAttribute("download")) return;
  const url = new URL(link.href);
  if (!jeRutaAplikacije(url)) return;
  d.preventDefault();
  idi(url.href);
});

window.addEventListener("popstate", () => prikazi());

// "/" otvara pretragu (osim dok se kuca u polje).
document.addEventListener("keydown", (d) => {
  if (d.key !== "/" || d.ctrlKey || d.metaKey || d.altKey) return;
  if (d.target.closest("input, textarea, select, [contenteditable]")) return;
  d.preventDefault();
  otvoriPretragu(kontekst);
});

// Napredak se čuva i kad se tab zatvori ili sakrije, ne samo svakih par sekundi.
window.addEventListener("pagehide", () => stanje.plejer?.sacuvaj());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") stanje.plejer?.sacuvaj();
});

function ocisti() {
  clearInterval(stanje.odbrojavanje);
  stanje.odbrojavanje = null;
  stanje.plejer?.unisti();
  stanje.plejer = null;
  for (const fn of stanje.ciscenje.splice(0)) fn();
}

async function prikazi() {
  const broj = ++stanje.prikaz;
  const r = ruta();
  const prethodna = stanje.prethodna;
  stanje.prethodna = r;
  ocisti();
  oznaciNavigaciju(r);
  document.body.dataset.strana = r.strana || "pocetna";
  osveziZaglavlje();

  if (r.strana === "serija" && r.id && !r.visak) {
    await prikaziSeriju(kontekst, broj, r, prethodna);
    return;
  }
  if (r.strana === "istrazi" && !r.visak) await prikaziIstrazi(kontekst, broj);
  else if (r.strana === "lista" && !r.visak) await prikaziListu(kontekst, broj);
  else if (r.strana === "" && !r.visak) await prikaziPocetnu(kontekst, broj);
  else {
    document.title = `${t("stranaNePostoji")} | Bölüm`;
    glavni.innerHTML = poruka(t("stranaNePostoji"));
  }
  if (broj === stanje.prikaz) zavrsiPrikaz(prethodna, r);
}

/** Posle promene strane: na vrh, i fokus na naslov radi čitača ekrana. */
function zavrsiPrikaz(prethodna, r) {
  if (!prethodna) return; // prvo učitavanje: pregledač sam vodi računa
  const istaStrana = prethodna.strana === r.strana && prethodna.id === r.id;
  if (!istaStrana) {
    window.scrollTo({ top: 0 });
    glavni.querySelector("h1")?.focus({ preventScroll: true });
  }
}

function poruka(tekst) {
  return `<div class="poruka-strana"><h1 tabindex="-1">${esc(tekst)}</h1>
    <p><a class="dugme zlatno" href="./">${esc(t("pocetna"))}</a></p></div>`;
}

function greskaUcitavanja() {
  glavni.innerHTML = `<div class="poruka-strana"><h1 tabindex="-1">${esc(t("greskaUcitavanja"))}</h1>
    <p><button class="dugme zlatno" type="button" data-ponovo>${esc(t("pokusajPonovo"))}</button></p></div>`;
  glavni.querySelector("[data-ponovo]").addEventListener("click", () => {
    prikazi();
    nacrtajPodnozje();
  });
}

/** Sve što strane dobijaju od aplikacije. */
const kontekst = {
  glavni,
  stanje,
  katalog,
  serija,
  idi,
  prikazi,
  obavesti,
  kopiraj,
  poruka,
  greskaUcitavanja,
  zavrsiPrikaz,
  jeZastareo: (broj) => broj !== stanje.prikaz,
  pocisti: (fn) => stanje.ciscenje.push(fn),
};

// ── Zaglavlje, donja traka, podnožje ────────────────────────────────

function nacrtajZaglavlje() {
  zaglavlje.innerHTML = `<div class="zaglavlje-unutra">
    <a class="logo" href="./"><img src="ikonica.svg" alt="" width="34" height="34"><span>Bölüm</span></a>
    <nav class="navigacija" aria-label="Bölüm">
      <a href="./" data-nav="">${esc(t("pocetna"))}</a>
      <a href="istrazi/" data-nav="istrazi">${esc(t("istrazi"))}</a>
      <a href="lista/" data-nav="lista">${esc(t("mojaLista"))}</a>
    </nav>
    <button type="button" class="dugme-pretrage" data-pretraga>
      ${IKONE.trazi}<span>${esc(t("pretraga"))}</span><kbd aria-hidden="true">/</kbd>
    </button>
    <label class="za-citace" for="izbor-jezika">${esc(t("jezik"))}</label>
    <select id="izbor-jezika" class="jezik">
      ${JEZICI.map((j) => `<option value="${j}"${j === jezik() ? " selected" : ""}>${esc(imeJezika(j))}</option>`).join("")}
    </select>
  </div>`;

  zaglavlje.querySelector("[data-pretraga]").addEventListener("click", () => otvoriPretragu(kontekst));
  zaglavlje.querySelector("#izbor-jezika").addEventListener("change", (d) => {
    postaviJezik(d.target.value);
    document.documentElement.lang = jezik();
    nacrtajZaglavlje();
    nacrtajDonjuTraku();
    nacrtajPodnozje();
    prikazi();
    // Zaglavlje je ponovo nacrtano, pa fokus vraćamo na novi izbor jezika.
    zaglavlje.querySelector("#izbor-jezika").focus();
  });
  document.querySelector("[data-preskoci]").textContent = t("preskoci");
  oznaciNavigaciju(ruta());
}

function nacrtajDonjuTraku() {
  donjaTraka.className = "donja-traka";
  donjaTraka.setAttribute("aria-label", "Bölüm");
  donjaTraka.innerHTML = `
    <a href="./" data-nav="">${IKONE.kuca}<span>${esc(t("pocetna"))}</span></a>
    <a href="istrazi/" data-nav="istrazi">${IKONE.mreza}<span>${esc(t("istrazi"))}</span></a>
    <button type="button" data-pretraga>${IKONE.trazi}<span>${esc(t("pretrazi"))}</span></button>
    <a href="lista/" data-nav="lista">${IKONE.srce}<span>${esc(t("mojaLista"))}</span></a>`;
  donjaTraka.querySelector("[data-pretraga]").addEventListener("click", () => otvoriPretragu(kontekst));
  if (!donjaTraka.isConnected) document.body.append(donjaTraka);
  oznaciNavigaciju(ruta());
}

function oznaciNavigaciju(r) {
  for (const link of document.querySelectorAll("[data-nav]")) {
    if (link.dataset.nav === r.strana) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

/** Preko velike slike zaglavlje je providno, a pri skrolovanju dobija pozadinu. */
function osveziZaglavlje() {
  zaglavlje.classList.toggle("skrolovano", window.scrollY > 24);
}
let cekaOkvir = false;
window.addEventListener(
  "scroll",
  () => {
    if (cekaOkvir) return;
    cekaOkvir = true;
    requestAnimationFrame(() => {
      cekaOkvir = false;
      osveziZaglavlje();
    });
  },
  { passive: true },
);

async function nacrtajPodnozje() {
  const manifest = adresa("stremio/manifest.json");
  const stremioLink = `stremio://${manifest.replace(/^https?:\/\//, "")}`;
  let azurirano = "";
  try {
    const k = await katalog();
    if (k.osvezeno) azurirano = `<p>${esc(t("azurirano", { datum: datum(k.osvezeno) }))}</p>`;
  } catch {
    // Greška u učitavanju se prikazuje na samoj strani.
  }
  podnozje.innerHTML = `<div class="podnozje-unutra">
    <section class="stremio-kartica" aria-labelledby="stremio-naslov">
      <div>
        <h2 id="stremio-naslov">${esc(t("stremioNaslov"))}</h2>
        <p>${esc(t("stremioTekst"))}</p>
      </div>
      <div class="dugmad">
        <a class="dugme zlatno" href="${esc(stremioLink)}">${esc(t("dodajUStremio"))}</a>
        <button class="dugme staklo" type="button" data-kopiraj="${esc(manifest)}">${esc(t("kopirajAdresu"))}</button>
      </div>
    </section>
    <div class="podnozje-dno">
      <a class="logo" href="./"><img src="ikonica.svg" alt="" width="28" height="28"><span>Bölüm</span></a>
      <div class="podnozje-tekst">
        <p>${esc(t("oProjektu"))}</p>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        ${azurirano}
        <p><a href="${esc(IZVORNI_KOD)}" rel="noopener" target="_blank">${esc(t("izvorniKod"))}</a></p>
      </div>
    </div>
  </div>`;
  podnozje
    .querySelector("[data-kopiraj]")
    .addEventListener("click", (d) => kopiraj(d.currentTarget.dataset.kopiraj));
}

// ── Pokretanje ──────────────────────────────────────────────────────

document.documentElement.lang = jezik();
nacrtajZaglavlje();
nacrtajDonjuTraku();
nacrtajPodnozje();
prikazi();
