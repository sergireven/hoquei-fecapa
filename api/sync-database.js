/**
 * /api/sync-database — Endpoint per sincronitzar JSON → Supabase
 * 
 * Ús:
 *   GET /api/sync-database?season=active
 *   GET /api/sync-database?season=current
 *   GET /api/sync-database?season=2024-25
 *   GET /api/sync-database?season=all
 *
 * Requereix: Authorization header amb Bearer token (CRON_SECRET o similar)
 */

const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const { getActiveSeasonLabel, syncSeasonToDatabase, syncAllSeasonsToDatabase, syncActiveSeasonsToDatabase } = require("./sync-db-from-json");

function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error("Supabase credentials not configured");
  return createClient(url, key);
}

module.exports = async (req, res) => {
  // Seguretat
  const authHeader = req.headers["authorization"];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const start = Date.now();
  try {
    const season = String(req.query.season || "active").toLowerCase().trim();
    const sb = createSupabaseClient();
    const publicDir = path.join(__dirname, "../public");

    let result;
    if (season === "all") {
      console.log("[sync-api] Syncing all seasons...");
      result = await syncAllSeasonsToDatabase(sb, publicDir);
    } else if (season === "active") {
      console.log("[sync-api] Syncing active seasons (current/future)...");
      result = await syncActiveSeasonsToDatabase(sb, publicDir);
    } else if (season === "current") {
      console.log("[sync-api] Syncing current season...");
      const dataPath = path.join(publicDir, "data.json");
      result = await syncSeasonToDatabase(sb, "current", dataPath, getActiveSeasonLabel());
    } else {
      // Parsed as specific year, e.g. "2024-25"
      const dataPath = path.join(publicDir, "season-archive", `data-${season}.json`);
      console.log(`[sync-api] Syncing season: ${season}`);
      result = await syncSeasonToDatabase(sb, season, dataPath, season);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return res.status(200).json({
      ok: true,
      message: "Sync completed",
      result,
      elapsed: elapsed + "s",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error("[sync-api] Error:", err.message);
    return res.status(500).json({
      ok: false,
      error: err.message,
      elapsed: elapsed + "s",
    });
  }
};
