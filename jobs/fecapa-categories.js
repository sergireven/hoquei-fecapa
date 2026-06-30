const fs = require("fs").promises;
const path = require("path");
const https = require("https");
const http = require("http");
const puppeteer = require("puppeteer");

const LEAGUE_BASE_URL = "https://www.hoqueipatins.fecapa.cat/league/";
const PORTAL_URL = "https://www.hoqueipatins.fecapa.cat/";
const TEMP_ID = "39"; // temporada 2025-26
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
const SIDGAD_CERILH_BASE_URL = "https://www.server2.sidgad.es/fecapa/cerilh/";
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

function requiresStrictPortalClassificationClick(compId) {
  return String(compId || "") === VALIDATION_COMP_4452_ID;
}

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

function parseScoreCell(text) {
  const clean = normalizeText(text);
  const m = clean.match(/^(\d{1,2})\s*[-:]\s*(\d{1,2})$/);
  if (!m) return { homeScore: null, awayScore: null, played: false };
  return {
    homeScore: parseInt(m[1], 10),
    awayScore: parseInt(m[2], 10),
    played: true,
  };
}

function parseMatchesFromCalendarTable(tableHtml) {
  const rows = [];
  const trMatches = String(tableHtml || "").match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  for (const tr of trMatches) {
    const rawCells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => normalizeText(m[1]));
    if (rawCells.length < 3) continue;

    const candidateTeams = rawCells.filter(c => /[A-ZÀ-ÿ]/i.test(c) && !/^\d+$/.test(c));
    if (candidateTeams.length < 2) continue;

    const home = candidateTeams[0] || "";
    const away = candidateTeams[1] || "";
    if (!home || !away || home === away) continue;

    const dateCell = rawCells.find(c => /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/.test(c)) || "";
    const dateMatch = dateCell.match(/(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)/);
    const timeMatch = dateCell.match(/(\d{1,2}:\d{2})/);

    const jornadaCell = rawCells.find(c => /\bj(?:ornada)?\s*\d+\b/i.test(c)) || "";
    const jornadaMatch = jornadaCell.match(/(\d{1,2})/);

    const scoreCell = rawCells.find(c => /^\d{1,2}\s*[-:]\s*\d{1,2}$/.test(c)) || "";
    const score = parseScoreCell(scoreCell);

    rows.push({
      jornada: jornadaMatch ? parseInt(jornadaMatch[1], 10) : null,
      home,
      away,
      date: dateMatch ? dateMatch[1].replace(/\//g, "-") : "",
      time: timeMatch ? timeMatch[1] : "",
      homeScore: score.homeScore,
      awayScore: score.awayScore,
      played: score.played,
      source: "fecapa",
    });
  }

  return rows;
}

