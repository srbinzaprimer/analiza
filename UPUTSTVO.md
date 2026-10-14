# Uputstvo za pokretanje (za vlasnika repozitorijuma)

Sve se radi kroz pregledač, bez instaliranja bilo čega na računar. Ukupno oko 20 minuta.

## 1. Napravi besplatan YouTube API ključ

Ključ služi da GitHub svakog dana pita YouTube koje su nove epizode. Besplatan je i
dozvoljava 10.000 jedinica dnevno, a dnevno osvežavanje troši nekoliko desetina.

1. Otvori [console.cloud.google.com](https://console.cloud.google.com/) i prijavi se Google nalogom.
2. Gore levo klikni na izbor projekta, pa **New project**. Ime može biti `bolum`. Klikni **Create**.
3. U pretrazi na vrhu ukucaj **YouTube Data API v3**, otvori ga i klikni **Enable**.
4. Levo idi na **Credentials**, pa **Create credentials → API key**. Kopiraj ključ.
5. Na istom ekranu klikni na ključ, pa pod **API restrictions** izaberi
   **Restrict key** i označi samo **YouTube Data API v3**. Sačuvaj.
   Tako ključ ne može da se zloupotrebi za druge Google servise.

## 2. Dodaj ključ u GitHub

1. Na GitHub-u otvori repozitorijum, pa **Settings → Secrets and variables → Actions**.
2. Klikni **New repository secret**.
3. Za **Name** upiši tačno `YOUTUBE_API_KEY`, a za **Secret** nalepi ključ. Klikni **Add secret**.

Ključ je sada sakriven: ne vidi se u kodu, logovima ni u istoriji.

## 3. Napravi besplatan TMDB ključ (preporučeno)

Sa ovim ključem sajt dobija postere, opise na sva 4 jezika, žanrove, ocene, glumce i
spisak **gde se serija još legalno gleda** u tvojoj zemlji (Netflix, tabii, Disney+ i
druge platforme, podaci JustWatch-a). Bez ključa sajt radi, ali samo sa YouTube sličicama.

1. Napravi nalog na [themoviedb.org](https://www.themoviedb.org/signup) i potvrdi e-mail.
2. Otvori **Settings → API** ([themoviedb.org/settings/api](https://www.themoviedb.org/settings/api))
   i zatraži ključ (**Developer**, nekomercijalna upotreba). U formularu za adresu
   upiši adresu sajta iz koraka 4.
3. Kopiraj **API Key** (kraći) ili **API Read Access Token** (duži, počinje sa `eyJ`).
   Radi bilo koji.
4. Na GitHub-u dodaj novi secret kao u koraku 2, sa imenom tačno `TMDB_API_KEY`.

TMDB traži da se navede izvor podataka. Sajt to već radi u podnožju, uz napomenu da
podaci o dostupnosti dolaze od JustWatch-a.

## 4. Uključi GitHub Pages

GitHub Pages je besplatan za **javne** repozitorijume. Ako je repozitorijum privatan,
prvo ga učini javnim: **Settings → General → Danger Zone → Change visibility → Public**.

1. **Settings → Pages**.
2. Pod **Build and deployment → Source** izaberi **GitHub Actions**.

Adresa sajta biće `https://srbinzaprimer.github.io/analiza/`.
Ako preimenuješ repozitorijum u npr. `bolum` (**Settings → General → Repository name**),
adresa postaje `https://srbinzaprimer.github.io/bolum/`.

## 5. Prvo pokretanje

1. Otvori karticu **Actions**, levo izaberi **Osveži i objavi**, pa **Run workflow**.
2. Kad se završi, otvori pokretanje, pa posao **napravi** i korak
   **Osveži katalog sa YouTube-a**. Videćeš redove poput:

   ```
   Kandidat @kanald: "Kanal D" (12.345.678 pretplatnika). Nije potvrđen kao zvaničan, pa se preskače.
   ```

Sajt je već objavljen, ali je katalog prazan dok ne potvrdiš kanale.
U koraku **Dodaj podatke sa TMDB-a** videćeš koje serije su uparene sa TMDB-om.

## 6. Potvrdi zvanične kanale

U `katalog/kanali.json` su predlozi velikih turskih televizija. Nijedan nije uključen
dok ga ti ne potvrdiš, jer smemo da prikazujemo **samo zvanične** kanale.

Za svaki kanal:

1. Otvori `youtube.com/@ime` (npr. `youtube.com/@kanald`).
2. Proveri da pored imena kanala stoji **znak verifikacije** (✓).
3. Proveri da zvanični sajt te televizije vodi na baš taj kanal.
4. Proveri da kanal objavljuje **cele epizode** (videi od oko dva sata sa „Bölüm“ u nazivu).

Ako je sve u redu:

1. Na GitHub-u otvori `katalog/kanali.json` i klikni olovku (**Edit**).
2. Kod tog kanala promeni `"potvrdjeno": false` u `"potvrdjeno": true`.
3. Ako kanal ima pogrešno @ime, ispravi `handle`.
4. Ako kanal objavljuje titlove, upiši jezike, npr. `"titlovi": ["en", "ar"]`.
5. Klikni **Commit changes**.

Izmena sama pokreće osvežavanje i objavu. Za par minuta epizode su na sajtu.

## 7. Dodavanje novih kanala

Dodaj novi unos u `katalog/kanali.json`:

```json
{
  "handle": "@imekanala",
  "ime": "Ime televizije",
  "jezik": "tr",
  "titlovi": [],
  "potvrdjeno": false
}
```

Prvo ga ostavi na `false`, pokreni **Osveži i objavi** i u logu proveri koji je kanal
pronađen. Zatim ga potvrdi kao u koraku 6. Dobri kandidati su i kanali produkcijskih
kuća i distributera koji objavljuju epizode sa titlovima na drugim jezicima.

## 8. Ako je serija pogrešno uparena sa TMDB-om

Serije se uparuju po turskom imenu i godini prve epizode. Ako stranica serije
prikazuje pogrešan poster ili opis (npr. stariju seriju istog imena):

1. Na [themoviedb.org](https://www.themoviedb.org/) pronađi pravu seriju. Broj u adresi
   (`themoviedb.org/tv/12345-...`) je njen TMDB broj.
2. ID serije na sajtu je deo adrese posle `serija/`, npr. `kanald-yali-capkini`.
3. U `katalog/serije.json` dodaj ispravku:

   ```json
   "ispravke": {
     "kanald-yali-capkini": { "tmdb": 12345 }
   }
   ```

   `"tmdb": null` potpuno isključuje TMDB podatke za tu seriju.

## 9. Stremio

Adresa dodatka je adresa sajta + `stremio/manifest.json`, npr.
`https://srbinzaprimer.github.io/analiza/stremio/manifest.json`.
Na dnu sajta su dugmad **Dodaj u Stremio** i **Kopiraj adresu dodatka**.

## Kako da znam da sve radi

- Zelena pokretanja u kartici **Actions** znače da je sve u redu.
- Ako osvežavanje ne uspe (npr. pogrešan ključ), pokretanje je crveno, a GitHub ti
  šalje e-mail. Sajt i dalje radi sa poslednjim dobrim katalogom.
- Na dnu sajta piše kada je katalog poslednji put promenjen.

## Česta pitanja

**Da li ovo košta?** Ne. GitHub Pages, GitHub Actions, YouTube API i TMDB API su besplatni u ovom obimu.

**Da li je legalno?** Sajt ne skida i ne kopira videe. Prikazuje samo ono što
televizije same besplatno objavljuju, u YouTube-ovom plejeru. Pregledi i reklame idu
vlasnicima, a važe i njihova ograničenja po zemljama. Zato je važno uključivati samo
zvanične kanale.

**Kako rade titlovi?** Kad kanal objavi titlove, sajt ih uključuje sam, na jeziku
sajta (ako postoje na tom jeziku). Na karticama i epizodama piše na kojim jezicima su
titlovi, a na početnoj je red „Sa titlovima“ za jezik sajta. Ako titlova na tvom
jeziku nema, u plejeru uključi **CC**, pa **Podešavanja → Titlovi → Automatski
prevod** i izaberi jezik. Sajt ne hostuje titlove koje su pravili fanovi, jer bi to
kršilo autorska prava.

**Zašto nije samo YouTube?** Epizode se puštaju sa zvaničnih YouTube kanala jer su
tamo besplatne i legalne. Za svaku seriju sajt pokazuje i gde se još legalno gleda u
izabranoj zemlji (pretplata, besplatno, uz reklame, najam, kupovina), po podacima
JustWatch-a preko TMDB-a. Piratski izvori se ne dodaju.

**GitHub je isključio dnevno pokretanje.** GitHub gasi zakazana pokretanja posle 60
dana bez aktivnosti u repozitorijumu. Uključi ih ponovo u kartici **Actions**
(dugme **Enable workflow**) ili napravi bilo kakvu izmenu u repozitorijumu.

**Kako da probam sajt kod sebe?** Instaliraj Node.js 22+, pa u folderu projekta pokreni
`npm run primer` i otvori `http://localhost:8080`. Tu su izmišljene serije, opisi,
glumci i platforme, samo za izgled.
