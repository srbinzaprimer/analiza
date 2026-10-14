import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  GreskaAnalize,
  analizirajSajt,
  normalizujAdresu,
} from "../src/analizator.mjs";
import { htmlIzvestaj } from "../src/izvestaj-html.mjs";
import { listaProvera } from "../src/izvestaj.mjs";
import { prepoznajTehnologije } from "../src/tehnologije.mjs";

const pokreni = promisify(execFile);
const KOMANDA = fileURLToPath(new URL("../analiza.mjs", import.meta.url));

const DUG_TEKST = "Ovo je tekst o kafi i čaju koji posetilac zaista vidi. ".repeat(8);

const WORDPRESS_STRANA = `<!doctype html>
<html lang="sr-RS">
<head>
<meta charset="utf-8">
<meta name="generator" content="WordPress 6.5.2">
<title>Kafa &amp; čaj &lt;script&gt;alert(1)&lt;/script&gt;</title>
<link rel="stylesheet" href="/wp-content/themes/astra/style.css?ver=4.6">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto">
<script src="/wp-includes/js/jquery/jquery.min.js?ver=3.7.1"></script>
<script src="/wp-content/plugins/elementor/assets/js/frontend.min.js"></script>
<script src="/wp-content/plugins/contact-form-7/includes/js/index.js"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script>
<script>window.dataLayer=[];function gtag(){dataLayer.push(arguments)}gtag('config','G-ABC123');</script>
<script type="application/ld+json">{"@type":"Organization"}</script>
</head>
<body>
<h1>Dobrodošli</h1>
<p>${DUG_TEKST}</p>
<img src="/wp-content/uploads/kafa.jpg" alt="Kafa">
<img src="/wp-content/uploads/caj.jpg">
<img src="data:image/gif;base64,R0lGOD" data-src="/wp-content/uploads/lenja.jpg" alt="">
<iframe src="https://www.youtube.com/embed/abc"></iframe>
</body>
</html>`;

const MALA_STRANA = `<!doctype html>
<html lang="sr"><head><title>Mala strana za merenje</title>
<meta name="description" content="${"Opis stranice koji ima dovoljno znakova za proveru. ".repeat(2).trim()}">
<link rel="stylesheet" href="/static/stil.css">
<script src="/static/app.js"></script>
<script src="/static/nema.js"></script>
</head><body><h1>Mala</h1><p>${DUG_TEKST}</p><img src="/static/slika.png" alt="slika"></body></html>`;

const SPA_STRANA = `<!doctype html><html><head><title>Aplikacija</title>
<script src="/_next/static/chunks/main.js" defer></script></head>
<body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">{}</script></body></html>`;

// "Čaj" u kodnoj strani windows-1250 (Č = 0xC8).
const CP1250_STRANA = Buffer.concat([
  Buffer.from("<html><head><title>", "latin1"),
  Buffer.from([0xc8, 0x61, 0x6a]),
  Buffer.from("</title></head><body></body></html>", "latin1"),
]);

const RUTE = {
  "/": {
    zaglavlja: {
      "content-type": "text/html; charset=utf-8",
      server: "nginx/1.24.0",
      "x-powered-by": "PHP/8.2.1",
      "set-cookie": "PHPSESSID=abc; Path=/",
    },
    telo: WORDPRESS_STRANA,
  },
  "/mala": { zaglavlja: { "content-type": "text/html" }, telo: MALA_STRANA },
  "/spa": { zaglavlja: { "content-type": "text/html" }, telo: SPA_STRANA },
  "/cp1250": {
    zaglavlja: { "content-type": "text/html; charset=windows-1250" },
    telo: CP1250_STRANA,
  },
  "/stara": { status: 301, zaglavlja: { location: "/mala" }, telo: "" },
  "/static/app.js": { zaglavlja: { "content-type": "text/javascript" }, telo: "a".repeat(1000) },
  "/static/stil.css": { zaglavlja: { "content-type": "text/css" }, telo: "b".repeat(500) },
  "/static/slika.png": { zaglavlja: { "content-type": "image/png" }, telo: Buffer.alloc(2000) },
  "/robots.txt": {
    zaglavlja: { "content-type": "text/plain" },
    telo: "User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n",
  },
};

