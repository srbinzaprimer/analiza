// Pretraga preko cele strane: rezultati dok se kuca, strelice i Enter.

import { ocenaHtml, okvir } from "./kartice.js";
import { IKONE, esc, primeniStilove, putanjaSerije, zaPretragu } from "./pomocne.js";
import { jezik, t } from "./prevodi.js";

const NAJVISE_REZULTATA = 12;
let dijalog = null;

/**
 * @param {{ katalog: () => Promise<any>, idi: (href: string) => void }} k
 */
export function otvoriPretragu(k) {
  dijalog ??= napravi(k);
  const polje = dijalog.querySelector("input");
  polje.placeholder = t("pretraga");
  dijalog.querySelector(".za-citace").textContent = t("pretraga");
  dijalog.querySelector("[data-zatvori]").setAttribute("aria-label", t("zatvori"));
  dijalog.setAttribute("aria-label", t("pretraga"));
  dijalog.showModal();
  polje.select();
  prikaziRezultate(k, polje.value);
}

function napravi(k) {
  const d = document.createElement("dialog");
  d.className = "pretraga-dijalog";
  d.innerHTML = `<div class="pretraga-polje">
      ${IKONE.trazi}
      <label class="za-citace" for="pretraga-unos"></label>
      <input id="pretraga-unos" type="search" autocomplete="off" enterkeyhint="go">
      <button type="button" class="ikonica-dugme" data-zatvori>${IKONE.zatvori}</button>
    </div>
    <div class="pretraga-rezultati" data-rezultati></div>`;
  document.body.append(d);

  const polje = d.querySelector("input");
  let tajmer;
  polje.addEventListener("input", () => {
    clearTimeout(tajmer);
    tajmer = setTimeout(() => prikaziRezultate(k, polje.value), 80);
  });
  d.querySelector("[data-zatvori]").addEventListener("click", () => d.close());
  // Klik na pozadinu (van sadržaja) zatvara.
  d.addEventListener("click", (dogadjaj) => {
    if (dogadjaj.target === d) d.close();
  });
  // Izbor rezultata: ruter preuzima link, a dijalog se zatvara.
  d.addEventListener("click", (dogadjaj) => {
    if (dogadjaj.target.closest("a[href]")) d.close();
  });

  d.addEventListener("keydown", (dogadjaj) => {
    // Polje za pretragu bi prvim Escape-om samo obrisalo tekst; ovde odmah zatvara.
    if (dogadjaj.key === "Escape") {
      dogadjaj.preventDefault();
      d.close();
      return;
    }
    if (dogadjaj.key === "Enter" && document.activeElement === polje) {
      // Rezultati se osvežavaju sa malim zakašnjenjem; Enter mora da otvori
      // prvi rezultat za ono što piše u polju, a ne za prethodni upit.
      dogadjaj.preventDefault();
      clearTimeout(tajmer);
      prikaziRezultate(k, polje.value).then(() => {
        const prvi = d.querySelector("[data-rezultati] a");
        if (!prvi || !d.open) return;
        d.close();
        k.idi(prvi.getAttribute("href"));
      });
      return;
    }
    const linkovi = [...d.querySelectorAll("[data-rezultati] a")];
    if (!linkovi.length) return;
    const trenutni = linkovi.indexOf(document.activeElement);
    if (dogadjaj.key === "ArrowDown") {
      dogadjaj.preventDefault();
      linkovi[Math.min(linkovi.length - 1, trenutni + 1)].focus();
    } else if (dogadjaj.key === "ArrowUp") {
      dogadjaj.preventDefault();
      if (trenutni <= 0) polje.focus();
      else linkovi[trenutni - 1].focus();
    }
  });
  return d;
}

async function prikaziRezultate(k, tekst) {
  const mesto = dijalog.querySelector("[data-rezultati]");
  const upit = zaPretragu(tekst.trim());
  if (!upit) {
    mesto.innerHTML = `<p class="tiho pretraga-savet">${esc(t("pretragaPrazno"))}</p>`;
    return;
  }
  let podaci;
  try {
    podaci = await k.katalog();
  } catch {
    mesto.innerHTML = `<p class="tiho pretraga-savet">${esc(t("greskaUcitavanja"))}</p>`;
    return;
  }
  // Odgovor na stariji upit ne sme da prepiše noviji.
  if (zaPretragu(dijalog.querySelector("input").value.trim()) !== upit) return;

  const zanrovi = podaci.zanrovi?.[jezik()] ?? podaci.zanrovi?.en ?? {};
  const pogodak = (s) => {
    const ime = zaPretragu(s.ime);
    if (ime.startsWith(upit)) return 3;
    if (ime.includes(upit)) return 2;
    const ostalo = [s.kanal.ime, ...Object.values(s.nazivi ?? {}), ...(s.zanrovi ?? []).map((z) => zanrovi[z])];
    return ostalo.some((x) => x && zaPretragu(x).includes(upit)) ? 1 : 0;
  };
  const rezultati = podaci.serije
    .map((s) => ({ s, ocena: pogodak(s) }))
    .filter((x) => x.ocena > 0)
    .sort((a, b) => b.ocena - a.ocena || b.s.trend - a.s.trend)
    .slice(0, NAJVISE_REZULTATA)
    .map((x) => x.s);

  mesto.innerHTML = rezultati.length
    ? `<ul>${rezultati
        .map(
          (s) => `<li><a href="${putanjaSerije(s.id)}">
            ${okvir(s.ime, s.poster ?? s.slika, { oblik: s.poster ? "poster" : "sirok" })}
            <span class="rezultat-tekst">
              <strong>${esc(s.ime)}</strong>
              <span>${[ocenaHtml(s.ocena), esc([s.godina, s.kanal.ime, t("brojEpizoda", { n: s.brojEpizoda })].filter(Boolean).join(" · "))].join(" ")}</span>
            </span>
          </a></li>`,
        )
        .join("")}</ul>`
    : `<p class="tiho pretraga-savet">${esc(t("nemaRezultata", { q: tekst.trim() }))}</p>`;
  primeniStilove(mesto);
}
