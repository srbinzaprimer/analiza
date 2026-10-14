// Kartice i redovi koje koriste sve strane.

import { relativno, t } from "./prevodi.js";
import { IKONE, bojeZaIme, esc, kratakBroj, putanjaSerije } from "./pomocne.js";

const NOVO_MS = 3 * 86_400_000;

/**
 * Okvir slike: ispod je uvek umetnički okvir sa imenom serije, a preko njega
 * slika. Kad slika ne postoji ili ne može da se učita, ostaje okvir.
 */
export function okvir(ime, src, { oblik = "poster", dodatak = "", prioritet = false } = {}) {
  const [a, b] = bojeZaIme(ime);
  return `<div class="okvir okvir-${oblik}">
    <div class="umetnost" data-boje="${a},${b}" aria-hidden="true"><span>${esc(ime)}</span></div>
    ${
      src
        ? `<img src="${esc(src)}" alt="" loading="${prioritet ? "eager" : "lazy"}" decoding="async"${
            prioritet ? ' fetchpriority="high"' : ""
          }>`
        : ""
    }
    ${dodatak}
  </div>`;
}

export function ocenaHtml(ocena) {
  if (!ocena) return "";
  return `<span class="ocena" title="${esc(t("ocena", { n: ocena }))}">${IKONE.zvezda}<span>${esc(
    ocena.toFixed(1),
  )}</span></span>`;
}

export function jeziciHtml(jezici, { najvise = 4 } = {}) {
  if (!jezici?.length) return "";
  const prikazani = jezici.slice(0, najvise).map((j) => j.toUpperCase());
  const vise = jezici.length > najvise ? ` +${jezici.length - najvise}` : "";
  return `<span class="jezici" title="${esc(t("titloviNa", { jezici: jezici.join(", ").toUpperCase() }))}">${
    IKONE.titlovi
  }${esc(prikazani.join(" ") + vise)}</span>`;
}

export function trakaNapretka(udeo) {
  return udeo > 0 ? `<div class="napredak" data-udeo="${esc(udeo)}"><span></span></div>` : "";
}

/** Poster kartica (2:3) sa podacima ispod; `rang` pravi Top 10 karticu. */
export function posterKartica(s, { rang = null } = {}) {
  const podaci = [s.godina, t("brojEpizoda", { n: s.brojEpizoda })].filter(Boolean).join(" · ");
  const kartica = `<a class="kartica kartica-poster" href="${putanjaSerije(s.id)}">
    ${okvir(s.ime, s.poster ?? s.slika, {
      dodatak: `<div class="okvir-oznake">${ocenaHtml(s.ocena)}${jeziciHtml(s.jeziciTitlova, { najvise: 2 })}</div>
        <span class="okvir-pusti" aria-hidden="true">${IKONE.pusti}</span>`,
    })}
    <div class="kartica-info">
      <h3>${esc(s.ime)}</h3>
      <p>${esc(podaci)}</p>
    </div>
  </a>`;
  if (rang === null) return kartica;
  return `<div class="top-stavka"><span class="top-broj" aria-hidden="true">${rang}</span>${kartica}</div>`;
}

/** Široka kartica: nova epizoda ili nastavak gledanja. */
export function sirokaKartica({ ime, href, slika, naslov, podnaslov, udeo = 0, novo = false }) {
  return `<a class="kartica kartica-siroka" href="${href}">
    ${okvir(ime, slika, {
      oblik: "sirok",
      dodatak: `${novo ? `<span class="oznaka-novo">${esc(t("novo"))}</span>` : ""}
        <span class="okvir-pusti" aria-hidden="true">${IKONE.pusti}</span>${trakaNapretka(udeo)}`,
    })}
    <div class="kartica-info">
      <h3>${esc(naslov)}</h3>
      <p>${esc(podnaslov)}</p>
    </div>
  </a>`;
}

export function karticaNoveEpizode(s) {
  const objavljeno = Date.parse(s.poslednja.objavljeno);
  return sirokaKartica({
    ime: s.ime,
    href: putanjaSerije(s.id, s.poslednja.id),
    slika: s.slika,
    naslov: s.ime,
    podnaslov: `${t("epizoda", { n: s.poslednja.epizoda })} · ${relativno(s.poslednja.objavljeno)}`,
    novo: Date.now() - objavljeno < NOVO_MS,
  });
}

/** Horizontalni red kartica sa strelicama za listanje na računaru. */
export function red({ naslov, kartice, vrsta = "poster", podnaslov = "" }) {
  if (kartice.length === 0) return "";
  return `<section class="red red-${vrsta}">
    <div class="red-zaglavlje">
      <h2>${esc(naslov)}</h2>
      ${podnaslov ? `<p class="tiho">${esc(podnaslov)}</p>` : ""}
      <div class="red-strelice">
        <button type="button" class="strelica" data-skrol="-1" aria-label="${esc(t("prethodni"))}">${IKONE.levo}</button>
        <button type="button" class="strelica" data-skrol="1" aria-label="${esc(t("sledeci"))}">${IKONE.desno}</button>
      </div>
    </div>
    <div class="red-kartice">${kartice.join("")}</div>
  </section>`;
}

/** Strelice redova listaju za širinu vidljivog dela. */
export function povezRedove(koren) {
  for (const dugme of koren.querySelectorAll("[data-skrol]")) {
    dugme.addEventListener("click", () => {
      const traka = dugme.closest(".red").querySelector(".red-kartice");
      traka.scrollBy({ left: Number(dugme.dataset.skrol) * traka.clientWidth * 0.9, behavior: "smooth" });
    });
  }
}

export function pregledaHtml(pregleda) {
  return pregleda ? kratakBroj(pregleda) : "";
}
