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
  const clubs = new Map(); // normalizedName → { name, jok_key }
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
          clubs.set(normalized, { displayName: clubName, jok_key: row?.clubId || null });
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
        });
      }
    }
  }
  return teams;
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
    // Decodifica URL-encoded slug, converteix + a espai
    const rawSlug = String(player?.slug || "");
    let slug = rawSlug;
    try {
      slug = decodeURIComponent(rawSlug);
    } catch (e) {
      // Si falla decoding, es pot que no sigui URL-encoded
    }
    slug = slug.replace(/\+/g, " ").trim();
    const name = String(player?.name || slug || "").trim();
    if (!name) continue;
    // Team stats: si existeixen, pren el primer
    const teamStats = Array.isArray(player?.teamStats) ? player.teamStats : [];
    const primaryTeam = teamStats[0];
    const teamName = primaryTeam?.team || "";
    const category = primaryTeam?.cat || "";
    const key = `${normalizeTeamName(name)}::${normalizeTeamName(teamName)}::${season}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const isGK = Boolean(
      String(player?.position || "").toLowerCase().includes("port")
      || player?.isGK
      || player?.is_goalkeeper
    );
    players.push({
      name: name,
      slug: slug,
      dorsal: player?.dorsal || "",
      position: player?.position || "Jugador",
      is_goalkeeper: isGK,
      team_name: teamName,
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
      .upsert(clubs.map(c => ({ name: c.displayName, jok_key: c.jok_key })), { onConflict: "name" });
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
    }));
    const { error: teamErr } = await sb.from("teams")
      .upsert(teamsWithClubId, { onConflict: "club_id,team_name,category,season" });
    if (teamErr) {
      console.error("[sync] Error upserting teams:", teamErr.message);
      syncErrors.push(`teams: ${teamErr.message}`);
    }
  }

  // 5. UPSERT players (necessita team_id FK)
  const { data: teamRows, error: teamReadErr } = await sb.from("teams").select("id, team_name, category, season");
  if (teamReadErr) {
    console.error("[sync] Error reading teams:", teamReadErr.message);
    syncErrors.push(`teams-read: ${teamReadErr.message}`);
  }
  const teamIdMap = new Map();
  for (const t of teamRows || []) {
    const key = `${normalizeTeamName(t.team_name)}::${normalizeTeamName(t.category)}::${t.season}`;
    teamIdMap.set(key, t.id);
  }

  if (players.length) {
    const playersWithTeamId = players.map(p => {
      const key = `${normalizeTeamName(p.name)}::${normalizeTeamName(p.team_name)}::${p.season}`;
      return {
        id: makeDeterministicPlayerId({ season: p.season, name: p.name, teamName: p.team_name, category: p.category }),
        primary_team_id: teamIdMap.get(key) || null,
        name: p.name,
        slug: p.slug,
        dorsal: p.dorsal,
        position: p.position,
        is_goalkeeper: Boolean(p.is_goalkeeper),
        season: p.season,
      };
    });
    const { error: playerErr } = await sb.from("players")
      .upsert(playersWithTeamId, { onConflict: "id" });
    if (playerErr) {
      console.error("[sync] Error upserting players:", playerErr.message);
      syncErrors.push(`players: ${playerErr.message}`);
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
