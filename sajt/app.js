import { napraviPlejer } from "./plejer.js";
import { JEZICI, imeJezika, jezik, postaviJezik, relativno, datum, t, trajanje } from "./prevodi.js";
import * as skladiste from "./skladiste.js";

const IZVORNI_KOD =
  document.querySelector('meta[name="izvorni-kod"]')?.content ||
  "https://github.com/srbinzaprimer/analiza";
const BAZA = new URL(document.baseURI);
const AUTO_SLEDECA_S = 8;
const NOVO_DANA = 3;
const NAJVISE_U_REDU = 12;

const glavni = document.getElementById("sadrzaj");
const zaglavlje = document.getElementById("zaglavlje");
const podnozje = document.getElementById("podnozje");

const stanje = {
  katalog: null, // obećanje sa { osvezeno, serije }
  serije: new Map(), // id → obećanje pune serije
  pretraga: "",
  kanal: null,
  sezona: null,
  plejer: null,
  odbrojavanje: null,
  prikaz: 0,
  prethodna: null,
};

// ── Pomoćne ─────────────────────────────────────────────────────────

function esc(vrednost) {
  return String(vrednost ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const adresa = (putanja) => new URL(putanja, BAZA).href;
const putanjaSerije = (id, videoId) =>
  `serija/${encodeURIComponent(id)}/` + (videoId ? `?e=${encodeURIComponent(videoId)}` : "");

const TURSKA_SLOVA = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
function zaPretragu(tekst) {
  return String(tekst)
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (s) => TURSKA_SLOVA[s])
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

const IKONE = {
  pusti: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
  dodaj: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  stiklirano: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/></svg>',
  podeli:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z"/></svg>',
  levo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z"/></svg>',
  desno: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z"/></svg>',
  spolja:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6h-2V7.4l-7.3 7.3-1.4-1.4L16.6 6H14zM5 6h6v2H6v10h10v-5h2v7H4V6z"/></svg>',
};

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

// Slika koja ne može da se učita (obrisan video, bez mreže) dobija zamenu.
document.addEventListener(
  "error",
  (dogadjaj) => {
    if (dogadjaj.target instanceof HTMLImageElement) {
      dogadjaj.target.closest(".slika")?.classList.add("bez-slike");
      dogadjaj.target.remove();
    }
  },
  true,
);

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

// ── Navigacija ──────────────────────────────────────────────────────

function ruta(url = location) {
  const putanja = url.pathname.startsWith(BAZA.pathname)
    ? url.pathname.slice(BAZA.pathname.length)
    : "";
  let delovi = putanja.split("/").filter(Boolean);
  if (delovi.at(-1) === "index.html") delovi.pop();
  try {
    delovi = delovi.map(decodeURIComponent);
  } catch {
    // Neispravno kodirana adresa: tretiramo je kao nepoznatu stranu.
  }
  return {
    strana: delovi[0] ?? "",
    id: delovi[1] ?? null,
    epizoda: new URLSearchParams(url.search).get("e"),
    visak: delovi.length > (delovi[0] === "serija" ? 2 : 1),
  };
}

function jeRutaAplikacije(url) {
  if (url.origin !== location.origin || !url.pathname.startsWith(BAZA.pathname)) return false;
  const { strana } = ruta(url);
  return strana === "" || strana === "serija" || strana === "lista";
}

function idi(href, { zameni = false } = {}) {
  const url = new URL(href, BAZA);
  history[zameni ? "replaceState" : "pushState"](null, "", url.pathname + url.search);
  prikazi();
}

document.addEventListener("click", (dogadjaj) => {
  const link = dogadjaj.target.closest("a[href]");
  if (!link || dogadjaj.defaultPrevented || dogadjaj.button !== 0) return;
  if (dogadjaj.metaKey || dogadjaj.ctrlKey || dogadjaj.shiftKey || dogadjaj.altKey) return;
  if (link.hasAttribute("data-preskoci")) {
    dogadjaj.preventDefault();
    glavni.focus();
    return;
  }
  if (link.target || link.hasAttribute("download")) return;
  const url = new URL(link.href);
  if (!jeRutaAplikacije(url)) return;
  dogadjaj.preventDefault();
  if (url.pathname + url.search !== location.pathname + location.search) idi(url.href);
});

window.addEventListener("popstate", () => prikazi());

// Napredak se čuva i kad se tab zatvori ili sakrije, ne samo svakih par sekundi.
window.addEventListener("pagehide", () => stanje.plejer?.sacuvaj());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") stanje.plejer?.sacuvaj();
});

