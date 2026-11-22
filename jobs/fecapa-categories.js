const fs = require("fs").promises;
const path = require("path");
const https = require("https");
const http = require("http");
const puppeteer = require("puppeteer");

const { getCurrentSeasonLabelFromEnvOrDate, isSeasonLabelBeforeCurrentSeason } = require("./season-utils");
const {
  openSidgadApiPage,
  sidgadApiOrNull,
  resolveSeasonId,
  parseCalendarGames,
  parseStanding,
} = require("./sidgad-api");

const CURRENT_SEASON = getCurrentSeasonLabelFromEnvOrDate(process.env);
const COMP_FILE = path.join(__dirname, "../public/competicions-sidgad.json");
const DATA_FILE = path.join(__dirname, "../public/data.json");
const CATEGORIES_FILE = path.join(__dirname, "../public/fecapa-categories.json");
const FECAPA_4452_REFERENCE_HTML = path.join(__dirname, "../public/HOQUEI PATINS _ FCP.html");
const VALIDATION_COMP_4452_ID = "4452";
const VALIDATION_COMP_4452_NAME = "BENJAMÍ COPA BARCELONA 2ª FASE";
const REMOTE_COMP_URLS = [
  "https://raw.githubusercontent.com/sergireven/hoquei-fecapa/Millores-12/public/competicions-sidgad.json",
  "https://raw.githubusercontent.com/sergireven/hoquei-fecapa/main/public/competicions-sidgad.json",
];
const TARGET_CATEGORIES = new Set([
  "NACIONAL CATALANA",
  "PRIMERA CATALANA",
  "SEGONA CATALANA",
  "TERCERA CATALANA",
  "FEM",
  "JUNIOR",
  "JUVENIL",
  "INFANTIL",
  "PREBENJAMI",
  "BENJAMI",
  "ALEVI",
  "VETERANS",
]);
const REQUEST_TIMEOUT_MS = 20000;
const MAX_CONCURRENCY = 6;
const NO_MATCHES_PLAYED_MESSAGE = "Sense partits disputats";
const PLAYOFF_UNAVAILABLE_MESSAGE = "No disponible actualment";
const POSTSEASON_PHASE_RE = /\b(play\s*-?\s*off|eliminat|fase\s*final|final\s*a\s*4|final\s*four)\b/i;
const ALLOW_INSECURE_TLS = process.env.FECAPA_ALLOW_INSECURE_TLS === "1"
  || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";

function inferPhaseType(phaseName) {
  const n = normName(phaseName || "");
  if (/\bPLAY\s*OFF\b/.test(n)) return "playoff";
  if (/\bELIMINAT/.test(n)) return "eliminatories";
  if (/\bFASE\s*FINAL\b|\bFINAL\s*A\s*4\b|\bFINAL\s*FOUR\b/.test(n)) return "fase_final";
  return "lliga";
}

function isPostSeasonPhaseName(phaseName) {
  return POSTSEASON_PHASE_RE.test(String(phaseName || ""));
}

function getEmptyGroupStatusMessage(groupName) {
  const name = String(groupName || "").trim();
  if (/\bplay\s*-?\s*off\b/i.test(name)) {
    return PLAYOFF_UNAVAILABLE_MESSAGE;
  }
  return NO_MATCHES_PLAYED_MESSAGE;
}

let memoryCache = null;
let memoryCacheAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;
let validation4452Cache = null;


function decodeHtmlEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&[a-z]+;/gi, " ");
}

