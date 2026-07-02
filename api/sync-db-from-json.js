/**
 * Sincronització JSON ↔ Supabase
 * - Llegeix data.json + season-archive per poblar clubs, teams, players
 * - Estratègia: UPSERT per mantenir IDs i no perdre dades existents
 * - NO modifica el consum actual (l'app segueix llegint DB en memòria)
 */

const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

// Helpers de normalització
const normalizeClubName = (name) => String(name || "").toLowerCase().trim().replace(/\s+/g, " ");

const normalizeTeamName = (name) => String(name || "").toLowerCase().trim();

const extractNumericId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d+)/);
  return match ? match[1] : null;
};

const makeTeamKey = ({ clubName, teamName, category, season }) => {
  return `${normalizeTeamName(clubName)}::${normalizeTeamName(teamName)}::${normalizeTeamName(category)}::${season}`;
};

function hashUuid(seed) {
  const hex = crypto.createHash("sha1").update(String(seed || "")).digest("hex");
  const chars = hex.slice(0, 32).split("");
  chars[12] = "5";
  const variant = parseInt(chars[16], 16);
  chars[16] = ((variant & 0x3) | 0x8).toString(16);
  const s = chars.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

function makeDeterministicPlayerId({ season, name, teamName, category }) {
  // IMPORTANT: Include season to ensure unique ids for same player in different seasons
  // The player_master_id deduplication happens via the database trigger,
  // which uses normalized master_key (without accents)
  const seed = [
    "player",
    normalizeTeamName(season || ""),
    normalizeTeamName(name || ""),
    normalizeTeamName(teamName || ""),
    normalizeTeamName(category || ""),
  ].join("::");
  return hashUuid(`hoquei-fecapa:${seed}`);
}

function getActiveSeasonLabel(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  const endYearTwoDigits = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYearTwoDigits}`;
}

function seasonStartYear(season) {
  const y = parseInt(String(season || "").split("-")[0], 10);
  return Number.isFinite(y) ? y : -1;
}

function canonicalSignature(team) {
  return [
    normalizeTeamName(team?.club_name || ""),
    normalizeTeamName(team?.team_name || ""),
    normalizeTeamName(team?.category || ""),
  ].join("||");
}

function buildTeamKeyFromTeam(team, season) {
  return [
    normalizeTeamName(team?.club_name || ""),
    normalizeTeamName(team?.team_name || ""),
    normalizeTeamName(team?.category || ""),
    String(season || "").trim(),
  ].join("::");
}

// Construeix team_name harmonitzat: Club + Equip + Temporada
// Exemple: "Club Hoquei Ripollet Prebenjamí B 2025-26"
const buildFullTeamName = (clubName, teamName, season = "2025-26") => {
  const club = String(clubName || "").trim();
  const team = String(teamName || "").trim();
  const s = String(season || "2025-26").trim();
  if (!club || !team) return "";
  return `${club} ${team} ${s}`;
};

// Llegeix JSON del sistema de fitxers
async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.warn(`[sync] Could not read ${filePath}:`, err.message);
    return null;
  }
}

// Extreu clubs únics de categories + classifications
function extractClubsFromCategories(categories) {
  const clubs = new Map(); // normalizedName → { name, jok_id }
  for (const comps of Object.values(categories)) {
    for (const comp of comps) {
      if (!comp.classification) continue;
      for (const row of comp.classification) {
        const teamName = String(row?.team || "").trim();
        if (!teamName) continue;
        // Heurística: club = team sense suffix de categoria
        const clubName = teamName.replace(/\s+[a-eA-E]$/, "").trim();
        const normalized = normalizeClubName(clubName);
        if (!clubs.has(normalized)) {
          clubs.set(normalized, { displayName: clubName, jok_id: extractNumericId(row?.clubId) });
        }
      }
    }
  }
  return [...clubs.values()];
}

// Extreu teams de cada competició
function extractTeamsFromCategories(categories, season = "2025-26") {
  const teams = [];
  const seen = new Set();
  for (const comps of Object.values(categories)) {
    for (const comp of comps) {
      if (!comp.classification) continue;
      for (const row of comp.classification) {
        const teamName = String(row?.team || "").trim();
        const clubName = teamName.replace(/\s+[a-eA-E]$/, "").trim();
        if (!teamName) continue;
        // Extreu categoria de comp.name (e.g. "Aleví", "Benjamí")
        const category = extractCategoryFromCompName(comp.name || "");
        const key = makeTeamKey({ clubName, teamName, category, season });
        if (seen.has(key)) continue;
        seen.add(key);
        teams.push({
          club_name: clubName,
          team_name: teamName,
          category: category || "",
          season: season,
          team_key: key,
          jok_id: row?.teamId || null,  // jok.cat team ID
        });
      }
    }
  }
  return teams;
}

// Helper: Remove accents and normalize to ASCII
function removeAccents(str) {
  return String(str || "")
    .normalize('NFD')  // Decompose accented chars: é → e + ´
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritical marks
    .trim();
}

// Heurística: extreu categoria de comp.name (e.g. "LNHP 2025-2026 - Aleví" → "Aleví")
function extractCategoryFromCompName(compName) {
  const match = String(compName).match(/[-–]\s*(\w+)(\s+\(|\s*$)/);
  return match ? match[1].trim() : "";
}

// Extreu jugadors de categories.jugadors (si existeix) o de season-archive
function extractPlayersFromDb(db, season = "2025-26") {
  const players = [];
  const seen = new Set();
  const jugadors = db?.jugadors || {};
  const teamJokIdByKey = new Map();

  for (const comps of Object.values(db?.categories || {})) {
    for (const comp of comps || []) {
      const compCategory = extractCategoryFromCompName(comp?.name || "");
      for (const row of comp?.classification || []) {
        const tName = String(row?.team || "").trim();
        if (!tName || !row?.teamId) continue;
        const lookupKey = `${normalizeTeamName(tName)}::${normalizeTeamName(compCategory)}`;
        if (!teamJokIdByKey.has(lookupKey)) teamJokIdByKey.set(lookupKey, String(row.teamId));
      }
    }
  }
  for (const jugId of Object.keys(jugadors)) {
    const player = jugadors[jugId];
    if (!player) continue;
    
    // Extract and normalize slug (the CANONICAL identifier for this player)
    const rawSlug = String(player?.slug || "");
    let normalizedSlug = rawSlug;
    try {
      // Decode URL encoding
      normalizedSlug = decodeURIComponent(rawSlug);
    } catch (e) {
      // Falls back to raw if decode fails
    }
    // Normalize: remove accents, uppercase, keep + separator for consistency
    normalizedSlug = removeAccents(normalizedSlug).toUpperCase().trim();
    if (!normalizedSlug) continue;
    
    // name: displayable with spaces (from normalized slug)
    const name = normalizedSlug.replace(/\+/g, " ").trim();
    if (!name) continue;
    
    // Team stats: if present, use first
    const teamStats = Array.isArray(player?.teamStats) ? player.teamStats : [];
    const primaryTeam = teamStats[0];
    const teamName = primaryTeam?.team || "";
    const category = primaryTeam?.cat || "";
    const dorsal = primaryTeam?.dorsal || player?.dorsal || "";  // Dorsal from team stats first, then player-level
    
    const clubName = teamName.replace(/\s+[a-eA-E]$/, "").trim();
    const teamKey = makeTeamKey({ clubName, teamName, category, season });
    const teamJokLookupKey = `${normalizeTeamName(teamName)}::${normalizeTeamName(category)}`;
    const teamJokId = teamJokIdByKey.get(teamJokLookupKey) || null;
    
    // Deduplication within season + team (to avoid duplicates in UPSERT)
    // This prevents the same player appearing twice in same team/season
    const dedupeKey = `${normalizeTeamName(normalizedSlug)}::${teamKey}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    
    const isGK = Boolean(
      String(player?.position || "").toLowerCase().includes("port")
      || player?.isGK
      || player?.is_goalkeeper
    );
    
    // Extract birth date if available (format: DD/MM/YYYY from JSON)
    let birthDate = null;
    const rawBirthDate = player?.birthDate || player?.birth_date;  // Try both camelCase and snake_case
    if (rawBirthDate) {
      // Parse DD/MM/YYYY or YYYY-MM-DD
      let parsed = rawBirthDate;
      if (rawBirthDate.includes('/')) {
        const [day, month, year] = rawBirthDate.split('/');
        if (day && month && year) {
          parsed = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          birthDate = parsed;  // Format: YYYY-MM-DD
        }
      } else if (rawBirthDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        birthDate = rawBirthDate;  // Already YYYY-MM-DD
      }
    }
    
    players.push({
      jok_id: jugId || null,  // jok.cat player ID (key from JSON)
      name: name,
      slug: normalizedSlug,  // CANONICAL slug with + (not spaces)
      dorsal: dorsal,
      position: player?.position || "Jugador",
      is_goalkeeper: isGK,
      birth_date: birthDate,  // Now populated if available
      team_key: teamKey,  // Use team_key for consistent lookup (not full team_name)
      team_jok_id: teamJokId,
      category: category,
      season: season,
    });
  }
  return players;
}

