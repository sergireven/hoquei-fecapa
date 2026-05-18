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
const COMP_FILE    = path.join(__dirname, "../public/competicions-sidgad.json");
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
async function loadCompData() {
  try { return JSON.parse(await fs.readFile(COMP_FILE, "utf8")); }
  catch { return {}; }
}
async function saveCompData(data) {
  await fs.mkdir(path.dirname(COMP_FILE), { recursive: true });
  await fs.writeFile(COMP_FILE, JSON.stringify(data, null, 2));
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

// Construeix un mapa índex → jornada a partir del HTML del calendari
function buildJornadaMap(html, rawMatches) {
  const result = {};
  // Cerca patrons de jornada: "Jornada N", "J.N", "Jornada N"
  const jornadaSections = [...html.matchAll(/(?:jornada|jornad[ao]|jorn\.?)\s*(\d+)/gi)];
  if (jornadaSections.length === 0) return result;

  // Assigna la jornada a cada .game_report per ordre d'aparició
  let jornadaIdx = 0;
  let currentJornada = parseInt(jornadaSections[0][1]);
  let matchesInSection = 0;

  for (let i = 0; i < rawMatches.length; i++) {
    if (jornadaIdx + 1 < jornadaSections.length) {
      // Avança a la següent jornada si el HTML de l'element ve après del marcador
      const matchPos = html.indexOf(rawMatches[i].html.substring(0, 50));
      const nextJornadaPos = jornadaSections[jornadaIdx + 1].index;
      if (matchPos > nextJornadaPos) {
        jornadaIdx++;
        currentJornada = parseInt(jornadaSections[jornadaIdx][1]);
      }
    }
    result[i] = currentJornada;
    matchesInSection++;
  }
  return result;
}

// Parseja un element .game_report (rawMatch = { attrs, html })
function parseGameReport(rawMatch, currentJornada) {
  const { attrs, html } = rawMatch;
  const idp      = attrs.idp || null;
  const idc      = attrs.idc || null;
  const jornada  = parseInt(attrs.jornada || attrs.num_jornada || currentJornada || "0") || null;

  // Equips locals/visitants: primer per atributs, després per classes CSS
  let home = attrs.local || attrs.id_local_name || attrs["data-local"] || null;
  let away = attrs.visitant || attrs.id_visitant_name || attrs["data-visitant"] || null;
  let homeId = attrs.id_local || attrs["data-id-local"] || null;
  let awayId = attrs.id_visitant || attrs["data-id-visitant"] || null;

  if (!home || !away) {
    const localM  = html.match(/class=['"]?[^"']*equip_local[^"']*['"]?[^>]*>([^<]+)<\/[^>]+>/i)
                 || html.match(/<(?:span|div|td)[^>]*>[^<]*equip[_\s]*local[^<]*(?:<[^>]+>)*\s*([^<]+)<\/[^>]+>/i);
    const visitM  = html.match(/class=['"]?[^"']*equip_visitant[^"']*['"]?[^>]*>([^<]+)<\/[^>]+>/i)
                 || html.match(/<(?:span|div|td)[^>]*>[^<]*equip[_\s]*visitant[^<]*(?:<[^>]+>)*\s*([^<]+)<\/[^>]+>/i);
    if (localM)  home = localM[1].trim();
    if (visitM)  away = visitM[1].trim();
  }
  // Fallback: cerca links d'equip
  if (!home || !away) {
    const teamLinks = [...html.matchAll(/href=['"]?[^'"]*\/equip\/(\d+)\/[^'"]*['"]?[^>]*>([^<]+)<\/a>/gi)]
                   .concat([...html.matchAll(/href=['"]?[^'"]*\/equip\/(\d+)\/[^'"]*['"]?[^>]*>\s*<[^>]*>([^<]+)<\/[^>]+><\/a>/gi)]);
    if (teamLinks.length >= 1 && !home) { homeId = teamLinks[0][1]; home = teamLinks[0][2].trim(); }
    if (teamLinks.length >= 2 && !away) { awayId = teamLinks[1][1]; away = teamLinks[1][2].trim(); }
  }

  // Marcador — elimina primer dates/hores per evitar falsos positius
  let homeScore = null, awayScore = null, played = false;
  const htmlForScore = html
    .replace(/\b\d{1,2}[-\/]\d{1,2}(?:[-\/]\d{2,4})?\b/g, "")  // elimina dates
    .replace(/\b\d{2}:\d{2}\b/g, "");                            // elimina hores
  const scoreM = htmlForScore.match(/\b(\d{1,2})\s*[-:]\s*(\d{1,2})\b/);
  if (scoreM) {
    homeScore = parseInt(scoreM[1]);
    awayScore = parseInt(scoreM[2]);
    played = true;
  }
  // Data i hora — busca primer dates completes (DD/MM/YYYY), depois DD/MM
  let date = null, time = null;
  const fullDateM = html.match(/\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\b/);
  if (fullDateM) {
    date = `${fullDateM[3]}-${String(fullDateM[2]).padStart(2, '0')}-${String(fullDateM[1]).padStart(2, '0')}`;
  } else {
    const shortDateM = html.match(/\b(\d{1,2})[-\/](\d{1,2})\b/);
    if (shortDateM) date = `${String(shortDateM[2]).padStart(2, '0')}-${String(shortDateM[1]).padStart(2, '0')}`;
  }
  const timeM = html.match(/(\d{2}:\d{2})/);
  if (timeM) time = timeM[1];

  return { idp, idc, jornada, home, homeId, away, awayId, homeScore, awayScore, date, time, played };
}

// Parseja la taula de classificació HTML de sidgad
function decodeHtmlEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&[a-z]+;/gi, " ");
}

function parseClassificationSidgad(html) {
  if (!html || html.length < 50) return [];
  const rows = [];

  // Strategy 1: Taula <tr><td> estàndard
  const trMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m =>
      decodeHtmlEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
    );
    if (cells.length < 5) continue;

    // Posició: primera cel·la numèrica 1-30
    const posIdx = cells.findIndex(c => /^\d{1,2}$/.test(c) && parseInt(c) >= 1 && parseInt(c) <= 30);
    if (posIdx < 0) continue;
    const pos = parseInt(cells[posIdx]);

    // Nom d'equip: primera cel·la de text llarg adjacent a la posició
    const teamIdx = cells.findIndex((c, i) => i > posIdx && c.length > 2 && /[a-zA-Z]/.test(c) && !/^\d+$/.test(c));
    if (teamIdx < 0) continue;
    const team = cells[teamIdx].replace(/\s+[A-Z0-9]{2,6}$/, "").trim();

    // Extreu teamId del HTML de la fila
    const teamIdM = tr.match(/\/equip\/(\d+)\//);
    const teamId  = teamIdM ? teamIdM[1] : null;

    // Números restants: Pts, J, G, E, P, F, C, (GAV), (PEN)
    const nums = cells.slice(teamIdx + 1).map(c => parseInt(c)).filter(n => !isNaN(n));
    if (nums.length < 3) continue;
    const [pts = null, pj = null, pg = null, pe = null, pp = null, gf = null, gc = null, gav = null, pen = null] = nums;

    rows.push({ pos, team, teamId, pts, pj, pg, pe, pp, gf, gc, gav, pen });
  }

  // Strategy 2: divs flex (similar a jok.cat)
  if (rows.length === 0) {
    const divRows = [...html.matchAll(/<div[^>]*class=['"]?[^'"]*(?:fila|row|clasificacion)[^'"]*['"]?[^>]*>([\s\S]*?)<\/div>/gi)];
    for (const [, inner] of divRows) {
      const texts = [...inner.matchAll(/>([^<]+)</g)]
        .map(m => decodeHtmlEntities(m[1]).trim()).filter(Boolean);
      const nums  = texts.map(t => parseInt(t)).filter(n => !isNaN(n));
      const team  = texts.find(t => /[a-zA-Z]{3}/.test(t) && !/^\d/.test(t));
      if (!team || nums.length < 3) continue;
      const [pos, pts, pj, pg, pe, pp, gf, gc, gav, pen] = nums;
      const teamIdM = inner.match(/\/equip\/(\d+)\//);
      rows.push({ pos, team, teamId: teamIdM?.[1] || null, pts, pj, pg, pe, pp, gf, gc, gav, pen });
    }
  }

  return rows;
}

// Parser classificacions de Copa separades per grups (per noms)
// Retorna un object mapejat: { idc → classification } per sincronitzar amb jok.cat
function parseClassificationByGroupSidgad(html, uniqueIdcs) {
  if (!html || html.length < 50 || !uniqueIdcs || uniqueIdcs.length === 0) return {};
  const result = {};

  // Detectar seccions de grups: busca headers/títols que contenen "OR", "PLATA", "GRUPO", etc.
  const groupPatterns = /(?:OR|PLATA|GRUPO|GROUPE|GROUP|GRP)\s*(\d+|[A-Z])/gi;

  // Dividir HTML per seccions: cada secció comença amb un header de grup
  const sections = html.split(/<h[1-6][^>]*>|<div[^>]*class=['"]?[^'"]*(?:grup|group|division)[^'"]*['"]?[^>]*>/i);

  // Mapa simple: "OR 1" → primer idc de type OR, "PLATA 4" → primer idc de type PLATA
  // Per a Copa Barcelona: OR 1-3 → idcs 4475-4477, PLATA 4-6 → idcs 4478-4480
  const groupNameToIdc = {};
  let orIdx = 0, plataIdx = 0;
  for (const idc of uniqueIdcs) {
    // Detectar si és OR o PLATA basant-se en l'idc:
    // Assumim que els idcs venen de jok.cat i el nom ja especifica OR/PLATA
    // Per ara, fem matching simple basant-se en ordre
    if (orIdx === 0 && plataIdx === 0) {
      // Primer grup: assignar "OR 1"
      groupNameToIdc["OR 1"] = idc;
      orIdx++;
    } else if (orIdx < 3) {
      // Grups OR
      groupNameToIdc[`OR ${orIdx + 1}`] = idc;
      orIdx++;
    } else {
      // Grups PLATA
      groupNameToIdc[`PLATA ${plataIdx + 4}`] = idc;
      plataIdx++;
    }
  }

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];

    // Buscar el nom del grup al començament de la secció
    const groupMatch = section.match(groupPatterns);
    if (!groupMatch) continue;

    const groupNameRaw = groupMatch[0].toUpperCase().trim();

    // Parser la taula/classificació d'aquesta secció
    const classification = [];
    const trMatches = section.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

    for (const tr of trMatches) {
      const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m =>
        decodeHtmlEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
      );
      if (cells.length < 5) continue;

      // Posició
      const posIdx = cells.findIndex(c => /^\d{1,2}$/.test(c) && parseInt(c) >= 1 && parseInt(c) <= 30);
      if (posIdx < 0) continue;
      const pos = parseInt(cells[posIdx]);

      // Nom d'equip
      const teamIdx = cells.findIndex((c, i) => i > posIdx && c.length > 2 && /[a-zA-Z]/.test(c) && !/^\d+$/.test(c));
      if (teamIdx < 0) continue;
      const team = cells[teamIdx].replace(/\s+[A-Z0-9]{2,6}$/, "").trim();

      // TeamId
      const teamIdM = tr.match(/\/equip\/(\d+)\//);
      const teamId = teamIdM ? teamIdM[1] : null;

      // Números: Pts, J, G, E, P, F, C, GAV, PEN
      const nums = cells.slice(teamIdx + 1).map(c => parseInt(c)).filter(n => !isNaN(n));
      if (nums.length < 3) continue;
      const [pts = null, pj = null, pg = null, pe = null, pp = null, gf = null, gc = null, gav = null, pen = null] = nums;

      classification.push({ pos, team, teamId, pts, pj, pg, pe, pp, gf, gc, gav, pen });
    }

    if (classification.length > 0) {
      // Guardar amb idc mapping
      const idc = groupNameToIdc[groupNameRaw];
      if (idc) {
        result[idc] = classification;
      } else {
        // Fallback: guardar també amb el nom del grup per debugar
        result[groupNameRaw] = classification;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : {};
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
    const comps = await page.$$eval(
      `.listado_competiciones_fila.temp_${TEMP_ID}`,
      els => els.map(el => ({ id: el.id, name: el.textContent.trim() })).filter(c => c.id)
    );
    const compIds = comps.map(c => c.id);
    const compNames = Object.fromEntries(comps.map(c => [c.id, c.name]));
    console.log(`   Competicions temporada ${TEMP_ID}: ${compIds.length}`);

    // ── 2. Recollir resultats i classificació per competició ──
    // Clic a cada competició → calendari carrega a #tab_modal_contenido_competicion
    // Busca .game_report[idp] (partits acabats amb lupa disponible)
    const matchIds  = new Map(); // idp → { compId, idc }
    const compData  = {};        // compId → { id, name, matches, classification }
    let debugCalLogged   = false;
    let debugClassLogged = false;

    for (const { id: compId, name: compName } of comps) {
      try {
        await page.evaluate(id => { document.getElementById(id)?.click(); }, compId);
        await page.waitForFunction(
          () => {
            const el = document.getElementById("tab_modal_contenido_competicion");
            return el && el.innerHTML.length > 50;
          },
          { timeout: 6000 }
        ).catch(() => {});

        // ── 2a. Resultats del calendari ──────────────────────
        const rawMatches = await page.$$eval(
          "#tab_modal_contenido_competicion .game_report[idp]",
          els => els.map(el => {
            const attrs = {};
            for (const a of el.attributes) attrs[a.name] = a.value;
            return { attrs, html: el.outerHTML };
          })
        );

        // Debug: primera competició amb partits
        if (!debugCalLogged && rawMatches.length > 0) {
          const sample = await page.evaluate(() => {
            const el = document.getElementById("tab_modal_contenido_competicion");
            return el?.innerHTML?.slice(0, 1000) || "";
          });
          console.log(`\n--- DEBUG CALENDARI comp ${compId} "${compName}" (${rawMatches.length} partits) ---`);
          console.log(sample.replace(/\s+/g, " ").trim().slice(0, 800));
          console.log("---\n");
          debugCalLogged = true;
        }

        // Detectar jornades del HTML per associar-les als partits
        const calHtml = await page.evaluate(() =>
          document.getElementById("tab_modal_contenido_competicion")?.innerHTML || ""
        );
        const jornadaMap = buildJornadaMap(calHtml, rawMatches);

        const parsedMatches = rawMatches.map((rm, i) => parseGameReport(rm, jornadaMap[i] || null));
        for (const m of parsedMatches) {
          if (m.idp && !matchIds.has(m.idp)) {
            matchIds.set(m.idp, { compId, idc: m.idc || compId });
          }
        }

        compData[compId] = { id: compId, name: compName, matches: parsedMatches, classification: [], classificationByGroup: {} };

        // ── 2b. Classificació ────────────────────────────────
        // Helper: clica la pestanya "classificació" i retorna el HTML resultant (o null)
        const clickClassTab = async () => {
          const found = await page.evaluate(() => {
            const allClickable = [...document.querySelectorAll("a, button, li, span, td, div[onclick], [class*='tab'], [class*='nav']")];
            // Busca: "CLASSIFICACIÓ", "CLASSIFICACIONS", "Classificació", "classificacions", etc.
            const tab = allClickable.find(el => {
              const txt = el.textContent.trim().toUpperCase();
              const onclick = el.getAttribute("onclick") || "";
              const href = el.getAttribute("href") || "";
              return txt.includes("CLASSIFICACI") || /class?ificaci/i.test(onclick) || /class?ificaci/i.test(href);
            });
            if (tab) {
              tab.click();
              return true;
            }
            return false;
          });
          if (!found) return null;
          await page.waitForFunction(
            () => { const el = document.getElementById("tab_modal_contenido_competicion"); return el && el.innerHTML.length > 100; },
            { timeout: 5000 }
          ).catch(() => {});
          return page.evaluate(() => document.getElementById("tab_modal_contenido_competicion")?.innerHTML || "");
        };

        // Helper: intenta seleccionar el grup amb el idc indicat al portal
        const clickGroupTab = async (idc) => {
          return page.evaluate(targetIdc => {
            const candidates = [...document.querySelectorAll("[onclick], a, button, li, span, td")];
            const el = candidates.find(e => {
              const oc = e.getAttribute("onclick") || "";
              const hr = e.getAttribute("href") || "";
              const di = e.getAttribute("data-idc") || e.getAttribute("idc") || "";
              // Coincideix si el valor idc apareix com a token sencer (no com a substring d'un nombre més gran)
              const re = new RegExp("(?<![\\d])" + targetIdc + "(?![\\d])");
              return re.test(oc) || re.test(hr) || di === String(targetIdc);
            });
            if (el) { el.click(); return { found: true, text: el.textContent.trim().slice(0, 60) }; }
            // Debug: mostra elements amb onclick per ajudar a identificar l'estructura
            const sample = candidates.filter(e => e.getAttribute("onclick"))
              .slice(0, 8).map(e => ({ tag: e.tagName, oc: (e.getAttribute("onclick") || "").slice(0, 80), txt: e.textContent.trim().slice(0, 40) }));
            return { found: false, sample };
          }, idc);
        };

        // Grups únics (idc) presents en els partits d'aquesta competició
        const uniqueIdcs = [...new Set(parsedMatches.map(m => m.idc).filter(Boolean))];

        // Detecció addicional de grups des del DOM:
        // Busca elements [onclick] que continguin el compId — quan en un onclick
        // apareix el compId + un altre número, és molt probable que sigui un selector de grup.
        const domGroups = await page.evaluate(cid => {
          const groups = [];
          const seen = new Set([cid]);
          for (const el of document.querySelectorAll("[onclick]")) {
            const oc = el.getAttribute("onclick") || "";
            if (!oc.includes(cid)) continue;
            for (const [, n] of oc.matchAll(/\b(\d{4,5})\b/g)) {
              if (seen.has(n)) continue;
              seen.add(n);
              groups.push({ idc: n, text: el.textContent.trim().slice(0, 50), onclick: oc.slice(0, 80) });
            }
          }
          return groups;
        }, compId);

        // Fusió: idcs dels partits + idcs detectats al DOM (sense duplicats)
        for (const { idc } of domGroups) {
          if (!uniqueIdcs.includes(idc)) uniqueIdcs.push(idc);
        }

        if (domGroups.length > 0 && !debugCalLogged) {
          console.log(`   🔍 Grups DOM comp ${compId}: ${domGroups.map(g => g.idc).join(", ")}`);
        }

        if (uniqueIdcs.length > 1) {
          // Competició amb múltiples grups (p.ex. Copa): intentar clickar CLASSIFICACIONS sense grup
          // Sidgad mostrarà totes les classificacions de grups separades, i les parsejem per noms
          console.log(`\n🔍 Intentant carregar clasificacions de TOTS els grups per comp ${compId}...`);
          try {
            const classHtmlAllGroups = await clickClassTab();
            if (classHtmlAllGroups) {
              console.log(`   HTML rebut: ${classHtmlAllGroups.length} bytes`);
              const classificationByGroup = parseClassificationByGroupSidgad(classHtmlAllGroups, uniqueIdcs);
              console.log(`   parseClassificationByGroupSidgad() retorna: ${Object.keys(classificationByGroup).length} grups`);
              if (Object.keys(classificationByGroup).length > 0) {
                // Éxit: tenim classificacions per grups
                for (const [groupName, classification] of Object.entries(classificationByGroup)) {
                  compData[compId].classificationByGroup[groupName] = classification;
                }
                console.log(`   ✓ Guardades ${Object.keys(classificationByGroup).length} classificacions de grups\n`);
                if (!debugClassLogged) {
                  console.log(`\n--- CLASSIFICACIONS GRUPS comp ${compId} (${Object.keys(classificationByGroup).length} grups) ---`);
                  const firstGroup = Object.entries(classificationByGroup)[0];
                  console.log(`   Primer grup: ${firstGroup[0]} - ${firstGroup[1].length} equips`);
                  console.log("---\n");
                  debugClassLogged = true;
                }
              } else {
                console.log(`   ⚠️  No es van detectar grups en el HTML`);
              }
            } else {
              console.log(`   ⚠️  No es va obtenir HTML de classificacions`);
            }
          } catch (e) {
            console.log(`   ❌ ERROR: ${e.message}\n`);
          }

          // Si no tenim resultats, intentar l'alternativa: clickar cada grup individualment (antiga lógica)
          if (Object.keys(compData[compId].classificationByGroup).length === 0) {
            let debugGroupLogged = false;
            for (const idc of uniqueIdcs) {
              try {
                // Torna a clicar la competició per reiniciar l'estat
                await page.evaluate(id => document.getElementById(id)?.click(), compId);
                await page.waitForFunction(
                  () => { const el = document.getElementById("tab_modal_contenido_competicion"); return el && el.innerHTML.length > 50; },
                  { timeout: 6000 }
                ).catch(() => {});

                // Selecciona el grup
                const groupResult = await clickGroupTab(idc);
                if (!groupResult.found) {
                  if (!debugGroupLogged) {
                    console.log(`\n--- DEBUG GRUP (no trobat) comp ${compId} idc=${idc} ---`);
                    console.log(JSON.stringify(groupResult.sample, null, 2));
                    console.log("---\n");
                    debugGroupLogged = true;
                  }
                  continue;
                }
                await new Promise(r => setTimeout(r, 600));

                // Obté la classificació del grup
                const classHtml = await clickClassTab();
                if (!classHtml) {
                  if (!debugGroupLogged) {
                    console.log(`\n--- DEBUG: No es pot obtenir classificació per comp ${compId} idc=${idc} ---`);
                    debugGroupLogged = true;
                  }
                  continue;
                }
                const classification = parseClassificationSidgad(classHtml);
                if (classification.length > 0) {
                  compData[compId].classificationByGroup[idc] = classification;
                  if (!debugClassLogged) {
                    console.log(`\n--- DEBUG CLASSIFICACIÓ GRUP comp ${compId} idc=${idc} (${classification.length} equips) ---`);
                    console.log(JSON.stringify(classification[0]));
                    console.log("---\n");
                    debugClassLogged = true;
                  }
                }
              } catch (e) {
                console.log(`\n--- ERROR clickant grup comp ${compId} idc=${idc}: ${e.message} ---\n`);
              }
            }
          }
        } else {
          // Competició d'un sol grup: comportament original
          const classHtml = await clickClassTab();
          if (!classHtml && !debugClassLogged) {
            const nearby = await page.evaluate(() => {
              const modal = document.getElementById("tab_modal_contenido_competicion");
              return [...(modal?.closest("div, table, section") || document).querySelectorAll("a, button, li[onclick], div[onclick]")]
                .slice(0, 10).map(el => ({ tag: el.tagName, cls: el.className.slice(0, 40), txt: el.textContent.trim().slice(0, 50) }));
            });
            console.log(`\n--- DEBUG TAB CLASSIFICACIÓ (no trobat) comp ${compId} ---`);
            console.log(JSON.stringify(nearby, null, 2));
            console.log("---\n");
            debugClassLogged = true;
          }
          if (classHtml) {
            const classification = parseClassificationSidgad(classHtml);
            compData[compId].classification = classification;
            if (uniqueIdcs.length === 1) compData[compId].classificationByGroup[uniqueIdcs[0]] = classification;
            if (!debugClassLogged && classification.length > 0) {
              console.log(`\n--- DEBUG CLASSIFICACIÓ comp ${compId} "${compName}" (${classification.length} equips) ---`);
              console.log(JSON.stringify(classification[0]));
              console.log("---\n");
              debugClassLogged = true;
            }
          }
        }
      } catch { /* continua */ }
    }
    console.log(`   Partits amb acta descoberts: ${matchIds.size}`);
    const nClassSingle = Object.values(compData).filter(c => c.classification.length > 0).length;
    const nClassGroup  = Object.values(compData).filter(c => Object.keys(c.classificationByGroup || {}).length > 0).length;
    console.log(`   Competicions amb dades: ${Object.keys(compData).length} (class. simple: ${nClassSingle}, class. per grup: ${nClassGroup})`);

    // ── 3. Carregar actes i extreure jugadors ─────────────────
    const discovered = {}; // id_player → { name, isGK, registeredTeam }

    // Prioritzar partits no processats encara per cobrir-los tots progressivament
    const processedSet = new Set(cache._processedMatchIds || []);
    const allMatchEntries = [...matchIds.entries()];
    let unprocessed = allMatchEntries.filter(([idp]) => !processedSet.has(idp));
    if (unprocessed.length === 0) {
      // Tots processats: reiniciem per tornar a descobrir jugadors nous
      processedSet.clear();
      unprocessed = allMatchEntries;
      console.log(`   ♻️  Tots els partits ja processats, reiniciant cicle`);
    }
    const matchList = unprocessed.slice(0, MAX_MATCHES);
    console.log(`   Partits pendents: ${unprocessed.length} → processant ${matchList.length}`);
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
    // Marcar partits com a processats
    for (const [idp] of matchList) processedSet.add(idp);
    cache._processedMatchIds = [...processedSet];

    await saveCache(cache);
    console.log(`\n✅ Cache: ${Object.keys(cache).filter(k => !k.startsWith('_')).length} jugadors → ${CACHE_FILE}`);

    // Desar competicions (classificació + resultats)
    await saveCompData(compData);
    const nClassif = Object.values(compData).filter(c => c.classification.length > 0).length;
    const nMatches = Object.values(compData).reduce((s, c) => s + c.matches.length, 0);
    console.log(`✅ Competicions: ${Object.keys(compData).length} comps, ${nMatches} partits, ${nClassif} classificacions → ${COMP_FILE}`);

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

    // ── Stats ────────────────────────────────────────────────────
    const statsFile    = path.join(__dirname, "../public/scraper-stats.json");
    const cacheEntries = Object.values(cache).filter(e => typeof e === 'object' && e.sidgadId);
    const sidgadStats  = {
      runAt:               new Date().toISOString(),
      total:               cacheEntries.length,
      enrichits:           cacheEntries.filter(e => e.birthDate).length,
      pendents:            cacheEntries.filter(e => !e.birthDate).length,
      processatsAquestRun: ok,
      buitsOErrors:        empty,
      partitsPendents:     unprocessed.length - matchList.length,
      competicions:        Object.keys(compData).length,
      partitsSidgad:       Object.values(compData).reduce((s, c) => s + c.matches.length, 0),
      classificacions:     Object.values(compData).filter(c => c.classification.length > 0).length,
    };
    let statsData = {};
    try { statsData = JSON.parse(await fs.readFile(statsFile, "utf8")); } catch { /* fitxer nou */ }
    statsData.sidgad = sidgadStats;
    await fs.writeFile(statsFile, JSON.stringify(statsData, null, 2));
    console.log(`   📊 Stats → ${statsFile}`);

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
