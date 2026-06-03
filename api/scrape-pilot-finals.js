const fs = require("fs");
const path = require("path");

const { getPilotFinalsData } = require("./finals-pilot");
const { getPilotFinalsData, PILOT_COMPETITIONS } = require("./finals-pilot");

function getArg(name, fallback = "") {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return fallback;
  return String(process.argv[idx + 1] || fallback);
}

function printSummary(jokCompId, outPath, data) {
  const phases = Array.isArray(data.phases) ? data.phases.length : 0;
  const matchCount = Number(data.matchCount || 0);
  const jokCount = Number(data?.sources?.jok?.matchCount || 0);
  const fecapaCount = Number(data?.sources?.fecapa?.matchCount || 0);
  const placeholders = Number(data?.placeholdersCount || 0);
  const jokUrl = String(data?.sources?.jok?.url || "");
  const fecapaUrl = String(data?.sources?.fecapa?.url || "");
  const jokErr = data?.sources?.jok?.error || null;
  const fecapaErr = data?.sources?.fecapa?.error || null;
  const jokPhases = Array.isArray(data?.sources?.jok?.phaseNames) ? data.sources.jok.phaseNames : [];
  const fecapaPhases = Array.isArray(data?.sources?.fecapa?.phaseNames) ? data.sources.fecapa.phaseNames : [];

  console.log(`[pilot-finals] output: ${outPath}`);
  console.log(`[pilot-finals] target jokCompId=${jokCompId}`);
  console.log(`[pilot-finals] source.jok url=${jokUrl}`);
  console.log(`[pilot-finals] source.fecapa url=${fecapaUrl}`);
  console.log(`[pilot-finals] phases=${phases} matches=${matchCount} placeholders=${placeholders}`);
  console.log(`[pilot-finals] source-counts jok=${jokCount} fecapa=${fecapaCount}`);
  console.log(`[pilot-finals] source-phases jok=[${jokPhases.join(" | ")}]`);
  console.log(`[pilot-finals] source-phases fecapa=[${fecapaPhases.join(" | ")}]`);
  console.log(`[pilot-finals] source-errors jok=${jokErr || "none"} fecapa=${fecapaErr || "none"}`);

  for (const phase of (data.phases || [])) {
    const ms = phase?.matches || [];
    const played = ms.filter(m => m?.homeScore != null && m?.awayScore != null).length;
    const placeholdersInPhase = ms.filter(m => m?.placeholder === true).length;
    const withVenue = ms.filter(m => String(m?.venue || "").trim()).length;
    console.log(`[pilot-finals] phase="${phase.phaseName}" total=${ms.length} played=${played} placeholders=${placeholdersInPhase} withVenue=${withVenue}`);
  }
}

async function scrapeOne(jokCompId, slug, output, strict) {
  const data = await getPilotFinalsData({ jokCompId, slug });
  if (!data?.ok) {
    throw new Error(`Pilot scrape failed for ${jokCompId}: ${data?.error || "unknown error"}`);
  }
  const outPath = path.resolve(process.cwd(), output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  printSummary(jokCompId, outPath, data);
  if (strict && Number(data.matchCount || 0) <= 0) {
    throw new Error(`strict mode: matchCount=0 for ${jokCompId}`);
  }
}

async function main() {
  const jokCompId = getArg("--jok-comp-id", "");
  const slug = getArg("--slug", "");
  const outputArg = getArg("--output", "");
  const strict = process.argv.includes("--strict");

  // If a specific comp ID is given, scrape just that one (legacy behaviour)
  if (jokCompId) {
    const config = PILOT_COMPETITIONS[jokCompId] || {};
    const resolvedSlug = slug || config.slug || "";
    const resolvedOutput = outputArg || path.join("public", `pilot-finals-${jokCompId}.json`);
    await scrapeOne(jokCompId, resolvedSlug, resolvedOutput, strict);
    return;
  }

  // No comp ID given — scrape ALL competitions defined in PILOT_COMPETITIONS
  const ids = Object.keys(PILOT_COMPETITIONS);
  console.log(`[pilot-finals] scraping all ${ids.length} pilot competitions: ${ids.join(", ")}`);
  const errors = [];
  for (const id of ids) {
    const config = PILOT_COMPETITIONS[id];
    const outPath = path.join("public", `pilot-finals-${id}.json`);
    console.log(`\n[pilot-finals] === ${id} ===`);
    try {
      await scrapeOne(id, config.slug || "", outPath, false);
    } catch (err) {
      console.error(`[pilot-finals] ERROR for ${id}: ${err.message}`);
      errors.push({ id, error: err.message });
    }
  }
  if (errors.length) {
    console.error(`[pilot-finals] ${errors.length} competition(s) failed: ${errors.map(e => e.id).join(", ")}`);
    if (strict) process.exit(1);
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
