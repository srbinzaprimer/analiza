// Stranica serije: zaglavlje sa pozadinom, plejer, epizode, glumci i gde se
// serija još legalno gleda.

import { jeziciHtml, ocenaHtml, okvir, trakaNapretka } from "../kartice.js";
import { napraviPlejer } from "../plejer.js";
import {
  IKONE,
  adresa,
  esc,
  imeJezika,
  imeZemlje,
  kratakBroj,
  opisSerije,
  prevedenNaziv,
  primeniStilove,
  putanjaSerije,
  youtubeAdresa,
} from "../pomocne.js";
import { datum, jezik, t, trajanje } from "../prevodi.js";
import * as skladiste from "../skladiste.js";

const AUTO_SLEDECA_S = 8;
// Turske serije imaju i po 150 epizoda u sezoni, pa se duge sezone dele na delove.
const EPIZODA_PO_DELU = 24;
const DELI_POSLE = 30;
const VRSTE_PONUDE = ["besplatno", "uzReklame", "pretplata", "najam", "kupovina"];
const ZEMLJA_PO_JEZIKU = { sr: "RS", tr: "TR", es: "ES", en: "US" };

/** Šta da se pusti: započeta epizoda, ili prva posle poslednje odgledane. */
export function preporuci(s, zapisi) {
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

export async function prikaziSeriju(k, broj, r, prethodna) {
  const istaSerija = prethodna?.strana === "serija" && prethodna.id === r.id;
  if (!istaSerija) {
    k.glavni.innerHTML = '<div class="ucitavanje ucitavanje-serija" aria-busy="true"></div>';
    k.stanje.sezona = null;
    k.stanje.deo = null;
  }

  let s;
  try {
    s = await k.serija(r.id);
  } catch {
    if (!k.jeZastareo(broj)) k.greskaUcitavanja();
    return;
  }
  if (k.jeZastareo(broj)) return;
  if (!s) {
    document.title = `${t("nijePronadjena")} | Bölüm`;
    k.glavni.innerHTML = k.poruka(t("nijePronadjena"));
    k.zavrsiPrikaz(prethodna, r);
    return;
  }
  // Imena žanrova i platformi su u zajedničkom katalogu; bez njega strana i dalje radi.
  const katalog = await k.katalog().catch(() => null);
  if (k.jeZastareo(broj)) return;

  const izabrana = r.epizoda ? s.epizode.find((e) => e.id === r.epizoda) : null;
  if (r.epizoda && !izabrana) {
    // Epizoda je u međuvremenu uklonjena: ostajemo na stranici serije.
    history.replaceState(null, "", adresa(putanjaSerije(s.id)));
  }
  const zapisi = skladiste.napredakSerije(s.id);
  const { epizoda: preporucena, nastavak } = preporuci(s, zapisi);
  const indeks = izabrana ? s.epizode.indexOf(izabrana) : -1;
  if (izabrana) {
    k.stanje.sezona = izabrana.sezona;
    k.stanje.deo = null;
  } else {
    k.stanje.sezona ??= preporucena.sezona;
  }
  const cilj = izabrana ?? preporucena;

  document.title = izabrana
    ? `${s.ime} · ${t("epizoda", { n: izabrana.epizoda })} | Bölüm`
    : `${s.ime} | Bölüm`;

  k.glavni.innerHTML = `<article class="serija${izabrana ? " gleda" : ""}">
    ${izabrana ? plejerHtml(s, izabrana, indeks, zapisi) : ""}
    ${zaglavljeHtml(s, katalog, { izabrana, preporucena, nastavak })}
    <section class="sekcija" aria-labelledby="epizode-naslov">
      <div class="sekcija-zaglavlje">
        <h2 id="epizode-naslov">${esc(t("epizode"))}</h2>
        ${sezoneHtml(s, k.stanje.sezona)}
        <label class="izbor izbor-mali">
          <span class="za-citace">${esc(t("redosled"))}</span>
          <select data-redosled>
            <option value="rastuce"${k.stanje.redosled !== "opadajuce" ? " selected" : ""}>${esc(t("odPrve"))}</option>
            <option value="opadajuce"${k.stanje.redosled === "opadajuce" ? " selected" : ""}>${esc(t("odNajnovije"))}</option>
          </select>
        </label>
      </div>
      <div class="cipovi delovi" role="group" aria-label="${esc(t("epizode"))}" data-delovi hidden></div>
      <ol class="epizode" data-epizode></ol>
    </section>
    ${glumciHtml(s)}
    ${gledanjeHtml(s, katalog)}
  </article>`;

  nacrtajEpizode(k, s, izabrana?.id ?? null, cilj.id);
  primeniStilove(k.glavni);
  povezi(k, s, cilj.id);
  if (izabrana) pomeriListuNaTrenutnu(k.glavni);

  // Ponovno crtanje iste epizode (promena jezika ili titlova) ne pomera stranu
  // i vraća fokus na kontrolu kojom je pokrenuto.
  const vratiFokus = k.stanje.vratiFokus;
  k.stanje.vratiFokus = null;
  const istaEpizoda = istaSerija && prethodna.epizoda === r.epizoda;
  if (vratiFokus) k.glavni.querySelector(vratiFokus)?.focus({ preventScroll: true });

  if (izabrana) {
    if (istaSerija && !istaEpizoda) {
      window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      k.glavni.querySelector("#plejer-naslov").focus({ preventScroll: true });
    } else if (!istaSerija) {
      k.zavrsiPrikaz(prethodna, r);
    }
    await pokreniPlejer(k, broj, s, izabrana, indeks);
  } else if (!istaSerija) {
    k.zavrsiPrikaz(prethodna, r);
  }
}

// ── Zaglavlje ───────────────────────────────────────────────────────

function zaglavljeHtml(s, katalog, { izabrana, preporucena, nastavak }) {
  const imenaZanrova = katalog?.zanrovi?.[jezik()] ?? katalog?.zanrovi?.en ?? {};
  const zanrovi = (s.zanrovi ?? []).map((z) => imenaZanrova[z]).filter(Boolean);
  const status = s.zavrsena === true ? t("zavrsenaSerija") : s.zavrsena === false ? t("uToku") : null;
  const meta = [
    ocenaHtml(s.ocena),
    s.godina ? esc(s.godina) : "",
    status ? `<span class="oznaka-status${s.zavrsena ? "" : " uzivo"}">${esc(status)}</span>` : "",
    esc(t("brojEpizoda", { n: s.brojEpizoda })),
  ].filter(Boolean);
  const opis = opisSerije(s);
  const prevod = prevedenNaziv(s);
  const uListi = skladiste.uListi(s.id);
  const jezici = s.jeziciTitlova ?? [];

  return `<header class="serija-zaglavlje">
    <div class="serija-pozadina">${okvir(s.ime, s.pozadina ?? s.slika, { oblik: "pozadina", prioritet: !izabrana })}</div>
    <div class="serija-sadrzaj">
      <div class="serija-poster">${okvir(s.ime, s.posterVeliki ?? s.poster, { prioritet: !izabrana })}</div>
      <div class="serija-tekst">
        <p class="nadnaslov">${esc(s.kanal.ime)}</p>
        <h1 tabindex="-1">${esc(s.ime)}</h1>
        ${prevod ? `<p class="prevod-naziva">${esc(prevod)}</p>` : ""}
        <p class="meta">${meta.join('<span class="tacka" aria-hidden="true"></span>')}</p>
        ${zanrovi.length ? `<ul class="zanrovi">${zanrovi.map((z) => `<li>${esc(z)}</li>`).join("")}</ul>` : ""}
        ${
          opis
            ? `<div class="opis" data-opis><p>${esc(opis)}</p></div>
               <button type="button" class="vise" data-vise hidden aria-expanded="false">${esc(t("prikaziVise"))}</button>`
            : ""
        }
        <div class="dugmad">
          ${
            izabrana
              ? ""
              : `<a class="dugme zlatno" href="${putanjaSerije(s.id, preporucena.id)}">${IKONE.pusti}${esc(
                  t(nastavak ? "nastaviEpizodu" : "gledajEpizodu", { n: preporucena.epizoda }),
                )}</a>`
          }
          <button class="dugme staklo" type="button" data-lista aria-pressed="${uListi}">${
            uListi ? IKONE.stiklirano : IKONE.dodaj
          }<span>${esc(uListi ? t("uListi") : t("mojaLista"))}</span></button>
          <button class="dugme staklo ikonica-dugme" type="button" data-podeli aria-label="${esc(t("podeli"))}" title="${esc(
            t("podeli"),
          )}">${IKONE.podeli}</button>
        </div>
        ${
          jezici.length
            ? `<p class="titlovi-info">${IKONE.titlovi}${esc(t("titloviNa", { jezici: jezici.map(imeJezika).join(", ") }))}</p>`
            : ""
        }
      </div>
    </div>
  </header>`;
}

function sezoneHtml(s, sezona) {
  if (s.sezone.length < 2) return "";
  return `<div class="cipovi" role="group" aria-label="${esc(t("sezone"))}">${s.sezone
    .map(
      (n) =>
        `<button type="button" class="cip" data-sezona="${esc(n)}" aria-pressed="${n === sezona}">${esc(t("sezona", { n }))}</button>`,
    )
    .join("")}</div>`;
}

/** Broj pregleda sa ikonicom oka; čitači ekrana čuju "2,6 mil. pregleda". */
function pregledi(broj) {
  if (!broj) return "";
  return `<span class="pregledi">${IKONE.oko}${esc(kratakBroj(broj))}<span class="za-citace"> ${esc(t("pregleda"))}</span></span>`;
}

function udeoZapisa(zapis) {
  return zapis ? (zapis.kraj ? 1 : Math.min(1, zapis.t / zapis.d)) : 0;
}

function epizodaHtml(s, e, zapis, izabrana) {
  const udeo = udeoZapisa(zapis);
  const detalji = [esc(datum(e.objavljeno)), pregledi(e.pregleda)].filter(Boolean);
  return `<li>
    <a class="epizoda${izabrana ? " izabrana" : ""}" href="${putanjaSerije(s.id, e.id)}"${izabrana ? ' aria-current="true"' : ""}>
      ${okvir(s.ime, e.slika, {
        oblik: "sirok",
        dodatak:
          (e.trajanje ? `<span class="trajanje">${esc(trajanje(e.trajanje))}</span>` : "") +
          `<span class="okvir-pusti" aria-hidden="true">${IKONE.pusti}</span>` +
          trakaNapretka(udeo),
      })}
      <div class="epizoda-info">
        <h3>${esc(t("epizoda", { n: e.epizoda }))}${
          zapis?.kraj
            ? ` <span class="odgledano" title="${esc(t("odgledano"))}">${IKONE.stiklirano}<span class="za-citace">${esc(t("odgledano"))}</span></span>`
            : ""
        }</h3>
        <p>${detalji.join('<span class="tacka" aria-hidden="true"></span>')}</p>
        ${jeziciHtml(e.jeziciTitlova, { najvise: 3 })}
      </div>
    </a>
  </li>`;
}

/** Deli sezonu na delove od po EPIZODA_PO_DELU; kratke sezone ostaju cele. */
function deloviSezone(lista) {
  if (lista.length <= DELI_POSLE) return [lista];
  const delovi = [];
  for (let i = 0; i < lista.length; i += EPIZODA_PO_DELU) delovi.push(lista.slice(i, i + EPIZODA_PO_DELU));
  return delovi;
}

function nacrtajEpizode(k, s, izabranaId, ciljId = izabranaId) {
  const zapisi = skladiste.napredakSerije(s.id);
  const sezona = s.epizode.filter((e) => e.sezona === k.stanje.sezona);
  const delovi = deloviSezone(sezona);
  // Podrazumevano se otvara deo sa epizodom koja se gleda ili je sledeća za gledanje.
  if (k.stanje.deo == null || k.stanje.deo >= delovi.length) {
    const sCiljem = delovi.findIndex((d) => d.some((e) => e.id === ciljId));
    k.stanje.deo = sCiljem >= 0 ? sCiljem : k.stanje.redosled === "opadajuce" ? delovi.length - 1 : 0;
  }

  const mestoDelova = k.glavni.querySelector("[data-delovi]");
  mestoDelova.hidden = delovi.length < 2;
  const redDelova = delovi.map((d, i) => ({ d, i }));
  if (k.stanje.redosled === "opadajuce") redDelova.reverse();
  mestoDelova.innerHTML = redDelova
    .map(({ d, i }) => {
      const od = d[0].epizoda;
      const doo = d.at(-1).epizoda;
      return `<button type="button" class="cip" data-deo="${i}" aria-pressed="${i === k.stanje.deo}" aria-label="${esc(
        t("epizodeOd", { od, do: doo }),
      )}">${esc(`${od}–${doo}`)}</button>`;
    })
    .join("");

  const lista = [...delovi[k.stanje.deo]];
  if (k.stanje.redosled === "opadajuce") lista.reverse();
  const mesto = k.glavni.querySelector("[data-epizode]");
  mesto.innerHTML = lista.map((e) => epizodaHtml(s, e, zapisi.get(e.id), e.id === izabranaId)).join("");
  primeniStilove(mesto);
}

// ── Glumci i platforme ──────────────────────────────────────────────

function glumciHtml(s) {
  if (!s.glumci?.length) return "";
  return `<section class="sekcija" aria-labelledby="glumci-naslov">
    <div class="sekcija-zaglavlje"><h2 id="glumci-naslov">${esc(t("glumci"))}</h2></div>
    <ul class="glumci">${s.glumci
      .map(
        (g) => `<li>
          <div class="glumac-slika">${
            g.slika ? `<img src="${esc(g.slika)}" alt="" loading="lazy" decoding="async">` : ""
          }<span aria-hidden="true">${esc(inicijali(g.ime))}</span></div>
          <p class="glumac-ime">${esc(g.ime)}</p>
          ${g.uloga ? `<p class="glumac-uloga">${esc(g.uloga)}</p>` : ""}
        </li>`,
      )
      .join("")}</ul>
  </section>`;
}

function inicijali(ime) {
  return String(ime)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((d) => d[0])
    .join("")
    .toLocaleUpperCase("tr");
}

/** Zemlja korisnika: sačuvan izbor, pa region iz jezika pregledača, pa jezik sajta. */
function zemljaKorisnika() {
  const sacuvana = skladiste.podesavanja().zemlja;
  if (sacuvana) return sacuvana;
  for (const oznaka of navigator.languages ?? []) {
    const region = /-([A-Z]{2})$/i.exec(oznaka)?.[1];
    if (region) return region.toUpperCase();
  }
  return ZEMLJA_PO_JEZIKU[jezik()] ?? "US";
}

function gledanjeHtml(s, katalog) {
  if (!s.tmdbId || !Object.keys(s.gledanje ?? {}).length) return "";
  return `<section class="sekcija gledanje" aria-labelledby="gledanje-naslov" data-gledanje>
    ${gledanjeSadrzaj(s, katalog, zemljaKorisnika())}
  </section>`;
}

function gledanjeSadrzaj(s, katalog, zemlja) {
  const provajderi = katalog?.provajderi ?? {};
  const zemlje = [...new Set([...Object.keys(s.gledanje), zemlja])].sort((a, b) =>
    imeZemlje(a).localeCompare(imeZemlje(b), jezik()),
  );
  const ponuda = s.gledanje[zemlja] ?? {};
  const veza = `https://www.themoviedb.org/tv/${encodeURIComponent(s.tmdbId)}/watch?locale=${encodeURIComponent(zemlja)}`;
  const grupe = VRSTE_PONUDE.filter((v) => ponuda[v]?.length).map(
    (vrsta) => `<div class="ponuda">
      <h3>${esc(t(vrsta))}</h3>
      <ul>${ponuda[vrsta]
        .map((id) => provajderi[id])
        .filter(Boolean)
        .map(
          (p) => `<li><a href="${esc(veza)}" target="_blank" rel="noopener" title="${esc(p.ime)}">
            ${p.logo ? `<img src="${esc(p.logo)}" alt="" width="44" height="44" loading="lazy">` : ""}
            <span>${esc(p.ime)}</span></a></li>`,
        )
        .join("")}</ul>
    </div>`,
  );
  return `<div class="sekcija-zaglavlje">
      <h2 id="gledanje-naslov">${esc(t("gdeGledati"))}</h2>
      <label class="izbor izbor-mali">
        <span>${esc(t("zemlja"))}</span>
        <select data-zemlja>${zemlje
          .map((z) => `<option value="${esc(z)}"${z === zemlja ? " selected" : ""}>${esc(imeZemlje(z))}</option>`)
          .join("")}</select>
      </label>
    </div>
    ${grupe.length ? `<div class="ponude">${grupe.join("")}</div>` : `<p class="tiho">${esc(t("nemaPlatformi", { zemlja: imeZemlje(zemlja) }))}</p>`}
    <p class="atribucija"><a href="https://www.justwatch.com/" target="_blank" rel="noopener">${esc(t("justwatch"))}</a></p>`;
}

// ── Plejer ──────────────────────────────────────────────────────────

function plejerHtml(s, e, indeks, zapisi) {
  const prethodna = s.epizode[indeks - 1];
  const sledeca = s.epizode[indeks + 1];
  const { titlovi, autoSledeca, bioskop } = skladiste.podesavanja();
  const detalji = [
    esc(datum(e.objavljeno)),
    esc(trajanje(e.trajanje)),
    pregledi(e.pregleda),
    e.ograniceno ? esc(t("ograniceno")) : "",
  ].filter(Boolean);
  const sezona = s.epizode.filter((x) => x.sezona === e.sezona);
  const mesto = sezona.indexOf(e) + 1;
  const naslovna = s.pozadina ?? e.slika;

  return `<section class="plejer${bioskop ? " bioskop" : ""}" aria-labelledby="plejer-naslov">
    <div class="plejer-ambijent" aria-hidden="true">${naslovna ? `<img src="${esc(naslovna)}" alt="" decoding="async">` : ""}</div>
    <div class="plejer-raspored">
      <div class="plejer-glavni">
        <div class="plejer-okvir" data-plejer-okvir>
          <div class="plejer-naslovna" aria-hidden="true">
            ${okvir(s.ime, naslovna, { oblik: "pozadina", prioritet: true })}
            <div class="naslovna-sadrzaj">
              <span class="naslovna-pusti">${IKONE.pusti}</span>
              <p><span>${esc(s.ime)}</span>${esc(t("epizoda", { n: e.epizoda }))}</p>
            </div>
          </div>
          <div id="yt-plejer"></div>
          <div class="odbrojavanje" hidden>
            <p data-odbrojavanje-tekst></p>
            <div class="dugmad">
              ${sledeca ? `<a class="dugme zlatno" href="${putanjaSerije(s.id, sledeca.id)}">${IKONE.pusti}${esc(t("sledeca"))}</a>` : ""}
              <button class="dugme staklo" type="button" data-otkazi>${esc(t("otkazi"))}</button>
            </div>
          </div>
        </div>
        <div class="plejer-info">
          <div class="plejer-naslovi">
            <p class="nadnaslov">${esc(s.ime)}${
              s.sezone.length > 1 ? ` · ${esc(t("sezona", { n: e.sezona }))}` : ""
            }</p>
            <h2 id="plejer-naslov" tabindex="-1">${esc(t("epizoda", { n: e.epizoda }))}</h2>
            <p class="plejer-detalji">${detalji.join('<span class="tacka" aria-hidden="true"></span>')}</p>
            ${jeziciHtml(e.jeziciTitlova, { najvise: 6 })}
          </div>
          <div class="dugmad">
            ${prethodna ? `<a class="dugme staklo" href="${putanjaSerije(s.id, prethodna.id)}">${IKONE.levo}${esc(t("prethodna"))}</a>` : ""}
            ${sledeca ? `<a class="dugme zlatno" href="${putanjaSerije(s.id, sledeca.id)}">${esc(t("sledeca"))}${IKONE.desno}</a>` : ""}
          </div>
        </div>
        <div class="plejer-podesavanja">
          <button type="button" class="prekidac" data-podesavanje="titlovi" aria-pressed="${titlovi}">${IKONE.titlovi}<span>${esc(
            titlovi ? t("titloviUkljuceni") : t("titloviIskljuceni"),
          )}</span></button>
          <button type="button" class="prekidac" data-podesavanje="autoSledeca" aria-pressed="${autoSledeca}">${IKONE.lista}<span>${esc(
            t("autoSledeca"),
          )}</span></button>
          <button type="button" class="prekidac samo-siroko" data-podesavanje="bioskop" aria-pressed="${bioskop}">${IKONE.bioskop}<span>${esc(
            t("bioskop"),
          )}</span></button>
          <a class="prekidac" href="${esc(youtubeAdresa(e.id))}" target="_blank" rel="noopener">${IKONE.spolja}<span>${esc(t("naYoutubeu"))}</span></a>
        </div>
        ${titlovi ? `<p class="savet">${IKONE.info}<span>${esc(t("titloviSavet"))}</span></p>` : ""}
      </div>
      <aside class="plejer-epizode" aria-labelledby="plejer-epizode-naslov">
        <div class="plejer-epizode-unutra">
          <div class="plejer-epizode-zaglavlje">
            <h2 id="plejer-epizode-naslov">${esc(s.sezone.length > 1 ? t("sezona", { n: e.sezona }) : t("epizode"))}</h2>
            <span>${esc(t("epizodaOd", { n: mesto, ukupno: sezona.length }))}</span>
          </div>
          <ol data-plejer-lista>${sezona
            .map((x) => {
              const trenutna = x.id === e.id;
              return `<li><a href="${putanjaSerije(s.id, x.id)}"${trenutna ? ' aria-current="true" class="trenutna"' : ""}>
                ${okvir(s.ime, x.slika, {
                  oblik: "sirok",
                  dodatak:
                    trakaNapretka(udeoZapisa(zapisi.get(x.id))) +
                    (trenutna ? '<span class="sada-ide" aria-hidden="true"><i></i><i></i><i></i></span>' : ""),
                })}
                <span class="plejer-epizode-tekst">
                  <strong>${esc(t("epizoda", { n: x.epizoda }))}</strong>
                  <span>${esc(trenutna ? t("sadaGledas") : [datum(x.objavljeno), trajanje(x.trajanje)].filter(Boolean).join(" · "))}</span>
                </span>
              </a></li>`;
            })
            .join("")}</ol>
        </div>
      </aside>
    </div>
  </section>`;
}

/** Lista epizoda pored plejera počinje od epizode koja se gleda (bez pomeranja strane). */
function pomeriListuNaTrenutnu(g) {
  const lista = g.querySelector("[data-plejer-lista]");
  const trenutna = lista?.querySelector(".trenutna")?.closest("li");
  if (lista && trenutna) lista.scrollTop = Math.max(0, trenutna.offsetTop - 8);
}

async function pokreniPlejer(k, broj, s, e, indeks) {
  const mesto = k.glavni.querySelector("#yt-plejer");
  if (!mesto) return;
  const zapis = skladiste.napredak(e.id);
  // Nastavak malo pre mesta gde se stalo; završene epizode kreću od početka.
  const pocetak = zapis && !zapis.kraj && zapis.t > 30 && zapis.t < zapis.d - 60 ? zapis.t - 5 : 0;
  const sledeca = s.epizode[indeks + 1];
  const zajedno = { serija: s.id, ime: s.ime, epizoda: e.epizoda, slika: e.slika };

  const plejer = await napraviPlejer(mesto, {
    videoId: e.id,
    naslov: `${s.ime} · ${t("epizoda", { n: e.epizoda })}`,
    pocetak,
    titlovi: skladiste.podesavanja().titlovi ? jezik() : null,
    jezikInterfejsa: jezik(),
    naNapretku: (vreme, ukupno) => skladiste.sacuvajNapredak(e.id, { ...zajedno, t: vreme, d: ukupno }),
    naKraju: () => {
      skladiste.sacuvajNapredak(e.id, {
        ...zajedno,
        t: e.trajanje || 1,
        d: e.trajanje || 1,
        kraj: true,
      });
      if (sledeca && skladiste.podesavanja().autoSledeca) pokreniOdbrojavanje(k, s, sledeca);
    },
    naSpremnosti: () => k.glavni.querySelector("[data-plejer-okvir]")?.classList.add("spreman"),
    naGresci: () => {
      const okvirPlejera = k.glavni.querySelector(".plejer-okvir");
      if (!okvirPlejera || okvirPlejera.querySelector(".plejer-greska")) return;
      okvirPlejera.insertAdjacentHTML(
        "beforeend",
        `<p class="plejer-greska">${esc(t("plejerGreska"))} <a href="${esc(youtubeAdresa(e.id))}" target="_blank" rel="noopener">${esc(
          t("naYoutubeu"),
        )}</a></p>`,
      );
    },
  });

  if (k.jeZastareo(broj)) plejer.unisti();
  else k.stanje.plejer = plejer;
}

function pokreniOdbrojavanje(k, s, sledeca) {
  const okno = k.glavni.querySelector(".odbrojavanje");
  if (!okno) return;
  const tekst = okno.querySelector("[data-odbrojavanje-tekst]");
  let preostalo = AUTO_SLEDECA_S;
  const osvezi = () => (tekst.textContent = t("sledecaZa", { s: preostalo }));
  osvezi();
  okno.hidden = false;
  okno.querySelector("a")?.focus();

  clearInterval(k.stanje.odbrojavanje);
  k.stanje.odbrojavanje = setInterval(() => {
    preostalo--;
    if (preostalo > 0) return osvezi();
    clearInterval(k.stanje.odbrojavanje);
    k.idi(putanjaSerije(s.id, sledeca.id));
  }, 1000);

  okno.querySelector("[data-otkazi]").onclick = () => {
    clearInterval(k.stanje.odbrojavanje);
    okno.hidden = true;
  };
}

// ── Događaji ────────────────────────────────────────────────────────

function povezi(k, s, ciljId) {
  const g = k.glavni;

  const dugmeListe = g.querySelector("[data-lista]");
  dugmeListe.addEventListener("click", () => {
    const sada = skladiste.prebaciListu(s.id);
    dugmeListe.setAttribute("aria-pressed", String(sada));
    dugmeListe.innerHTML = `${sada ? IKONE.stiklirano : IKONE.dodaj}<span>${esc(sada ? t("uListi") : t("mojaLista"))}</span>`;
    k.obavesti(sada ? t("uListi") : t("mojaLista"));
  });

  g.querySelector("[data-podeli]").addEventListener("click", async () => {
    const podaci = { title: `${s.ime} | Bölüm`, url: location.href };
    if (navigator.share) {
      try {
        await navigator.share(podaci);
      } catch {
        // Korisnik je odustao.
      }
    } else {
      await k.kopiraj(podaci.url);
    }
  });

  // "Prikaži više" samo kad je opis zaista duži od tri reda.
  const opis = g.querySelector("[data-opis]");
  const vise = g.querySelector("[data-vise]");
  if (opis && vise) {
    requestAnimationFrame(() => {
      if (opis.scrollHeight > opis.clientHeight + 4) vise.hidden = false;
    });
    vise.addEventListener("click", () => {
      const otvoren = opis.classList.toggle("otvoren");
      vise.setAttribute("aria-expanded", String(otvoren));
      vise.textContent = otvoren ? t("prikaziManje") : t("prikaziVise");
    });
  }

  const izabranaId = () => new URLSearchParams(location.search).get("e");
  for (const dugme of g.querySelectorAll("[data-sezona]")) {
    dugme.addEventListener("click", () => {
      k.stanje.sezona = Number(dugme.dataset.sezona);
      k.stanje.deo = null;
      for (const d of g.querySelectorAll("[data-sezona]")) {
        d.setAttribute("aria-pressed", String(Number(d.dataset.sezona) === k.stanje.sezona));
      }
      nacrtajEpizode(k, s, izabranaId(), ciljId);
    });
  }
  g.querySelector("[data-delovi]").addEventListener("click", (d) => {
    const dugme = d.target.closest("[data-deo]");
    if (!dugme) return;
    k.stanje.deo = Number(dugme.dataset.deo);
    nacrtajEpizode(k, s, izabranaId(), ciljId);
    g.querySelector(`[data-deo="${k.stanje.deo}"]`)?.focus();
  });
  g.querySelector("[data-redosled]").addEventListener("change", (d) => {
    k.stanje.redosled = d.target.value;
    nacrtajEpizode(k, s, izabranaId(), ciljId);
  });

  g.querySelector("[data-gledanje]")?.addEventListener("change", (d) => {
    if (!d.target.matches("[data-zemlja]")) return;
    skladiste.sacuvajPodesavanje("zemlja", d.target.value);
    const sekcija = g.querySelector("[data-gledanje]");
    k.katalog()
      .catch(() => null)
      .then((katalog) => {
        sekcija.innerHTML = gledanjeSadrzaj(s, katalog, d.target.value);
        sekcija.querySelector("[data-zemlja]")?.focus();
      });
  });

  for (const prekidac of g.querySelectorAll("[data-podesavanje]")) {
    prekidac.addEventListener("click", () => {
      const ime = prekidac.dataset.podesavanje;
      const sada = !skladiste.podesavanja()[ime];
      skladiste.sacuvajPodesavanje(ime, sada);
      prekidac.setAttribute("aria-pressed", String(sada));
      // Bioskopski prikaz samo menja raspored; plejer nastavlja bez prekida.
      if (ime === "bioskop") g.querySelector(".plejer")?.classList.toggle("bioskop", sada);
      if (ime === "titlovi") {
        // Titlovi se biraju pri pokretanju plejera, pa ga ponovo pokrećemo od istog mesta.
        k.stanje.plejer?.sacuvaj();
        k.stanje.vratiFokus = '[data-podesavanje="titlovi"]';
        k.prikazi();
      }
    });
  }
}
