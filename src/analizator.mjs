// Glavna analiza: preuzima stranicu, čita njen HTML i sklapa rezultat.

import { NodeType, parse } from "node-html-parser";
import { preuzmi, uRedu } from "./preuzimanje.mjs";
import { prepoznajTehnologije, servisZaHost } from "./tehnologije.mjs";

const KB = 1024;
const MB = 1024 * KB;

// Koliko resursa najviše preuzimamo da bismo izmerili veličinu stranice.
const LIMIT_MERENJA = { skripta: 60, stil: 30, slika: 40 };

export class GreskaAnalize extends Error {}

/** Dodaje https:// ako nedostaje i proverava da je adresa ispravna. */
export function normalizujAdresu(adresa) {
  let tekst = String(adresa ?? "").trim();
  if (!tekst) throw new GreskaAnalize("Nije zadata adresa sajta.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(tekst)) tekst = "https://" + tekst;
  let url;
  try {
    url = new URL(tekst);
  } catch {
    throw new GreskaAnalize(`"${adresa}" nije ispravna adresa sajta.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new GreskaAnalize("Podržane su samo http:// i https:// adrese.");
  }
  return url.href;
}

/**
 * Analizira javni deo sajta na zadatoj adresi.
 *
 * @param {string} adresa
 * @param {{ meriVelicinu?: boolean, timeoutMs?: number }} [opcije]
 */
export async function analizirajSajt(
  adresa,
  { meriVelicinu = true, timeoutMs = 15_000 } = {},
) {
  const url = normalizujAdresu(adresa);
  const strana = await preuzmi(url, { timeoutMs, maxBajtova: 5 * MB });
  if (strana.greska) {
    throw new GreskaAnalize(`Ne mogu da otvorim ${url}: ${strana.greska}.`);
  }

  const konacnaAdresa = new URL(strana.url);
  const zaglavlja = Object.fromEntries(strana.zaglavlja);
  const kolacici = strana.zaglavlja
    .getSetCookie()
    .map((c) => c.split("=")[0].trim())
    .filter(Boolean);
  const html = dekodiraj(strana.telo ?? Buffer.alloc(0), zaglavlja["content-type"]);
  const koren = parse(html, { comment: false });

  const osnova = osnovnaAdresa(koren, konacnaAdresa);
  const domenSajta = konacnaAdresa.hostname.replace(/^www\./, "");
  const jeSpoljni = (host) =>
    !(host === domenSajta || host.endsWith("." + domenSajta));

  const resursi = prikupiResurse(koren, osnova).map((r) => ({
    ...r,
    spoljni: jeSpoljni(r.host),
  }));

  const generatori = koren
    .querySelectorAll("meta")
    .filter((m) => (m.getAttribute("name") ?? "").toLowerCase() === "generator")
    .map((m) => m.getAttribute("content") ?? "");

  const tehnologije = prepoznajTehnologije({
    html,
    generatori,
    zaglavlja,
    kolacici,
    urlovi: resursi.map((r) => r.url),
    hostovi: [...new Set(resursi.map((r) => r.host))],
  });

  const wordpress = tehnologije.some((t) => t.ime === "WordPress")
    ? wordpressDetalji(html)
    : null;

  const merenje = meriVelicinu
    ? await izmeriVelicinu(resursi, strana.bajtova, timeoutMs)
    : null;

  const skripte = opisSkripti(koren, resursi, merenje?.poResursu);
  const seo = await proveriSeo(koren, zaglavlja, konacnaAdresa, timeoutMs);
  const bezbednost = proveriBezbednost(zaglavlja, konacnaAdresa, resursi);

  return {
    adresa: url,
    konacnaAdresa: konacnaAdresa.href,
    status: strana.status,
    vremeOdgovoraMs: strana.vremeMs,
    analizirano: new Date().toISOString(),
    naslov: seo.naslov.tekst,
    server: {
      server: zaglavlja.server ?? null,
      poweredBy: zaglavlja["x-powered-by"] ?? null,
    },
    tehnologije,
    wordpress,
    skripte,
    stilovi: {
      ukupno: resursi.filter((r) => r.vrsta === "stil").length,
      spoljni: resursi.filter((r) => r.vrsta === "stil" && r.spoljni).length,
    },
    spoljniServisi: grupisiSpoljne(resursi),
    velicina: merenje?.velicina ?? null,
    seo,
    bezbednost,
    napomene: napomene({ url, strana, konacnaAdresa, zaglavlja, html, koren }),
  };
}

// ── Čitanje HTML-a ──────────────────────────────────────────────────

function dekodiraj(telo, contentType) {
  let kodnaStrana = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  if (!kodnaStrana) {
    const pocetak = telo.subarray(0, 4 * KB).toString("latin1");
    kodnaStrana = /<meta[^>]+charset=["']?([\w-]+)/i.exec(pocetak)?.[1];
  }
  try {
    return new TextDecoder(kodnaStrana ?? "utf-8").decode(telo);
  } catch {
    return new TextDecoder("utf-8").decode(telo);
  }
}

function osnovnaAdresa(koren, konacnaAdresa) {
  const href = koren.querySelector("base[href]")?.getAttribute("href");
  if (href) {
    try {
      return new URL(href, konacnaAdresa);
    } catch {
      // Neispravan <base> pregledač ignoriše, pa i mi.
    }
  }
  return konacnaAdresa;
}

/** Sve adrese koje stranica učitava kroz HTML oznake, bez duplikata. */
function prikupiResurse(koren, osnova) {
  const resursi = new Map();
  const dodaj = (vrednost, vrsta) => {
    const tekst = vrednost?.trim();
    if (!tekst || /^(?:data|blob|javascript|about|mailto|tel):/i.test(tekst)) return;
    let url;
    try {
      url = new URL(tekst, osnova);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    const kljuc = `${vrsta} ${url.href}`;
    if (!resursi.has(kljuc)) {
      resursi.set(kljuc, { url: url.href, host: url.hostname, vrsta });
    }
  };

  for (const el of koren.querySelectorAll("script[src]")) {
    dodaj(el.getAttribute("src"), "skripta");
  }
  for (const el of koren.querySelectorAll("link[href]")) {
    const rel = (el.getAttribute("rel") ?? "").toLowerCase().split(/\s+/);
    const kao = (el.getAttribute("as") ?? "").toLowerCase();
    const href = el.getAttribute("href");
    if (rel.includes("stylesheet")) dodaj(href, "stil");
    else if (rel.includes("modulepreload")) dodaj(href, "skripta");
    else if (rel.includes("preload") && kao === "script") dodaj(href, "skripta");
    else if (rel.includes("preload") && kao === "style") dodaj(href, "stil");
    else if (rel.includes("icon") || rel.includes("apple-touch-icon")) dodaj(href, "ikonica");
    else if (rel.includes("preconnect") || rel.includes("dns-prefetch")) dodaj(href, "veza");
  }
  for (const el of koren.querySelectorAll("img")) {
    const src = el.getAttribute("src");
    const lenjo = el.getAttribute("data-src") ?? el.getAttribute("data-lazy-src");
    dodaj(!src || src.startsWith("data:") ? lenjo : src, "slika");
  }
  for (const el of koren.querySelectorAll("iframe[src]")) {
    dodaj(el.getAttribute("src"), "iframe");
  }
  for (const el of koren.querySelectorAll("video[src], audio[src], source[src]")) {
    dodaj(el.getAttribute("src"), "medij");
  }
  for (const el of koren.querySelectorAll("video[poster]")) {
    dodaj(el.getAttribute("poster"), "slika");
  }
  return [...resursi.values()];
}

function wordpressDetalji(html) {
  const imena = (obrazac) =>
    [...new Set([...html.matchAll(obrazac)].map((m) => m[1].toLowerCase()))].sort();
  return {
    teme: imena(/\/wp-content\/themes\/([a-z0-9_.-]+)\//gi),
    dodaci: imena(/\/wp-content\/plugins\/([a-z0-9_.-]+)\//gi),
  };
}

// ── Skripte i spoljni servisi ───────────────────────────────────────

function opisSkripti(koren, resursi, poResursu) {
  const uStranici = koren
    .querySelectorAll("script:not([src])")
    .filter((s) => {
      const tip = (s.getAttribute("type") ?? "").toLowerCase();
      return !tip || tip === "module" || tip.includes("javascript");
    }).length;

  const lista = resursi
    .filter((r) => r.vrsta === "skripta")
    .map((r) => ({
      url: r.url,
      spoljna: r.spoljni,
      servis: r.spoljni ? servisZaHost(r.host)?.ime ?? null : null,
      bajtova: poResursu?.get(r.url) ?? null,
    }));

  return {
    saAdresom: lista.length,
    spoljne: lista.filter((s) => s.spoljna).length,
    uStranici,
    lista,
  };
}

function grupisiSpoljne(resursi) {
  const poHostu = new Map();
  for (const r of resursi) {
    if (!r.spoljni) continue;
    let grupa = poHostu.get(r.host);
    if (!grupa) {
      const servis = servisZaHost(r.host);
      grupa = {
        host: r.host,
        servis: servis?.ime ?? null,
        kategorija: servis?.kategorija ?? null,
        resursa: 0,
        vrste: new Set(),
      };
      poHostu.set(r.host, grupa);
    }
    grupa.resursa++;
    grupa.vrste.add(r.vrsta);
  }
  return [...poHostu.values()]
    .map((g) => ({ ...g, vrste: [...g.vrste].sort() }))
    .sort(
      (a, b) =>
        Number(b.servis !== null) - Number(a.servis !== null) ||
        b.resursa - a.resursa ||
        a.host.localeCompare(b.host),
    );
}

// ── Veličina stranice ───────────────────────────────────────────────

async function izmeriVelicinu(resursi, htmlBajtova, timeoutMs) {
  const zaMerenje = [];
  let preskoceno = 0;
  for (const [vrsta, limit] of Object.entries(LIMIT_MERENJA)) {
    const odabrani = resursi.filter((r) => r.vrsta === vrsta);
    zaMerenje.push(...odabrani.slice(0, limit));
    preskoceno += Math.max(0, odabrani.length - limit);
  }

  const izmereni = await uRedu(zaMerenje, 6, async (r) => {
    const odgovor = await preuzmi(r.url, {
      timeoutMs: Math.min(timeoutMs, 10_000),
      maxBajtova: 15 * MB,
      sacuvajTelo: false,
    });
    const uspeh = !odgovor.greska && odgovor.status < 400;
    return { ...r, bajtova: uspeh ? odgovor.bajtova : null };
  });

  const zbir = (vrsta) =>
    izmereni
      .filter((r) => r.vrsta === vrsta && r.bajtova !== null)
      .reduce((s, r) => s + r.bajtova, 0);

  const velicina = {
    html: htmlBajtova,
    skripte: zbir("skripta"),
    stilovi: zbir("stil"),
    slike: zbir("slika"),
    ukupno: 0,
    izmereno: izmereni.filter((r) => r.bajtova !== null).length,
    neuspesno: izmereni.filter((r) => r.bajtova === null).length,
    preskoceno,
  };
  velicina.ukupno =
    velicina.html + velicina.skripte + velicina.stilovi + velicina.slike;
  return {
    velicina,
    poResursu: new Map(izmereni.map((r) => [r.url, r.bajtova])),
  };
}

// ── SEO ─────────────────────────────────────────────────────────────

async function proveriSeo(koren, zaglavlja, konacnaAdresa, timeoutMs) {
  const metaPo = (atribut, vrednost) =>
    koren
      .querySelectorAll("meta")
      .find((m) => (m.getAttribute(atribut) ?? "").toLowerCase() === vrednost)
      ?.getAttribute("content")
      ?.trim() ?? null;
  const sazmi = (tekst) => tekst.replace(/\s+/g, " ").trim();

  const naslov = sazmi(koren.querySelector("title")?.text ?? "");
  const opis = metaPo("name", "description");
  const h1 = koren.querySelectorAll("h1");
  const slike = koren.querySelectorAll("img");
  const robotsMeta = metaPo("name", "robots") ?? "";
  const xRobots = zaglavlja["x-robots-tag"] ?? "";

  const { robotsTxt, sitemap } = await proveriRobotsISitemap(
    konacnaAdresa.origin,
    timeoutMs,
  );

  return {
    naslov: { tekst: naslov, duzina: naslov.length },
    opis: { tekst: opis, duzina: opis?.length ?? 0 },
    h1: { broj: h1.length, prvi: h1[0] ? sazmi(h1[0].text) : null },
    jezik: koren.querySelector("html")?.getAttribute("lang") ?? null,
    viewport: metaPo("name", "viewport") !== null,
    canonical:
      koren
        .querySelectorAll("link[href]")
        .find((l) => (l.getAttribute("rel") ?? "").toLowerCase() === "canonical")
        ?.getAttribute("href") ?? null,
    openGraph: {
      naslov: metaPo("property", "og:title") !== null,
      opis: metaPo("property", "og:description") !== null,
      slika: metaPo("property", "og:image") !== null,
    },
    slike: {
      ukupno: slike.length,
      bezAlt: slike.filter((s) => !s.hasAttribute("alt")).length,
    },
    strukturiraniPodaci: koren.querySelectorAll(
      'script[type="application/ld+json"]',
    ).length,
    noindex: /noindex/i.test(robotsMeta) || /noindex/i.test(xRobots),
    robotsTxt,
    sitemap,
  };
}

async function proveriRobotsISitemap(origin, timeoutMs) {
  const kratko = { timeoutMs: Math.min(timeoutMs, 8_000), maxBajtova: 512 * KB };

  const robots = await preuzmi(`${origin}/robots.txt`, kratko);
  const robotsTekst = robots.telo?.toString("utf8") ?? "";
  const robotsTxt =
    !robots.greska && robots.status === 200 && !/^\s*</.test(robotsTekst);

  const izRobotsa = robotsTxt
    ? [...robotsTekst.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1])
    : [];
  if (izRobotsa.length > 0) {
    return { robotsTxt, sitemap: { postoji: true, adrese: izRobotsa } };
  }

  const mapa = await preuzmi(`${origin}/sitemap.xml`, kratko);
  const mapaTekst = mapa.telo?.toString("utf8") ?? "";
  const postoji =
    !mapa.greska && mapa.status === 200 && /<(?:urlset|sitemapindex)\b/.test(mapaTekst);
  return {
    robotsTxt,
    sitemap: { postoji, adrese: postoji ? [`${origin}/sitemap.xml`] : [] },
  };
}

// ── Bezbednost ──────────────────────────────────────────────────────

function proveriBezbednost(zaglavlja, konacnaAdresa, resursi) {
  const https = konacnaAdresa.protocol === "https:";
  const csp = zaglavlja["content-security-policy"] ?? null;
  const otkriva = ["server", "x-powered-by", "x-aspnet-version", "x-generator"]
    .filter((ime) => zaglavlja[ime] && /\d/.test(zaglavlja[ime]))
    .map((ime) => `${ime}: ${zaglavlja[ime]}`);

  return {
    https,
    hsts: Boolean(zaglavlja["strict-transport-security"]),
    csp: Boolean(csp),
    zastitaOdUokvirivanja:
      Boolean(zaglavlja["x-frame-options"]) || /frame-ancestors/i.test(csp ?? ""),
    nosniff: /nosniff/i.test(zaglavlja["x-content-type-options"] ?? ""),
    referrerPolicy: Boolean(zaglavlja["referrer-policy"]),
    permissionsPolicy: Boolean(zaglavlja["permissions-policy"]),
    mesovitSadrzaj: https
      ? resursi.filter((r) => r.vrsta !== "veza" && r.url.startsWith("http:")).length
      : 0,
    otkrivaVerzije: otkriva,
  };
}

// ── Napomene o ograničenjima ────────────────────────────────────────

const NEVIDLJIVE_OZNAKE = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

/** Tekst koji bi posetilac video, bez sadržaja skripti i stilova. */
function vidljivTekst(cvor) {
  if (cvor.nodeType === NodeType.TEXT_NODE) return cvor.text;
  if (NEVIDLJIVE_OZNAKE.has(cvor.tagName)) return "";
  return cvor.childNodes.map(vidljivTekst).join(" ");
}

function napomene({ url, strana, konacnaAdresa, zaglavlja, html, koren }) {
  const lista = [];
  const pocetniHost = new URL(url).hostname;

  if (konacnaAdresa.hostname !== pocetniHost) {
    lista.push(`Adresa je preusmerena na ${konacnaAdresa.hostname}.`);
  }
  if (strana.status >= 400) {
    lista.push(
      `Server je vratio status ${strana.status}, pa se rezultati odnose na tu stranicu, a ne na pravi sadržaj sajta.`,
    );
  }
  const cloudflare = zaglavlja["cf-ray"] || /cloudflare/i.test(zaglavlja.server ?? "");
  if (
    cloudflare &&
    [403, 503].includes(strana.status) &&
    /Just a moment|challenge-platform|cf-chl/i.test(html)
  ) {
    lista.push(
      "Sajt je vratio Cloudflare zaštitnu proveru umesto sadržaja. Takvi sajtovi blokiraju automatske alate.",
    );
  }
  if (strana.skraceno) {
    lista.push("HTML je veći od 5 MB, pa je analiziran samo početak stranice.");
  }

  const telo = koren.querySelector("body");
  if (telo) {
    const tekst = vidljivTekst(telo).replace(/\s+/g, " ").trim();
    const imaSkripte = /<script\b[^>]*\bsrc=/i.test(html);
    if (tekst.length < 200 && imaSkripte) {
      lista.push(
        "Stranica skoro da nema teksta u HTML-u: sadržaj verovatno iscrtava JavaScript (SPA), pa deo sajta ovaj alat ne vidi.",
      );
    }
  }

  lista.push(
    "Analiziran je HTML koji server pošalje, bez izvršavanja JavaScript-a. Servisi koje skripte učitaju naknadno (npr. preko Google Tag Manager-a) mogu da nedostaju.",
  );
  return lista;
}
