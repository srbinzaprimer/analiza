// YouTube plejer preko zvaničnog IFrame API-ja: pamti dokle se stiglo i javlja
// kraj epizode. Ako API ne može da se učita (npr. blokator), pada na običan
// ugrađeni plejer, bez pamćenja napretka.

const API_ADRESA = "https://www.youtube.com/iframe_api";
const DOMACIN = "https://www.youtube-nocookie.com";
const ROK_UCITAVANJA_MS = 8_000;
const PRIJAVA_NAPRETKA_MS = 5_000;

let ucitavanje = null;

function ucitajApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  ucitavanje ??= new Promise((resolve, reject) => {
    let rok;
    const neuspeh = (greska) => {
      clearTimeout(rok);
      ucitavanje = null;
      reject(greska);
    };
    rok = setTimeout(
      () => neuspeh(new Error("YouTube API se nije učitao na vreme")),
      ROK_UCITAVANJA_MS,
    );
    const prethodni = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(rok);
      prethodni?.();
      resolve(window.YT);
    };
    const skripta = document.createElement("script");
    skripta.src = API_ADRESA;
    skripta.async = true;
    skripta.onerror = () => neuspeh(new Error("YouTube API nije dostupan"));
    document.head.append(skripta);
  });
  return ucitavanje;
}

/**
 * Parametri YouTube plejera. Titlovi: cc_load_policy ih uključuje odmah, a
 * cc_lang_pref bira jezik (ako kanal ima titlove na tom jeziku).
 */
function parametriPlejera({ pocetak, titlovi, jezikInterfejsa }) {
  const p = { autoplay: 1, rel: 0, playsinline: 1, start: Math.max(0, Math.floor(pocetak)) };
  if (jezikInterfejsa) p.hl = jezikInterfejsa;
  if (titlovi) {
    p.cc_load_policy = 1;
    p.cc_lang_pref = titlovi;
  }
  return p;
}

/** Običan ugrađeni plejer kad API nije dostupan. */
function obicanPlejer(element, videoId, naslov, parametri, naSpremnosti) {
  const upit = new URLSearchParams(
    Object.entries(parametri)
      .filter(([ime, vrednost]) => !(ime === "start" && vrednost === 0))
      .map(([ime, vrednost]) => [ime, String(vrednost)]),
  );
  const okvir = document.createElement("iframe");
  okvir.src = `${DOMACIN}/embed/${encodeURIComponent(videoId)}?${upit}`;
  okvir.title = naslov;
  okvir.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  okvir.referrerPolicy = "strict-origin-when-cross-origin";
  okvir.addEventListener("load", () => naSpremnosti?.(), { once: true });
  element.replaceWith(okvir);
  return BEZ_PLEJERA;
}

const BEZ_PLEJERA = Object.freeze({ sacuvaj() {}, unisti() {}, postaviTitlove: () => false });

// ── Titlovi ─────────────────────────────────────────────────────────
// YouTube plejer ima modul "captions" sa spiskom titlova videa i jezika na
// koje YouTube ume automatski da prevede. To nije zvanično dokumentovan deo
// API-ja, pa je svaki poziv zaštićen: ako ne radi, ostaju cc_load_policy i
// cc_lang_pref iz parametara plejera.

const osnovni = (kod) => String(kod ?? "").toLowerCase().split(/[-_]/)[0];

function citajTitlove(plejer) {
  try {
    const izvorni = plejer.getOption?.("captions", "tracklist");
    const prevodi = plejer.getOption?.("captions", "translationLanguages");
    return {
      izvorni: Array.isArray(izvorni) ? izvorni.filter((x) => x?.languageCode) : [],
      prevodi: Array.isArray(prevodi) ? prevodi.filter((x) => x?.languageCode) : [],
    };
  } catch {
    return { izvorni: [], prevodi: [] };
  }
}

/**
 * Bira titl za jezik: titl kanala na tom jeziku (ručno pravljen pre
 * automatskog), inače automatski prevod nekog postojećeg titla.
 * @returns {{ titl: object, prevod: boolean } | null}
 */
export function izaberiTitl({ izvorni, prevodi }, kod) {
  const cilj = osnovni(kod);
  const naJeziku = izvorni.filter((x) => osnovni(x.languageCode) === cilj);
  const isti = naJeziku.find((x) => x.kind !== "asr") ?? naJeziku[0];
  if (isti) return { titl: isti, prevod: false };

  const prevodiv = izvorni.filter((x) => x.is_translateable !== false);
  const izvor = prevodiv.find((x) => x.kind !== "asr") ?? prevodiv[0];
  const jezik = prevodi.find((x) => osnovni(x.languageCode) === cilj);
  if (izvor && jezik) return { titl: { ...izvor, translationLanguage: jezik }, prevod: true };
  return null;
}

