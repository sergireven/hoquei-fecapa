// ============================================================
// FECAPA Hockey Scraper v2
// Uses built-in https module — no external dependencies needed
// Run: node api/scraper.js
// ============================================================

const fs    = require("fs").promises;
const path  = require("path");
const https = require("https");
const http  = require("http");

const BASE      = "https://jok.cat";
const DATA_FILE = path.join(__dirname, "../public/data.json");
const DELAY_MS  = 500;
const sleep     = ms => new Promise(r => setTimeout(r, ms));

// ── Robust HTTP fetch (no external deps, follows redirects) ───
function fetchText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept":     "text/html,*/*;q=0.8",
        "Accept-Language": "ca,es;q=0.9",
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
const stripTags = s => s.replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ").trim();

// ── Parse competition list from jok.cat/competicions ─────────
// jok.cat returns a mix of HTML and Markdown links depending on the tool used.
// We handle both: <a href="..."> and [text](url) formats.
function parseCompetitionList(html) {
  const comps = [];
  const seen  = new Set();

  // Format 1: HTML anchors  <a href="/competicio/4301/bcn-prebenjami...">TEXT</a>
  const htmlRe = /href=["']https?:\/\/jok\.cat\/competicio\/(\d+)\/([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  let m;
  while ((m = htmlRe.exec(html)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    comps.push({ id, slug: m[2].split("?")[0], name: stripTags(m[3]) });
  }

  // Format 2: Markdown links  [TEXT](https://jok.cat/competicio/ID/slug)
  const mdRe = /\[([^\]]+)\]\(https?:\/\/jok\.cat\/competicio\/(\d+)\/([^)\s]+)\)/g;
  while ((m = mdRe.exec(html)) !== null) {
    const id = m[2];
    if (seen.has(id)) continue;
    seen.add(id);
    comps.push({ id, slug: m[3].split("?")[0], name: stripTags(m[1]) });
  }

  return comps;
}

// ── Parse classification table from a competition page ────────
function parseClassification(html) {
  const rows = [];

  // jok.cat classification appears as a table or as structured list
  // Try table rows first
  const tableRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = tableRe.exec(html)) !== null) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(c => stripTags(c[1]));
    // Expect: pos, team, pts, pj, pg, pe, pp, gf, gc  (9 cols)
    // or:     pos, team, pj, pg, pe, pp, gf, gc, pts  (common alt)
    if (cells.length >= 8 && /^\d+$/.test(cells[0]) && cells[1]) {
      const nums = cells.slice(2).map(n => parseInt(n) || 0);
      // Detect column order: if last col looks like pts (usually highest after pj)
      // Most common: pos, team, pj, pg, pe, pp, gf, gc, pts
      rows.push({
        pos:  parseInt(cells[0]),
        team: cells[1],
        pj:   nums[0] || 0,
        pg:   nums[1] || 0,
        pe:   nums[2] || 0,
        pp:   nums[3] || 0,
        gf:   nums[4] || 0,
        gc:   nums[5] || 0,
        pts:  nums[6] || nums[nums.length-1] || 0,
      });
    }
  }
  if (rows.length > 0) return rows;

  // Fallback: try Markdown-style table  | pos | team | ...
  const mdTableRe = /\|\s*(\d+)\s*\|\s*([^|]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|/g;
  while ((m = mdTableRe.exec(html)) !== null) {
    rows.push({
      pos:  parseInt(m[1]),
      team: m[2].trim(),
      pj:   parseInt(m[3]) || 0,
      pg:   parseInt(m[4]) || 0,
      pe:   parseInt(m[5]) || 0,
      pp:   parseInt(m[6]) || 0,
      gf:   parseInt(m[7]) || 0,
      gc:   parseInt(m[8]) || 0,
      pts:  0,
    });
  }
  return rows;
}

// ── Parse calendar/results from a competition page ────────────
function parseCalendar(html) {
  const matches = [];

  // Pattern: two team links + score, e.g.
  // /equip/123/TEAM+A ... 3 - 1 ... /equip/456/TEAM+B
  // We look for blocks that contain two team references and optional score
  const blockRe = /\/equip\/\d+\/([^"'\s<]+)[^]*?(\d+)\s*[-–]\s*(\d+)[^]*?\/equip\/\d+\/([^"'\s<]+)/gi;
  const seenPairs = new Set();
  let m;

  while ((m = blockRe.exec(html)) !== null) {
    const home = decodeURIComponent(m[1].replace(/\+/g," ")).replace(/_/g," ").trim();
    const away = decodeURIComponent(m[4].replace(/\+/g," ")).replace(/_/g," ").trim();
    const key  = `${home}|${away}|${m[2]}-${m[3]}`;
    if (seenPairs.has(key) || home === away) continue;
    seenPairs.add(key);
    matches.push({ home, homeScore: parseInt(m[2]), awayScore: parseInt(m[3]), away, played: true });
  }

  // Pending matches (no score between teams)
  const pendRe = /\/equip\/\d+\/([^"'\s<]+)[^]{1,200}?-[^]{1,200}?\/equip\/\d+\/([^"'\s<]+)/gi;
  // (too noisy — skip pending for now, frontend links to jok.cat for full calendar)

  return matches;
}

// ── Extract club IDs from img tags ────────────────────────────
function extractClubIds(html) {
  const ids = new Set();
  const re  = /logos_clubes\/(\d+)\./gi;
  let m;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return [...ids];
}

// ── Extract team entries ──────────────────────────────────────
function extractTeams(html) {
  const teams = [];
  const seen  = new Set();
  const re    = /\/equip\/(\d+)\/([^"'\s<]+)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const id   = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const name = decodeURIComponent(m[2].replace(/\+/g," ")).replace(/_/g," ").trim();
    teams.push({ id, name });
  }
  return teams;
}

// ── Scrape one competition page ───────────────────────────────
async function scrapeCompetition(comp) {
  const url  = `${BASE}/competicio/${comp.id}/${comp.slug}`;
  const html = await fetchText(url);
  await sleep(DELAY_MS);

  const classification = parseClassification(html);
  const calendar       = parseCalendar(html);
  const clubIds        = extractClubIds(html);
  const teams          = extractTeams(html);

  const pctM   = html.match(/(\d+)\s*%/);
  const pctPlayed = pctM ? parseInt(pctM[1]) : null;

  return { ...comp, classification, calendar, teams, clubIds, pctPlayed };
}

// ── Categorise competition by name ────────────────────────────
function categorise(name) {
  const n = name.toUpperCase();
  if (n.includes("NACIONAL"))                           return "Nacional Catalana";
  if (n.match(/\b1[AÀ]\b/) || n.includes("1A CATAL"))  return "1ª Catalana";
  if (n.match(/\b2[AÀ]\b/) || n.includes("2A CATAL"))  return "2ª Catalana";
  if (n.match(/\b3[AÀ]\b/) || n.includes("3A CATAL"))  return "3ª Catalana";
  if (n.includes("FEM"))                                return "Fem";
  if (n.includes("JÚNIOR") || n.includes("JUNIOR"))     return "Júnior";
  if (n.includes("JUVENIL"))                            return "Juvenil";
  if (n.includes("INFANTIL"))                           return "Infantil";
  if (n.includes("ALEVÍ") || n.includes("ALEVI"))       return "Aleví";
  if (n.includes("BENJAMÍ") || n.includes("BENJAMI"))   return "Benjamí";
  if (n.match(/PREBENJAM[IÍ]/) || n.includes("PB-"))    return "Prebenjamí";
  if (n.includes("MINIFEM"))                            return "Fem";
  if (n.includes("VETERANS") || n.includes("LCV"))      return "Veterans";
  return "Altres";
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log("🏒 FECAPA Scraper v2 — starting...\n");
  const t0 = Date.now();

  // 1 — Fetch competition list
  console.log("📋 Fetching competition list from jok.cat...");
  let listHtml;
  try {
    listHtml = await fetchText(`${BASE}/competicions`);
  } catch(e) {
    console.error("❌ Cannot reach jok.cat:", e.message);
    console.error("   Check your internet connection.");
    process.exit(1);
  }

  const allComps = parseCompetitionList(listHtml);
  console.log(`   Parsed ${allComps.length} competition links`);

  if (allComps.length === 0) {
    // Debug: show a snippet of what we got
    console.error("\n⚠️  No competitions found. HTML snippet:");
    console.error(listHtml.slice(0, 800));
    process.exit(1);
  }

  // 2 — Filter to current season 2025-26
  // Names look like: "BCN PREBENJAMI OR 1 (2025-26)" or "NACIONAL CATALANA MASCULINA (2025-26)"
  const current = allComps.filter(c =>
    c.name.includes("2025-26") ||
    c.name.includes("2025/26") ||
    c.slug.includes("2025-26")
  );
  console.log(`   Current season (2025-26): ${current.length} competitions`);
  console.log(`   Sample: ${current.slice(0,3).map(c=>c.name).join(" | ")}\n`);

  // 3 — Scrape each competition
  const categories = {
    "Nacional Catalana": [], "1ª Catalana": [], "2ª Catalana": [],
    "3ª Catalana": [], "Fem": [], "Júnior": [], "Juvenil": [],
    "Infantil": [], "Aleví": [], "Benjamí": [], "Prebenjamí": [],
    "Veterans": [], "Altres": [],
  };
  const clubIndex = {};
  let done = 0;

  for (const comp of current) {
    try {
      const data = await scrapeCompetition(comp);
      const cat  = categorise(comp.name);
      categories[cat].push(data);

      // Build club index: teamId → { name, clubId }
      data.teams.forEach((t, i) => {
        if (!clubIndex[t.id]) {
          clubIndex[t.id] = { name: t.name, clubId: data.clubIds[i] || null };
        }
      });

      done++;
      if (done % 10 === 0) {
        const elapsed = ((Date.now()-t0)/1000).toFixed(0);
        console.log(`   [${done}/${current.length}] ${elapsed}s — last: ${comp.name}`);
      }
    } catch(err) {
      console.error(`   ⚠️  Skipped "${comp.name}": ${err.message}`);
      const cat = categorise(comp.name);
      categories[cat].push({ ...comp, error: err.message, classification:[], calendar:[], teams:[], clubIds:[] });
    }
    await sleep(DELAY_MS);
  }

  // 4 — Write output
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
  console.log(`\n✅ Done in ${elapsed}s`);
  console.log(`   ${done} competitions scraped`);
  console.log(`   Saved → ${DATA_FILE}`);
  const stats = Object.entries(categories)
    .filter(([,v]) => v.length)
    .map(([k,v]) => `${k}:${v.length}`)
    .join(" | ");
  console.log(`   ${stats}`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
