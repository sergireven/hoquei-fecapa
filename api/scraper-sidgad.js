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

    // ── 2. El contingut ja és al DOM — llegim directament els elements de competició ──
    // El portal pre-carrega tot: cada competició és un <A id="compId"> amb el calendari dins.
    // No cal clicar res — extraiem les actes directament del DOM.

    const compIds = await page.$$eval(
      `.listado_competiciones_fila.temp_${TEMP_ID}`,
      els => els.map(el => el.id).filter(Boolean)
    );
    console.log(`   Competicions temporada ${TEMP_ID}: ${compIds.length}`);

    // Debug: llegeix el contingut de la competició amb més partits
    // (A#3929 té 19KB, probablement molts partits acabats amb lupa)
    const bigCompDebug = await page.evaluate(() => {
      // Competicions per mida de contingut
      const comps = [...document.querySelectorAll(".listado_competiciones_fila")]
        .map(el => ({ id: el.id, len: el.innerHTML.length }))
        .sort((a, b) => b.len - a.len)
        .slice(0, 5);

      const result = { compSizes: comps };

      // Llegeix la competició més gran per veure estructura de partits
      if (comps[0]) {
        const el = document.getElementById(comps[0].id);
        if (el) {
          // Busca totes les files de partits (probablement <tr> o <div> amb class "partido" o similar)
          const rows = el.querySelectorAll("tr, .partido, .match, .jornada_partido, [class*='partido'], [class*='match']");
          result.rowCount = rows.length;
          result.rowSample = rows.length > 0 ? rows[0].outerHTML.slice(0, 500) : "";

          // Busca ícones lupa/search dins la competició
          const lupas = el.querySelectorAll(".fa-search, .lupa, [class*='lupa'], [class*='acta'], i[class*='fa']");
          result.lupaCount = lupas.length;
          result.lupaSample = lupas.length > 0 ? lupas[0].outerHTML.slice(0, 300) : "";
          result.lupaParentSample = lupas.length > 0 ? lupas[0].parentElement?.outerHTML.slice(0, 400) : "";

          // Mostra 3000 chars del contingut per entendre l'estructura
          result.htmlSample = el.innerHTML.slice(0, 3000);
        }
      }
      return result;
    });

    console.log("\n--- DEBUG competicions per mida ---");
    console.log("Top 5:", JSON.stringify(bigCompDebug.compSizes));
    console.log(`Files de partits: ${bigCompDebug.rowCount}`);
    console.log(`Lupas trobades: ${bigCompDebug.lupaCount}`);
    if (bigCompDebug.lupaSample) console.log("Lupa:", bigCompDebug.lupaSample);
    if (bigCompDebug.lupaParentSample) console.log("Parent lupa:", bigCompDebug.lupaParentSample);
    console.log("HTML mostra (3000):\n" + (bigCompDebug.htmlSample || "buit"));
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
