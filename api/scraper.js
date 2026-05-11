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

const SEASONS = ["2025-26"];
const SEASON  = SEASONS[SEASONS.length - 1];

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
function parseCompetitionList(html, season = SEASON) {
  const comps = [];
  const seen  = new Set();

  const seasonStart = html.indexOf(`data-season="${season}"`);
  if (seasonStart === -1) return [];

  const nextSeasonStart = html.indexOf('data-season="', seasonStart + 1);
  const block = nextSeasonStart !== -1
    ? html.slice(seasonStart, nextSeasonStart)
    : html.slice(seasonStart);

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
function parseClassification(html) {
  const rows = [];

  const blockStart = html.indexOf("classCol-team");
  if (blockStart === -1) return rows;
  const blockEnd = html.indexOf("Equip m\u00E9s golejador");
  const section  = blockEnd !== -1 ? html.slice(0, blockEnd) : html;

  const rowRe = /<div\s+class='bg-white\s+w-full[^']*flex'>([\s\S]*?)<\/div>\s*(?=<div\s+class='bg-white|<div\s+class="mt-2|$)/g;
  let m;
  while ((m = rowRe.exec(section)) !== null) {
    const row = m[1];

    const posM = row.match(/class='[^']*w-1\/12[^']*'[^>]*>\s*(\d{1,2})\s*<\/div>/);
    if (!posM) continue;
    const pos = parseInt(posM[1]);

    const teamM = row.match(/class='[^']*classCol-team[^']*'[^>]*>[\s\S]*?href="\/equip\/(\d+)\/[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/);
    if (!teamM) continue;
    const teamId = teamM[1];
    const team   = teamM[2].trim().replace(/\s+/g, " ");

    const clubM  = row.match(/logos_clubes\/([^"'\s>]+)/);
    const clubId = clubM ? clubM[1].split("?")[0] : null;

    const ptsM = row.match(/class='[^']*bg-neutral-700[^']*'[^>]*>\s*(\d+)\s*<\/div>/);
    const pts  = ptsM ? parseInt(ptsM[1]) : 0;

    const pjM = row.match(/class='[^']*classCol-extra\s+hidden[^']*bg-neutral-200[^']*'[^>]*>\s*(\d+)\s*<\/div>/);
    const pj  = pjM ? parseInt(pjM[1]) : 0;

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
function parseCalendar(html) {
  const matches = [];
  const seen    = new Set();

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

  const jornades = html.split(/Jornada\s+(\d+)/i);

  for (let i = 1; i < jornades.length; i += 2) {
    const jornada = parseInt(jornades[i]);
    const block   = jornades[i + 1] || "";

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
  const logos  = [];
  const equips = [];
  let m;

  const re1 = /logos_clubes\/([^"'\s>]+)/gi;
  while ((m = re1.exec(html)) !== null) {
    const fname   = m[1].split("?")[0];
    const clubId  = fname.replace(/[._].*$/, "");
    logos.push({ clubId, fname, pos: m.index });
  }

  const re2 = /\/equip\/(\d+)\//gi;
  while ((m = re2.exec(html)) !== null) equips.push({ teamId: m[1], pos: m.index });

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

function parseScorers(html) {
  const scorers = [];
  const gIdx = html.indexOf("Golejadors");
  if (gIdx === -1) return scorers;

  const section = html.slice(gIdx, gIdx + 8000);
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
    if (scorers.length >= 10) break;
  }
  return scorers;
}

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
async function scrapeCompetition(comp, season) {
  // season preparada per futures rutes, query params o snapshots
  const url  = `${BASE}/competicio/${comp.id}/${comp.slug}`;
  const html = await fetchText(url);
  await sleep(DELAY_MS);

  const classification = parseClassification(html);
  const rawCalendar    = parseCalendar(html);
  const calendar       = rawCalendar;
  const teamToClub     = extractClubInfo(html);
  const teams          = extractTeams(html);
  const teamScorers    = {};

  classification.forEach(r => {
    if (r.teamId) r.clubId = r.clubId || teamToClub[r.teamId] || null;
  });

  const pctM      = html.match(/(\d+)\s*%\s*jugat/i) || html.match(/(\d+)%/);
  const pctPlayed = pctM ? Math.min(100, parseInt(pctM[1])) : null;

  return { ...comp, classification, calendar, teams, teamToClub, teamScorers, pctPlayed, season };
}

// ── Categorise ────────────────────────────────────────────────
function categorise(name) {
  const n = name.toUpperCase();
  if (n.includes("NACIONAL"))                           return "Nacional Catalana";
  if (n.match(/\b1[AÀ]\b/) || n.includes("1A CATAL"))  return "1ª Catalana";
  if (n.match(/\b2[AÀ]\b/) || n.includes("2A CATAL"))  return "2ª Catalana";
  if (n.match(/\b3[AÀ]\b/) || n.includes("3A CATAL"))  return "3ª Catalana";
  if (n.includes("FEM") || n.includes("MINIFEM"))      return "Fem";
  if (n.includes("JÚNIOR") || n.includes("JUNIOR"))    return "Júnior";
  if (n.includes("JUVENIL"))                           return "Juvenil";
  if (n.includes("INFANTIL"))                          return "Infantil";
  if (n.includes("ALEVÍ") || n.includes("ALEVI"))      return "Aleví";
  if (n.match(/PREBENJAM[IÍ]/) || n.includes("PB-"))   return "Prebenjamí";
  if (n.includes("BENJAMÍ") || n.includes("BENJAMI"))  return "Benjamí";
  if (n.includes("VETERANS") || n.includes("LCV"))     return "Veterans";
  return "Altres";
}

function createEmptyCategories() {
  return {
    "Nacional Catalana": [], "1ª Catalana": [], "2ª Catalana": [],
    "3ª Catalana": [], "Fem": [], "Júnior": [], "Juvenil": [],
    "Infantil": [], "Aleví": [], "Benjamí": [], "Prebenjamí": [],
    "Veterans": [], "Altres": [],
  };
}

async function scrapeSeason(season) {
  console.log(`📋 Carregant llista de competicions de ${season}...`);

  let listHtml;
  try {
    listHtml = await fetchText(`${BASE}/competicions`);
  } catch (e) {
    throw new Error(`No es pot connectar a jok.cat: ${e.message}`);
  }

  const seasonPos = listHtml.indexOf(season);
  console.log(`   HTML rebut: ${listHtml.length} bytes, '${season}' a posició ${seasonPos}`);

  const current = parseCompetitionList(listHtml, season);
  console.log(`   Competicions trobades per ${season}: ${current.length}`);

  if (current.length === 0) {
    throw new Error(`No s'han trobat competicions per la temporada ${season}`);
  }

  const categories = createEmptyCategories();
  const clubIndex = {};
  let done = 0;
  let errors = 0;
  const CONCURRENCY = 8;

  for (let i = 0; i < current.length; i += CONCURRENCY) {
    const batch = current.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async comp => {
      try {
        const data = await scrapeCompetition(comp, season);
        return { ok: true, comp, data };
      } catch (err) {
        return { ok: false, comp, error: err.message };
      }
    }));

    for (const result of results) {
      if (result.ok) {
        const { data } = result;
        categories[categorise(data.name)].push(data);

        data.teams.forEach(t => {
          if (!clubIndex[t.id]) clubIndex[t.id] = { name: t.name, clubId: data.teamToClub[t.id] || null };
        });

        data.classification.forEach(r => {
          if (r.teamId) {
            if (!clubIndex[r.teamId]) clubIndex[r.teamId] = { name: r.team, clubId: r.clubId };
            else if (r.clubId) clubIndex[r.teamId].clubId = r.clubId;
          }
        });

        done++;
      } else {
        errors++;
        console.error(`   ⚠️  Error "${result.comp.name}" [${season}]: ${result.error}`);
        categories[categorise(result.comp.name)].push({
          ...result.comp,
          season,
          error: result.error,
          classification: [],
          calendar: [],
          teams: [],
          teamToClub: {},
          teamScorers: {},
          pctPlayed: null,
        });
      }
    }

    console.log(`   [${done}/${current.length}] ${season}`);
    await sleep(DELAY_MS);
  }

  return { categories, clubIndex, totalComps: done, errors };
}

function buildOutput(categoriesBySeason, clubIndexBySeason, currentSeason, totalCompsBySeason) {
  const availableSeasons = Object.keys(categoriesBySeason).sort();

  return {
    updatedAt: new Date().toISOString(),
    season: currentSeason,
    availableSeasons,
    totalComps: totalCompsBySeason[currentSeason] || 0,
    categories: categoriesBySeason[currentSeason] || {},
    clubIndex: clubIndexBySeason[currentSeason] || {},
    snapshots: Object.fromEntries(
      availableSeasons.map(season => [
        season,
        {
          categories: categoriesBySeason[season] || {},
          clubIndex: clubIndexBySeason[season] || {},
          totalComps: totalCompsBySeason[season] || 0,
        }
      ])
    )
  };
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log("🏒 FECAPA Scraper v5 — iniciant...\n");
  const t0 = Date.now();

  const categoriesBySeason = {};
  const clubIndexBySeason = {};
  const totalCompsBySeason = {};
  let totalErrors = 0;

  for (const season of SEASONS) {
    console.log(`\n📅 Temporada ${season}`);
    const result = await scrapeSeason(season);
    categoriesBySeason[season] = result.categories;
    clubIndexBySeason[season] = result.clubIndex;
    totalCompsBySeason[season] = result.totalComps;
    totalErrors += result.errors;
  }

  const output = buildOutput(categoriesBySeason, clubIndexBySeason, SEASON, totalCompsBySeason);

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(output, null, 2));

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const kb      = (JSON.stringify(output).length / 1024).toFixed(0);

  console.log(`\n✅ Fet en ${elapsed}s — ${output.totalComps} competicions temporada activa, ${totalErrors} errors, ${kb} KB`);
  console.log(`   → ${DATA_FILE}`);

  const stats = Object.entries(output.categories || {})
    .filter(([,v]) => v.length > 0)
    .map(([k,v]) => `${k.split(" ")[0]}:${v.length}`)
    .join(" ");
  console.log(`   ${stats}`);
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
