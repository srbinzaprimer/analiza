// Prevodi interfejsa. Tekst je običan tekst: pre ubacivanja u HTML ide kroz esc().

const PREVODI = {
  en: {
    jezikIme: "English",
    preskoci: "Skip to content",
    pretraga: "Search series",
    pocetna: "Home",
    mojaLista: "My list",
    slogan: "Turkish dramas. Full episodes. Official and free.",
    podslogan:
      "Every episode that broadcasters publish for free on their official YouTube channels, organized by series.",
    nastaviGledanje: "Continue watching",
    noveEpizode: "New episodes",
    sveSerije: "All series",
    sviKanali: "All channels",
    epizoda: "Episode {n}",
    sezona: "Season {n}",
    sezone: "Seasons",
    brojEpizoda: { one: "{n} episode", other: "{n} episodes" },
    gledaj: "Watch",
    gledajEpizodu: "Watch episode {n}",
    nastaviEpizodu: "Continue episode {n}",
    uListi: "In my list",
    podeli: "Share",
    linkKopiran: "Link copied",
    prethodna: "Previous",
    sledeca: "Next episode",
    sledecaZa: "Next episode in {s} s",
    otkazi: "Cancel",
    naYoutubeu: "Watch on YouTube",
    odgledano: "Watched",
    titlovi: "Subtitles",
    ograniceno: "Not available in every country",
    novo: "New",
    prazanKatalogNaslov: "The catalog is being prepared",
    prazanKatalogTekst: "Episodes appear here automatically as official channels are added.",
    nemaRezultata: "No series match “{q}”.",
    praznaLista: "Your list is empty. Use the “My list” button on a series to save it here.",
    nijePronadjena: "This series is no longer in the catalog.",
    stranaNePostoji: "Page not found.",
    greskaUcitavanja: "The catalog could not be loaded. Check your connection and try again.",
    pokusajPonovo: "Try again",
    stremioNaslov: "Also in Stremio",
    stremioTekst: "Add the same catalog to the Stremio app.",
    dodajUStremio: "Add to Stremio",
    kopirajAdresu: "Copy addon address",
    oProjektu:
      "Bölüm lists full episodes that broadcasters publish for free on their official YouTube channels. Videos play in YouTube's player and belong to their owners. Not affiliated with YouTube or any broadcaster.",
    izvorniKod: "Source code",
    azurirano: "Catalog updated {datum}",
    jezik: "Language",
    nazad: "All series",
    plejerGreska: "This video can't be played here.",
  },
  sr: {
    jezikIme: "Srpski",
    preskoci: "Preskoči na sadržaj",
    pretraga: "Pretraži serije",
    pocetna: "Početna",
    mojaLista: "Moja lista",
    slogan: "Turske serije. Cele epizode. Zvanično i besplatno.",
    podslogan:
      "Sve epizode koje televizije besplatno objavljuju na svojim zvaničnim YouTube kanalima, sređene po serijama.",
    nastaviGledanje: "Nastavi gledanje",
    noveEpizode: "Nove epizode",
    sveSerije: "Sve serije",
    sviKanali: "Svi kanali",
    epizoda: "{n}. epizoda",
    sezona: "{n}. sezona",
    sezone: "Sezone",
    brojEpizoda: { one: "{n} epizoda", few: "{n} epizode", other: "{n} epizoda" },
    gledaj: "Gledaj",
    gledajEpizodu: "Gledaj {n}. epizodu",
    nastaviEpizodu: "Nastavi {n}. epizodu",
    uListi: "U mojoj listi",
    podeli: "Podeli",
    linkKopiran: "Link je kopiran",
    prethodna: "Prethodna",
    sledeca: "Sledeća epizoda",
    sledecaZa: "Sledeća epizoda za {s} s",
    otkazi: "Otkaži",
    naYoutubeu: "Gledaj na YouTube-u",
    odgledano: "Odgledano",
    titlovi: "Titlovi",
    ograniceno: "Nije dostupno u svim zemljama",
    novo: "Novo",
    prazanKatalogNaslov: "Katalog se priprema",
    prazanKatalogTekst: "Epizode se ovde pojavljuju automatski kako se dodaju zvanični kanali.",
    nemaRezultata: "Nijedna serija ne odgovara pojmu „{q}“.",
    praznaLista: "Tvoja lista je prazna. Klikni „Moja lista“ na stranici serije da je sačuvaš ovde.",
    nijePronadjena: "Ova serija više nije u katalogu.",
    stranaNePostoji: "Stranica ne postoji.",
    greskaUcitavanja: "Katalog nije mogao da se učita. Proveri vezu i pokušaj ponovo.",
    pokusajPonovo: "Pokušaj ponovo",
    stremioNaslov: "Ima i u Stremiju",
    stremioTekst: "Dodaj isti katalog u aplikaciju Stremio.",
    dodajUStremio: "Dodaj u Stremio",
    kopirajAdresu: "Kopiraj adresu dodatka",
    oProjektu:
      "Bölüm prikazuje cele epizode koje televizije besplatno objavljuju na svojim zvaničnim YouTube kanalima. Videi se puštaju u YouTube plejeru i pripadaju svojim vlasnicima. Projekat nije povezan sa YouTube-om ni sa televizijama.",
    izvorniKod: "Izvorni kod",
    azurirano: "Katalog ažuriran {datum}",
    jezik: "Jezik",
    nazad: "Sve serije",
    plejerGreska: "Ovaj video ne može da se pusti ovde.",
  },
  tr: {
    jezikIme: "Türkçe",
    preskoci: "İçeriğe geç",
    pretraga: "Dizi ara",
    pocetna: "Ana sayfa",
    mojaLista: "Listem",
    slogan: "Türk dizileri. Tüm bölümler. Resmî ve ücretsiz.",
    podslogan:
      "Kanalların resmî YouTube hesaplarında ücretsiz yayınladığı tüm bölümler, dizi dizi düzenlenmiş.",
    nastaviGledanje: "İzlemeye devam et",
    noveEpizode: "Yeni bölümler",
    sveSerije: "Tüm diziler",
    sviKanali: "Tüm kanallar",
    epizoda: "{n}. Bölüm",
    sezona: "{n}. Sezon",
    sezone: "Sezonlar",
    brojEpizoda: { other: "{n} bölüm" },
    gledaj: "İzle",
    gledajEpizodu: "{n}. bölümü izle",
    nastaviEpizodu: "{n}. bölüme devam et",
    uListi: "Listemde",
    podeli: "Paylaş",
    linkKopiran: "Bağlantı kopyalandı",
    prethodna: "Önceki",
    sledeca: "Sonraki bölüm",
    sledecaZa: "Sonraki bölüm {s} sn içinde",
    otkazi: "İptal",
    naYoutubeu: "YouTube'da izle",
    odgledano: "İzlendi",
    titlovi: "Altyazı",
    ograniceno: "Her ülkede izlenemeyebilir",
    novo: "Yeni",
    prazanKatalogNaslov: "Katalog hazırlanıyor",
    prazanKatalogTekst: "Resmî kanallar eklendikçe bölümler burada otomatik olarak görünür.",
    nemaRezultata: "“{q}” ile eşleşen dizi yok.",
    praznaLista: "Listen boş. Bir diziyi buraya kaydetmek için dizi sayfasındaki “Listem” düğmesini kullan.",
    nijePronadjena: "Bu dizi artık katalogda yok.",
    stranaNePostoji: "Sayfa bulunamadı.",
    greskaUcitavanja: "Katalog yüklenemedi. Bağlantını kontrol edip tekrar dene.",
    pokusajPonovo: "Tekrar dene",
    stremioNaslov: "Stremio'da da var",
    stremioTekst: "Aynı kataloğu Stremio uygulamasına ekle.",
    dodajUStremio: "Stremio'ya ekle",
    kopirajAdresu: "Eklenti adresini kopyala",
    oProjektu:
      "Bölüm, kanalların resmî YouTube hesaplarında ücretsiz yayınladığı tam bölümleri listeler. Videolar YouTube oynatıcısında oynatılır ve sahiplerine aittir. YouTube veya herhangi bir kanalla bağlantılı değildir.",
    izvorniKod: "Kaynak kodu",
    azurirano: "Katalog güncellendi: {datum}",
    jezik: "Dil",
    nazad: "Tüm diziler",
    plejerGreska: "Bu video burada oynatılamıyor.",
  },
  es: {
    jezikIme: "Español",
    preskoci: "Saltar al contenido",
    pretraga: "Buscar series",
    pocetna: "Inicio",
    mojaLista: "Mi lista",
    slogan: "Series turcas. Episodios completos. Oficiales y gratis.",
    podslogan:
      "Todos los episodios que los canales publican gratis en sus canales oficiales de YouTube, ordenados por serie.",
    nastaviGledanje: "Seguir viendo",
    noveEpizode: "Episodios nuevos",
    sveSerije: "Todas las series",
    sviKanali: "Todos los canales",
    epizoda: "Episodio {n}",
    sezona: "Temporada {n}",
    sezone: "Temporadas",
    brojEpizoda: { one: "{n} episodio", other: "{n} episodios" },
    gledaj: "Ver",
    gledajEpizodu: "Ver episodio {n}",
    nastaviEpizodu: "Seguir con el episodio {n}",
    uListi: "En mi lista",
    podeli: "Compartir",
    linkKopiran: "Enlace copiado",
    prethodna: "Anterior",
    sledeca: "Siguiente episodio",
    sledecaZa: "Siguiente episodio en {s} s",
    otkazi: "Cancelar",
    naYoutubeu: "Ver en YouTube",
    odgledano: "Visto",
    titlovi: "Subtítulos",
    ograniceno: "No disponible en todos los países",
    novo: "Nuevo",
    prazanKatalogNaslov: "Estamos preparando el catálogo",
    prazanKatalogTekst:
      "Los episodios aparecen aquí automáticamente a medida que se agregan canales oficiales.",
    nemaRezultata: "Ninguna serie coincide con «{q}».",
    praznaLista: "Tu lista está vacía. Usa el botón «Mi lista» en una serie para guardarla aquí.",
    nijePronadjena: "Esta serie ya no está en el catálogo.",
    stranaNePostoji: "Página no encontrada.",
    greskaUcitavanja: "No se pudo cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.",
    pokusajPonovo: "Reintentar",
    stremioNaslov: "También en Stremio",
    stremioTekst: "Agrega el mismo catálogo a la app Stremio.",
    dodajUStremio: "Agregar a Stremio",
    kopirajAdresu: "Copiar dirección del addon",
    oProjektu:
      "Bölüm reúne los episodios completos que los canales publican gratis en sus canales oficiales de YouTube. Los videos se reproducen en el reproductor de YouTube y pertenecen a sus dueños. No está afiliado a YouTube ni a ningún canal.",
    izvorniKod: "Código fuente",
    azurirano: "Catálogo actualizado el {datum}",
    jezik: "Idioma",
    nazad: "Todas las series",
    plejerGreska: "Este video no se puede reproducir aquí.",
  },
};