// Principal: sincronitza una temporada completa
async function syncSeasonToDatabase(sb, seasonKey, dataPath, season = "2025-26") {
  if (!sb) {
    console.warn("[sync] Supabase client unavailable — skipping sync");
    return { ok: false, error: "No Supabase" };
  }

  console.log(`[sync] Starting sync for season: ${seasonKey} (${season})`);

  // 1. Llegeix JSON
  const data = await readJsonFile(dataPath);
  if (!data) {
    return { ok: false, error: `Could not read ${dataPath}` };
  }

  // 2. Extreu clubs, teams, players
  const clubs = extractClubsFromCategories(data.categories || {});
  const teams = extractTeamsFromCategories(data.categories || {}, season);
  const players = extractPlayersFromDb(data, season);
  const syncErrors = [];

  console.log(`[sync] Extracted: ${clubs.length} clubs, ${teams.length} teams, ${players.length} players`);

  // 3. UPSERT clubs
  if (clubs.length) {
    const { error: clubErr } = await sb.from("clubs")
      .upsert(clubs.map(c => ({ name: c.displayName, jok_id: c.jok_id })), { onConflict: "name" });
    if (clubErr) {
      console.error("[sync] Error upserting clubs:", clubErr.message);
      syncErrors.push(`clubs: ${clubErr.message}`);
    }
  }

  // 4. UPSERT teams (necessita club_id FK, així que ho fem en dos passos)
  // Primer, obtenim el mapping de noms a IDs
  const { data: clubRows, error: clubReadErr } = await sb.from("clubs").select("id, name");
  if (clubReadErr) {
    console.error("[sync] Error reading clubs:", clubReadErr.message);
    syncErrors.push(`clubs-read: ${clubReadErr.message}`);
  }
  const clubIdMap = new Map(clubRows?.map(r => [normalizeClubName(r.name), r.id]) || []);

  if (teams.length) {
    const teamsWithClubId = teams.map(t => ({
      club_id: clubIdMap.get(normalizeClubName(t.club_name)) || null,
      club_name: t.club_name,
      team_name: t.team_name,
      category: t.category,
      season: t.season,
      team_key: t.team_key,
      jok_id: t.jok_id,  // jok.cat team ID
    }));
    const { error: teamErr } = await sb.from("teams")
      .upsert(teamsWithClubId, { onConflict: "club_id,team_name,category,season" });
    if (teamErr) {
      console.error("[sync] Error upserting teams:", teamErr.message);
      syncErrors.push(`teams: ${teamErr.message}`);
    }
  }

  // 5. UPSERT players (necessita team_id FK)
  const { data: teamRows, error: teamReadErr } = await sb.from("teams").select("id, team_key, jok_id");
  if (teamReadErr) {
    console.error("[sync] Error reading teams:", teamReadErr.message);
    syncErrors.push(`teams-read: ${teamReadErr.message}`);
  }
  const teamIdMap = new Map();
  const teamIdByJokMap = new Map();
  for (const t of teamRows || []) {
    teamIdMap.set(t.team_key, t.id);
    if (t.jok_id) teamIdByJokMap.set(String(t.jok_id), t.id);
  }

  if (players.length) {
    const playersWithTeamId = players.map(p => {
      // Look up team by team_key (consistent with teams table)
      return {
        id: makeDeterministicPlayerId({ season: p.season, name: p.name, teamName: p.team_key, category: p.category }),
        primary_team_id: teamIdByJokMap.get(String(p.team_jok_id || "")) || teamIdMap.get(p.team_key) || null,
        jok_id: p.jok_id,  // jok.cat player ID for linking
        name: p.name,
        slug: p.slug,
        team_key: p.team_key,  // Use team_key instead of full team_name for composite key
        dorsal: p.dorsal,
        position: p.position,
        is_goalkeeper: Boolean(p.is_goalkeeper),
        birth_date: p.birth_date,  // NOW POPULATED from extraction
        season: p.season,
      };
    });
    
    // Batch UPSERT to avoid statement timeout
    // Split into batches of 250 players each (trades memory for speed)
    const BATCH_SIZE = 250;
    let batchIndex = 0;
    
    for (let i = 0; i < playersWithTeamId.length; i += BATCH_SIZE) {
      const batch = playersWithTeamId.slice(i, i + BATCH_SIZE);
      batchIndex++;
      
      console.log(`[sync] Upserting player batch ${batchIndex}/${Math.ceil(playersWithTeamId.length / BATCH_SIZE)} (${batch.length} players)`);
      
      // Use direct UPSERT on each batch (not RPC to avoid RPC timeout)
      const { error: playerErr } = await sb.from("players")
        .upsert(batch, { onConflict: "slug,team_key,season" });
      
      if (playerErr) {
        console.error(`[sync] Error upserting player batch ${batchIndex}:`, playerErr.message);
        syncErrors.push(`players-batch-${batchIndex}: ${playerErr.message}`);
        break;  // Stop on first error
      }
    }
    
    if (syncErrors.length === 0) {
      console.log(`[sync] Successfully upserted ${playersWithTeamId.length} players in ${batchIndex} batches`);
    }
  }

  console.log(`[sync] Sync completed for season: ${seasonKey}`);
  if (syncErrors.length) {
    return {
      ok: false,
      clubs: clubs.length,
      teams: teams.length,
      players: players.length,
      error: syncErrors[0],
      errors: syncErrors,
    };
  }
  return { ok: true, clubs: clubs.length, teams: teams.length, players: players.length };
}

