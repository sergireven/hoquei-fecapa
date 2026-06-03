const fs = require("fs").promises;
const path = require("path");

// Default copa phase templates applied when an entry does not define phaseTemplates.
// Add a venue property to any bucket to override the venue for that phase.
const DEFAULT_COPA_PHASE_TEMPLATES = [
  { bucket: "vuitens", phaseName: "VUITENS DE FINAL", slots: 8 },
  { bucket: "quarts", phaseName: "QUARTS DE FINAL", slots: 4 },
  { bucket: "semifinals", phaseName: "SEMIFINALS", slots: 2 },
  { bucket: "final", phaseName: "FINAL", slots: 1 },
];

// To add a competition, the minimum required is the FECAPA competition ID as the key.
// The scraper will automatically use DEFAULT_COPA_PHASE_TEMPLATES and "FASE FINAL" as
// the default phase name. Override any field to customise behaviour:
//   fecapaCompetitionId  – FECAPA group ID (defaults to the map key)
//   defaultPhaseName     – fallback phase label (default: "FASE FINAL")
//   slug                 – JOK.cat competition slug (only needed when key ≠ JOK ID)
//   phaseTemplates       – explicit list of phases/slots/venues; set to [] to disable placeholders
const PILOT_COMPETITIONS = {
  "4709": {
    slug: "alevi-copa-catalana-plata-fase-final-2025-26",
    fecapaCompetitionId: "3937",
    phaseTemplates: [
      { bucket: "vuitens", phaseName: "VUITENS DE FINAL", slots: 8, venue: "PAVELLÓ MUNICIPAL D ESPORTS DE SALT" },
      { bucket: "quarts", phaseName: "QUARTS DE FINAL", slots: 4, venue: "PAVELLÓ MUNICIPAL D ESPORTS DE SALT" },
      { bucket: "semifinals", phaseName: "SEMIFINALS", slots: 2, venue: "PAVELLÓ MUNICIPAL RODA DE TER" },
      { bucket: "final", phaseName: "FINAL", slots: 1, venue: "PAVELLÓ MUNICIPAL RODA DE TER" },
    ],
  },
  "4452": {},
  "3935": {},
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

function normalizeCompToken(text) {
  return decodeHtmlEntities(String(text || ""))
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function detectPhaseBucket(phaseName) {
  const n = normalizeCompToken(phaseName);
  if (!n) return "other";
  if (/VUITENS\s+DE\s+FINAL/.test(n)) return "vuitens";
  if (/QUARTS?\s+DE\s+FINAL/.test(n)) return "quarts";
  if (/SEMIFINALS?/.test(n)) return "semifinals";
  if (/\bFINAL\b/.test(n) && !/SEMIFINAL/.test(n) && !/QUART/.test(n) && !/VUITENS/.test(n)) return "final";
  if (/ELIMINATORIES\s+PREVIES\s+ANADA/.test(n)) return "elim_prev_anada";
  if (/ELIMINATORIES\s+PREVIES\s+TORNADA/.test(n)) return "elim_prev_tornada";
  return "other";
}

function extractVenueFromBlock(block, fallbackVenue = "") {
  const txt = String(block || "");
  const m = txt.match(/(PAVELL[ÓO][^<\n]{4,200})/i);
  if (m) return normalizeTeamName(m[1]);
  return String(fallbackVenue || "").trim();
}

function detectPhaseNameFromBlock(block, fallbackPhaseName) {
  const txt = String(block || "");
  const fromLink = txt.match(/href="\/competicio\/\d+\/[^\"]+\/([^\"]+)"/i);
  const linked = normalizeTeamName(fromLink?.[1] || "");
  if (linked) return linked;

  const fromText = txt.match(/(VUITENS\s+DE\s+FINAL|QUARTS?\s+DE\s+FINAL|SEMIFINALS?|ELIMINAT[ÒO]RIES\s+PR[ÈE]VIES\s+ANADA|ELIMINAT[ÒO]RIES\s+PR[ÈE]VIES\s+TORNADA|\bFINAL\b)/i);
  if (fromText) return normalizeTeamName(fromText[1]);

  return fallbackPhaseName;
}

function buildMatchKey(m) {
  return [
    normalizeCompToken(m?.phaseName || ""),
    normalizeCompToken(m?.home || ""),
    normalizeCompToken(m?.away || ""),
    String(m?.date || ""),
    String(m?.time || ""),
  ].join("|");
}

function mergeMatches(matches) {
  const byKey = new Map();
  for (const m of (matches || [])) {
    const key = buildMatchKey(m);
    if (!key.replace(/\|/g, "")) continue;
    if (!byKey.has(key)) {
      byKey.set(key, { ...m });
      continue;
    }
    const prev = byKey.get(key);
    byKey.set(key, {
      ...prev,
      ...m,
      home: m?.home || prev.home,
      away: m?.away || prev.away,
      date: m?.date || prev.date,
      time: m?.time || prev.time,
      venue: m?.venue || prev.venue,
      homeScore: m?.homeScore != null ? m.homeScore : prev.homeScore,
      awayScore: m?.awayScore != null ? m.awayScore : prev.awayScore,
      source: prev.source === m.source ? prev.source : `${prev.source}+${m.source}`,
      placeholder: prev.placeholder === true && m.placeholder === true,
    });
  }
  return [...byKey.values()];
}

function parseJokMatchesFromHtml(html, fallbackPhaseName = "FASE FINAL") {
  const chunks = String(html || "").split('<div class="mb-2 shadow-md shadow-neutral-700 mt-2">');
  if (chunks.length <= 1) return [];

  const matches = [];
  const seen = new Set();

  for (let i = 1; i < chunks.length; i += 1) {
    const block = chunks[i];

    const phaseName = detectPhaseNameFromBlock(block, fallbackPhaseName);

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
    const venue = extractVenueFromBlock(block, "");

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
      venue,
      phaseBucket: detectPhaseBucket(phaseName),
      placeholder: false,
    });
  }

  return matches;
}

