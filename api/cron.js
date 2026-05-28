// api/cron.js — Vercel Serverless Function
// S'executa automàticament cada nit a les 02:00 UTC (veure vercel.json)
// També es pot cridar manualment: GET https://el-teu-domini.vercel.app/api/cron

const { execSync } = require("child_process");
const path = require("path");

function runNodeStep(scriptName, timeoutMs) {
  const scriptPath = path.join(__dirname, scriptName);
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

    // Genera el fitxer compacte per al Club Hoquei Ripollet
    console.log("🔵 Pas 5/5: generant ripollet.json...");
    runNodeStep("generate-ripollet.js", 10000);
    steps.push("generate-ripollet.js");

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ Pipeline completat en ${elapsed}s (${steps.join(" -> ")})`);
    
    return res.status(200).json({
      ok: true,
      message: "Pipeline executat correctament",
      steps,
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
