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

    // Debug: estructura inicial d'una fila de competició (onclick, atributs)
    const firstRowDebug = await page.evaluate(tempId => {
      const rows = Array.from(document.querySelectorAll(`.listado_competiciones_fila.temp_${tempId}`)).slice(0, 2);
      return rows.map(r => ({
        id:      r.id,
        onclick: r.getAttribute("onclick"),
        compId:  r.getAttribute("comp_id") || r.getAttribute("data-comp") || r.getAttribute("id_comp"),
        html:    r.outerHTML.slice(0, 400),
      }));
    }, TEMP_ID);
    console.log("   Exemple files competició:", JSON.stringify(firstRowDebug, null, 2));

    // ── 3. Per cada competició, recollir id_player de sidgad ──
    // Intercepta peticions de xarxa per descobrir URLs de jugadors
    const capturedUrls = [];
    page.on("request", req => {
      const u = req.url();
      if ((u.includes("sidgad") || u.includes("fecapa")) && !capturedUrls.includes(u)) {
        capturedUrls.push(u);
      }
    });

    const discovered = {}; // sidgadId -> { name }
    let compsDone = 0;
    let debugLogged = false;

    for (const compId of compIds) {
      try {
        // Clic via JS (getElementById) per evitar errors de CSS amb IDs numèrics
        const clicked = await page.evaluate(id => {
          const el = document.getElementById(id);
          if (!el) return false;
          el.click();
          return true;
        }, compId);

        if (!clicked) continue;

        // Espera que el panell de la competició carregui contingut
        await page.waitForFunction(
          () => {
            const c = document.getElementById("sidgad_thickbox_right_content");
            // també mira si la fila clicada s'ha expandit (inline)
            const expanded = document.querySelector(".comp_expanded, .competition_expanded, [class*='comp_detail']");
            return (c && c.innerHTML.trim().length > 100) || !!expanded;
          },
          { timeout: 8000 }
        ).catch(() => {});

        // Debug detallat: primer clic
        if (!debugLogged) {
          const dbg = await page.evaluate(() => {
            const rightContent = document.getElementById("sidgad_thickbox_right_content");
            const rightFull    = document.getElementById("sidgad_thickbox_right");
            // Cerca qualsevol element amb els atributs de jugador
            const playerEls = Array.from(document.querySelectorAll("[id_player],[player_id],[data-player],[id-player]"))
              .slice(0, 5).map(e => e.outerHTML.slice(0, 200));
            // Cerca tabs/botons amb text de jugadors dins el right panel
            const tabsInRight = rightFull ? Array.from(rightFull.querySelectorAll("a,li,span,div,button"))
              .filter(e => e.textContent.trim().length > 0 && e.textContent.trim().length < 50)
              .slice(0, 10).map(e => e.outerHTML.slice(0, 200)) : [];
            // Cerca qualsevol contenidor que no sigui el right panel que tingui contingut nou
            const allDivs = Array.from(document.querySelectorAll("div[id]"))
              .filter(d => d.innerHTML.trim().length > 50 && d.innerHTML.trim().length < 2000)
              .map(d => ({ id: d.id, len: d.innerHTML.length, preview: d.innerHTML.slice(0, 100) }));
            return {
              rightContentHtml: rightContent ? rightContent.innerHTML.slice(0, 2000) : "BUIT",
              rightFullHtml:    rightFull    ? rightFull.innerHTML.slice(0, 500)     : "NO TROBAT",
              playerEls,
              tabsInRight,
              activeDivs: allDivs.slice(0, 10),
            };
          });
          console.log("\n=== DEBUG: DOM 8s après 1r clic ===");
          console.log("rightContent:", dbg.rightContentHtml);
          console.log("rightFull snippet:", dbg.rightFullHtml);
          console.log("Atributs id_player:", dbg.playerEls);
          console.log("Tabs dins right panel:", dbg.tabsInRight);
          console.log("Divs actius (id, mida):", dbg.activeDivs.map(d => `#${d.id}(${d.len}): ${d.preview}`));
          console.log("URLs capturades:", capturedUrls.slice(0, 20));
          console.log("===\n");
          debugLogged = true;
        }

        // Intenta clicar tab de plantilles/estadistiques dins el right content
        const tabClicked = await page.evaluate(() => {
          const right = document.getElementById("sidgad_thickbox_right");
          if (!right) return false;
          const tabs = Array.from(right.querySelectorAll("a, li, span, div, button"));
          const tab  = tabs.find(el =>
            /plantill|estadisti|jugador/i.test(el.textContent || el.getAttribute("onclick") || "") &&
            el.textContent.trim().length < 60
          );
          if (tab) { tab.click(); return true; }
          return false;
        });

        if (tabClicked) {
          await page.waitForFunction(
            () => document.querySelectorAll("[id_player],[player_id],[data-player]").length > 0,
            { timeout: 5000 }
          ).catch(() => {});
        }

        // Recull jugadors amb múltiples variants d'atribut
        const players = await page.evaluate(() => {
          const byAttr = (attr) =>
            Array.from(document.querySelectorAll(`[${attr}]`))
              .map(el => ({
                sidgadId:   el.getAttribute(attr),
                playerName: el.getAttribute("player_name") || el.getAttribute("nombre") || "",
              }))
              .filter(p => p.sidgadId && /^\d+$/.test(p.sidgadId));

          return byAttr("id_player").length   ? byAttr("id_player")   :
                 byAttr("player_id").length   ? byAttr("player_id")   :
                 byAttr("id-player").length   ? byAttr("id-player")   :
                 byAttr("data-player").length ? byAttr("data-player") : [];
        });

        for (const p of players) {
          if (!discovered[p.sidgadId]) {
            discovered[p.sidgadId] = { name: p.playerName };
          }
        }
        compsDone++;
      } catch (e) {
        console.log(`   ⚠ Error comp ${compId}: ${e.message?.slice(0, 100)}`);
      }
    }

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
          birthDate:      parsed.birthDate   || null,
          registeredTeam: parsed.registeredTeam || null,
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