function parseFecapaMatchesFromHtml(html, fallbackPhaseName = "FASE FINAL", cfg = null) {
  const text = String(html || "");
  if (!text || /Sorry, you don't have permission/i.test(text)) return [];
  const fallbackVenueByBucket = new Map((cfg?.phaseTemplates || []).map(t => [String(t.bucket || ""), String(t.venue || "")]));
  return parseJokMatchesFromHtml(text, fallbackPhaseName).map(m => {
    const bucket = detectPhaseBucket(m.phaseName);
    return {
      ...m,
      source: "fecapa_live",
      phaseBucket: bucket,
      venue: m.venue || fallbackVenueByBucket.get(bucket) || "",
    };
  });
}

function addPhasePlaceholders(matches, cfg) {
  // Use explicit phaseTemplates when set; fall back to DEFAULT_COPA_PHASE_TEMPLATES
  // when the key is absent (not configured). An explicit [] disables placeholders.
  const templates = Object.prototype.hasOwnProperty.call(cfg || {}, "phaseTemplates")
    ? (cfg.phaseTemplates || [])
    : DEFAULT_COPA_PHASE_TEMPLATES;
  if (!templates.length) return matches || [];

  const out = [...(matches || [])];
  for (const tpl of templates) {
    const bucket = String(tpl.bucket || "");
    const phaseName = String(tpl.phaseName || "FASE FINAL");
    const venue = String(tpl.venue || "");
    const slots = Math.max(0, Number(tpl.slots || 0));
    if (!bucket || !slots) continue;

    const existing = out.filter(m => detectPhaseBucket(m?.phaseName || "") === bucket);
    const missing = Math.max(0, slots - existing.length);
    for (let i = 0; i < missing; i += 1) {
      out.push({
        jornada: null,
        home: "Per definir",
        away: "Per definir",
        homeId: null,
        awayId: null,
        date: "",
        time: "",
        homeScore: null,
        awayScore: null,
        played: false,
        source: "fecapa_placeholder",
        phaseName,
        phaseType: "eliminatories",
        actaId: null,
        venue,
        phaseBucket: bucket,
        placeholder: true,
      });
    }
  }
  return out;
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

async function readJsonFileSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cleanCompetitionPhaseName(name, fallback = "FASE FINAL") {
  const cleaned = String(name || "")
    .replace(/\(\d{4}-\d{2}\)\s*$/g, "")
    .trim();
  return cleaned || fallback;
}

async function loadCachedJokMatchesFromData({ fecapaCompId, fallbackPhaseName }) {
  const sidgadFile = path.join(__dirname, "../public/competicions-sidgad.json");
  const dataFile = path.join(__dirname, "../public/data.json");

  const sidgad = await readJsonFileSafe(sidgadFile);
  const data = await readJsonFileSafe(dataFile);
  if (!sidgad || !data) return { matches: [], jokIds: [] };

  const sidgadComp = sidgad[String(fecapaCompId)] || null;
  if (!sidgadComp) return { matches: [], jokIds: [] };

  const jokIds = new Set();
  for (const m of (sidgadComp.matches || [])) {
    const idc = String(m?.idc || "").trim();
    if (/^\d+$/.test(idc)) jokIds.add(idc);
  }
  for (const idc of Object.keys(sidgadComp.classificationByGroup || {})) {
    const key = String(idc || "").trim();
    if (/^\d+$/.test(key)) jokIds.add(key);
  }

  if (!jokIds.size) return { matches: [], jokIds: [] };

  const comps = [];
  for (const catComps of Object.values(data?.categories || {})) {
    if (!Array.isArray(catComps)) continue;
    for (const c of catComps) comps.push(c);
  }

  const byId = new Map(comps.map(c => [String(c?.id || ""), c]));
  const matches = [];
  for (const jokId of jokIds) {
    const comp = byId.get(jokId);
    if (!comp) continue;

    const phaseName = cleanCompetitionPhaseName(comp.name, fallbackPhaseName);
    for (const m of (comp.calendar || [])) {
      const home = normalizeTeamName(m?.home || "");
      const away = normalizeTeamName(m?.away || "");
      if (!home || !away) continue;

      const homeScore = m?.homeScore != null ? Number(m.homeScore) : null;
      const awayScore = m?.awayScore != null ? Number(m.awayScore) : null;
      matches.push({
        jornada: m?.jornada ?? null,
        home,
        away,
        homeId: null,
        awayId: null,
        date: String(m?.date || ""),
        time: String(m?.time || ""),
        homeScore,
        awayScore,
        played: homeScore != null && awayScore != null,
        source: "jok_cached",
        phaseName,
        phaseType: "eliminatories",
        actaId: m?.actaId != null ? String(m.actaId) : null,
        venue: String(m?.venue || ""),
        phaseBucket: detectPhaseBucket(phaseName),
        placeholder: false,
      });
    }
  }

  return { matches, jokIds: [...jokIds] };
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
    const fecapaCompId = String(cfg.fecapaCompetitionId || compId).trim(); // falls back to the map key
    // If there is no slug and the configured FECAPA ID matches the map key,
    // treat that key as a FECAPA competition ID and skip JOK.
    const jokEnabled = effectiveSlug !== "" || fecapaCompId !== compId;
    const jokUrl = jokEnabled
      ? (effectiveSlug
          ? `https://jok.cat/competicio/${encodeURIComponent(compId)}/${encodeURIComponent(effectiveSlug)}`
          : `https://jok.cat/competicio/${encodeURIComponent(compId)}`)
      : null;
    const fecapaUrl = `https://www.server2.sidgad.es/fecapa/cerilh/fecapa_gr_${encodeURIComponent(fecapaCompId)}_1.php`;

    let jokMatches = [];
    let fecapaMatches = [];
    const sources = {
      jok: jokEnabled ? { enabled: true, url: jokUrl, matchCount: 0, error: null } : { enabled: false, reason: "fecapa-id-key" },
      fecapa: {
        enabled: true,
        url: fecapaUrl,
        competitionId: fecapaCompId,
        groupName: cfg.fecapaGroupName || null,
        matchCount: 0,
        error: null,
      },
    };

    if (jokEnabled) {
      try {
        const jokHtml = await fetchText(jokUrl, { referer: "https://jok.cat/" });
        jokMatches = parseJokMatchesFromHtml(jokHtml, fallbackPhaseName);
        sources.jok.matchCount = jokMatches.length;
        sources.jok.phaseNames = [...new Set(jokMatches.map(m => m.phaseName).filter(Boolean))];
      } catch (err) {
        sources.jok.error = err.message || "jok-fetch-failed";
      }
    }

    if (!jokMatches.length) {
      const cached = await loadCachedJokMatchesFromData({ fecapaCompId, fallbackPhaseName });
      if (cached.matches.length > 0) {
        jokMatches = cached.matches;
        sources.jok = {
          enabled: true,
          url: jokUrl,
          mode: "cached-data-json",
          fromFecapaCompetitionId: fecapaCompId,
          mappedJokIds: cached.jokIds,
          matchCount: jokMatches.length,
          phaseNames: [...new Set(jokMatches.map(m => m.phaseName).filter(Boolean))],
          error: null,
        };
      }
    }

    try {
      const fecapaHtml = await fetchText(fecapaUrl, { referer: "https://www.hoqueipatins.fecapa.cat/" });
      fecapaMatches = parseFecapaMatchesFromHtml(fecapaHtml, fallbackPhaseName, cfg);
      sources.fecapa.matchCount = fecapaMatches.length;
      sources.fecapa.phaseNames = [...new Set(fecapaMatches.map(m => m.phaseName).filter(Boolean))];
      if (!fecapaMatches.length && /permission|blocked/i.test(fecapaHtml)) {
        sources.fecapa.error = "fecapa-blocked";
      }
    } catch (err) {
      sources.fecapa.error = err.message || "fecapa-fetch-failed";
    }

    const mergedBase = mergeMatches([...jokMatches, ...fecapaMatches]);
    const merged = addPhasePlaceholders(mergedBase, cfg);
    const phases = groupMatchesIntoPhases(merged);
    const placeholdersCount = merged.filter(m => m && m.placeholder === true).length;
    return {
      ok: true,
      pilot: true,
      competitionKey: compId,
      jokCompId: compId,
      fecapaCompId,
      slug: effectiveSlug,
      phases,
      matchCount: merged.length,
      placeholdersCount,
      sources,
    };
  } catch (err) {
    return {
      ok: false,
      pilot: true,
      competitionKey: compId,
      jokCompId: compId,
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

module.exports.getPilotFinalsData = getPilotFinalsData;module.exports.PILOT_COMPETITIONS = PILOT_COMPETITIONS;
