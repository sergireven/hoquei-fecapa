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

    // ── 1. Obtenir IDs de competicions de la temporada ────────
    const compIds = await page.$$eval(
      `.listado_competiciones_fila.temp_${TEMP_ID}`,
      els => els.map(el => el.id).filter(Boolean)
    );
    console.log(`   Competicions temporada ${TEMP_ID}: ${compIds.length}`);

    // ── 2. Recollir IDs d'actes des dels calendaris ───────────
    // Les actes acabades tenen un element amb atribut act_id o similar.
    const actaIds = new Set();
    let debugCalLogged = false;

    for (const compId of compIds) {
      try {
        await nav.goto(`${SERVER_BASE}fecapa_cal_idc_${compId}_1.php`,
          { waitUntil: "domcontentloaded", timeout: 15000 });
        const calHtml = await nav.evaluate(() => document.body?.innerHTML || "");

        // Debug: log primer calendari per veure estructura lupa/acta
        if (!debugCalLogged) {
          console.log(`\n--- DEBUG CALENDARI comp ${compId} (1500 chars) ---`);
          // Mostra les parts amb 'act', 'lupa', 'acta', 'search', onclick
          const relevant = calHtml.match(/.{0,80}(?:act_id|lupa|acta|fa-search|onclick)[^<]{0,150}/gi) || [];
          if (relevant.length > 0) {
            relevant.slice(0, 10).forEach(s => console.log("  " + s.replace(/\s+/g, " ").trim()));
          } else {
            console.log(calHtml.slice(0, 1500));
          }
          console.log("---\n");
          debugCalLogged = true;
        }

        // Extreu IDs d'actes: atributs com act_id="123", acta_id="123", o onclick amb ID numèric
        const found = [
          ...(calHtml.matchAll(/act(?:a)?_id\s*=\s*["']?(\d+)["']?/gi)),
          ...(calHtml.matchAll(/onclick\s*=\s*["'][^"']*?load_acta[^"']*?(\d{4,})["']/gi)),
          ...(calHtml.matchAll(/href\s*=\s*["'][^"']*?acta[_\-]?(\d{4,})["']/gi)),
        ];
        for (const m of found) actaIds.add(m[1]);

      } catch (e) {
        // Ignora errors individuals de competicions
      }
    }
    console.log(`   Actes descobertes: ${actaIds.size}`);

    // Si no hem trobat actes amb els patrons esperats, atura aquí per debugar
    if (actaIds.size === 0) {
      console.log("⚠ No s'han trobat actes. Revisa el debug del calendari.");
      await nav.close();
      return;
    }

    // ── 3. Processar actes per extreure jugadors ──────────────
    const discovered = {}; // sidgadId → { name, dorsal, isGK, registeredTeam }
    const actaList = [...actaIds].slice(0, MAX_ACTES);
    let actaDone = 0, debugActaLogged = false;

    for (const actaId of actaList) {
      try {
        // Prova URL: fecapa_act_idc_{id}_1.php i fecapa_acta_idc_{id}_1.php
        let actaHtml = "";
        for (const urlPat of [
          `${SERVER_BASE}fecapa_act_idc_${actaId}_1.php`,
          `${SERVER_BASE}fecapa_acta_idc_${actaId}_1.php`,
          `${SERVER_BASE}act_idc_${actaId}_1.php`,
        ]) {
          await nav.goto(urlPat, { waitUntil: "domcontentloaded", timeout: 12000 });
          actaHtml = await nav.evaluate(() => document.body?.innerHTML || "");
          if (actaHtml.length > 50 && !actaHtml.includes("File not found")) break;
        }

        if (!actaHtml || actaHtml.includes("File not found")) continue;

        // Debug: primer acta per veure estructura de jugadors
        if (!debugActaLogged) {
          console.log(`\n--- DEBUG ACTA ${actaId} (1500 chars) ---`);
          const relevant = actaHtml.match(/.{0,80}(?:id_player|player_name|porter|dorsal)[^<]{0,150}/gi) || [];
          if (relevant.length > 0) {
            relevant.slice(0, 10).forEach(s => console.log("  " + s.replace(/\s+/g, " ").trim()));
          } else {
            console.log(actaHtml.slice(0, 1500));
          }
          console.log("---\n");
          debugActaLogged = true;
        }

        // Extreu jugadors: busca id_player + player_name + position (P) + registered team
        // Format típic: <tr id_player="123" player_name="NOM" ...>
        const re = /id_player\s*=\s*["']?(\d+)["']?[^>]*>/gi;
        let m;
        while ((m = re.exec(actaHtml)) !== null) {
          const sid = m[1];
          if (discovered[sid]) continue;

          const tagHtml = m[0];
          const nameM = tagHtml.match(/player_name\s*=\s*["']([^"']+)["']/i);
          const dorsalM = tagHtml.match(/(?:dorsal|numero|num)\s*=\s*["']?(\d+)["']?/i);
          const teamM = tagHtml.match(/(?:equip_inscrit|club_inscrit|team_inscrit)\s*=\s*["']([^"']+)["']/i);

          // Porter: atribut porter="1" o posicion="P" o similar
          const isGK = /porter\s*=\s*["']?1["']?|posicion\s*=\s*["']?P["']?|pos\s*=\s*["']?P["']?/i.test(tagHtml);

          discovered[sid] = {
            name:           nameM?.[1]  || "",
            dorsal:         dorsalM?.[1] || null,
            isGK,
            registeredTeam: teamM?.[1]  || null,
          };
        }
        actaDone++;
      } catch { /* continua */ }
    }

    console.log(`   Jugadors descoberts: ${Object.keys(discovered).length} (de ${actaDone} actes)`);

    // ── 4. Enriquir jugadors nous amb perfil (data de naixement) ─
    const now = Date.now();
    const toFetch = Object.entries(discovered).filter(([sid]) => {
      const c = cache[sid];
      return !c || (now - new Date(c.fetchedAt).getTime()) > STALE_MS;
    }).slice(0, MAX_ACTES);

    console.log(`\n📊 A enriquir amb perfil: ${toFetch.length} jugadors`);
    let ok = 0, empty = 0;

    for (const [sidgadId, info] of toFetch) {
      try {
        // Perfil: jQuery POST al contenidor lateral del portal
        const profileHtml = await page.evaluate(async (sid, temp) => {
          return new Promise(resolve => {
            const container = document.getElementById("sidgad_thickbox_right_content");
            if (!container) { resolve(""); return; }
            const url = `https://www.server2.sidgad.es/fecapa/profiles/fecapa_profileseason_${sid}_1_${temp}.php`;
            jQuery(container).load(url,
              { idm: "1", idc: "0", id_player: sid, team_id: "0", temp_name: "2025/26" },
              () => resolve(container.innerHTML)
            );
            setTimeout(() => resolve(""), 8000);
          });
        }, sidgadId, TEMP_ID);

        const birthDate = parseBirthDate(profileHtml || "");

        if (!birthDate && (!profileHtml || profileHtml.replace(/<[^>]+>/g, "").trim().length < 10)) {
          empty++;
          continue;
        }

        cache[sidgadId] = {
          sidgadId,
          name:           info.name,
          dorsal:         info.dorsal         || null,
          birthDate:      birthDate           || null,
          registeredTeam: info.registeredTeam || null,
          isGK:           info.isGK           ?? null,
          fetchedAt:      new Date().toISOString(),
        };
        ok++;
      } catch { empty++; }
    }

    console.log(`   ✅ Enriquits: ${ok}, buits/errors: ${empty}`);

    // ── 5. Desar cache i índex de noms ────────────────────────
    await saveCache(cache);
    console.log(`\n✅ Cache desada: ${Object.keys(cache).length} jugadors → ${CACHE_FILE}`);

    const nameIndex = {};
    for (const [sid, data] of Object.entries(cache)) {
      const key = normName(data.name);
      if (key) nameIndex[key] = sid;
    }
    const indexFile = path.join(__dirname, "../public/jugadors-sidgad-index.json");
    await fs.writeFile(indexFile, JSON.stringify(nameIndex));
    console.log(`   Index: ${Object.keys(nameIndex).length} noms → ${indexFile}`);

    await nav.close();

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
