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
    const actaSlug = decodeURIComponent(m[3]);

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

// Generic prefix tokens that don't identify a specific club
const SLUG_GENERIC = new Set(['CH', 'HC', 'CP', 'UEH', 'CE', 'AH', 'CPI', 'CLUB', 'HOQUEI', 'PATI']);

// Returns true if the normalized team name can be found inside a decoded acta slug.
// Handles: abbreviated prefix (Ch→Club Hoquei), extra suffix (+ES+MOU), apostrophe
// split (D'HOQUEI→D+HOQUEI) and single-char article merging (DHORTA→HORTA).
function teamAppearsInSlug(normalizedTeam, rawActaSlug) {
  const normSlug = normalizeTeamForActaSlug(rawActaSlug);
  const tokens = normalizedTeam.split('+');
  // Skip leading generic tokens to find the distinctive suffix
  let i = 0;
  while (i < tokens.length - 1 && SLUG_GENERIC.has(tokens[i])) i++;
  const suffix = tokens.slice(i).join('+');
  // Fast path: distinctive suffix is a literal substring (e.g. RIPOLLET+A, VILA-SECA)
  if (normSlug.includes(suffix)) return true;
  // Slow path: every key word must appear individually
  // Handles JOI→JOIERIA (substring), DHOQUEI→D+HOQUEI (strip leading article char)
  const keys = tokens.slice(i).filter(w => w.length >= 3);
  return keys.length > 0 && keys.every(k =>
    normSlug.includes(k) ||
    (k.length >= 5 && 'DL'.includes(k[0]) && normSlug.includes(k.slice(1)))
  );
}

