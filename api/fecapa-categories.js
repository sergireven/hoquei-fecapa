const fs = require("fs").promises;
const path = require("path");
const https = require("https");
const http = require("http");
const puppeteer = require("puppeteer");

const LEAGUE_BASE_URL = "https://www.hoqueipatins.fecapa.cat/league/";
const PORTAL_URL = "https://www.hoqueipatins.fecapa.cat/";
const TEMP_ID = "39"; // temporada 2025-26
const COMP_FILE = path.join(__dirname, "../public/competicions-sidgad.json");
const CATEGORIES_FILE = path.join(__dirname, "../public/fecapa-categories.json");
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
  const blockRe = /<div[^>]*class=['"]?[^'"]*div_titulo_fase_idc[^'"]*['"]?[^>]*>([\s\S]*?)<\/div>[\s\S]*?<table[^>]*class=['"]?[^'"]*tabla_standard[^'"]*['"]?[^>]*>([\s\S]*?)<\/table>/gi;
  let match;
  let idx = 0;

  while ((match = blockRe.exec(html)) !== null) {
    const groupName = normalizeText(match[1]);
    const tableHtml = match[0].includes("<table") ? `<table>${match[2]}</table>` : match[2];
    const parsedRows = parseClassificationSidgad(`<table>${match[2]}</table>`);
    if (!parsedRows.length) continue;
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
    if (parsed && typeof parsed === "object" && parsed.categories) return parsed;
  } catch {
    // Cache file absent or invalid; fall through to live/snapshot generation.
  }
  return null;
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

function buildGroupId(competitionId, groupName, fallbackOrder) {
  const n = normalizeToken(groupName);
  const tierMatch = n.match(/\b(OR|PLATA|BRONZE|INICIACIO|PREFERENT|GOLD|SILVER)\b/);
  const numberMatches = [...n.matchAll(/\b(\d{1,2})\b/g)];
  const lastNumber = numberMatches.length ? numberMatches[numberMatches.length - 1][1] : String(fallbackOrder || 1);
  const tier = tierMatch ? tierMatch[1] : "GRUP";
  return `${competitionId}-${tier}-${lastNumber}`;
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

function buildCompetitionFromSnapshot(compMeta, compRaw) {
  const byGroup = compRaw?.classificationByGroup || {};
  const byGroupName = compRaw?.classificationByGroupName || {};
  let groups = [];

  if (Object.keys(byGroupName).length) {
    groups = Object.entries(byGroupName).map(([groupName, rows], idx) => {
      const teams = (rows || []).map(mapRowFromSnapshot).filter(r => r.teamName);
      return {
        groupId: buildGroupId(compMeta.competitionId, groupName, idx + 1),
        groupName: String(groupName || `Grup ${idx + 1}`),
        teamCount: teams.length,
        teams,
      };
    }).filter(g => g.teamCount > 0);
  } else if (Object.keys(byGroup).length) {
    groups = Object.entries(byGroup).map(([groupKey, rows], idx) => {
      const groupName = String(groupKey || `Grup ${idx + 1}`);
      const teams = (rows || []).map(mapRowFromSnapshot).filter(r => r.teamName);
      return {
        groupId: buildGroupId(compMeta.competitionId, groupName, idx + 1),
        groupName,
        teamCount: teams.length,
        teams,
      };
    }).filter(g => g.teamCount > 0);
  }

  if (!groups.length) {
    const rawFlat = compRaw?.classification || [];
    const split = splitFlatClassificationIntoGroups(rawFlat);
    const hierarchyNames = Array.isArray(compRaw?.hierarchy?.groups)
      ? compRaw.hierarchy.groups.map(g => String(g?.name || "").trim()).filter(Boolean)
      : [];

    groups = split.map((chunk, idx) => {
      const teams = chunk.map(mapRowFromSnapshot).filter(r => r.teamName);
      const fallbackName = split.length > 1
        ? `${compMeta.competitionName} - Grup ${idx + 1}`
        : compMeta.competitionName;
      const groupName = hierarchyNames[idx] || fallbackName;
      return {
        groupId: buildGroupId(compMeta.competitionId, groupName, idx + 1),
        groupName,
        teamCount: teams.length,
        teams,
      };
    }).filter(g => g.teamCount > 0);
  }

  return {
    competitionId: compMeta.competitionId,
    competitionName: compMeta.competitionName,
    groupCount: groups.length,
    teamCount: groups.reduce((acc, g) => acc + g.teamCount, 0),
    groups,
  };
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
    groupId: buildGroupId(comp.competitionId, g.groupName, idx + 1),
    groupName: g.groupName,
    teamCount: g.teamCount || (g.teams || []).length,
    teams: g.teams || [],
  })).filter(g => g.teamCount > 0);

  return {
    competitionId: comp.competitionId,
    competitionName: comp.competitionName,
    groupCount: groupsOut.length,
    teamCount: groupsOut.reduce((acc, g) => acc + g.teamCount, 0),
    groups: groupsOut,
  };
}

