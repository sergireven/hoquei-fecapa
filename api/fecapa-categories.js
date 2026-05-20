const fs = require("fs").promises;
const path = require("path");
const https = require("https");
const http = require("http");

const LEAGUE_BASE_URL = "https://www.hoqueipatins.fecapa.cat/league/";
const COMP_FILE = path.join(__dirname, "../public/competicions-sidgad.json");
const TARGET_CATEGORIES = new Set(["PREBENJAMI", "BENJAMI", "ALEVI"]);
const REQUEST_TIMEOUT_MS = 20000;
const MAX_CONCURRENCY = 6;

let memoryCache = null;
let memoryCacheAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

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
  if (n.includes("PREBENJAMI")) return "prebenjami";
  if (n.includes("BENJAMI")) return "benjami";
  if (n.includes("ALEVI")) return "alevi";
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
    if (nums.length < 3) continue;

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

  const groups = [];
  const titles = [...html.matchAll(/<div[^>]*class=['"]?[^'"]*div_titulo_fase_idc[^'"]*['"]?[^>]*>([\s\S]*?)<\/div>/gi)]
    .map(m => normalizeText(m[1]))
    .filter(Boolean);

  const tables = html.match(/<table[^>]*class=['"]?[^'"]*tabla_standard[^'"]*['"]?[^>]*>[\s\S]*?<\/table>/gi)
    || html.match(/<table[^>]*>[\s\S]*?<\/table>/gi)
    || [];

  for (let i = 0; i < tables.length; i += 1) {
    const parsedRows = parseClassificationSidgad(tables[i]);
    if (!parsedRows.length) continue;
    groups.push({
      groupName: titles[i] || `Grup ${i + 1}`,
      teamCount: parsedRows.length,
      teams: parsedRows,
    });
  }

  return groups;
}

function fetchText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ca,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity",
      },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (redirectsLeft <= 0) return reject(new Error("Too many redirects"));
        const next = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).href;
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
  const raw = await fs.readFile(COMP_FILE, "utf8");
  return JSON.parse(raw);
}

function normalizeCategory(cat) {
  return normName(cat || "");
}

function selectTargetCompetitions(compIndex) {
  const selected = [];
  for (const [competitionId, comp] of Object.entries(compIndex || {})) {
    const category = normalizeCategory(comp?.category);
    if (!TARGET_CATEGORIES.has(category)) continue;
    selected.push({
      competitionId,
      competitionName: String(comp?.name || "").trim() || `Competició ${competitionId}`,
      category: inferBaseCategory(category),
    });
  }
  return selected;
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

async function scrapeCompetitionLive(comp) {
  const url = `${LEAGUE_BASE_URL}${comp.competitionId}`;
  const html = await fetchText(url);
  const grouped = parseClassificationByGroupSidgad(html);
  const fallbackRows = grouped.length ? [] : parseClassificationSidgad(html);
  const groups = grouped.length
    ? grouped
    : (fallbackRows.length ? [{ groupName: comp.competitionName, teamCount: fallbackRows.length, teams: fallbackRows }] : []);

  return {
    competitionId: comp.competitionId,
    competitionName: comp.competitionName,
    groupCount: groups.length,
    teamCount: groups.reduce((acc, g) => acc + g.teamCount, 0),
    groups,
  };
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const now = Date.now();
    if (memoryCache && (now - memoryCacheAt) < CACHE_TTL_MS) {
      return res.status(200).json(memoryCache);
    }

    const compIndex = await loadCompIndex();
    const selected = selectTargetCompetitions(compIndex);

    const categories = {
      prebenjami: [],
      benjami: [],
      alevi: [],
    };

    const errors = [];

    const scraped = await mapWithConcurrency(selected, MAX_CONCURRENCY, async comp => {
      try {
        return await scrapeCompetitionLive(comp);
      } catch (err) {
        errors.push({
          competitionId: comp.competitionId,
          competitionName: comp.competitionName,
          error: err.message || "unknown",
        });
        return {
          competitionId: comp.competitionId,
          competitionName: comp.competitionName,
          groupCount: 0,
          teamCount: 0,
          groups: [],
        };
      }
    });

    scraped.forEach((item, idx) => {
      const categoryKey = selected[idx].category;
      if (!categoryKey) continue;
      categories[categoryKey].push(item);
    });

    const out = {
      ok: true,
      source: "fecapa_live_scraper",
      fetchedAt: new Date().toISOString(),
      fetchedCompetitions: selected.length,
      failedCompetitions: errors.length,
      errors,
      categories,
    };

    memoryCache = out;
    memoryCacheAt = Date.now();

    return res.status(200).json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "Unknown error" });
  }
};