function attachActesToMatches(matches, actaLinks) {
  const remaining = [...actaLinks];

  for (const match of matches) {
    if (!match.played || !match.home || !match.away) continue;

    const expected = buildExpectedActaSlug(match);

    // 1. Exact slug match
    let idx = remaining.findIndex(a => a.actaSlug === expected);

    // 2. Fallback: normalized comparison (handles accent/encoding differences)
    if (idx === -1) {
      idx = remaining.findIndex(a =>
        normalizeTeamForActaSlug(a.actaSlug.replace(/-/g, " "))
          === normalizeTeamForActaSlug(expected.replace(/-/g, " "))
      );
    }

    // 3. Fuzzy fallback: both team key-words must appear in the slug
    // Handles abbreviated names (Ch Vila-Seca vs CLUB+HOQUEI+VILA-SECA)
    if (idx === -1) {
      const homeNorm = normalizeTeamForActaSlug(match.home);
      const awayNorm = normalizeTeamForActaSlug(match.away);
      idx = remaining.findIndex(a =>
        teamAppearsInSlug(homeNorm, a.actaSlug) &&
        teamAppearsInSlug(awayNorm, a.actaSlug)
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

function parsePlayerStats(playerStatsRaw, playerLinks) {
  const psr = playerStatsRaw || {};
  const links = playerLinks || [];

  function parseBlock(block, offset) {
    const result = [];
    const re = /((?:[A-Za-zÀ-ÿ'\-]+ )+?)(\d+) (\d+) (\d+)(?= [A-Za-zÀ-ÿ]|$)/g;
    let m, i = 0;
    while ((m = re.exec(block)) !== null) {
      const link = links[offset + i] || {};
      result.push({ name: m[1].trim(), g: +m[2], b: +m[3], v: +m[4], jugadorId: link.jugadorId || null, url: link.url || null });
      i++;
    }
    if (!result.length && links.slice(offset).length) {
      const blockLinks = links.slice(offset);
      const tokens = String(block || "").trim().split(/\s+/);
      let j = 0;
      blockLinks.forEach((link) => {
        const nameParts = [];
        while (j < tokens.length && !/^\d+$/.test(tokens[j])) nameParts.push(tokens[j++]);
        const g = +tokens[j++] || 0, b = +tokens[j++] || 0, v = +tokens[j++] || 0;
        result.push({ name: nameParts.join(" "), g, b, v, jugadorId: link.jugadorId || null, url: link.url || null });
      });
    }
    return result;
  }

  const homePlayers = parseBlock(psr.homeBlock || "", 0);
  const awayPlayers = parseBlock(psr.awayBlock || "", homePlayers.length);
  return { homePlayers, awayPlayers };
}

function migrateActes(data) {
  if (!data?.actes) return;
  let count = 0;
  for (const acta of Object.values(data.actes)) {
    if (acta.playerStatsRaw && !acta.playerStats) {
      acta.playerStats = parsePlayerStats(acta.playerStatsRaw, acta.playerLinks || []);
      delete acta.playerStatsRaw;
      count++;
    }
    delete acta.rawTextPreview;
  }
  if (count > 0) console.log(`🔄 Migrades ${count} actes: playerStatsRaw → playerStats`);
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

// ── Enriquiment jugadors via jok.cat API ─────────────────────
const JOK_API       = "https://jok.cat/api/player/";
const ENRICH_LIMIT  = 400;  // màxim per execució
const STALE_MS      = 14 * 24 * 60 * 60 * 1000; // re-enriquir als 14 dies

async function enrichJugadors(jugadors) {
  const now = Date.now();
  const all = Object.values(jugadors).filter(j => j.jugadorId);

  // Prioritat: mai enriquits primer, després els més antics
  const toEnrich = all
    .filter(j => !j.enrichedAt || (now - new Date(j.enrichedAt).getTime()) > STALE_MS)
    .sort((a, b) => {
      if (!a.enrichedAt && b.enrichedAt) return -1;
      if (a.enrichedAt && !b.enrichedAt) return 1;
      return new Date(a.enrichedAt) - new Date(b.enrichedAt);
    })
    .slice(0, ENRICH_LIMIT);

  if (toEnrich.length === 0) {
    console.log("\n📊 Jugadors: tots els perfils ja estan actualitzats.");
    return;
  }
  console.log(`\n📊 Enriquint ${toEnrich.length} jugadors via jok.cat API (${all.length} total)...`);

  let ok = 0, errors = 0;
  await runPool(toEnrich, 4, async (player) => {
    try {
      const res = await fetch(`${JOK_API}${player.jugadorId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const info = data.playerInfo?.[0];
      if (info?.number != null) player.number = info.number;

      if (Array.isArray(data.playerStats) && data.playerStats.length > 0) {
        player.careerStats = data.playerStats.map(s => ({
          seasonName:   s.seasonName,
          total_goals:  +s.total_goals,
          match_count:  +s.match_count,
          total_blue:   +s.total_blue,
          total_red:    +s.total_red,
        }));
      }

      player.enrichedAt = new Date().toISOString();
      ok++;
    } catch (e) {
      errors++;
    }
  });

  console.log(`   ✅ Enriquits: ${ok}, errors: ${errors}`);
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
    const data = JSON.parse(raw);

    // Actes are now in per-category files — reconstitute from them
    if (!data.actes) {
      const actesDir = path.join(__dirname, "../public/actes");
      data.actes = {};
      try {
        const files = (await fs.readdir(actesDir)).filter(f => f.endsWith(".json"));
        for (const file of files) {
          const catRaw = await fs.readFile(path.join(actesDir, file), "utf8");
          Object.assign(data.actes, JSON.parse(catRaw));
        }
        console.log(`   Actes carregades del cache: ${Object.keys(data.actes).length}`);
      } catch {}
    }

    return data;
  } catch {
    return null;
  }
}

function shouldLoadActa(acta) {
  if (!acta || !acta.actaUrl) return false;
  if (ACTA_FORCE_RELOAD) return true;

  return (
    !acta.title ||
    !acta.actaMeta ||
    !acta.playerStats ||
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
        target.actaMeta = {
          compName: actaMeta.compName || target.compName || "",
          date: actaMeta.date || target.date || "",
          time: actaMeta.time || target.time || "",
        };
        target.referees = referees;
        target.playerStats = parsePlayerStats(playerStatsRaw, playerLinks);
        target.playerLinks = playerLinks;
        delete target.playerStatsRaw;
        delete target.rawTextPreview;

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

// ── Category slug ─────────────────────────────────────────────
function catSlug(catName) {
  return String(catName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Categorise ────────────────────────────────────────────────
function categorise(name) {
  const n = name.toUpperCase();
  if (/\bNACIONAL\b\s*CATAL|\bNAC\.?\s*CAT\b/.test(n))               return "Nacional Catalana";
  if (/\b1[ªAÀ]\b\s*CATAL|\bPRIMERA\b\s*CATAL/.test(n))               return "1ª Catalana";
  if (/\b2[ªAÀ]\b\s*CATAL|\bSEGONA\b\s*CATAL/.test(n))                return "2ª Catalana";
  if (/\b3[ªAÀ]\b\s*CATAL|\bTERCERA\b\s*CATAL/.test(n))               return "3ª Catalana";
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

// ── Equips per jugador (teamStats) ────────────────────────────
// Recorre totes les actes carregades i computa per a cada jugador
// quants partits ha jugat amb cada equip i en quina categoria.
function buildPlayerTeamStats(jugadors, actes, compIdToCat) {
  const counts = {}; // jugadorId → { teamName → { cat, count } }

  for (const [, acta] of Object.entries(actes || {})) {
    if (!acta.playerStats) continue;
    const cat = catSlug(compIdToCat[acta.compId] || "Altres");

    const addGroup = (players, team) => {
      for (const p of (players || [])) {
        const m = p.url?.match(/\/jugador\/(\d+)\//);
        if (!m) continue;
        const jid = m[1];
        if (!counts[jid]) counts[jid] = {};
        const key = team || "?";
        if (!counts[jid][key]) counts[jid][key] = { cat, count: 0 };
        counts[jid][key].count++;
      }
    };

    addGroup(acta.playerStats.homePlayers, acta.home);
    addGroup(acta.playerStats.awayPlayers, acta.away);
  }

  for (const [jid, teams] of Object.entries(counts)) {
    const player = jugadors[jid];
    if (!player) continue;
    player.teamStats = Object.entries(teams)
      .map(([team, info]) => ({ team, cat: info.cat, count: info.count }))
      .sort((a, b) => b.count - a.count);
  }

  console.log(`   📊 teamStats calculats per a ${Object.keys(counts).length} jugadors`);
}

// ── Fusió de dades sidgad (edat, posició) ─────────────────────
async function mergeSidgadData(jugadors) {
  const cacheFile = path.join(__dirname, "../public/jugadors-sidgad.json");
  const indexFile = path.join(__dirname, "../public/jugadors-sidgad-index.json");

  let cache, index;
  try {
    cache = JSON.parse(await fs.readFile(cacheFile, "utf8"));
    index = JSON.parse(await fs.readFile(indexFile, "utf8"));
  } catch {
    console.log("   ℹ️  jugadors-sidgad.json no disponible (el scraper sidgad s'executa separat)");
    return;
  }

  const norm = s => (s || "").toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

  let merged = 0;
  for (const player of Object.values(jugadors)) {
    const rawName = decodeURIComponent(player.slug || "").replace(/\+/g, " ");
    const sidgadId = index[norm(rawName)];
    if (!sidgadId) continue;
    const sd = cache[sidgadId];
    if (!sd) continue;

    if (sd.birthDate)      player.birthDate      = sd.birthDate;
    if (sd.registeredTeam) player.registeredTeam = sd.registeredTeam;
    if (sd.isGK != null)   player.isGK           = sd.isGK;
    if (sd.position)       player.position       = sd.position;
    merged++;
  }

  console.log(`   🔗 Sidgad merge: ${merged} jugadors amb edat/posició`);
}

// ── Fusió de competicions sidgad (classificació + resultats) ──
function normCompName(name) {
  return (name || "").toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\b(2025|2026|25|26)\b/g, "").replace(/\s+/g, " ").trim();
}

async function mergeSidgadCompetitions(categories, clubIndex) {
  const compFile = path.join(__dirname, "../public/competicions-sidgad.json");
  let sidgadComps;
  try {
    sidgadComps = JSON.parse(await fs.readFile(compFile, "utf8"));
  } catch {
    console.log("   ℹ️  competicions-sidgad.json no disponible");
    return;
  }

  // Normalització de noms per matching
  const normTeamName = s => (s || "").toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, " ").replace(/\s+/g, " ").trim();

  // Indexa les competicions jok.cat per nom normalitzat
  const jokIndex = {}; // normName → comp object
  const collisions = new Set();
  for (const comps of Object.values(categories)) {
    for (const comp of comps) {
      const key = normCompName(comp.name || "");
      if (!key) continue;
      if (jokIndex[key]) collisions.add(key);
      else jokIndex[key] = comp;
    }
  }
  if (collisions.size > 0)
    console.log(`   ⚠️  Competicions amb nom normalitzat duplicat (no es fusionaran): ${[...collisions].join(", ")}`);

  let mergedClass = 0, mergedCal = 0;
  for (const sc of Object.values(sidgadComps)) {
    const key = normCompName(sc.name || "");
    if (collisions.has(key)) continue; // ambigu, no fusionar
    const jokComp = jokIndex[key];
    if (!jokComp) continue;

    if (sc.classification && sc.classification.length > 0) {
      // Construeix índex de teamId/clubId de la classificació jok.cat anterior
      const prevTeamIndex = {}; // normName → { teamId, clubId }
      for (const row of (jokComp.classification || [])) {
        if (row.team) prevTeamIndex[normTeamName(row.team)] = { teamId: row.teamId, clubId: row.clubId };
      }

      // Fusiona teamId/clubId de jok.cat als equips de sidgad per nom
      jokComp.classification = sc.classification.map(row => {
        const prev = prevTeamIndex[normTeamName(row.team)];
        return {
          ...row,
          teamId: row.teamId || prev?.teamId || null,
          clubId: row.clubId || prev?.clubId || null,
        };
      });

      // Actualitza clubIndex amb qualsevol teamId nou de sidgad
      for (const row of jokComp.classification) {
        if (row.teamId && clubIndex) {
          if (!clubIndex[row.teamId]) clubIndex[row.teamId] = { name: row.team, clubId: row.clubId };
          else if (row.clubId && !clubIndex[row.teamId].clubId) clubIndex[row.teamId].clubId = row.clubId;
        }
      }
      mergedClass++;
    }

    if (sc.matches && sc.matches.length > 0) {
      // Converteix resultats sidgad al format de calendar jok.cat
      const sidgadCal = sc.matches
        .filter(m => m.home && m.away)
        .map(m => ({
          jornada:   m.jornada,
          home:      m.home,
          away:      m.away,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          date:      m.date,
          time:      m.time,
          played:    m.played,
          idp:       m.idp,
        }));
      if (sidgadCal.length > 0) {
        if (sidgadCal.length >= (jokComp.calendar?.length || 0)) {
          jokComp.calendar = sidgadCal;
          mergedCal++;
        }
      }
    }
  }

  console.log(`   🔗 Sidgad comps: ${mergedClass} classificacions, ${mergedCal} calendaris fusionats`);
}

// ── Merge jok.cat INTO sidgad (sidgad primary, jok.cat fallback) ────────────
// Load sidgad as base, then fill in missing data from jok.cat
async function mergejokIntoSidgad(categories) {
  const cacheFile = path.join(__dirname, "../public/competicions-sidgad.json");
  let sidgadComps;
  try {
    sidgadComps = JSON.parse(await fs.readFile(cacheFile, "utf8"));
  } catch {
    console.log("   ℹ️  competicions-sidgad.json no disponible, usant només jok.cat");
    return categories;
  }

  // Build index of jok.cat competitions by normalized name
  // Domain-specific token aliases: expands abbreviations to their full form
  // before matching so jok.cat sigles align with sidgad full names.
  const TOKEN_ALIASES = {
    FCP: "FEDERACIO",   // Federació Catalana de Patinatge
    BCN: "BARCELONA",
    TAR: "TARRAGONA",
    GIR: "GIRONA",
    LLE: "LLEIDA",
    CAT: "CATALUNYA",
  };

  const normCompName = name => (name || "").toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    // Convert ordinal suffixes to words so "1ª CATALANA" matches "PRIMERA CATALANA" in sidgad
    .replace(/1\xAA/g, "PRIMERA").replace(/2\xAA/g, "SEGONA").replace(/3\xAA/g, "TERCERA")
    .replace(/[^A-Z0-9]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\b(2025|2026|25|26|TEMP|SEASON|SAISON)\b/g, "").replace(/\s+/g, " ").trim();

  const expandTokens = norm => norm.split(/\s+/)
    .map(t => TOKEN_ALIASES[t] || t)
    .join(" ");

  // Extract the qualifier token that immediately follows "COPA" in the name.
  // This is the strongest discriminant when multiple sidgad Copes exist.
  const copaQualifier = norm => {
    const m = norm.match(/\bCOPA\s+(\S+)/);
    // Exclude generic/structural words that don't identify the organiser
    const generic = new Set(["BCN", "BARCELONA", "PLATA", "OR", "BRONZE",
                              "BENJAMIN", "BENJAMI", "PREBENJAMI", "INFANTIL",
                              "ALEVI", "JUNIOR", "JUVENIL", "FASE", "2"]);
    if (!m) return null;
    const q = TOKEN_ALIASES[m[1]] || m[1];
    return generic.has(q) ? null : q;
  };

  // Extract key terms (category, region, division) for flexible matching
  const extractKeywords = name => {
    const raw  = normCompName(name);
    const norm = expandTokens(raw);   // aliases expanded for matching
    return {
      full: raw,
      tokens: norm.split(/\s+/),
      category: /\bBENJAMI/.test(norm)    ? "BENJAMIN"
             : /PREBENJAMI/.test(norm)   ? "PREBENJAMI"
             : /JUNIOR/.test(norm)       ? "JUNIOR"
             : /JUVENIL/.test(norm)      ? "JUVENIL"
             : /ALEVI/.test(norm)        ? "ALEVI"
             : /INFANTIL/.test(norm)     ? "INFANTIL"
             : /\bMINIFEM\b/.test(norm)  ? "MINIFEM"
             : /\bFEM\s*19\b/.test(norm) ? "FEM19"
             : /\bFEM\s*17\b/.test(norm) ? "FEM17"
             : /\bFEM\s*15\b/.test(norm) ? "FEM15"
             : /\bFEM\s*13\b/.test(norm) ? "FEM13"
             : /\bFEM\s*11\b/.test(norm) ? "FEM11"
             : /\bFEM\b/.test(norm)      ? "FEM"
             : /\bMASTER\b/.test(norm)   ? "MASTER"
             : /\bVETERANS\b/.test(norm) ? "VETERANS"
             : null,
      region: /BARCELONA/.test(norm)  ? "BARCELONA"
            : /TARRAGONA/.test(norm)  ? "TARRAGONA"
            : /GIRONA/.test(norm)     ? "GIRONA"
            : /LLEIDA/.test(norm)     ? "LLEIDA"
            : null,
      division: /\bOR\b/.test(norm)   ? "OR"
              : /PLATA/.test(norm)    ? "PLATA"
              : /BRONZE/.test(norm)   ? "BRONZE"
              : /INICIACIO/.test(norm)? "INICIACIO"
              : null,
      isCopa:        /COPA/.test(norm),
      is3x3:         /3X3/.test(norm),
      isPreferent:   /\bPREFERENT\b/.test(norm),
      copaQualifier: copaQualifier(norm),
    };
  };

  // Score how well a sidgad comp matches a jok.cat comp (higher = better).
  // Returns -1 if incompatible (hard mismatch), otherwise ≥ 0.
  const matchScore = (sidgadKeywords, jokKeywords) => {
    // Hard exclusions
    if (sidgadKeywords.category !== jokKeywords.category) return -1;
    if (sidgadKeywords.region && jokKeywords.region && sidgadKeywords.region !== jokKeywords.region) return -1;
    // If division is present in either comp, they must match (or both be absent)
    if (sidgadKeywords.division !== jokKeywords.division) return -1;
    if (sidgadKeywords.is3x3 !== jokKeywords.is3x3) return -1;
    if (sidgadKeywords.isPreferent !== jokKeywords.isPreferent) return -1;

    let score = 0;

    // Copa organiser qualifier: strongest discriminant between competing Copes
    if (jokKeywords.copaQualifier && sidgadKeywords.copaQualifier) {
      if (jokKeywords.copaQualifier === sidgadKeywords.copaQualifier) score += 5;
      else score -= 5;
    }

    // General Copa alignment
    if (jokKeywords.isCopa && sidgadKeywords.isCopa)   score += 3;
    if (jokKeywords.isCopa && !sidgadKeywords.isCopa)  score -= 2;

    // Region match bonus
    if (sidgadKeywords.region && jokKeywords.region && sidgadKeywords.region === jokKeywords.region) score += 2;

    // Division match bonus
    if (sidgadKeywords.division && jokKeywords.division && sidgadKeywords.division === jokKeywords.division) score += 2;

    // Token overlap (excluding short tokens)
    const sidgadSig = sidgadKeywords.tokens.filter(t => t.length > 2);
    const jokSig    = jokKeywords.tokens.filter(t => t.length > 2);
    const overlap   = sidgadSig.filter(t => jokSig.includes(t)).length;
    score += overlap;

    return overlap >= 1 ? score : -1;
  };

  const jokComps = []; // Store all jok.cat comps for flexible lookup
  for (const comps of Object.values(categories)) {
    for (const comp of comps) {
      comp.classificationSource = (comp.classification && comp.classification.length > 0) ? "jok" : "none";
      jokComps.push({ comp, keywords: extractKeywords(comp.name || "") });
    }
  }

  // Track parent-child relationships: sidgad → [jok.cat children]
  const sidgadChildren = {}; // sidgadId → { sidgadComp, jokChildren: [jokCompIds] }

  // Mapa invers idc → { sidgadCompId, classificationByGroup, matchesByIdc }
  // Permet trobar directament la classificació d'un grup sidgad pel seu idc,
  // que coincideix amb l'ID de competició de jok.cat (p.ex. idc=4478 ↔ jok 4478)
  // Si no hi ha classificationByGroup (p.ex. Copes), al menys tenim matchesByIdc
  const idcToSidgad = {}; // idc → { compId, compName, classificationByGroup, matchesByIdc }
  const matchesByIdc = {}; // idc → { homeMatches, awayMatches } count

  for (const [scId, sc] of Object.entries(sidgadComps)) {
    // Build matchesByIdc: group matches by their idc
    const idcMatches = {};
    if (sc.matches) {
      for (const match of sc.matches) {
        const idc = match.idc || scId;
        if (!idcMatches[idc]) idcMatches[idc] = { count: 0, hasData: false };
        idcMatches[idc].count++;
        if (match.home && match.away) idcMatches[idc].hasData = true;
      }
    }

    // Register each idc: prioritat a classificationByGroup si té dades, sinó usa matches
    const hasClassByGroup = sc.classificationByGroup && Object.keys(sc.classificationByGroup).length > 0;
    if (hasClassByGroup) {
      for (const idc of Object.keys(sc.classificationByGroup)) {
        idcToSidgad[idc] = { compId: scId, compName: sc.name, classificationByGroup: sc.classificationByGroup, matchesByIdc: idcMatches[idc] };
      }
    } else if (Object.keys(idcMatches).length > 0) {
      // No classificationByGroup o està buit, però has matches with idcs - register them anyway for calendar merge
      for (const [idc, matchData] of Object.entries(idcMatches)) {
        if (!idcToSidgad[idc]) {
          idcToSidgad[idc] = { compId: scId, compName: sc.name, classificationByGroup: null, matchesByIdc: matchData };
        }
      }
    }
  }

  // Merge: for each sidgad competition, find all matching jok.cat competitions
  let mergedCount = 0;
  for (const [scId, sc] of Object.entries(sidgadComps)) {
    const scKeywords = extractKeywords(sc.name || "");

    // Find ALL jok.cat matches with scores, pick best first
    const matchingJok = jokComps
      .map(jc => ({ jc, score: matchScore(scKeywords, jc.keywords) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(({ jc }) => jc);

    if (matchingJok.length === 0) continue;

    // Use the best-scoring match for merging data into sidgad
    const primaryJokComp = matchingJok[0].comp;

    // 1. Classification: use sidgad if present, else use jok.cat
    if (!sc.classification || sc.classification.length === 0) {
      if (primaryJokComp.classification && primaryJokComp.classification.length > 0) {
        sc.classification = primaryJokComp.classification;
      }
    }

    // 2. Calendar: merge best of both
    if (!sc.matches || sc.matches.length === 0) {
      if (primaryJokComp.calendar && primaryJokComp.calendar.length > 0) {
        sc.matches = primaryJokComp.calendar;
      }
    } else if (primaryJokComp.calendar && primaryJokComp.calendar.length > sc.matches.length) {
      // If jok.cat has more matches, supplement sidgad with missing ones
      const sidgadKeys = new Set(sc.matches.map(m => `${m.jornada}|${m.home}|${m.away}`));
      const newMatches = primaryJokComp.calendar.filter(m =>
        !sidgadKeys.has(`${m.jornada}|${m.home}|${m.away}`)
      );
      sc.matches = sc.matches.concat(newMatches);
    }

    // 3. Merge acta links from jok.cat into sidgad calendar
    if (primaryJokComp.calendar) {
      const actaMap = {};
      for (const m of primaryJokComp.calendar) {
        if (!m.actaId) continue;
        const key = `${m.jornada}|${m.home}|${m.away}`;
        actaMap[key] = m.actaId;
      }
      for (const m of sc.matches) {
        if (!m.actaId) {
          const key = `${m.jornada}|${m.home}|${m.away}`;
          if (actaMap[key]) m.actaId = actaMap[key];
        }
      }
    }

    // Collect children for virtual ID assignment (done after all parents processed)
    sidgadChildren[scId] = {
      sidgadId: scId,
      sidgadName: sc.name,
      jokChildren: matchingJok.map(jc => ({ jokId: jc.comp.id, jokName: jc.comp.name }))
    };

    mergedCount++;
  }

  // ── Assign virtual IDs to jok.cat children ───────────────────
  // Virtual ID format: "{sidgadId}-{num}" where num is extracted from the jok.cat name.
  // If two siblings share the same num, add division prefix: "{sidgadId}-{div}-{num}".
  // Fallback for no number: "{sidgadId}-{jokId}".
  const trailingNum = name => {
    const m = normCompName(name).match(/\b(\d+)\s*$/);
    return m ? parseInt(m[1]) : null;
  };

  for (const sc of Object.values(sidgadChildren)) {
    const children = sc.jokChildren;
    if (children.length === 0) continue;

    // Try plain "{sidId}-{num}" — check for collisions within this parent
    const numCounts = {};
    for (const ch of children) {
      const n = trailingNum(ch.jokName);
      if (n != null) numCounts[n] = (numCounts[n] || 0) + 1;
    }

    for (const ch of children) {
      const num = trailingNum(ch.jokName);
      if (num == null) {
        ch.virtualId = `${sc.sidgadId}-${ch.jokId}`;
      } else if (numCounts[num] === 1) {
        ch.virtualId = `${sc.sidgadId}-${num}`;
      } else {
        // Collision: include division from jok.cat name
        const div = extractKeywords(ch.jokName).division || ch.jokId;
        ch.virtualId = `${sc.sidgadId}-${div}-${num}`;
      }
    }
  }

  // Build jokId → virtualId lookup
  const jokVirtualIdMap = {}; // jokId → virtualId
  for (const sc of Object.values(sidgadChildren)) {
    for (const ch of sc.jokChildren) {
      if (ch.virtualId) jokVirtualIdMap[ch.jokId] = ch.virtualId;
    }
  }

  // Update categories with merged sidgad data + virtual IDs
  const sidgadParentMap = {}; // jokId → { sidgadId, sidgadName, virtualId }
  for (const comps of Object.values(categories)) {
    for (const jokComp of comps) {
      const jokKeywords = extractKeywords(jokComp.name || "");

      // Find best-scoring sidgad parent
      const best = Object.entries(sidgadComps)
        .map(([sid, s]) => ({ sid, s, score: matchScore(extractKeywords(s.name || ""), jokKeywords) }))
        .filter(({ score }) => score >= 0)
        .sort((a, b) => b.score - a.score)[0];

      if (best) {
        const { sid: sidgadId, s: sidgadComp } = best;
        const virtualId = jokVirtualIdMap[jokComp.id] || null;

        // Register parent + virtual ID on the jok.cat comp
        jokComp.sidgadParentId = sidgadId;
        jokComp.sidgadId       = virtualId;   // e.g. "4452-4"  (null if no virtual)
        sidgadParentMap[jokComp.id] = { sidgadId, sidgadName: sidgadComp.name, virtualId };

        // Classificació: prioritat 1 — grup exacte per idc (idc = ID de competició jok.cat)
        const idcMatch = idcToSidgad[jokComp.id];
        if (idcMatch) {
          jokComp.sidgadParentId = idcMatch.compId;

          // Intentar usar la classificació del grup si existeix
          if (idcMatch.classificationByGroup && idcMatch.classificationByGroup[jokComp.id]) {
            const groupClass = idcMatch.classificationByGroup[jokComp.id];
            if (groupClass && groupClass.length > 0) {
              jokComp.classification = groupClass;
              jokComp.classificationSource = "fecapa";
            }
          }

          // Si no tenim classificació de grup però tenim matches d'aquest idc, usar el parent's calendar
          if ((!jokComp.classification || jokComp.classification.length === 0) && sidgadComp.matches && sidgadComp.matches.length > 0) {
            const groupMatches = sidgadComp.matches.filter(m => m.idc === String(jokComp.id));
            if (groupMatches.length > 0) {
              jokComp.calendar = groupMatches;
            } else {
              // Fallback: usa tots els matches del parent
              jokComp.calendar = sidgadComp.matches;
            }
          }
        // Prioritat 2 — classificació global del pare sidgad (competicions d'un sol grup)
        } else if (sidgadComp.classification && sidgadComp.classification.length > 0) {
          jokComp.classification = sidgadComp.classification;
          jokComp.classificationSource = "fecapa";
        }
        // Merge sidgad calendar if no idc-specific match found
        if ((!jokComp.calendar || jokComp.calendar.length === 0) && sidgadComp.matches && sidgadComp.matches.length > 0) {
          jokComp.calendar = sidgadComp.matches;
        }
      }
    }
  }

  const nIdcMatched = Object.values(categories).flat().filter(c => idcToSidgad[c.id]).length;

  // Prioritat 3: Matching per NOMS de Copa (quan els idcs de Sidgad són incorrectes)
  // Mapa manual de noms Copa → competicions jok.cat + parent Sidgad CORRECTE
  const copaNameMap = {
    // Copa Barcelona — parent 4452 (OVERRIDE si ja tinha parent incorrecte)
    'BCN.*OR.*COPA.*1': { jokIds: ['4475'], parent: '4452' },
    'BCN.*OR.*COPA.*2': { jokIds: ['4476'], parent: '4452' },
    'BCN.*OR.*COPA.*3': { jokIds: ['4477'], parent: '4452' },
    'BCN.*PLATA.*COPA.*4': { jokIds: ['4478'], parent: '4452' },
    'BCN.*PLATA.*COPA.*5': { jokIds: ['4479'], parent: '4452' },
    'BCN.*PLATA.*COPA.*6': { jokIds: ['4480'], parent: '4452' },
    // Copa Federació — parent 4459 (per quan es scrapegin 4481-4483)
    'FCP.*PLATA.*1': { jokIds: ['4481'], parent: '4459' },
    'FCP.*PLATA.*2': { jokIds: ['4482'], parent: '4459' },
    'FCP.*PLATA.*3': { jokIds: ['4483'], parent: '4459' },
  };

  // Aplicar matching per noms per a Copa — OVERRIDE el parent si match
  let nCopaNameMatched = 0;
  for (const [pattern, config] of Object.entries(copaNameMap)) {
    const regex = new RegExp(pattern, 'i');
    const allowedJokIds = new Set((config.jokIds || []).map(String));
    for (const cat of Object.values(categories)) {
      for (const jokComp of cat) {
        const jokId = String(jokComp.id);
        const byId = allowedJokIds.size > 0 && allowedJokIds.has(jokId);
        const byName = regex.test(jokComp.name);
        // Si la regla defineix jokIds, només aplica a aquests IDs.
        // El regex queda com a suport/validació, no com a selector global.
        if (allowedJokIds.size > 0 ? byId : byName) {
          // OVERRIDE el parent correcte (indepedentment si tenia idcToSidgad)
          const oldParent = jokComp.sidgadParentId;
          jokComp.sidgadParentId = config.parent;
          if (oldParent !== config.parent) nCopaNameMatched++;

          // Recalcular sidgadId perquè sigui coherent amb el nou parent.
          const num = trailingNum(jokComp.name);
          const div = extractKeywords(jokComp.name || "").division;
          jokComp.sidgadId = (num != null)
            ? (div ? `${config.parent}-${div}-${num}` : `${config.parent}-${num}`)
            : `${config.parent}-${jokComp.id}`;
          sidgadParentMap[jokComp.id] = {
            sidgadId: config.parent,
            sidgadName: sidgadComps[config.parent]?.name || "",
            virtualId: jokComp.sidgadId,
          };

          // Carregar classificació de Sidgad per a aquest grup (idc)
          const sidgadParent = sidgadComps[config.parent];
          if (sidgadParent && sidgadParent.classificationByGroup && sidgadParent.classificationByGroup[jokComp.id]) {
            const groupClass = sidgadParent.classificationByGroup[jokComp.id];
            if (groupClass && groupClass.length > 0) {
              jokComp.classification = groupClass;
              jokComp.classificationSource = "fecapa";
            }
          }

          // Carregar calendari de Sidgad per a aquest grup (filtra matches per idc)
          if (sidgadParent && sidgadParent.matches) {
            const groupMatches = sidgadParent.matches.filter(m => m.idc === String(jokComp.id));
            if (groupMatches.length > 0) {
              jokComp.calendar = groupMatches;
            }
          }
        }
      }
    }
  }

  // Garantir que sempre hi hagi font de classificació coherent.
  for (const comps of Object.values(categories)) {
    for (const comp of comps) {
      if (comp.classificationSource === "fecapa") continue;
      comp.classificationSource = (comp.classification && comp.classification.length > 0) ? "jok" : "none";
    }
  }

  console.log(`   🔗 Sidgad (primary): ${mergedCount} competicions fusionades, ${Object.keys(sidgadParentMap).length} jok.cat assignats a parent sidgad, ${nIdcMatched} per idc directe${nCopaNameMatched > 0 ? `, ${nCopaNameMatched} per Copa name matching` : ''}`);
  return { categories, sidgadParentMap, sidgadChildren };
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

  migrateActes(output);
  await loadPendingActes(output);
  await enrichJugadors(output.jugadors);

  // Build compId → catSlug lookup
  const compIdToCat = {};
  for (const [catName, comps] of Object.entries(output.categories)) {
    for (const comp of comps) compIdToCat[comp.id] = catName;
  }

  // Build actesIndex (actaId → catSlug) and group actes by category
  const actesIndex = {};
  const actesByCat = {};
  for (const [actaId, acta] of Object.entries(output.actes || {})) {
    const slug = catSlug(compIdToCat[acta.compId] || "Altres");
    actesIndex[actaId] = slug;
    if (!actesByCat[slug]) actesByCat[slug] = {};
    actesByCat[slug][actaId] = acta;
  }

  // Write per-category actes files
  const actesDir = path.join(__dirname, "../public/actes");
  await fs.mkdir(actesDir, { recursive: true });
  for (const [slug, actes] of Object.entries(actesByCat)) {
    const filePath = path.join(actesDir, `${slug}.json`);
    await fs.writeFile(filePath, JSON.stringify(actes));
    const count = Object.keys(actes).length;
    const kb2 = (JSON.stringify(actes).length / 1024).toFixed(0);
    console.log(`   📁 actes/${slug}.json — ${count} actes, ${kb2} KB`);
  }

  // Enriquiment addicional: equips per jugador
  buildPlayerTeamStats(output.jugadors, output.actes, compIdToCat);
  await mergeSidgadData(output.jugadors);

  // MODE JOK.CAT PUR:
  // mantenim l'estructura creada però no alterem categories/classificacions
  // amb fusions de competicions SIDGAD.
  for (const comps of Object.values(output.categories)) {
    for (const comp of comps) {
      comp.classificationSource = (comp.classification && comp.classification.length > 0) ? "jok" : "none";
    }
  }
  const sidgadParentMap = {};
  const sidgadChildren = {};

  // Write main data.json without actes, with actesIndex
  const { actes: _actes, ...outputMain } = output;
  outputMain.actesIndex = actesIndex;
  outputMain.sidgadParentMap = sidgadParentMap;
  outputMain.sidgadChildren  = sidgadChildren;
  outputMain.lastUpdate = new Date().toISOString();

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(outputMain, null, 2));

  const elapsed = ((Date.now()-t0)/1000).toFixed(1);
  const kb      = (JSON.stringify(outputMain).length / 1024).toFixed(0);
  console.log(`\n✅ Fet en ${elapsed}s — ${done} competicions, ${errors} errors, ${kb} KB`);
  console.log(`   → ${DATA_FILE}`);

  const stats = Object.entries(categories)
    .filter(([,v]) => v.length > 0)
    .map(([k,v]) => `${k.split(" ")[0]}:${v.length}`)
    .join(" ");
  console.log(`   ${stats}`);

  // ── Stats ────────────────────────────────────────────────────
  const statsFile    = path.join(__dirname, "../public/scraper-stats.json");
  const jAll         = Object.values(outputMain.jugadors).filter(j => j.jugadorId);
  const jugadorsStats = {
    runAt:     new Date().toISOString(),
    total:     jAll.length,
    enrichits: jAll.filter(j => j.enrichedAt).length,
    pendents:  jAll.filter(j => !j.enrichedAt).length,
  };
  let statsData = {};
  try { statsData = JSON.parse(await fs.readFile(statsFile, "utf8")); } catch { /* fitxer nou */ }
  statsData.jugadors = jugadorsStats;
  await fs.writeFile(statsFile, JSON.stringify(statsData, null, 2));
  console.log(`   📊 Stats → ${statsFile}`);
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
