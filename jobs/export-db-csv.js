#!/usr/bin/env node
/**
 * Exporta CSVs per a la càrrega inicial de taules core a Supabase.
 *
 * Taules exportades:
 * - clubs
 * - teams
 * - players
 * - competitions
 * - competition_teams
 *
 * Fonts:
 * - public/data.json (temporada actual)
 * - public/season-archive/data-YYYY-YY.json (temporades històriques)
 *
 * Ús:
 *   node jobs/export-db-csv.js
 *   node jobs/export-db-csv.js --outDir public/db-csv
 */

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const ARCHIVE_DIR = path.join(PUBLIC_DIR, "season-archive");
const MANIFEST_PATH = path.join(ARCHIVE_DIR, "manifest.json");

const TEAM_LETTER_SUFFIX_RE = /\s+[A-E]$/i;

function normalizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return normalizeSpaces(value).toLowerCase();
}

function normalizeNoDiacritics(value) {
  return normalizeSpaces(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toIsoTimestamp() {
  return new Date().toISOString();
}

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value || "").replace(/\+/g, " "));
  } catch {
    return String(value || "").replace(/\+/g, " ");
  }
}

function parseArgs(argv) {
  const out = { outDir: path.join(PUBLIC_DIR, "db-csv") };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--outDir" && argv[i + 1]) {
      out.outDir = path.isAbsolute(argv[i + 1])
        ? argv[i + 1]
        : path.join(ROOT_DIR, argv[i + 1]);
      i += 1;
    }
  }
  return out;
}