/**
 * @param {HTMLElement} element mesto gde ide plejer (biće zamenjen)
 * @param {{
 *   videoId: string, naslov: string, pocetak?: number,
 *   titlovi?: string | null,     jezik titlova, ili null bez titlova
 *   jezikInterfejsa?: string,
 *   naNapretku?: (t: number, d: number) => void,
 *   naKraju?: () => void,
 *   naGresci?: (kod: number) => void,
 *   naSpremnosti?: () => void,   plejer je spreman (naslovna slika može da se skloni)
 *   naTitlovima?: (stanje: { izvorni: {kod: string, ime: string, auto: boolean}[],
 *     prevodi: {kod: string, ime: string}[], aktivni: {kod: string, prevod: boolean} | null }) => void,
 * }} opcije
 * @returns {Promise<{ sacuvaj(): void, unisti(): void, postaviTitlove(kod: string | null): boolean }>}
 *   postaviTitlove vraća false kad titlovi ne mogu da se promene bez ponovnog pokretanja
 */
export async function napraviPlejer(element, opcije) {
  const {
    videoId,
    naslov,
    pocetak = 0,
    titlovi = null,
    jezikInterfejsa,
    naNapretku,
    naKraju,
    naGresci,
    naSpremnosti,
    naTitlovima,
  } = opcije;
  const parametri = parametriPlejera({ pocetak, titlovi, jezikInterfejsa });

  let YT;
  try {
    YT = await ucitajApi();
  } catch {
    if (!element.isConnected) return BEZ_PLEJERA;
    return obicanPlejer(element, videoId, naslov, parametri, naSpremnosti);
  }
  // Korisnik je u međuvremenu otišao na drugu stranu.
  if (!element.isConnected) return BEZ_PLEJERA;

  let interval = null;
  let unisten = false;
  let poslednje = null;
  let spreman = false;
  // Jezik titlova koji korisnik želi; primenjuje se čim YouTube javi spisak titlova.
  let zeljeni = titlovi;
  let aktivni = null;

  const javiTitlove = (spisak) =>
    naTitlovima?.({
      izvorni: spisak.izvorni.map((x) => ({
        kod: osnovni(x.languageCode),
        ime: x.languageName || x.displayName || x.languageCode,
        auto: x.kind === "asr",
      })),
      prevodi: spisak.prevodi.map((x) => ({ kod: osnovni(x.languageCode), ime: x.languageName || x.languageCode })),
      aktivni,
    });

  // onApiChange stiže više puta (i posle setOption), pa se isti izbor ne primenjuje ponovo.
  let primenjeno = null;
  const primeniTitlove = (prisilno = false) => {
    const spisak = citajTitlove(plejer);
    const kljuc = `${zeljeni}|${spisak.izvorni.map((x) => x.languageCode).join(",")}`;
    if (!prisilno && kljuc === primenjeno) return;
    primenjeno = kljuc;
    if (spisak.izvorni.length === 0) return javiTitlove(spisak);
    try {
      if (!zeljeni) {
        plejer.setOption("captions", "track", {});
        aktivni = null;
      } else {
        const izbor = izaberiTitl(spisak, zeljeni);
        if (izbor) {
          plejer.setOption("captions", "track", izbor.titl);
          aktivni = { kod: osnovni(zeljeni), prevod: izbor.prevod };
        }
      }
    } catch {
      // Nezvaničan deo API-ja se promenio: ostaje ono što je plejer sam izabrao.
    }
    javiTitlove(spisak);
  };

  // Javlja napredak samo kad se vreme promenilo (pauzirana epizoda ne piše stalno).
  const prijavi = () => {
    try {
      const t = plejer.getCurrentTime?.();
      const d = plejer.getDuration?.();
      if (!Number.isFinite(t) || !Number.isFinite(d) || d <= 0 || t === poslednje) return;
      poslednje = t;
      naNapretku?.(t, d);
    } catch {
      // Plejer još nije spreman ili je već uklonjen.
    }
  };

  const plejer = new YT.Player(element, {
    host: DOMACIN,
    videoId,
    width: "100%",
    height: "100%",
    playerVars: { ...parametri, origin: location.origin },
    events: {
      onReady: (dogadjaj) => {
        dogadjaj.target.getIframe?.().setAttribute("title", naslov);
        interval = setInterval(prijavi, PRIJAVA_NAPRETKA_MS);
        spreman = true;
        naSpremnosti?.();
        // Modul titlova se učitava i kad cc_load_policy ne uspe; spisak stiže u onApiChange.
        if (zeljeni) {
          try {
            plejer.loadModule?.("captions");
          } catch {
            // Nije podržano.
          }
        }
      },
      onApiChange: () => primeniTitlove(),
      onStateChange: (dogadjaj) => {
        if (dogadjaj.data === YT.PlayerState.PAUSED) prijavi();
        if (dogadjaj.data === YT.PlayerState.ENDED) {
          prijavi();
          naKraju?.();
        }
      },
      onError: (dogadjaj) => naGresci?.(dogadjaj.data),
    },
  });

  return {
    sacuvaj: prijavi,
    postaviTitlove(kod) {
      if (!spreman || unisten || typeof plejer.setOption !== "function") return false;
      zeljeni = kod;
      try {
        if (kod) plejer.loadModule?.("captions");
      } catch {
        return false;
      }
      primeniTitlove(true);
      return true;
    },
    unisti() {
      if (unisten) return;
      unisten = true;
      clearInterval(interval);
      prijavi();
      try {
        plejer.destroy();
      } catch {
        // Već uklonjen.
      }
    },
  };
}
