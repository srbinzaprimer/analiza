// Tumačenje rezultata zajedničko za tekstualni i HTML izveštaj.

const broj = new Intl.NumberFormat("sr-Latn", { maximumFractionDigits: 1 });
const pravilaMnozine = new Intl.PluralRules("sr-Latn");

/** Broj sa imenicom u pravom obliku: mnozina(31, "znak", "znaka", "znakova"). */
export function mnozina(n, jedan, dvaDoCetiri, ostalo) {
  const oblik = { one: jedan, few: dvaDoCetiri }[pravilaMnozine.select(n)] ?? ostalo;
  return `${n} ${oblik}`;
}

const znakova = (n) => mnozina(n, "znak", "znaka", "znakova");

export function formatirajBajtove(bajtova) {
  if (bajtova < 1024) return `${bajtova} B`;
  if (bajtova < 1024 * 1024) return `${Math.round(bajtova / 1024)} KB`;
  return `${broj.format(bajtova / (1024 * 1024))} MB`;
}

/** Tehnologije grupisane po kategoriji, kategorije redom kojim su nađene. */
export function tehnologijePoKategoriji(tehnologije) {
  const grupe = new Map();
  for (const t of tehnologije) {
    if (!grupe.has(t.kategorija)) grupe.set(t.kategorija, []);
    grupe.get(t.kategorija).push(t);
  }
  return [...grupe.entries()].map(([kategorija, stavke]) => ({ kategorija, stavke }));
}

export function imeSaVerzijom(tehnologija) {
  return tehnologija.verzija
    ? `${tehnologija.ime} ${tehnologija.verzija}`
    : tehnologija.ime;
}

/**
 * Pretvara SEO i bezbednosne nalaze u stavke za čitanje.
 * Stanje je "ok", "upozorenje" ili "problem".
 */
export function listaProvera(rezultat) {
  return [
    { naslov: "SEO (pretraživači)", stavke: seoStavke(rezultat.seo) },
    { naslov: "Bezbednost", stavke: bezbednostStavke(rezultat.bezbednost) },
  ];
}

const ok = (tekst) => ({ stanje: "ok", tekst });
const upozorenje = (tekst) => ({ stanje: "upozorenje", tekst });
const problem = (tekst) => ({ stanje: "problem", tekst });

function seoStavke(seo) {
  const stavke = [];

  const duzinaNaslova = seo.naslov.duzina;
  if (duzinaNaslova === 0) stavke.push(problem("Stranica nema naslov (<title>)"));
  else if (duzinaNaslova < 10 || duzinaNaslova > 70)
    stavke.push(upozorenje(`Naslov ima ${znakova(duzinaNaslova)} (preporuka: 10–70)`));
  else stavke.push(ok(`Naslov stranice (${znakova(duzinaNaslova)})`));

  const duzinaOpisa = seo.opis.duzina;
  if (seo.opis.tekst === null) stavke.push(problem("Nema opisa za pretraživače (meta description)"));
  else if (duzinaOpisa < 50 || duzinaOpisa > 160)
    stavke.push(upozorenje(`Opis ima ${znakova(duzinaOpisa)} (preporuka: 50–160)`));
  else stavke.push(ok(`Opis za pretraživače (${znakova(duzinaOpisa)})`));

  if (seo.h1.broj === 0) stavke.push(problem("Nema glavnog naslova (H1)"));
  else if (seo.h1.broj > 1)
    stavke.push(upozorenje(`Ima ${seo.h1.broj} H1 naslova (preporuka: jedan)`));
  else stavke.push(ok("Jedan glavni naslov (H1)"));

  stavke.push(
    seo.jezik
      ? ok(`Jezik stranice: ${seo.jezik}`)
      : upozorenje("Jezik stranice nije naveden (lang)"),
  );
  stavke.push(
    seo.viewport
      ? ok("Prilagođeno telefonima (viewport)")
      : problem("Nema viewport oznake, pa se loše prikazuje na telefonima"),
  );
  stavke.push(
    seo.canonical
      ? ok("Kanonska adresa (canonical)")
      : upozorenje("Nema kanonske adrese (canonical)"),
  );

  const og = seo.openGraph;
  const nedostajeOg = [
    !og.naslov && "og:title",
    !og.opis && "og:description",
    !og.slika && "og:image",
  ].filter(Boolean);
  if (nedostajeOg.length === 0) stavke.push(ok("Pregled pri deljenju na mrežama (Open Graph)"));
  else if (nedostajeOg.length === 3)
    stavke.push(upozorenje("Nema Open Graph oznaka (pregled pri deljenju na mrežama)"));
  else stavke.push(upozorenje(`Open Graph nije potpun, nedostaje: ${nedostajeOg.join(", ")}`));

  if (seo.slike.ukupno > 0) {
    stavke.push(
      seo.slike.bezAlt === 0
        ? ok(`Sve slike imaju alt tekst (${seo.slike.ukupno})`)
        : upozorenje(`Slike bez alt teksta: ${seo.slike.bezAlt} od ${seo.slike.ukupno}`),
    );
  }
  stavke.push(
    seo.strukturiraniPodaci > 0
      ? ok(`Strukturirani podaci (JSON-LD): ${seo.strukturiraniPodaci}`)
      : upozorenje("Nema strukturiranih podataka (JSON-LD)"),
  );
  if (seo.noindex) {
    stavke.push(problem("Stranica je skrivena od pretraživača (noindex)"));
  }
  stavke.push(seo.robotsTxt ? ok("Postoji robots.txt") : upozorenje("Nema robots.txt"));
  stavke.push(
    seo.sitemap.postoji
      ? ok("Postoji mapa sajta (sitemap)")
      : upozorenje("Nije pronađena mapa sajta (sitemap)"),
  );
  return stavke;
}

function bezbednostStavke(b) {
  const stavke = [
    b.https ? ok("Koristi HTTPS") : problem("Sajt ne koristi HTTPS"),
    b.hsts
      ? ok("HSTS (pregledač uvek koristi HTTPS)")
      : upozorenje("Nema HSTS zaglavlja"),
    b.csp
      ? ok("Content-Security-Policy")
      : upozorenje("Nema Content-Security-Policy zaglavlja"),
    b.zastitaOdUokvirivanja
      ? ok("Zaštita od ubacivanja u tuđi sajt (X-Frame-Options)")
      : upozorenje("Nema zaštite od ubacivanja u tuđi sajt (X-Frame-Options)"),
    b.nosniff
      ? ok("X-Content-Type-Options: nosniff")
      : upozorenje("Nema X-Content-Type-Options zaglavlja"),
    b.referrerPolicy
      ? ok("Referrer-Policy")
      : upozorenje("Nema Referrer-Policy zaglavlja"),
  ];
  if (b.mesovitSadrzaj > 0) {
    stavke.push(
      problem(`Resursi koji se učitavaju preko nezaštićenog http://: ${b.mesovitSadrzaj}`),
    );
  }
  for (const zaglavlje of b.otkrivaVerzije) {
    stavke.push(upozorenje(`Server otkriva verziju softvera (${zaglavlje})`));
  }
  return stavke;
}