export const JEZICI = Object.keys(PREVODI);
const LOKALI = { en: "en", sr: "sr-Latn", tr: "tr", es: "es" };
const KLJUC = "bolum:jezik";

let trenutni = pocetniJezik();

function pocetniJezik() {
  try {
    const sacuvan = localStorage.getItem(KLJUC);
    if (JEZICI.includes(sacuvan)) return sacuvan;
  } catch {
    // Bez pristupa skladištu biramo po pregledaču.
  }
  for (const oznaka of navigator.languages ?? [navigator.language]) {
    const osnovni = String(oznaka).toLowerCase().split("-")[0];
    // Hrvatski, bosanski i crnogorski čitaoci razumeju srpsku latinicu.
    const jezik = ["hr", "bs", "cnr"].includes(osnovni) ? "sr" : osnovni;
    if (JEZICI.includes(jezik)) return jezik;
  }
  return "en";
}

export function jezik() {
  return trenutni;
}

export function imeJezika(kod) {
  return PREVODI[kod].jezikIme;
}

export function postaviJezik(kod) {
  if (!JEZICI.includes(kod)) return;
  trenutni = kod;
  try {
    localStorage.setItem(KLJUC, kod);
  } catch {
    // Izbor važi do zatvaranja stranice.
  }
}

/** t("epizoda", { n: 5 }) → "Episode 5" */
export function t(kljuc, parametri = {}) {
  let tekst = PREVODI[trenutni][kljuc] ?? PREVODI.en[kljuc] ?? kljuc;
  if (typeof tekst === "object") {
    const oblik = new Intl.PluralRules(LOKALI[trenutni]).select(parametri.n ?? 0);
    tekst = tekst[oblik] ?? tekst.other;
  }
  return tekst.replace(/\{(\w+)\}/g, (_, ime) => String(parametri[ime] ?? ""));
}

export function datum(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(LOKALI[trenutni], { dateStyle: "medium" }).format(d);
}

/** "pre 3 dana" za skorije datume, inače običan datum. */
export function relativno(iso, sada = Date.now()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sati = (d.getTime() - sada) / 3_600_000;
  const rtf = new Intl.RelativeTimeFormat(LOKALI[trenutni], { numeric: "auto" });
  if (sati > -24) return rtf.format(Math.min(0, Math.round(sati)), "hour");
  if (sati > -24 * 14) return rtf.format(Math.round(sati / 24), "day");
  return datum(iso);
}

/** 7512 → "2:05:12" */
export function trajanje(sekundi) {
  if (!Number.isFinite(sekundi) || sekundi <= 0) return "";
  const s = Math.round(sekundi);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
