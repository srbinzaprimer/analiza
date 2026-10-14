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

/**
 * Šta da se pusti: započeta epizoda ako je gledana posle poslednje završene,
 * inače epizoda posle najdalje završene. Kratko zavirivanje (manje od
 * POCETAK_S) se ne računa, a ponovno gledanje stare epizode ne vraća nazad.
 */
export function preporuci(s, zapisi) {
  const indeks = (id) => s.epizode.findIndex((e) => e.id === id);
  const nase = [...zapisi.entries()].filter(([id]) => indeks(id) >= 0);
  const [zapoceta] = nase
    .filter(([, z]) => !z.kraj && z.t >= skladiste.POCETAK_S)
    .sort((a, b) => b[1].kada - a[1].kada);
  const zavrsene = nase.filter(([, z]) => z.kraj);
  const poslednjeZavrsena = Math.max(-Infinity, ...zavrsene.map(([, z]) => z.kada));

  if (zapoceta && zapoceta[1].kada >= poslednjeZavrsena) {
    return { epizoda: s.epizode[indeks(zapoceta[0])], nastavak: true };
  }
  if (zavrsene.length) {
    const najdalja = Math.max(...zavrsene.map(([id]) => indeks(id)));
    return { epizoda: s.epizode[najdalja + 1] ?? s.epizode.at(-1), nastavak: false };
  }
  return { epizoda: s.epizode[0], nastavak: false };
}

/**
 * Koja verzija serije (kanal) se prikazuje: ona sa izabranom epizodom, ona
 * koju je korisnik izabrao, ona u kojoj je poslednji put gledao, ili verzija
 * sa titlovima kanala na jeziku korisnika (bolji od mašinskog prevoda).
 */
export function izaberiVerziju(k, p, epizodaId) {
  const saEpizodom = (id) => p.verzije.findIndex((v) => v.epizode.some((e) => e.id === id));
  if (epizodaId && saEpizodom(epizodaId) >= 0) return saEpizodom(epizodaId);
  const izbor = k.stanje.verzija;
  if (izbor?.serija === p.id && izbor.indeks >= 0 && izbor.indeks < p.verzije.length) return izbor.indeks;
  const [poslednji] = [...skladiste.napredakSerije(p.id).entries()].sort((a, b) => b[1].kada - a[1].kada);
  if (poslednji && saEpizodom(poslednji[0]) >= 0) return saEpizodom(poslednji[0]);

  // Verzija sa titlovima na jeziku korisnika je podrazumevana samo ako je skoro
  // cela; inače se samo nudi, da se ne izgube epizode koje ima samo original.
  const zeljeni = skladiste.podesavanja().jezikTitlova ?? jezik();
  const odgovara = (v) =>
    (v.jeziciTitlova ?? []).includes(zeljeni) && v.epizode.length >= 0.9 * p.verzije[0].epizode.length;
  if (zeljeni !== p.jezik && !(p.verzije[0].jeziciTitlova ?? []).includes(zeljeni)) {
    const i = p.verzije.findIndex(odgovara);
    if (i >= 0) return i;
  }
  return 0;
}

/** Serija viđena kroz jednu verziju: njen kanal, epizode i sezone. */
function uVerziji(p, i) {
  const v = p.verzije[i];
  const najnovija = v.epizode.reduce((a, e) => (String(e.objavljeno) > String(a.objavljeno) ? e : a));
  return {
    ...p,
    aktivnaVerzija: i,
    kanal: v.kanal,
    epizode: v.epizode,
    brojEpizoda: v.epizode.length,
    sezone: [...new Set(v.epizode.map((e) => e.sezona))].sort((a, b) => a - b),
    poslednja: { id: najnovija.id, epizoda: najnovija.epizoda, objavljeno: najnovija.objavljeno },
  };
}

function verzijeHtml(s) {
  if ((s.verzije?.length ?? 0) < 2) return "";
  return `<div class="verzije" role="group" aria-label="${esc(t("verzije"))}">${s.verzije
    .map((v, i) => {
      const jezici = v.jeziciTitlova ?? [];
      const naslov =
        i === 0 ? t("original") : jezici.length ? t("verzijaTitlovi", { jezici: jezici.map(imeJezika).join(", ") }) : v.kanal.ime;
      return `<button type="button" class="verzija" data-verzija="${i}" aria-pressed="${i === s.aktivnaVerzija}">
        <strong>${esc(naslov)}</strong>
        <span>${esc(`${v.kanal.ime} · ${t("brojEpizoda", { n: v.epizode.length })}`)}</span>
        ${jeziciHtml(jezici, { najvise: 3 })}
      </button>`;
    })
    .join("")}</div>`;
}

