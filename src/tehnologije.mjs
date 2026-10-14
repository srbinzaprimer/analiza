// Potpisi po kojima se prepoznaju tehnologije i spoljni servisi.
//
// Svako pravilo može da proveri:
//   generator  – sadržaj <meta name="generator">
//   html       – sirovi HTML stranice
//   urlovi     – adrese skripti, stilova i ostalih resursa
//   zaglavlja  – HTTP zaglavlja odgovora (ime zaglavlja malim slovima)
//   kolacici   – imena kolačića koje server postavlja
//   domeni     – domeni sa kojih se učitavaju resursi
// Prva grupa u regularnom izrazu (ako postoji) je verzija.
// `podrazumeva` dodaje tehnologije na kojima je ova zasnovana.

export const KATEGORIJE = {
  cms: "Sistem za sadržaj (CMS)",
  konstruktor: "Konstruktor sajtova",
  prodavnica: "Online prodavnica",
  okvir: "JavaScript okvir",
  biblioteka: "JavaScript biblioteka",
  css: "CSS / dizajn",
  server: "Web server",
  jezik: "Programski jezik / platforma",
  hosting: "Hosting / CDN",
  cdn: "CDN za biblioteke",
  analitika: "Analitika i praćenje",
  greske: "Praćenje grešaka",
  reklame: "Reklame",
  video: "Video",
  fontovi: "Fontovi",
  placanje: "Plaćanje",
  pristanak: "Kolačići / pristanak",
  chat: "Chat / podrška",
  drustvene: "Društvene mreže",
  zastita: "Zaštita od botova",
  obavestenja: "Push obaveštenja",
  ostalo: "Ostalo",
};

const K = KATEGORIJE;

