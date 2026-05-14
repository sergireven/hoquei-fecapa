// ============================================================
// FECAPA Sidgad Scraper
// Extreu dades de jugadors no disponibles a jok.cat:
// data de naixement i equip inscrit
// Font: hoqueipatins.fecapa.cat (portal sidgad)
// ============================================================

const puppeteer = require("puppeteer");
const fs        = require("fs").promises;
const path      = require("path");

const CACHE_FILE = path.join(__dirname, "../public/jugadors-sidgad.json");
const PORTAL_URL = "https://www.hoqueipatins.fecapa.cat/";
const TEMP_ID    = "39";   // temporada 2025-26
const MAX_PER_RUN = 200;   // jugadors a enriquir per execució
const STALE_MS   = 30 * 24 * 60 * 60 * 1000; // re-enriquir als 30 dies

async function loadCache() {
  try {
    return JSON.parse(await fs.readFile(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Normalitza nom per fer matching entre sidgad i jok.cat
function normName(name) {
  return (name || "")
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Parseja el HTML del popup de perfil de jugador
function parseProfile(html) {
  const result = {};

  // Data de naixement: formats "DD/MM/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"
  const birthPatterns = [
    /nascud[ao][^:]*:\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
    /data.*naix[^:]*:\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
    /fecha.*nac[^:]*:\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
    /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/,
  ];
  for (const re of birthPatterns) {
    const m = html.match(re);
    if (m) { result.birthDate = m[1]; break; }
  }

  // Equip inscrit: "Equip inscrit", "Club inscrito", "Club", "Equip"
  const teamPatterns = [
    /equip\s+inscrit[^:]*:\s*<[^>]+>([^<]+)</i,
    /equip\s+inscrit[^:]*:\s*([^\n<]{3,50})/i,
    /club\s+inscrit[^:]*:\s*([^\n<]{3,50})/i,
    /club[^:]*:\s*<[^>]+>([^<]+)</i,
  ];
  for (const re of teamPatterns) {
    const m = html.match(re);
    if (m) { result.registeredTeam = m[1].trim(); break; }
  }

  // Posició / porter (formats Catalan i Castellà)
  const posPatterns = [
    /demarcaci[oó][^:]*:\s*<[^>]+>([^<]{2,25})</i,
    /demarcaci[oó][^:]*:\s*([^\n<]{2,25})/i,
    /posici[oó][^:]*:\s*<[^>]+>([^<]{2,25})</i,
    /posici[oó][^:]*:\s*([^\n<]{2,25})/i,
  ];
  for (const re of posPatterns) {
    const m = html.match(re);
    if (m) {
      result.position = m[1].trim();
      result.isGK = /porter|portero|goalkeeper/i.test(m[1]);
      break;
    }
  }
  // Fallback: "porter" al text visible sense etiquetar explícitament
  if (result.isGK === undefined) {
    const text = html.replace(/<[^>]+>/g, " ");
    result.isGK = /\bporter\b|\bportero\b/i.test(text) ? true : undefined;
  }

  return result;
}

async function main() {
  console.log("🏒 FECAPA Sidgad Scraper — iniciant...\n");

  const cache = await loadCache();
  const cachedCount = Object.keys(cache).length;
  console.log(`📋 Cache actual: ${cachedCount} jugadors`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    // ── 1. Carregar el portal ─────────────────────────────────
    console.log("🌐 Carregant portal...");
    await page.goto(PORTAL_URL, { waitUntil: "networkidle0", timeout: 45000 });

    // Esperar que carregui la llista de competicions
    await page.waitForSelector(".listado_competiciones_fila", { timeout: 20000 });
    console.log("   Portal carregat ✓");

    // ── 2. Obtenir competicions de la temporada actual ────────
    const compIds = await page.$$eval(
      `.listado_competiciones_fila.temp_${TEMP_ID}`,
      els => els.map(el => el.id).filter(Boolean)
    );
    console.log(`   Competicions temporada ${TEMP_ID}: ${compIds.length}`);

    // ── 3. Descobrir jugadors navegant a fecapa_stats_1_{compId}.php ──
    // URL descoberta interceptant AJAX del portal: el botó plantilla/goles/etc.
    // apunta a stats_1_{compId}.php → amb prefix fecapa_ → fecapa_stats_1_{compId}.php
    const BASE_STATS = "https://www.server2.sidgad.es/fecapa/fecapa_stats_1_";
    const discovered = {};
    let compsDone = 0;
    let debugLogged = false;

    const dataPage = await browser.newPage();
    await dataPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    function extractPlayersFromHtml(html) {
      const players = [];
      // Atributs HTML: id_player="123" (amb o sense player_name)
      const re = /id_player\s*=\s*["']?(\d+)["']?(?:[^>]*(?:player_name|nombre)\s*=\s*["']([^"']{2,50})["'])?/gi;
      let m;
      while ((m = re.exec(html)) !== null) {
        if (!players.find(p => p.sidgadId === m[1])) {
          players.push({ sidgadId: m[1], playerName: m[2] || "" });
        }
      }
      return players;
    }

    for (const compId of compIds) {
      try {
        await dataPage.goto(`${BASE_STATS}${compId}.php`, { waitUntil: "domcontentloaded", timeout: 15000 });
        const html = await dataPage.evaluate(() => document.body?.innerHTML || "");

        // Debug: primera competició — mostra HTML i jugadors trobats
        if (!debugLogged) {
          const players0 = extractPlayersFromHtml(html);
          console.log(`\n--- DEBUG stats comp ${compId} ---`);
          console.log(`HTML (600 chars): ${html.slice(0, 600)}`);
          console.log(`id_player trobats: ${players0.length}`);
          console.log("---\n");
          debugLogged = true;
        }

        const players = extractPlayersFromHtml(html);
        for (const p of players) {
          if (!discovered[p.sidgadId]) discovered[p.sidgadId] = { name: p.playerName };
        }
        compsDone++;
      } catch (e) {
        console.log(`   ⚠ Comp ${compId}: ${e.message?.slice(0, 80)}`);
      }
    }

    await dataPage.close();

    const totalDiscovered = Object.keys(discovered).length;
    console.log(`   Jugadors sidgad descoberts: ${totalDiscovered} (de ${compsDone} competicions)`);

    // ── 4. Filtrar els que cal enriquir ───────────────────────
    const now = Date.now();
    const toFetch = Object.entries(discovered)
      .filter(([sid]) => {
        const c = cache[sid];
        if (!c) return true;
        return (now - new Date(c.fetchedAt).getTime()) > STALE_MS;
      })
      .slice(0, MAX_PER_RUN);

    console.log(`\n📊 A enriquir: ${toFetch.length} jugadors (màxim ${MAX_PER_RUN} per execució)`);

    // ── 5. Enriquir cada jugador via jQuery in-page ───────────
    let ok = 0, empty = 0, errors = 0;
    let sampleLogged = false;

    for (const [sidgadId, info] of toFetch) {
      try {
        const profileHtml = await page.evaluate(
          async (sid, temp) => {
            return new Promise((resolve) => {
              const container = document.getElementById("sidgad_thickbox_right_content");
              if (!container) { resolve(""); return; }

              // URL del fitxer PHP del perfil
              const url = `https://www.server2.sidgad.es/fecapa/profiles/fecapa_profileseason_${sid}_1_${temp}.php`;

              jQuery(container).load(
                url,
                { idm: "1", idc: "0", id_player: sid, team_id: "0", temp_name: "2025/26" },
                function() { resolve(container.innerHTML); }
              );
              // Timeout de seguretat
              setTimeout(() => resolve(""), 8000);
            });
          },
          sidgadId,
          TEMP_ID
        );

        if (!profileHtml || profileHtml.replace(/<[^>]+>/g, "").trim().length < 10) {
          empty++;
          continue;
        }

        // Log el primer perfil per depurar l'estructura HTML
        if (!sampleLogged) {
          console.log("\n--- MOSTRA HTML PERFIL (primer jugador) ---");
          console.log(profileHtml.slice(0, 800));
          console.log("---\n");
          sampleLogged = true;
        }

        const parsed = parseProfile(profileHtml);

        cache[sidgadId] = {
          sidgadId,
          name:           info.name,
          birthDate:      parsed.birthDate      || null,
          registeredTeam: parsed.registeredTeam || null,
          position:       parsed.position       || null,
          isGK:           parsed.isGK           ?? null,
          fetchedAt:      new Date().toISOString(),
        };
        ok++;
      } catch (e) {
        errors++;
      }
    }

    console.log(`   ✅ Enriquits: ${ok}, buits: ${empty}, errors: ${errors}`);

    // ── 6. Desar cache ────────────────────────────────────────
    await saveCache(cache);
    console.log(`\n✅ Sidgad cache desada: ${Object.keys(cache).length} jugadors total`);
    console.log(`   → ${CACHE_FILE}`);

    // ── 7. Resum del mapeig nom → sidgadId ───────────────────
    const nameIndex = {};
    for (const [sid, data] of Object.entries(cache)) {
      const key = normName(data.name);
      if (key) nameIndex[key] = sid;
    }
    const indexFile = path.join(__dirname, "../public/jugadors-sidgad-index.json");
    await fs.writeFile(indexFile, JSON.stringify(nameIndex));
    console.log(`   → ${indexFile} (${Object.keys(nameIndex).length} entrades)`);

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