async function reconcileMissingPlayerTeams(sb) {
  const startedAt = Date.now();

  const { count: beforeCount, error: beforeErr } = await sb
    .from("players")
    .select("id", { count: "exact", head: true })
    .is("primary_team_id", null);
  if (beforeErr) {
    throw new Error(`Could not compute missing players before reconcile: ${beforeErr.message}`);
  }
  const beforeMissing = Number(beforeCount || 0);

  const { data: unresolvedRaw, error: unresolvedErr } = await sb
    .from("players")
    .select("id,jok_id,player_master_id,season,team_key")
    .is("primary_team_id", null);
  if (unresolvedErr) {
    throw new Error(`Could not load unresolved players: ${unresolvedErr.message}`);
  }
  const unresolved = (unresolvedRaw || []).filter(
    (p) => p.team_key == null || String(p.team_key).trim() === ""
  );
  if (!unresolved?.length) {
    return {
      ok: true,
      before_missing: beforeMissing,
      after_missing: beforeMissing,
      filled: 0,
      elapsed_s: ((Date.now() - startedAt) / 1000).toFixed(1),
      passes: { safe_jok_id: 0, fallback_jok_id: 0, safe_master_id: 0 },
    };
  }

  const [{ data: knownPlayers, error: knownErr }, { data: teams, error: teamsErr }] = await Promise.all([
    sb
      .from("players")
      .select("jok_id,player_master_id,season,primary_team_id")
      .not("primary_team_id", "is", null),
    sb
      .from("teams")
      .select("id,club_id,club_name,team_name,category,season,team_key,jok_id"),
  ]);
  if (knownErr) throw new Error(`Could not load known players: ${knownErr.message}`);
  if (teamsErr) throw new Error(`Could not load teams: ${teamsErr.message}`);

  const teamById = new Map((teams || []).map((t) => [t.id, t]));
  const teamByKey = new Map((teams || []).map((t) => [t.team_key, t]));
  const unresolvedById = new Map((unresolved || []).map((p) => [p.id, p]));

  const jokSources = new Map();
  const masterSources = new Map();
  for (const kp of knownPlayers || []) {
    if (!kp.jok_id && !kp.player_master_id) continue;
    const team = teamById.get(kp.primary_team_id);
    if (!team) continue;
    const src = {
      team,
      source_year: seasonStartYear(kp.season),
    };
    if (kp.jok_id) {
      const key = String(kp.jok_id);
      if (!jokSources.has(key)) jokSources.set(key, []);
      jokSources.get(key).push(src);
    }
    if (kp.player_master_id) {
      const key = String(kp.player_master_id);
      if (!masterSources.has(key)) masterSources.set(key, []);
      masterSources.get(key).push(src);
    }
  }

  const updates = new Map();
  const teamCandidates = new Map();
  const passCounters = { safe_jok_id: 0, fallback_jok_id: 0, safe_master_id: 0 };

  const queueUpdate = (playerId, sourceTeam, targetSeason, counterName) => {
    if (!unresolvedById.has(playerId) || updates.has(playerId)) return;
    const targetTeamKey = buildTeamKeyFromTeam(sourceTeam, targetSeason);
    updates.set(playerId, { playerId, targetTeamKey });
    if (!teamCandidates.has(targetTeamKey)) {
      teamCandidates.set(targetTeamKey, {
        club_id: sourceTeam.club_id || null,
        club_name: sourceTeam.club_name || "",
        team_name: sourceTeam.team_name || "",
        category: sourceTeam.category || "",
        season: String(targetSeason || "").trim(),
        team_key: targetTeamKey,
        jok_id: sourceTeam.jok_id || null,
      });
    }
    passCounters[counterName] += 1;
  };

  // Pass 1: safe by jok_id (single signature)
  for (const p of unresolved || []) {
    if (!p.jok_id) continue;
    const sources = jokSources.get(String(p.jok_id)) || [];
    if (!sources.length) continue;
    const signatures = new Set(sources.map((s) => canonicalSignature(s.team)));
    if (signatures.size !== 1) continue;
    const latest = sources.slice().sort((a, b) => b.source_year - a.source_year)[0];
    queueUpdate(p.id, latest.team, p.season, "safe_jok_id");
  }

  // Pass 2: nearest known season by jok_id
  for (const p of unresolved || []) {
    if (updates.has(p.id) || !p.jok_id) continue;
    const sources = jokSources.get(String(p.jok_id)) || [];
    if (!sources.length) continue;
    const targetYear = seasonStartYear(p.season);
    const best = sources
      .slice()
      .sort((a, b) => {
        const aPreferPast = a.source_year <= targetYear ? 0 : 1;
        const bPreferPast = b.source_year <= targetYear ? 0 : 1;
        if (aPreferPast !== bPreferPast) return aPreferPast - bPreferPast;
        const aDist = Math.abs(a.source_year - targetYear);
        const bDist = Math.abs(b.source_year - targetYear);
        if (aDist !== bDist) return aDist - bDist;
        return b.source_year - a.source_year;
      })[0];
    queueUpdate(p.id, best.team, p.season, "fallback_jok_id");
  }

  // Pass 3: safe by player_master_id (single signature)
  for (const p of unresolved || []) {
    if (updates.has(p.id) || !p.player_master_id) continue;
    const sources = masterSources.get(String(p.player_master_id)) || [];
    if (!sources.length) continue;
    const signatures = new Set(sources.map((s) => canonicalSignature(s.team)));
    if (signatures.size !== 1) continue;
    const latest = sources.slice().sort((a, b) => b.source_year - a.source_year)[0];
    queueUpdate(p.id, latest.team, p.season, "safe_master_id");
  }

  const teamRows = [...teamCandidates.values()];
  if (teamRows.length) {
    const { error: upsertTeamsErr } = await sb
      .from("teams")
      .upsert(teamRows, { onConflict: "team_key" });
    if (upsertTeamsErr) {
      throw new Error(`Could not upsert candidate teams during reconcile: ${upsertTeamsErr.message}`);
    }

    const { data: refreshedTeams, error: refreshTeamsErr } = await sb
      .from("teams")
      .select("id,team_key");
    if (refreshTeamsErr) {
      throw new Error(`Could not refresh teams after reconcile upsert: ${refreshTeamsErr.message}`);
    }
    teamByKey.clear();
    for (const t of refreshedTeams || []) teamByKey.set(t.team_key, t);
  }

  const playerRows = [];
  for (const u of updates.values()) {
    const t = teamByKey.get(u.targetTeamKey);
    if (!t?.id) continue;
    playerRows.push({ id: u.playerId, primary_team_id: t.id, team_key: u.targetTeamKey });
  }

  if (playerRows.length) {
    const BATCH_SIZE = 500;
    for (let i = 0; i < playerRows.length; i += BATCH_SIZE) {
      const batch = playerRows.slice(i, i + BATCH_SIZE);
      const { error: upsertPlayersErr } = await sb
        .from("players")
        .upsert(batch, { onConflict: "id" });
      if (upsertPlayersErr) {
        throw new Error(`Could not update players during reconcile: ${upsertPlayersErr.message}`);
      }
    }
  }

  const { count: afterCount, error: afterErr } = await sb
    .from("players")
    .select("id", { count: "exact", head: true })
    .is("primary_team_id", null);
  if (afterErr) {
    throw new Error(`Could not compute missing players after reconcile: ${afterErr.message}`);
  }
  const afterMissing = Number(afterCount || 0);

  return {
    ok: true,
    before_missing: beforeMissing,
    after_missing: afterMissing,
    filled: Math.max(0, beforeMissing - afterMissing),
    elapsed_s: ((Date.now() - startedAt) / 1000).toFixed(1),
    passes: passCounters,
  };
}

