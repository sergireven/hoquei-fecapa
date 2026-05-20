const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../public/data.json");
const ACTES_DIR = path.join(__dirname, "../public/actes");

function catSlug(catName) {
  return String(catName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildPlayerTeamStats(jugadors, actes, compIdToCat) {
  const counts = {}; // jugadorId → { "teamName|catSlug" → count }

  for (const [, acta] of Object.entries(actes || {})) {
    if (!acta.playerStats) continue;
    const cat = catSlug(compIdToCat[acta.compId] || "Altres");

    const addGroup = (players, team) => {
      for (const p of (players || [])) {
        const m = p.url?.match(/\/jugador\/(\d+)\//);
        if (!m) continue;
        const jid = m[1];
        if (!counts[jid]) counts[jid] = {};
        const key = `${team || "?"}|${cat}`;
        counts[jid][key] = (counts[jid][key] || 0) + 1;
      }
    };

    addGroup(acta.playerStats.homePlayers, acta.home);
    addGroup(acta.playerStats.awayPlayers, acta.away);
  }

  for (const [jid, entries] of Object.entries(counts)) {
    const player = jugadors[jid];
    if (!player) continue;
    player.teamStats = Object.entries(entries)
      .map(([key, count]) => {
        const [team, cat] = key.split("|");
        return { team, cat, count };
      })
      .sort((a, b) => b.count - a.count);
  }

  console.log(`   📊 teamStats recalculats per a ${Object.keys(counts).length} jugadors`);
}

async function main() {
  const dataRaw = await fs.promises.readFile(DATA_FILE, "utf8");
  const data = JSON.parse(dataRaw);

  const compIdToCat = {};
  for (const [catName, comps] of Object.entries(data.categories || {})) {
    for (const comp of comps) compIdToCat[comp.id] = catName;
  }

  const actes = {};
  const files = (await fs.promises.readdir(ACTES_DIR)).filter(f => f.endsWith(".json"));
  for (const file of files) {
    const catRaw = await fs.promises.readFile(path.join(ACTES_DIR, file), "utf8");
    Object.assign(actes, JSON.parse(catRaw));
  }

  console.log(`Loaded ${Object.keys(actes).length} actes from ${files.length} files`);

  buildPlayerTeamStats(data.jugadors, actes, compIdToCat);

  // Verify Airam
  const airam = data.jugadors["74228"];
  console.log("\nAiram Cordoba (74228) teamStats:");
  for (const ts of airam?.teamStats || []) {
    if (ts.team.includes("Ripollet")) console.log(`  ${ts.team} (${ts.cat}): ${ts.count}`);
  }

  await fs.promises.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  console.log("\n✅ data.json actualitzat");
}

main().catch(err => { console.error(err); process.exit(1); });
