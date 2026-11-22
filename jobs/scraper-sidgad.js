// ============================================================
// FECAPA Sidgad Scraper  (API JSON del portal nou, nov. 2026)
//
// Flux (veure jobs/sidgad-api.js):
//  1. seasons + leagues → competicions de la temporada
//  2. calendar{id} + standing{id} → resultats i classificació
//  3. report{idp} → jugadors de cada acta (id, nom, porter, equip)
//  4. profile{id,s} → data de naixement
// ============================================================

const puppeteer = require("puppeteer");
const fs        = require("fs").promises;
const path      = require("path");

const { getCurrentSeasonLabelFromEnvOrDate } = require("./season-utils");
const {
  openSidgadApiPage,
  sidgadApiOrNull,
  resolveSeasonId,
  listLeagues,
  parseCalendarGames,
  parseStanding,
  parseReportPlayers,
} = require("./sidgad-api");

const CACHE_FILE   = path.join(__dirname, "../public/jugadors-sidgad.json");
const COMP_FILE    = path.join(__dirname, "../public/competicions-sidgad.json");
const CURRENT_SEASON = getCurrentSeasonLabelFromEnvOrDate(process.env);
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





function inferCategoryFromCompetitionName(name) {
  const n = normName(name || "");
  if (n.includes("PREBENJAMI")) return "PREBENJAMI";
  if (n.includes("BENJAMI")) return "BENJAMI";
  if (n.includes("ALEVI")) return "ALEVI";
  if (n.includes("INFANTIL")) return "INFANTIL";
  if (n.includes("JUVENIL")) return "JUVENIL";
  if (n.includes("JUNIOR")) return "JUNIOR";
  if (n.includes("FEM")) return "FEM";
  if (n.includes("VETERANS")) return "VETERANS";
  if (n.includes("NACIONAL CATALANA")) return "NACIONAL CATALANA";
  if (n.includes("PRIMERA CATALANA")) return "PRIMERA CATALANA";
  if (n.includes("SEGONA CATALANA")) return "SEGONA CATALANA";
  if (n.includes("TERCERA CATALANA")) return "TERCERA CATALANA";
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
    // El portal nou (nov. 2026) ja no té el llistat antic de competicions ni
    // els handlers jQuery: les dades es demanen a l'API JSON de sidgad des de
    // dins de la pàgina del portal (veure jobs/sidgad-api.js).
    console.log("🌐 Carregant portal (API sidgad)...");
    const page = await openSidgadApiPage(browser);
    console.log("   Portal carregat ✓");

    const portalTempId = await resolveSeasonId(page, CURRENT_SEASON);
    console.log(`[sidgad] Temporada objectiu ${CURRENT_SEASON} (portal tempId=${portalTempId})`);

    // ── 1. Obtenir IDs de competicions ───────────────────────
    const comps = (await listLeagues(page, portalTempId)).map(l => ({
      id: l.id,
      name: l.name,
      // Les competicions sense botó de classificacions equivalen a l'antic hide_clasif=1.
      hideClasif: l.buttons.length > 0 && !l.buttons.includes("clasificaciones"),
      apiCategory: l.categoryName,
    }));
    const compIds = comps.map(c => c.id);
    console.log(`   Competicions temporada ${portalTempId}: ${compIds.length}`);
    if (compIds.length === 0) {
      throw new Error(`No FECAPA competitions found for ${CURRENT_SEASON} (portal tempId=${portalTempId}); refusing to overwrite the competition index`);
    }

    // ── 2. Recollir resultats i classificació per competició ──
    const matchIds  = new Map(); // idp → { compId, idc }
    const compData  = {};        // compId → { id, name, matches, classification }
    let debugCalLogged   = false;
    let debugClassLogged = false;
    let compErrors = 0;

    const toClassRow = r => ({
      pos:  r.position,
      team: r.teamName,
      teamId: null,
      pts:  r.points,
      pj:   r.played,
      pg:   r.won,
      pe:   r.drawn,
      pp:   r.lost,
      gf:   r.goalsFor,
      gc:   r.goalsAgainst,
      gav:  r.goalDiff,
      pen:  r.penalties,
    });

    for (const { id: compId, name: compName, hideClasif, apiCategory } of comps) {
      try {
        // ── 2a. Resultats del calendari ──────────────────────
        const calendar = await sidgadApiOrNull(page, "calendar", { id: compId });
        const phases = calendar ? parseCalendarGames(calendar, compId) : [];
        const parsedMatches = phases.flatMap(ph => ph.matches.map(m => ({
          idp: m.idp,
          idc: ph.idc || compId,
          jornada: m.jornada,
          home: m.home,
          homeId: m.homeId,
          away: m.away,
          awayId: m.awayId,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          date: m.year ? `${m.year}-${m.month}-${m.day}` : null,
          time: m.time,
          played: m.played,
        })));

        for (const m of parsedMatches) {
          if (m.idp && m.played && !matchIds.has(m.idp)) {
            matchIds.set(m.idp, { compId, idc: m.idc || compId });
          }
        }

        if (!debugCalLogged && parsedMatches.length > 0) {
          console.log(`\n--- DEBUG CALENDARI comp ${compId} "${compName}" (${parsedMatches.length} partits, ${phases.length} fases) ---`);
          console.log(JSON.stringify(parsedMatches[0]));
          console.log("---\n");
          debugCalLogged = true;
        }

        const categoryName = inferCategoryFromCompetitionName(compName)
          || inferCategoryFromCompetitionName(apiCategory);
        compData[compId] = {
          id: compId,
          name: compName,
          category: categoryName,
          hideClasif: !!hideClasif,
          matches: parsedMatches,
          classification: [],
          classificationByGroup: {},
          classificationByGroupName: {},
          hierarchy: {
            category: categoryName,
            competition: { id: compId, name: compName },
            groups: [],
          },
        };

        if (hideClasif) {
          console.log(`   ℹ️  Comp ${compId} sense classificació (hide_clasif=1)`);
          continue;
        }

        // ── 2b. Classificació ────────────────────────────────
        const standing = await sidgadApiOrNull(page, "standing", { id: compId });
        const groups = standing ? parseStanding(standing, compId) : [];
        for (const g of groups) {
          const rows = g.rows.map(toClassRow);
          const groupName = g.name || compName;
          compData[compId].classificationByGroup[g.idc] = rows;
          compData[compId].classificationByGroupName[groupName] = rows;
          compData[compId].hierarchy.groups.push({
            key: String(g.idc),
            idc: String(g.idc),
            name: groupName,
            teams: rows.length,
          });
        }
        compData[compId].classification = groups.flatMap(g => g.rows.map(toClassRow));

        if (!debugClassLogged && compData[compId].classification.length > 0) {
          console.log(`\n--- DEBUG CLASSIFICACIÓ comp ${compId} "${compName}" (${groups.length} grups) ---`);
          console.log(JSON.stringify(compData[compId].classification[0]));
          console.log("---\n");
          debugClassLogged = true;
        }
      } catch (err) {
        compErrors++;
        console.log(`   ⚠️  Comp ${compId} "${compName}": ${err.message}`);
      }
    }
    if (compErrors === comps.length) {
      throw new Error(`Totes les ${comps.length} competicions han fallat a l'API sidgad; no es desa res`);
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

    for (const [idp] of matchList) {
      try {
        const report = await sidgadApiOrNull(page, "report", { id: idp });
        if (!report) continue;
        const players = parseReportPlayers(report);

        if (!debugActaLogged) {
          console.log(`\n--- DEBUG ACTA idp=${idp} (${players.length} jugadors) ---`);
          console.log(JSON.stringify(players.slice(0, 2)));
          console.log("---\n");
          debugActaLogged = true;
        }

        for (const p of players) {
          if (!discovered[p.id_player]) {
            discovered[p.id_player] = {
              name:           p.player_name,
              isGK:           p.isGK,
              registeredTeam: p.registeredTeam,
            };
          } else if (p.isGK) {
            discovered[p.id_player].isGK = true;
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
        const profile = await sidgadApiOrNull(page, "profile", { id: sidgadId, s: portalTempId });
        const player = profile?.player || null;

        if (!debugProfileLogged && player) {
          console.log(`\n--- DEBUG PERFIL id=${sidgadId} ---`);
          console.log(JSON.stringify({ name: player.name, surname: player.surname, date_born: player.date_born, is_goalie: player.is_goalie }));
          console.log("---\n");
          debugProfileLogged = true;
        }

        const birthDate = parseBirthDate(String(player?.date_born || ""));
        if (!player || !birthDate) {
          empty++;
          continue;
        }

        cache[sidgadId] = {
          sidgadId,
          name:           info.name,
          birthDate,
          registeredTeam: info.registeredTeam || null,
          isGK:           (info.isGK || player.is_goalie === true) ?? null,
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