let server;
let osnova;

before(async () => {
  server = createServer((zahtev, odgovor) => {
    const ruta = RUTE[new URL(zahtev.url, "http://x").pathname];
    if (!ruta) {
      odgovor.writeHead(404, { "content-type": "text/plain" }).end("nema");
      return;
    }
    odgovor.writeHead(ruta.status ?? 200, ruta.zaglavlja).end(ruta.telo);
  });
  await new Promise((gotovo) => server.listen(0, "127.0.0.1", gotovo));
  osnova = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

describe("normalizujAdresu", () => {
  test("dodaje https:// kad nedostaje", () => {
    assert.equal(normalizujAdresu("primer.rs"), "https://primer.rs/");
    assert.equal(normalizujAdresu("  http://primer.rs/a  "), "http://primer.rs/a");
  });

  test("odbija prazne i ne-web adrese", () => {
    assert.throws(() => normalizujAdresu(""), GreskaAnalize);
    assert.throws(() => normalizujAdresu("ftp://primer.rs"), GreskaAnalize);
    assert.throws(() => normalizujAdresu("http://"), GreskaAnalize);
  });
});

describe("WordPress sajt", () => {
  let r;
  before(async () => {
    r = await analizirajSajt(osnova + "/", { meriVelicinu: false });
  });

  test("prepoznaje tehnologije sa verzijama i dokazom", () => {
    const po = Object.fromEntries(r.tehnologije.map((t) => [t.ime, t]));
    assert.equal(po.WordPress.verzija, "6.5.2");
    assert.equal(po.WordPress.dokaz, "meta generator");
    assert.equal(po.Nginx.verzija, "1.24.0");
    assert.equal(po.PHP.verzija, "8.2.1");
    assert.equal(po.jQuery.verzija, "3.7.1");
    assert.ok(po["Google Analytics"]);
    assert.ok(po["Google Fonts"]);
    assert.ok(po.YouTube);
    assert.equal(po["Google Tag Manager"], undefined, "gtag.js nije Tag Manager");
  });

  test("izvlači WordPress temu i dodatke", () => {
    assert.deepEqual(r.wordpress, {
      teme: ["astra"],
      dodaci: ["contact-form-7", "elementor"],
    });
  });

  test("razdvaja spoljne domene i imenuje poznate servise", () => {
    const po = Object.fromEntries(r.spoljniServisi.map((s) => [s.host, s]));
    assert.deepEqual(Object.keys(po).sort(), [
      "fonts.googleapis.com",
      "www.googletagmanager.com",
      "www.youtube.com",
    ]);
    assert.equal(po["fonts.googleapis.com"].servis, "Google Fonts");
    assert.equal(po["www.youtube.com"].servis, "YouTube");
    assert.deepEqual(po["www.youtube.com"].vrste, ["iframe"]);
  });

  test("broji skripte i ne računa JSON-LD kao skriptu", () => {
    assert.equal(r.skripte.saAdresom, 4);
    assert.equal(r.skripte.spoljne, 1);
    assert.equal(r.skripte.uStranici, 1);
  });

  test("SEO provere", () => {
    assert.equal(r.naslov, "Kafa & čaj <script>alert(1)</script>");
    assert.equal(r.seo.opis.tekst, null);
    assert.equal(r.seo.h1.broj, 1);
    assert.equal(r.seo.jezik, "sr-RS");
    assert.deepEqual(r.seo.slike, { ukupno: 3, bezAlt: 1 });
    assert.equal(r.seo.strukturiraniPodaci, 1);
    assert.equal(r.seo.robotsTxt, true);
    assert.deepEqual(r.seo.sitemap, { postoji: true, adrese: ["/sitemap.xml"] });

    const seo = listaProvera(r)[0].stavke;
    assert.ok(seo.some((s) => s.stanje === "problem" && s.tekst.includes("meta description")));
  });

  test("bezbednost: otkrivene verzije softvera", () => {
    assert.equal(r.bezbednost.https, false);
    assert.deepEqual(r.bezbednost.otkrivaVerzije, [
      "server: nginx/1.24.0",
      "x-powered-by: PHP/8.2.1",
    ]);
  });

  test("HTML izveštaj bezbedno prikazuje tekst sa sajta", () => {
    const html = htmlIzvestaj(r);
    assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
    assert.ok(!html.includes("<script>alert(1)"));
    assert.ok(!/<script\b/i.test(html), "izveštaj ne sme da sadrži skripte");
  });
});

describe("merenje veličine", () => {
  test("sabira veličine resursa i beleži neuspela preuzimanja", async () => {
    const r = await analizirajSajt(osnova + "/mala");
    assert.equal(r.velicina.skripte, 1000);
    assert.equal(r.velicina.stilovi, 500);
    assert.equal(r.velicina.slike, 2000);
    assert.equal(r.velicina.neuspesno, 1);
    assert.equal(r.velicina.ukupno, r.velicina.html + 3500);
    const app = r.skripte.lista.find((s) => s.url.endsWith("/static/app.js"));
    assert.equal(app.bajtova, 1000);
  });
});

describe("posebni slučajevi", () => {
  test("prati preusmerenje", async () => {
    const r = await analizirajSajt(osnova + "/stara", { meriVelicinu: false });
    assert.equal(r.konacnaAdresa, osnova + "/mala");
  });

  test("prepoznaje Next.js i upozorava da sadržaj iscrtava JavaScript", async () => {
    const r = await analizirajSajt(osnova + "/spa", { meriVelicinu: false });
    const imena = r.tehnologije.map((t) => t.ime);
    assert.ok(imena.includes("Next.js"));
    assert.ok(imena.includes("React"));
    assert.ok(r.napomene.some((n) => n.includes("SPA")));
  });

  test("čita stranice u kodnoj strani windows-1250", async () => {
    const r = await analizirajSajt(osnova + "/cp1250", { meriVelicinu: false });
    assert.equal(r.naslov, "Čaj");
  });

  test("nedostupan sajt daje razumljivu grešku", async () => {
    const zatvoren = createServer();
    await new Promise((gotovo) => zatvoren.listen(0, "127.0.0.1", gotovo));
    const port = zatvoren.address().port;
    await new Promise((gotovo) => zatvoren.close(gotovo));

    await assert.rejects(
      analizirajSajt(`http://127.0.0.1:${port}`, { meriVelicinu: false }),
      (greska) =>
        greska instanceof GreskaAnalize && greska.message.includes("odbio vezu"),
    );
  });
});

describe("prepoznajTehnologije", () => {
  test("prepoznaje Cloudflare po zaglavljima", () => {
    const nadjene = prepoznajTehnologije({
      html: "",
      generatori: [],
      zaglavlja: { server: "cloudflare", "cf-ray": "8a1b2c3d4e5f-BEG" },
      kolacici: [],
      urlovi: [],
      hostovi: [],
    });
    assert.deepEqual(nadjene, [
      {
        ime: "Cloudflare",
        kategorija: "Hosting / CDN",
        verzija: null,
        dokaz: "zaglavlje server",
      },
    ]);
  });
});

describe("komanda", () => {
  test("--json ispisuje rezultat i čuva HTML izveštaj", async () => {
    const folder = await mkdtemp(join(tmpdir(), "analiza-"));
    try {
      const { stdout } = await pokreni("node", [
        KOMANDA,
        osnova + "/mala",
        "--json",
        "--bez-merenja",
        "--izlaz",
        folder,
      ]);
      const r = JSON.parse(stdout);
      assert.equal(r.naslov, "Mala strana za merenje");
      assert.equal(r.velicina, null);
      const html = await readFile(join(folder, "127.0.0.1.html"), "utf8");
      assert.ok(html.includes("Mala strana za merenje"));
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  test("bez adrese prikazuje pomoć i vraća kod 2", async () => {
    await assert.rejects(pokreni("node", [KOMANDA]), (greska) => {
      assert.equal(greska.code, 2);
      assert.ok(greska.stderr.includes("Upotreba:"));
      return true;
    });
  });
});
