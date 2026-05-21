#!/usr/bin/env node
/**
 * FECAPA Categories Scraper
 * Ejecutable para GitHub Actions y CLI
 * 
 * Uso:
 *   node api/scraper-fecapa-categories.js [--live] [--output file.json]
 */

const fs = require("fs").promises;
const path = require("path");

// Importar la función principal de fecapa-categories
const { getCategoriesData } = require("./fecapa-categories");

async function main() {
  const args = process.argv.slice(2);
  const liveModeRequested = args.includes("--live");
  const liveMode = false;
  const outputIdx = args.indexOf("--output");
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;
  const timeoutIdx = args.indexOf("--competition-timeout-ms");
  const timeoutArg = timeoutIdx !== -1 ? parseInt(args[timeoutIdx + 1], 10) : null;
  const timeoutEnv = process.env.FECAPA_COMP_TIMEOUT_MS ? parseInt(process.env.FECAPA_COMP_TIMEOUT_MS, 10) : null;
  const competitionTimeoutMs = Number.isFinite(timeoutArg) && timeoutArg > 0
    ? timeoutArg
    : (Number.isFinite(timeoutEnv) && timeoutEnv > 0 ? timeoutEnv : 45000);
  const categoryArgs = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--category" && args[i + 1]) {
      categoryArgs.push(String(args[i + 1]).trim());
      i += 1;
    }
  }

  const timestamp = new Date().toISOString();
  console.log(`🏒 FECAPA Categories Scraper — ${timestamp}`);
  console.log(`   Mode: SNAPSHOT`);
  if (liveModeRequested) {
    console.log("   ⚠️  --live ignorat (mode desactivat; pipeline estable de snapshot)");
  }
  console.log(`   Competition timeout: ${competitionTimeoutMs}ms`);
  if (categoryArgs.length) {
    console.log(`   Category filter: ${categoryArgs.join(", ")}`);
  }
  console.log("");

  try {
    console.log("📚 Carregant dades de categories...");
    const data = await getCategoriesData({
      liveMode,
      categoriesFilter: categoryArgs.length ? categoryArgs : null,
      competitionTimeoutMs,
    });

    if (!data.ok) {
      console.error("❌ Error:", data.degraded ? "Degraded mode" : "Failed");
      if (data.errors && data.errors.length > 0) {
        console.error("   Errors:", data.errors);
      }
      process.exit(1);
    }

    const { fetchedCompetitions, failedCompetitions, categories } = data;
    const totalGroups = Number.isFinite(data?.totalGroups)
      ? data.totalGroups
      : Object.values(categories || {}).reduce((acc, comps) => {
        const arr = Array.isArray(comps) ? comps : [];
        return acc + arr.reduce((sum, comp) => sum + (comp?.groupCount || 0), 0);
      }, 0);
    console.log(`✓ Carregades ${fetchedCompetitions} competicions`);
    if (failedCompetitions > 0) {
      console.log(`⚠️  ${failedCompetitions} errors durant el fetch`);
      const samples = (data.errors || []).slice(0, 8);
      if (samples.length) {
        console.log("   Mostra d'errors:");
        samples.forEach((e, i) => {
          console.log(`   ${i + 1}. [${e.competitionId || "n/a"}] ${e.competitionName || "?"} -> ${e.error || "unknown"}`);
        });
      }
    }

    console.log("\n📊 Categories:");
    for (const [cat, comps] of Object.entries(categories)) {
      console.log(`   ${cat.toUpperCase()}: ${comps.length} competitions`);
      comps.forEach(c => {
        console.log(`      - [${c.competitionId || "n/a"}] ${c.competitionName} (${c.groupCount} groups, ${c.teamCount} teams)`);
      });
    }

    console.log(`\n🔢 Total grups obtinguts: ${totalGroups}`);

    // Guardar en archivo si se especifica
    if (outputFile) {
      const outPath = path.resolve(process.cwd(), outputFile);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
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
