// Istraži: sve serije sa filterima (žanr, kanal, titlovi) i redosledom.

import { posterKartica } from "../kartice.js";
import { IKONE, esc, imeJezika, primeniStilove, putanjaSerije, zaPretragu } from "../pomocne.js";
import { jezik, t } from "../prevodi.js";

const REDOSLEDI = {
  trend: (a, b) => b.trend - a.trend || b.pregleda - a.pregleda,
  novo: (a, b) => String(b.poslednja.objavljeno).localeCompare(String(a.poslednja.objavljeno)),
  abecedno: (a, b) => a.ime.localeCompare(b.ime, "tr"),
  ocena: (a, b) => (b.ocena ?? -1) - (a.ocena ?? -1) || b.trend - a.trend,
};
const NAZIVI_REDOSLEDA = { trend: "uTrendu", novo: "najnovije", abecedno: "abecedno", ocena: "najboljeOcenjene" };

export async function prikaziIstrazi(k, broj) {
  document.title = `${t("istrazi")} | Bölüm`;
  let podaci;
  try {
    podaci = await k.katalog();
  } catch {
    if (!k.jeZastareo(broj)) k.greskaUcitavanja();
    return;
  }
  if (k.jeZastareo(broj)) return;

  const { serije } = podaci;
  const imenaZanrova = podaci.zanrovi?.[jezik()] ?? podaci.zanrovi?.en ?? {};
  const parametri = new URLSearchParams(location.search);
  const filter = {
    q: parametri.get("q") ?? "",
    zanr: parametri.get("zanr") ?? "",
    kanal: parametri.get("kanal") ?? "",
    titlovi: parametri.get("titlovi") ?? "",
    sort: REDOSLEDI[parametri.get("sort")] ? parametri.get("sort") : "trend",
  };

  const zanrovi = [...new Set(serije.flatMap((s) => s.zanrovi ?? []))]
    .filter((z) => imenaZanrova[z])
    .sort((a, b) => imenaZanrova[a].localeCompare(imenaZanrova[b], jezik()));
  const kanali = [...new Map(serije.map((s) => [s.kanal.handle, s.kanal.ime])).entries()];
  const jezici = [...new Set(serije.flatMap((s) => s.jeziciTitlova ?? []))].sort();

  const izbor = (ime, oznaka, opcije) => `<label class="izbor">
      <span>${esc(oznaka)}</span>
      <select name="${ime}">
        <option value="">${esc(t("svejedno"))}</option>
        ${opcije
          .map(([vrednost, naziv]) => `<option value="${esc(vrednost)}"${String(filter[ime]) === String(vrednost) ? " selected" : ""}>${esc(naziv)}</option>`)
          .join("")}
      </select>
    </label>`;

  k.glavni.innerHTML = `<div class="istrazi">
    <header class="strana-zaglavlje">
      <h1 tabindex="-1">${esc(t("istrazi"))}</h1>
      <p class="tiho" data-broj></p>
    </header>
    <form class="filteri-traka" role="search">
      <label class="polje-pretrage">
        ${IKONE.trazi}
        <span class="za-citace">${esc(t("pretraga"))}</span>
        <input type="search" name="q" value="${esc(filter.q)}" placeholder="${esc(t("pretraga"))}" autocomplete="off">
      </label>
      ${zanrovi.length ? izbor("zanr", t("zanr"), zanrovi.map((z) => [z, imenaZanrova[z]])) : ""}
      ${kanali.length > 1 ? izbor("kanal", t("kanal"), kanali) : ""}
      ${jezici.length ? izbor("titlovi", t("titlovi"), jezici.map((j) => [j, imeJezika(j)])) : ""}
      <label class="izbor">
        <span>${esc(t("sortiranje"))}</span>
        <select name="sort">${Object.entries(NAZIVI_REDOSLEDA)
          .map(([v, kljuc]) => `<option value="${v}"${filter.sort === v ? " selected" : ""}>${esc(t(kljuc))}</option>`)
          .join("")}</select>
      </label>
      <button type="button" class="dugme staklo" data-iznenadi>${IKONE.kocka}${esc(t("iznenadiMe"))}</button>
    </form>
    <div class="mreza-postera" data-mreza></div>
  </div>`;

  const forma = k.glavni.querySelector(".filteri-traka");
  const mreza = k.glavni.querySelector("[data-mreza]");
  const brojac = k.glavni.querySelector("[data-broj]");
  let pronadjene = [];

  const osvezi = () => {
    const upit = zaPretragu(filter.q.trim());
    pronadjene = serije
      .filter(
        (s) =>
          (!filter.zanr || s.zanrovi?.includes(Number(filter.zanr))) &&
          (!filter.kanal || s.kanal.handle === filter.kanal) &&
          (!filter.titlovi || s.jeziciTitlova?.includes(filter.titlovi)) &&
          (!upit ||
            [s.ime, s.kanal.ime, ...Object.values(s.nazivi ?? {})].some((x) => x && zaPretragu(x).includes(upit))),
      )
      .sort(REDOSLEDI[filter.sort]);
    brojac.textContent = t("brojSerija", { n: pronadjene.length });
    mreza.innerHTML = pronadjene.length
      ? pronadjene.map((s) => posterKartica(s)).join("")
      : `<p class="tiho prazno-tekst">${esc(filter.q.trim() ? t("nemaRezultata", { q: filter.q.trim() }) : t("nemaPoFilteru"))}</p>`;
    primeniStilove(mreza);

    const nove = new URLSearchParams();
    for (const [ime, vrednost] of Object.entries(filter)) {
      if (vrednost && !(ime === "sort" && vrednost === "trend")) nove.set(ime, vrednost);
    }
    const upitAdrese = nove.toString();
    history.replaceState(null, "", location.pathname + (upitAdrese ? `?${upitAdrese}` : ""));
  };

  let tajmer;
  forma.addEventListener("input", (d) => {
    if (!(d.target.name in filter)) return;
    filter[d.target.name] = d.target.value;
    clearTimeout(tajmer);
    tajmer = setTimeout(osvezi, d.target.name === "q" ? 150 : 0);
  });
  forma.addEventListener("submit", (d) => d.preventDefault());
  forma.querySelector("[data-iznenadi]").addEventListener("click", () => {
    const izbor = pronadjene.length ? pronadjene : serije;
    k.idi(putanjaSerije(izbor[Math.floor(Math.random() * izbor.length)].id));
  });
  osvezi();
}