function normalizeText(s) {
  return decodeHtmlEntities(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normName(name) {
  return String(name || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferBaseCategory(name) {
  const n = normName(name);
  if (n.includes("NACIONAL CATALANA")) return "nacional_catalana";
  if (n.includes("PRIMERA CATALANA")) return "primera_catalana";
  if (n.includes("SEGONA CATALANA")) return "segona_catalana";
  if (n.includes("TERCERA CATALANA")) return "tercera_catalana";
  if (n === "FEM" || n.startsWith("FEM ")) return "fem";
  if (n.includes("JUNIOR")) return "junior";
  if (n.includes("JUVENIL")) return "juvenil";
  if (n.includes("INFANTIL")) return "infantil";
  if (n.includes("PREBENJAMI")) return "prebenjami";
  if (n.includes("BENJAMI")) return "benjami";
  if (n.includes("ALEVI")) return "alevi";
  if (n.includes("VETERANS")) return "veterans";
  return null;
}

function parseClassificationSidgad(html) {
  if (!html || html.length < 50) return [];
  const rows = [];

  const trMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m =>
      decodeHtmlEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
    );
    if (cells.length < 5) continue;

    const posIdx = cells.findIndex(c => /^\d{1,2}$/.test(c) && parseInt(c, 10) >= 1 && parseInt(c, 10) <= 30);
    if (posIdx < 0) continue;
    const pos = parseInt(cells[posIdx], 10);

    const teamIdx = cells.findIndex((c, i) => i > posIdx && c.length > 2 && /[a-zA-Z]/.test(c) && !/^\d+$/.test(c));
    if (teamIdx < 0) continue;

    const rawTeam = cells[teamIdx].trim();
    const shortM = rawTeam.match(/([A-Z0-9]{2,6})$/);
    const teamShort = shortM ? shortM[1] : null;
    const teamName = rawTeam.replace(/\s+[A-Z0-9]{2,6}$/, "").trim() || rawTeam;
    const nums = cells.slice(teamIdx + 1).map(c => parseInt(c, 10)).filter(n => !Number.isNaN(n));
    // In some competitions the table is present before any played match and all
    // stat cells are '-' or empty. Keep the team row with null numeric stats.
    const [points = null, played = null, won = null, drawn = null, lost = null, goalsFor = null, goalsAgainst = null, goalDiff = null, penalties = null] = nums;
    const teamIdMatch = tr.match(/\/equip\/(\d+)\//);

    rows.push({
      position: pos,
      teamId: teamIdMatch ? teamIdMatch[1] : null,
      teamName,
      teamShort,
      logoSrc: null,
      points,
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDiff,
      penalties,
    });
  }

  return rows;
}

function parseClassificationByGroupSidgad(html) {
  if (!html || html.length < 50) return [];

  const seen = new Set();
  const pushName = (rawName) => {
    const name = normalizeText(rawName);
    if (!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };
  const groups = [];
  let idx = 0;

  const blockRe = /<div[^>]*class=['"]?[^'"]*div_titulo_fase_idc[^'"]*['"]?[^>]*>([\s\S]*?)<\/div>[\s\S]*?<table[^>]*class=['"]?[^'"]*tabla_standard[^'"]*['"]?[^>]*>([\s\S]*?)<\/table>/gi;
  let match;

  while ((match = blockRe.exec(html)) !== null) {
    const groupName = normalizeText(match[1]);
    const parsedRows = parseClassificationSidgad(`<table>${match[2]}</table>`);
    groups.push({
      groupName: groupName || `Grup ${idx + 1}`,
      teamCount: parsedRows.length,
      teams: parsedRows,
    });
    idx += 1;
  }

  if (groups.length > 0) return groups;

  const leagueContainerRe = /<div[^>]*id=['"]?league_([^'"]+)['"]?[^>]*class=['"]?[^'"]*leagueContainer[^'"]*['"]?[^>]*>([\s\S]*?)<\/div>/gi;
  idx = 0;

  while ((match = leagueContainerRe.exec(html)) !== null) {
    const containerContent = match[2];
    const groupName = normalizeText(containerContent.match(/<[^>]*(?:h1|h2|h3|h4|title|font-bold)[^>]*>([^<]*)<\/[^>]*>/i)?.[1] || `Grup ${idx + 1}`);

    const parsedRows = parseClassificationSidgad(containerContent);
    groups.push({
      groupName: groupName || `Grup ${idx + 1}`,
      teamCount: parsedRows.length,
      teams: parsedRows,
    });
    idx += 1;
  }

  return groups;
}


function fetchText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, {
      ...(url.startsWith("https") && ALLOW_INSECURE_TLS ? { rejectUnauthorized: false } : {}),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ca,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity",
      },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (redirectsLeft <= 0) return reject(new Error("Too many redirects"));
        const nextRaw = res.headers.location;
        const next = nextRaw.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).href;

        // Some FECAPA redirects include only hash changes (or same URL),
        // which can create redirect loops in Node requests.
        const currentUrl = new URL(url);
        const nextUrl = new URL(next);
        currentUrl.hash = "";
        nextUrl.hash = "";

        if (nextUrl.href === currentUrl.href) {
          // Retry once with trailing slash to break server canonicalization loops.
          if (!currentUrl.pathname.endsWith("/")) {
            const alt = new URL(currentUrl.href);
            alt.pathname = `${alt.pathname}/`;
            res.resume();
            return resolve(fetchText(alt.href, redirectsLeft - 1));
          }
          res.resume();
          return reject(new Error(`Redirect loop detected -> ${url}`));
        }

        res.resume();
        return resolve(fetchText(next, redirectsLeft - 1));
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} -> ${url}`));
      }

      res.setEncoding("utf8");
      let body = "";
      res.on("data", c => { body += c; });
      res.on("end", () => resolve(body));
    });

    req.on("error", reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Timeout: ${url}`));
    });
  });
}


