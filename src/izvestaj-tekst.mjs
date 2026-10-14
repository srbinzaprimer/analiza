// Kratak izveštaj za terminal.

import {
  formatirajBajtove,
  imeSaVerzijom,
  listaProvera,
  mnozina,
  tehnologijePoKategoriji,
} from "./izvestaj.mjs";

const OZNAKE = { ok: "✓", upozorenje: "!", problem: "✗" };

export function tekstualniIzvestaj(r) {
  const redovi = [];
  // Velikim slovima samo ime odeljka, ne i dopuna u zagradi.
  const naslov = (tekst) =>
    redovi.push("", tekst.replace(/^[^(]+/, (ime) => ime.toUpperCase()));

  redovi.push(`Sajt:   ${new URL(r.konacnaAdresa).hostname}`);
  redovi.push(
    `Adresa: ${r.konacnaAdresa} (status ${r.status}, odgovor za ${r.vremeOdgovoraMs} ms)`,
  );
  // Naslov dolazi sa sajta: kontrolni znakovi bi mogli da poremete terminal.
  if (r.naslov) redovi.push(`Naslov: ${r.naslov.replace(/[\u0000-\u001f\u007f-\u009f]/g, "")}`);

  naslov("Tehnologije");
  const grupe = tehnologijePoKategoriji(r.tehnologije);
  if (grupe.length === 0) redovi.push("  Nijedna poznata tehnologija nije prepoznata.");
  const sirina = Math.max(0, ...grupe.map((g) => g.kategorija.length)) + 2;
  for (const g of grupe) {
    redovi.push(
      `  ${(g.kategorija + ":").padEnd(sirina)}${g.stavke.map(imeSaVerzijom).join(", ")}`,
    );
  }
  if (r.wordpress) {
    if (r.wordpress.teme.length > 0) {
      redovi.push(`  WordPress tema: ${r.wordpress.teme.join(", ")}`);
    }
    if (r.wordpress.dodaci.length > 0) {
      redovi.push(
        `  WordPress dodaci (${r.wordpress.dodaci.length}): ${r.wordpress.dodaci.join(", ")}`,
      );
    }
  }

  naslov("Skripte");
  redovi.push(
    `  Učitane: ${r.skripte.saAdresom} (sa drugih domena: ${r.skripte.spoljne}) · ` +
      `napisane u samoj stranici: ${r.skripte.uStranici}`,
  );

  naslov(`Spoljni servisi (${mnozina(r.spoljniServisi.length, "domen", "domena", "domena")})`);
  if (r.spoljniServisi.length === 0) redovi.push("  Sajt ne učitava ništa sa drugih domena.");
  const sirinaHosta = Math.max(0, ...r.spoljniServisi.map((s) => s.host.length)) + 2;
  for (const s of r.spoljniServisi) {
    const opis = s.servis ? `${s.servis} (${s.kategorija})` : "nepoznat servis";
    redovi.push(`  ${s.host.padEnd(sirinaHosta)}${opis}`);
  }

  if (r.velicina) {
    const v = r.velicina;
    naslov("Veličina stranice (bez kompresije)");
    redovi.push(
      `  HTML ${formatirajBajtove(v.html)} · skripte ${formatirajBajtove(v.skripte)} · ` +
        `stilovi ${formatirajBajtove(v.stilovi)} · slike ${formatirajBajtove(v.slike)}`,
    );
    redovi.push(`  Ukupno: ${formatirajBajtove(v.ukupno)}`);
    const neizmereno = v.neuspesno + v.preskoceno;
    if (neizmereno > 0) {
      redovi.push(`  Nije izmereno resursa: ${neizmereno}, pa je stvarna veličina veća.`);
    }
  }

  for (const sekcija of listaProvera(r)) {
    naslov(sekcija.naslov);
    for (const s of sekcija.stavke) redovi.push(`  ${OZNAKE[s.stanje]} ${s.tekst}`);
  }

  naslov("Napomene");
  for (const n of r.napomene) redovi.push(`  • ${n}`);

  return redovi.join("\n");
}
