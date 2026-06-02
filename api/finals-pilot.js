const PILOT_COMPETITIONS = {
  "4709": {
    slug: "alevi-copa-catalana-plata-fase-final-2025-26",
    defaultPhaseName: "FASE FINAL",
  },
};

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

function decodeUrlToken(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  try {
    return decodeHtmlEntities(decodeURIComponent(raw.replace(/\+/g, "%20"))).trim();
  } catch {
    return decodeHtmlEntities(raw.replace(/\+/g, " ")).trim();
  }
}

function normalizeTeamName(text) {
  return decodeUrlToken(text).replace(/\s+/g, " ").trim();
}

function parseJokMatchesFromHtml(html, fallbackPhaseName = "FASE FINAL") {
  const chunks = String(html || "").split('<div class="mb-2 shadow-md shadow-neutral-700 mt-2">');
  if (chunks.length <= 1) return [];

  const matches = [];
  const seen = new Set();

  for (let i = 1; i < chunks.length; i += 1) {
    const block = chunks[i];

    const phasePath = block.match(/href="\/competicio\/\d+\/[^\"]+\/([^\"]+)"/i);
    const phaseName = normalizeTeamName(phasePath?.[1] || "") || fallbackPhaseName;

    const actaMatch = block.match(/href="\/acta\/(\d+)\//i);
    const teamLinks = [...block.matchAll(/href="\/equip\/(\d+)\/[^\"]*">([^<]+)<\/a>/gi)];
    if (teamLinks.length < 2) continue;

    const homeId = String(teamLinks[0][1] || "").trim() || null;
    const awayId = String(teamLinks[1][1] || "").trim() || null;
    const home = normalizeTeamName(teamLinks[0][2]);
    const away = normalizeTeamName(teamLinks[1][2]);
    if (!home || !away) continue;

    const dateTime = block.match(/>\s*(\d{2})-(\d{2})\s+(\d{2}:\d{2})\s*</);
    const date = dateTime ? `${dateTime[1]}-${dateTime[2]}` : "";
    const time = dateTime ? String(dateTime[3]) : "";

    const scoreMatch = block.match(/>\s*(\d{1,2})\s*-\s*(\d{1,2})\s*</);
    const homeScore = scoreMatch ? Number(scoreMatch[1]) : null;
    const awayScore = scoreMatch ? Number(scoreMatch[2]) : null;

    const key = [
      phaseName.toUpperCase(),
      home.toUpperCase(),
      away.toUpperCase(),
      date,
      time,
      String(homeScore ?? ""),
      String(awayScore ?? ""),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    matches.push({
      jornada: null,
      home,
      away,
      homeId,
      awayId,
      date,
      time,
      homeScore,
      awayScore,
      played: homeScore != null && awayScore != null,
      source: "jok_live",
      phaseName,
      phaseType: "eliminatories",
      actaId: actaMatch ? String(actaMatch[1]) : null,
    });
  }

  return matches;
}

function parseFecapaMatchesFromHtml(html, fallbackPhaseName = "FASE FINAL") {
  const text = String(html || "");
  if (!text || /Sorry, you don't have permission/i.test(text)) return [];
  return parseJokMatchesFromHtml(text, fallbackPhaseName).map(m => ({ ...m, source: "fecapa_live" }));
}

function groupMatchesIntoPhases(matches) {
  const map = new Map();
  for (const match of (matches || [])) {
    const phaseName = String(match?.phaseName || "FASE FINAL").trim() || "FASE FINAL";
    const phaseType = String(match?.phaseType || "eliminatories").trim() || "eliminatories";
    const key = `${phaseName.toUpperCase()}::${phaseType}`;
    if (!map.has(key)) {
      map.set(key, {
        phaseId: key,
        phaseName,
        phaseType,
        isPostSeason: true,
        matches: [],
      });
    }
    map.get(key).matches.push(match);
  }
  return [...map.values()];
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; hoquei-fecapa-pilot/1.0)",
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function getPilotFinalsData({ jokCompId = "4709", slug = "" } = {}) {
  const compId = String(jokCompId || "4709").trim();
  const cfg = PILOT_COMPETITIONS[compId];
  if (!cfg) {
    return {
      ok: true,
      pilot: true,
      jokCompId: compId,
      ignored: true,
      phases: [],
      matchCount: 0,
      sources: {
        jok: { enabled: false, reason: "pilot-not-configured" },
        fecapa: { enabled: false, reason: "pilot-not-configured" },
      },
    };
  }

  try {
    const effectiveSlug = String(slug || cfg.slug || "").trim();
    const fallbackPhaseName = cfg.defaultPhaseName || "FASE FINAL";
    const jokUrl = effectiveSlug
      ? `https://jok.cat/competicio/${encodeURIComponent(compId)}/${encodeURIComponent(effectiveSlug)}`
      : `https://jok.cat/competicio/${encodeURIComponent(compId)}`;
    const fecapaUrl = `https://www.server2.sidgad.es/fecapa/cerilh/fecapa_gr_${encodeURIComponent(compId)}_1.php`;

    let jokMatches = [];
    let fecapaMatches = [];
    const sources = {
      jok: { enabled: true, url: jokUrl, matchCount: 0, error: null },
      fecapa: { enabled: true, url: fecapaUrl, matchCount: 0, error: null },
    };

    try {
      const jokHtml = await fetchText(jokUrl, { referer: "https://jok.cat/" });
      jokMatches = parseJokMatchesFromHtml(jokHtml, fallbackPhaseName);
      sources.jok.matchCount = jokMatches.length;
    } catch (err) {
      sources.jok.error = err.message || "jok-fetch-failed";
    }

    try {
      const fecapaHtml = await fetchText(fecapaUrl, { referer: "https://www.hoqueipatins.fecapa.cat/" });
      fecapaMatches = parseFecapaMatchesFromHtml(fecapaHtml, fallbackPhaseName);
      sources.fecapa.matchCount = fecapaMatches.length;
      if (!fecapaMatches.length && /permission|blocked/i.test(fecapaHtml)) {
        sources.fecapa.error = "fecapa-blocked";
      }
    } catch (err) {
      sources.fecapa.error = err.message || "fecapa-fetch-failed";
    }

    const merged = [...jokMatches, ...fecapaMatches];
    const phases = groupMatchesIntoPhases(merged);

    return res.status(200).json({
      ok: true,
      pilot: true,
      jokCompId: compId,
      fetchedAt: new Date().toISOString(),
      phases,
      matchCount: merged.length,
      sources,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message || "Unknown error",
    };
  }
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const query = new URL(req.url || "", "http://localhost").searchParams;
    const jokCompId = String(query.get("jokCompId") || "4709").trim();
    const slug = String(query.get("slug") || "").trim();
    const data = await getPilotFinalsData({ jokCompId, slug });
    if (!data.ok) return res.status(500).json(data);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unknown error",
    });
  }
};

module.exports.getPilotFinalsData = getPilotFinalsData;