async function scrapeCompetitionFromLeaguePage(comp) {
  const leagueUrl = `${LEAGUE_BASE_URL}${encodeURIComponent(String(comp.competitionId))}`;
  const html = await fetchText(leagueUrl);

  const parsedGroups = parseClassificationByGroupSidgad(html);
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

    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

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
    if (el && window.getComputedStyle(el).display === "none") {
      el = null;
    }
    let strategy = el ? "dom-id" : "";

    // 2) Season-scoped id match.
    if (!el) {
      el = seasonRows.find(row => String(row.id || "") === targetId && window.getComputedStyle(row).display !== "none") || null;
      if (el) strategy = "season-id";
    }

    // 3) href fallback.
    if (!el) {
      el = seasonRows.find(row => {
        if (window.getComputedStyle(row).display === "none") return false;
        const href = row.getAttribute("href") || "";
        return href.includes(`/league/${targetId}`);
      }) || null;
      if (el) strategy = "href";
    }

    // 4) normalized name exact match.
    if (!el) {
      const wanted = normalize(competitionName);
      el = seasonRows.find(row => {
        if (window.getComputedStyle(row).display === "none") return false;
        const rowName = normalize(row.getAttribute("idc_name") || row.getAttribute("name") || row.textContent || "");
        return wanted && rowName === wanted;
      }) || null;
      if (el) strategy = "name-exact";
    }

    // 5) normalized name inclusion fallback.
    if (!el) {
      const wanted = normalize(competitionName);
      el = seasonRows.find(row => {
        if (window.getComputedStyle(row).display === "none") return false;
        const rowName = normalize(row.getAttribute("idc_name") || row.getAttribute("name") || row.textContent || "");
        return wanted && (rowName.includes(wanted) || wanted.includes(rowName));
      }) || null;
      if (el) strategy = "name-includes";
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

    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return {
      clicked: true,
      strategy,
      selectedId: el.id || "",
      selectedName: (el.getAttribute("idc_name") || el.getAttribute("name") || "").trim(),
      selectedDisplay: el.style?.display || "",
      totalRows: allRows.length,
      seasonRows: seasonRows.length,
    };
  }, { id: comp.competitionId, tempId: TEMP_ID, competitionName: comp.competitionName });

  console.log(
    `[fecapa-categories] ${comp.competitionId} open-competition clicked=${clickedMeta.clicked} strategy=${clickedMeta.strategy} selectedId=${clickedMeta.selectedId || "none"} selectedName=${clickedMeta.selectedName || "none"} display=${clickedMeta.selectedDisplay || "n/a"} rows=${clickedMeta.seasonRows}/${clickedMeta.totalRows}`
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

  const openMeta = await page.evaluate(() => {
    const header = document.getElementById("titulo_competicion_header_text");
    const menu = document.getElementById("menu_idc_options_general");
    return {
      headerText: header ? (header.textContent || "").replace(/\s+/g, " ").trim() : "",
      menuButtons: menu ? menu.querySelectorAll("a").length : 0,
      hasClassBtn: !!document.getElementById("clasificaciones_btn"),
      hasCalendarBtn: !!document.getElementById("calendario_btn"),
    };
  });

  console.log(
    `[fecapa-categories] ${comp.competitionId} open-competition header=${openMeta.headerText || "none"} menuButtons=${openMeta.menuButtons} hasClassBtn=${openMeta.hasClassBtn} hasCalendarBtn=${openMeta.hasCalendarBtn}`
  );

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

  const expectedClassFile = `clasif_idc_${comp.competitionId}_1.php`;
  const clickedClassifications = await page.evaluate(async ({ expectedFile }) => {
    const btn = document.getElementById("clasificaciones_btn");
    if (!btn) return { ok: false, reason: "missing-button" };

    const beforeFile = btn.getAttribute("file") || "";
    const filter = btn.getAttribute("filter") || "0";
    let forcedFile = false;

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
  }, { expectedFile: expectedClassFile });

  if (!clickedClassifications?.ok) {
    throw new Error(`Competition ${comp.competitionId}: missing clasificaciones_btn`);
  }

  console.log(
    `[fecapa-categories] ${comp.competitionId} clicked clasificaciones_btn forcedFile=${clickedClassifications.forcedFile} fileBefore=${clickedClassifications.beforeFile || "none"} fileAfter=${clickedClassifications.afterFile || "none"} filter=${clickedClassifications.filter || "0"}`
  );

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

  console.log(
    `[fecapa-categories] ${comp.competitionId} post-click changed=${postClickMeta.changed} len=${postClickMeta.afterLen} groups=${postClickMeta.groupsCount} tables=${postClickMeta.tablesCount} rows=${postClickMeta.rowsCount} selectedTab=${postClickMeta.selectedTabId || "none"} firstGroup=${postClickMeta.firstGroupTitle || "none"} sampleGroups=${(postClickMeta.groupTitlesSample || []).join(" | ") || "none"}`
  );

  // Use the HTML snapshot captured right at post-click time (DOM-stable).
  const containerHtml = postClickMeta.containerHtml || "";

  // Regex parser on the stable HTML snapshot.
  const parsedGroupsFromHtml = parseClassificationByGroupSidgad(containerHtml).map((g, idx) => ({
    groupId: buildGroupId(comp.competitionId, g.groupName, idx + 1),
    groupName: g.groupName,
    teamCount: g.teamCount,
    teams: g.teams,
  })).filter(g => g.teamCount > 0);

  const parsedGroups = parsedGroupsFromHtml;

  const selectedGroupNames = parsedGroups.map(g => g.groupName).slice(0, 8).join(" | ");

  console.log(
    `[fecapa-categories] ${comp.competitionId} parsed groups html=${parsedGroupsFromHtml.length} selected=${parsedGroups.length} names=${selectedGroupNames || "none"}`
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

  return {
    competitionId: comp.competitionId,
    competitionName: comp.competitionName,
    groupCount: groupsOut.length,
    teamCount: groupsOut.reduce((acc, g) => acc + g.teamCount, 0),
    groups: groupsOut,
  };
}

// ── Core function: obtenir dades de categories ───────────────
async function getCategoriesData(options = {}) {
  const { liveMode = false, useCache = true, categoriesFilter = null, competitionTimeoutMs = 45000 } = options;

  const now = Date.now();
  if (useCache && !liveMode && memoryCache && (now - memoryCacheAt) < CACHE_TTL_MS) {
    return memoryCache;
  }

  if (useCache && !liveMode) {
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
    const selected = selectTargetCompetitions(compIndex, effectiveCategories);

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

    // Base robusta: snapshot pre-scrapejat (sense dependència de xarxa en runtime)
    const snapshotBuilt = selected.map(comp => {
      const rawComp = compIndex?.[comp.competitionId] || {};
      return buildCompetitionFromSnapshot(comp, rawComp);
    });

    // Enriquiment live opcional (no bloquejant): només si liveMode=true
    let finalBuilt = snapshotBuilt;
    if (liveMode) {
      console.log(`[fecapa-categories] Live mode ON | categories=${Array.from(effectiveCategories).join(",")} | competitions=${selected.length}`);

      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });

      try {
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
        await page.goto(PORTAL_URL, { waitUntil: "networkidle0", timeout: 60000 });
        await page.waitForSelector(".listado_competiciones_fila", { timeout: 20000 });

        const liveBuilt = [];
        for (let i = 0; i < selected.length; i += 1) {
          const comp = selected[i];
          const progress = `[${i + 1}/${selected.length}]`;
          try {
            console.log(`[fecapa-categories] ${progress} ${comp.competitionId} | ${comp.competitionName} | try=portal`);

            const live = await withTimeout(
              scrapeCompetitionLive(page, comp),
              competitionTimeoutMs,
              `portal/${comp.competitionId}`
            );

            if (live.groupCount > 0 && live.teamCount > 0) {
              console.log(`[fecapa-categories] ${progress} ${comp.competitionId} ok source=portal groups=${live.groupCount} teams=${live.teamCount}`);
              liveBuilt.push(live);
            } else {
              console.log(`[fecapa-categories] ${progress} ${comp.competitionId} empty live -> fallback=snapshot`);
              liveBuilt.push(snapshotBuilt[liveBuilt.length]);
            }
          } catch (err) {
            console.log(`[fecapa-categories] ${progress} ${comp.competitionId} failed -> fallback=snapshot | ${err.message || "unknown"}`);
            errors.push({
              competitionId: comp.competitionId,
              competitionName: comp.competitionName,
              error: err.message || "unknown",
            });
            liveBuilt.push(snapshotBuilt[liveBuilt.length]);
          }
        }
        finalBuilt = liveBuilt;
      } finally {
        await browser.close();
      }
    }

    finalBuilt.forEach((item, idx) => {
      const categoryKey = selected[idx]?.category;
      if (!categoryKey) return;
      categories[categoryKey].push(item);
    });

    const out = {
      ok: true,
      source: liveMode ? "sidgad_snapshot+fecapa_live" : "sidgad_snapshot",
      fetchedAt: new Date().toISOString(),
      liveMode,
      categoriesFilter: Array.from(effectiveCategories.values()),
      fetchedCompetitions: selected.length,
      failedCompetitions: errors.length,
      errors,
      categories,
    };

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
    const liveMode = query.get("live") === "1";
    const categoriesFilter = query.getAll("category").map(v => String(v || "").trim()).filter(Boolean);
    const data = await getCategoriesData({ liveMode, categoriesFilter });
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
