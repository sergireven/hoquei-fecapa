const fs = require("fs").promises;
const path = require("path");
const https = require("https");
const http = require("http");

const DATA_FILE = path.join(__dirname, "../public/data.json");
const BASE = "https://jok.cat";
const CONCURRENCY = 4;
const DELAY_MS = 150;
const PREVIEW_LIMIT = 4000;
const FORCE_RELOAD = false;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ca,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity",
      }
    }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        if (redirectsLeft <= 0) return reject(new Error("Too many redirects"));
        const next = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return resolve(fetchText(next, redirectsLeft - 1));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} → ${url}`));
      }

      res.setEncoding("utf8");
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => resolve(body));
    });

    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error(`Timeout: ${url}`));
    });
  });
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&[a-z]+;/gi, " ");
}

function stripHtml(html) {
  return decodeEntities(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractTitle(html) {
  const m = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : "";
}

function extractActaMeta(rawText) {
  const meta = {
    compName: "",
    date: "",
    time: "",
  };

  const m = rawText.match(/Resultats de cerca per:\s*(.*?)\s+(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2})/i);
  if (m) {
    meta.compName = (m[1] || "").trim();
    meta.date = m[2] || "";
    meta.time = m[3] || "";
    return meta;
  }

  const dt = rawText.match(/(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2})/);
  if (dt) {
    meta.date = dt[1] || "";
    meta.time = dt[2] || "";
  }

  return meta;
}

function extractReferees(rawText) {
  const refs = [];

  const m = rawText.match(/Àrbitre\s+(.+?)\s+Jugador\s+G\s+B\s+V\s+FD\s+Pe/i)
         || rawText.match(/Arbitre\s+(.+?)\s+Jugador\s+G\s+B\s+V\s+FD\s+Pe/i)
         || rawText.match(/Arbitro\s+(.+?)\s+Jugador\s+G\s+B\s+V\s+FD\s+Pe/i);

  if (!m) return refs;

  const raw = (m[1] || "").replace(/\s+/g, " ").trim();
  if (!raw) return refs;

  raw.split(/\s{2,}|,\s*(?=[A-ZÀ-Ú])/)
    .map(s => s.trim().replace(/,$/, ""))
    .filter(Boolean)
    .forEach(r => refs.push(r));

  if (!refs.length && raw) refs.push(raw);

  return refs;
}

function extractPlayerStatsRaw(rawText) {
  const result = {
    columns: ["Jugador", "G", "B", "V", "FD", "Pe"],
    homeBlock: "",
    awayBlock: "",
  };

  const parts = rawText.split(/Jugador\s+G\s+B\s+V\s+FD\s+Pe/i);
  if (parts.length < 3) return result;

  const cleanBlock = (txt) => String(txt || "")
    .replace(/\s+JOK\.cat[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  result.homeBlock = cleanBlock(parts[1]);
  result.awayBlock = cleanBlock(parts[2]);

  return result;
}

function extractPlayerLinks(html) {
  const players = [];
  const seen = new Set();

  const re = /href="([^"]*\/jugador\/(\d+)\/([^"?#]+))"/gi;
  let m;

  while ((m = re.exec(html)) !== null) {
    const rawUrl = m[1];
    const id = String(m[2] || "").trim();
    const slug = String(m[3] || "").trim();

    if (!id || seen.has(id)) continue;
    seen.add(id);

    const url = rawUrl.startsWith("http")
      ? rawUrl
      : new URL(rawUrl, BASE).href;

    players.push({
      jugadorId: id,
      id,
      type: "jugador",
      slug,
      url,
    });
  }

  return players;
}

function ensureJugadorsIndex(data) {
  if (!data.jugadors || typeof data.jugadors !== "object") {
    data.jugadors = {};
  }
}

function addPlayerSources(data, actaId, playerLinks) {
  ensureJugadorsIndex(data);

  for (const player of playerLinks) {
    if (!data.jugadors[player.id]) {
      data.jugadors[player.id] = {
        jugadorId: player.id,
        id: player.id,
        type: "jugador",
        slug: player.slug,
        url: player.url,
        loaded: false,
        loadedAt: null,
        title: "",
        sources: [],
      };
    }

    const target = data.jugadors[player.id];

    if (!target.slug) target.slug = player.slug;
    if (!target.url) target.url = player.url;

    if (!Array.isArray(target.sources)) {
      target.sources = [];
    }

    const exists = target.sources.some(
      s => s.type === "acta" && s.id === String(actaId)
    );

    if (!exists) {
      target.sources.push({
        type: "acta",
        id: String(actaId),
      });
    }
  }
}

async function runPool(items, limit, worker) {
  const results = [];
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => runner()
  );

  await Promise.all(workers);
  return results;
}

async function main() {
  console.log("📄 Carrega estructurada d'actes + indexació de jugadors — iniciant...");

  const raw = await fs.readFile(DATA_FILE, "utf8");
  const data = JSON.parse(raw);

  if (!data.actes || typeof data.actes !== "object") {
    throw new Error("No existeix data.actes a public/data.json");
  }

  ensureJugadorsIndex(data);

  const allActes = Object.values(data.actes);
  const pending = allActes.filter(a => {
    if (!a.actaUrl) return false;
    if (FORCE_RELOAD) return true;

    const missingCoreData =
      !a.title ||
      !a.rawTextPreview ||
      !a.actaMeta ||
      !a.playerStatsRaw ||
      !Array.isArray(a.playerLinks);

    return missingCoreData;
  });

  console.log(`Actes totals: ${allActes.length}`);
  console.log(`Actes pendents: ${pending.length}`);

  let processed = 0;
  let okCount = 0;
  let errCount = 0;
  let playerRefsCount = 0;

  await runPool(pending, CONCURRENCY, async (acta) => {
    try {
      const html = await fetchText(acta.actaUrl);
      await sleep(DELAY_MS);

      const title = extractTitle(html);
      const rawText = stripHtml(html);
      const actaMeta = extractActaMeta(rawText);
      const referees = extractReferees(rawText);
      const playerStatsRaw = extractPlayerStatsRaw(rawText);
      const playerLinks = extractPlayerLinks(html);

      const target = data.actes[acta.actaId];
      if (target) {
        target.actaId = target.actaId || String(acta.actaId);
        target.id = String(acta.actaId);
        target.type = "acta";
        target.actaSlug = target.actaSlug || acta.actaSlug || "";
        target.slug = target.slug || target.actaSlug || acta.actaSlug || "";
        target.actaUrl = target.actaUrl || acta.actaUrl || "";
        target.url = target.url || target.actaUrl || acta.actaUrl || "";

        target.loaded = true;
        target.loadedAt = new Date().toISOString();
        target.title = title;
        target.rawTextPreview = rawText.slice(0, PREVIEW_LIMIT);
        target.actaMeta = {
          compName: actaMeta.compName || target.compName || "",
          date: actaMeta.date || target.date || "",
          time: actaMeta.time || target.time || "",
        };
        target.referees = referees;
        target.playerStatsRaw = playerStatsRaw;
        target.playerLinks = playerLinks;

        delete target.loadError;
        delete target.lastLoadAttemptAt;
      }

      addPlayerSources(data, acta.actaId, playerLinks);
      playerRefsCount += playerLinks.length;

      processed++;
      okCount++;
      console.log(`   [${processed}/${pending.length}] OK ${acta.actaId} jugadors:${playerLinks.length}`);
    } catch (err) {
      const target = data.actes[acta.actaId];
      if (target) {
        target.loaded = false;
        target.loadError = err.message;
        target.lastLoadAttemptAt = new Date().toISOString();
      }

      processed++;
      errCount++;
      console.log(`   [${processed}/${pending.length}] ERROR ${acta.actaId}: ${err.message}`);
    }
  });

  data.updatedAt = new Date().toISOString();

  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));

  console.log("\n✅ Carrega estructurada d'actes completada");
  console.log(`   Actes correctes: ${okCount}`);
  console.log(`   Errors: ${errCount}`);
  console.log(`   Referències de jugadors detectades: ${playerRefsCount}`);
  console.log(`   Jugadors indexats: ${Object.keys(data.jugadors || {}).length}`);
  console.log(`   Fitxer actualitzat: ${DATA_FILE}`);
}

main().catch(err => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});