/** Zvanični sajt serije; adresa dolazi sa TMDB-a, pa se još jednom proverava. */
function sajtSerije(s) {
  return typeof s.sajt === "string" && /^https?:\/\//i.test(s.sajt) ? s.sajt : null;
}

export async function prikaziSeriju(k, broj, r, prethodna) {
  const istaSerija = prethodna?.strana === "serija" && prethodna.id === r.id;
  if (!istaSerija) {
    k.glavni.innerHTML = '<div class="ucitavanje ucitavanje-serija" aria-busy="true"></div>';
    k.stanje.sezona = null;
    k.stanje.deo = null;
  }

  let podaci;
  try {
    podaci = await k.serija(r.id);
    // Serija je spojena sa istom serijom sa drugog kanala: prelazi se na novu adresu.
    if (podaci?.preusmeri) {
      if (k.jeZastareo(broj)) return;
      r.id = podaci.preusmeri;
      history.replaceState(null, "", adresa(putanjaSerije(r.id, r.epizoda)));
      podaci = await k.serija(r.id);
    }
  } catch {
    if (!k.jeZastareo(broj)) k.greskaUcitavanja();
    return;
  }
  if (k.jeZastareo(broj)) return;
  if (!podaci?.verzije?.length) {
    document.title = `${t("nijePronadjena")} | Bölüm`;
    k.glavni.innerHTML = k.poruka(t("nijePronadjena"));
    k.zavrsiPrikaz(prethodna, r);
    return;
  }
  // Imena žanrova i platformi su u zajedničkom katalogu; bez njega strana i dalje radi.
  const katalog = await k.katalog().catch(() => null);
  if (k.jeZastareo(broj)) return;

  const s = uVerziji(podaci, izaberiVerziju(k, podaci, r.epizoda));
  if (!s.sezone.includes(k.stanje.sezona)) k.stanje.sezona = null;

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
    // Nova epizoda: na vrh, a fokus na naslov epizode ispod plejera (ne na
    // naslov serije, koji je ispod svih kontrola plejera).
    if (prethodna && !istaEpizoda) {
      const glatko = istaSerija && !matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: glatko ? "smooth" : "auto" });
      k.glavni.querySelector("#plejer-naslov").focus({ preventScroll: true });
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
        ${drugiIzvoriHtml(s, katalog)}
        ${verzijeHtml(s)}
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

const imaPonudu = (s) => Boolean(s.tmdbId && Object.keys(s.gledanje ?? {}).length);

/** "Gledaj i na": logotipi platformi u zemlji korisnika i sajt televizije, uz zaglavlje. */
function drugiIzvoriHtml(s, katalog) {
  const ponuda = s.gledanje?.[zemljaKorisnika()] ?? {};
  const provajderi = katalog?.provajderi ?? {};
  const platforme = [...new Set(VRSTE_PONUDE.flatMap((v) => ponuda[v] ?? []))]
    .map((id) => provajderi[id])
    .filter(Boolean)
    .slice(0, 4);
  const sajt = sajtSerije(s);
  if (!platforme.length && !sajt) return "";
  const imena = [...(sajt ? [s.mreze?.[0]?.ime ?? t("zvanicniSajt")] : []), ...platforme.map((p) => p.ime)];
  return `<button type="button" class="drugi-izvori" data-drugi-izvori>
    <span class="drugi-izvori-oznaka">${esc(t("gledajINa"))}</span>
    <span class="drugi-izvori-logoi" aria-hidden="true">${
      sajt ? `<span class="drugi-izvori-tv">${IKONE.kuca}</span>` : ""
    }${platforme
      .map((p) => (p.logo ? `<img src="${esc(p.logo)}" alt="" width="28" height="28" loading="lazy">` : ""))
      .join("")}</span>
    <span class="drugi-izvori-imena">${esc(imena.join(", "))}</span>
  </button>`;
}

function gledanjeHtml(s, katalog) {
  if (!imaPonudu(s) && !sajtSerije(s)) return "";
  return `<section class="sekcija gledanje" aria-labelledby="gledanje-naslov" data-gledanje>
    ${gledanjeSadrzaj(s, katalog, zemljaKorisnika())}
  </section>`;
}

