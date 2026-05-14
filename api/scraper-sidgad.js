// ============================================================
// FECAPA Sidgad Scraper  (portales.js reverse-engineered)
//
// Flux:
//  1. Clic competició → calendari a #tab_modal_contenido_competicion
//  2. .game_report[idp] → fecapa_gr_{idp}_1.php → acta a #sidgad_thickbox_content
//  3. .player_season_stats[id_player] → perfil a #sidgad_thickbox_right_content
//  4. Parseja data de naixement, posició (porter), equip inscrit
// ============================================================

const puppeteer = require("puppeteer");
const fs        = require("fs").promises;
const path      = require("path");

const CACHE_FILE   = path.join(__dirname, "../public/jugadors-sidgad.json");
const PORTAL_URL   = "https://www.hoqueipatins.fecapa.cat/";
const SERVER_BASE  = "https://www.server2.sidgad.es/fecapa/";
const TEMP_ID      = "39";    // temporada 2025-26
const IDM          = "1";
const MAX_MATCHES  = 300;     // partits a processar per execució
const MAX_PROFILES = 200;     // perfils a enriquir per execució
const STALE_MS     = 30 * 24 * 60 * 60 * 1000;

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
    .replace(/[^A-Z0-9 ]/g, " ") // Allow spaces
    .replace(/\s+/g, " ")
    .trim();
}
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

