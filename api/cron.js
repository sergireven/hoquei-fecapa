// api/cron.js  — Vercel Serverless Function
// Triggered by Vercel Cron (see vercel.json) every night at 02:00 UTC
// Also callable manually: GET /api/cron?secret=YOUR_SECRET

const { execSync } = require("child_process");

module.exports = async (req, res) => {
  // Simple auth to prevent abuse
  const secret = process.env.CRON_SECRET;
  if (secret && req.query.secret !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Run the scraper (Vercel gives us up to 60s for hobby, 300s for pro)
    execSync("node api/scraper.js", {
      timeout: 55000,
      stdio: "pipe",
    });
    res.json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