function parseCalendarByPhaseSidgad(html, competitionId) {
  const out = [];
  const blockRe = /<div[^>]*class=['"]?[^'"]*div_titulo_fase_idc[^'"]*['"]?[^>]*>([\s\S]*?)<\/div>[\s\S]*?<table[^>]*class=['"]?[^'"]*tabla_standard[^'"]*['"]?[^>]*>([\s\S]*?)<\/table>/gi;
  let match;
  let idx = 0;

  while ((match = blockRe.exec(String(html || ""))) !== null) {
    const phaseName = normalizeText(match[1]) || `Fase ${idx + 1}`;
    const matches = parseMatchesFromCalendarTable(`<table>${match[2]}</table>`);
    out.push({
      phaseId: `${competitionId || "comp"}-phase-${idx + 1}`,
      phaseName,
      phaseType: inferPhaseType(phaseName),
      isPostSeason: isPostSeasonPhaseName(phaseName),
      matchCount: matches.length,
      matches,
    });
    idx += 1;
  }

  if (out.length > 0) return out;

  const flatMatches = parseMatchesFromCalendarTable(String(html || ""));
  if (!flatMatches.length) return [];

  return [{
    phaseId: `${competitionId || "comp"}-phase-1`,
    phaseName: "Calendari",
    phaseType: "lliga",
    isPostSeason: false,
    matchCount: flatMatches.length,
    matches: flatMatches,
  }];
}

function extractGroupNamesFromSidgadHtml(html) {
  if (!html || html.length < 50) return [];

  const names = [];
  const seen = new Set();
  const pushName = (rawName) => {
    const name = normalizeText(rawName);
    if (!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };

  const titleRe = /<div[^>]*class=['"]?[^'"]*div_titulo_fase_idc[^'"]*['"]?[^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = titleRe.exec(html)) !== null) {
    pushName(match[1]);
  }

  if (names.length > 0) return names;

  const headerRe = /<[^>]*(?:h1|h2|h3|h4|title|font-bold)[^>]*>([^<]*)<\/[^>]*>/gi;
  while ((match = headerRe.exec(html)) !== null) {
    pushName(match[1]);
  }

  return names;
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

function fetchFormText(url, formData) {
  return new Promise((resolve, reject) => {
    const payload = new URLSearchParams(formData || {}).toString();
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;

    const req = lib.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: `${u.pathname}${u.search}`,
      method: "POST",
      ...(u.protocol === "https:" && ALLOW_INSECURE_TLS ? { rejectUnauthorized: false } : {}),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ca,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
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

    req.write(payload);
    req.end();
  });
}

function mergeGroupsByName(baseGroups, extraGroups) {
  const out = [];
  const seen = new Set();

  const teamFingerprint = (g) => {
    const names = (g?.teams || [])
      .map(t => normalizeToken(t?.teamName || t?.team || ""))
      .filter(Boolean)
      .sort();
    return names.join("|");
  };

  const pushUnique = (g) => {
    const nameKey = normalizeToken(g?.groupName || "");
    const teamsKey = teamFingerprint(g);

    const dedupeKey = teamsKey
      ? `teams:${teamsKey}`
      : (nameKey ? `name:${nameKey}` : "");

    if (!dedupeKey || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    out.push(g);
  };

  (baseGroups || []).forEach(pushUnique);
  (extraGroups || []).forEach(pushUnique);
  return out;
}

function extractClassificationFileFromLeagueHtml(html, competitionId) {
  const strictRe = new RegExp(`id=['"]clasificaciones_btn['"][^>]*file=['"]([^'"]*clasif_idc_${String(competitionId)}_[^'"]+)['"]`, "i");
  const strict = html.match(strictRe);
  if (strict?.[1]) return strict[1];

  const generic = html.match(/file=['"]([^'"]*clasif_idc_[^'"]+\.php)['"]/i);
  return generic?.[1] || "";
}

function extractFilterValuesFromLeagueHtml(html) {
  const values = new Set(["0"]);
  const optionMatches = [...String(html || "").matchAll(/<option[^>]*value=['"]?(\d+)['"]?[^>]*>/gi)];
  optionMatches.forEach(m => values.add(String(m[1])));
  const classMatches = [...String(html || "").matchAll(/(?:filter_fase_|content_fase_)(\d+)/gi)];
  classMatches.forEach(m => values.add(String(m[1])));
  return [...values].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

function expectedMinGroupsByCompetitionName(comp) {
  const n = normName(comp?.competitionName || "");
  if (n.includes("SEGONA CATALANA FEMENINA")) return 2;
  if (n.includes("JUVENIL PLATA")) return 18;
  if (n.includes("INFANTIL PLATA")) return 21;
  if (n.includes("ALEVI PLATA")) return 23;
  return 0;
}

function buildBruteforceFilters(comp, existing) {
  const out = new Set(existing || []);
  const compName = String(comp?.competitionName || "");
  const compNameNorm = normName(compName);
  const expectedMinGroups = expectedMinGroupsByCompetitionName(comp);
  const isLikelyMultiGroup = comp?.category === "benjami"
    || comp?.category === "alevi"
    || comp?.category === "prebenjami"
    || /\bCOPA\b/i.test(compName)
    || /\bPLATA\b/.test(compNameNorm)
    || /\bSEGONA\s+CATALANA\s+FEMENINA\b/.test(compNameNorm);

  if (!isLikelyMultiGroup) return [...out];

  // Keep a generous scan window for competitions where FECAPA exposes many phase filters.
  const upperBound = Math.max(24, expectedMinGroups + 10, 48);
  for (let i = 1; i <= upperBound; i += 1) {
    out.add(String(i));
  }
  return [...out].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

async function loadGroupedClassificationByFilters(comp, leagueHtml) {
  const classFile = extractClassificationFileFromLeagueHtml(leagueHtml, comp.competitionId);
  if (!classFile) return [];

  const cleanFile = classFile.replace(/^\/+/, "");
  const classUrl = new URL(cleanFile, SIDGAD_CERILH_BASE_URL).href;
  const extractedFilters = extractFilterValuesFromLeagueHtml(leagueHtml);
  const filterValues = buildBruteforceFilters(comp, extractedFilters);
  let mergedGroups = [];

  for (const filter of filterValues) {
    try {
      const html = await fetchFormText(classUrl, { filter });
      const parsed = parseClassificationByGroupSidgad(html);

      if (parsed.length > 0) {
        mergedGroups = mergeGroupsByName(mergedGroups, parsed);
        continue;
      }

      const flat = parseClassificationSidgad(html);
      if (flat.length > 0) {
        mergedGroups = mergeGroupsByName(mergedGroups, [{
          groupName: `${comp.competitionName} - filter ${filter}`,
          teamCount: flat.length,
          teams: flat,
        }]);
      }
    } catch {
      // ignore individual filter failures; we'll use whatever groups were recovered
    }
  }

  if (mergedGroups.length > 0) {
    console.log(
      `[fecapa-categories] ${comp.competitionId} filter-load groups=${mergedGroups.length} filtersTried=${filterValues.length}`
    );
  }

  return mergedGroups;
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
    if (parsed && typeof parsed === "object" && parsed.categories) return parsed;
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
  if (seasonMatch) return seasonMatch[1] === "2025-26";

  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const inferredSeason = `${startYear}-${String(startYear + 1).slice(-2)}`;
  return inferredSeason === "2025-26";
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

async function scrapeCompetitionPhasesLive(page, comp, previousHtml = "") {
  const clickResult = await page.evaluate(() => {
    const btn = document.getElementById("calendario_btn")
      || [...document.querySelectorAll("a,button")].find(el => {
        const txt = String(el.textContent || "").toUpperCase();
        const file = String(el.getAttribute("file") || "").toUpperCase();
        return txt.includes("CALENDARI") || txt.includes("RESULTATS") || file.includes("CAL_IDC_");
      });

    if (!btn) return { ok: false, reason: "missing-calendar-button" };

    if (typeof btn.click === "function") btn.click();
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    if (typeof window.$j === "function") window.$j(btn).trigger("click");
    return { ok: true };
  });

  if (!clickResult?.ok) return [];

  await page.waitForFunction(
    ({ previous }) => {
      const el = document.getElementById("tab_modal_contenido_competicion");
      if (!el) return false;
      const html = el.innerHTML || "";
      if (!html || html === previous) return false;
      return /tabla_standard|div_titulo_fase_idc|jornada|resultat|calendari/i.test(html);
    },
    { timeout: 12000 },
    { previous: previousHtml || "" }
  ).catch(() => {});

  const calendarHtml = await page.evaluate(() => {
    const el = document.getElementById("tab_modal_contenido_competicion");
    return el ? (el.innerHTML || "") : "";
  });

  return parseCalendarByPhaseSidgad(calendarHtml, comp.competitionId);
}

function isBetterCompetitionData(candidate, baseline) {
  const cGroups = candidate?.groupCount || 0;
  const bGroups = baseline?.groupCount || 0;
  if (cGroups !== bGroups) return cGroups > bGroups;

  const cTeams = candidate?.teamCount || 0;
  const bTeams = baseline?.teamCount || 0;
  return cTeams > bTeams;
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

async function scrapeCompetitionFromLeaguePage(comp) {
  const leagueUrl = `${LEAGUE_BASE_URL}${encodeURIComponent(String(comp.competitionId))}`;
  const html = await fetchText(leagueUrl);

  let parsedGroups = parseClassificationByGroupSidgad(html);
  if (!parsedGroups.length) {
    const emptyGroupNames = extractGroupNamesFromSidgadHtml(html);
    if (emptyGroupNames.length > 0) {
      return buildCompetitionFromParsedGroups(
        comp,
        emptyGroupNames.map(groupName => ({ groupName, teamCount: 0, teams: [] }))
      );
    }
  }

  // Some competitions (notably 4452) expose partial classification in /league HTML.
  // Recover full hierarchy by loading the classification endpoint with all filters.
  const recoveredByFilters = await loadGroupedClassificationByFilters(comp, html);
  if (recoveredByFilters.length > parsedGroups.length) {
    console.log(
      `[fecapa-categories] ${comp.competitionId} league filters recovered groups ${parsedGroups.length} -> ${recoveredByFilters.length}`
    );
    parsedGroups = mergeGroupsByName(parsedGroups, recoveredByFilters);
  }

  if (parsedGroups.length > 0) {
    return buildCompetitionFromParsedGroups(comp, parsedGroups);
  }

  const flatRows = parseClassificationSidgad(html);
  if (flatRows.length > 0) {
    return {
      competitionId: comp.competitionId,
      competitionName: comp.competitionName,
      groupCount: 1,
      teamCount: flatRows.length,
      groups: [{
        groupId: buildGroupId(comp.competitionId, comp.competitionName, 1),
        groupName: comp.competitionName,
        teamCount: flatRows.length,
        teams: flatRows,
      }],
      competitionPhases: [],
      hasPostSeasonPhases: false,
    };
  }

  throw new Error(`No classification found at ${leagueUrl}`);
}

async function scrapeCompetitionLive(page, comp) {
  // Clear container so we can detect when new content is actually loaded
  await page.evaluate(() => {
    const el = document.getElementById("tab_modal_contenido_competicion");
    if (el) el.innerHTML = "";
  });

  // Mimic real user flow: first select the category filter (BENJAMI/PREBENJAMI/ALEVI),
  // then open the target competition row.
  const filterMeta = await page.evaluate(({ category, tempId }) => {
    const normalize = (s) => String(s || "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const mapCategory = (c) => {
      const n = normalize(c);
      if (n === "NACIONAL CATALANA") return "NACIONAL CATALANA";
      if (n === "PRIMERA CATALANA") return "PRIMERA CATALANA";
      if (n === "SEGONA CATALANA") return "SEGONA CATALANA";
      if (n === "TERCERA CATALANA") return "TERCERA CATALANA";
      if (n === "FEM") return "FEM";
      if (n === "JUNIOR") return "JUNIOR";
      if (n === "JUVENIL") return "JUVENIL";
      if (n === "INFANTIL") return "INFANTIL";
      if (n === "PREBENJAMI") return "PREBENJAMI";
      if (n === "BENJAMI") return "BENJAMI";
      if (n === "ALEVI") return "ALEVI";
      if (n === "VETERANS") return "VETERANS";
      return "";
    };

    const target = mapCategory(category);
    const rows = [...document.querySelectorAll(`.listado_competiciones_fila.temp_${tempId}`)];
    const visibleBefore = rows.filter(r => {
      const style = window.getComputedStyle(r);
      return style.display !== "none";
    }).length;

    const buttons = [...document.querySelectorAll(".filtro_fecapa")];
    const btn = buttons.find(b => {
      const nome = normalize(b.getAttribute("nome") || "");
      const txt = normalize(b.textContent || "");
      return target && (nome === target || txt.includes(target));
    }) || null;

    if (!target) {
      return {
        clicked: false,
        reason: "unknown-category",
        target,
        visibleBefore,
        visibleAfter: visibleBefore,
        availableFilters: buttons.map(b => normalize(b.getAttribute("nome") || b.textContent || "")).slice(0, 20),
      };
    }

    if (!btn) {
      return {
        clicked: false,
        reason: "filter-not-found",
        target,
        visibleBefore,
        visibleAfter: visibleBefore,
        availableFilters: buttons.map(b => normalize(b.getAttribute("nome") || b.textContent || "")).slice(0, 20),
      };
    }

    if (typeof btn.click === "function") {
      btn.click();
    }
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    if (typeof window.$j === "function") {
      window.$j(btn).trigger("click");
    }

    const visibleAfter = rows.filter(r => {
      const style = window.getComputedStyle(r);
      return style.display !== "none";
    }).length;

    return {
      clicked: true,
      reason: "ok",
      target,
      selectedNome: normalize(btn.getAttribute("nome") || ""),
      visibleBefore,
      visibleAfter,
      availableFilters: [],
    };
  }, { category: comp.category, tempId: TEMP_ID });

  console.log(
    `[fecapa-categories] ${comp.competitionId} category-filter clicked=${filterMeta.clicked} target=${filterMeta.target || "none"} selected=${filterMeta.selectedNome || "none"} reason=${filterMeta.reason} visibleBefore=${filterMeta.visibleBefore} visibleAfter=${filterMeta.visibleAfter}`
  );

  if (!filterMeta.clicked) {
    const available = (filterMeta.availableFilters || []).join(",") || "none";
    console.log(`[fecapa-categories] ${comp.competitionId} category-filter unavailable filters=${available}`);
  }

  await page.waitForFunction(
    ({ tempId }) => {
      const rows = [...document.querySelectorAll(`.listado_competiciones_fila.temp_${tempId}`)];
      const visible = rows.filter(r => window.getComputedStyle(r).display !== "none");
      return visible.length > 0;
    },
    { timeout: 8000 },
    { tempId: TEMP_ID }
  ).catch(() => {});

  const clickedMeta = await page.evaluate(({ id, tempId, competitionName }) => {
    const normalize = (s) => String(s || "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const allRows = [...document.querySelectorAll(".listado_competiciones_fila")];
    const seasonRows = [...document.querySelectorAll(`.listado_competiciones_fila.temp_${tempId}`)];
    const targetId = String(id);

    // 1) Most reliable: visible row id equals competition id.
    let el = document.getElementById(targetId);
    if (el && !el.classList.contains("listado_competiciones_fila")) {
      el = null;
    }
    let strategy = el ? "dom-id" : "";

    // 2) Season-scoped id match.
    if (!el) {
      el = seasonRows.find(row => String(row.id || "") === targetId) || null;
      if (el) strategy = "season-id";
    }

    // 2b) Search across all rows in case temp/category filters hide the target row.
    if (!el) {
      el = allRows.find(row => String(row.id || "") === targetId) || null;
      if (el) strategy = "allrows-id";
    }

    // 3) href fallback.
    if (!el) {
      el = seasonRows.find(row => {
        const href = row.getAttribute("href") || "";
        return href.includes(`/league/${targetId}`);
      }) || null;
      if (el) strategy = "href";
    }

    if (!el) {
      el = allRows.find(row => {
        const href = row.getAttribute("href") || "";
        return href.includes(`/league/${targetId}`);
      }) || null;
      if (el) strategy = "allrows-href";
    }

    // 4) normalized name exact match.
    if (!el) {
      const wanted = normalize(competitionName);
      el = seasonRows.find(row => {
        const rowName = normalize(row.getAttribute("idc_name") || row.getAttribute("name") || row.textContent || "");
        return wanted && rowName === wanted;
      }) || null;
      if (el) strategy = "name-exact";
    }

    if (!el) {
      const wanted = normalize(competitionName);
      el = allRows.find(row => {
        const rowName = normalize(row.getAttribute("idc_name") || row.getAttribute("name") || row.textContent || "");
        return wanted && rowName === wanted;
      }) || null;
      if (el) strategy = "allrows-name-exact";
    }

    // 5) normalized name inclusion fallback.
    if (!el) {
      const wanted = normalize(competitionName);
      el = seasonRows.find(row => {
        const rowName = normalize(row.getAttribute("idc_name") || row.getAttribute("name") || row.textContent || "");
        return wanted && (rowName.includes(wanted) || wanted.includes(rowName));
      }) || null;
      if (el) strategy = "name-includes";
    }

    if (!el) {
      const wanted = normalize(competitionName);
      el = allRows.find(row => {
        const rowName = normalize(row.getAttribute("idc_name") || row.getAttribute("name") || row.textContent || "");
        return wanted && (rowName.includes(wanted) || wanted.includes(rowName));
      }) || null;
      if (el) strategy = "allrows-name-includes";
    }

    if (!el) {
      const sample = seasonRows.slice(0, 8).map(row => ({
        id: row.id || "",
        name: (row.getAttribute("idc_name") || row.getAttribute("name") || "").trim(),
        display: window.getComputedStyle(row).display || "",
      }));
      return {
        clicked: false,
        strategy: "none",
        totalRows: allRows.length,
        seasonRows: seasonRows.length,
        sample,
      };
    }

    const computedDisplay = window.getComputedStyle(el).display || "";
    const wasHidden = computedDisplay === "none";
    if (wasHidden) {
      // Some rows remain hidden after category filter despite being valid targets.
      // Force visibility so portal click handlers can open the competition.
      el.style.display = "inline-block";
    }

    if (typeof el.click === "function") {
      el.click();
    } else {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }
    if (typeof window.$j === "function") {
      window.$j(el).trigger("click");
    }
    return {
      clicked: true,
      strategy,
      selectedId: el.id || "",
      selectedName: (el.getAttribute("idc_name") || el.getAttribute("name") || "").trim(),
      selectedDisplay: el.style?.display || "",
      selectedWasHidden: wasHidden,
      totalRows: allRows.length,
      seasonRows: seasonRows.length,
    };
  }, { id: comp.competitionId, tempId: TEMP_ID, competitionName: comp.competitionName });

  console.log(
    `[fecapa-categories] ${comp.competitionId} open-competition clicked=${clickedMeta.clicked} strategy=${clickedMeta.strategy} selectedId=${clickedMeta.selectedId || "none"} selectedName=${clickedMeta.selectedName || "none"} display=${clickedMeta.selectedDisplay || "n/a"} wasHidden=${clickedMeta.selectedWasHidden ? 1 : 0} rows=${clickedMeta.seasonRows}/${clickedMeta.totalRows}`
  );

  if (!clickedMeta.clicked) {
    const sampleStr = Array.isArray(clickedMeta.sample) && clickedMeta.sample.length
      ? clickedMeta.sample.map(s => `${s.id}:${s.name || "(empty)"}:${s.display || "n/a"}`).join(" | ")
      : "no-sample";
    throw new Error(`Competition ${comp.competitionId} not found on portal | rows=${clickedMeta.seasonRows}/${clickedMeta.totalRows} | sample=${sampleStr}`);
  }

  await page.waitForFunction(
    () => {
      const header = document.getElementById("titulo_competicion_header_text");
      const menu = document.getElementById("menu_idc_options_general");
      return !!(header && (header.textContent || "").trim().length > 0 && menu && menu.querySelector("a"));
    },
    { timeout: 12000 }
  ).catch(() => {});

  let openMeta = await page.evaluate((expectedCompetitionId) => {
    const header = document.getElementById("titulo_competicion_header_text");
    const menu = document.getElementById("menu_idc_options_general");
    const anchors = menu ? [...menu.querySelectorAll("a")].map(a => a.getAttribute("file") || "") : [];
    const menuCompIds = [...new Set(anchors
      .map((file) => {
        const match = String(file || "").match(/(?:clasif_idc_|cal_idc_|des_idc_|portadas_1_)(\d+)/i);
        return match ? String(match[1]) : "";
      })
      .filter(Boolean))];

    return {
      headerText: header ? (header.textContent || "").replace(/\s+/g, " ").trim() : "",
      menuButtons: menu ? menu.querySelectorAll("a").length : 0,
      hasClassBtn: !!document.getElementById("clasificaciones_btn"),
      hasCalendarBtn: !!document.getElementById("calendario_btn"),
      menuCompIds,
      hasExpectedMenuBinding: menuCompIds.includes(String(expectedCompetitionId || "")),
    };
  }, comp.competitionId);

  console.log(
    `[fecapa-categories] ${comp.competitionId} open-competition header=${openMeta.headerText || "none"} menuButtons=${openMeta.menuButtons} hasClassBtn=${openMeta.hasClassBtn} hasCalendarBtn=${openMeta.hasCalendarBtn}`
  );

  if (requiresStrictPortalClassificationClick(comp.competitionId)) {
    console.log(
      `[fecapa-categories] ${comp.competitionId} strict-flow step3-open-league header=${openMeta.headerText || "none"} menuButtons=${openMeta.menuButtons} hasClassBtn=${openMeta.hasClassBtn ? 1 : 0} menuBinding=${openMeta.hasExpectedMenuBinding ? "ok" : "stale"} menuCompIds=${(openMeta.menuCompIds || []).join(",") || "none"}`
    );
  }

  const strictNeedsRebind = requiresStrictPortalClassificationClick(comp.competitionId) && !openMeta.hasExpectedMenuBinding;
  if (!openMeta.hasClassBtn || strictNeedsRebind) {
    // Race-condition guard: some competitions render menu tabs asynchronously.
    // Retry opening the same competition and re-check tabs before failing.
    await page.evaluate((id) => {
      const row = document.getElementById(String(id));
      if (!row) return;
      if (typeof row.click === "function") {
        row.click();
      } else {
        row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }
      if (typeof window.$j === "function") {
        window.$j(row).trigger("click");
      }
    }, comp.competitionId);

    await page.waitForFunction(
      ({ expectedCompetitionId, strictFlow }) => {
        const menu = document.getElementById("menu_idc_options_general");
        const hasClass = !!document.getElementById("clasificaciones_btn");
        const tabs = menu ? menu.querySelectorAll("a").length : 0;
        if (!strictFlow) return hasClass || tabs >= 2;

        const anchors = menu ? [...menu.querySelectorAll("a")].map(a => a.getAttribute("file") || "") : [];
        const menuCompIds = [...new Set(anchors
          .map((file) => {
            const match = String(file || "").match(/(?:clasif_idc_|cal_idc_|des_idc_|portadas_1_)(\d+)/i);
            return match ? String(match[1]) : "";
          })
          .filter(Boolean))];
        const hasExpectedBinding = menuCompIds.includes(String(expectedCompetitionId || ""));

        return (hasClass || tabs >= 2) && hasExpectedBinding;
      },
      { timeout: 6000 }
      ,
      {
        expectedCompetitionId: comp.competitionId,
        strictFlow: requiresStrictPortalClassificationClick(comp.competitionId),
      }
    ).catch(() => {});

    openMeta = await page.evaluate((expectedCompetitionId) => {
      const header = document.getElementById("titulo_competicion_header_text");
      const menu = document.getElementById("menu_idc_options_general");
      const anchors = menu ? [...menu.querySelectorAll("a")].map(a => a.getAttribute("file") || "") : [];
      const menuCompIds = [...new Set(anchors
        .map((file) => {
          const match = String(file || "").match(/(?:clasif_idc_|cal_idc_|des_idc_|portadas_1_)(\d+)/i);
          return match ? String(match[1]) : "";
        })
        .filter(Boolean))];

      return {
        headerText: header ? (header.textContent || "").replace(/\s+/g, " ").trim() : "",
        menuButtons: menu ? menu.querySelectorAll("a").length : 0,
        hasClassBtn: !!document.getElementById("clasificaciones_btn"),
        hasCalendarBtn: !!document.getElementById("calendario_btn"),
        menuCompIds,
        hasExpectedMenuBinding: menuCompIds.includes(String(expectedCompetitionId || "")),
      };
    }, comp.competitionId);

    console.log(
      `[fecapa-categories] ${comp.competitionId} open-competition retry header=${openMeta.headerText || "none"} menuButtons=${openMeta.menuButtons} hasClassBtn=${openMeta.hasClassBtn} hasCalendarBtn=${openMeta.hasCalendarBtn} menuBinding=${openMeta.hasExpectedMenuBinding ? "ok" : "stale"} menuCompIds=${(openMeta.menuCompIds || []).join(",") || "none"}`
    );

    if (requiresStrictPortalClassificationClick(comp.competitionId)) {
      console.log(
        `[fecapa-categories] ${comp.competitionId} strict-flow step3-retry header=${openMeta.headerText || "none"} menuButtons=${openMeta.menuButtons} hasClassBtn=${openMeta.hasClassBtn ? 1 : 0} menuBinding=${openMeta.hasExpectedMenuBinding ? "ok" : "stale"} menuCompIds=${(openMeta.menuCompIds || []).join(",") || "none"}`
      );

      if (!openMeta.hasExpectedMenuBinding) {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          await page.evaluate((id) => {
            const row = document.getElementById(String(id));
            if (!row) return;
            if (typeof row.click === "function") {
              row.click();
            } else {
              row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            }
            if (typeof window.$j === "function") {
              window.$j(row).trigger("click");
            }
          }, comp.competitionId);

          await page.waitForFunction(
            ({ expectedCompetitionId }) => {
              const menu = document.getElementById("menu_idc_options_general");
              const anchors = menu ? [...menu.querySelectorAll("a")].map(a => a.getAttribute("file") || "") : [];
              const menuCompIds = [...new Set(anchors
                .map((file) => {
                  const match = String(file || "").match(/(?:clasif_idc_|cal_idc_|des_idc_|portadas_1_)(\d+)/i);
                  return match ? String(match[1]) : "";
                })
                .filter(Boolean))];
              return menuCompIds.includes(String(expectedCompetitionId || ""));
            },
            { timeout: 2500 },
            { expectedCompetitionId: comp.competitionId }
          ).catch(() => {});

          openMeta = await page.evaluate((expectedCompetitionId) => {
            const header = document.getElementById("titulo_competicion_header_text");
            const menu = document.getElementById("menu_idc_options_general");
            const anchors = menu ? [...menu.querySelectorAll("a")].map(a => a.getAttribute("file") || "") : [];
            const menuCompIds = [...new Set(anchors
              .map((file) => {
                const match = String(file || "").match(/(?:clasif_idc_|cal_idc_|des_idc_|portadas_1_)(\d+)/i);
                return match ? String(match[1]) : "";
              })
              .filter(Boolean))];

            return {
              headerText: header ? (header.textContent || "").replace(/\s+/g, " ").trim() : "",
              menuButtons: menu ? menu.querySelectorAll("a").length : 0,
              hasClassBtn: !!document.getElementById("clasificaciones_btn"),
              hasCalendarBtn: !!document.getElementById("calendario_btn"),
              menuCompIds,
              hasExpectedMenuBinding: menuCompIds.includes(String(expectedCompetitionId || "")),
            };
          }, comp.competitionId);

          console.log(
            `[fecapa-categories] ${comp.competitionId} strict-flow rebind-attempt=${attempt} header=${openMeta.headerText || "none"} menuButtons=${openMeta.menuButtons} hasClassBtn=${openMeta.hasClassBtn ? 1 : 0} menuBinding=${openMeta.hasExpectedMenuBinding ? "ok" : "stale"} menuCompIds=${(openMeta.menuCompIds || []).join(",") || "none"}`
          );

          if (openMeta.hasExpectedMenuBinding) break;
        }
      }

      if (!openMeta.hasClassBtn || !openMeta.hasExpectedMenuBinding) {
        const menuDebug = await page.evaluate(() => {
          const menu = document.getElementById("menu_idc_options_general");
          const anchors = menu ? [...menu.querySelectorAll("a")] : [];
          return anchors.map((anchor, index) => ({
            index,
            id: anchor.id || "",
            cls: anchor.className || "",
            file: anchor.getAttribute("file") || "",
            href: anchor.getAttribute("href") || "",
            text: String(anchor.textContent || "").replace(/\s+/g, " ").trim(),
          }));
        });

        console.log(
          `[fecapa-categories] ${comp.competitionId} strict-flow step3-menu-debug ${JSON.stringify(menuDebug)}`
        );

        if (!openMeta.hasExpectedMenuBinding) {
          throw new Error(`Strict portal flow failed for ${comp.competitionId}: menu bound to different competition ids=${(openMeta.menuCompIds || []).join(",") || "none"}`);
        }
      }
    }
  }

  // Ensure classification content is loaded (Classif.Base equivalent).
  // The portal loads tab content via AJAX, so we need to wait for actual content mutation.
  const beforeClickSnapshot = await page.evaluate(() => {
    const el = document.getElementById("tab_modal_contenido_competicion");
    return el ? el.innerHTML : "";
  });

  const preClickMeta = await page.evaluate(() => {
    const container = document.getElementById("tab_modal_contenido_competicion");
    const btn = document.getElementById("clasificaciones_btn");
    return {
      hasContainer: !!container,
      beforeLen: container ? container.innerHTML.length : 0,
      hasButton: !!btn,
      buttonClass: btn ? (btn.className || "") : "",
      buttonFile: btn ? (btn.getAttribute("file") || "") : "",
      selectedTabId: (() => {
        const selected = document.querySelector(".menu_competicion_btn_selected");
        return selected ? (selected.id || "") : "";
      })(),
    };
  });

  console.log(
    `[fecapa-categories] ${comp.competitionId} pre-click hasContainer=${preClickMeta.hasContainer} len=${preClickMeta.beforeLen} hasBtn=${preClickMeta.hasButton} selectedTab=${preClickMeta.selectedTabId || "none"} btnClass=${preClickMeta.buttonClass || "none"} btnFile=${preClickMeta.buttonFile || "none"}`
  );

  if (requiresStrictPortalClassificationClick(comp.competitionId)) {
    console.log(
      `[fecapa-categories] ${comp.competitionId} strict-flow step4-before-click hasContainer=${preClickMeta.hasContainer ? 1 : 0} hasBtn=${preClickMeta.hasButton ? 1 : 0} selectedTab=${preClickMeta.selectedTabId || "none"} btnFile=${preClickMeta.buttonFile || "none"}`
    );
  }

  const expectedClassFile = `clasif_idc_${comp.competitionId}_1.php`;
  const clickedClassifications = await page.evaluate(async ({ expectedFile, strictFlow }) => {
    const findClassificationsBtn = () => {
      const menu = document.getElementById("menu_idc_options_general");
      const menuButtons = menu
        ? [...menu.querySelectorAll("a, button, [onclick]")]
        : [];

      const strict = menuButtons.find(el => el.id === "clasificaciones_btn")
        || document.getElementById("clasificaciones_btn");
      if (strict) return strict;

      const byExpectedFile = menuButtons.find(el => (el.getAttribute("file") || "") === expectedFile)
        || document.querySelector(`a[file='${expectedFile}'], button[file='${expectedFile}']`);
      if (byExpectedFile) return byExpectedFile;

      if (strictFlow) {
        return null;
      }

      const byClasifFile = [...document.querySelectorAll("a[file*='clasif_idc_'], button[file*='clasif_idc_']")]
        .find(el => (el.getAttribute("file") || "").includes("clasif_idc_"));
      if (byClasifFile) return byClasifFile;

      const byText = [...document.querySelectorAll("a, button")].find(el => {
        const text = String(el.textContent || "").toUpperCase();
        return text.includes("CLASSIFICACI");
      });
      if (byText) return byText;

      // Some competitions expose classification only via onclick/href handlers,
      // without id/file/text markers.
      const byHandler = [...document.querySelectorAll("a, button, [onclick]")].find(el => {
        const onclick = String(el.getAttribute("onclick") || "").toLowerCase();
        const href = String(el.getAttribute("href") || "").toLowerCase();
        return onclick.includes("clasif") || href.includes("clasif");
      });

      return byHandler || null;
    };

    const btn = findClassificationsBtn();
    if (!btn) {
      return {
        ok: false,
        reason: strictFlow ? "missing-button-in-active-menu" : "missing-button",
      };
    }

    const beforeFile = btn.getAttribute("file") || "";
    const filter = btn.getAttribute("filter") || "0";
    let forcedFile = false;

    if (strictFlow && beforeFile && beforeFile !== expectedFile) {
      return {
        ok: false,
        reason: "stale-button-file",
        beforeFile,
        afterFile: beforeFile,
        forcedFile: false,
        filter,
      };
    }

    if (!beforeFile || !beforeFile.includes("clasif_idc_") || beforeFile !== expectedFile) {
      btn.setAttribute("file", expectedFile);
      forcedFile = true;
    }

    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    const afterFile = btn.getAttribute("file") || expectedFile;

    // Force-load expected classification file when stale wiring is detected.
    if (forcedFile && typeof window.$j === "function") {
      const route = (typeof window.ruta_files === "string" && window.ruta_files)
        ? window.ruta_files
        : "https://www.server2.sidgad.es/fecapa";

      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };

        window.$j("#tab_modal_contenido_competicion").load(
          `${route}/cerilh/${afterFile}`,
          { filter },
          () => finish()
        );

        setTimeout(finish, 8000);
      });
    }

    return {
      ok: true,
      beforeFile,
      afterFile,
      forcedFile,
      filter,
    };
  }, {
    expectedFile: expectedClassFile,
    strictFlow: requiresStrictPortalClassificationClick(comp.competitionId),
  });

  if (requiresStrictPortalClassificationClick(comp.competitionId)) {
    console.log(
      `[fecapa-categories] ${comp.competitionId} strict-flow step4-click-result ok=${clickedClassifications?.ok ? 1 : 0} forcedFile=${clickedClassifications?.forcedFile ? 1 : 0} beforeFile=${clickedClassifications?.beforeFile || "none"} afterFile=${clickedClassifications?.afterFile || "none"}`
    );

    if (!clickedClassifications?.ok) {
      throw new Error(`Strict portal flow failed for ${comp.competitionId}: classification button not found`);
    }
    if (clickedClassifications.forcedFile) {
      throw new Error(`Strict portal flow failed for ${comp.competitionId}: classification required forced file wiring`);
    }

    const tabActivation = await page.evaluate(async ({ expectedFile }) => {
      const getSelectedTabId = () => {
        const selected = document.querySelector(".menu_competicion_btn_selected");
        if (selected && selected.id) return selected.id;

        const classBtn = document.getElementById("clasificaciones_btn");
        if (!classBtn) return "";

        const hasActiveClass = classBtn.classList.contains("menu_competicion_btn_selected");
        const ariaSelected = classBtn.getAttribute("aria-selected");
        const dataSelected = classBtn.getAttribute("data-selected");

        if (hasActiveClass || ariaSelected === "true" || dataSelected === "true") {
          return "clasificaciones_btn";
        }

        return "";
      };

      const findBtn = () => {
        const strict = document.getElementById("clasificaciones_btn");
        if (strict) return strict;
        const menu = document.getElementById("menu_idc_options_general");
        if (!menu) return null;
        return menu.querySelector(`a[file='${expectedFile}'], button[file='${expectedFile}']`);
      };

      if (getSelectedTabId() === "clasificaciones_btn") {
        return { ok: true, selectedTab: "clasificaciones_btn", retried: 0 };
      }

      const btn = findBtn();
      if (!btn) {
        return { ok: false, selectedTab: getSelectedTabId(), retried: 0, reason: "missing-classification-button" };
      }

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        btn.focus();
        if (typeof btn.click === "function") {
          btn.click();
        }
        btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        if (typeof window.$j === "function") {
          window.$j(btn).trigger("click");
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        if (getSelectedTabId() === "clasificaciones_btn") {
          return { ok: true, selectedTab: "clasificaciones_btn", retried: attempt };
        }
      }

      return { ok: false, selectedTab: getSelectedTabId(), retried: 5, reason: "selected-tab-not-activated" };
    }, { expectedFile: expectedClassFile });

    console.log(
      `[fecapa-categories] ${comp.competitionId} strict-flow step4-tab-activation ok=${tabActivation?.ok ? 1 : 0} selectedTab=${tabActivation?.selectedTab || "none"} retried=${tabActivation?.retried || 0} reason=${tabActivation?.reason || "none"}`
    );

    if (!tabActivation?.ok) {
      throw new Error(`Strict portal flow failed for ${comp.competitionId}: classification tab not activated (${tabActivation?.reason || "unknown"})`);
    }
  }

  if (!clickedClassifications?.ok) {
    // Robust fallback for cases where the classification tab exists but is not bound
    // to #clasificaciones_btn in the current DOM state.
    const fallbackClassifications = await page.evaluate(async ({ expectedFile }) => {
      const container = document.getElementById("tab_modal_contenido_competicion");
      if (!container) return { ok: false, reason: "missing-container" };

      const route = (typeof window.ruta_files === "string" && window.ruta_files)
        ? window.ruta_files
        : "https://www.server2.sidgad.es/fecapa";

      const looksLikeClassification = (html) => {
        const h = String(html || "");
        return /div_titulo_fase_idc|tabla_standard|stats_table_special|\bPUNTS\b|\bPT\b|classificaci/i.test(h);
      };

      const tryLoadWithJq = async (file, filter = "0") => {
        if (typeof window.$j !== "function") return "";
        return new Promise((resolve) => {
          let done = false;
          const finish = (html) => {
            if (done) return;
            done = true;
            resolve(String(html || ""));
          };

          window.$j("#tab_modal_contenido_competicion").load(
            `${route}/cerilh/${file}`,
            { filter },
            () => finish(container.innerHTML || "")
          );

          setTimeout(() => finish(container.innerHTML || ""), 9000);
        });
      };

      const candidates = [
        expectedFile,
        expectedFile.replace(/_1\.php$/, ".php"),
      ];

      for (const file of candidates) {
        if (!file) continue;
        const html = await tryLoadWithJq(file, "0");
        if (looksLikeClassification(html)) {
          return { ok: true, reason: "forced-load", file };
        }
      }

      return { ok: false, reason: "forced-load-failed" };
    }, { expectedFile: expectedClassFile });

    if (!fallbackClassifications?.ok) {
      // Soft-fail: keep pipeline alive and allow caller-level snapshot fallback
      // without counting this as a hard scrape error for unstable portal tabs.
      console.log(
        `[fecapa-categories] ${comp.competitionId} classification unavailable in live DOM -> soft-fallback=snapshot`
      );
      const phasesOnFallback = await scrapeCompetitionPhasesLive(page, comp, beforeClickSnapshot);
      return attachCompetitionPhases(annotateCompetitionNoMatches({
        competitionId: comp.competitionId,
        competitionName: comp.competitionName,
        groupCount: 1,
        teamCount: 0,
        groups: [{
          groupId: buildGroupId(comp.competitionId, comp.competitionName, 1),
          groupName: comp.competitionName,
          teamCount: 0,
          teams: [],
        }],
      }), phasesOnFallback);
    }

    console.log(
      `[fecapa-categories] ${comp.competitionId} fallback classification-load ok reason=${fallbackClassifications.reason} file=${fallbackClassifications.file || "none"}`
    );
  } else {
    console.log(
      `[fecapa-categories] ${comp.competitionId} clicked clasificaciones_btn forcedFile=${clickedClassifications.forcedFile} fileBefore=${clickedClassifications.beforeFile || "none"} fileAfter=${clickedClassifications.afterFile || "none"} filter=${clickedClassifications.filter || "0"}`
    );
  }

  await page.waitForFunction(
    ({ previousHtml }) => {
      const el = document.getElementById("tab_modal_contenido_competicion");
      if (!el) return false;
      const html = el.innerHTML || "";
      const changed = html.length > 0 && html !== previousHtml;
      const hasGroups = !!el.querySelector(".div_titulo_fase_idc");
      const hasTableRows = !!el.querySelector("table.tabla_standard tr");
      return (changed && (hasGroups || hasTableRows)) || hasGroups || hasTableRows;
    },
    { timeout: 20000 },
    { previousHtml: beforeClickSnapshot }
  ).catch(() => {});

  // Capture the container HTML atomically in the same evaluate as the post-click diagnostics,
  // BEFORE the page's own JS can mutate the tables (which we observed causes cell count = 1).
  const postClickMeta = await page.evaluate(({ previousHtml }) => {
    const container = document.getElementById("tab_modal_contenido_competicion");
    const html = container ? (container.innerHTML || "") : "";
    const groupTitles = container
      ? [...container.querySelectorAll(".div_titulo_fase_idc")]
        .map(el => String(el.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
      : [];
    return {
      afterLen: html.length,
      changed: html.length > 0 && html !== previousHtml,
      groupsCount: container ? container.querySelectorAll(".div_titulo_fase_idc").length : 0,
      tablesCount: container ? container.querySelectorAll("table.tabla_standard").length : 0,
      rowsCount: container ? container.querySelectorAll("table.tabla_standard tr").length : 0,
      firstGroupTitle: groupTitles[0] || "",
      groupTitlesSample: groupTitles.slice(0, 6),
      // Snapshot the full HTML right now, before any further DOM mutation.
      containerHtml: html,
      selectedTabId: (() => {
        const selected = document.querySelector(".menu_competicion_btn_selected");
        return selected ? (selected.id || "") : "";
      })(),
    };
  }, { previousHtml: beforeClickSnapshot });

  const domLeagueBlocks = await page.evaluate(() => {
    const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
    const root = document.getElementById("tab_modal_contenido_competicion");
    if (!root) return [];

    const containers = [...root.querySelectorAll(".leagueContainer")];
    if (!containers.length) return [];

    return containers.map((container, idx) => {
      const id = String(container.id || "");
      let groupName = "";

      const idMatch = id.match(/^league_(.+)$/);
      if (idMatch) {
        const btn = document.getElementById(`${idMatch[1]}_button`);
        if (btn) groupName = clean(btn.textContent || "");
      }

      if (!groupName) {
        const byOrder = root.querySelectorAll(".leagueButton")[idx];
        if (byOrder) groupName = clean(byOrder.textContent || "");
      }

      if (!groupName) {
        const title = container.querySelector("h1,h2,h3,h4,.font-bold,.title");
        if (title) groupName = clean(title.textContent || "");
      }

      return {
        groupName: groupName || `Grup ${idx + 1}`,
        html: container.innerHTML || "",
      };
    });
  });

  console.log(
    `[fecapa-categories] ${comp.competitionId} post-click changed=${postClickMeta.changed} len=${postClickMeta.afterLen} groups=${postClickMeta.groupsCount} tables=${postClickMeta.tablesCount} rows=${postClickMeta.rowsCount} selectedTab=${postClickMeta.selectedTabId || "none"} firstGroup=${postClickMeta.firstGroupTitle || "none"} sampleGroups=${(postClickMeta.groupTitlesSample || []).join(" | ") || "none"}`
  );

  // Use the HTML snapshot captured right at post-click time (DOM-stable).
  const containerHtml = postClickMeta.containerHtml || "";

  // Regex parser on the stable HTML snapshot.
  const parsedGroupsFromHtml = parseClassificationByGroupSidgad(containerHtml).map((g, idx) => ({
    groupId: buildGroupId(comp.competitionId, normalizeGroupNameForCompetition(comp.competitionName, g.groupName, idx), idx + 1),
    groupName: normalizeGroupNameForCompetition(comp.competitionName, g.groupName, idx),
    teamCount: g.teamCount,
    teams: g.teams,
  }));

  const parsedGroupsFromLeagueContainers = (domLeagueBlocks || []).map((block, idx) => {
    const rows = parseClassificationSidgad(block.html || "");
    const normalizedBlockName = normalizeGroupNameForCompetition(comp.competitionName, block.groupName, idx);
    return {
      groupId: buildGroupId(comp.competitionId, normalizedBlockName, idx + 1),
      groupName: normalizedBlockName,
      teamCount: rows.length,
      teams: rows,
    };
  });

  const parsedGroups = parsedGroupsFromLeagueContainers.length > parsedGroupsFromHtml.length
    ? parsedGroupsFromLeagueContainers
    : parsedGroupsFromHtml;

  const selectedGroupNames = parsedGroups.map(g => g.groupName).slice(0, 8).join(" | ");

  console.log(
    `[fecapa-categories] ${comp.competitionId} parsed groups html=${parsedGroupsFromHtml.length} leagueContainers=${parsedGroupsFromLeagueContainers.length} selected=${parsedGroups.length} names=${selectedGroupNames || "none"}`
  );

  const fallbackRows = parsedGroups.length ? [] : parseClassificationSidgad(containerHtml);

  const groupsOut = parsedGroups.length
    ? parsedGroups
    : (fallbackRows.length ? [{
      groupId: buildGroupId(comp.competitionId, comp.competitionName, 1),
      groupName: comp.competitionName,
      teamCount: fallbackRows.length,
      teams: fallbackRows,
    }] : []);

  const normalizedGroupsOut = groupsOut.length > 0
    ? groupsOut
    : [{
      groupId: buildGroupId(comp.competitionId, comp.competitionName, 1),
      groupName: comp.competitionName,
      teamCount: 0,
      teams: [],
    }];

  const parsedPhases = await scrapeCompetitionPhasesLive(page, comp, containerHtml);
  return attachCompetitionPhases(annotateCompetitionNoMatches({
    competitionId: comp.competitionId,
    competitionName: comp.competitionName,
    groupCount: normalizedGroupsOut.length,
    teamCount: normalizedGroupsOut.reduce((acc, g) => acc + g.teamCount, 0),
    groups: normalizedGroupsOut,
  }), parsedPhases);
}

// ── Core function: obtenir dades de categories ───────────────
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

        const page = await browser.newPage();
        await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

        for (const comp of selected) {
          try {
            const liveComp = await withTimeout(
              scrapeCompetitionLive(page, comp),
              competitionTimeoutMs,
              `live-${comp.competitionId}`
            );
            let bestComp = liveComp;

            try {
              const leagueComp = await withTimeout(
                scrapeCompetitionFromLeaguePage(comp),
                Math.min(competitionTimeoutMs, 30000),
                `league-${comp.competitionId}`
              );

              if (!bestComp || isBetterCompetitionData(leagueComp, bestComp)) {
                if ((bestComp?.groupCount || 0) > 0) {
                  console.log(
                    `[fecapa-categories] ${comp.competitionId} league preferred over live (${bestComp.groupCount} -> ${leagueComp.groupCount} groups)`
                  );
                } else {
                  console.log(
                    `[fecapa-categories] ${comp.competitionId} recovered via league fallback (${leagueComp.groupCount} groups)`
                  );
                }
                bestComp = leagueComp;
              }
            } catch {
              // League comparison is best-effort; keep live result if available.
            }

            if (bestComp && bestComp.groupCount > 0) {
              liveById.set(String(comp.competitionId), bestComp);
              liveUsed = true;
              continue;
            }
          } catch (err) {
            try {
              const leagueComp = await withTimeout(
                scrapeCompetitionFromLeaguePage(comp),
                Math.min(competitionTimeoutMs, 30000),
                `league-after-live-fail-${comp.competitionId}`
              );
              if (leagueComp && leagueComp.groupCount > 0) {
                liveById.set(String(comp.competitionId), leagueComp);
                liveUsed = true;
                console.log(
                  `[fecapa-categories] ${comp.competitionId} recovered via league fallback after live error (${leagueComp.groupCount} groups)`
                );
                continue;
              }
            } catch (leagueErr) {
              errors.push({
                competitionId: comp.competitionId,
                competitionName: comp.competitionName,
                error: `Live scrape failed: ${err.message} | League fallback failed: ${leagueErr.message}`,
              });
              continue;
            }

            errors.push({
              competitionId: comp.competitionId,
              competitionName: comp.competitionName,
              error: `Live scrape failed: ${err.message}`,
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
      source: liveUsed ? "league_page+fecapa_live" : "sidgad_snapshot",
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
