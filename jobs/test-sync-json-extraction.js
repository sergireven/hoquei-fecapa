/**
 * Test: Validar lògica d'extracció de JSON sense necessitat de Supabase
 * Ús: node jobs/test-sync-json-extraction.js
 * 
 * Verifica:
 * - Lectura de JSON
 * - Extracció de clubs
 * - Extracció de teams
 * - Extracció de jugadors
 */

const fs = require("fs").promises;
const path = require("path");

// Importar funcions de extracció
const {
  extractClubsFromCategories,
  extractTeamsFromCategories,
  extractPlayersFromDb,
} = require("../api/sync-db-from-json");

async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`❌ Could not read ${filePath}:`, err.message);
    return null;
  }
}

async function testSeasonExtraction(seasonLabel, dataPath) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🧪 Testing season: ${seasonLabel}`);
  console.log(`   File: ${dataPath}`);
  console.log("=".repeat(60));

  const data = await readJsonFile(dataPath);
  if (!data) {
    console.log("⏭️  Skipped (file not found)");
    return;
  }

  // Extract clubs
  const clubs = extractClubsFromCategories(data.categories || {});
  console.log(`\n🏢 Clubs extracted: ${clubs.length}`);
  if (clubs.length > 0) {
    console.log("   Examples:");
    clubs.slice(0, 3).forEach((c, i) => {
      console.log(`     ${i + 1}. ${c.displayName}`);
    });
    if (clubs.length > 3) console.log(`     ... and ${clubs.length - 3} more`);
  }

  // Extract teams
  const season = seasonLabel.replace("season:", "").trim();
  const teams = extractTeamsFromCategories(data.categories || {}, season);
  console.log(`\n🏒 Teams extracted: ${teams.length}`);
  if (teams.length > 0) {
    console.log("   Examples:");
    teams.slice(0, 3).forEach((t, i) => {
      console.log(`     ${i + 1}. ${t.team_name} (${t.category}) @ ${t.club_name}`);
    });
    if (teams.length > 3) console.log(`     ... and ${teams.length - 3} more`);
  }

  // Extract players
  const players = extractPlayersFromDb(data, season);
  console.log(`\n👥 Players extracted: ${players.length}`);
  if (players.length > 0) {
    console.log("   Examples:");
    players.slice(0, 3).forEach((p, i) => {
      console.log(`     ${i + 1}. ${p.name} (#${p.dorsal || "?"}) ${p.is_goalkeeper ? "[🧤 GK]" : ""}`);
    });
    if (players.length > 3) console.log(`     ... and ${players.length - 3} more`);
  }

  // Summary
  console.log(`\n📊 Summary:`);
  console.log(`   Clubs:  ${clubs.length}`);
  console.log(`   Teams:  ${teams.length}`);
  console.log(`   Players: ${players.length}`);
}

async function main() {
  const publicDir = path.join(__dirname, "../public");

  console.log("🔍 JSON Extraction Test Suite");
  console.log("Tests extraction logic without Supabase\n");

  // Test current season
  await testSeasonExtraction(
    "current (2025-26)",
    path.join(publicDir, "data.json")
  );

  // Test archive seasons
  const seasons = ["2021-22", "2022-23", "2023-24", "2024-25"];
  for (const season of seasons) {
    await testSeasonExtraction(
      `season: ${season}`,
      path.join(publicDir, "season-archive", `data-${season}.json`)
    );
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ Test suite completed");
  console.log("=".repeat(60));
  console.log("\nNext step: Verify extractions look correct, then run:");
  console.log("  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \\");
  console.log("  node -e \"require('./api/sync-db-from-json').syncAllSeasonsToDatabase(sb, './public')\"");
}

main().catch(console.error);
