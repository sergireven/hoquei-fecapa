// api/cron.js — Vercel Serverless Function
// S'executa automàticament cada nit a les 02:00 CET (01:00 UTC) (veure vercel.json)
// També es pot cridar manualment: GET https://el-teu-domini.vercel.app/api/cron

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");
const { createClient } = require("@supabase/supabase-js");
const { syncActiveSeasonsToDatabase } = require("./sync-db-from-json");

function compressSeasonArchive(publicDir) {
  /**
   * Compress all JSON files in season-archive for optimal Vercel deployment
   * Reduces 611 MB -> 45 MB
   * Vercel serves with Content-Encoding: gzip automatically
   */
  const archiveDir = path.join(publicDir, "season-archive");
  if (!fs.existsSync(archiveDir)) return;
  
  try {
    const compressFile = (filePath) => {
      if (!filePath.endsWith(".json")) return;
      if (fs.existsSync(filePath + ".gz")) fs.unlinkSync(filePath + ".gz");
      
      const input = fs.createReadStream(filePath);
      const output = fs.createWriteStream(filePath + ".gz");
      input.pipe(zlib.createGzip()).pipe(output);
      
      output.on("finish", () => {
        const originalSize = fs.statSync(filePath).size;
        const compressedSize = fs.statSync(filePath + ".gz").size;
        const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(0);
        console.log(`  ✓ ${path.basename(filePath)}: ${(originalSize / 1024 / 1024).toFixed(1)}MB → ${(compressedSize / 1024 / 1024).toFixed(1)}MB (${ratio}% savings)`);
      });
    };

    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else {
          compressFile(fullPath);
        }
      }
    };

    console.log("📦 Compressing season-archive for deployment...");
    walkDir(archiveDir);
  } catch (err) {
    console.error("[cron] Compression error:", err.message);
  }
}

function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) {
    console.warn("[cron] Supabase credentials not available — skipping DB sync");
    return null;
  }
  return createClient(url, key);
}

function runNodeStep(scriptName, timeoutMs) {
  const scriptPath = path.join(__dirname, "../jobs", scriptName);
  execSync(`node ${scriptPath}`, {
    timeout: timeoutMs,
    stdio: "pipe",
    env: { ...process.env, NODE_ENV: "production" },
  });
}

module.exports = async (req, res) => {
  // Seguretat: comprova que la crida ve del cron de Vercel o té el secret correcte
  const authHeader = req.headers["authorization"];
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "No autoritzat" });
  }

  const start = Date.now();
  try {
    const steps = [];
    let syncResults = null;

    console.log("🏟️ Pas 1/5: actualitzant fecapa-categories.json...");
    runNodeStep("scraper-fecapa-categories.js", 290000);
    steps.push("scraper-fecapa-categories.js");

    console.log("🏒 Pas 2/5: actualitzant data.json...");
    runNodeStep("scraper.js", 290000);
    steps.push("scraper.js");

    console.log("🧩 Pas 3/5: construint entity-mapping.json...");
    runNodeStep("build-entity-mapping.js", 120000);
    steps.push("build-entity-mapping.js");

    console.log("🧭 Pas 4/5: construint classification-audit.json...");
    runNodeStep("build-classification-audit.js", 120000);
    steps.push("build-classification-audit.js");

    // Genera el fitxer compacte per al Club Hoquei Ripollet (opcional)
    const ripolletScript = path.join(__dirname, "generate-ripollet.js");
    if (fs.existsSync(ripolletScript)) {
      console.log("🔵 Pas 5/5: generant ripollet.json...");
      runNodeStep("generate-ripollet.js", 10000);
      steps.push("generate-ripollet.js");
    } else {
      console.log("⏭️ Pas 5/5 omès: generate-ripollet.js no existeix");
    }

    // Compress season-archive for Vercel deployment
    console.log("🗜️ Pas 6: comprimint season-archive...");
    compressSeasonArchive(path.join(__dirname, "../public"));
    steps.push("compress-archive");

    // Sincronitza JSON → Supabase (temporada actual/futures)
    console.log("📊 Pas 7: sincronitzant temporada activa a Supabase...");
    const sb = createSupabaseClient();
    if (sb) {
      try {
        syncResults = await syncActiveSeasonsToDatabase(sb, path.join(__dirname, "../public"));
        console.log("[cron] DB sync results:", JSON.stringify(syncResults, null, 2));
        steps.push("sync-db-from-json");
      } catch (syncErr) {
        console.error("[cron] DB sync error:", syncErr.message);
        // No failing the whole cron if DB sync fails — els JSON scripts ja van OK
      }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ Pipeline completat en ${elapsed}s (${steps.join(" -> ")})`);
    
    return res.status(200).json({
      ok: true,
      message: "Pipeline executat correctament",
      steps,
      sync: syncResults,
      elapsed: elapsed + "s",
      updatedAt: new Date().toISOString()
    });

  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error("❌ Error al scraper:", err.message);
    
    return res.status(500).json({
      ok: false,
      error: err.message,
      elapsed: elapsed + "s"
    });
  }
};
