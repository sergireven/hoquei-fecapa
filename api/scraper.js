// ============================================================
// FECAPA Hockey Scraper v5
// Parseja HTML real de jok.cat (Laravel + Vue SSR)
// ============================================================

const fs    = require("fs").promises;
const path  = require("path");
const https = require("https");
const http  = require("http");

const BASE      = "https://jok.cat";
const DATA_FILE = path.join(__dirname, "../public/data.json");
const DELAY_MS  = 0;
const sleep     = ms => new Promise(r => setTimeout(r, ms));
const ACTA_CONCURRENCY   = 4;
const ACTA_PREVIEW_LIMIT = 4000;
const ACTA_FORCE_RELOAD  = false;

// ── HTTP fetch robust ─────────────────────────────────────────
function fetchText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ca,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity",
      }
    }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        if (redirectsLeft <= 0) return reject(new Error("Too many redirects"));
        const next = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return resolve(fetchText(next, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} → ${url}`));
      res.setEncoding("utf8");
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

// ── Strip HTML tags ───────────────────────────────────────────
const strip = s => s
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
  .replace(/&nbsp;/g," ").replace(/&#\d+;/g,"").replace(/&[a-z]+;/g,"")
  .replace(/\s+/g," ").trim();

// ── Parse competition list from HTML ─────────────────────────
// Structure: <div class="season-section" data-season="2025-26">
//   <div class="category-section" data-category="Prebenjami">
//     <a href="/competicio/4301/bcn-prebenjami-or-1-2025-26">BCN PREBENJAMI OR 1 (2025-26)</a>
function parseCompetitionList(html) {
  const comps = [];
  const seen  = new Set();

  // Extract only the 2025-26 season block using indexOf (more reliable than regex on large HTML)
  const seasonStart = html.indexOf('data-season="2025-26"');
  const seasonEnd   = html.indexOf('data-season="2024-25"'); // next season = end of block
  const block = seasonStart !== -1
    ? html.slice(seasonStart, seasonEnd !== -1 ? seasonEnd : html.length)
    : html; // fallback to full html

  // Find all competition links (works with both relative and absolute URLs)
  // <a href="https://jok.cat/competicio/4301/slug" ...> or <a href="/competicio/4301/slug">
  const linkRe = /href="[^"]*\/competicio\/(\d+)\/([^"?#\s]+)"[^>]*>\s*([^<\n]+?)\s*</gi;
  let m;
  while ((m = linkRe.exec(block)) !== null) {
    const id   = m[1];
    const slug = m[2].split("?")[0];
    const name = strip(m[3]);
    if (seen.has(id) || !name || name.length < 3) continue;
    seen.add(id);
    comps.push({ id, slug, name });
  }

  return comps;
}

// ── Parse classification from competition page HTML ───────────
// Real jok.cat HTML structure per row (Tailwind divs, NOT a table):
//   <div class='w-1/12 ...'>POS</div>
//   <div class='classCol-team ...'><a href="/equip/ID/NAME">Team</a></div>
//   <div class='... bg-neutral-700 ...'>PTS</div>       ← dark bg = points
//   <div class='... classCol-extra hidden ... bg-neutral-200'>PJ</div>  ← hidden
//   <div class='w-1/12 ...'>G</div>
//   <div class='w-1/12 ...'>E</div>
//   <div class='w-1/12 ...'>Pe</div>
//   <div class='... classCol-extra hidden'>GF</div>     ← hidden
//   <div class='... classCol-extra hidden'>GC</div>     ← hidden
//   <div class='classCol-form ... classCol-extra hidden'>FORM</div>  ← spans with titles
function parseClassification(html) {
  const rows = [];

  // Isolate just the classification section
  const blockStart = html.indexOf('classCol-team');
  if (blockStart === -1) return rows;
  const blockEnd = html.indexOf('Equip m\u00E9s golejador');
  const section  = blockEnd !== -1 ? html.slice(0, blockEnd) : html;

  // Each row starts with a flex div containing a w-1/12 position cell
  // Strategy: split by row boundaries using the outer row div
  // Each row = <div class='bg-white w-full ... flex'>...</div>
  const rowRe = /<div\s+class='bg-white\s+w-full[^']*flex'>([\s\S]*?)<\/div>\s*(?=<div\s+class='bg-white|<div\s+class="mt-2|$)/g;
  let m;
  while ((m = rowRe.exec(section)) !== null) {
    const row = m[1];

    // Position: first w-1/12 div with a 1-2 digit number
    const posM = row.match(/class='[^']*w-1\/12[^']*'[^>]*>\s*(\d{1,2})\s*<\/div>/);
    if (!posM) continue;
    const pos = parseInt(posM[1]);

    // Team: classCol-team div with equip link
    const teamM = row.match(/class='[^']*classCol-team[^']*'[^>]*>[\s\S]*?href="\/equip\/(\d+)\/[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/);
    if (!teamM) continue;
    const teamId = teamM[1];
    const team   = teamM[2].trim().replace(/\s+/g, ' ');

    // Club ID from img near the team (may not be present in all rows)
    const clubM  = row.match(/logos_clubes\/([^"'\s>]+)/);
    const clubId = clubM ? clubM[1].split("?")[0] : null;

    // PTS: bg-neutral-700 div (the highlighted points cell)
    const ptsM = row.match(/class='[^']*bg-neutral-700[^']*'[^>]*>\s*(\d+)\s*<\/div>/);
    const pts  = ptsM ? parseInt(ptsM[1]) : 0;

    // PJ: classCol-extra hidden bg-neutral-200 div
    const pjM = row.match(/class='[^']*classCol-extra\s+hidden[^']*bg-neutral-200[^']*'[^>]*>\s*(\d+)\s*<\/div>/);
    const pj  = pjM ? parseInt(pjM[1]) : 0;

    // G, E, Pe: the three w-1/12 divs that are NOT classCol-extra and NOT bg-neutral-700
    // They appear after the classCol-extra PJ div
    // Strategy: find all plain w-1/12 divs with single numbers after the team link
    const afterTeam = row.slice(row.indexOf(team) + team.length);
    const plainDivNums = [];
    const plainRe = /<div\s+class='p-2 md:p-4 w-1\/12 border-r-\[1px\] text-center text-xs md:text-sm'>\s*(\d+)\s*<\/div>/g;
    let pm;
    while ((pm = plainRe.exec(afterTeam)) !== null) {
      plainDivNums.push(parseInt(pm[1]));
    }
    const pg = plainDivNums[0] ?? 0;
    const pe = plainDivNums[1] ?? 0;
    const pp = plainDivNums[2] ?? 0;

    // GF, GC: the two classCol-extra hidden divs WITHOUT bg-neutral-200
    const gfgcRe = /class='[^']*classCol-extra\s+hidden(?!\s*[^']*bg-neutral-200)[^']*'[^>]*>\s*(\d+)\s*<\/div>/g;
    const gfgcNums = [];
    let gm;
    while ((gm = gfgcRe.exec(afterTeam)) !== null && gfgcNums.length < 2) {
      gfgcNums.push(parseInt(gm[1]));
    }
    const gf = gfgcNums[0] ?? 0;
    const gc = gfgcNums[1] ?? 0;

    rows.push({ pos, teamId, team, clubId, pts, pj, pg, pe, pp, gf, gc });
  }

  return rows;
}

// ── Parse calendar from competition page HTML ─────────────────
// Each match block:
// <div class="match-row"> or similar containing:
//   team-home link, date, score, team-away link
function parseCalendar(html) {
  const matches = [];
  const seen    = new Set();

  // Try embedded JSON
  const jsonRe = /"partits"\s*:\s*(\[[\s\S]*?\])\s*[,}]/;
  const jsonM  = jsonRe.exec(html);
  if (jsonM) {
    try {
      const data = JSON.parse(jsonM[1]);
      return data.map(p => ({
        jornada:   p.jornada   || null,
        home:      p.local     || p.home  || "",
        away:      p.visitant  || p.away  || "",
        homeScore: p.gols_local    != null ? parseInt(p.gols_local)    : undefined,
        awayScore: p.gols_visitant != null ? parseInt(p.gols_visitant) : undefined,
        date:      p.data      || p.date  || "",
        time:      p.hora      || p.time  || "",
        played:    p.jugat     != null ? !!p.jugat : (p.gols_local != null),
      }));
    } catch {}
  }

  // HTML parsing: find match blocks
  // Pattern: two equip links close together with a score between them
  // [Jornada N] ... [Local](url) ... DD-MM ... G-G ... [Visitant](url)
  
  // Split by jornada markers
  const jornades = html.split(/Jornada\s+(\d+)/i);
  
  for (let i = 1; i < jornades.length; i += 2) {
    const jornada = parseInt(jornades[i]);
    const block   = jornades[i + 1] || "";
    
    // Find pairs of team links in this jornada block
    // Each match: equip link, date, optional score, equip link
    const matchBlockRe = /href="[^"]*\/equip\/\d+\/([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]{0,300}?(\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?[\s\S]{0,100}?(\d+)\s*-\s*(\d+)[\s\S]{0,200}?href="[^"]*\/equip\/\d+\/([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let mm;
    while ((mm = matchBlockRe.exec(block)) !== null) {
      const home = strip(mm[2]);
      const away = strip(mm[8]);
      if (!home || !away || home === away) continue;
      const key = `${jornada}|${home}|${away}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        jornada, home, away,
        date:      mm[3],
        time:      mm[4] || "",
        homeScore: parseInt(mm[5]),
        awayScore: parseInt(mm[6]),
        played:    true,
      });
    }

    // Pending matches (no score)
    const pendRe = /href="[^"]*\/equip\/\d+\/([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]{0,300}?(\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?[\s\S]{0,100}?-[\s\S]{0,200}?href="[^"]*\/equip\/\d+\/([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let pm;
    while ((pm = pendRe.exec(block)) !== null) {
      const home = strip(pm[2]);
      const away = strip(pm[6]);
      if (!home || !away || home === away) continue;
      const key = `${jornada}|${home}|${away}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        jornada, home, away,
        date:   pm[3],
        time:   pm[4] || "",
        played: false,
      });
    }
  }

  return matches;
}

// ── Parse acta links from competition page HTML ────────────────
// Expected format:
//   /acta/136718/CLUB+HOQUEI+RIPOLLET+C-CP+CALDES+B
function extractActaLinks(html) {
  const actes = [];
  const seen = new Set();

  const re = /(?:href=")?([^"' >]*\/acta\/(\d+)\/([^"'?#<\s]+))(?:")?/gi;
  let m;

  while ((m = re.exec(html)) !== null) {
    const rawUrl = m[1];
    const actaId = m[2];
    const actaSlug = m[3];

    if (!actaId || seen.has(actaId)) continue;
    seen.add(actaId);

    const actaUrl = rawUrl.startsWith("http")
      ? rawUrl
      : new URL(rawUrl, BASE).href;

    actes.push({
      actaId,
      actaSlug,
      actaUrl,
    });
  }

  return actes;
}

function normalizeTeamForActaSlug(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, "+")
    .replace(/\++/g, "+")
    .replace(/^\+|\+$/g, "");
}

function buildExpectedActaSlug(match) {
  return `${normalizeTeamForActaSlug(match.home)}-${normalizeTeamForActaSlug(match.away)}`;
}

function attachActesToMatches(matches, actaLinks) {
  const remaining = [...actaLinks];

  for (const match of matches) {
    if (!match.played || !match.home || !match.away) continue;

    const expected = buildExpectedActaSlug(match);

    // 1. Exact slug match
    let idx = remaining.findIndex(a => a.actaSlug === expected);

    // 2. Fallback: normalized comparison
    if (idx === -1) {
      idx = remaining.findIndex(a =>
        normalizeTeamForActaSlug(a.actaSlug.replace(/-/g, " "))
          === normalizeTeamForActaSlug(expected.replace(/-/g, " "))
      );
    }

    if (idx === -1) continue;

    const acta = remaining[idx];
    match.actaId = acta.actaId;
    match.actaSlug = acta.actaSlug;
    match.actaUrl = acta.actaUrl;

    remaining.splice(idx, 1);
  }

  return matches;
}

//-- Noves funcions per gestió de actes i jugadors
function decodeEntities(s) {
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

function stripHtmlFull(html) {
  return decodeEntities(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractTitle(html) {
  const m = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : "";
}

function extractActaMeta(rawText) {
  const meta = {
    compName: "",
    date: "",
    time: "",
  };

  const m = rawText.match(/Resultats de cerca per:\s*(.*?)\s+(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2})/i);
  if (m) {
    meta.compName = (m[1] || "").trim();
    meta.date = m[2] || "";
    meta.time = m[3] || "";
    return meta;
  }

  const dt = rawText.match(/(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2})/);
  if (dt) {
    meta.date = dt[1] || "";
    meta.time = dt[2] || "";
  }

  return meta;
}

function extractReferees(rawText) {
  const refs = [];

  const m = rawText.match(/Àrbitre\s+(.+?)\s+Jugador\s+G\s+B\s+V\s+FD\s+Pe/i)
         || rawText.match(/Arbitre\s+(.+?)\s+Jugador\s+G\s+B\s+V\s+FD\s+Pe/i)
         || rawText.match(/Arbitro\s+(.+?)\s+Jugador\s+G\s+B\s+V\s+FD\s+Pe/i);

  if (!m) return refs;

  const raw = (m[1] || "").replace(/\s+/g, " ").trim();
  if (!raw) return refs;

  raw.split(/\s{2,}|,\s*(?=[A-ZÀ-Ú])/)
    .map(s => s.trim().replace(/,$/, ""))
    .filter(Boolean)
    .forEach(r => refs.push(r));

  if (!refs.length && raw) refs.push(raw);

  return refs;
}

function extractPlayerStatsRaw(rawText) {
  const result = {
    columns: ["Jugador", "G", "B", "V", "FD", "Pe"],
    homeBlock: "",
    awayBlock: "",
  };

  const parts = rawText.split(/Jugador\s+G\s+B\s+V\s+FD\s+Pe/i);
  if (parts.length < 3) return result;

  const cleanBlock = (txt) => String(txt || "")
    .replace(/\s+JOK\.cat[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  result.homeBlock = cleanBlock(parts[1]);
  result.awayBlock = cleanBlock(parts[2]);

  return result;
}

function extractPlayerLinks(html) {
  const players = [];
  const seen = new Set();

  const re = /href="([^"]*\/jugador\/(\d+)\/([^"?#]+))"/gi;
  let m;

  while ((m = re.exec(html)) !== null) {
    const rawUrl = m[1];
    const id = String(m[2] || "").trim();
    const slug = String(m[3] || "").trim();

    if (!id || seen.has(id)) continue;
    seen.add(id);

    const url = rawUrl.startsWith("http")
      ? rawUrl
      : new URL(rawUrl, BASE).href;

    players.push({
      jugadorId: id,
      id,
      type: "jugador",
      slug,
      url,
    });
  }

  return players;
}

function ensureJugadorsIndex(data) {
  if (!data.jugadors || typeof data.jugadors !== "object") {
    data.jugadors = {};
  }
}

function addPlayerSources(data, actaId, playerLinks) {
  ensureJugadorsIndex(data);

  for (const player of playerLinks) {
    if (!data.jugadors[player.id]) {
      data.jugadors[player.id] = {
        jugadorId: player.id,
        id: player.id,
        type: "jugador",
        slug: player.slug,
        url: player.url,
        loaded: false,
        loadedAt: null,
        title: "",
        sources: [],
      };
    }

    const target = data.jugadors[player.id];

    if (!target.slug) target.slug = player.slug;
    if (!target.url) target.url = player.url;

    if (!Array.isArray(target.sources)) {
      target.sources = [];
    }

    const exists = target.sources.some(
      s => s.type === "acta" && s.id === String(actaId)
    );

    if (!exists) {
      target.sources.push({
        type: "acta",
        id: String(actaId),
      });
    }
  }
}

async function runPool(items, limit, worker) {
  const results = [];
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => runner()
  );

  await Promise.all(workers);
  return results;
}

async function readPreviousData() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function shouldLoadActa(acta) {
  if (!acta || !acta.actaUrl) return false;
  if (ACTA_FORCE_RELOAD) return true;

  return (
    !acta.title ||
    !acta.rawTextPreview ||
    !acta.actaMeta ||
    !acta.playerStatsRaw ||
    !Array.isArray(acta.playerLinks)
  );
}

async function loadPendingActes(output) {
  if (!output.actes || typeof output.actes !== "object") return;

  ensureJugadorsIndex(output);

  const allActes = Object.values(output.actes);
  const pending = allActes.filter(shouldLoadActa);

  console.log(`\n📄 Actes totals: ${allActes.length}`);
  console.log(`📥 Actes pendents de carregar: ${pending.length}`);

  let processed = 0;
  let okCount = 0;
  let errCount = 0;
  let playerRefsCount = 0;

  await runPool(pending, ACTA_CONCURRENCY, async (acta) => {
    try {
      const html = await fetchText(acta.actaUrl);
      await sleep(DELAY_MS);

      const title = extractTitle(html);
      const rawText = stripHtmlFull(html);
      const actaMeta = extractActaMeta(rawText);
      const referees = extractReferees(rawText);
      const playerStatsRaw = extractPlayerStatsRaw(rawText);
      const playerLinks = extractPlayerLinks(html);

      const target = output.actes[acta.actaId];
      if (target) {
        target.actaId = target.actaId || String(acta.actaId);
        target.id = String(acta.actaId);
        target.type = "acta";
        target.actaSlug = target.actaSlug || acta.actaSlug || "";
        target.slug = target.slug || target.actaSlug || acta.actaSlug || "";
        target.actaUrl = target.actaUrl || acta.actaUrl || "";
        target.url = target.url || target.actaUrl || acta.actaUrl || "";

        target.loaded = true;
        target.loadedAt = new Date().toISOString();
        target.title = title;
        target.rawTextPreview = rawText.slice(0, ACTA_PREVIEW_LIMIT);
        target.actaMeta = {
          compName: actaMeta.compName || target.compName || "",
          date: actaMeta.date || target.date || "",
          time: actaMeta.time || target.time || "",
        };
        target.referees = referees;
        target.playerStatsRaw = playerStatsRaw;
        target.playerLinks = playerLinks;

        delete target.loadError;
        delete target.lastLoadAttemptAt;
      }

      addPlayerSources(output, acta.actaId, playerLinks);
      playerRefsCount += playerLinks.length;

      processed++;
      okCount++;
      console.log(`   [${processed}/${pending.length}] OK acta ${acta.actaId} jugadors:${playerLinks.length}`);
    } catch (err) {
      const target = output.actes[acta.actaId];
      if (target) {
        target.loaded = false;
        target.loadError = err.message;
        target.lastLoadAttemptAt = new Date().toISOString();
      }

      processed++;
      errCount++;
      console.log(`   [${processed}/${pending.length}] ERROR acta ${acta.actaId}: ${err.message}`);
    }
  });

  console.log(`✅ Actes carregades: ${okCount}, errors: ${errCount}, refs jugadors: ${playerRefsCount}`);
}


// ── Extract club ID → team ID mappings ────────────────────────
// jok.cat structure in classification rows:
//   <img src=".../logos_clubes/278.gif"> immediately followed by
//   <a href="/equip/10349/CLUB+HOQUEI+RIPOLLET+A">
// We capture both the logo→team and team→logo directions
function extractClubInfo(html) {
  const map = {}; // teamId → clubId

  // Pattern 1: logo img directly before or after equip link (within 300 chars)
  const logoRe = /logos_clubes\/(\d+)[._][^"'\s>]+/gi;
  const equipRe = /\/equip\/(\d+)\//gi;

  // Get all logo positions and equip positions
  const logos  = [];
  const equips = [];
  let m;

  // Capture full logo filename e.g. "278_3.png" or "278.gif"
  const re1 = /logos_clubes\/([^"'\s>]+)/gi;
  while ((m = re1.exec(html)) !== null) {
    const fname   = m[1].split("?")[0];            // "278_3.png"
    const clubId  = fname.replace(/[._].*$/, "");  // "278"
    logos.push({ clubId, fname, pos: m.index });
  }

  const re2 = /\/equip\/(\d+)\//gi;
  while ((m = re2.exec(html)) !== null) equips.push({ teamId: m[1], pos: m.index });

  // For each logo, find the nearest equip link within 400 chars
  for (const logo of logos) {
    for (const equip of equips) {
      const dist = Math.abs(logo.pos - equip.pos);
      if (dist < 400) {
        if (!map[equip.teamId]) map[equip.teamId] = logo.fname || logo.clubId;
        break;
      }
    }
  }

  return map;
}


function extractTeams(html) {
  const teams = [];
  const seen  = new Set();
  const re    = /href="[^"]*\/equip\/(\d+)\/([^"?]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    const name = decodeURIComponent(m[2].replace(/\+/g," ")).replace(/-/g," ").replace(/_/g," ").trim();
    teams.push({ id: m[1], name });
  }
  return teams;
}


// ── Parse top scorers from team page ─────────────────────────
// Structure: <a href="/jugador/ID/NAME">name</a> ... percentage ... goals
function parseScorers(html) {
  const scorers = [];
  const gIdx = html.indexOf("Golejadors");
  if (gIdx === -1) return scorers;

  // Work on the section after "Golejadors"
  const section = html.slice(gIdx, gIdx + 8000);

  // Each scorer row: link with name + number at end
  const rowRe = /href="\/jugador\/(\d+)\/([^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>[\s\S]{0,200}?(\d+)\s*<\/div>/g;
  let m;
  while ((m = rowRe.exec(section)) !== null) {
    const goals = parseInt(m[4]);
    if (goals > 0) {
      scorers.push({
        id:    m[1],
        name:  decodeURIComponent(m[2].replace(/\+/g," ")).replace(/_/g," ").toLowerCase().trim(),
        goals,
      });
    }
    if (scorers.length >= 10) break; // top 10 only
  }
  return scorers;
}

// ── Parse yellow/red cards from team page ─────────────────────
function parseCards(html) {
  const cards = [];
  const tIdx  = html.toLowerCase().indexOf("targetes");
  if (tIdx === -1) return cards;
  const section = html.slice(tIdx, tIdx + 5000);
  const rowRe = /href="\/jugador\/(\d+)\/([^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>[\s\S]{0,300}?(\d+)\s*<\/div>/g;
  let m;
  while ((m = rowRe.exec(section)) !== null) {
    const n = parseInt(m[4]);
    if (n > 0) {
      cards.push({ id: m[1], name: decodeURIComponent(m[2].replace(/\+/g," ")).toLowerCase().trim(), cards: n });
    }
    if (cards.length >= 10) break;
  }
  return cards;
}

// ── Scrape one competition ────────────────────────────────────
async function scrapeCompetition(comp) {
  const url  = `${BASE}/competicio/${comp.id}/${comp.slug}`;
  const html = await fetchText(url);
  await sleep(DELAY_MS);

  const classification = parseClassification(html);
  const rawCalendar    = parseCalendar(html);
  const actaLinks      = extractActaLinks(html);
  const calendar       = attachActesToMatches(rawCalendar, actaLinks);

  const teamToClub     = extractClubInfo(html);
  const teams          = extractTeams(html);

  // NOTE: Team page scraping (scorers/cards) disabled for speed
  // Re-enable manually when needed
  const teamScorers = {};

  // Add clubId to classification rows
  classification.forEach(r => {
    if (r.teamId) r.clubId = r.clubId || teamToClub[r.teamId] || null;
  });

  const pctM      = html.match(/(\d+)\s*%\s*jugat/i) || html.match(/(\d+)%/);
  const pctPlayed = pctM ? Math.min(100, parseInt(pctM[1])) : null;

  return {
    ...comp,
    classification,
    calendar,
    teams,
    teamToClub,
    teamScorers,
    pctPlayed,
    actesDiscovered: actaLinks,
  };
}

// ── Categorise ────────────────────────────────────────────────
function categorise(name) {
  const n = name.toUpperCase();
  if (n.includes("NACIONAL"))                           return "Nacional Catalana";
  if (n.match(/\b1[AÀ]\b/) || n.includes("1A CATAL"))  return "1ª Catalana";
  if (n.match(/\b2[AÀ]\b/) || n.includes("2A CATAL"))  return "2ª Catalana";
  if (n.match(/\b3[AÀ]\b/) || n.includes("3A CATAL"))  return "3ª Catalana";
  if (n.includes("FEM") || n.includes("MINIFEM"))       return "Fem";
  if (n.includes("JÚNIOR") || n.includes("JUNIOR"))     return "Júnior";
  if (n.includes("JUVENIL"))                            return "Juvenil";
  if (n.includes("INFANTIL"))                           return "Infantil";
  if (n.includes("ALEVÍ") || n.includes("ALEVI"))       return "Aleví";
  if (n.match(/PREBENJAM[IÍ]/) || n.includes("PB-"))    return "Prebenjamí";
  if (n.includes("BENJAMÍ") || n.includes("BENJAMI"))   return "Benjamí";
  if (n.includes("VETERANS") || n.includes("LCV"))      return "Veterans";
  return "Altres";
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log("🏒 FECAPA Scraper v5 — iniciant...\n");
  const t0 = Date.now();
  const previousData = await readPreviousData();
  const previousActes = previousData?.actes || {};
  const previousJugadors = previousData?.jugadors || {};

  console.log("📋 Carregant llista de competicions...");
  let listHtml;
  try {
    listHtml = await fetchText(`${BASE}/competicions`);
  } catch(e) {
    console.error("❌ No es pot connectar a jok.cat:", e.message);
    process.exit(1);
  }

  // Debug: show what we got
  const season26 = listHtml.indexOf("2025-26");
  console.log(`   HTML rebut: ${listHtml.length} bytes, '2025-26' a posició ${season26}`);

  const allComps = parseCompetitionList(listHtml);
  console.log(`   Competicions trobades: ${allComps.length}`);

  if (allComps.length === 0) {
    // Show raw HTML snippet around season section for debugging
    if (season26 > -1) {
      console.log("\n   HTML al voltant de 2025-26:");
      console.log(listHtml.slice(season26, season26 + 800));
    } else {
      console.log("\n   HTML primers 1000 chars:");
      console.log(listHtml.slice(0, 1000));
    }
    process.exit(1);
  }

  // All comps from the 2025-26 block are already current season
  const current = allComps;
  console.log(`   Processant ${current.length} competicions...\n`);

  const categories = {
    "Nacional Catalana": [], "1ª Catalana": [], "2ª Catalana": [],
    "3ª Catalana": [], "Fem": [], "Júnior": [], "Juvenil": [],
    "Infantil": [], "Aleví": [], "Benjamí": [], "Prebenjamí": [],
    "Veterans": [], "Altres": [],
  };
  const clubIndex = {};
  const actes = {};
  const jugadors = { ...previousJugadors };
  let done = 0, errors = 0;
  const CONCURRENCY = 8;

  for (let i = 0; i < current.length; i += CONCURRENCY) {
    const batch   = current.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async comp => {
      try {
        const data = await scrapeCompetition(comp);
        return { ok: true, comp, data };
      } catch(err) {
        return { ok: false, comp, error: err.message };
      }
    }));

    for (const result of results) {
      if (result.ok) {
        const { data } = result;
        categories[categorise(data.name)].push(data);
        data.teams.forEach(t => {
          if (!clubIndex[t.id]) clubIndex[t.id] = { name: t.name, clubId: data.teamToClub[t.id]||null };
        });
        data.classification.forEach(r => {
          if (r.teamId) {
            if (!clubIndex[r.teamId]) clubIndex[r.teamId] = { name: r.team, clubId: r.clubId };
            else if (r.clubId) clubIndex[r.teamId].clubId = r.clubId;
          }
        });
        data.calendar.forEach(m => {
          if (!m.actaId) return;

          const prev = previousActes[m.actaId] || {};

          actes[m.actaId] = {
            ...prev,
            actaId: String(m.actaId),
            id: String(m.actaId),
            type: "acta",
            actaSlug: m.actaSlug || prev.actaSlug || prev.slug || "",
            slug: m.actaSlug || prev.slug || prev.actaSlug || "",
            actaUrl: m.actaUrl || prev.actaUrl || prev.url || "",
            url: m.actaUrl || prev.url || prev.actaUrl || "",
            compId: data.id,
            compName: data.name,
            jornada: m.jornada ?? null,
            date: m.date || prev.date || "",
            time: m.time || prev.time || "",
            home: m.home || prev.home || "",
            away: m.away || prev.away || "",
            homeScore: m.homeScore ?? prev.homeScore ?? null,
            awayScore: m.awayScore ?? prev.awayScore ?? null,
            scrapedAt: new Date().toISOString(),
          };
        });
        done++;
      } else {
        errors++;
        console.error(`   ⚠️  Error "${result.comp.name}": ${result.error}`);
        categories[categorise(result.comp.name)].push({
          ...result.comp, error: result.error,
          classification: [], calendar: [], teams: [], teamToClub: {}
        });
      }
    }

    const elapsed = ((Date.now()-t0)/1000).toFixed(0);
    console.log(`   [${done}/${current.length}] ${elapsed}s`);
    await sleep(DELAY_MS);
  }

  const output = {
    updatedAt:  new Date().toISOString(),
    season:     "2025-26",
    totalComps: done,
    categories,
    clubIndex,
    actes,
    jugadors,
  };

  await loadPendingActes(output);
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(output, null, 2));

  const elapsed = ((Date.now()-t0)/1000).toFixed(1);
  const kb      = (JSON.stringify(output).length / 1024).toFixed(0);
  console.log(`\n✅ Fet en ${elapsed}s — ${done} competicions, ${errors} errors, ${kb} KB`);
  console.log(`   → ${DATA_FILE}`);

  const stats = Object.entries(categories)
    .filter(([,v]) => v.length > 0)
    .map(([k,v]) => `${k.split(" ")[0]}:${v.length}`)
    .join(" ");
  console.log(`   ${stats}`);
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
