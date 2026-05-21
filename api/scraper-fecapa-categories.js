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

const VALIDATION_4452_EXPECTED_GROUPS = [
  "BCN BENJAMÍ OR COPA BCN 1",
  "BCN BENJAMÍ OR COPA BCN 2",
  "BCN BENJAMÍ OR COPA BCN 3",
  "BCN BENJAMÍ PLATA COPA BCN 4",
  "BCN BENJAMÍ PLATA COPA BCN 5",
  "BCN BENJAMÍ PLATA COPA BCN 6",
];

function normalizeName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function flattenCompetitions(categories) {
  return Object.values(categories || {}).flatMap(v => (Array.isArray(v) ? v : []));
}

function validateCompetition4452(data) {
  const comps = flattenCompetitions(data?.categories);
  const target = comps.find(c => String(c?.competitionId) === "4452");
  if (!target) {
    return {
      ok: false,
      reason: "Competition 4452 not found in scraped categories",
    };
  }

  const groups = Array.isArray(target.groups) ? target.groups : [];
  const normalizedActual = new Set(groups.map(g => normalizeName(g?.groupName)));
  const normalizedExpected = new Set(VALIDATION_4452_EXPECTED_GROUPS.map(normalizeName));

  const missingGroups = VALIDATION_4452_EXPECTED_GROUPS.filter(
    g => !normalizedActual.has(normalizeName(g))
  );

  const extraGroups = groups
    .map(g => String(g?.groupName || ""))
    .filter(g => g)
    .filter(g => !normalizedExpected.has(normalizeName(g)));

  const teamCount = groups.reduce((acc, g) => acc + (Number(g?.teamCount) || 0), 0);
  const groupCountOk = groups.length === 6;
  const teamCountOk = teamCount === 30;
  const namesOk = missingGroups.length === 0;

  return {
    ok: groupCountOk && teamCountOk && namesOk,
    details: {
      competitionName: target.competitionName,
      groupCount: groups.length,
      teamCount,
      missingGroups,
      extraGroups,
      actualGroups: groups.map(g => String(g?.groupName || "")),
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const liveMode = args.includes("--live");
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
  console.log(`   Mode: ${liveMode ? "LIVE SCRAPING" : "SNAPSHOT"}`);
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
      comps.slice(0, 3).forEach(c => {
        console.log(`      - ${c.competitionName} (${c.groupCount} groups, ${c.teamCount} teams)`);
      });
      if (comps.length > 3) console.log(`      ... and ${comps.length - 3} more`);
    }

    // Validation gate for CI: 4452 must match expected Classif.Base-equivalent structure
    const validation4452 = validateCompetition4452(data);
    if (!validation4452.ok) {
      console.error("\n❌ Validation failed for competition 4452");
      if (validation4452.reason) {
        console.error(`   Reason: ${validation4452.reason}`);
      }
      if (validation4452.details) {
        console.error(`   Competition: ${validation4452.details.competitionName || "unknown"}`);
        console.error(`   Group count: ${validation4452.details.groupCount} (expected 6)`);
        console.error(`   Team count: ${validation4452.details.teamCount} (expected 30)`);
        if (validation4452.details.missingGroups.length > 0) {
          console.error(`   Missing groups: ${validation4452.details.missingGroups.join(" | ")}`);
        }
        if (validation4452.details.extraGroups.length > 0) {
          console.error(`   Extra groups: ${validation4452.details.extraGroups.join(" | ")}`);
        }
      }
      process.exit(1);
    }

    console.log("\n✅ Validation 4452 OK (6 groups, 30 teams, expected names)");

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
