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

/** Običan ugrađeni plejer kad API nije dostupan. */
function obicanPlejer(element, videoId, pocetak, naslov) {
  const parametri = new URLSearchParams({ autoplay: "1", rel: "0", playsinline: "1" });
  if (pocetak > 0) parametri.set("start", String(Math.floor(pocetak)));
  const okvir = document.createElement("iframe");
  okvir.src = `${DOMACIN}/embed/${encodeURIComponent(videoId)}?${parametri}`;
  okvir.title = naslov;
  okvir.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  okvir.referrerPolicy = "strict-origin-when-cross-origin";
  element.replaceWith(okvir);
  return BEZ_PLEJERA;
}

const BEZ_PLEJERA = Object.freeze({ sacuvaj() {}, unisti() {} });

/**
 * @param {HTMLElement} element mesto gde ide plejer (biće zamenjen)
 * @param {{
 *   videoId: string, naslov: string, pocetak?: number,
 *   naNapretku?: (t: number, d: number) => void,
 *   naKraju?: () => void,
 *   naGresci?: (kod: number) => void,
 * }} opcije
 * @returns {Promise<{ sacuvaj(): void, unisti(): void }>}
 */
export async function napraviPlejer(element, opcije) {
  const { videoId, naslov, pocetak = 0, naNapretku, naKraju, naGresci } = opcije;

  let YT;
  try {
    YT = await ucitajApi();
  } catch {
    if (!element.isConnected) return BEZ_PLEJERA;
    return obicanPlejer(element, videoId, pocetak, naslov);
  }
  // Korisnik je u međuvremenu otišao na drugu stranu.
  if (!element.isConnected) return BEZ_PLEJERA;

  let interval = null;
  let unisten = false;
  let poslednje = null;

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
    playerVars: {
      autoplay: 1,
      start: Math.max(0, Math.floor(pocetak)),
      rel: 0,
      playsinline: 1,
      origin: location.origin,
    },
    events: {
      onReady: (dogadjaj) => {
        dogadjaj.target.getIframe?.().setAttribute("title", naslov);
        interval = setInterval(prijavi, PRIJAVA_NAPRETKA_MS);
      },
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