function zaustaviPlejer() {
  clearInterval(stanje.odbrojavanje);
  stanje.odbrojavanje = null;
  stanje.plejer?.unisti();
  stanje.plejer = null;
}

async function prikazi() {
  const broj = ++stanje.prikaz;
  const r = ruta();
  const prethodna = stanje.prethodna;
  stanje.prethodna = r;
  zaustaviPlejer();
  oznaciNavigaciju(r);

  if (r.strana === "serija" && r.id && !r.visak) {
    await prikaziSeriju(broj, r, prethodna);
  } else if (r.strana === "lista" && !r.visak) {
    await prikaziListu(broj);
    if (broj === stanje.prikaz) zavrsiPrikaz(prethodna, r);
  } else if (r.strana === "" ) {
    await prikaziPocetnu(broj);
    if (broj === stanje.prikaz) zavrsiPrikaz(prethodna, r);
  } else {
    document.title = `${t("stranaNePostoji")} | Bölüm`;
    glavni.innerHTML = poruka(t("stranaNePostoji"), true);
    zavrsiPrikaz(prethodna, r);
  }
}

/** Posle promene strane: na vrh, i fokus na naslov radi čitača ekrana. */
function zavrsiPrikaz(prethodna, r) {
  const istaStrana = prethodna && prethodna.strana === r.strana && prethodna.id === r.id;
  if (!prethodna) return; // prvo učitavanje: pregledač sam vodi računa
  if (!istaStrana) {
    window.scrollTo({ top: 0 });
    glavni.querySelector("h1")?.focus({ preventScroll: true });
  }
}

function jeZastareo(broj) {
  return broj !== stanje.prikaz;
}

// ── Zaglavlje i podnožje ────────────────────────────────────────────

function nacrtajZaglavlje() {
  zaglavlje.innerHTML = `
    <a class="logo" href="./"><img src="ikonica.svg" alt="" width="32" height="32"><span>Bölüm</span></a>
    <nav class="navigacija" aria-label="Bölüm">
      <a href="./" data-nav="">${esc(t("pocetna"))}</a>
      <a href="lista/" data-nav="lista">${esc(t("mojaLista"))}</a>
    </nav>
    <form class="pretraga" role="search">
      <label class="za-citace" for="pretraga">${esc(t("pretraga"))}</label>
      <input id="pretraga" type="search" placeholder="${esc(t("pretraga"))}" autocomplete="off" enterkeyhint="search" value="${esc(stanje.pretraga)}">
    </form>
    <label class="za-citace" for="izbor-jezika">${esc(t("jezik"))}</label>
    <select id="izbor-jezika" class="jezik">
      ${JEZICI.map((j) => `<option value="${j}"${j === jezik() ? " selected" : ""}>${esc(imeJezika(j))}</option>`).join("")}
    </select>`;

  const polje = zaglavlje.querySelector("#pretraga");
  let tajmer;
  polje.addEventListener("input", () => {
    clearTimeout(tajmer);
    tajmer = setTimeout(() => {
      stanje.pretraga = polje.value.trim();
      if (ruta().strana !== "") idi("./");
      else prikazi();
    }, 150);
  });
  zaglavlje.querySelector(".pretraga").addEventListener("submit", (d) => {
    d.preventDefault();
    polje.blur();
  });
  zaglavlje.querySelector("#izbor-jezika").addEventListener("change", (d) => {
    postaviJezik(d.target.value);
    document.documentElement.lang = jezik();
    nacrtajZaglavlje();
    nacrtajPodnozje();
    prikazi();
    // Zaglavlje je ponovo nacrtano, pa fokus vraćamo na novi izbor jezika.
    zaglavlje.querySelector("#izbor-jezika").focus();
  });
  document.querySelector("[data-preskoci]").textContent = t("preskoci");
  oznaciNavigaciju(ruta());
}

