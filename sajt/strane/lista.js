// Moja lista: sačuvane serije.

import { posterKartica } from "../kartice.js";
import { esc, primeniStilove } from "../pomocne.js";
import { t } from "../prevodi.js";
import * as skladiste from "../skladiste.js";

export async function prikaziListu(k, broj) {
  document.title = `${t("mojaLista")} | Bölüm`;
  let podaci;
  try {
    podaci = await k.katalog();
  } catch {
    if (!k.jeZastareo(broj)) k.greskaUcitavanja();
    return;
  }
  if (k.jeZastareo(broj)) return;

  const poId = new Map(podaci.serije.map((s) => [s.id, s]));
  const moje = skladiste.lista().map((id) => poId.get(id)).filter(Boolean);
  k.glavni.innerHTML = `<div class="lista">
    <header class="strana-zaglavlje">
      <h1 tabindex="-1">${esc(t("mojaLista"))}</h1>
      ${moje.length ? `<p class="tiho">${esc(t("brojSerija", { n: moje.length }))}</p>` : ""}
    </header>
    ${
      moje.length
        ? `<div class="mreza-postera">${moje.map((s) => posterKartica(s)).join("")}</div>`
        : `<div class="poruka-kartica"><p>${esc(t("praznaLista"))}</p><p><a class="dugme zlatno" href="istrazi/">${esc(t("istrazi"))}</a></p></div>`
    }
  </div>`;
  primeniStilove(k.glavni);
}
