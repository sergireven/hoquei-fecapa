// api/cron.js — Vercel Serverless Function
// S'executa automàticament cada nit a les 02:00 UTC (veure vercel.json)
// També es pot cridar manualment: GET https://el-teu-domini.vercel.app/api/cron

const { execSync } = require("child_process");
const path = require("path");

module.exports = async (req, res) => {
  // Seguretat: comprova que la crida ve del cron de Vercel o té el secret correcte
  const authHeader = req.headers["authorization"];
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "No autoritzat" });
  }

  const start = Date.now();
  try {
    console.log("🏒 Iniciant scraper...");
    
    // Executa el scraper
    execSync("node " + path.join(__dirname, "scraper.js"), {
      timeout: 290000, // 290 segons (Vercel té límit de 300s en pla Pro)
      stdio: "pipe",
      env: { ...process.env, NODE_ENV: "production" }
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ Scraper completat en ${elapsed}s`);
    
    return res.status(200).json({
      ok: true,
      message: "Scraper executat correctament",
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
