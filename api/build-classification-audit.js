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
const FEEDBACK_FILE     = path.join(__dirname, "../public/classification-audit-feedback.json");
const OUT_FILE          = path.join(__dirname, "../public/classification-audit.json");

const MIN_MATCH_RATIO   = 0.5;  // >= 50% d'equips coincidents per mapear
const SCORE_WEIGHTS = { name: 0.20, teams: 0.55, size: 0.10, phase: 0.15 };
const FECAPA_PLACEHOLDER_GROUP_NAME = "CLASIFICACION CLASSIFICATION CLASSIFICACIO CLASSIFICA";

const JOKCAT_CATEGORY_MAP = {
  "NACIONAL CATALANA": "nacional_catalana",
  "1 CATALANA": "primera_catalana",
  "1A CATALANA": "primera_catalana",
  "PRIMERA CATALANA": "primera_catalana",
  "2 CATALANA": "segona_catalana",
  "2A CATALANA": "segona_catalana",
  "SEGONA CATALANA": "segona_catalana",
  "3 CATALANA": "tercera_catalana",
  "3A CATALANA": "tercera_catalana",
  "TERCERA CATALANA": "tercera_catalana",
  "FEM": "fem",
  "JUNIOR": "junior",
  "JUVENIL": "juvenil",
  "INFANTIL": "infantil",
  "ALEVI": "alevi",
  "BENJAMI": "benjami",
  "PREBENJAMI": "prebenjami",
  "VETERANS": "veterans",
};

