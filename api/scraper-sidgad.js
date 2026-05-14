// ============================================================
// FECAPA Sidgad Scraper
// Extreu dades de jugadors no disponibles a jok.cat:
// data de naixement, posició (porter), equip inscrit
// Flux: portal → calendari competició → actes → perfil jugador
// ============================================================

const puppeteer = require("puppeteer");
const fs        = require("fs").promises;
const path      = require("path");

const CACHE_FILE  = path.join(__dirname, "../public/jugadors-sidgad.json");
const PORTAL_URL  = "https://www.hoqueipatins.fecapa.cat/";
const SERVER_BASE = "https://www.server2.sidgad.es/fecapa/";
const TEMP_ID     = "39";   // temporada 2025-26
const MAX_ACTES   = 150;    // actes a processar per execució
const STALE_MS    = 30 * 24 * 60 * 60 * 1000;

async function loadCache() {
  try { return JSON.parse(await fs.readFile(CACHE_FILE, "utf8")); }
  catch { return {}; }
}

async function saveCache(cache) {
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function normName(name) {
  return (name || "")
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Extreu data de naixement del HTML del perfil lateral
function parseBirthDate(html) {
  const patterns = [
    /(\d{2}\/\d{2}\/\d{4})/,
    /(\d{2}-\d{2}-\d{4})/,
    /nascud[ao][^:]*:\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
    /data.*naix[^:]*:\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
    /fecha.*nac[^:]*:\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

async function main() {
  console.log("🏒 FECAPA Sidgad Scraper — iniciant...\n");

  const cache = await loadCache();
  console.log(`📋 Cache actual: ${Object.keys(cache).length} jugadors`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    // Pàgina principal del portal (per sessió/cookies)
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

    console.log("🌐 Carregant portal (sessió)...");
    await page.goto(PORTAL_URL, { waitUntil: "networkidle0", timeout: 45000 });
    await page.waitForSelector(".listado_competiciones_fila", { timeout: 20000 });
    console.log("   Portal carregat ✓");

    // Pàgina auxiliar per navegació directa (comparteix cookies)
    const nav = await browser.newPage();
    await nav.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

    // ── 2. Llegir scripts JS del portal per trobar URL d'actes ──
    // El calendari i les actes carreguen via AJAX quan es clica.
    // Els scripts JS del portal contenen les funcions que gestionen els clics.
    const compIds = await page.$$eval(
      `.listado_competiciones_fila.temp_${TEMP_ID}`,
      els => els.map(el => el.id).filter(Boolean)
    );
    console.log(`   Competicions temporada ${TEMP_ID}: ${compIds.length}`);

    // Obté tots els scripts externs
    const scriptUrls = await page.evaluate(() =>
      [...document.querySelectorAll("script[src]")].map(s => s.src)
    );
    console.log(`   Scripts trobats: ${scriptUrls.length}`);
    console.log("   " + scriptUrls.join("\n   "));

    // Busca en cada script les funcions relacionades amb actes/lupa
    const https = require("https");
    const http  = require("http");
    const fetchText = (url) => new Promise((res, rej) => {
      const mod = url.startsWith("https") ? https : http;
      mod.get(url, r => {
        let d = "";
        r.on("data", c => d += c);
        r.on("end", () => res(d));
      }).on("error", rej);
    });

    for (const url of scriptUrls) {
      try {
        const js = await fetchText(url);
        // Busca mencions d'acta, lupa, partido, load_acta, etc.
        const matches = js.match(/.{0,100}(?:acta|lupa|load_act|partido|id_partido|id_acta|id_act\b).{0,200}/gi) || [];
        if (matches.length > 0) {
          console.log(`\n--- SCRIPT: ${url.split("/").pop()} ---`);
          matches.slice(0, 8).forEach(m => console.log("  " + m.replace(/\s+/g, " ").trim()));
        }
      } catch { /* ignora */ }
    }

    // Intercepció de xarxa: clic a competició + clic lupa si possible
    const capturedResponses = new Map();
    page.on("response", async (response) => {
      const u = response.url();
      if (u.includes("server2.sidgad.es") || u.includes("sidgad.cloud")) {
        try { capturedResponses.set(u, await response.text()); } catch {}
      }
    });

    // Clic a la competició
    await page.evaluate(id => { document.getElementById(id)?.click(); }, compIds[0]);
    await new Promise(r => setTimeout(r, 3000));

    // Mostra les URLs capturades i busca patrons d'acta en el HTML
    console.log(`\n--- Respostes capturades post-clic: ${capturedResponses.size} ---`);
    for (const [u, html] of capturedResponses) {
      const actaPatterns = html.match(/.{0,50}(?:acta|lupa|id_act|id_partido|fa-search).{0,150}/gi) || [];
      console.log(`URL: ${u} (${html.length} chars)`);
      if (actaPatterns.length > 0) {
        actaPatterns.slice(0, 5).forEach(m => console.log("  " + m.replace(/\s+/g, " ").trim()));
      } else {
        console.log("  (cap patró d'acta)");
      }
    }
    console.log("---\n");

    await browser.close();
    return;

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
