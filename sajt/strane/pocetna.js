// Početna: naslovni karusel, nastavak gledanja, Top 10, nove epizode, žanrovi.

import {
  karticaNoveEpizode,
  jeziciHtml,
  ocenaHtml,
  okvir,
  posterKartica,
  povezRedove,
  red,
  sirokaKartica,
} from "../kartice.js";
import { IKONE, esc, imeJezika, opisSerije, prevedenNaziv, primeniStilove, putanjaSerije } from "../pomocne.js";
import { jezik, relativno, t } from "../prevodi.js";
import * as skladiste from "../skladiste.js";

const NAJVISE_U_REDU = 16;
const PROMENA_SLAJDA_MS = 8_000;
const MINIMALNO_U_ZANRU = 3;

export async function prikaziPocetnu(k, broj) {
  document.title = `Bölüm — ${t("slogan")}`;
  if (!k.glavni.querySelector(".pocetna")) k.glavni.innerHTML = '<div class="ucitavanje" aria-busy="true"></div>';

  let podaci;
  try {
    podaci = await k.katalog();
  } catch {
    if (!k.jeZastareo(broj)) k.greskaUcitavanja();
    return;
  }
  if (k.jeZastareo(broj)) return;

  const { serije } = podaci;
  if (serije.length === 0) {
    k.glavni.innerHTML = `<div class="pocetna prazna">
      <div class="prazno-sadrzaj">
        <img src="ikonica.svg" alt="" width="72" height="72">
        <h1 tabindex="-1">${esc(t("slogan"))}</h1>
        <p>${esc(t("podslogan"))}</p>
        <div class="poruka-kartica"><h2>${esc(t("prazanKatalogNaslov"))}</h2><p>${esc(t("prazanKatalogTekst"))}</p></div>
      </div>
    </div>`;
    return;
  }

  const poId = new Map(serije.map((s) => [s.id, s]));
  const istaknute = (podaci.istaknute ?? [])
    .map((x) => ({ ...x, s: poId.get(x.id) }))
    .filter((x) => x.s);
  if (istaknute.length === 0) istaknute.push({ s: serije[0], pozadina: serije[0].slika, opisi: null });

  const sekcije = [
    karusel(istaknute, serije),
    redNastavka(poId),
    redTop(serije),
    red({ naslov: t("noveEpizode"), kartice: serije.slice(0, NAJVISE_U_REDU).map(karticaNoveEpizode), vrsta: "siroki" }),
    ...redoviZanrova(serije, podaci.zanrovi),
    redTitlova(serije),
  ];

  k.glavni.innerHTML = `<div class="pocetna">
    <h1 class="za-citace" tabindex="-1">Bölüm — ${esc(t("slogan"))}</h1>
    ${sekcije.join("")}
  </div>`;
  primeniStilove(k.glavni);
  povezRedove(k.glavni);
  pokreniKarusel(k);
}

// ── Karusel ─────────────────────────────────────────────────────────

function karusel(istaknute, serije) {
  const mesto = (s) => [...serije].sort((a, b) => b.trend - a.trend).indexOf(s) + 1;
  const slajdovi = istaknute.map(({ s, pozadina, opisi }, i) => {
    const rang = s.trend > 0 ? mesto(s) : 0;
    const nadnaslov = rang && rang <= 10 ? t("uTrenduBroj", { n: rang }) : t("novaEpizoda");
    const opis = opisi?.[jezik()] ?? opisi?.en ?? opisSerije(s);
    const prevod = prevedenNaziv(s);
    const meta = [
      ocenaHtml(s.ocena),
      s.godina ? esc(s.godina) : "",
      esc(t("brojEpizoda", { n: s.brojEpizoda })),
      jeziciHtml(s.jeziciTitlova),
    ].filter(Boolean);
    // Na telefonu se umesto široke pozadine prikazuje poster (uspravan ekran).
    const klase = ["slajd", i === 0 ? "aktivan" : "", s.poster ? "sa-posterom" : ""].filter(Boolean).join(" ");
    return `<article class="${klase}" aria-roledescription="slide" aria-label="${esc(
      t("slajd", { n: i + 1 }),
    )}"${i === 0 ? "" : " inert"}>
      <div class="slajd-pozadina">${okvir(s.ime, pozadina ?? s.slika, { oblik: "pozadina", prioritet: i === 0 })}</div>
      <div class="slajd-sadrzaj">
        ${s.poster ? `<div class="slajd-poster" aria-hidden="true">${okvir(s.ime, s.poster)}</div>` : ""}
        <p class="nadnaslov">${esc(nadnaslov)} · ${esc(relativno(s.poslednja.objavljeno))}</p>
        <h2 class="slajd-naslov">${esc(s.ime)}</h2>
        ${prevod ? `<p class="prevod-naziva">${esc(prevod)}</p>` : ""}
        <p class="meta">${meta.join('<span class="tacka" aria-hidden="true"></span>')}</p>
        ${opis ? `<p class="slajd-opis">${esc(opis)}</p>` : ""}
        <div class="dugmad">
          <a class="dugme zlatno" href="${putanjaSerije(s.id, s.poslednja.id)}">${IKONE.pusti}${esc(
            t("gledajEpizodu", { n: s.poslednja.epizoda }),
          )}</a>
          <a class="dugme staklo dugme-detalji" href="${putanjaSerije(s.id)}">${IKONE.info}<span>${esc(t("detalji"))}</span></a>
        </div>
      </div>
    </article>`;
  });

  const tacke =
    istaknute.length > 1
      ? `<div class="karusel-tacke" role="group" aria-label="Bölüm">${istaknute
          .map(
            (_, i) =>
              `<button type="button" data-slajd="${i}" aria-label="${esc(t("slajd", { n: i + 1 }))}" aria-pressed="${i === 0}"><span></span></button>`,
          )
          .join("")}</div>`
      : "";

  return `<section class="karusel" aria-roledescription="carousel" aria-label="${esc(t("noveEpizode"))}">
    ${slajdovi.join("")}
    ${tacke}
  </section>`;
}