function oznaciNavigaciju(r) {
  for (const link of zaglavlje.querySelectorAll("[data-nav]")) {
    const aktivan = link.dataset.nav === r.strana;
    if (aktivan) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

async function nacrtajPodnozje() {
  const manifest = adresa("stremio/manifest.json");
  const stremioLink = `stremio://${manifest.replace(/^https?:\/\//, "")}`;
  let azurirano = "";
  try {
    const k = await katalog();
    if (k.osvezeno) azurirano = `<p class="tiho">${esc(t("azurirano", { datum: datum(k.osvezeno) }))}</p>`;
  } catch {
    // Greška u učitavanju se prikazuje na samoj strani.
  }
  podnozje.innerHTML = `
    <section class="stremio" aria-labelledby="stremio-naslov">
      <div>
        <h2 id="stremio-naslov">${esc(t("stremioNaslov"))}</h2>
        <p>${esc(t("stremioTekst"))}</p>
      </div>
      <div class="dugmad">
        <a class="dugme" href="${esc(stremioLink)}">${esc(t("dodajUStremio"))}</a>
        <button class="dugme sporedno" type="button" data-kopiraj="${esc(manifest)}">${esc(t("kopirajAdresu"))}</button>
      </div>
    </section>
    <div class="o-projektu">
      <p>${esc(t("oProjektu"))}</p>
      ${azurirano}
      <p><a href="${esc(IZVORNI_KOD)}" rel="noopener" target="_blank">${esc(t("izvorniKod"))}</a></p>
    </div>`;
  podnozje
    .querySelector("[data-kopiraj]")
    .addEventListener("click", (d) => kopiraj(d.currentTarget.dataset.kopiraj));
}

// ── Delovi strane ───────────────────────────────────────────────────

function poruka(tekst, saLinkom = false) {
  return `<div class="poruka"><h1 tabindex="-1">${esc(tekst)}</h1>${
    saLinkom ? `<p><a class="dugme" href="./">${esc(t("nazad"))}</a></p>` : ""
  }</div>`;
}

/** Sličica 16:9; `dodatak` (trajanje, napredak) se pozicionira preko nje. */
function slikaHtml(src, { velika = false, dodatak = "" } = {}) {
  return `<div class="slika${src ? "" : " bez-slike"}">${
    src
      ? `<img src="${esc(src)}" alt="" loading="${velika ? "eager" : "lazy"}" decoding="async">`
      : ""
  }${dodatak}</div>`;
}

function trakaNapretka(udeo) {
  return udeo > 0 ? `<div class="napredak" data-udeo="${esc(udeo)}"><span></span></div>` : "";
}

function karticaSerije(s) {
  return `<a class="kartica" href="${putanjaSerije(s.id)}">
    ${slikaHtml(s.slika)}
    <div class="kartica-tekst">
      <h3>${esc(s.ime)}</h3>
      <p>${esc(s.kanal.ime)} · ${esc(t("brojEpizoda", { n: s.brojEpizoda }))}</p>
    </div>
  </a>`;
}

function karticaNoveEpizode(s) {
  const nova = Date.now() - new Date(s.poslednja.objavljeno) < NOVO_DANA * 86_400_000;
  return `<a class="kartica" href="${putanjaSerije(s.id, s.poslednja.id)}">
    ${slikaHtml(s.slika)}
    <div class="kartica-tekst">
      <h3>${esc(s.ime)}</h3>
      <p>${nova ? `<span class="oznaka">${esc(t("novo"))}</span> ` : ""}${esc(t("epizoda", { n: s.poslednja.epizoda }))} · ${esc(relativno(s.poslednja.objavljeno))}</p>
    </div>
  </a>`;
}

function karticaNastavka(z) {
  return `<a class="kartica" href="${putanjaSerije(z.serija, z.videoId)}">
    ${slikaHtml(z.slika, { dodatak: trakaNapretka(Math.min(1, z.t / z.d)) })}
    <div class="kartica-tekst">
      <h3>${esc(z.ime)}</h3>
      <p>${esc(t("nastaviEpizodu", { n: z.epizoda }))}</p>
    </div>
  </a>`;
}

function red(naslov, kartice) {
  if (kartice.length === 0) return "";
  return `<section class="red">
    <h2>${esc(naslov)}</h2>
    <div class="red-kartice">${kartice.join("")}</div>
  </section>`;
}

/** Pruge napretka dobijaju širinu iz JavaScript-a (CSP ne dozvoljava style u HTML-u). */
function primeniNapredak(koren = glavni) {
  for (const traka of koren.querySelectorAll("[data-udeo]")) {
    traka.style.setProperty("--udeo", String(Number(traka.dataset.udeo) || 0));
  }
}

// ── Početna ─────────────────────────────────────────────────────────

async function prikaziPocetnu(broj) {
  document.title = `Bölüm — ${t("slogan")}`;
  if (!glavni.querySelector(".pocetna")) glavni.innerHTML = '<div class="ucitavanje" aria-busy="true"></div>';

  let k;
  try {
    k = await katalog();
  } catch {
    if (jeZastareo(broj)) return;
    glavni.innerHTML = `<div class="poruka"><h1 tabindex="-1">${esc(t("greskaUcitavanja"))}</h1>
      <p><button class="dugme" type="button" data-ponovo>${esc(t("pokusajPonovo"))}</button></p></div>`;
    glavni.querySelector("[data-ponovo]").addEventListener("click", () => {
      prikazi();
      nacrtajPodnozje();
    });
    return;
  }
  if (jeZastareo(broj)) return;

  const serije = k.serije;
  const uvod = `<div class="uvod"><h1 tabindex="-1">${esc(t("slogan"))}</h1><p>${esc(t("podslogan"))}</p></div>`;
  if (serije.length === 0) {
    glavni.innerHTML = `<div class="pocetna">${uvod}<div class="poruka prazno">
      <h2>${esc(t("prazanKatalogNaslov"))}</h2><p>${esc(t("prazanKatalogTekst"))}</p></div></div>`;
    return;
  }

  const upit = zaPretragu(stanje.pretraga);
  const filtrira = Boolean(upit || stanje.kanal);
  const pronadjene = serije.filter(
    (s) =>
      (!stanje.kanal || s.kanal.handle === stanje.kanal) &&
      (!upit || zaPretragu(s.ime).includes(upit) || zaPretragu(s.kanal.ime).includes(upit)),
  );

  const kanali = [...new Map(serije.map((s) => [s.kanal.handle, s.kanal])).values()];
  const filteri =
    kanali.length > 1
      ? `<div class="filteri" role="group" aria-label="${esc(t("sviKanali"))}">
          <button type="button" class="cip" data-kanal="" aria-pressed="${!stanje.kanal}">${esc(t("sviKanali"))}</button>
          ${kanali
            .map(
              (kn) =>
                `<button type="button" class="cip" data-kanal="${esc(kn.handle)}" aria-pressed="${stanje.kanal === kn.handle}">${esc(kn.ime)}</button>`,
            )
            .join("")}
        </div>`
      : "";

  const nastavak = filtrira
    ? []
    : skladiste
        .nastaviGledanje(NAJVISE_U_REDU)
        .filter((z) => serije.some((s) => s.id === z.serija))
        .map(karticaNastavka);

  glavni.innerHTML = `<div class="pocetna">
    ${filtrira ? "" : uvod + istaknuta(serije[0])}
    ${red(t("nastaviGledanje"), nastavak)}
    ${filtrira ? "" : red(t("noveEpizode"), serije.slice(0, NAJVISE_U_REDU).map(karticaNoveEpizode))}
    <section class="sve" aria-labelledby="sve-naslov">
      <h2 id="sve-naslov"${filtrira ? ' tabindex="-1"' : ""}>${esc(t("sveSerije"))}</h2>
      ${filteri}
      ${
        pronadjene.length
          ? `<div class="mreza">${pronadjene.map(karticaSerije).join("")}</div>`
          : `<p class="tiho">${esc(t("nemaRezultata", { q: stanje.pretraga }))}</p>`
      }
    </section>
  </div>`;

  primeniNapredak();
  for (const dugme of glavni.querySelectorAll("[data-kanal]")) {
    dugme.addEventListener("click", () => {
      stanje.kanal = dugme.dataset.kanal || null;
      prikazi().then(() => glavni.querySelector(`[data-kanal="${CSS.escape(dugme.dataset.kanal)}"]`)?.focus());
    });
  }
}

function istaknuta(s) {
  return `<section class="istaknuta">
    ${slikaHtml(s.slika, { velika: true })}
    <div class="istaknuta-tekst">
      <p class="nadnaslov">${esc(t("noveEpizode"))} · ${esc(relativno(s.poslednja.objavljeno))}</p>
      <h2>${esc(s.ime)}</h2>
      <p>${esc(s.kanal.ime)} · ${esc(t("brojEpizoda", { n: s.brojEpizoda }))}</p>
      <div class="dugmad">
        <a class="dugme" href="${putanjaSerije(s.id, s.poslednja.id)}">${IKONE.pusti}${esc(t("gledajEpizodu", { n: s.poslednja.epizoda }))}</a>
        <a class="dugme sporedno" href="${putanjaSerije(s.id)}">${esc(t("brojEpizoda", { n: s.brojEpizoda }))}</a>
      </div>
    </div>
  </section>`;
}

// ── Moja lista ──────────────────────────────────────────────────────

async function prikaziListu(broj) {
  document.title = `${t("mojaLista")} | Bölüm`;
  let k;
  try {
    k = await katalog();
  } catch {
    if (!jeZastareo(broj)) glavni.innerHTML = poruka(t("greskaUcitavanja"), true);
    return;
  }
  if (jeZastareo(broj)) return;
  const poId = new Map(k.serije.map((s) => [s.id, s]));
  const moje = skladiste.lista().map((id) => poId.get(id)).filter(Boolean);
  glavni.innerHTML = `<div class="lista">
    <h1 tabindex="-1">${esc(t("mojaLista"))}</h1>
    ${
      moje.length
        ? `<div class="mreza">${moje.map(karticaSerije).join("")}</div>`
        : `<p class="tiho">${esc(t("praznaLista"))}</p>`
    }
  </div>`;
}

// ── Serija ──────────────────────────────────────────────────────────

/** Šta da se pusti: započeta epizoda, ili prva posle poslednje odgledane. */
function preporuci(s, zapisi) {
  const poSkorosti = [...zapisi.entries()].sort((a, b) => b[1].kada - a[1].kada);
  const zapoceta = poSkorosti.find(([, z]) => !z.kraj);
  const poslednjaOdgledana = poSkorosti.find(([, z]) => z.kraj);
  const indeks = (id) => s.epizode.findIndex((e) => e.id === id);

  if (zapoceta && (!poslednjaOdgledana || zapoceta[1].kada >= poslednjaOdgledana[1].kada)) {
    const e = s.epizode[indeks(zapoceta[0])];
    if (e) return { epizoda: e, nastavak: true };
  }
  if (poslednjaOdgledana) {
    const sledeca = s.epizode[indeks(poslednjaOdgledana[0]) + 1];
    if (sledeca) return { epizoda: sledeca, nastavak: false };
  }
  return { epizoda: s.epizode[0], nastavak: false };
}

async function prikaziSeriju(broj, r, prethodna) {
  const istaSerija = prethodna?.strana === "serija" && prethodna.id === r.id;
  if (!istaSerija) {
    glavni.innerHTML = '<div class="ucitavanje" aria-busy="true"></div>';
    stanje.sezona = null;
  }

  let s;
  try {
    s = await serija(r.id);
  } catch {
    if (!jeZastareo(broj)) glavni.innerHTML = poruka(t("greskaUcitavanja"), true);
    return;
  }
  if (jeZastareo(broj)) return;
  if (!s) {
    document.title = "Bölüm";
    glavni.innerHTML = poruka(t("nijePronadjena"), true);
    zavrsiPrikaz(prethodna, r);
    return;
  }

  const izabrana = r.epizoda ? s.epizode.find((e) => e.id === r.epizoda) : null;
  if (r.epizoda && !izabrana) {
    // Epizoda je u međuvremenu uklonjena: ostajemo na stranici serije.
    history.replaceState(null, "", adresa(putanjaSerije(s.id)));
  }
  const zapisi = skladiste.napredakSerije(s.id);
  const { epizoda: preporucena, nastavak } = preporuci(s, zapisi);
  const indeks = izabrana ? s.epizode.indexOf(izabrana) : -1;
  // Izabrana epizoda uvek otvara svoju sezonu (i kad "sledeća" pređe u novu).
  if (izabrana) stanje.sezona = izabrana.sezona;
  else stanje.sezona ??= preporucena.sezona;

  document.title = izabrana
    ? `${s.ime} · ${t("epizoda", { n: izabrana.epizoda })} | Bölüm`
    : `${s.ime} | Bölüm`;

  const uListi = skladiste.uListi(s.id);
  // Dok se gleda, plejer je na vrhu, a zaglavlje serije ispod njega.
  glavni.innerHTML = `<article class="serija${izabrana ? " gleda" : ""}">
    ${izabrana ? plejerHtml(s, izabrana, indeks) : ""}
    <header class="serija-zaglavlje">
      ${slikaHtml(s.slika, { velika: true })}
      <div class="serija-tekst">
        <h1 tabindex="-1">${esc(s.ime)}</h1>
        <p class="tiho">${esc(s.kanal.ime)} · ${esc(t("brojEpizoda", { n: s.brojEpizoda }))}${
          s.imaTitlove ? ` · <span class="oznaka" title="${esc(t("titlovi"))}">CC</span>` : ""
        }</p>
        <div class="dugmad">
          ${
            izabrana
              ? ""
              : `<a class="dugme" href="${putanjaSerije(s.id, preporucena.id)}">${IKONE.pusti}${esc(
                  t(nastavak ? "nastaviEpizodu" : "gledajEpizodu", { n: preporucena.epizoda }),
                )}</a>`
          }
          <button class="dugme sporedno" type="button" data-lista aria-pressed="${uListi}">${
            uListi ? IKONE.stiklirano : IKONE.dodaj
          }${esc(uListi ? t("uListi") : t("mojaLista"))}</button>
          <button class="dugme sporedno" type="button" data-podeli>${IKONE.podeli}${esc(t("podeli"))}</button>
        </div>
      </div>
    </header>
    ${sezoneHtml(s)}
    <ol class="epizode">${s.epizode
      .filter((e) => e.sezona === stanje.sezona)
      .map((e) => epizodaHtml(s, e, zapisi.get(e.id), e === izabrana))
      .join("")}</ol>
  </article>`;

  primeniNapredak();
  povezSeriju(s);

  if (izabrana) {
    if (istaSerija) {
      window.scrollTo({ top: 0, behavior: pokret() });
      glavni.querySelector("#plejer-naslov").focus({ preventScroll: true });
    } else {
      zavrsiPrikaz(prethodna, r);
    }
    await pokreniPlejer(broj, s, izabrana, indeks);
  } else if (!istaSerija) {
    zavrsiPrikaz(prethodna, r);
  }
}

function pokret() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function sezoneHtml(s) {
  if (s.sezone.length < 2) return "";
  return `<div class="filteri sezone" role="group" aria-label="${esc(t("sezone"))}">${s.sezone
    .map(
      (n) =>
        `<button type="button" class="cip" data-sezona="${esc(n)}" aria-pressed="${n === stanje.sezona}">${esc(t("sezona", { n }))}</button>`,
    )
    .join("")}</div>`;
}

function epizodaHtml(s, e, zapis, izabrana) {
  const udeo = zapis ? (zapis.kraj ? 1 : Math.min(1, zapis.t / zapis.d)) : 0;
  return `<li>
    <a class="epizoda${izabrana ? " izabrana" : ""}" href="${putanjaSerije(s.id, e.id)}"${izabrana ? ' aria-current="true"' : ""}>
      ${slikaHtml(e.slika, {
        dodatak:
          (e.trajanje ? `<span class="trajanje">${esc(trajanje(e.trajanje))}</span>` : "") +
          trakaNapretka(udeo),
      })}
      <div class="kartica-tekst">
        <h3>${esc(t("epizoda", { n: e.epizoda }))}${
          zapis?.kraj ? ` <span class="odgledano" title="${esc(t("odgledano"))}">${IKONE.stiklirano}<span class="za-citace">${esc(t("odgledano"))}</span></span>` : ""
        }</h3>
        <p>${esc(datum(e.objavljeno))}</p>
      </div>
    </a>
  </li>`;
}

function plejerHtml(s, e, indeks) {
  const prethodna = s.epizode[indeks - 1];
  const sledeca = s.epizode[indeks + 1];
  const youtube = `https://www.youtube.com/watch?v=${encodeURIComponent(e.id)}`;
  const detalji = [
    datum(e.objavljeno),
    trajanje(e.trajanje),
    e.titlovi ? t("titlovi") : "",
    e.ograniceno ? t("ograniceno") : "",
  ].filter(Boolean);
  return `<section class="plejer" aria-labelledby="plejer-naslov">
    <div class="plejer-okvir">
      <div id="yt-plejer"></div>
      <div class="odbrojavanje" hidden>
        <p data-odbrojavanje-tekst></p>
        <div class="dugmad">
          ${sledeca ? `<a class="dugme" href="${putanjaSerije(s.id, sledeca.id)}">${IKONE.pusti}${esc(t("sledeca"))}</a>` : ""}
          <button class="dugme sporedno" type="button" data-otkazi>${esc(t("otkazi"))}</button>
        </div>
      </div>
    </div>
    <div class="plejer-info">
      <div>
        <h2 id="plejer-naslov" tabindex="-1">${esc(t("epizoda", { n: e.epizoda }))}</h2>
        <p class="naslov-videa">${esc(e.naslov)}</p>
        <p class="tiho">${detalji.map(esc).join(" · ")}</p>
      </div>
      <div class="dugmad">
        ${prethodna ? `<a class="dugme sporedno" href="${putanjaSerije(s.id, prethodna.id)}">${IKONE.levo}${esc(t("prethodna"))}</a>` : ""}
        ${sledeca ? `<a class="dugme sporedno" href="${putanjaSerije(s.id, sledeca.id)}">${esc(t("sledeca"))}${IKONE.desno}</a>` : ""}
        <a class="dugme sporedno" href="${esc(youtube)}" target="_blank" rel="noopener">${IKONE.spolja}${esc(t("naYoutubeu"))}</a>
      </div>
    </div>
  </section>`;
}

function povezSeriju(s) {
  const dugmeListe = glavni.querySelector("[data-lista]");
  dugmeListe.addEventListener("click", () => {
    const sada = skladiste.prebaciListu(s.id);
    dugmeListe.setAttribute("aria-pressed", String(sada));
    dugmeListe.innerHTML = `${sada ? IKONE.stiklirano : IKONE.dodaj}${esc(sada ? t("uListi") : t("mojaLista"))}`;
  });

  glavni.querySelector("[data-podeli]").addEventListener("click", async () => {
    const podaci = { title: `${s.ime} | Bölüm`, url: location.href };
    if (navigator.share) {
      try {
        await navigator.share(podaci);
      } catch {
        // Korisnik je odustao.
      }
    } else {
      await kopiraj(podaci.url);
    }
  });

  for (const dugme of glavni.querySelectorAll("[data-sezona]")) {
    dugme.addEventListener("click", () => {
      stanje.sezona = Number(dugme.dataset.sezona);
      const zapisi = skladiste.napredakSerije(s.id);
      const izabranaId = ruta().epizoda;
      glavni.querySelector(".epizode").innerHTML = s.epizode
        .filter((e) => e.sezona === stanje.sezona)
        .map((e) => epizodaHtml(s, e, zapisi.get(e.id), e.id === izabranaId))
        .join("");
      for (const d of glavni.querySelectorAll("[data-sezona]")) {
        d.setAttribute("aria-pressed", String(Number(d.dataset.sezona) === stanje.sezona));
      }
      primeniNapredak();
    });
  }
}

async function pokreniPlejer(broj, s, e, indeks) {
  const mesto = glavni.querySelector("#yt-plejer");
  const zapis = skladiste.napredak(e.id);
  // Nastavak malo pre mesta gde se stalo; završene epizode kreću od početka.
  const pocetak = zapis && !zapis.kraj && zapis.t > 30 && zapis.t < zapis.d - 60 ? zapis.t - 5 : 0;
  const sledeca = s.epizode[indeks + 1];

  const plejer = await napraviPlejer(mesto, {
    videoId: e.id,
    naslov: `${s.ime} · ${t("epizoda", { n: e.epizoda })}`,
    pocetak,
    naNapretku: (vreme, ukupno) =>
      skladiste.sacuvajNapredak(e.id, {
        serija: s.id,
        ime: s.ime,
        epizoda: e.epizoda,
        slika: e.slika,
        t: vreme,
        d: ukupno,
      }),
    naKraju: () => {
      skladiste.sacuvajNapredak(e.id, {
        serija: s.id,
        ime: s.ime,
        epizoda: e.epizoda,
        slika: e.slika,
        t: e.trajanje || 1,
        d: e.trajanje || 1,
        kraj: true,
      });
      if (sledeca) pokreniOdbrojavanje(s, sledeca);
    },
    naGresci: () => {
      const okvir = glavni.querySelector(".plejer-okvir");
      if (!okvir || okvir.querySelector(".plejer-greska")) return;
      okvir.insertAdjacentHTML(
        "beforeend",
        `<p class="plejer-greska">${esc(t("plejerGreska"))} <a href="https://www.youtube.com/watch?v=${encodeURIComponent(e.id)}" target="_blank" rel="noopener">${esc(t("naYoutubeu"))}</a></p>`,
      );
    },
  });

  if (jeZastareo(broj)) plejer.unisti();
  else stanje.plejer = plejer;
}

function pokreniOdbrojavanje(s, sledeca) {
  const okno = glavni.querySelector(".odbrojavanje");
  if (!okno) return;
  const tekst = okno.querySelector("[data-odbrojavanje-tekst]");
  let preostalo = AUTO_SLEDECA_S;
  const osvezi = () => (tekst.textContent = t("sledecaZa", { s: preostalo }));
  osvezi();
  okno.hidden = false;
  okno.querySelector("a")?.focus();

  clearInterval(stanje.odbrojavanje);
  stanje.odbrojavanje = setInterval(() => {
    preostalo--;
    if (preostalo > 0) return osvezi();
    clearInterval(stanje.odbrojavanje);
    idi(putanjaSerije(s.id, sledeca.id));
  }, 1000);

  okno.querySelector("[data-otkazi]").addEventListener("click", () => {
    clearInterval(stanje.odbrojavanje);
    okno.hidden = true;
  });
}

// ── Pokretanje ──────────────────────────────────────────────────────

document.documentElement.lang = jezik();
nacrtajZaglavlje();
nacrtajPodnozje();
prikazi();
