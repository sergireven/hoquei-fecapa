// ============================================================
// FECAPA Hockey Scraper v4
// Parseja HTML real de jok.cat (Laravel + Vue SSR)
// ============================================================

const fs    = require("fs").promises;
const path  = require("path");
const https = require("https");
const http  = require("http");

const BASE      = "https://jok.cat";
const DATA_FILE = path.join(__dirname, "../public/data.json");
const DELAY_MS  = 600;
const sleep     = ms => new Promise(r => setTimeout(r, ms));

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
// Structure varies — try multiple patterns:
// Pattern A: <tr> rows with <td> cells (table)
// Pattern B: JSON embedded in page (some Vue pages use __INITIAL_STATE__)
function parseClassification(html) {
  // Try embedded JSON first (most reliable)
  const jsonRe = /"classificacio"\s*:\s*(\[[\s\S]*?\])\s*[,}]/;
  const jsonM  = jsonRe.exec(html);
  if (jsonM) {
    try {
      const data = JSON.parse(jsonM[1]);
      return data.map((r, i) => ({
        pos:    r.posicio   || r.pos    || i + 1,
        team:   r.equip     || r.nom    || r.name || "",
        teamId: r.equip_id  || r.id     || null,
        clubId: r.club_id   || null,
        pts:    r.punts     || r.pts    || 0,
        pj:     r.jugats    || r.pj     || 0,
        pg:     r.guanyats  || r.pg     || 0,
        pe:     r.empats    || r.pe     || 0,
        pp:     r.perduts   || r.pp     || 0,
        gf:     r.gf        || 0,
        gc:     r.gc        || 0,
      }));
    } catch {}
  }

  // Try HTML table rows
  const rows = [];
  // Look for table containing classification data
  // Typical jok.cat table: pos | team-link | pts | pj | pg | pe | pp | gf | gc
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trM;
  while ((trM = trRe.exec(html)) !== null) {
    const row  = trM[1];
    const tds  = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => strip(c[1]));
    if (tds.length < 8) continue;
    if (!/^\d{1,2}$/.test(tds[0])) continue; // first cell must be position number

    // Extract teamId from link in second cell
    const linkM = /<a[^>]*href="[^"]*\/equip\/(\d+)\/[^"]*"[^>]*>([^<]+)<\/a>/i.exec(row);
    const teamId = linkM ? linkM[1] : null;
    const team   = linkM ? strip(linkM[2]) : tds[1];

    // Extract clubId from img in row
    const imgM  = /logos_clubes\/(\d+)[._]/i.exec(row);
    const clubId = imgM ? imgM[1] : null;

    const nums = tds.slice(2).map(n => parseInt(n)).filter(n => !isNaN(n));
    if (nums.length < 6) continue;

    rows.push({
      pos: parseInt(tds[0]), team, teamId, clubId,
      pts: nums[0], pj: nums[1], pg: nums[2],
      pe:  nums[3], pp: nums[4], gf: nums[5], gc: nums[6] || 0,
    });
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

// ── Extract club ID → team ID mappings ────────────────────────
function extractClubInfo(html) {
  const map = {};
  // <img src=".../logos_clubes/278.gif"...> near <a href=".../equip/10349/...">
  const re = /logos_clubes\/(\d+)[._][^"']+["'][^>]*>[\s\S]{0,200}?\/equip\/(\d+)\//gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!map[m[2]]) map[m[2]] = m[1]; // teamId → clubId
  }
  // Also reverse: equip link near logo
  const re2 = /\/equip\/(\d+)\/[^"']+["'][^>]*>[\s\S]{0,200}?logos_clubes\/(\d+)[._]/gi;
  while ((m = re2.exec(html)) !== null) {
    if (!map[m[1]]) map[m[1]] = m[2];
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

// ── Scrape one competition ────────────────────────────────────
async function scrapeCompetition(comp) {
  const url  = `${BASE}/competicio/${comp.id}/${comp.slug}`;
  const html = await fetchText(url);
  await sleep(DELAY_MS);

  const classification = parseClassification(html);
  const calendar       = parseCalendar(html);
  const teamToClub     = extractClubInfo(html);
  const teams          = extractTeams(html);

  // Add clubId to classification rows
  classification.forEach(r => {
    if (r.teamId) r.clubId = r.clubId || teamToClub[r.teamId] || null;
  });

  const pctM      = html.match(/(\d+)\s*%\s*jugat/i) || html.match(/(\d+)%/);
  const pctPlayed = pctM ? Math.min(100, parseInt(pctM[1])) : null;

  return { ...comp, classification, calendar, teams, teamToClub, pctPlayed };
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
  if (n.includes("BENJAMÍ") || n.includes("BENJAMI"))   return "Benjamí";
  if (n.match(/PREBENJAM[IÍ]/) || n.includes("PB-"))    return "Prebenjamí";
  if (n.includes("VETERANS") || n.includes("LCV"))      return "Veterans";
  return "Altres";
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log("🏒 FECAPA Scraper v4 — iniciant...\n");
  const t0 = Date.now();

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
  let done = 0, errors = 0;

  for (const comp of current) {
    try {
      const data = await scrapeCompetition(comp);
      const cat  = categorise(comp.name);
      categories[cat].push(data);

      data.teams.forEach(t => {
        if (!clubIndex[t.id]) {
          clubIndex[t.id] = { name: t.name, clubId: data.teamToClub[t.id] || null };
        }
      });
      data.classification.forEach(r => {
        if (r.teamId) {
          if (!clubIndex[r.teamId]) clubIndex[r.teamId] = { name: r.team, clubId: r.clubId };
          else if (r.clubId) clubIndex[r.teamId].clubId = r.clubId;
        }
      });

      done++;
      if (done % 10 === 0 || done <= 5) {
        const elapsed = ((Date.now()-t0)/1000).toFixed(0);
        console.log(`   [${done}/${current.length}] ${elapsed}s — ${comp.name} (cl:${data.classification.length} cal:${data.calendar.length})`);
      }
    } catch(err) {
      errors++;
      console.error(`   ⚠️  Error "${comp.name}": ${err.message}`);
      categories[categorise(comp.name)].push({
        ...comp, error: err.message,
        classification: [], calendar: [], teams: [], teamToClub: {}
      });
    }
    await sleep(DELAY_MS);
  }

  const output = {
    updatedAt:  new Date().toISOString(),
    season:     "2025-26",
    totalComps: done,
    categories,
    clubIndex,
  };

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
