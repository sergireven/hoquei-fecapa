// api/cron.js — Vercel Serverless Function
// S'invoca cada 30 minuts via Vercel Cron i només executa el pipeline
// entre les 09:30 i les 22:30 a la zona horària Europe/Madrid.
// També es pot cridar manualment amb ?force=1.

const { execSync } = require("child_process");
const path = require("path");

const CATALAN_TIME_ZONE = "Europe/Madrid";
const START_WINDOW_MINUTES = (9 * 60) + 30;
const END_WINDOW_MINUTES = (22 * 60) + 30;

function runNodeStep(scriptName, timeoutMs) {
  const scriptPath = path.join(__dirname, scriptName);
  execSync(`node ${scriptPath}`, {
    timeout: timeoutMs,
    stdio: "pipe",
    env: { ...process.env, NODE_ENV: "production" },
  });
}

function getCatalanClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CATALAN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const hour = Number(parts.find(part => part.type === "hour")?.value || 0);
  const minute = Number(parts.find(part => part.type === "minute")?.value || 0);
  return {
    hour,
    minute,
    totalMinutes: (hour * 60) + minute,
    label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function isWithinCatalanUpdateWindow(now = new Date()) {
  const clock = getCatalanClock(now);
  return clock.totalMinutes >= START_WINDOW_MINUTES && clock.totalMinutes <= END_WINDOW_MINUTES;
}

module.exports = async (req, res) => {
  // Seguretat: comprova que la crida ve del cron de Vercel o té el secret correcte
  const authHeader = req.headers["authorization"];
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "No autoritzat" });
  }

  const forceRun = String(req?.query?.force || "") === "1";
  const catalanClock = getCatalanClock();
  if (!forceRun && !isWithinCatalanUpdateWindow()) {
    console.log(`⏭️ Fora de finestra horària (${catalanClock.label} ${CATALAN_TIME_ZONE}). S'omet execució.`);
    return res.status(200).json({
      ok: true,
      skipped: true,
      reason: "outside_catalan_update_window",
      localTime: catalanClock.label,
      timeZone: CATALAN_TIME_ZONE,
      window: "09:30-22:30",
      updatedAt: new Date().toISOString(),
    });
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