function normalizeText(s) {
  return (s || "")
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jokCategoryToKey(name) {
  const n = normalizeText(name);
  return JOKCAT_CATEGORY_MAP[n] || null;
}

function competitionProfile(name) {
  const n = normalizeText(name);
  const isFeminine = /\bFEM\b|\bFEMENI|\bFEMENINA\b/.test(n);
  const isMasculine = /\bMASCULI|\bMASCULINA\b/.test(n);

  let tier = null;
  if (/\bNACIONAL\b/.test(n)) tier = "nacional";
  else if (/\b1\b\s*\bCATALANA\b|\b1A\b\s*\bCATALANA\b|\bPRIMERA\b\s*\bCATALANA\b/.test(n)) tier = "primera";
  else if (/\b2\b\s*\bCATALANA\b|\b2A\b\s*\bCATALANA\b|\bSEGONA\b\s*\bCATALANA\b/.test(n)) tier = "segona";
  else if (/\b3\b\s*\bCATALANA\b|\b3A\b\s*\bCATALANA\b|\bTERCERA\b\s*\bCATALANA\b/.test(n)) tier = "tercera";

  return { isFeminine, isMasculine, tier };
}

function extractPhaseTags(name) {
  const n = normalizeText(name);
  const tags = new Set();
  if (/\bOR\b/.test(n)) tags.add("OR");
  if (/\bPLATA\b/.test(n)) tags.add("PLATA");
  if (/\bPREFERENT\b/.test(n)) tags.add("PREFERENT");
  if (/\bCOPA\b/.test(n)) tags.add("COPA");
  if (/\bFEDERACIO\b/.test(n)) tags.add("FEDERACIO");
  if (/\bELIMINATORIES\b/.test(n)) tags.add("ELIMINATORIES");
  return tags;
}

function extractSpecialBucket(name) {
  const n = normalizeText(name);
  if (/\bLLIGA\s+CATALANA\b/.test(n)) return "LLIGA_CATALANA";
  if (/\bINTERTERRITORIAL\b/.test(n)) return "INTERTERRITORIAL";
  if (/\bCOPA\s+CATALUNYA\b/.test(n) && /\b3X3\b/.test(n)) return "COPA_CATALUNYA_3X3";
  if (/\b3X3\b/.test(n)) return "3X3";
  return null;
}

function extractPhaseNumber(name) {
  const n = normalizeText(name);
  const m = n.match(/\b(\d{1,2})\s*(?:A|ª|\.)?\s*FASE\b/);
  return m ? parseInt(m[1], 10) : null;
}

function phaseScore(fecapaName, jokName) {
  const f = extractPhaseNumber(fecapaName);
  const j = extractPhaseNumber(jokName);
  if (f === null && j === null) return 0.5;
  if (f !== null && j !== null) return f === j ? 1 : 0;
  return 0.2;
}

function isOmittedFecapaGroupName(name) {
  return normalizeText(name) === FECAPA_PLACEHOLDER_GROUP_NAME;
}

function haveConflictingPhaseTags(fecapaName, jokName) {
  const fTags = extractPhaseTags(fecapaName);
  const jTags = extractPhaseTags(jokName);

  const ladder = ["OR", "PLATA", "PREFERENT"];
  const fMain = ladder.find(t => fTags.has(t)) || null;
  const jMain = ladder.find(t => jTags.has(t)) || null;

  return Boolean(fMain && jMain && fMain !== jMain);
}

function wordsForNameScore(name) {
  return normalizeText(name)
    .replace(/\b20\d{2}\b/g, " ")
    .split(" ")
    .filter(w => w.length > 3);
}

function jaccardScore(aWords, bWords) {
  const a = new Set(aWords);
  const b = new Set(bWords);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

function teamTokens(name) {
  return normalizeText(name)
    .replace(/\b(CLUB|HOQUEI|PATI|PATI|PATIN|PATINS|ES|MOU|DEL|DE|LA|EL|ELS|LES)\b/g, " ")
    .replace(/\b(CH|CP|CHP|UE|CE|UC|SK|HC|AE|CF|FS|SD|AD|CD|FC|CPI)\b/g, " ")
    .replace(/\b(D|L)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(t => t.length > 1);
}

function teamNameSimilarity(a, b) {
  const ta = new Set(teamTokens(a));
  const tb = new Set(teamTokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = new Set([...ta, ...tb]).size;
  return union > 0 ? inter / union : 0;
}

function bestTeamMatches(teamListA, teamListB, minSim = 0.72) {
  const usedB = new Set();
  let matched = 0;
  const pairs = [];

  for (const a of teamListA) {
    let bestIdx = -1;
    let bestSim = 0;
    for (let i = 0; i < teamListB.length; i++) {
      if (usedB.has(i)) continue;
      const sim = teamNameSimilarity(a, teamListB[i]);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestSim >= minSim) {
      usedB.add(bestIdx);
      matched++;
      pairs.push({ a, b: teamListB[bestIdx], sim: Number(bestSim.toFixed(3)) });
    }
  }

  return { matched, pairs };
}

function teamFingerprintScore(fecapaTeams, jokTeams) {
  if (!fecapaTeams.length || !jokTeams.length) return 0;
  const { matched: matches } = bestTeamMatches(fecapaTeams, jokTeams);
  const fSize = new Set(fecapaTeams).size;
  const jSize = new Set(jokTeams).size;
  if (matches === 0) return 0;
  const precision = matches / jSize;
  const recall = matches / fSize;
  return (2 * precision * recall) / (precision + recall);
}

function sizeSimilarityScore(aLen, bLen) {
  if (!aLen || !bLen) return 0;
  const diff = Math.abs(aLen - bLen);
  const maxLen = Math.max(aLen, bLen);
  return Math.max(0, 1 - diff / maxLen);
}

function matchingThresholds(catKey) {
  // En categories amb molts subgrups similars (PREBENJAMI/BENJAMI/ALEVI),
  // fem el llindar més estricte.
  if (["prebenjami", "benjami", "alevi"].includes(catKey)) {
    return { minCompositeScore: 0.82, minTeamScore: 0.65 };
  }
  return { minCompositeScore: 0.75, minTeamScore: 0.60 };
}

function computeCandidateScore({ fecapaName, jokName, fecapaTeams, jokTeams }) {
  const nameScore = jaccardScore(wordsForNameScore(fecapaName), wordsForNameScore(jokName));
  const teamsScore = teamFingerprintScore(fecapaTeams, jokTeams);
  const sizeScore = sizeSimilarityScore(fecapaTeams.length, jokTeams.length);
  const phScore = phaseScore(fecapaName, jokName);
  const compositeScore =
    SCORE_WEIGHTS.name * nameScore +
    SCORE_WEIGHTS.teams * teamsScore +
    SCORE_WEIGHTS.size * sizeScore +
    SCORE_WEIGHTS.phase * phScore;
  return { nameScore, teamsScore, sizeScore, phaseScore: phScore, compositeScore };
}

function isCompatibleCompetition(fecapaCatKey, fecapaName, jokComp) {
  if (!jokComp || jokComp._catKey !== fecapaCatKey) return false;

  const f = competitionProfile(fecapaName);
  const j = competitionProfile(jokComp.name || "");

  if (f.isFeminine && !j.isFeminine && jokComp._catKey !== "fem") return false;
  if (f.isMasculine && j.isFeminine) return false;
  if (f.tier && j.tier && f.tier !== j.tier) return false;
  if (haveConflictingPhaseTags(fecapaName, jokComp.name || "")) return false;

  // Lligues especials: no barrejar amb grups veterans "normals".
  const fBucket = extractSpecialBucket(fecapaName);
  const jBucket = extractSpecialBucket(jokComp.name || "");
  if ((fBucket || jBucket) && fBucket !== jBucket) return false;

  // Si ambdós noms indiquen fase, ha de coincidir (prioritat alta al nom de fase).
  const fPhase = extractPhaseNumber(fecapaName);
  const jPhase = extractPhaseNumber(jokComp.name || "");
  if (fPhase !== null && jPhase !== null && fPhase !== jPhase) return false;

  return true;
}

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
  const { matched } = bestTeamMatches(setA, setB);
  return matched / Math.max(setA.length, setB.length);
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
  for (const [rawCategory, comps] of Object.entries(dataJson.categories || {})) {
    const catKey = jokCategoryToKey(rawCategory);
    for (const comp of comps) {
      if (!comp.id) continue;
      index[comp.id] = {
        ...comp,
        _catKey: catKey,
        _rawCategory: rawCategory,
      };
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

function loadFeedbackMap(raw) {
  if (!raw || typeof raw !== "object") return {};
  const direct = raw.matches && typeof raw.matches === "object" ? raw.matches : raw;
  return direct && typeof direct === "object" ? direct : {};
}

function feedbackKeyForGroup(compId, group) {
  const gKey = group?.groupId || group?.fecapaGroupId || group?.groupName || "";
  return `${compId}::${gKey}`;
}

function getManualFeedbackForGroup(feedbackMap, compId, group) {
  const keyById = feedbackKeyForGroup(compId, group);
  if (feedbackMap[keyById]) return feedbackMap[keyById];
  const keyByName = `${compId}::${group?.groupName || ""}`;
  return feedbackMap[keyByName] || null;
}

async function main() {
  console.log("🔍 build-classification-audit — iniciant...\n");

  const [fecapaCats, dataJson, sidgadComps, feedbackRaw] = await Promise.all([
    fs.readFile(FECAPA_CATS_FILE, "utf8").then(JSON.parse),
    fs.readFile(DATA_FILE, "utf8").then(JSON.parse),
    fs.readFile(SIDGAD_COMP_FILE, "utf8").then(JSON.parse).catch(() => ({})),
    fs.readFile(FEEDBACK_FILE, "utf8").then(JSON.parse).catch(() => ({})),
  ]);
  const feedbackMap = loadFeedbackMap(feedbackRaw);

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
  let totalManualApplied = 0;

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
      const validFecapaGroups = (fecapaComp.groups || []).filter(g => !isOmittedFecapaGroupName(g.groupName));

      for (const group of validFecapaGroups) {
        const fecapaTeams = fecapaGroupTeams(group);
        const manualFeedback = getManualFeedbackForGroup(feedbackMap, fecapaId, group);
        let bestId    = null;
        let bestRatio = 0;
        let bestScore = -1;
        let bestScoreBreakdown = { nameScore: 0, teamsScore: 0, sizeScore: 0, compositeScore: 0 };
        let bestMatchesInfo = { matched: 0, pairs: [] };
        let bestComp = null;
        const { minCompositeScore, minTeamScore } = matchingThresholds(catKey);

        for (const jokId of allJokcatIds) {
          if (usedJokcatInThisComp.has(jokId)) continue;
          const jokComp = jokcatIndex[jokId];
          if (!isCompatibleCompetition(catKey, fecapaName, jokComp)) continue;
          const jokTeams = jokcatCompTeams(jokComp);
          const candidate = computeCandidateScore({
            fecapaName,
            jokName: jokComp.name || "",
            fecapaTeams,
            jokTeams,
          });
          const teamMatches = bestTeamMatches(fecapaTeams, jokTeams);
          const ratio = teamMatches.matched / Math.max(fecapaTeams.length, jokTeams.length);
          if (candidate.compositeScore > bestScore) {
            bestScore = candidate.compositeScore;
            bestScoreBreakdown = candidate;
            bestMatchesInfo = teamMatches;
            bestRatio = ratio;
            bestId = jokId;
            bestComp = jokComp;
          }
        }

        let hasMappedJokcat = Boolean(
          bestId
          && bestRatio >= MIN_MATCH_RATIO
          && bestScoreBreakdown.teamsScore >= minTeamScore
          && bestScoreBreakdown.compositeScore >= minCompositeScore
        );
        let matchSource = hasMappedJokcat ? "auto" : "none";

        if (manualFeedback?.manualJokcatGroupId) {
          const forcedId = String(manualFeedback.manualJokcatGroupId).trim();
          if (forcedId && jokcatIndex[forcedId]) {
            bestId = forcedId;
            const forcedComp = jokcatIndex[forcedId];
            const forcedTeams = jokcatCompTeams(forcedComp);
            bestRatio = matchRatio(fecapaTeams, forcedTeams);
            bestScoreBreakdown = computeCandidateScore({
              fecapaName,
              jokName: forcedComp.name || "",
              fecapaTeams,
              jokTeams: forcedTeams,
            });
            bestMatchesInfo = bestTeamMatches(fecapaTeams, forcedTeams);
            bestComp = forcedComp;
            hasMappedJokcat = true;
            matchSource = "manual";
            totalManualApplied++;
          }
        } else if (manualFeedback?.verdict === "incorrect") {
          hasMappedJokcat = false;
          bestId = null;
          matchSource = "manual_reject";
          totalManualApplied++;
        }

        if (hasMappedJokcat) usedJokcatInThisComp.add(bestId);

        const jokcatComp   = hasMappedJokcat ? jokcatIndex[bestId] : null;
        const suggestedComp = !hasMappedJokcat ? bestComp : null;
        const jokcatMaxPj  = jokcatComp ? maxPjInJokcatComp(jokcatComp) : null;
        const isFresh      = jokcatMaxPj !== null && jornadesActuals > 0
          ? jokcatMaxPj >= jornadesActuals
          : null; // null = no podem determinar

        if (isFresh === true)  totalFresh++;
        if (isFresh === false) totalStale++;
        totalGroupsOk++;

        groupEntries.push({
          groupId:         group.groupId,
          fecapaGroupId:   group.groupId,
          groupName:       group.groupName,
          fecapaTeamCount: group.teamCount,
          fecapaTeams,
          fecapaClassification: group.teams || [],
          jokcatCompId:    hasMappedJokcat ? bestId : null,
          jokcatCompName:  jokcatComp?.name || null,
          jokcatMatchRatio: hasMappedJokcat ? Math.round(bestRatio * 100) : 0,
          coincidenceCalc: hasMappedJokcat ? `matched/max(FECAPA,JOK) = ${bestMatchesInfo.matched}/${Math.max(fecapaTeams.length, (jokcatComp?.classification?.length || 0))}` : null,
          matchedTeamsCount: hasMappedJokcat ? bestMatchesInfo.matched : 0,
          fecapaTeamsCountForCalc: fecapaTeams.length,
          jokcatTeamsCountForCalc: jokcatComp?.classification?.length || 0,
          jokcatScore: hasMappedJokcat ? Number(bestScoreBreakdown.compositeScore.toFixed(3)) : 0,
          jokcatTeamScore: hasMappedJokcat ? Number(bestScoreBreakdown.teamsScore.toFixed(3)) : 0,
          jokcatNameScore: hasMappedJokcat ? Number(bestScoreBreakdown.nameScore.toFixed(3)) : 0,
          jokcatPhaseScore: hasMappedJokcat ? Number((bestScoreBreakdown.phaseScore ?? 0).toFixed(3)) : 0,
          jokcatTeamCount: jokcatComp ? (jokcatComp.classification?.length || 0) : null,
          jokcatClassification: jokcatComp?.classification || null,
          jokcatMaxPj,
          suggestedJokcatCompId: suggestedComp?.id || null,
          suggestedJokcatCompName: suggestedComp?.name || null,
          suggestedJokcatCategory: suggestedComp?._rawCategory || null,
          suggestedJokcatMatchRatio: !hasMappedJokcat && bestId ? Math.round(bestRatio * 100) : 0,
          suggestedCoincidenceCalc: !hasMappedJokcat && bestId ? `matched/max(FECAPA,JOK) = ${bestMatchesInfo.matched}/${Math.max(fecapaTeams.length, (suggestedComp?.classification?.length || 0))}` : null,
          suggestedMatchedTeamsCount: !hasMappedJokcat ? bestMatchesInfo.matched : 0,
          suggestedJokcatScore: !hasMappedJokcat ? Number((bestScoreBreakdown.compositeScore || 0).toFixed(3)) : 0,
          suggestedJokcatClassification: suggestedComp?.classification || null,
          suggestedJokcatTeamCount: suggestedComp?.classification?.length || 0,
          jornadesActuals,
          isFresh,
          matchSource,
          manualFeedback: manualFeedback || null,
          status: "fecapa_ok",
        });
      }

      // Detecta grups jok.cat sense mapear que coincideixen amb aquesta competició FECAPA
      // (candidats a grups faltants de FECAPA)
      const missingGroups = [];
      for (const jokId of allJokcatIds) {
        if (usedJokcatInThisComp.has(jokId)) continue;
        const jokComp  = jokcatIndex[jokId];
        if (!isCompatibleCompetition(catKey, fecapaName, jokComp)) continue;
        const jokTeams = jokcatCompTeams(jokComp);
        if (jokTeams.length === 0) continue;
        if ((jokComp.classification?.length || 0) === 0) continue;

        // Comprova si algun equip d'aquest jokcat apareix en algun grup FECAPA ja mapejat
        const allFecapaTeamsInComp = new Set(
          validFecapaGroups.flatMap(g => fecapaGroupTeams(g))
        );
        const overlap = jokTeams.filter(t => allFecapaTeamsInComp.has(t));
        const teamMatchesMissing = bestTeamMatches([...allFecapaTeamsInComp], jokTeams, 0.72);
        const candidate = computeCandidateScore({
          fecapaName,
          jokName: jokComp.name || "",
          fecapaTeams: [...allFecapaTeamsInComp],
          jokTeams,
        });

        // Per detectar fallback de grups faltants, deixem llindar una mica més baix,
        // però exigim mínim evidència de nom o equips.
        const hasSignal = candidate.nameScore >= 0.35 || candidate.teamsScore >= 0.20 || overlap.length > 0;
        if (!hasSignal) continue;
        if (candidate.compositeScore < 0.45) continue;

        const jokcatMaxPj = maxPjInJokcatComp(jokComp);
        const isFresh = jornadesActuals > 0 ? jokcatMaxPj >= jornadesActuals : null;

        if (isFresh === true)  totalFresh++;
        if (isFresh === false) totalStale++;
        totalGroupsMissing++;

        missingGroups.push({
          groupId:         null,
          fecapaGroupId:   null,
          groupName:       jokComp.name || jokId,
          fecapaTeamCount: null,
          fecapaTeams:     [],
          fecapaClassification: [],
          jokcatCompId:    jokId,
          jokcatCompName:  jokComp.name || null,
          jokcatCategory:  jokComp._rawCategory || null,
          jokcatMatchRatio: Math.round((teamMatchesMissing.matched / Math.max(allFecapaTeamsInComp.size, jokTeams.length)) * 100),
          coincidenceCalc: `matched/max(FECAPA,JOK) = ${teamMatchesMissing.matched}/${Math.max(allFecapaTeamsInComp.size, jokTeams.length)}`,
          matchedTeamsCount: teamMatchesMissing.matched,
          fecapaTeamsCountForCalc: allFecapaTeamsInComp.size,
          jokcatTeamsCountForCalc: jokTeams.length,
          jokcatScore: Number(candidate.compositeScore.toFixed(3)),
          jokcatTeamScore: Number(candidate.teamsScore.toFixed(3)),
          jokcatNameScore: Number(candidate.nameScore.toFixed(3)),
          jokcatPhaseScore: Number((candidate.phaseScore ?? 0).toFixed(3)),
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
    feedbackUpdatedAt: feedbackRaw?.updatedAt || null,
    totalGroupsOk,
    totalGroupsMissing,
    totalFresh,
    totalStale,
    totalManualApplied,
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