// Executa jQuery.load dins la pàgina i retorna el HTML del contenidor
async function jqLoad(page, containerId, url, postData, timeoutMs = 10000) {
  return page.evaluate(
    async (cid, u, data, tms) => {
      return new Promise(resolve => {
        const el = document.getElementById(cid);
        if (!el) { resolve(""); return; }
        jQuery(el).load(u, data, function() { resolve(el.innerHTML); });
        setTimeout(() => resolve(""), tms);
      });
    },
    containerId, url, postData, timeoutMs
  );
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
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

    console.log("🌐 Carregant portal...");
    await page.goto(PORTAL_URL, { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForSelector(".listado_competiciones_fila", { timeout: 20000 });
    console.log("   Portal carregat ✓");

    // ── 1. Obtenir IDs de competicions ───────────────────────
    const compIds = await page.$$eval(
      `.listado_competiciones_fila.temp_${TEMP_ID}`,
      els => els.map(el => el.id).filter(Boolean)
    );
    console.log(`   Competicions temporada ${TEMP_ID}: ${compIds.length}`);

    // ── 2. Recollir IDs de partits (idp) dels calendaris ─────
    // Clic a cada competició → calendari carrega a #tab_modal_contenido_competicion
    // Busca .game_report[idp] (partits acabats amb lupa disponible)
    const matchIds = new Map(); // idp → { compId }
    let debugMatchLogged = false;

    for (const compId of compIds) {
      try {
        await page.evaluate(id => { document.getElementById(id)?.click(); }, compId);
        // Espera que el calendari carregui (resposta AJAX)
        await page.waitForFunction(
          (cid) => {
            const el = document.getElementById("tab_modal_contenido_competicion");
            return el && el.querySelectorAll(".game_report").length > 0;
          },
          { timeout: 6000 },
          compId
        ).catch(() => {}); // no llença error si no hi ha partits acabats

        const matches = await page.$$eval(
          "#tab_modal_contenido_competicion .game_report[idp]",
          els => els.map(el => ({ idp: el.getAttribute("idp"), idc: el.getAttribute("idc") || "" }))
        );

        // Debug: primera competició amb partits
        if (!debugMatchLogged && matches.length > 0) {
          const sample = await page.evaluate(() => {
            const el = document.getElementById("tab_modal_contenido_competicion");
            return el?.innerHTML?.slice(0, 800) || "";
          });
          console.log(`\n--- DEBUG: calendari comp ${compId} (${matches.length} partits) ---`);
          console.log(sample.replace(/\s+/g, " ").trim().slice(0, 600));
          console.log("---\n");
          debugMatchLogged = true;
        }

        for (const m of matches) {
          if (!matchIds.has(m.idp)) matchIds.set(m.idp, { compId, idc: m.idc || compId });
        }
      } catch { /* continua */ }
    }
    console.log(`   Partits amb acta descoberts: ${matchIds.size}`);

    // ── 3. Carregar actes i extreure jugadors ─────────────────
    const discovered = {}; // id_player → { name, isGK, registeredTeam }
    const matchList = [...matchIds.entries()].slice(0, MAX_MATCHES);
    let actaDone = 0, debugActaLogged = false;

    for (const [idp, { compId, idc }] of matchList) {
      try {
        const actaUrl = `${SERVER_BASE}fecapa_gr_${idp}_${IDM}.php`;
        const html = await jqLoad(page, "sidgad_thickbox_content", actaUrl,
          { idm: IDM, idc: idc || compId, idp, tab: "tab_ficha_resumen" }, 10000);

        if (!html || html.length < 50) continue;

        // Debug: primer acta
        if (!debugActaLogged) {
          console.log(`\n--- DEBUG ACTA idp=${idp} (${html.length} chars) ---`);
          const relevant = html.match(/.{0,60}(?:player_season_stats|id_player|player_name|porter|dorsal|inscrit).{0,100}/gi) || [];
          if (relevant.length > 0) {
            relevant.slice(0, 8).forEach(s => console.log("  " + s.replace(/\s+/g, " ").trim()));
          } else {
            console.log(html.slice(0, 800));
          }
          console.log("---\n");
          debugActaLogged = true;
        }

        // Extreu jugadors: .player_season_stats[id_player][player_name]
        const players = await page.evaluate(() => {
          const container = document.getElementById("sidgad_thickbox_content");
          if (!container) return [];
          return [...container.querySelectorAll(".player_season_stats")].map(el => {
            const idAttr = el.getAttribute("id_player");
            const id_player = (idAttr && idAttr !== "0" && /^\d+$/.test(idAttr))
              ? idAttr
              : (el.id && /^\d+$/.test(el.id) ? el.id : null);
            const row = el.closest("tr") || el.parentElement;
            const cells = row ? [...row.querySelectorAll("td")] : [];
            const isGK = cells.some(td => /^\s*[Pp]\s*$/.test(td.textContent));
            const teamCell = cells.find(td => /^[A-Z]{2,8}$/.test(td.textContent.trim()));
            return {
              id_player,
              player_name:   el.getAttribute("player_name") || el.textContent.trim(),
              isGK,
              registeredTeam: teamCell?.textContent.trim() || null,
            };
          }).filter(p => p.id_player);
        });

        for (const p of players) {
          if (!discovered[p.id_player]) {
            discovered[p.id_player] = {
              name:           p.player_name,
              isGK:           p.isGK,
              registeredTeam: p.registeredTeam,
            };
          }
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
    }).slice(0, MAX_PROFILES);

    console.log(`\n📊 A enriquir amb perfil: ${toFetch.length} jugadors`);
    let ok = 0, empty = 0;
    let debugProfileLogged = false;

    for (const [sidgadId, info] of toFetch) {
      try {
        const profileUrl = `${SERVER_BASE}profiles/fecapa_profileseason_${sidgadId}_${IDM}_${TEMP_ID}.php`;
        const html = await jqLoad(page, "sidgad_thickbox_right_content", profileUrl,
          { idm: IDM, idc: "0", id_player: sidgadId, team_id: "0", temp_name: "2025/26" }, 8000);

        // Debug: primer perfil
        if (!debugProfileLogged && html && html.length > 50) {
          console.log(`\n--- DEBUG PERFIL id=${sidgadId} (${html.length} chars) ---`);
          console.log(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500));
          console.log("---\n");
          debugProfileLogged = true;
        }

        const birthDate = parseBirthDate(html || "");
        if (!birthDate && (!html || html.replace(/<[^>]+>/g, "").trim().length < 10)) {
          empty++;
          continue;
        }

        cache[sidgadId] = {
          sidgadId,
          name:           info.name,
          birthDate:      birthDate           || null,
          registeredTeam: info.registeredTeam || null,
          isGK:           info.isGK           ?? null,
          fetchedAt:      new Date().toISOString(),
        };
        ok++;
      } catch { empty++; }
    }
    console.log(`   ✅ Enriquits: ${ok}, buits/errors: ${empty}`);

    // ── 5. Desar cache i índex ────────────────────────────────
    await saveCache(cache);
    console.log(`\n✅ Cache: ${Object.keys(cache).length} jugadors → ${CACHE_FILE}`);

    // Format sidgad: [CODI_EQUIP?] COGNOM1 [COGNOM2] NOM [NOM2]
    // Format jok.cat: NOM [NOM2] COGNOM1 [COGNOM2]
    // Generem totes les variants per garantir el matching
    const nameIndex = {};
    const addKey = (key, sid) => { if (key && key.length > 1 && !nameIndex[key]) nameIndex[key] = sid; };
    const addVariants = (words, sid) => {
      if (!words.length) return;
      addKey(words.join(" "), sid);
      // Últim mot al davant (1 nom de pila)
      if (words.length >= 2)
        addKey([words[words.length - 1], ...words.slice(0, -1)].join(" "), sid);
      // Últims 2 mots al davant (nom compost)
      if (words.length >= 3)
        addKey([...words.slice(-2), ...words.slice(0, -2)].join(" "), sid);
      // Nom + primer cognom (sense segon cognom) — cobreix casos on jok.cat no té 2n cognom
      if (words.length >= 3)
        addKey([words[words.length - 1], words[0]].join(" "), sid);
    };
    for (const [sid, data] of Object.entries(cache)) {
      const words = normName(data.name).split(" ").filter(Boolean);
      if (!words.length) continue;
      addVariants(words, sid);
      // Sense codi d'equip (primer mot alfanumèric curt = codi d'equip o categoria)
      if (words.length >= 3 && words[0].length <= 6) {
        addVariants(words.slice(1), sid);
        // Alguns codis ocupen 2 mots (p.ex. "DE LA" → no, però "NACC2 JUVB" sí)
        if (words.length >= 4 && words[1].length <= 6)
          addVariants(words.slice(2), sid);
      }
    }
    const indexFile = path.join(__dirname, "../public/jugadors-sidgad-index.json");
    await fs.writeFile(indexFile, JSON.stringify(nameIndex));
    console.log(`   Index: ${Object.keys(nameIndex).length} variants → ${indexFile}`);

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
