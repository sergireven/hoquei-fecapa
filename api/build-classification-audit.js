// ============================================================
// build-classification-audit.js
//
// Genera public/classification-audit.json comparant:
//   - FECAPA (fecapa-categories.json) → font primària
//   - jok.cat (data.json)             → font de suport
//
// Mapeig per nom normalitzat d'equips: si >50% dels equips
// d'un grup FECAPA coincideixen en una competició jok.cat →
// els mapem. Detecta grups faltants i check de frescor.
//
// Ús: node api/build-classification-audit.js
// ============================================================

const fs   = require("fs").promises;
const path = require("path");

const FECAPA_CATS_FILE  = path.join(__dirname, "../public/fecapa-categories.json");
const DATA_FILE         = path.join(__dirname, "../public/data.json");
const SIDGAD_COMP_FILE  = path.join(__dirname, "../public/competicions-sidgad.json");
const OUT_FILE          = path.join(__dirname, "../public/classification-audit.json");

const MIN_MATCH_RATIO   = 0.5;  // >= 50% d'equips coincidents per mapear

// ── Normalitza nom d'equip per comparació fuzzy ──────────────
function normTeam(name) {
  return (name || "")
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\b(CH|CP|CHP|UE|CE|UC|SK|HC|AE|CF|FS|SD|AD|CD|FC)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Extrau noms d'equip d'un grup FECAPA ─────────────────────
function fecapaGroupTeams(group) {
  return (group.teams || []).map(t => normTeam(t.teamName)).filter(Boolean);
}

// ── Extrau noms d'equip d'una competició jok.cat ─────────────
function jokcatCompTeams(comp) {
  return (comp.classification || []).map(t => normTeam(t.team)).filter(Boolean);
}

// ── Calcula ratio de coincidència entre dos arrays de noms ───
function matchRatio(setA, setB) {
  if (!setA.length || !setB.length) return 0;
  const bSet = new Set(setB);
  const matches = setA.filter(n => bSet.has(n)).length;
  return matches / Math.max(setA.length, setB.length);
}

// ── Jornades jugades per una competició a competicions-sidgad.json ──
function jornadesJugades(sidgadComp) {
  if (!sidgadComp?.matches) return 0;
  const playedMatches = sidgadComp.matches.filter(m => m.played === true);
  const maxJornada = Math.max(0, ...playedMatches.map(m => m.jornada || 0));
  return maxJornada;
}

// ── Jornades màximes a la classificació jok.cat (pj màxim) ──
function maxPjInJokcatComp(comp) {
  if (!comp.classification?.length) return 0;
  return Math.max(0, ...comp.classification.map(t => t.pj || 0));
}

// ── Construeix índex de totes les competicions jok.cat ────────
function buildJokcatIndex(dataJson) {
  const index = {}; // id → comp
  for (const [, comps] of Object.entries(dataJson.categories || {})) {
    for (const comp of comps) {
      if (comp.id) index[comp.id] = comp;
    }
  }
  return index;
}

// ── Construeix índex invers: jokcat_id → fecapa_compId/grup ──
function buildUsedJokcatIds(mapping) {
  const used = new Set();
  for (const entry of mapping) {
    for (const grp of entry.groups) {
      if (grp.jokcatCompId) used.add(grp.jokcatCompId);
    }
  }
  return used;
}

async function main() {
  console.log("🔍 build-classification-audit — iniciant...\n");

  const [fecapaCats, dataJson, sidgadComps] = await Promise.all([
    fs.readFile(FECAPA_CATS_FILE, "utf8").then(JSON.parse),
    fs.readFile(DATA_FILE, "utf8").then(JSON.parse),
    fs.readFile(SIDGAD_COMP_FILE, "utf8").then(JSON.parse).catch(() => ({})),
  ]);

  const jokcatIndex   = buildJokcatIndex(dataJson);
  const allJokcatIds  = Object.keys(jokcatIndex);

  const categoryKeys = [
    "nacional_catalana", "primera_catalana", "segona_catalana", "tercera_catalana",
    "fem", "junior", "juvenil", "infantil", "prebenjami", "benjami", "alevi", "veterans",
  ];

  const auditEntries = [];
  let totalGroupsOk = 0;
  let totalGroupsMissing = 0;
  let totalFresh = 0;
  let totalStale = 0;

  for (const catKey of categoryKeys) {
    const comps = fecapaCats.categories?.[catKey] || [];
    for (const fecapaComp of comps) {
      const fecapaId   = fecapaComp.competitionId;
      const fecapaName = fecapaComp.competitionName;
      const sidgadComp = sidgadComps[fecapaId] || null;

      // Jornades jugades (des de competicions-sidgad.json)
      const jornadesActuals = jornadesJugades(sidgadComp);

      // Per cada grup FECAPA: buscar la millor coincidència a jok.cat
      const groupEntries = [];
      const usedJokcatInThisComp = new Set();

      for (const group of fecapaComp.groups || []) {
        const fecapaTeams = fecapaGroupTeams(group);
        let bestId    = null;
        let bestRatio = 0;

        for (const jokId of allJokcatIds) {
          if (usedJokcatInThisComp.has(jokId)) continue;
          const jokComp = jokcatIndex[jokId];
          const jokTeams = jokcatCompTeams(jokComp);
          const ratio = matchRatio(fecapaTeams, jokTeams);
          if (ratio > bestRatio) { bestRatio = ratio; bestId = jokId; }
        }

        const hasMappedJokcat = bestId && bestRatio >= MIN_MATCH_RATIO;
        if (hasMappedJokcat) usedJokcatInThisComp.add(bestId);

        const jokcatComp   = hasMappedJokcat ? jokcatIndex[bestId] : null;
        const jokcatMaxPj  = jokcatComp ? maxPjInJokcatComp(jokcatComp) : null;
        const isFresh      = jokcatMaxPj !== null && jornadesActuals > 0
          ? jokcatMaxPj >= jornadesActuals
          : null; // null = no podem determinar

        if (isFresh === true)  totalFresh++;
        if (isFresh === false) totalStale++;
        totalGroupsOk++;

        groupEntries.push({
          groupId:         group.groupId,
          groupName:       group.groupName,
          fecapaTeamCount: group.teamCount,
          fecapaTeams,
          jokcatCompId:    hasMappedJokcat ? bestId : null,
          jokcatCompName:  jokcatComp?.name || null,
          jokcatMatchRatio: hasMappedJokcat ? Math.round(bestRatio * 100) : 0,
          jokcatTeamCount: jokcatComp ? (jokcatComp.classification?.length || 0) : null,
          jokcatClassification: jokcatComp?.classification || null,
          jokcatMaxPj,
          jornadesActuals,
          isFresh,
          status: "fecapa_ok",
        });
      }

      // Detecta grups jok.cat sense mapear que coincideixen amb aquesta competició FECAPA
      // (candidats a grups faltants de FECAPA)
      const missingGroups = [];
      for (const jokId of allJokcatIds) {
        if (usedJokcatInThisComp.has(jokId)) continue;
        const jokComp  = jokcatIndex[jokId];
        const jokTeams = jokcatCompTeams(jokComp);
        if (jokTeams.length === 0) continue;

        // Comprova si algun equip d'aquest jokcat apareix en algun grup FECAPA ja mapejat
        const allFecapaTeamsInComp = new Set(
          (fecapaComp.groups || []).flatMap(g => fecapaGroupTeams(g))
        );
        const overlap = jokTeams.filter(t => allFecapaTeamsInComp.has(t));
        if (overlap.length === 0) continue;

        // Comprova si el nom de la competició jok.cat és similar al nom FECAPA
        const normFecapa = normTeam(fecapaName);
        const normJok    = normTeam(jokComp.name || "");
        // Requereix almenys 2 paraules en comú al nom
        const fWords = normFecapa.split(" ").filter(w => w.length > 3);
        const jWords = normJok.split(" ").filter(w => w.length > 3);
        const commonWords = fWords.filter(w => jWords.includes(w));
        if (commonWords.length < 2) continue;

        const jokcatMaxPj = maxPjInJokcatComp(jokComp);
        const isFresh = jornadesActuals > 0 ? jokcatMaxPj >= jornadesActuals : null;

        if (isFresh === true)  totalFresh++;
        if (isFresh === false) totalStale++;
        totalGroupsMissing++;

        missingGroups.push({
          groupId:         null,
          groupName:       jokComp.name || jokId,
          fecapaTeamCount: null,
          fecapaTeams:     [],
          jokcatCompId:    jokId,
          jokcatCompName:  jokComp.name || null,
          jokcatMatchRatio: Math.round((overlap.length / jokTeams.length) * 100),
          jokcatTeamCount: jokComp.classification?.length || 0,
          jokcatClassification: jokComp.classification || null,
          jokcatMaxPj,
          jornadesActuals,
          isFresh,
          status: "fecapa_missing",
        });
      }

      auditEntries.push({
        category:        catKey,
        competitionId:   fecapaId,
        competitionName: fecapaName,
        fecapaGroupCount: fecapaComp.groupCount,
        fecapaTeamCount:  fecapaComp.teamCount,
        jornadesActuals,
        groupsOk:        groupEntries.length,
        groupsMissing:   missingGroups.length,
        hasIncomplete:   missingGroups.length > 0,
        groups:          [...groupEntries, ...missingGroups],
      });

      const icon = missingGroups.length > 0 ? "⚠️ " : "✅";
      console.log(`${icon} ${fecapaName} (${fecapaId}): ${groupEntries.length} grups OK, ${missingGroups.length} faltants`);
    }
  }

  const audit = {
    builtAt:          new Date().toISOString(),
    fecapaSource:     fecapaCats.source || "snapshot",
    jokcatUpdatedAt:  dataJson.updatedAt || null,
    totalGroupsOk,
    totalGroupsMissing,
    totalFresh,
    totalStale,
    competitions:     auditEntries,
  };

  await fs.writeFile(OUT_FILE, JSON.stringify(audit, null, 2));
  console.log(`\n✅ Escrit ${OUT_FILE}`);
  console.log(`   Competicions processades: ${auditEntries.length}`);
  console.log(`   Grups FECAPA OK:          ${totalGroupsOk}`);
  console.log(`   Grups FECAPA faltants:    ${totalGroupsMissing}`);
  console.log(`   Dades jok.cat fresques:   ${totalFresh}`);
  console.log(`   Dades jok.cat desfasades: ${totalStale}`);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