function hashUuid(seed) {
  const hex = crypto.createHash("sha1").update(seed).digest("hex");
  const chars = hex.slice(0, 32).split("");
  chars[12] = "5";
  const variant = parseInt(chars[16], 16);
  chars[16] = ((variant & 0x3) | 0x8).toString(16);
  const s = chars.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

function makeId(kind, payload) {
  return hashUuid(`hoquei-fecapa:${kind}:${payload}`);
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  const raw = String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function writeCsv(filePath, headers, rows) {
  const lines = [];
  lines.push(headers.join(","));
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

async function readJson(filePath) {
  const content = await fsp.readFile(filePath, "utf8");
  return JSON.parse(content);
}

function inferSeasonFromCompName(name) {
  const match = String(name || "").match(/\((\d{4}-\d{2})\)/);
  return match ? match[1] : "";
}

function inferCategoryFromCompName(name, fallbackCategory) {
  const raw = String(name || "");
  const afterDash = raw.match(/[-–]\s*([^()]+?)\s*(?:\(|$)/);
  if (afterDash && afterDash[1]) return normalizeSpaces(afterDash[1]);
  return normalizeSpaces(fallbackCategory || "");
}

function inferCompetitionCode(name) {
  const cleaned = normalizeNoDiacritics(name).toUpperCase();
  const token = cleaned.split(/\s+/).find((t) => /^[A-Z]{2,10}$/.test(t));
  return token || null;
}

function inferCompetitionType(name) {
  const n = normalizeNoDiacritics(name).toLowerCase();
  if (n.includes("copa") || n.includes("playoff") || n.includes("eliminatoria") || n.includes("eliminatories")) {
    return "cup";
  }
  if (n.includes("amistos") || n.includes("friendly")) {
    return "friendly";
  }
  return "league";
}

function inferRegionalLevel(name) {
  const n = normalizeNoDiacritics(name).toLowerCase();
  if (n.includes("nacional")) return "estatal";
  if (n.includes("catalana") || n.includes("catalunya")) return "autonomic";
  if (n.includes("barcelona") || n.includes("tarragona") || n.includes("girona") || n.includes("lleida")) {
    return "local";
  }
  return null;
}

function normalizeClubFromTeam(teamName) {
  return normalizeSpaces(teamName).replace(TEAM_LETTER_SUFFIX_RE, "").trim();
}

function normalizePlayerName(name) {
  const decoded = safeDecode(name);
  const noPrefix = decoded.replace(/^[A-Z0-9]+\s+/, "");
  return normalizeSpaces(noPrefix || decoded);
}

function toIntOrDefault(value, defaultValue = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

function deriveStats(row) {
  return {
    matches_played: toIntOrDefault(row?.pj ?? row?.played ?? row?.J, 0),
    wins: toIntOrDefault(row?.pg ?? row?.won ?? row?.G, 0),
    draws: toIntOrDefault(row?.pe ?? row?.drawn ?? row?.E, 0),
    losses: toIntOrDefault(row?.pp ?? row?.lost ?? row?.P, 0),
    points_for: toIntOrDefault(row?.gf ?? row?.goalsFor ?? row?.favor ?? row?.PF, 0),
    points_against: toIntOrDefault(row?.gc ?? row?.goalsAgainst ?? row?.contra ?? row?.PC, 0),
    league_position: Number.isFinite(Number(row?.pos ?? row?.position))
      ? Number(row?.pos ?? row?.position)
      : null,
  };
}

function getSeasonInputs() {
  const inputs = [];
  inputs.push({ season: "2025-26", filePath: path.join(PUBLIC_DIR, "data.json"), key: "current" });

  if (fs.existsSync(MANIFEST_PATH)) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    for (const seasonMeta of manifest.seasons || []) {
      const season = String(seasonMeta?.key || "").trim();
      if (!season) continue;
      inputs.push({
        season,
        key: season,
        filePath: path.join(PUBLIC_DIR, `season-archive/data-${season}.json`),
      });
    }
  } else {
    const defaultSeasons = ["2021-22", "2022-23", "2023-24", "2024-25"];
    for (const season of defaultSeasons) {
      inputs.push({ season, key: season, filePath: path.join(PUBLIC_DIR, `season-archive/data-${season}.json`) });
    }
  }

  const bySeason = new Map();
  for (const input of inputs) bySeason.set(input.season, input);
  return [...bySeason.values()].sort((a, b) => a.season.localeCompare(b.season));
}

function upsertMap(map, key, builder, patcher) {
  if (!map.has(key)) {
    map.set(key, builder());
  } else if (patcher) {
    patcher(map.get(key));
  }
  return map.get(key);
}

function extractAllFromSeason({ data, season, context }) {
  const { clubs, competitions, teams, competitionTeams, players } = context;

  const now = toIsoTimestamp();
  const categories = data?.categories || {};

  for (const [categoryKey, comps] of Object.entries(categories)) {
    if (!Array.isArray(comps)) continue;

    for (const comp of comps) {
      const compName = normalizeSpaces(comp?.name || comp?.competitionName || "");
      if (!compName) continue;

      const compSeason = inferSeasonFromCompName(compName) || season;
      const compCategory = inferCategoryFromCompName(compName, categoryKey);
      const compKey = `${normalizeKey(compName)}::${normalizeKey(compSeason)}::${normalizeKey(compCategory)}`;
      const competitionId = makeId("competition", compKey);

      upsertMap(
        competitions,
        compKey,
        () => ({
          id: competitionId,
          name: compName,
          competition_code: inferCompetitionCode(compName),
          category: compCategory,
          season: compSeason,
          competition_type: inferCompetitionType(compName),
          league_name: null,
          regional_level: inferRegionalLevel(compName),
          total_teams: 0,
          created_at: now,
          updated_at: now,
        })
      );

      const rows = Array.isArray(comp?.classification) ? comp.classification : [];
      for (const row of rows) {
        const rawTeamName = normalizeSpaces(row?.team || row?.teamName || "");
        if (!rawTeamName) continue;

        const clubName = normalizeClubFromTeam(rawTeamName);
        if (!clubName) continue;

        const clubKey = normalizeKey(clubName);
        const clubId = makeId("club", clubKey);
        upsertMap(
          clubs,
          clubKey,
          () => ({
            id: clubId,
            name: clubName,
            jok_key: row?.clubId ? String(row.clubId) : null,
            created_at: now,
            updated_at: now,
          }),
          (existing) => {
            if (!existing.jok_key && row?.clubId) existing.jok_key = String(row.clubId);
          }
        );

        const teamKeyBase = `${normalizeKey(clubName)}::${normalizeKey(rawTeamName)}::${normalizeKey(compCategory)}::${normalizeKey(compSeason)}`;
        const teamId = makeId("team", teamKeyBase);

        upsertMap(
          teams,
          teamKeyBase,
          () => ({
            id: teamId,
            club_id: clubId,
            club_name: clubName,
            team_name: rawTeamName,
            category: compCategory,
            season: compSeason,
            team_key: teamKeyBase,
            created_at: now,
            updated_at: now,
          })
        );

        const compTeamKey = `${competitionId}::${teamId}`;
        const stats = deriveStats(row);

        upsertMap(
          competitionTeams,
          compTeamKey,
          () => ({
            id: makeId("competition_team", compTeamKey),
            competition_id: competitionId,
            team_id: teamId,
            team_seed: null,
            league_position: stats.league_position,
            matches_played: stats.matches_played,
            wins: stats.wins,
            draws: stats.draws,
            losses: stats.losses,
            points_for: stats.points_for,
            points_against: stats.points_against,
            joined_at: null,
            created_at: now,
            updated_at: now,
          }),
          (existing) => {
            const played = Number(existing.matches_played || 0);
            if (stats.matches_played > played) {
              existing.matches_played = stats.matches_played;
              existing.wins = stats.wins;
              existing.draws = stats.draws;
              existing.losses = stats.losses;
              existing.points_for = stats.points_for;
              existing.points_against = stats.points_against;
              existing.league_position = stats.league_position;
            }
          }
        );
      }
    }
  }

  // Jugadors (global object per temporada)
  const jugadors = data?.jugadors || {};
  for (const [sidgadId, player] of Object.entries(jugadors)) {
    const rawName = normalizeSpaces(player?.name || player?.slug || "");
    if (!rawName) continue;

    const playerName = normalizePlayerName(rawName);
    const slug = normalizeSpaces(player?.slug || "") || null;

    let primaryTeamId = null;
    let resolvedCategory = "";

    const teamStats = Array.isArray(player?.teamStats) ? player.teamStats : [];
    if (teamStats.length) {
      const ts = teamStats[0] || {};
      const tName = normalizeSpaces(ts?.team || "");
      const tCat = normalizeSpaces(ts?.cat || "");
      if (tName && tCat) {
        const guessedClub = normalizeClubFromTeam(tName);
        const teamKeyBase = `${normalizeKey(guessedClub)}::${normalizeKey(tName)}::${normalizeKey(tCat)}::${normalizeKey(season)}`;
        const team = teams.get(teamKeyBase);
        if (team) {
          primaryTeamId = team.id;
          resolvedCategory = tCat;
        }
      }
    }

    const playerSeed = `${sidgadId}::${normalizeKey(playerName)}::${normalizeKey(season)}`;
    const playerKey = `${normalizeKey(playerName)}::${normalizeKey(season)}`;
    upsertMap(
      players,
      playerKey,
      () => ({
        id: makeId("player", playerSeed),
        primary_team_id: primaryTeamId,
        name: playerName,
        slug,
        dorsal: normalizeSpaces(player?.dorsal || ""),
        position: player?.position ? String(player.position) : "Jugador",
        is_goalkeeper: Boolean(player?.isGK || player?.is_goalkeeper),
        season,
        created_at: now,
        updated_at: now,
      }),
      (existing) => {
        if (!existing.primary_team_id && primaryTeamId) existing.primary_team_id = primaryTeamId;
        if ((!existing.slug || existing.slug === "") && slug) existing.slug = slug;
      }
    );

    // Si no hi ha teamStats per aquell jugador, intentem fallback per registeredTeam de sidgad.
    if (!primaryTeamId && player?.registeredTeam) {
      const registered = normalizeSpaces(player.registeredTeam);
      if (registered) {
        const teamCandidates = [...teams.values()].filter(
          (t) => t.season === season && normalizeKey(t.team_name).includes(normalizeKey(registered))
        );
        if (teamCandidates.length === 1) {
          const entry = players.get(playerKey);
          entry.primary_team_id = teamCandidates[0].id;
        }
      }
    }

    if (resolvedCategory) {
      const entry = players.get(playerKey);
      if (!entry.position || entry.position === "") {
        entry.position = "Jugador";
      }
    }
  }
}

function finalizeCompetitionTeamCounters(competitions, competitionTeams) {
  const counter = new Map();
  for (const row of competitionTeams.values()) {
    const key = row.competition_id;
    counter.set(key, (counter.get(key) || 0) + 1);
  }
  for (const comp of competitions.values()) {
    comp.total_teams = counter.get(comp.id) || 0;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  await fsp.mkdir(args.outDir, { recursive: true });

  const context = {
    clubs: new Map(),
    teams: new Map(),
    players: new Map(),
    competitions: new Map(),
    competitionTeams: new Map(),
  };

  const seasonInputs = getSeasonInputs();
  const processed = [];
  const skipped = [];

  for (const input of seasonInputs) {
    if (!fs.existsSync(input.filePath)) {
      skipped.push({ ...input, reason: "file_missing" });
      continue;
    }

    // Processar fitxer per temporada evita carregar totes les temporades alhora.
    const data = await readJson(input.filePath);
    extractAllFromSeason({ data, season: input.season, context });
    processed.push(input);
  }

  finalizeCompetitionTeamCounters(context.competitions, context.competitionTeams);

  const clubsRows = [...context.clubs.values()].sort((a, b) => a.name.localeCompare(b.name));
  const teamsRows = [...context.teams.values()].sort((a, b) => {
    const sa = `${a.season}::${a.club_name}::${a.team_name}`;
    const sb = `${b.season}::${b.club_name}::${b.team_name}`;
    return sa.localeCompare(sb);
  });
  const playersRows = [...context.players.values()].sort((a, b) => {
    const sa = `${a.season}::${a.name}`;
    const sb = `${b.season}::${b.name}`;
    return sa.localeCompare(sb);
  });
  const competitionsRows = [...context.competitions.values()].sort((a, b) => {
    const sa = `${a.season}::${a.category}::${a.name}`;
    const sb = `${b.season}::${b.category}::${b.name}`;
    return sa.localeCompare(sb);
  });
  const competitionTeamsRows = [...context.competitionTeams.values()].sort((a, b) => {
    const sa = `${a.competition_id}::${a.team_id}`;
    const sb = `${b.competition_id}::${b.team_id}`;
    return sa.localeCompare(sb);
  });

  writeCsv(
    path.join(args.outDir, "clubs.csv"),
    ["id", "name", "jok_key", "created_at", "updated_at"],
    clubsRows
  );

  writeCsv(
    path.join(args.outDir, "teams.csv"),
    ["id", "club_id", "club_name", "team_name", "category", "season", "team_key", "created_at", "updated_at"],
    teamsRows
  );

  writeCsv(
    path.join(args.outDir, "players.csv"),
    ["id", "primary_team_id", "name", "slug", "dorsal", "position", "is_goalkeeper", "season", "created_at", "updated_at"],
    playersRows
  );

  writeCsv(
    path.join(args.outDir, "competitions.csv"),
    [
      "id",
      "name",
      "competition_code",
      "category",
      "season",
      "competition_type",
      "league_name",
      "regional_level",
      "total_teams",
      "created_at",
      "updated_at",
    ],
    competitionsRows
  );

  writeCsv(
    path.join(args.outDir, "competition_teams.csv"),
    [
      "id",
      "competition_id",
      "team_id",
      "team_seed",
      "league_position",
      "matches_played",
      "wins",
      "draws",
      "losses",
      "points_for",
      "points_against",
      "joined_at",
      "created_at",
      "updated_at",
    ],
    competitionTeamsRows
  );

  const report = {
    generatedAt: new Date().toISOString(),
    outDir: args.outDir,
    processedSeasons: processed.map((s) => ({ season: s.season, filePath: s.filePath })),
    skippedSeasons: skipped,
    counts: {
      clubs: clubsRows.length,
      teams: teamsRows.length,
      players: playersRows.length,
      competitions: competitionsRows.length,
      competition_teams: competitionTeamsRows.length,
    },
    loadOrder: ["clubs.csv", "teams.csv", "competitions.csv", "players.csv", "competition_teams.csv"],
  };

  await fsp.writeFile(path.join(args.outDir, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log("[export-db-csv] Done");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("[export-db-csv] Error:", err);
  process.exit(1);
});
