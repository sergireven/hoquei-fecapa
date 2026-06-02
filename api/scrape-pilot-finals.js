const fs = require("fs");
const path = require("path");

const { getPilotFinalsData } = require("./finals-pilot");

function getArg(name, fallback = "") {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return fallback;
  return String(process.argv[idx + 1] || fallback);
}

async function main() {
  const jokCompId = getArg("--jok-comp-id", "4709");
  const slug = getArg("--slug", "alevi-copa-catalana-plata-fase-final-2025-26");
  const output = getArg("--output", path.join("public", `pilot-finals-${jokCompId}.json`));
  const strict = process.argv.includes("--strict");

  const data = await getPilotFinalsData({ jokCompId, slug });
  if (!data?.ok) {
    throw new Error(`Pilot scrape failed: ${data?.error || "unknown error"}`);
  }

  const outPath = path.resolve(process.cwd(), output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));

  const phases = Array.isArray(data.phases) ? data.phases.length : 0;
  const matchCount = Number(data.matchCount || 0);
  const jokCount = Number(data?.sources?.jok?.matchCount || 0);
  const fecapaCount = Number(data?.sources?.fecapa?.matchCount || 0);

  console.log(`[pilot-finals] output: ${outPath}`);
  console.log(`[pilot-finals] phases=${phases} matches=${matchCount} jok=${jokCount} fecapa=${fecapaCount}`);

  if (strict && matchCount <= 0) {
    throw new Error("strict mode enabled and matchCount=0");
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
