// Samostalan HTML izveštaj (jedan fajl, bez spoljnih zavisnosti).

import {
  formatirajBajtove,
  imeSaVerzijom,
  listaProvera,
  tehnologijePoKategoriji,
} from "./izvestaj.mjs";

/** Sav tekst sa analiziranog sajta prolazi kroz ovo pre ubacivanja u HTML. */
export function esc(vrednost) {
  return String(vrednost ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const OZNAKE = { ok: "✓", upozorenje: "!", problem: "✗" };

const VRSTE = {
  skripta: "skripta",
  stil: "stil",
  slika: "slika",
  iframe: "iframe",
  medij: "video/zvuk",
  ikonica: "ikonica",
  veza: "rana veza",
};

export function htmlIzvestaj(r) {
  const host = new URL(r.konacnaAdresa).hostname;
  const datum = new Date(r.analizirano).toLocaleString("sr-Latn", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Analiza: ${esc(host)}</title>
<style>${STIL}</style>
</head>
<body>
<main>
  <header>
    <p class="nadnaslov">Analiza sajta</p>
    <h1>${esc(host)}</h1>
    <p class="meta">
      <a href="${esc(r.konacnaAdresa)}" rel="noopener noreferrer">${esc(r.konacnaAdresa)}</a><br>
      Status ${esc(r.status)} · odgovor za ${esc(r.vremeOdgovoraMs)} ms · ${esc(datum)}
    </p>
    ${r.naslov ? `<p class="naslov-sajta">„${esc(r.naslov)}“</p>` : ""}
  </header>

  ${pregled(r)}
  ${tehnologije(r)}
  ${spoljniServisi(r)}
  ${velicina(r)}
  ${provere(r)}
  ${skripte(r)}

  <section>
    <h2>Napomene</h2>
    <ul class="napomene">${r.napomene.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
  </section>

  <footer>Napravljeno alatom <a href="https://github.com/srbinzaprimer/analiza">analiza</a>.</footer>
</main>
</body>
</html>
`;
}

function pregled(r) {
  const plocica = (vrednost, opis) =>
    `<div class="plocica"><span class="vrednost">${esc(vrednost)}</span><span class="opis">${esc(opis)}</span></div>`;
  return `<section class="pregled">
    ${plocica(r.tehnologije.length, "prepoznatih tehnologija")}
    ${plocica(r.spoljniServisi.length, "spoljnih domena")}
    ${plocica(r.skripte.saAdresom, "učitanih skripti")}
    ${r.velicina ? plocica(formatirajBajtove(r.velicina.ukupno), "ukupna veličina") : ""}
  </section>`;
}

function tehnologije(r) {
  const grupe = tehnologijePoKategoriji(r.tehnologije);
  const sadrzaj =
    grupe.length === 0
      ? `<p class="prazno">Nijedna poznata tehnologija nije prepoznata.</p>`
      : `<dl class="tehnologije">${grupe
          .map(
            (g) => `<dt>${esc(g.kategorija)}</dt><dd>${g.stavke
              .map(
                (t) =>
                  `<span class="oznaka" title="Dokaz: ${esc(t.dokaz)}">${esc(imeSaVerzijom(t))}</span>`,
              )
              .join("")}</dd>`,
          )
          .join("")}</dl>`;

  let wp = "";
  if (r.wordpress && (r.wordpress.teme.length || r.wordpress.dodaci.length)) {
    wp = `<h3>WordPress detalji</h3><dl class="tehnologije">
      ${r.wordpress.teme.length ? `<dt>Tema</dt><dd>${r.wordpress.teme.map((t) => `<span class="oznaka">${esc(t)}</span>`).join("")}</dd>` : ""}
      ${r.wordpress.dodaci.length ? `<dt>Dodaci (${r.wordpress.dodaci.length})</dt><dd>${r.wordpress.dodaci.map((d) => `<span class="oznaka">${esc(d)}</span>`).join("")}</dd>` : ""}
    </dl>`;
  }

  return `<section>
    <h2>Tehnologije</h2>
    <p class="pomoc">Pređi mišem preko oznake da vidiš po čemu je prepoznata.</p>
    ${sadrzaj}
    ${wp}
  </section>`;
}

function spoljniServisi(r) {
  if (r.spoljniServisi.length === 0) {
    return `<section><h2>Spoljni servisi</h2><p class="prazno">Sajt ne učitava ništa sa drugih domena.</p></section>`;
  }
  const redovi = r.spoljniServisi
    .map(
      (s) => `<tr>
        <td class="kod">${esc(s.host)}</td>
        <td>${s.servis ? esc(s.servis) : `<span class="priguseno">nepoznat</span>`}</td>
        <td>${s.kategorija ? esc(s.kategorija) : ""}</td>
        <td class="broj">${esc(s.resursa)}</td>
        <td>${esc(s.vrste.map((v) => VRSTE[v] ?? v).join(", "))}</td>
      </tr>`,
    )
    .join("");
  return `<section>
    <h2>Spoljni servisi</h2>
    <div class="tabela"><table>
      <thead><tr><th>Domen</th><th>Servis</th><th>Vrsta</th><th class="broj">Resursa</th><th>Šta učitava</th></tr></thead>
      <tbody>${redovi}</tbody>
    </table></div>
  </section>`;
}

function velicina(r) {
  if (!r.velicina) return "";
  const v = r.velicina;
  const delovi = [
    ["HTML", v.html, "html"],
    ["Skripte", v.skripte, "skripte"],
    ["Stilovi", v.stilovi, "stilovi"],
    ["Slike", v.slike, "slike"],
  ];
  const ukupno = Math.max(v.ukupno, 1);
  const traka = delovi
    .filter(([, bajtova]) => bajtova > 0)
    .map(
      ([ime, bajtova, klasa]) =>
        `<span class="deo ${klasa}" style="width:${((bajtova / ukupno) * 100).toFixed(2)}%" title="${esc(ime)}: ${esc(formatirajBajtove(bajtova))}"></span>`,
    )
    .join("");
  const legenda = delovi
    .map(
      ([ime, bajtova, klasa]) =>
        `<li><span class="tacka ${klasa}"></span>${esc(ime)} <strong>${esc(formatirajBajtove(bajtova))}</strong></li>`,
    )
    .join("");
  const neizmereno = v.neuspesno + v.preskoceno;
  return `<section>
    <h2>Veličina stranice</h2>
    <p class="velika">${esc(formatirajBajtove(v.ukupno))}</p>
    <div class="traka">${traka}</div>
    <ul class="legenda">${legenda}</ul>
    <p class="pomoc">Veličine su bez kompresije. Izmereno resursa: ${esc(v.izmereno)}${
      neizmereno > 0 ? `, nije izmereno: ${esc(neizmereno)} (stvarna veličina je veća)` : ""
    }.</p>
  </section>`;
}

function provere(r) {
  return listaProvera(r)
    .map(
      (sekcija) => `<section>
    <h2>${esc(sekcija.naslov)}</h2>
    <ul class="provere">${sekcija.stavke
      .map(
        (s) =>
          `<li class="${s.stanje}"><span class="ikona" aria-hidden="true">${OZNAKE[s.stanje]}</span>${esc(s.tekst)}</li>`,
      )
      .join("")}</ul>
  </section>`,
    )
    .join("");
}

function skripte(r) {
  const { lista, uStranici } = r.skripte;
  const redovi = lista
    .map(
      (s) => `<tr>
        <td class="kod url">${esc(s.url)}</td>
        <td>${s.spoljna ? "spoljna" : "sa sajta"}</td>
        <td>${s.servis ? esc(s.servis) : ""}</td>
        <td class="broj">${s.bajtova === null ? "" : esc(formatirajBajtove(s.bajtova))}</td>
      </tr>`,
    )
    .join("");
  return `<section>
    <h2>Skripte</h2>
    <p>Učitane: ${esc(lista.length)} · napisane direktno u stranici: ${esc(uStranici)}</p>
    ${
      lista.length
        ? `<details><summary>Prikaži sve skripte</summary><div class="tabela"><table>
      <thead><tr><th>Adresa</th><th>Poreklo</th><th>Servis</th><th class="broj">Veličina</th></tr></thead>
      <tbody>${redovi}</tbody>
    </table></div></details>`
        : ""
    }
  </section>`;
}

const STIL = `
:root {
  --pozadina: #f6f7f9; --povrsina: #ffffff; --tekst: #1d2330; --priguseno: #5f6878;
  --ivica: #e2e5eb; --akcenat: #2f5bd3;
  --ok: #1b7f4b; --upozorenje: #a86400; --problem: #c4302b;
  --html: #8a94a6; --skripte: #2f5bd3; --stilovi: #8e44ad; --slike: #1b9e77;
}
@media (prefers-color-scheme: dark) {
  :root {
    --pozadina: #12151c; --povrsina: #1b1f29; --tekst: #e6e9ef; --priguseno: #9aa3b2;
    --ivica: #2c3240; --akcenat: #7aa2ff;
    --ok: #4cc38a; --upozorenje: #f0b44c; --problem: #ff6b63;
    --html: #9aa3b2; --skripte: #7aa2ff; --stilovi: #c08bdc; --slike: #4cc3a3;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--pozadina); color: var(--tekst);
  font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 960px; margin: 0 auto; padding: 32px 16px 48px; }
a { color: var(--akcenat); word-break: break-all; }
header { margin-bottom: 24px; }
.nadnaslov { margin: 0; color: var(--priguseno); text-transform: uppercase; letter-spacing: .08em; font-size: 13px; }
h1 { margin: 4px 0 8px; font-size: 32px; word-break: break-word; }
.meta { margin: 0; color: var(--priguseno); font-size: 14px; }
.naslov-sajta { margin: 12px 0 0; font-style: italic; }
section { background: var(--povrsina); border: 1px solid var(--ivica); border-radius: 12px;
  padding: 20px; margin-bottom: 16px; }
h2 { margin: 0 0 12px; font-size: 20px; }
h3 { margin: 20px 0 8px; font-size: 16px; }
.pregled { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;
  background: none; border: 0; padding: 0; }
.plocica { background: var(--povrsina); border: 1px solid var(--ivica); border-radius: 12px; padding: 16px; }
.plocica .vrednost { display: block; font-size: 28px; font-weight: 600; }
.plocica .opis { color: var(--priguseno); font-size: 14px; }
.pomoc, .prazno, .priguseno { color: var(--priguseno); font-size: 14px; }
.tehnologije { display: grid; grid-template-columns: minmax(140px, 220px) 1fr; gap: 8px 16px; margin: 0; }
.tehnologije dt { color: var(--priguseno); font-size: 14px; padding-top: 3px; }
.tehnologije dd { margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.oznaka { border: 1px solid var(--ivica); border-radius: 999px; padding: 2px 10px; font-size: 14px; cursor: default; }
.tabela { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--ivica); vertical-align: top; }
th { color: var(--priguseno); font-weight: 500; }
.broj { text-align: right; white-space: nowrap; }
.kod { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
.url { word-break: break-all; }
.velika { font-size: 28px; font-weight: 600; margin: 0 0 8px; }
.traka { display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: var(--ivica); }
.deo.html, .tacka.html { background: var(--html); }
.deo.skripte, .tacka.skripte { background: var(--skripte); }
.deo.stilovi, .tacka.stilovi { background: var(--stilovi); }
.deo.slike, .tacka.slike { background: var(--slike); }
.legenda { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 14px; }
.tacka { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
.provere { list-style: none; padding: 0; margin: 0; }
.provere li { display: flex; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--ivica); }
.provere li:last-child { border-bottom: 0; }
.ikona { width: 20px; flex: none; font-weight: 700; text-align: center; }
.ok .ikona { color: var(--ok); }
.upozorenje .ikona { color: var(--upozorenje); }
.problem .ikona { color: var(--problem); }
.napomene { margin: 0; padding-left: 20px; }
details summary { cursor: pointer; color: var(--akcenat); margin-bottom: 8px; }
footer { color: var(--priguseno); font-size: 13px; text-align: center; margin-top: 24px; }
@media (max-width: 560px) {
  .tehnologije { grid-template-columns: 1fr; }
  .tehnologije dt { padding-top: 8px; }
}
`;