function zvanicniSajtHtml(s) {
  const sajt = sajtSerije(s);
  if (!sajt) return "";
  const mreza = s.mreze?.[0];
  const opis = mreza?.ime ? t("naSajtuTelevizije", { ime: mreza.ime }) : new URL(sajt).hostname;
  return `<a class="zvanicni-sajt" href="${esc(sajt)}" target="_blank" rel="noopener">
    <span class="zvanicni-logo">${
      mreza?.logo ? `<img src="${esc(mreza.logo)}" alt="" loading="lazy">` : IKONE.kuca
    }</span>
    <span class="zvanicni-tekst">
      <strong>${esc(t("zvanicniSajt"))}</strong>
      <span>${esc(opis)}</span>
      <small>${esc(t("zvanicniSajtNapomena"))}</small>
    </span>
    ${IKONE.spolja}
  </a>`;
}

function gledanjeSadrzaj(s, katalog, zemlja) {
  if (!imaPonudu(s)) {
    return `<div class="sekcija-zaglavlje"><h2 id="gledanje-naslov">${esc(t("gdeGledati"))}</h2></div>
      ${zvanicniSajtHtml(s)}`;
  }
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
    ${zvanicniSajtHtml(s)}
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
            <p class="za-citace" aria-live="polite" data-odbrojavanje-najava></p>
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
          <label class="prekidac izbor-titlova" data-aktivno="${titlovi}">
            ${IKONE.titlovi}
            <span class="za-citace">${esc(t("jezikTitlova"))}</span>
            <select data-titlovi>${opcijeTitlova(titlovi ? jezikTitlova() : "")}</select>
          </label>
          <button type="button" class="prekidac" data-podesavanje="autoSledeca" aria-pressed="${autoSledeca}">${IKONE.lista}<span>${esc(
            t("autoSledeca"),
          )}</span></button>
          <button type="button" class="prekidac samo-siroko" data-podesavanje="bioskop" aria-pressed="${bioskop}">${IKONE.bioskop}<span>${esc(
            t("bioskop"),
          )}</span></button>
          <a class="prekidac" href="${esc(youtubeAdresa(e.id))}" target="_blank" rel="noopener">${IKONE.spolja}<span>${esc(t("naYoutubeu"))}</span></a>
        </div>
        <p class="titlovi-status" data-titlovi-status aria-live="polite" hidden></p>
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

// ── Titlovi u plejeru ───────────────────────────────────────────────

// Dok YouTube ne javi stvarni spisak, nude se najčešći jezici publike turskih serija.
const CESTI_JEZICI = ["en", "sr", "tr", "es", "ar", "de", "fr", "it", "pt", "ru", "bg", "ro", "pl", "hu", "el", "fa", "id", "ur", "hi", "az", "sq", "bs", "hr", "mk", "uk", "nl"];

const jezikTitlova = () => skladiste.podesavanja().jezikTitlova ?? jezik();

/**
 * Opcije izbora jezika titlova. Kad YouTube javi spisak: prvo titlovi kanala,
 * pa jezici na koje YouTube automatski prevodi.
 */
function opcijeTitlova(izabrani, spisak = null) {
  const poImenu = (a, b) => imeJezika(a).localeCompare(imeJezika(b), jezik());
  const opcija = (kod, dodatak = "") =>
    `<option value="${esc(kod)}"${kod === izabrani ? " selected" : ""}>${esc(imeJezika(kod) + dodatak)}</option>`;
  const prazna = `<option value=""${izabrani ? "" : " selected"}>${esc(t("bezTitlova"))}</option>`;

  if (!spisak?.izvorni.length) {
    const kodovi = [...new Set([izabrani, jezik(), ...CESTI_JEZICI].filter(Boolean))].sort(poImenu);
    return prazna + kodovi.map((kod) => opcija(kod)).join("");
  }
  const izvorni = [...new Map(spisak.izvorni.map((x) => [x.kod, x])).values()];
  const kodoviKanala = new Set(izvorni.map((x) => x.kod));
  const prevodi = [...new Set(spisak.prevodi.map((x) => x.kod))].filter((kod) => !kodoviKanala.has(kod)).sort(poImenu);
  const poznat = !izabrani || kodoviKanala.has(izabrani) || prevodi.includes(izabrani);
  return (
    prazna +
    (poznat ? "" : opcija(izabrani)) +
    `<optgroup label="${esc(t("titloviKanala"))}">${izvorni
      .map((x) => opcija(x.kod, x.auto ? " (YouTube)" : ""))
      .join("")}</optgroup>` +
    (prevodi.length ? `<optgroup label="${esc(t("autoPrevod"))}">${prevodi.map((kod) => opcija(kod)).join("")}</optgroup>` : "")
  );
}

/** Plejer je javio koje titlove video ima i šta je uključeno. */
function osveziTitlove(g, spisak) {
  const izbor = g.querySelector("[data-titlovi]");
  const status = g.querySelector("[data-titlovi-status]");
  if (!izbor?.isConnected) return;
  const izabrani = izbor.value;
  if (document.activeElement !== izbor) izbor.innerHTML = opcijeTitlova(izabrani, spisak);
  if (!izabrani) {
    status.hidden = true;
  } else if (!spisak.izvorni.length) {
    status.textContent = t("nemaTitlovaEpizoda");
    status.hidden = false;
  } else if (spisak.aktivni) {
    status.textContent = t(spisak.aktivni.prevod ? "titloviPrevod" : "titloviIzvorni", {
      jezik: imeJezika(spisak.aktivni.kod),
    });
    status.hidden = false;
  }
}

/**
 * Lista epizoda pored plejera počinje od epizode koja se gleda (bez pomeranja
 * strane). U bioskopskom prikazu lista je vodoravna.
 */
function pomeriListuNaTrenutnu(g) {
  const lista = g.querySelector("[data-plejer-lista]");
  const trenutna = lista?.querySelector(".trenutna")?.closest("li");
  if (!lista || !trenutna) return;
  if (getComputedStyle(lista).gridAutoFlow === "column") {
    lista.scrollLeft = Math.max(0, trenutna.offsetLeft - 8);
  } else {
    lista.scrollTop = Math.max(0, trenutna.offsetTop - 8);
  }
}

async function pokreniPlejer(k, broj, s, e, indeks) {
  const mesto = k.glavni.querySelector("#yt-plejer");
  if (!mesto) return;
  const zapis = skladiste.napredak(e.id);
  // Nastavak malo pre mesta gde se stalo; završene epizode kreću od početka.
  const pocetak =
    zapis && !zapis.kraj && zapis.t >= skladiste.POCETAK_S && zapis.t < zapis.d - 60 ? zapis.t - 5 : 0;
  const sledeca = s.epizode[indeks + 1];
  const zajedno = { serija: s.id, ime: s.ime, epizoda: e.epizoda, slika: e.slika };

  const plejer = await napraviPlejer(mesto, {
    videoId: e.id,
    naslov: `${s.ime} · ${t("epizoda", { n: e.epizoda })}`,
    pocetak,
    titlovi: skladiste.podesavanja().titlovi ? jezikTitlova() : null,
    jezikInterfejsa: jezik(),
    naTitlovima: (spisak) => {
      if (!k.jeZastareo(broj)) osveziTitlove(k.glavni, spisak);
    },
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
  // Čitači ekrana čuju odbrojavanje jednom, a ne svake sekunde.
  okno.querySelector("[data-odbrojavanje-najava]").textContent = tekst.textContent;
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
    // Dugme sa fokusom je sakriveno, pa se fokus vraća na naslov epizode.
    k.glavni.querySelector("#plejer-naslov")?.focus();
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
      if (ime === "bioskop") {
        g.querySelector(".plejer")?.classList.toggle("bioskop", sada);
        pomeriListuNaTrenutnu(g);
      }
    });
  }

  const izborTitlova = g.querySelector("[data-titlovi]");
  izborTitlova?.addEventListener("change", () => {
    const kod = izborTitlova.value || null;
    skladiste.sacuvajPodesavanje("titlovi", Boolean(kod));
    if (kod) skladiste.sacuvajPodesavanje("jezikTitlova", kod);
    izborTitlova.closest("[data-aktivno]").dataset.aktivno = String(Boolean(kod));
    if (k.stanje.plejer?.postaviTitlove?.(kod)) return;
    // Bez YouTube API-ja jezik titlova se bira pri pokretanju, pa se plejer
    // ponovo pokreće od istog mesta.
    k.stanje.plejer?.sacuvaj();
    k.stanje.vratiFokus = "[data-titlovi]";
    k.prikazi();
  });

  for (const dugme of g.querySelectorAll("[data-verzija]")) {
    dugme.addEventListener("click", () => {
      const indeks = Number(dugme.dataset.verzija);
      if (indeks === s.aktivnaVerzija) return;
      k.stanje.verzija = { serija: s.id, indeks };
      k.stanje.sezona = null;
      k.stanje.deo = null;
      k.stanje.vratiFokus = `[data-verzija="${indeks}"]`;
      // Epizoda iz plejera pripada staroj verziji, pa se ide na stranicu serije.
      if (izabranaId()) k.idi(putanjaSerije(s.id));
      else k.prikazi();
    });
  }

  g.querySelector("[data-drugi-izvori]")?.addEventListener("click", () => {
    const sekcija = g.querySelector("[data-gledanje]");
    if (!sekcija) return;
    sekcija.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    sekcija.querySelector("h2")?.setAttribute("tabindex", "-1");
    sekcija.querySelector("h2")?.focus({ preventScroll: true });
  });
}