// Sincronitza TOTES les temporades
async function syncAllSeasonsToDatabase(sb, publicDir = "./public") {
  const results = {};
  const activeSeason = getActiveSeasonLabel();

  // 1. Sincronitza temporada actual (data.json)
  const currentDataPath = path.join(publicDir, "data.json");
  results.current = await syncSeasonToDatabase(sb, "current", currentDataPath, activeSeason);

  // 2. Sincronitza temporades anteriors (season-archive/{year}/data-{year}.json)
  const archiveDir = path.join(publicDir, "season-archive");
  const seasonYears = ["2021-22", "2022-23", "2023-24", "2024-25"];
  for (const year of seasonYears) {
    const seasonDataPath = path.join(archiveDir, "data-" + year + ".json");
    results[year] = await syncSeasonToDatabase(sb, year, seasonDataPath, year);
  }

  const hasErrors = Object.values(results).some(r => !r?.ok);
  if (hasErrors) {
    const summary = Object.entries(results)
      .filter(([, r]) => !r?.ok)
      .map(([seasonName, r]) => `${seasonName}: ${r?.error || "unknown error"}`)
      .join(" | ");
    throw new Error(`DB sync failed for one or more seasons. ${summary}`);
  }

  // Final automatic reconciliation pass so daily cron can recover unresolved links
  results.reconcile = await reconcileMissingPlayerTeams(sb);

  return results;
}

// Sincronitza només temporades actives (actual + futures)
// Per ara, data.json representa la temporada activa i és l'única que es processa diàriament.
async function syncActiveSeasonsToDatabase(sb, publicDir = "./public") {
  const results = {};
  const activeSeason = getActiveSeasonLabel();

  const currentDataPath = path.join(publicDir, "data.json");
  results.current = await syncSeasonToDatabase(sb, "current", currentDataPath, activeSeason);

  if (!results.current?.ok) {
    const reason = results.current?.error || "unknown error";
    throw new Error(`DB sync failed for active season. current: ${reason}`);
  }

  // Final automatic reconciliation pass so daily cron can recover unresolved links
  results.reconcile = await reconcileMissingPlayerTeams(sb);

  return results;
}

module.exports = {
  getActiveSeasonLabel,
  syncSeasonToDatabase,
  syncAllSeasonsToDatabase,
  syncActiveSeasonsToDatabase,
  reconcileMissingPlayerTeams,
  extractClubsFromCategories,
  extractTeamsFromCategories,
  extractPlayersFromDb,
};