function pokreniKarusel(k) {
  const koren = k.glavni.querySelector(".karusel");
  const slajdovi = [...koren.querySelectorAll(".slajd")];
  const tacke = [...koren.querySelectorAll("[data-slajd]")];
  if (slajdovi.length < 2) return;

  let trenutni = 0;
  const prikazi = (i) => {
    trenutni = (i + slajdovi.length) % slajdovi.length;
    slajdovi.forEach((slajd, j) => {
      slajd.classList.toggle("aktivan", j === trenutni);
      slajd.inert = j !== trenutni;
    });
    tacke.forEach((tacka, j) => tacka.setAttribute("aria-pressed", String(j === trenutni)));
  };
  tacke.forEach((tacka, i) => tacka.addEventListener("click", () => prikazi(i)));

  // Bez automatske promene za one koji su isključili animacije; pauza dok
  // je miš ili fokus na karuselu.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let pauza = false;
  koren.addEventListener("pointerenter", () => (pauza = true));
  koren.addEventListener("pointerleave", () => (pauza = false));
  koren.addEventListener("focusin", () => (pauza = true));
  koren.addEventListener("focusout", () => (pauza = false));
  const tajmer = setInterval(() => {
    if (!pauza && !document.hidden) prikazi(trenutni + 1);
  }, PROMENA_SLAJDA_MS);
  k.pocisti(() => clearInterval(tajmer));
}

// ── Redovi ──────────────────────────────────────────────────────────

function redNastavka(poId) {
  const kartice = skladiste
    .nastaviGledanje(NAJVISE_U_REDU)
    .filter((z) => poId.has(z.serija))
    .map((z) =>
      sirokaKartica({
        ime: z.ime,
        href: putanjaSerije(z.serija, z.videoId),
        slika: z.slika ?? poId.get(z.serija).slika,
        naslov: z.ime,
        podnaslov: t("nastaviEpizodu", { n: z.epizoda }),
        udeo: Math.min(1, z.t / z.d),
      }),
    );
  return red({ naslov: t("nastaviGledanje"), kartice, vrsta: "siroki" });
}

function redTop(serije) {
  const saTrendom = serije.filter((s) => s.trend > 0);
  const poTrendu = saTrendom.length >= 3;
  const lista = (poTrendu ? saTrendom : serije.filter((s) => s.pregleda > 0))
    .sort((a, b) => (poTrendu ? b.trend - a.trend : b.pregleda - a.pregleda))
    .slice(0, 10);
  if (lista.length < 3) return "";
  return red({
    naslov: poTrendu ? t("topDanas") : t("najgledanije"),
    kartice: lista.map((s, i) => posterKartica(s, { rang: i + 1 })),
    vrsta: "top",
  });
}

function redoviZanrova(serije, zanrovi) {
  const imena = zanrovi?.[jezik()] ?? zanrovi?.en ?? {};
  const broj = new Map();
  for (const s of serije) for (const z of s.zanrovi ?? []) broj.set(z, (broj.get(z) ?? 0) + 1);
  return [...broj.entries()]
    .filter(([z, n]) => n >= MINIMALNO_U_ZANRU && imena[z])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([z]) =>
      red({
        naslov: imena[z],
        kartice: serije
          .filter((s) => s.zanrovi?.includes(z))
          .sort((a, b) => b.trend - a.trend || b.pregleda - a.pregleda)
          .slice(0, NAJVISE_U_REDU)
          .map((s) => posterKartica(s)),
      }),
    );
}

function redTitlova(serije) {
  for (const kod of [jezik(), "en"]) {
    const sa = serije.filter((s) => s.jeziciTitlova?.includes(kod));
    if (sa.length >= MINIMALNO_U_ZANRU) {
      return red({
        naslov: t("saTitlovimaNa", { jezik: imeJezika(kod) }),
        kartice: sa.slice(0, NAJVISE_U_REDU).map((s) => posterKartica(s)),
      });
    }
  }
  return "";
}
