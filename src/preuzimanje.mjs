// Preuzimanje stranica i resursa sa ograničenjem vremena i veličine.

export const KORISNICKI_AGENT =
  "analiza-sajta/1.0 (+https://github.com/srbinzaprimer/analiza)";

const MB = 1024 * 1024;

/**
 * Preuzima jednu adresu. Nikad ne baca grešku: neuspeh se vraća kao `greska`.
 * Sa `sacuvajTelo: false` samo broji bajtove (za merenje veličine resursa).
 *
 * @returns {Promise<{
 *   status: number, url: string, zaglavlja: Headers | null,
 *   telo: Buffer | null, bajtova: number, skraceno: boolean,
 *   vremeMs: number, greska: string | null
 * }>}
 */
export async function preuzmi(
  url,
  { timeoutMs = 15_000, maxBajtova = 10 * MB, sacuvajTelo = true } = {},
) {
  const pocetak = performance.now();
  const rezultat = {
    status: 0,
    url,
    zaglavlja: null,
    telo: null,
    bajtova: 0,
    skraceno: false,
    vremeMs: 0,
    greska: null,
  };

  try {
    const odgovor = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent": KORISNICKI_AGENT,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-language": "sr,en;q=0.8",
      },
    });
    rezultat.status = odgovor.status;
    rezultat.url = odgovor.url || url;
    rezultat.zaglavlja = odgovor.headers;

    if (odgovor.body) {
      const delovi = [];
      for await (const deo of odgovor.body) {
        rezultat.bajtova += deo.byteLength;
        if (rezultat.bajtova > maxBajtova) {
          rezultat.skraceno = true;
          rezultat.bajtova = maxBajtova;
          break;
        }
        if (sacuvajTelo) delovi.push(deo);
      }
      if (sacuvajTelo) rezultat.telo = Buffer.concat(delovi);
    }
  } catch (greska) {
    rezultat.greska = opisGreske(greska);
  }

  rezultat.vremeMs = Math.round(performance.now() - pocetak);
  return rezultat;
}

function opisGreske(greska) {
  if (greska?.name === "TimeoutError") return "isteklo je vreme za odgovor";
  const kod = greska?.cause?.code ?? greska?.code;
  switch (kod) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "adresa ne postoji ili DNS ne odgovara";
    case "ECONNREFUSED":
      return "server je odbio vezu";
    case "ECONNRESET":
      return "server je prekinuo vezu";
    case "CERT_HAS_EXPIRED":
      return "sertifikat sajta je istekao";
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "SELF_SIGNED_CERT_IN_CHAIN":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
      return "sertifikat sajta nije pouzdan";
    case "ERR_TLS_CERT_ALTNAME_INVALID":
      return "sertifikat ne odgovara adresi sajta";
    default:
      return greska?.cause?.message ?? greska?.message ?? String(greska);
  }
}

/** Izvršava `posao` nad svim stavkama, najviše `paralelno` u isto vreme. */
export async function uRedu(stavke, paralelno, posao) {
  const rezultati = new Array(stavke.length);
  let sledeci = 0;
  async function radnik() {
    while (sledeci < stavke.length) {
      const i = sledeci++;
      rezultati[i] = await posao(stavke[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(paralelno, stavke.length) }, radnik),
  );
  return rezultati;
}