export const PRAVILA = [
  // ── Sistemi za sadržaj i konstruktori ──────────────────────────────
  {
    ime: "WordPress",
    kategorija: K.cms,
    generator: [/WordPress\s*([\d.]+)?/i],
    html: [/\/wp-(?:content|includes)\//i],
    zaglavlja: { link: [/api\.w\.org/i] },
  },
  {
    ime: "Joomla",
    kategorija: K.cms,
    generator: [/Joomla!?\s*([\d.]+)?/i],
    html: [/\/media\/jui\/|\/components\/com_[a-z]/i],
  },
  {
    ime: "Drupal",
    kategorija: K.cms,
    generator: [/Drupal\s*([\d.]+)?/i],
    zaglavlja: { "x-generator": [/Drupal\s*([\d.]+)?/i] },
    html: [/drupal-settings-json|Drupal\.settings/],
  },
  { ime: "Ghost", kategorija: K.cms, generator: [/Ghost\s*([\d.]+)?/i] },
  {
    ime: "Blogger",
    kategorija: K.cms,
    generator: [/Blogger/i],
    domeni: ["blogger.com", "blogblog.com"],
  },
  {
    ime: "Wix",
    kategorija: K.konstruktor,
    generator: [/Wix\.com/i],
    domeni: ["wixstatic.com", "parastorage.com"],
  },
  {
    ime: "Squarespace",
    kategorija: K.konstruktor,
    html: [/static1\.squarespace\.com/i],
    domeni: ["squarespace.com", "sqspcdn.com"],
  },
  {
    ime: "Webflow",
    kategorija: K.konstruktor,
    generator: [/Webflow/i],
    html: [/data-wf-(?:site|page)=/],
    domeni: ["website-files.com", "webflow.com"],
  },
  {
    ime: "Shopify",
    kategorija: K.prodavnica,
    html: [/cdn\.shopify\.com|Shopify\.theme/],
    zaglavlja: { "x-shopid": [/./], "powered-by": [/Shopify/i] },
    domeni: ["cdn.shopify.com"],
  },
  {
    ime: "WooCommerce",
    kategorija: K.prodavnica,
    html: [/\/plugins\/woocommerce\/|class="[^"]*\bwoocommerce\b/i],
    podrazumeva: ["WordPress"],
  },
  {
    ime: "PrestaShop",
    kategorija: K.prodavnica,
    generator: [/PrestaShop/i],
    html: [/\bvar prestashop\s*=/],
    zaglavlja: { "powered-by": [/PrestaShop/i] },
  },
  {
    ime: "Magento",
    kategorija: K.prodavnica,
    html: [/Mage\.Cookies|\/static\/version\d+\/frontend\//],
    zaglavlja: { "x-magento-cache-debug": [/./], "x-magento-tags": [/./] },
  },
  {
    ime: "OpenCart",
    kategorija: K.prodavnica,
    html: [/catalog\/view\/(?:theme|javascript)\//i],
  },

  // ── JavaScript okviri i biblioteke ─────────────────────────────────
  {
    ime: "Next.js",
    kategorija: K.okvir,
    html: [/\/_next\/static\/|id="__NEXT_DATA__"/],
    zaglavlja: { "x-powered-by": [/Next\.js\s*([\d.]+)?/i] },
    podrazumeva: ["React"],
  },
  {
    ime: "Nuxt",
    kategorija: K.okvir,
    html: [/\/_nuxt\/|window\.__NUXT__/],
    podrazumeva: ["Vue.js"],
  },
  {
    ime: "Gatsby",
    kategorija: K.okvir,
    generator: [/Gatsby\s*([\d.]+)?/i],
    html: [/id="___gatsby"/],
    podrazumeva: ["React"],
  },
  {
    ime: "Astro",
    kategorija: K.okvir,
    generator: [/Astro\s*v?([\d.]+)?/i],
    html: [/<astro-island|data-astro-cid/],
  },
  {
    ime: "SvelteKit",
    kategorija: K.okvir,
    html: [/data-sveltekit|__sveltekit_/],
    podrazumeva: ["Svelte"],
  },
  { ime: "Svelte", kategorija: K.okvir, html: [/class="[^"]*\bsvelte-[a-z0-9]{5,}/] },
  {
    ime: "React",
    kategorija: K.okvir,
    html: [/data-reactroot/],
    urlovi: [/react-dom(?:\.production)?(?:\.min)?\.js/i, /\/react@([\d.]+)/],
  },
  {
    ime: "Vue.js",
    kategorija: K.okvir,
    html: [/\sdata-v-[0-9a-f]{8}[\s=>]/],
    urlovi: [/\/vue@([\d.]+)/, /\/vue(?:\.runtime)?(?:\.global)?(?:\.prod)?(?:\.min)?\.js/i],
  },
  {
    ime: "Angular",
    kategorija: K.okvir,
    html: [/ng-version="([\d.]+)"/],
  },
  {
    ime: "AngularJS",
    kategorija: K.okvir,
    html: [/\sng-app[\s=>]/],
    urlovi: [/angular(?:\.min)?\.js/i],
  },
  {
    ime: "Alpine.js",
    kategorija: K.biblioteka,
    urlovi: [/alpinejs(?:@([\d.]+))?/i],
  },
  {
    ime: "htmx",
    kategorija: K.biblioteka,
    html: [/\shx-(?:get|post)=/],
    urlovi: [/htmx(?:\.org@([\d.]+))?(?:\.min)?\.js|unpkg\.com\/htmx/i],
  },
  {
    ime: "jQuery",
    kategorija: K.biblioteka,
    urlovi: [
      /jquery(?:\.min)?\.js\?ver=([\d.]+)/i,
      /jquery[.-](\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i,
      /jquery@([\d.]+)/i,
      /\/jquery\/([\d.]+)\/jquery/i,
      /\/jquery(?:\.min)?\.js/i,
    ],
  },
  {
    ime: "Swiper",
    kategorija: K.biblioteka,
    urlovi: [/swiper(?:@([\d.]+))?.*?\.(?:js|css)/i],
  },
  { ime: "Slick", kategorija: K.biblioteka, urlovi: [/slick(?:\.min)?\.(?:js|css)/i] },
  { ime: "Owl Carousel", kategorija: K.biblioteka, urlovi: [/owl\.carousel/i] },
  {
    ime: "Bootstrap",
    kategorija: K.css,
    urlovi: [
      /bootstrap@([\d.]+)/i,
      /bootstrap\/([\d.]+)\//i,
      /bootstrap(?:\.bundle)?(?:\.min)?\.(?:js|css)/i,
    ],
  },
  {
    ime: "Tailwind CSS",
    kategorija: K.css,
    html: [/cdn\.tailwindcss\.com/],
    urlovi: [/tailwind/i],
  },
  {
    ime: "Font Awesome",
    kategorija: K.css,
    urlovi: [/font-?awesome|fontawesome\.com/i],
  },

  // ── Serveri i platforme (iz HTTP zaglavlja) ────────────────────────
  { ime: "Nginx", kategorija: K.server, zaglavlja: { server: [/nginx(?:\/([\d.]+))?/i] } },
  {
    ime: "Apache",
    kategorija: K.server,
    zaglavlja: { server: [/Apache(?:\/([\d.]+))?/i] },
  },
  { ime: "LiteSpeed", kategorija: K.server, zaglavlja: { server: [/LiteSpeed/i] } },
  {
    ime: "Microsoft IIS",
    kategorija: K.server,
    zaglavlja: { server: [/Microsoft-IIS(?:\/([\d.]+))?/i] },
  },
  {
    ime: "OpenResty",
    kategorija: K.server,
    zaglavlja: { server: [/openresty(?:\/([\d.]+))?/i] },
  },
  { ime: "Caddy", kategorija: K.server, zaglavlja: { server: [/Caddy/i] } },
  {
    ime: "PHP",
    kategorija: K.jezik,
    zaglavlja: { "x-powered-by": [/PHP(?:\/([\d.]+))?/i] },
    kolacici: [/^PHPSESSID$/],
  },
  {
    ime: "ASP.NET",
    kategorija: K.jezik,
    zaglavlja: {
      "x-aspnet-version": [/([\d.]+)/],
      "x-powered-by": [/ASP\.NET/i],
    },
    kolacici: [/^ASP\.NET_SessionId$/i],
  },
  { ime: "Express", kategorija: K.jezik, zaglavlja: { "x-powered-by": [/Express/i] } },
  {
    ime: "Cloudflare",
    kategorija: K.hosting,
    zaglavlja: { server: [/cloudflare/i], "cf-ray": [/./] },
  },
  {
    ime: "Vercel",
    kategorija: K.hosting,
    zaglavlja: { server: [/Vercel/i], "x-vercel-id": [/./] },
  },
  {
    ime: "Netlify",
    kategorija: K.hosting,
    zaglavlja: { server: [/Netlify/i], "x-nf-request-id": [/./] },
  },
  { ime: "GitHub Pages", kategorija: K.hosting, zaglavlja: { server: [/GitHub\.com/i] } },
  {
    ime: "Amazon CloudFront",
    kategorija: K.hosting,
    zaglavlja: { via: [/CloudFront/i], "x-amz-cf-id": [/./] },
  },
  { ime: "Fastly", kategorija: K.hosting, zaglavlja: { "x-fastly-request-id": [/./] } },
  {
    ime: "Varnish",
    kategorija: K.hosting,
    zaglavlja: { via: [/varnish/i], "x-varnish": [/./] },
  },
  {
    ime: "Akamai",
    kategorija: K.hosting,
    zaglavlja: { server: [/AkamaiGHost/i], "x-akamai-transformed": [/./] },
  },

  // ── CDN-ovi za biblioteke i fontovi ────────────────────────────────
  { ime: "jsDelivr", kategorija: K.cdn, domeni: ["cdn.jsdelivr.net"] },
  { ime: "cdnjs", kategorija: K.cdn, domeni: ["cdnjs.cloudflare.com"] },
  { ime: "unpkg", kategorija: K.cdn, domeni: ["unpkg.com"] },
  { ime: "Google Hosted Libraries", kategorija: K.cdn, domeni: ["ajax.googleapis.com"] },
  { ime: "jQuery CDN", kategorija: K.cdn, domeni: ["code.jquery.com"] },
  {
    ime: "Google Fonts",
    kategorija: K.fontovi,
    domeni: ["fonts.googleapis.com", "fonts.gstatic.com"],
  },
  { ime: "Adobe Fonts", kategorija: K.fontovi, domeni: ["use.typekit.net"] },

  // ── Analitika i praćenje ───────────────────────────────────────────
  {
    ime: "Google Analytics",
    kategorija: K.analitika,
    html: [
      /google-analytics\.com\/(?:analytics|ga)\.js/,
      /googletagmanager\.com\/gtag\/js/,
      /gtag\(\s*['"]config['"]\s*,\s*['"](?:G|UA)-/,
    ],
    domeni: ["google-analytics.com"],
  },
  {
    // Isti domen služi i za gtag.js (Google Analytics), pa GTM prepoznajemo
    // samo po njegovom kontejneru.
    ime: "Google Tag Manager",
    kategorija: K.analitika,
    html: [/googletagmanager\.com\/gtm\.js|['"]GTM-[A-Z0-9]{4,}['"]/],
  },
  {
    ime: "Facebook Pixel",
    kategorija: K.analitika,
    html: [/connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(\s*['"]init/],
  },
  {
    ime: "Hotjar",
    kategorija: K.analitika,
    html: [/static\.hotjar\.com/],
    domeni: ["hotjar.com"],
  },
  {
    ime: "Microsoft Clarity",
    kategorija: K.analitika,
    html: [/clarity\.ms\/tag/],
    domeni: ["clarity.ms"],
  },
  {
    ime: "Yandex Metrica",
    kategorija: K.analitika,
    html: [/mc\.yandex\.ru\/metrika/],
    domeni: ["mc.yandex.ru"],
  },
  {
    ime: "Matomo",
    kategorija: K.analitika,
    html: [/\b(?:matomo|piwik)\.js|_paq\.push/],
  },
  { ime: "Plausible", kategorija: K.analitika, domeni: ["plausible.io"] },
  {
    ime: "Cloudflare Web Analytics",
    kategorija: K.analitika,
    html: [/static\.cloudflareinsights\.com\/beacon/],
    domeni: ["cloudflareinsights.com"],
  },
  {
    ime: "Gemius",
    kategorija: K.analitika,
    html: [/gemius\.pl|pp_gemius_identifier/],
    domeni: ["gemius.pl"],
  },
  {
    ime: "DotMetrics",
    kategorija: K.analitika,
    html: [/dotmetrics\.net/],
    domeni: ["dotmetrics.net"],
  },
  {
    ime: "Histats",
    kategorija: K.analitika,
    html: [/histats\.com/],
    domeni: ["histats.com"],
  },
  {
    ime: "StatCounter",
    kategorija: K.analitika,
    html: [/statcounter\.com\/counter/],
    domeni: ["statcounter.com"],
  },
  {
    ime: "TikTok Pixel",
    kategorija: K.analitika,
    html: [/analytics\.tiktok\.com/],
    domeni: ["analytics.tiktok.com"],
  },
  {
    ime: "LinkedIn Insight",
    kategorija: K.analitika,
    html: [/snap\.licdn\.com/],
    domeni: ["snap.licdn.com"],
  },
  {
    ime: "Sentry",
    kategorija: K.greske,
    html: [/browser\.sentry-cdn\.com|\.ingest\.sentry\.io/],
    domeni: ["sentry-cdn.com", "sentry.io"],
  },

  // ── Reklame ────────────────────────────────────────────────────────
  {
    ime: "Google AdSense",
    kategorija: K.reklame,
    html: [/pagead2\.googlesyndication\.com|class="adsbygoogle/],
    domeni: ["googlesyndication.com"],
  },
  {
    ime: "Google Ad Manager",
    kategorija: K.reklame,
    html: [/securepubads\.g\.doubleclick\.net/],
    domeni: ["doubleclick.net"],
  },
  { ime: "Prebid.js", kategorija: K.reklame, html: [/\bpbjs\.que\b/], urlovi: [/prebid/i] },
  { ime: "Taboola", kategorija: K.reklame, domeni: ["taboola.com"], html: [/cdn\.taboola\.com/] },
  {
    ime: "Outbrain",
    kategorija: K.reklame,
    domeni: ["outbrain.com"],
    html: [/widgets\.outbrain\.com/],
  },
  { ime: "Criteo", kategorija: K.reklame, domeni: ["criteo.com", "criteo.net"] },
  { ime: "PopAds", kategorija: K.reklame, domeni: ["popads.net"], html: [/popads\.net/] },
  { ime: "PropellerAds", kategorija: K.reklame, domeni: ["propellerads.com"] },
  { ime: "ExoClick", kategorija: K.reklame, domeni: ["exoclick.com", "exosrv.com"] },

  // ── Video ──────────────────────────────────────────────────────────
  {
    ime: "YouTube",
    kategorija: K.video,
    html: [/youtube(?:-nocookie)?\.com\/embed\//],
    domeni: ["youtube.com", "youtube-nocookie.com", "ytimg.com"],
  },
  {
    ime: "Vimeo",
    kategorija: K.video,
    html: [/player\.vimeo\.com/],
    domeni: ["vimeo.com", "vimeocdn.com"],
  },
  { ime: "Dailymotion", kategorija: K.video, domeni: ["dailymotion.com", "dmcdn.net"] },
  {
    ime: "JW Player",
    kategorija: K.video,
    html: [/jwplayer\s*\(/],
    domeni: ["jwpcdn.com", "jwplayer.com", "jwplatform.com"],
  },
  {
    ime: "Video.js",
    kategorija: K.video,
    urlovi: [/video\.js@([\d.]+)|\/video(?:\.min)?\.js|video-js(?:\.min)?\.css|vjs\.zencdn\.net/i],
  },
  { ime: "Plyr", kategorija: K.video, urlovi: [/plyr/i] },
  { ime: "hls.js", kategorija: K.video, urlovi: [/hls\.js@([\d.]+)|\/hls(?:\.light)?(?:\.min)?\.js/i] },

  // ── Plaćanje ───────────────────────────────────────────────────────
  { ime: "Stripe", kategorija: K.placanje, domeni: ["js.stripe.com"] },
  { ime: "PayPal", kategorija: K.placanje, domeni: ["paypal.com", "paypalobjects.com"] },

  // ── Kolačići / pristanak ───────────────────────────────────────────
  { ime: "Cookiebot", kategorija: K.pristanak, domeni: ["cookiebot.com"] },
  { ime: "OneTrust", kategorija: K.pristanak, domeni: ["cookielaw.org", "onetrust.com"] },
  { ime: "CookieYes", kategorija: K.pristanak, domeni: ["cookieyes.com"] },

  // ── Chat / podrška ─────────────────────────────────────────────────
  { ime: "Tawk.to", kategorija: K.chat, domeni: ["tawk.to"] },
  {
    ime: "Intercom",
    kategorija: K.chat,
    domeni: ["intercom.io", "intercomcdn.com"],
  },
  { ime: "Crisp", kategorija: K.chat, domeni: ["crisp.chat"] },
  { ime: "Zendesk", kategorija: K.chat, domeni: ["zdassets.com", "zendesk.com"] },

  // ── Društvene mreže ────────────────────────────────────────────────
  {
    ime: "Facebook SDK",
    kategorija: K.drustvene,
    html: [/connect\.facebook\.net\/[^"']*\/sdk\.js/],
  },
  {
    ime: "X (Twitter)",
    kategorija: K.drustvene,
    domeni: ["platform.twitter.com", "twimg.com"],
  },
  {
    ime: "Instagram",
    kategorija: K.drustvene,
    html: [/instagram\.com\/embed\.js/],
    domeni: ["instagram.com", "cdninstagram.com"],
  },
  { ime: "AddThis", kategorija: K.drustvene, domeni: ["addthis.com"] },
  { ime: "ShareThis", kategorija: K.drustvene, domeni: ["sharethis.com"] },
  { ime: "Disqus", kategorija: K.drustvene, domeni: ["disqus.com", "disquscdn.com"] },

  // ── Zaštita od botova ──────────────────────────────────────────────
  {
    ime: "Google reCAPTCHA",
    kategorija: K.zastita,
    html: [/google\.com\/recaptcha|gstatic\.com\/recaptcha|class="g-recaptcha/],
  },
  { ime: "hCaptcha", kategorija: K.zastita, domeni: ["hcaptcha.com"] },
  {
    ime: "Cloudflare Turnstile",
    kategorija: K.zastita,
    html: [/challenges\.cloudflare\.com\/turnstile/],
  },

  // ── Ostalo ─────────────────────────────────────────────────────────
  { ime: "OneSignal", kategorija: K.obavestenja, domeni: ["onesignal.com"] },
  { ime: "Gravatar", kategorija: K.ostalo, domeni: ["gravatar.com"] },
  { ime: "Jetpack (WordPress.com)", kategorija: K.ostalo, domeni: ["wp.com"] },
];

// Domeni koje samo imenujemo u spisku spoljnih servisa. Sami po sebi ne
// otkrivaju konkretnu tehnologiju (npr. facebook.net služi i za Pixel i za SDK).
const OSTALI_DOMENI = [
  {
    domen: "googletagmanager.com",
    ime: "Google tag (gtag.js / Tag Manager)",
    kategorija: K.analitika,
  },
  { domen: "facebook.net", ime: "Facebook / Meta", kategorija: K.drustvene },
  { domen: "facebook.com", ime: "Facebook / Meta", kategorija: K.drustvene },
  { domen: "gstatic.com", ime: "Google (statički sadržaj)", kategorija: K.ostalo },
  { domen: "googleapis.com", ime: "Google API", kategorija: K.ostalo },
  { domen: "google.com", ime: "Google", kategorija: K.ostalo },
  { domen: "cloudfront.net", ime: "Amazon CloudFront", kategorija: K.hosting },
  { domen: "amazonaws.com", ime: "Amazon Web Services", kategorija: K.hosting },
  { domen: "akamaihd.net", ime: "Akamai", kategorija: K.hosting },
  { domen: "cloudflare.com", ime: "Cloudflare", kategorija: K.hosting },
];

/** Da li host pripada domenu (sam domen ili njegov poddomen). */
export function pripadaDomenu(host, domen) {
  return host === domen || host.endsWith("." + domen);
}

/** Koji poznati servis stoji iza ovog hosta, ako ga prepoznajemo. */
export function servisZaHost(host) {
  for (const pravilo of PRAVILA) {
    if (pravilo.domeni?.some((d) => pripadaDomenu(host, d))) {
      return { ime: pravilo.ime, kategorija: pravilo.kategorija };
    }
  }
  const ostali = OSTALI_DOMENI.find((o) => pripadaDomenu(host, o.domen));
  return ostali ? { ime: ostali.ime, kategorija: ostali.kategorija } : null;
}

/**
 * Prepoznaje tehnologije na osnovu prikupljenih podataka o stranici.
 *
 * @param {{
 *   html: string, generatori: string[], zaglavlja: Record<string, string>,
 *   kolacici: string[], urlovi: string[], hostovi: string[]
 * }} podaci
 * @returns {{ ime: string, kategorija: string, verzija: string | null, dokaz: string }[]}
 */
export function prepoznajTehnologije(podaci) {
  const nadjene = new Map();

  for (const pravilo of PRAVILA) {
    const pogodak = proveriPravilo(pravilo, podaci);
    if (pogodak) {
      nadjene.set(pravilo.ime, {
        ime: pravilo.ime,
        kategorija: pravilo.kategorija,
        verzija: pogodak.verzija,
        dokaz: pogodak.dokaz,
      });
    }
  }

  for (const pravilo of PRAVILA) {
    if (!nadjene.has(pravilo.ime)) continue;
    for (const ime of pravilo.podrazumeva ?? []) {
      if (nadjene.has(ime)) continue;
      const osnova = PRAVILA.find((p) => p.ime === ime);
      nadjene.set(ime, {
        ime,
        kategorija: osnova?.kategorija ?? pravilo.kategorija,
        verzija: null,
        dokaz: `koristi ga ${pravilo.ime}`,
      });
    }
  }

  return [...nadjene.values()];
}

function proveriPravilo(pravilo, podaci) {
  // Redosled određuje koji dokaz se prikazuje: najkonkretniji izvori prvi,
  // a unutar svakog izvora prvi pogodak koji nosi verziju ima prednost.
  const izvori = [
    ["meta generator", pravilo.generator, podaci.generatori],
    ["adresa resursa", pravilo.urlovi, podaci.urlovi],
    ["HTML stranice", pravilo.html, [podaci.html]],
    ["kolačić", pravilo.kolacici, podaci.kolacici],
  ];

  let prvi = null;
  const zapamti = (dokaz, verzija) => {
    if (!prvi || (!prvi.verzija && verzija)) prvi = { dokaz, verzija };
  };

  for (const [ime, obrasci, vrednosti] of izvori) {
    for (const obrazac of obrasci ?? []) {
      for (const vrednost of vrednosti) {
        const m = obrazac.exec(vrednost);
        if (m) zapamti(ime, m[1] ?? null);
      }
    }
  }

  for (const [zaglavlje, obrasci] of Object.entries(pravilo.zaglavlja ?? {})) {
    const vrednost = podaci.zaglavlja[zaglavlje];
    if (vrednost === undefined) continue;
    for (const obrazac of obrasci) {
      const m = obrazac.exec(vrednost);
      if (m) zapamti(`zaglavlje ${zaglavlje}`, m[1] ?? null);
    }
  }

  for (const domen of pravilo.domeni ?? []) {
    if (podaci.hostovi.some((h) => pripadaDomenu(h, domen))) {
      zapamti(`resurs sa ${domen}`, null);
    }
  }

  return prvi;
}
