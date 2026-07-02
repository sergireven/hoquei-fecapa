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
 * - matches_historical
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
const ACTES_CURRENT_DIR = path.join(PUBLIC_DIR, "actes");
const ACTES_ARCHIVE_DIR = path.join(ARCHIVE_DIR, "actes");

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

function extractNumericId(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d+)/);
  return match ? match[1] : null;
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

function normalizeBirthDate(value) {
  const raw = normalizeSpaces(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = String(m[1]).padStart(2, "0");
  const mm = String(m[2]).padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
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

function writeCsvSplitByLineLimit(baseFilePath, headers, rows, maxLinesPerFile = 10000) {
  const maxDataRows = Math.max(1, Number(maxLinesPerFile || 0) - 1);
  const parsed = path.parse(baseFilePath);
  const fileNames = [];

  if (rows.length <= maxDataRows) {
    writeCsv(baseFilePath, headers, rows);
    return [path.basename(baseFilePath)];
  }

  let part = 1;
  for (let i = 0; i < rows.length; i += maxDataRows) {
    const chunk = rows.slice(i, i + maxDataRows);
    const filePath = part === 1
      ? baseFilePath
      : path.join(parsed.dir, `${parsed.name}_${String(part).padStart(3, "0")}${parsed.ext}`);
    writeCsv(filePath, headers, chunk);
    fileNames.push(path.basename(filePath));
    part += 1;
  }

  return fileNames;
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

function shouldMarkCompetitionFinished(season) {
  return String(season || "").trim() === "2025-26";
}

function normalizeClubFromTeam(teamName) {
  return normalizeSpaces(teamName).replace(TEAM_LETTER_SUFFIX_RE, "").trim();
}

function normalizePlayerName(name) {
  const decoded = safeDecode(name);
  const normalized = normalizeSpaces(decoded);
  if (!normalized) return "";

  const prefixMatch = normalized.match(/^([A-Z0-9]{2,})\s+(.+)$/);
  if (!prefixMatch) return normalized;

  const firstToken = String(prefixMatch[1] || "").trim();
  const rest = normalizeSpaces(prefixMatch[2] || "");
  const looksLikeCode = /\d/.test(firstToken)
    || /^(ID|CODI|JUG|PID)\d*$/i.test(firstToken)
    || /^#?\d+$/.test(firstToken);

  return (looksLikeCode && rest) ? rest : normalized;
}

function toIntOrDefault(value, defaultValue = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

function seasonToActesFolder(season) {
  return String(season || "").trim();
}

function guessSeasonFromActa(record, seasonFallback) {
  const fromComp = inferSeasonFromCompName(record?.compName || "");
  if (fromComp) return fromComp;
  const rawDate = normalizeSpaces(record?.actaMeta?.date || "");
  const m = rawDate.match(/(\d{4})$/);
  if (!m) return seasonFallback;
  const year = Number(m[1]);
  if (!Number.isFinite(year)) return seasonFallback;
  const short = String(year + 1).slice(-2);
  return `${year}-${short}`;
}

function parseActaDate(record) {
  const raw = normalizeSpaces(record?.actaMeta?.date || "");
  const m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const dd = m[1];
  const mm = m[2];
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function stringifyJson(value) {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
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
          is_finished: shouldMarkCompetitionFinished(compSeason),
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
            jok_id: extractNumericId(row?.clubId),
            jok_key: row?.clubId ? String(row.clubId) : null,
            created_at: now,
            updated_at: now,
          }),
          (existing) => {
            if (!existing.jok_id) {
              existing.jok_id = extractNumericId(row?.clubId);
            }
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
            jok_id: row?.teamId ? String(row.teamId) : null,
            created_at: now,
            updated_at: now,
          }),
          (existing) => {
            if (!existing.jok_id && row?.teamId) existing.jok_id = String(row.teamId);
          }
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
    let resolvedTeamKey = null;
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
          resolvedTeamKey = team.team_key;
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
        jok_id: sidgadId ? String(sidgadId) : null,
        primary_team_id: primaryTeamId,
        player_master_id: null,
        team_key: resolvedTeamKey,
        name: playerName,
        slug,
        dorsal: normalizeSpaces(player?.dorsal || ""),
        position: player?.position ? String(player.position) : "Jugador",
        is_goalkeeper: Boolean(player?.isGK || player?.is_goalkeeper),
        birth_date: normalizeBirthDate(player?.birthDate || player?.birth_date),
        season,
        created_at: now,
        updated_at: now,
      }),
      (existing) => {
        if (!existing.jok_id && sidgadId) existing.jok_id = String(sidgadId);
        if (!existing.primary_team_id && primaryTeamId) existing.primary_team_id = primaryTeamId;
        if (!existing.team_key && resolvedTeamKey) existing.team_key = resolvedTeamKey;
        if (!existing.birth_date) {
          const parsedBirthDate = normalizeBirthDate(player?.birthDate || player?.birth_date);
          if (parsedBirthDate) existing.birth_date = parsedBirthDate;
        }
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
          entry.team_key = teamCandidates[0].team_key;
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

function buildTeamLookup(teams) {
  const byExact = new Map();
  const byNoDiacritics = new Map();

  for (const team of teams.values()) {
    const exactKey = `${normalizeKey(team.season)}::${normalizeKey(team.category)}::${normalizeKey(team.team_name)}`;
    const normKey = `${normalizeKey(team.season)}::${normalizeKey(team.category)}::${normalizeNoDiacritics(team.team_name).toLowerCase()}`;
    if (!byExact.has(exactKey)) byExact.set(exactKey, team.id);
    if (!byNoDiacritics.has(normKey)) byNoDiacritics.set(normKey, team.id);
  }

  return { byExact, byNoDiacritics };
}

function resolveTeamId({ teamLookup, season, category, teamName }) {
  const exactKey = `${normalizeKey(season)}::${normalizeKey(category)}::${normalizeKey(teamName)}`;
  if (teamLookup.byExact.has(exactKey)) return teamLookup.byExact.get(exactKey);

  const normKey = `${normalizeKey(season)}::${normalizeKey(category)}::${normalizeNoDiacritics(teamName).toLowerCase()}`;
  return teamLookup.byNoDiacritics.get(normKey) || null;
}

async function readActesFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const parsed = await readJson(filePath);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed;
}

async function extractHistoricalMatches({ seasonInputs, teams, competitions }) {
  const now = toIsoTimestamp();
  const matches = new Map();
  const teamLookup = buildTeamLookup(teams);
  const competitionIdByKey = new Map();

  for (const comp of competitions.values()) {
    const compKey = `${normalizeKey(comp.name)}::${normalizeKey(comp.season)}::${normalizeKey(comp.category)}`;
    competitionIdByKey.set(compKey, comp.id);
  }

  const acteFilesBySeason = new Map();

  for (const input of seasonInputs) {
    if (input.season === "2025-26") {
      if (fs.existsSync(ACTES_CURRENT_DIR)) {
        const files = (await fsp.readdir(ACTES_CURRENT_DIR)).filter((f) => f.endsWith(".json"));
        acteFilesBySeason.set(input.season, files.map((f) => path.join(ACTES_CURRENT_DIR, f)));
      }
      continue;
    }

    const folder = path.join(ACTES_ARCHIVE_DIR, seasonToActesFolder(input.season));
    if (!fs.existsSync(folder)) continue;
    const files = (await fsp.readdir(folder)).filter((f) => f.endsWith(".json"));
    acteFilesBySeason.set(input.season, files.map((f) => path.join(folder, f)));
  }

  for (const [seasonHint, files] of acteFilesBySeason.entries()) {
    for (const filePath of files) {
      const categoryFromFile = normalizeSpaces(path.basename(filePath, ".json").replace(/-/g, " "));
      const actas = await readActesFile(filePath);
      for (const record of Object.values(actas)) {
        if (!record || typeof record !== "object") continue;
        const sourceActaId = normalizeSpaces(record.actaId || record.id || "");
        if (!sourceActaId) continue;

        const season = guessSeasonFromActa(record, seasonHint);
        const compName = normalizeSpaces(record.compName || record.actaMeta?.compName || "");
        const category = inferCategoryFromCompName(compName, categoryFromFile);
        const competitionKey = `${normalizeKey(compName)}::${normalizeKey(season)}::${normalizeKey(category)}`;
        const competitionId = competitionIdByKey.get(competitionKey) || null;

        const homeTeamName = normalizeSpaces(record.home || "");
        const awayTeamName = normalizeSpaces(record.away || "");

        const matchSeed = `${season}::${sourceActaId}`;
        const id = makeId("historical_match", matchSeed);
        const matchDateIso = parseActaDate(record);
        const referees = Array.isArray(record.referees) ? record.referees.filter(Boolean) : [];

        const homeTeamId = homeTeamName
          ? resolveTeamId({ teamLookup, season, category, teamName: homeTeamName })
          : null;
        const awayTeamId = awayTeamName
          ? resolveTeamId({ teamLookup, season, category, teamName: awayTeamName })
          : null;

        matches.set(id, {
          id,
          source_acta_id: sourceActaId,
          season,
          category,
          competition_id: competitionId,
          competition_name: compName || null,
          jornada: Number.isFinite(Number(record.jornada)) ? Number(record.jornada) : null,
          match_date: matchDateIso,
          match_time: normalizeSpaces(record.time || record.actaMeta?.time || "") || null,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_team_name: homeTeamName || null,
          away_team_name: awayTeamName || null,
          home_score: Number.isFinite(Number(record.homeScore)) ? Number(record.homeScore) : null,
          away_score: Number.isFinite(Number(record.awayScore)) ? Number(record.awayScore) : null,
          referees_json: stringifyJson(referees),
          acta_url: normalizeSpaces(record.actaUrl || record.url || "") || null,
          raw_json: stringifyJson(record),
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

  return [...matches.values()].sort((a, b) => {
    const sa = `${a.season}::${a.category}::${a.jornada || 0}::${a.source_acta_id}`;
    const sb = `${b.season}::${b.category}::${b.jornada || 0}::${b.source_acta_id}`;
    return sa.localeCompare(sb);
  });
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
  const historicalMatchesRows = await extractHistoricalMatches({
    seasonInputs,
    teams: context.teams,
    competitions: context.competitions,
  });

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
    ["id", "name", "jok_id", "jok_key", "created_at", "updated_at"],
    clubsRows
  );

  writeCsv(
    path.join(args.outDir, "teams.csv"),
    ["id", "club_id", "club_name", "team_name", "category", "season", "team_key", "jok_id", "created_at", "updated_at"],
    teamsRows
  );

  writeCsv(
    path.join(args.outDir, "players.csv"),
    ["id", "jok_id", "primary_team_id", "player_master_id", "team_key", "name", "slug", "dorsal", "position", "is_goalkeeper", "birth_date", "season", "created_at", "updated_at"],
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
      "is_finished",
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

  const matchesHistoricalHeaders = [
    "id",
    "source_acta_id",
    "season",
    "category",
    "competition_id",
    "competition_name",
    "jornada",
    "match_date",
    "match_time",
    "home_team_id",
    "away_team_id",
    "home_team_name",
    "away_team_name",
    "home_score",
    "away_score",
    "referees_json",
    "acta_url",
    "raw_json",
    "created_at",
    "updated_at",
  ];

  const matchesHistoricalFiles = writeCsvSplitByLineLimit(
    path.join(args.outDir, "matches_historical.csv"),
    matchesHistoricalHeaders,
    historicalMatchesRows,
    10000
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
      matches_historical: historicalMatchesRows.length,
    },
    loadOrder: [
      "clubs.csv",
      "teams.csv",
      "competitions.csv",
      "players.csv",
      "competition_teams.csv",
      ...matchesHistoricalFiles,
    ],
    matches_historical_files: matchesHistoricalFiles,
    limits: {
      csvMaxLinesPerFile: 10000,
      matchesHistoricalMaxDataRowsPerFile: 9999,
    },
  };

  await fsp.writeFile(path.join(args.outDir, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log("[export-db-csv] Done");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("[export-db-csv] Error:", err);
  process.exit(1);
});
