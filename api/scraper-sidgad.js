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

    // ── 2. Descobrir estructura del portal via DOM ────────────
    // Els PHP de sidgad necessiten sessió del portal; no funcionen en navegació directa.
    // Treballem dins el DOM del portal: clic a competició, llegim el calendari carregat.
    const compIds = await page.$$eval(
      `.listado_competiciones_fila.temp_${TEMP_ID}`,
      els => els.map(el => el.id).filter(Boolean)
    );
    console.log(`   Competicions temporada ${TEMP_ID}: ${compIds.length}`);

    // Clic a primera competició i espera que el calendari carregui
    await page.evaluate(id => { document.getElementById(id)?.click(); }, compIds[0]);
    await new Promise(r => setTimeout(r, 3000));

    // Debug: inspecciona el DOM per trobar els elements "lupa" i la seva estructura
    const debugInfo = await page.evaluate(() => {
      const info = {};

      // Busca contenidor principal de contingut
      const contentIds = ["sidgad_content_main", "content_main", "content_center",
                          "main_content", "sidgad_content", "centro_contenido"];
      for (const id of contentIds) {
        const el = document.getElementById(id);
        if (el && el.innerHTML.length > 200) {
          info.contentContainer = id;
          info.contentHtml = el.innerHTML.slice(0, 2000);
          break;
        }
      }
      // Fallback: primer div gran
      if (!info.contentContainer) {
        const divs = [...document.querySelectorAll("div")];
        const big = divs.find(d => d.id && d.innerHTML.length > 500);
        if (big) {
          info.contentContainer = big.id || big.className;
          info.contentHtml = big.innerHTML.slice(0, 2000);
        }
      }

      // Busca elements que semblin "lupa" / acta
      const lupaEls = [...document.querySelectorAll(
        '[class*="lupa"], [class*="search"], .fa-search, [onclick*="acta"], [act_id], [acta_id]'
      )];
      info.lupaCount = lupaEls.length;
      info.lupaExamples = lupaEls.slice(0, 3).map(el => ({
        tag: el.tagName,
        id: el.id,
        className: el.className,
        attrs: el.getAttributeNames().map(a => `${a}="${el.getAttribute(a)}"`).join(" "),
        html: el.outerHTML.slice(0, 200),
      }));

      // Tots els IDs i classes del DOM per trobar el contenidor de calendari
      const allIds = [...document.querySelectorAll("[id]")]
        .filter(el => el.innerHTML.length > 100)
        .map(el => `${el.tagName}#${el.id}(${el.innerHTML.length}ch)`)
        .slice(0, 30);
      info.allIds = allIds;

      return info;
    });

    console.log("\n--- DEBUG DOM portal post-clic competició ---");
    console.log("Contenidor:", debugInfo.contentContainer || "no trobat");
    console.log("Lupa elements:", debugInfo.lupaCount);
    if (debugInfo.lupaExamples?.length > 0) {
      debugInfo.lupaExamples.forEach((e, i) => console.log(`  lupa[${i}]: ${e.html}`));
    }
    console.log("IDs amb contingut:", (debugInfo.allIds || []).join(", "));
    if (debugInfo.contentHtml) {
      console.log("Content HTML (2000):\n" + debugInfo.contentHtml);
    }
    console.log("---\n");

    // Atura aquí fins que tinguem l'estructura correcta
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