async function loadCompIndex() {
  const candidates = [
    COMP_FILE,
    path.join(process.cwd(), "public/competicions-sidgad.json"),
    path.join(process.cwd(), "./public/competicions-sidgad.json"),
    "/var/task/public/competicions-sidgad.json",
  ];

  const localErrors = [];
  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length) {
        return parsed;
      }
      localErrors.push(`${p}: empty json`);
    } catch (err) {
      localErrors.push(`${p}: ${err.message}`);
    }
  }

  const remoteErrors = [];
  for (const url of REMOTE_COMP_URLS) {
    try {
      const raw = await fetchText(url);
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length) {
        return parsed;
      }
      remoteErrors.push(`${url}: empty json`);
    } catch (err) {
      remoteErrors.push(`${url}: ${err.message}`);
    }
  }

  throw new Error(`Cannot load competicions-sidgad.json | local=[${localErrors.join(" | ")}] | remote=[${remoteErrors.join(" | ")}]`);
}

async function loadCategoriesFile() {
  try {
    const raw = await fs.readFile(CATEGORIES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (
      parsed && typeof parsed === "object" && parsed.categories
      && parsed.season === CURRENT_SEASON
    ) return parsed;
  } catch {
    // Cache file absent or invalid; fall through to live/snapshot generation.
  }
  return null;
}

async function loadDataFile() {
  const candidates = [
    DATA_FILE,
    path.join(process.cwd(), "public/data.json"),
    path.join(process.cwd(), "./public/data.json"),
    "/var/task/public/data.json",
  ];

  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.categories) {
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

function buildPersistedCompetitionIndex(persisted) {
  const byId = {};
  const cats = persisted?.categories || {};
  for (const comps of Object.values(cats)) {
    if (!Array.isArray(comps)) continue;
    for (const comp of comps) {
      const id = String(comp?.competitionId || "").trim();
      if (!id) continue;
      byId[id] = comp;
    }
  }
  return byId;
}

function normalizeCategory(cat) {
  return normName(cat || "");
}

function selectTargetCompetitions(compIndex, targetCategories = TARGET_CATEGORIES) {
  const selected = [];
  for (const [competitionId, comp] of Object.entries(compIndex || {})) {
    const category = normalizeCategory(comp?.category);
    if (!targetCategories.has(category)) continue;
    selected.push({
      competitionId,
      competitionName: String(comp?.name || "").trim() || `Competició ${competitionId}`,
      category: inferBaseCategory(category),
    });
  }
  return selected;
}

function selectPostSeasonCompetitionsFromData(dataFile, targetCategories = TARGET_CATEGORIES) {
  const selected = [];
  const categories = dataFile?.categories || {};

  for (const [catName, comps] of Object.entries(categories)) {
    const normalizedCat = normalizeCategory(catName);
    if (!targetCategories.has(normalizedCat)) continue;

    for (const comp of (Array.isArray(comps) ? comps : [])) {
      const name = String(comp?.name || "").trim();
      const compId = String(comp?.id || "").trim();
      if (!name || !compId) continue;
      if (!POSTSEASON_PHASE_RE.test(name)) continue;

      selected.push({
        competitionId: compId,
        competitionName: name.replace(/\s*\(\d{4}-\d{2}\)\s*$/i, "").trim(),
        category: inferBaseCategory(normalizedCat) || inferBaseCategory(name),
      });
    }
  }

  return selected;
}

function mergeCompetitionSelections(baseList, extraList) {
  const out = [];
  const seen = new Set();

  for (const comp of [...(baseList || []), ...(extraList || [])]) {
    const id = String(comp?.competitionId || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(comp);
  }

  return out;
}

function toNumberOrNull(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function normalizeToken(s) {
  return String(s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGroupNameForCompetition(competitionName, groupName, idx = 0) {
  const raw = String(groupName || "").trim();
  const fallback = `Grup ${idx + 1}`;
  const effective = raw || fallback;
  const n = normalizeToken(effective);

  if (/^GRUP\s+\d+$/.test(n) || /^GROUP\s+\d+$/.test(n)) {
    return `${competitionName} - ${effective}`;
  }

  return effective;
}

function buildGroupId(competitionId, groupName, fallbackOrder) {
  const n = normalizeToken(groupName);
  const tierMatch = n.match(/\b(OR|PLATA|BRONZE|INICIACIO|PREFERENT|GOLD|SILVER)\b/);
  const explicitGroupMatch = n.match(/\bGRUP\s+([A-Z0-9]{1,4})\b/);
  const phaseSuffixMatch = n.match(/\b(?:OR|PLATA|BRONZE|INICIACIO|PREFERENT|GOLD|SILVER)\s+([A-Z0-9]{1,4})\b/);
  const numberMatches = [...n.matchAll(/\b(\d{1,2})\b/g)];
  const suffix = explicitGroupMatch?.[1]
    || phaseSuffixMatch?.[1]
    || (numberMatches.length ? numberMatches[numberMatches.length - 1][1] : String(fallbackOrder || 1));
  const tier = tierMatch ? tierMatch[1] : "GRUP";
  return `${competitionId}-${tier}-${suffix}`;
}

function isCompetitionFinishedOverride(competitionName) {
  const seasonMatch = String(competitionName || "").match(/\((\d{4}-\d{2})\)\s*$/);
  if (!seasonMatch) return false;
  return isSeasonLabelBeforeCurrentSeason(seasonMatch[1], process.env);
}

function annotateCompetitionNoMatches(compData) {
  const groups = Array.isArray(compData?.groups) ? compData.groups : [];
  const hasAnyTeam = groups.some(g => (g?.teamCount || 0) > 0);

  if (!hasAnyTeam) {
    const annotatedGroups = groups.map(g => ({
      ...g,
      teamCount: Number.isFinite(g?.teamCount) ? g.teamCount : ((g?.teams || []).length || 0),
      teams: Array.isArray(g?.teams) ? g.teams : [],
      statusMessage: getEmptyGroupStatusMessage(g?.groupName),
    }));

    const competitionStatusMessage = annotatedGroups.length > 0
      ? (annotatedGroups.every(g => g.statusMessage === PLAYOFF_UNAVAILABLE_MESSAGE)
        ? PLAYOFF_UNAVAILABLE_MESSAGE
        : NO_MATCHES_PLAYED_MESSAGE)
      : NO_MATCHES_PLAYED_MESSAGE;

    return {
      ...compData,
      groupCount: annotatedGroups.length,
      teamCount: 0,
      groups: annotatedGroups,
      statusMessage: competitionStatusMessage,
      isFinished: isCompetitionFinishedOverride(compData?.competitionName),
    };
  }

  return {
    ...compData,
    groups: groups.map(g => ({
      ...g,
      teamCount: Number.isFinite(g?.teamCount) ? g.teamCount : ((g?.teams || []).length || 0),
      teams: Array.isArray(g?.teams) ? g.teams : [],
    })),
    isFinished: isCompetitionFinishedOverride(compData?.competitionName),
  };
}

function mapRowFromSnapshot(row) {
  return {
    position: toNumberOrNull(row?.pos),
    teamId: row?.teamId ? String(row.teamId) : null,
    teamName: String(row?.team || "").trim(),
    teamShort: null,
    logoSrc: row?.clubId ? String(row.clubId) : null,
    points: toNumberOrNull(row?.pts),
    played: toNumberOrNull(row?.pj),
    won: toNumberOrNull(row?.pg),
    drawn: toNumberOrNull(row?.pe),
    lost: toNumberOrNull(row?.pp),
    goalsFor: toNumberOrNull(row?.gf),
    goalsAgainst: toNumberOrNull(row?.gc),
    goalDiff: toNumberOrNull(row?.gav),
    penalties: toNumberOrNull(row?.pen),
  };
}

function splitFlatClassificationIntoGroups(rows) {
  const groups = [];
  let current = [];

  for (const row of rows || []) {
    const pos = toNumberOrNull(row?.pos);
    if (pos === 1 && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(row);
  }

  if (current.length > 0) groups.push(current);
  if (groups.length <= 1) return groups;

  // If the last table is an overall aggregate of previous groups, drop it.
  const last = groups[groups.length - 1] || [];
  const prev = groups.slice(0, -1);
  const lastTeams = new Set(last.map(r => normalizeToken(r?.team)));
  const prevTeams = new Set(prev.flat().map(r => normalizeToken(r?.team)));

  if (prevTeams.size > 0 && lastTeams.size >= prevTeams.size) {
    let allContained = true;
    for (const team of prevTeams) {
      if (!lastTeams.has(team)) {
        allContained = false;
        break;
      }
    }
    if (allContained) return prev;
  }

  return groups;
}

function sanitizeSnapshotGroupName({ rawGroupName, idx, compMeta, hierarchyKeyToName, hierarchyNames }) {
  const fallbackName = `Grup ${idx + 1}`;
  const raw = String(rawGroupName || "").trim();
  if (!raw) {
    return hierarchyNames[idx] || fallbackName;
  }

  const keyMatch = raw.match(/^group[_\s-]*(\d+)$/i);
  if (keyMatch) {
    const mapped = hierarchyKeyToName.get(`group_${keyMatch[1]}`) || hierarchyKeyToName.get(raw);
    if (mapped) return mapped;
    return fallbackName;
  }

  if (/^\d{4,}$/.test(raw)) {
    return hierarchyNames[idx] || fallbackName;
  }

  return raw;
}

function buildCompetitionFromSnapshot(compMeta, compRaw) {
  const byGroup = compRaw?.classificationByGroup || {};
  const byGroupName = compRaw?.classificationByGroupName || {};
  const hierarchyGroups = Array.isArray(compRaw?.hierarchy?.groups) ? compRaw.hierarchy.groups : [];
  const hierarchyNames = hierarchyGroups.map(g => String(g?.name || "").trim()).filter(Boolean);
  const hierarchyKeyToName = new Map(
    hierarchyGroups
      .map(g => [String(g?.key || ""), String(g?.name || "").trim()])
      .filter(([k, n]) => k && n)
  );
  let groups = [];

  if (Object.keys(byGroupName).length) {
    groups = Object.entries(byGroupName).map(([groupName, rows], idx) => {
      const teams = (rows || []).map(mapRowFromSnapshot).filter(r => r.teamName);
      const normalizedGroupName = sanitizeSnapshotGroupName({
        rawGroupName: groupName,
        idx,
        compMeta,
        hierarchyKeyToName,
        hierarchyNames,
      });
      const finalGroupName = normalizeGroupNameForCompetition(compMeta.competitionName, normalizedGroupName, idx);
      return {
        groupId: buildGroupId(compMeta.competitionId, finalGroupName, idx + 1),
        groupName: finalGroupName,
        teamCount: teams.length,
        teams,
      };
    });
  } else if (Object.keys(byGroup).length) {
    groups = Object.entries(byGroup).map(([groupKey, rows], idx) => {
      const groupName = sanitizeSnapshotGroupName({
        rawGroupName: groupKey,
        idx,
        compMeta,
        hierarchyKeyToName,
        hierarchyNames,
      });
      const finalGroupName = normalizeGroupNameForCompetition(compMeta.competitionName, groupName, idx);
      const teams = (rows || []).map(mapRowFromSnapshot).filter(r => r.teamName);
      return {
        groupId: buildGroupId(compMeta.competitionId, finalGroupName, idx + 1),
        groupName: finalGroupName,
        teamCount: teams.length,
        teams,
      };
    });
  }

  if (!groups.length) {
    const rawFlat = compRaw?.classification || [];
    const split = splitFlatClassificationIntoGroups(rawFlat);

    groups = split.map((chunk, idx) => {
      const teams = chunk.map(mapRowFromSnapshot).filter(r => r.teamName);
      const fallbackName = split.length > 1
        ? `${compMeta.competitionName} - Grup ${idx + 1}`
        : compMeta.competitionName;
      const groupName = normalizeGroupNameForCompetition(
        compMeta.competitionName,
        hierarchyNames[idx] || fallbackName,
        idx
      );
      return {
        groupId: buildGroupId(compMeta.competitionId, groupName, idx + 1),
        groupName,
        teamCount: teams.length,
        teams,
      };
    });
  }

  if (!groups.length) {
    const hierarchyGroups = Array.isArray(compRaw?.hierarchy?.groups) ? compRaw.hierarchy.groups : [];
    if (hierarchyGroups.length) {
      groups = hierarchyGroups.map((g, idx) => {
        const groupName = normalizeGroupNameForCompetition(
          compMeta.competitionName,
          String(g?.name || g?.idc || g?.key || "").trim() || compMeta.competitionName,
          idx
        );
        return {
          groupId: buildGroupId(compMeta.competitionId, groupName, idx + 1),
          groupName,
          teamCount: 0,
          teams: [],
        };
      });
    } else {
      const fallbackGroupName = normalizeGroupNameForCompetition(compMeta.competitionName, compMeta.competitionName, 0);
      groups = [{
        groupId: buildGroupId(compMeta.competitionId, fallbackGroupName, 1),
        groupName: fallbackGroupName,
        teamCount: 0,
        teams: [],
      }];
    }
  }

  const phases = [];
  return annotateCompetitionNoMatches({
    competitionId: compMeta.competitionId,
    competitionName: compMeta.competitionName,
    groupCount: groups.length,
    teamCount: groups.reduce((acc, g) => acc + g.teamCount, 0),
    groups,
    competitionPhases: phases,
    hasPostSeasonPhases: false,
  });
}

async function mapWithConcurrency(items, limit, mapper) {
  const out = new Array(items.length);
  let idx = 0;

  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const current = idx;
      idx += 1;
      if (current >= items.length) break;
      out[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return out;
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${timeoutMs}ms (${label})`));
    }, timeoutMs);

    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function buildCompetitionFromParsedGroups(comp, parsedGroups) {
  const groupsOut = (parsedGroups || []).map((g, idx) => ({
    groupId: buildGroupId(comp.competitionId, normalizeGroupNameForCompetition(comp.competitionName, g.groupName, idx), idx + 1),
    groupName: normalizeGroupNameForCompetition(comp.competitionName, g.groupName, idx),
    teamCount: g.teamCount || (g.teams || []).length,
    teams: g.teams || [],
  }));

  const normalizedGroups = groupsOut.length > 0
    ? groupsOut
    : [{
      groupId: buildGroupId(comp.competitionId, comp.competitionName, 1),
      groupName: comp.competitionName,
      teamCount: 0,
      teams: [],
    }];

  return annotateCompetitionNoMatches({
    competitionId: comp.competitionId,
    competitionName: comp.competitionName,
    groupCount: normalizedGroups.length,
    teamCount: normalizedGroups.reduce((acc, g) => acc + g.teamCount, 0),
    groups: normalizedGroups,
    competitionPhases: [],
    hasPostSeasonPhases: false,
  });
}

function attachCompetitionPhases(compData, phases) {
  const normalizedPhases = Array.isArray(phases) ? phases : [];
  return {
    ...compData,
    competitionPhases: normalizedPhases,
    hasPostSeasonPhases: normalizedPhases.some(p => p?.isPostSeason === true),
  };
}


function normalizeFingerprintToken(s) {
  return String(s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fingerprintCompetition(compData) {
  const groups = Array.isArray(compData?.groups) ? compData.groups : [];
  const groupPart = groups
    .map(g => normalizeFingerprintToken(g?.groupName || ""))
    .join("||");
  const teamPart = groups
    .flatMap(g => Array.isArray(g?.teams) ? g.teams : [])
    .map(t => normalizeFingerprintToken(t?.teamName || ""))
    .filter(Boolean)
    .join("||");
  return `${groupPart}###${teamPart}`;
}

function parse4452ReferenceFromHtml(html) {
  const titleNeedle = `<span id="titulo_competicion_header_text">${VALIDATION_COMP_4452_NAME}</span>`;
  const titleIdx = html.indexOf(titleNeedle);
  if (titleIdx < 0) {
    throw new Error("4452 reference title not found in HTML");
  }

  const containerStart = html.lastIndexOf("<div class=\"tab_modal_container\"", titleIdx);
  if (containerStart < 0) {
    throw new Error("4452 reference container start not found");
  }

  const containerEndMarker = html.indexOf("<!--tab_modal_container-->", titleIdx);
  if (containerEndMarker < 0) {
    throw new Error("4452 reference container end marker not found");
  }
  const containerEnd = html.indexOf("</div>", containerEndMarker);
  if (containerEnd < 0) {
    throw new Error("4452 reference container end tag not found");
  }

  const containerHtml = html.slice(containerStart, containerEnd + 6);
  const parsedGroups = parseClassificationByGroupSidgad(containerHtml);
  if (!parsedGroups.length) {
    throw new Error("4452 reference groups could not be parsed");
  }

  return buildCompetitionFromParsedGroups(
    {
      competitionId: VALIDATION_COMP_4452_ID,
      competitionName: VALIDATION_COMP_4452_NAME,
    },
    parsedGroups
  );
}

async function get4452ReferenceCompetition() {
  if (validation4452Cache) return validation4452Cache;

  const raw = await fs.readFile(FECAPA_4452_REFERENCE_HTML, "utf8");
  validation4452Cache = parse4452ReferenceFromHtml(raw);
  return validation4452Cache;
}

async function validateAndNormalize4452Competition(compData) {
  if (String(compData?.competitionId || "") !== VALIDATION_COMP_4452_ID) {
    return { data: compData, validationIssue: null };
  }

  try {
    const reference = await get4452ReferenceCompetition();
    const currentFp = fingerprintCompetition(compData);
    const referenceFp = fingerprintCompetition(reference);

    if (currentFp === referenceFp) {
      return { data: compData, validationIssue: null };
    }

    const refGroupCount = reference?.groups?.length || 0;
    const refTeamCount = reference?.groups?.reduce((sum, g) => sum + (g?.teams?.length || 0), 0) || 0;
    const currentGroupCount = compData?.groups?.length || 0;
    const currentTeamCount = compData?.groups?.reduce((sum, g) => sum + (g?.teams?.length || 0), 0) || 0;

    const groupDiff = Math.abs(refGroupCount - currentGroupCount);
    const teamDiff = Math.abs(refTeamCount - currentTeamCount);
    const groupMatch = refGroupCount > 0 && groupDiff <= 1;
    const teamMatch = refTeamCount > 0 && teamDiff <= Math.max(5, Math.ceil(refTeamCount * 0.1));

    if (groupMatch && teamMatch) {
      console.log(
        `[fecapa-categories] 4452 validation soft-pass | ref=(${refGroupCount} grups, ${refTeamCount} equips) vs current=(${currentGroupCount} grups, ${currentTeamCount} equips)`
      );
      return { data: compData, validationIssue: null };
    }

    const issue = `fingerprint mismatch: ref=(${refGroupCount}G,${refTeamCount}T) vs current=(${currentGroupCount}G,${currentTeamCount}T)`;
    console.log(`[fecapa-categories] 4452 validation issue (non-fatal): ${issue}`);
    return { data: compData, validationIssue: issue };
  } catch (err) {
    const issue = `validation error: ${err.message}`;
    console.log(`[fecapa-categories] 4452 ${issue}`);
    return { data: compData, validationIssue: issue };
  }
}


// ── Core function: obtenir dades de categories ───────────────
// Construeix una competició (grups + fases) a partir de l'API de sidgad.
async function scrapeCompetitionFromApi(page, comp) {
  const competitionId = String(comp.competitionId);

  const standing = await sidgadApiOrNull(page, "standing", { id: competitionId });
  const parsedGroups = (standing ? parseStanding(standing, competitionId) : []).map(g => ({
    groupName: g.name || comp.competitionName,
    teamCount: g.rows.length,
    teams: g.rows.map(r => ({
      position: r.position,
      teamId: null,
      teamName: r.teamName,
      teamShort: r.teamShort,
      logoSrc: r.logoSrc,
      points: r.points,
      played: r.played,
      won: r.won,
      drawn: r.drawn,
      lost: r.lost,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      goalDiff: r.goalDiff,
      penalties: r.penalties,
    })),
  }));

  const calendar = await sidgadApiOrNull(page, "calendar", { id: competitionId });
  const phases = (calendar ? parseCalendarGames(calendar, competitionId) : []).map((ph, idx) => {
    const phaseName = ph.name || "Calendari";
    const matches = ph.matches.map(m => ({
      jornada: m.jornada,
      home: m.home,
      away: m.away,
      date: m.year ? `${m.day}-${m.month}-${m.year}` : "",
      time: m.time || "",
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      played: m.played,
      source: "fecapa",
    }));
    return {
      phaseId: `${competitionId}-phase-${idx + 1}`,
      phaseName,
      phaseType: inferPhaseType(phaseName),
      isPostSeason: isPostSeasonPhaseName(phaseName),
      matchCount: matches.length,
      matches,
    };
  });

  const compData = buildCompetitionFromParsedGroups(comp, parsedGroups);
  console.log(
    `[fecapa-categories] ${competitionId} api groups=${compData.groupCount} teams=${compData.teamCount} phases=${phases.length}`
  );
  return attachCompetitionPhases(compData, phases);
}

async function getCategoriesData(options = {}) {
  const {
    liveMode = false,
    useCache = true,
    categoriesFilter = null,
    validate4452 = false,
    competitionTimeoutMs = 45000,
  } = options;

  const now = Date.now();
  if (useCache && memoryCache && (now - memoryCacheAt) < CACHE_TTL_MS) {
    return memoryCache;
  }

  if (useCache) {
    const fileCache = await loadCategoriesFile();
    if (fileCache) {
      memoryCache = fileCache;
      memoryCacheAt = now;
      return fileCache;
    }
  }

  try {
    const compIndex = await loadCompIndex();
    const effectiveCategories = Array.isArray(categoriesFilter) && categoriesFilter.length > 0
      ? new Set(categoriesFilter.map(c => normalizeCategory(c)))
      : TARGET_CATEGORIES;
    const selectedFromCompIndex = selectTargetCompetitions(compIndex, effectiveCategories);
    const dataFile = await loadDataFile();
    const selectedPostSeason = selectPostSeasonCompetitionsFromData(dataFile, effectiveCategories);
    const selected = mergeCompetitionSelections(selectedFromCompIndex, selectedPostSeason)
      .filter(c => !!c?.category);

    const categories = {
      nacional_catalana: [],
      primera_catalana: [],
      segona_catalana: [],
      tercera_catalana: [],
      fem: [],
      junior: [],
      juvenil: [],
      infantil: [],
      prebenjami: [],
      benjami: [],
      alevi: [],
      veterans: [],
    };

    const errors = [];
    const persistedCategories = await loadCategoriesFile();
    const persistedById = buildPersistedCompetitionIndex(persistedCategories);

    // ── Pas 1: Snapshot com a base síncrona (sense xarxa) ────────────────────
    // Construeix les dades de cada competició a partir del JSON local.
    // Serveix de fallback quan qualsevol fetch HTTP falla.
    const snapshotBuilt = selected.map(comp => {
      const rawComp = compIndex?.[comp.competitionId] || {};
      const built = buildCompetitionFromSnapshot(comp, rawComp);

      const persistedComp = persistedById[String(comp.competitionId)] || null;

      // Si el snapshot és buit o té menys grups que l'última versió persistida,
      // preferim la dada persistida per mantenir estabilitat entre execucions.
      const builtGroups = built?.groupCount || 0;
      const persistedGroups = persistedComp?.groupCount || 0;
      const builtTeams = built?.teamCount || 0;
      const persistedTeams = persistedComp?.teamCount || 0;
      const shouldUsePersisted = !!persistedComp && (
        builtGroups === 0
        || persistedGroups > builtGroups
        || (persistedGroups === builtGroups && persistedTeams > builtTeams)
      );

      if (shouldUsePersisted) {
        return {
          ...persistedComp,
          competitionId: String(comp.competitionId),
          competitionName: String(comp.competitionName || persistedComp.competitionName || ""),
        };
      }

      return built;
    });

    let liveUsed = false;
    let liveUnavailableReason = liveMode ? "not-started" : "disabled";
    let finalBuilt = snapshotBuilt;

    if (liveMode && selected.length > 0) {
      let browser = null;
      const liveById = new Map();
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });

        // El portal nou (nov. 2026) ja no té el selector de temporada antic ni
        // les pàgines /league/<id>: les dades venen de l'API JSON de sidgad.
        const page = await openSidgadApiPage(browser);
        const portalTempId = await resolveSeasonId(page, CURRENT_SEASON);
        console.log(`[fecapa-categories] portal season=${CURRENT_SEASON} tempId=${portalTempId} (API sidgad)`);

        for (const comp of selected) {
          const sourceCompetitionId = String(comp.competitionId);
          try {
            const apiComp = await withTimeout(
              scrapeCompetitionFromApi(page, comp),
              competitionTimeoutMs,
              `api-${comp.competitionId}`
            );
            if (apiComp && apiComp.groupCount > 0) {
              liveById.set(sourceCompetitionId, apiComp);
              liveUsed = true;
            }
          } catch (err) {
            errors.push({
              competitionId: comp.competitionId,
              competitionName: comp.competitionName,
              error: `API scrape failed: ${err.message}`,
            });
          }
        }

        liveUnavailableReason = liveUsed ? null : "live-no-groups";
      } catch (err) {
        liveUnavailableReason = err.message || "live-init-failed";
        errors.push({ error: `Live mode unavailable: ${liveUnavailableReason}` });
      } finally {
        if (browser) {
          try { await browser.close(); } catch {}
        }
      }

      finalBuilt = snapshotBuilt.map((snap) => {
        const live = liveById.get(String(snap?.competitionId || ""));
        return live || snap;
      });
    }

    const leagueEnrichEnabled = false;
    const leagueEnrichProbeError = "disabled";

    const validatedBuilt = [];
    const validationIssues = [];
    if (validate4452) {
      for (let i = 0; i < finalBuilt.length; i += 1) {
        const result = await validateAndNormalize4452Competition(finalBuilt[i]);
        validatedBuilt.push(result.data);
        if (result.validationIssue) {
          validationIssues.push({
            competitionId: finalBuilt[i]?.competitionId,
            competitionName: finalBuilt[i]?.competitionName,
            issue: result.validationIssue,
          });
        }
      }
    } else {
      // Validation against static 4452 reference is intentionally opt-in.
      // Keep scraping resilient when portal markup drifts.
      validatedBuilt.push(...finalBuilt);
    }

    validatedBuilt.forEach((item, idx) => {
      const categoryKey = selected[idx]?.category;
      if (!categoryKey) return;
      categories[categoryKey].push(item);
    });

    if (validationIssues.length > 0) {
      validationIssues.forEach(issue => {
        errors.push({
          competitionId: issue.competitionId,
          competitionName: issue.competitionName,
          error: `Validation warning: ${issue.issue}`,
        });
      });
    }

    const out = {
      ok: true,
      source: liveUsed ? "sidgad_api" : "sidgad_snapshot",
      fetchedAt: new Date().toISOString(),
      liveMode,
      validate4452,
      liveUsed,
      liveUnavailableReason,
      leagueEnrichEnabled,
      leagueEnrichProbeError,
      categoriesFilter: Array.from(effectiveCategories.values()),
      fetchedCompetitions: selected.length,
      totalGroups: validatedBuilt.reduce((acc, comp) => acc + (comp?.groupCount || 0), 0),
      failedCompetitions: errors.length,
      errors,
      categories,
    };

    console.log(
      `[fecapa-categories] summary competitions=${out.fetchedCompetitions} totalGroups=${out.totalGroups} failed=${out.failedCompetitions}`
    );

    memoryCache = out;
    memoryCacheAt = Date.now();

    return out;
  } catch (err) {
    return {
      ok: true,
      degraded: true,
      source: "degraded-empty",
      fetchedAt: new Date().toISOString(),
      liveMode: false,
      fetchedCompetitions: 0,
      failedCompetitions: 0,
      errors: [{ error: err.message || "Unknown error" }],
      categories: { prebenjami: [], benjami: [], alevi: [] },
      hint: "Error carregant categories. Revisa logs.",
    };
  }
}

// ── Express middleware endpoint ──────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const query = new URL(req.url || "", "http://localhost").searchParams;
    const categoriesFilter = query.getAll("category").map(v => String(v || "").trim()).filter(Boolean);
    const data = await getCategoriesData({ categoriesFilter });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unknown error",
    });
  }
};

// ── Named export: reutilitzable per altres scriptures ────────
module.exports.getCategoriesData = getCategoriesData;
