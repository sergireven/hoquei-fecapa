#!/usr/bin/env node
/**
 * FECAPA Categories Scraper
 * Ejecutable para GitHub Actions y CLI
 * 
 * Uso:
 *   node api/scraper-fecapa-categories.js [--snapshot] [--output file.json]
 */

const fs = require("fs").promises;
const path = require("path");

// Importar la función principal de fecapa-categories
const { getCategoriesData } = require("./fecapa-categories");

async function main() {
  const args = process.argv.slice(2);
  const liveMode = !args.includes("--snapshot");
  const outputIdx = args.indexOf("--output");
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;

  const timestamp = new Date().toISOString();
  console.log(`🏒 FECAPA Categories Scraper — ${timestamp}`);
  console.log(`   Mode: ${liveMode ? "LIVE SCRAPING" : "SNAPSHOT"}`);
  console.log("");

  try {
    console.log("📚 Carregant dades de categories...");
    const data = await getCategoriesData({ liveMode });

    if (!data.ok) {
      console.error("❌ Error:", data.degraded ? "Degraded mode" : "Failed");
      if (data.errors && data.errors.length > 0) {
        console.error("   Errors:", data.errors);
      }
      process.exit(1);
    }

    const { fetchedCompetitions, failedCompetitions, categories } = data;
    console.log(`✓ Carregades ${fetchedCompetitions} competicions`);
    if (failedCompetitions > 0) {
      console.log(`⚠️  ${failedCompetitions} errors durant el fetch`);
    }

    console.log("\n📊 Categories:");
    for (const [cat, comps] of Object.entries(categories)) {
      console.log(`   ${cat.toUpperCase()}: ${comps.length} competitions`);
      comps.slice(0, 3).forEach(c => {
        console.log(`      - ${c.competitionName} (${c.groupCount} groups, ${c.teamCount} teams)`);
      });
      if (comps.length > 3) console.log(`      ... and ${comps.length - 3} more`);
    }

    // Guardar en archivo si se especifica
    if (outputFile) {
      const outPath = path.resolve(process.cwd(), outputFile);
      await fs.writeFile(outPath, JSON.stringify(data, null, 2));
      console.log(`\n✅ Dades guardades a: ${outPath}`);
    }

    console.log(`\n✅ Scraper completat a ${new Date().toISOString()}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal error:", err.message);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();
