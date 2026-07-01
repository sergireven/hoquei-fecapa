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
          clubs.set(normalized, { displayName: clubName, jok_id: row?.clubId || null });
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
        const key = `${normalizeTeamName(teamName)}::${normalizeTeamName(category)}::${season}`;
        if (seen.has(key)) continue;
        seen.add(key);
        teams.push({
          club_name: clubName,
          team_name: buildFullTeamName(clubName, teamName, season),
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
    
    // Build team_key for consistent lookup and deduplication
    // Format: "normalized_team::normalized_category::season"
    const teamKey = `${normalizeTeamName(teamName)}::${normalizeTeamName(category)}::${season}`;
    
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
  const { data: teamRows, error: teamReadErr } = await sb.from("teams").select("id, team_key");
  if (teamReadErr) {
    console.error("[sync] Error reading teams:", teamReadErr.message);
    syncErrors.push(`teams-read: ${teamReadErr.message}`);
  }
  const teamIdMap = new Map();
  for (const t of teamRows || []) {
    teamIdMap.set(t.team_key, t.id);
  }

  if (players.length) {
    const playersWithTeamId = players.map(p => {
      // Look up team by team_key (consistent with teams table)
      return {
        id: makeDeterministicPlayerId({ season: p.season, name: p.name, teamName: p.team_key, category: p.category }),
        primary_team_id: teamIdMap.get(p.team_key) || null,
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

// Sincronitza TOTES les temporades
async function syncAllSeasonsToDatabase(sb, publicDir = "./public") {
  const results = {};

  // 1. Sincronitza temporada actual (data.json)
  const currentDataPath = path.join(publicDir, "data.json");
  results.current = await syncSeasonToDatabase(sb, "current", currentDataPath, "2025-26");

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

  return results;
}

module.exports = {
  syncSeasonToDatabase,
  syncAllSeasonsToDatabase,
  extractClubsFromCategories,
  extractTeamsFromCategories,
  extractPlayersFromDb,
};
