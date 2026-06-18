// ═══════════════════════════════════════════════════════════════════════════
// PANELL D'ENTRENADOR — coach-panel.js  (v20260606a)
// Fase 1: Planificació d'entrenaments + Objectius Jugadors (spider chart SVG)
// Fase 2: Partits en temps real (Pre-Partit | En Viu | Tàctiques)
// ═══════════════════════════════════════════════════════════════════════════

/* ── Pillar catalog ──────────────────────────────────────────────────────── */
const COACH_PILLARS = [
  { id: "tecnica", label: "Tècnica",  color: "#2563eb", short: "TÈC" },
  { id: "tactica", label: "Tàctica",  color: "#7c3aed", short: "TÀC" },
  { id: "fisic",   label: "Físic",    color: "#059669", short: "FÍS" },
  { id: "mental",  label: "Mental",   color: "#d97706", short: "MEN" },
  { id: "defensa", label: "Defensa",  color: "#dc2626", short: "DEF" },
  { id: "atac",    label: "Atac",     color: "#0891b2", short: "ATA" },
];

const COACH_EXERCISES = {
  tecnica: [
    "Circuit control pilota amb cons: 3 sèries × 5 min",
    "Sortida de bastó en parelles: 4 × 3 min",
    "Tir a porteria des de diverses posicions: 10 tirs/jugador",
    "Conducció en zigzag a velocitat progressiva: 5 min",
    "Regat 1vs1 en corredor estret: 4 × 3 min",
  ],
  tactica: [
    "Rondo posicional 5vs2: 3 × 5 min",
    "Transicions atac-defensa 4vs4: 15 min",
    "Joc de poder 5vs4 amb variants: 20 min",
    "Pressing alt en blocs de 3: 10 min",
    "Sortida de pressió des de porteria: 3 × 5 min",
  ],
  fisic: [
    "Escalfament dinàmic + activació muscular: 15 min",
    "Intervals de velocitat 20 m: 8 repeticions",
    "Circuit força de cames (pes corporal): 3 rondes × 8 min",
    "Resistència aeròbica amb pilota en continu: 20 min",
    "Agilitat amb cons i barreres: 10 min",
  ],
  mental: [
    "Concentració sota pressió externa (crits): 10 min",
    "Situació de desavantatge i gestió emocional: 15 min",
    "Comunicació en joc de posició: 10 min",
    "Dinàmica de confiança en parelles: 8 min",
  ],
  defensa: [
    "1vs1 defensiu en corredor estret: 3 × 4 min",
    "Coberta i ajuda 2vs2: 10 min",
    "Blocatge de tirs per sectors: 3 × 8 tirs",
    "Defensa en zona 5vs5: 15 min",
    "Pressió al portador i cobertura ràpida: 4 × 4 min",
  ],
  atac: [
    "1vs1 ofensiu amb finalització: 4 × 4 min",
    "Combinació 2vs1 al sector ofensiu: 3 × 5 min",
    "Tir de llarga distància amb oposició: 10 tirs/jugador",
    "Contratac ràpid 3vs2: 15 min",
    "Finalització en moviment (xuts dins àrea): 3 × 5 min",
  ],
};

const COACH_TACTICS = [
  {
    name: "1-2-1  Estàndard",
    desc: "Formació equilibrada amb 4 de camp + porter contra 4 + porter.",
    homeGoalie: true,
    awayGoalie: true,
    homePositions: [{ x: 28, y: 50 }, { x: 50, y: 30 }, { x: 50, y: 70 }, { x: 72, y: 50 }],
    awayPositions: [{ x: 62, y: 25 }, { x: 70, y: 40 }, { x: 70, y: 60 }, { x: 62, y: 75 }],
  },
  {
    name: "2-2  Defensiu",
    desc: "2 defenses + 2 davanters amb estructura completa als dos equips.",
    homeGoalie: true,
    awayGoalie: true,
    homePositions: [{ x: 30, y: 35 }, { x: 30, y: 65 }, { x: 65, y: 35 }, { x: 65, y: 65 }],
    awayPositions: [{ x: 64, y: 26 }, { x: 72, y: 42 }, { x: 72, y: 58 }, { x: 64, y: 74 }],
  },
  {
    name: "3-1  Ofensiu",
    desc: "Pressió alta: 4 de camp + porter contra 4 + porter.",
    homeGoalie: true,
    awayGoalie: true,
    homePositions: [{ x: 28, y: 50 }, { x: 62, y: 25 }, { x: 68, y: 50 }, { x: 62, y: 75 }],
    awayPositions: [{ x: 58, y: 22 }, { x: 74, y: 38 }, { x: 74, y: 62 }, { x: 58, y: 78 }],
  },
  {
    name: "1-3  Contratac",
    desc: "Replegament i sortida ràpida amb 4 de camp + porter.",
    homeGoalie: true,
    awayGoalie: true,
    homePositions: [{ x: 30, y: 25 }, { x: 35, y: 50 }, { x: 30, y: 75 }, { x: 72, y: 50 }],
    awayPositions: [{ x: 61, y: 24 }, { x: 71, y: 41 }, { x: 71, y: 59 }, { x: 61, y: 76 }],
  },
  {
    name: "Diamant",
    desc: "Diamant clàssic amb pivot central i rival complet.",
    homeGoalie: true,
    awayGoalie: true,
    homePositions: [{ x: 28, y: 50 }, { x: 50, y: 68 }, { x: 50, y: 32 }, { x: 72, y: 50 }],
    awayPositions: [{ x: 62, y: 26 }, { x: 74, y: 40 }, { x: 74, y: 60 }, { x: 62, y: 74 }],
  },
  {
    name: "5 vs 4+PORT",
    desc: "Equip local sense porter: 5 de camp contra 4 de camp + porter rival.",
    homeGoalie: false,
    awayGoalie: true,
    homePositions: [{ x: 25, y: 50 }, { x: 42, y: 28 }, { x: 42, y: 72 }, { x: 60, y: 38 }, { x: 60, y: 62 }],
    awayPositions: [{ x: 67, y: 24 }, { x: 74, y: 40 }, { x: 74, y: 60 }, { x: 67, y: 76 }],
  },
  {
    name: "4 vs 3+PORT",
    desc: "Situació especial: 4 de camp + porter contra 3 de camp + porter.",
    homeGoalie: true,
    awayGoalie: true,
    homePositions: [{ x: 28, y: 50 }, { x: 48, y: 30 }, { x: 48, y: 70 }, { x: 68, y: 50 }],
    awayPositions: [{ x: 69, y: 32 }, { x: 77, y: 50 }, { x: 69, y: 68 }],
  },
];

const COACH_TACTIC_TOOLS = [
  { id: "move",  icon: "✋", label: "Moure",       color: "#1a2035", hint: "Selecciona jugador o pilota i toca el camp per reposicionar." },
  { id: "pass",  icon: "➜", label: "Passada",     color: "#2563eb", hint: "Marca origen i destí per dibuixar una passada." },
  { id: "shot",  icon: "🎯", label: "Xut",         color: "#dc2626", hint: "Marca origen i final per indicar un tir." },
  { id: "carry", icon: "⤳", label: "Conducció",   color: "#0891b2", hint: "Traça la conducció o patinada amb pilota." },
  { id: "screen",icon: "⛔", label: "Bloqueig",    color: "#d97706", hint: "Indica un bloqueig o pantalla entre dos punts." },
  { id: "zone",  icon: "▧", label: "Zona",        color: "#7c3aed", hint: "Defineix una zona en dues pulsacions. Clic dret sobre la zona per canviar color." },
  { id: "erase", icon: "⌫", label: "Esborrar",    color: "#64748b", hint: "Toca una acció dibuixada per eliminar-la." },
];

const COACH_TACTIC_PLAYBOOK_KEY = "hoquei_coach_playbook_v1";
const COACH_TACTIC_BOARD_STATE_KEY = "hoquei_coach_tactic_board_state_v1";
const COACH_CONVOCATORIA_CACHE_KEY = "hoquei_coordinator_convocatorias_v2";
const COACH_FAVORITE_TEAMS_KEY = "hoquei_coach_favorite_teams_v1";

// Construeix team_name harmonitzat: Club + Equip + Temporada
// Exemple: "Club Hoquei Ripollet Prebenjamí B 2025-26"
function buildFullTeamName(clubName, teamName, season = "2025-26") {
  const club = String(clubName || "").trim();
  const team = String(teamName || "").trim();
  const s = String(season || "2025-26").trim();
  if (!club || !team) return "";
  return `${club} ${team} ${s}`;
}
const COACH_SELECTED_CLUB_KEY = "hoquei_coach_selected_club_v1";
const COACH_MAX_FAVORITES = 2;
const COACH_DEFAULT_TACTIC_IDX = 1; // 2-2 Defensiu
const COACH_ZONE_COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#16a34a", "#d97706", "#dc2626"];
const COACH_GOALIE_AREAS = {
  home: { xMin: 8.8, xMax: 20.5, yMin: 35.5, yMax: 64.5 },
  away: { xMin: 79.5, xMax: 91.2, yMin: 35.5, yMax: 64.5 },
};
const COACH_ACTA_ARCHIVE_FILES = [
  "./actes/alevi.json",
  "./actes/altres.json",
  "./actes/benjami.json",
  "./actes/fem.json",
  "./actes/infantil.json",
  "./actes/junior.json",
  "./actes/juvenil.json",
  "./actes/nacional-catalana.json",
  "./actes/prebenjami.json",
  "./actes/veterans.json",
];

/* ── State ───────────────────────────────────────────────────────────────── */
let coachPanelTab        = "planning";
let coachClubInput       = "";
let coachClubSearch      = "";
let coachTeamInput       = "";   // overrides currentProfile.team_name when set
let coachTabTeamValues   = { planning: "", objectives: "", match: "" };
let coachSelectedClubLoaded = false;
let coachFavoriteTeams   = [];
let coachFavoriteTeamsLoaded = false;
let coachTrainings       = [];
let coachTrainingsLoaded = false;
let coachTrainingsTeamKey = "";
let coachPlanningPillars = [];
let coachPlanningDate    = new Date().toISOString().slice(0, 10);
let coachPlanningDuration = 90;
let coachPlanningNotes   = "";

let coachPlayerObjs      = {};   // { player_name: { id, pillar_data, notes } }
let coachPlayerObjsTeam  = null; // team used when last loaded
let coachPlayerObjsClub  = null; // club used when last loaded
let coachPlayerObjsLoaded = false;
let coachEditingPlayer   = null; // name of player being edited in the form
let coachActaArchiveCache = null;
let coachActaArchivePromise = null;

let coachMatchState = {
  matchDate: new Date().toISOString().slice(0, 10),
  opponent:  "",
  isHome:    true,
  linkedMatchId: "",
  linkedMatchLabel: "",
  players:   [],   // [{name, isStarter, side:"D"|"E", pos:"DEF"|"MIG"|"DAV"|"PORT"}]
  events:    [],   // [{player, type, minute, ts}]
  savedId:   null,
};
let coachSelectedConvocatoriaMatchKey = "";
let coachMatchSubTab = "lineup";
let coachSelectedUpcomingMatchKey = "";
let coachSelectedPreviousMatchKey = "";
let coachTacticIdx   = COACH_DEFAULT_TACTIC_IDX;
let coachBoardState  = null;
let coachSavedPlays  = [];
let coachTacticsMsg  = "";
let coachPlaybackTimer = null;
let coachBoardDragState = null;
let coachBoardSuppressClickUntil = 0;
let coachBoardRemoteLoadedKey = "";
let coachBoardRemoteSaveTimer = null;
let coachBoardRemoteSaveNonce = 0;
let coachBoardFullscreenFormationsCollapsed = false;
let coachLiveFullscreen = false;
const coachRosterSelectionCache = new Map();
let coachFavoritePersistStatus = { type: "idle", text: "" };
let coachEditingSharedTrainingId = null; // UUID of shared_trainings row being enriched

/* ── Internal helpers ────────────────────────────────────────────────────── */
function _cesc(s) {
  return typeof esc === "function"
    ? esc(s)
    : String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function _csb()  { return typeof _sb !== "undefined" ? _sb : null; }
function _cuid() { return (typeof currentUser !== "undefined" ? currentUser?.id : null) || (typeof currentProfile !== "undefined" ? currentProfile?.id : null) || null; }
async function _cauthUid() {
  const sb = _csb();
  if (!sb) return null;
  try {
    const { data, error } = await sb.auth.getUser();
    if (error) return null;
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

async function _coachAuthUidForWrite() {
  const sb = _csb();
  if (!sb) return null;
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) return null;
    const uid = data?.session?.user?.id || null;
    if (!uid) return null;

    // If UI profile was loaded from remembered fallback and does not match
    // active Supabase session, block writes to prevent RLS violations.
    const profileId = String((typeof currentProfile !== "undefined" ? currentProfile?.id : "") || "").trim();
    if (profileId && profileId !== String(uid)) return null;

    return uid;
  } catch {
    return null;
  }
}
function _cclub(tabKey = coachPanelTab) {
  const resolved = _coachResolveTeamChoice(tabKey);
  return resolved?.clubName || coachClubInput || "";
}
function _cteam(tabKey = coachPanelTab) {
  const resolved = _coachResolveTeamChoice(tabKey);
  if (resolved?.teamName) return resolved.teamName;
  const fromTab = _coachTeamFromOptionValue(coachTabTeamValues?.[tabKey] || "");
  return fromTab || coachTeamInput || "";
}

function _ccategory(tabKey = coachPanelTab) {
  const resolved = _coachResolveTeamChoice(tabKey);
  if (resolved?.category) return resolved.category;
  return _coachCategoryFromOptionValue(coachTabTeamValues?.[tabKey] || "");
}

function _coachTeamEq(a, b) {
  if (typeof teamMatchesCalendarExact === "function") return teamMatchesCalendarExact(a, b);
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function _coachTeamLoose(a, b) {
  if (typeof teamMatchesLoose === "function") return teamMatchesLoose(a, b);
  const aa = String(a || "").trim().toLowerCase();
  const bb = String(b || "").trim().toLowerCase();
  return !!aa && !!bb && (aa.includes(bb) || bb.includes(aa));
}

function _coachSetFavoritePersistStatus(type = "idle", text = "") {
  coachFavoritePersistStatus = { type: String(type || "idle"), text: String(text || "") };
}

function _coachFavoriteTeamNameForDB(choice) {
  return buildFullTeamName(choice?.clubName || "", choice?.teamName || "", _coachSeasonKey());
}

function _coachTeamNameFromStoredFavorite(rec) {
  const raw = String(rec?.team_name || rec?.teamName || "").trim();
  const club = String(rec?.club_name || rec?.clubName || "").trim();
  const season = String(_coachSeasonKey() || "").trim();
  if (!raw) return "";
  let out = raw;
  if (club && out.startsWith(`${club} `)) out = out.slice(club.length + 1).trim();
  if (season && out.endsWith(` ${season}`)) out = out.slice(0, -(season.length + 1)).trim();
  return out;
}

async function _coachFavoriteExistsRemote(choice, writeUid = "") {
  const sb = _csb();
  const uid = writeUid || await _coachAuthUidForWrite();
  if (!sb || !uid || !choice) return true;
  const dbTeamName = _coachFavoriteTeamNameForDB(choice);
  try {
    const { data, error } = await sb
      .from("coach_favorite_teams")
      .select("id")
      .eq("user_id", uid)
      .eq("club_name", choice.clubName || "")
      .eq("team_name", dbTeamName)
      .eq("team_category", choice.category || "")
      .limit(1)
      .maybeSingle();
    if (!error && data?.id) return true;

    const { data: legacyData, error: legacyError } = await sb
      .from("coach_favorite_teams")
      .select("id")
      .eq("user_id", uid)
      .eq("club_name", choice.clubName || "")
      .eq("team_name", choice.teamName || "")
      .eq("team_category", choice.category || "")
      .limit(1)
      .maybeSingle();
    if (legacyError) return false;
    return Boolean(legacyData?.id);
  } catch {
    return false;
  }
}

function _coachSearchNorm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function _coachTeamKey(teamNameOrKey, category = "") {
  const raw = String(teamNameOrKey || "").trim();
  if (!raw) return `name:::cat:${normalizeCompKey(category || "altres")}`;
  if (raw.includes("::cat:")) return raw;
  const name = raw.toLowerCase().replace(/\s+/g, " ").trim();
  return `name:${name}::cat:${normalizeCompKey(category || "altres")}`;
}

function _coachOptionValue(teamName, category = "", clubName = "") {
  return `${_coachSeasonKey()}|||${String(clubName || "")}|||${_coachTeamKey(teamName, category)}`;
}

function _coachTeamFromOptionValue(value) {
  const parts = String(value || "").split("|||");
  const key = String(parts[2] || parts[0] || "").trim();
  if (!key) return "";
  if (key.startsWith("name:")) return key.slice(5).split("::cat:")[0].trim();
  if (key.startsWith("id:")) return key.slice(3).split("::cat:")[0].trim();
  if (key.includes("::cat:")) return key.split("::cat:")[0].replace(/^name:/, "").trim();
  return key;
}

function _coachCategoryFromOptionValue(value) {
  const parts = String(value || "").split("|||");
  if (parts.length >= 3 && String(parts[2] || "").includes("::cat:")) {
    const match = String(parts[2] || "").match(/::cat:([^:]+)$/);
    return match?.[1]?.trim() || "";
  }
  return String(parts[1] || "").trim() || "";
}

function _coachClubFromOptionValue(value) {
  const parts = String(value || "").split("|||");
  if (parts.length >= 3 && String(parts[2] || "").includes("::cat:")) return String(parts[1] || "").trim() || "";
  if (parts.length >= 3) return String(parts[2] || "").trim() || "";
  return String(parts[1] || "").trim() || "";
}

function _coachSeasonKey() {
  return String(typeof activeSeasonKey !== "undefined" ? activeSeasonKey || "current" : "current").trim() || "current";
}

function _coachSeasonFromOptionValue(value) {
  const parts = String(value || "").split("|||");
  if (parts.length >= 3 && String(parts[2] || "").includes("::cat:")) return String(parts[0] || "").trim() || "";
  return "";
}

function _coachTeamKeyFromOptionValue(value) {
  const parts = String(value || "").split("|||");
  if (parts.length >= 3 && String(parts[2] || "").includes("::cat:")) return String(parts[2] || "").trim() || "";
  return String(parts[0] || "").trim() || "";
}

function _coachSeasonLabel() {
  if (typeof getSeasonLabelFromData === "function") {
    const label = String(getSeasonLabelFromData(typeof DB !== "undefined" ? DB : null, "") || "").trim();
    if (label) return label.replace(/-/g, "/");
  }
  const raw = _coachSeasonKey();
  if (raw === "current") return "2025/26";
  return raw.replace(/^(\d{4})-(\d{2,4})$/, (_, y, end) => `${y}/${String(end || "").slice(-2)}`);
}

function _coachTeamIdentityLabel(choice = null) {
  const club = String(choice?.clubName || coachClubInput || "").trim();
  const teamName = String(choice?.teamName || "").trim();
  const seasonLabel = _coachSeasonLabel();
  return buildFullTeamName(club, teamName, seasonLabel);
}

function _coachLoadConvocatoriaStore() {
  try {
    return JSON.parse(localStorage.getItem(COACH_CONVOCATORIA_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function _coachBuildClubTeamOptions() {
  const map = new Map();
  const addPair = (clubName, teamName, category = "", uniqueKey = "") => {
    const club = String(clubName || "").trim();
    const team = String(teamName || "").trim();
    const cat = String(category || "").trim();
    const uniq = String(uniqueKey || "").trim();
    if (!club || !team) return;

    const clubKey = _coachSearchNorm(club);
    if (!clubKey) return;
    if (!map.has(clubKey)) {
      map.set(clubKey, { clubName: club, teams: new Map() });
    }
    const entry = map.get(clubKey);
    if (String(club).length > String(entry.clubName || "").length) {
      entry.clubName = club;
    }

    const teamKey = uniq || `${_coachSearchNorm(team)}::${_coachSearchNorm(cat)}`;
    if (!teamKey) return;
    const prev = entry.teams.get(teamKey);
    if (!prev) {
      entry.teams.set(teamKey, { teamName: team, category: cat, teamKey, seasonKey: _coachSeasonKey(), optionValue: _coachOptionValue(team, cat, club) });
      return;
    }
    if (!prev.category && cat) prev.category = cat;
  };

  if (typeof buildClubMap === "function") {
    try {
      const clubMap = buildClubMap();
      for (const [, club] of clubMap.entries()) {
        for (const t of (club?.teams || [])) {
          addPair(club?.displayName || "", t?.teamName || "", t?.category || "", t?.teamKey || "");
        }
      }
    } catch {
      // Fallback to convocatoria cache when global DB map is not ready yet.
    }
  }

  if (!map.size) {
    console.warn("[coach-panel] No clubs found from buildClubMap, relying on convocatoria cache");
  }
  const convStore = _coachLoadConvocatoriaStore();
  for (const key of Object.keys(convStore || {})) {
    const parts = String(key || "").split("::");
    if (parts.length >= 2) addPair(parts[0], parts[1]);
  }

  return [...map.values()]
    .map(entry => ({
      clubName: entry.clubName,
      teams: [...entry.teams.values()].sort((a, b) => String(a?.teamName || "").localeCompare(String(b?.teamName || ""))),
    }))
    .sort((a, b) => String(a.clubName).localeCompare(String(b.clubName)));
}

function _coachFlattenTeamChoices(options = null) {
  const source = Array.isArray(options) ? options : _coachBuildClubTeamOptions();
  const out = [];
  for (const club of source) {
    for (const team of (club?.teams || [])) {
      const teamName = String(team?.teamName || "").trim();
      if (!teamName) continue;
      const category = String(team?.category || "").trim();
      const clubName = String(club?.clubName || "").trim();
      const optionValue = String(team?.optionValue || _coachOptionValue(teamName, category, clubName));
      out.push({ clubName, teamName, category, teamKey: String(team?.teamKey || "").trim(), seasonKey: String(team?.seasonKey || _coachSeasonKey()).trim(), optionValue });
    }
  }
  return out;
}

function _coachResolveTeamChoiceByValue(optionValue, options = null) {
  const flat = _coachFlattenTeamChoices(options);
  const wanted = String(optionValue || "");
  const found = flat.find(x => String(x.optionValue) === wanted);
  if (found) return found;

  const season = _coachSeasonFromOptionValue(wanted);
  const club = _coachClubFromOptionValue(wanted);
  const teamKey = _coachTeamKeyFromOptionValue(wanted);
  const team = _coachTeamFromOptionValue(wanted);
  const category = _coachCategoryFromOptionValue(wanted);
  const byTeam = flat.find(x => String(x.seasonKey || "") === season && String(x.teamKey || "") === teamKey && String(x.clubName || "") === club)
    || flat.find(x => String(x.seasonKey || "") === season && String(x.teamKey || "") === teamKey)
    || flat.find(x => _coachTeamEq(x.teamName, team) && String(x.category || "") === category && String(x.clubName || "") === club)
    || (!club ? flat.find(x => _coachTeamEq(x.teamName, team) && String(x.category || "") === category) : null)
    || (!club && !category ? flat.find(x => _coachTeamEq(x.teamName, team)) : null);
  if (byTeam) return byTeam;
  if (!team) return null;
  return { teamName: team, category, clubName: club, teamKey, seasonKey: season || _coachSeasonKey(), optionValue: _coachOptionValue(teamKey || team, category, club) };
}

function _coachResolveTeamChoice(tabKey = coachPanelTab, options = null) {
  const value = String(coachTabTeamValues?.[tabKey] || "").trim();
  if (value) {
    const fromValue = _coachResolveTeamChoiceByValue(value, options);
    if (fromValue) return fromValue;
  }

  const globalTeam = String(coachTeamInput || "").trim();
  if (globalTeam) {
    const flat = _coachFlattenTeamChoices(options);
    const byGlobal = flat.find(x => _coachTeamEq(x.teamName, globalTeam));
    if (byGlobal) return byGlobal;
  }

  return null;
}

function _coachFavoriteStorageKey(uid = "") {
  return `${COACH_FAVORITE_TEAMS_KEY}::${String(uid || "anon")}`;
}

function _coachFavoriteStorageLegacyKey() {
  return COACH_FAVORITE_TEAMS_KEY;
}

function _coachSelectedClubStorageKey(uid = "") {
  return `${COACH_SELECTED_CLUB_KEY}::${String(uid || "anon")}`;
}

function _coachLoadFavoritesLocal(uid = "") {
  try {
    const scopedRaw = localStorage.getItem(_coachFavoriteStorageKey(uid));
    const legacyRaw = localStorage.getItem(_coachFavoriteStorageLegacyKey());
    const raw = scopedRaw || legacyRaw;
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function _coachSaveFavoritesLocal(uid = "", favorites = []) {
  try {
    const serialized = JSON.stringify(favorites || []);
    localStorage.setItem(_coachFavoriteStorageKey(uid), serialized);
    localStorage.setItem(_coachFavoriteStorageLegacyKey(), serialized);
  } catch {}
}

function _coachLoadSelectedClubLocal(uid = "") {
  try {
    const raw = localStorage.getItem(_coachSelectedClubStorageKey(uid));
    const parsed = JSON.parse(raw || "null");
    if (typeof parsed === "string") return parsed.trim();
    return String(parsed?.clubName || "").trim();
  } catch {
    return "";
  }
}

function _coachSaveSelectedClubLocal(uid = "", clubName = "") {
  try {
    const key = _coachSelectedClubStorageKey(uid);
    const normalizedClub = String(clubName || "").trim();
    if (!normalizedClub) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify({
      clubName: normalizedClub,
      updatedAt: new Date().toISOString(),
    }));
  } catch {}
}

async function _coachLoadSelectedClub(options = null) {
  if (coachSelectedClubLoaded) return;

  const sb = _csb();
  const uid = await _cauthUid();
  let clubName = "";

  if (sb && uid) {
    try {
      const { data, error } = await sb
        .from("coach_selected_clubs")
        .select("club_name")
        .eq("user_id", uid)
        .maybeSingle();
      if (!error && data?.club_name) clubName = String(data.club_name || "").trim();
    } catch {}
  }

  if (!clubName) clubName = _coachLoadSelectedClubLocal(uid);

  if (clubName) {
    const source = Array.isArray(options) ? options : _coachBuildClubTeamOptions();
    const match = source.find(o => _coachSearchNorm(o.clubName) === _coachSearchNorm(clubName)) || null;
    coachClubInput = match?.clubName || clubName;
    if (!coachClubSearch) coachClubSearch = coachClubInput;
  }

  coachSelectedClubLoaded = true;
}

async function _coachPersistSelectedClub(clubName) {
  const normalizedClub = String(clubName || "").trim();
  const sb = _csb();
  const writeUid = await _coachAuthUidForWrite();
  const readUid = writeUid || await _cauthUid();

  _coachSaveSelectedClubLocal(readUid || "", normalizedClub);

  if (!sb || !writeUid) return;

  try {
    if (!normalizedClub) {
      await sb.from("coach_selected_clubs").delete().eq("user_id", writeUid);
      return;
    }

    await sb.from("coach_selected_clubs").upsert({
      user_id: writeUid,
      club_name: normalizedClub,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  } catch {}
}

function _coachIsFavorite(optionValue) {
  return coachFavoriteTeams.some(x => String(x.optionValue) === String(optionValue));
}

function _coachFavoriteIcon(optionValue) {
  return _coachIsFavorite(optionValue) ? "★" : "☆";
}

function _coachFavoriteForClub(clubName = "") {
  const wantedClub = _coachSearchNorm(clubName);
  if (!wantedClub) return null;
  return coachFavoriteTeams.find(item => _coachSearchNorm(item?.clubName || "") === wantedClub) || null;
}

async function _coachLoadFavoriteTeams(options = null) {
  if (coachFavoriteTeamsLoaded) return;

  const sb = _csb();
  const uid = await _cauthUid();
  const mapChoice = rec => {
    const team = _coachTeamNameFromStoredFavorite(rec);
    const category = String(rec?.team_category || rec?.category || "").trim();
    const club = String(rec?.club_name || rec?.clubName || "").trim();
    return _coachResolveTeamChoiceByValue(_coachOptionValue(team, category, club), options);
  };

  let loaded = [];
  if (sb && uid) {
    try {
      const { data, error } = await sb
        .from("coach_favorite_teams")
        .select("club_name, team_name, team_category, saved_at, updated_at")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false });
      if (!error && Array.isArray(data)) loaded = data.map(mapChoice).filter(Boolean);
    } catch {}
  }

  if (!loaded.length) {
    loaded = _coachLoadFavoritesLocal(uid).map(mapChoice).filter(Boolean);
  }

  // Allow multiple favorites (no dedup by club)
  const seen = new Set();
  coachFavoriteTeams = loaded.filter(item => {
    const key = String(item?.optionValue || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, COACH_MAX_FAVORITES);
  coachFavoriteTeamsLoaded = true;
}

async function _coachToggleFavoriteTeam(optionValue) {
  const choice = _coachResolveTeamChoiceByValue(optionValue);
  if (!choice) return;

  const sb = _csb();
  const writeUid = await _coachAuthUidForWrite();
  const readUid = writeUid || await _cauthUid();
  const isFav = _coachIsFavorite(choice.optionValue);

  if (isFav) {
    coachFavoriteTeams = coachFavoriteTeams.filter(x => String(x.optionValue) !== String(choice.optionValue));
    if (sb && writeUid) {
      try {
        const dbTeamName = _coachFavoriteTeamNameForDB(choice);
        await sb.from("coach_favorite_teams")
          .delete()
          .eq("user_id", writeUid)
          .eq("club_name", choice.clubName || "")
          .in("team_name", [dbTeamName, choice.teamName || ""])
          .eq("team_category", choice.category || "");
      } catch (err) {
        console.warn("[coach] favorite delete failed", err);
        _coachSetFavoritePersistStatus("error", "No s'ha pogut treure el favorit de la BD.");
      }
    }
    _coachSetFavoritePersistStatus("ok", "Favorit eliminat.");
  } else {
    if (coachFavoriteTeams.length >= COACH_MAX_FAVORITES) {
      _coachSetFavoritePersistStatus("warn", `Maxim ${COACH_MAX_FAVORITES} favorits. Treu-ne un abans d'afegir-ne un altre.`);
      return;
    }
    // Add without removing other favorites of the same club
    coachFavoriteTeams = coachFavoriteTeams.filter(x => String(x?.optionValue || "") !== String(choice.optionValue));
    coachFavoriteTeams.push(choice);
    if (sb && writeUid) {
      try {
        await sb.from("coach_favorite_teams").upsert({
          user_id: writeUid,
          club_name: choice.clubName || "",
          team_name: buildFullTeamName(choice.clubName || "", choice.teamName || "", _coachSeasonKey()),
          team_category: choice.category || "",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,club_name,team_name,team_category" });
      } catch (err) {
        console.warn("[coach] favorite upsert failed", err);
        _coachSetFavoritePersistStatus("error", "No s'ha pogut desar el favorit a la BD.");
      }
      const exists = await _coachFavoriteExistsRemote(choice, writeUid);
      _coachSetFavoritePersistStatus(exists ? "ok" : "error", exists
        ? "Favorit ★ desat i verificat a la BD."
        : "No s'ha pogut verificar el favorit a la BD.");
    } else {
      _coachSetFavoritePersistStatus("warn", "Favorit desat en local (sessio BD no activa).");
    }
  }

  _coachSaveFavoritesLocal(readUid || "", coachFavoriteTeams);
}

async function _coachEnsureFavoriteTeam(optionValue) {
  const choice = _coachResolveTeamChoiceByValue(optionValue);
  if (!choice?.optionValue) return;
  if (_coachIsFavorite(choice.optionValue)) return;
  if (coachFavoriteTeams.length >= COACH_MAX_FAVORITES) return;

  const sb = _csb();
  const writeUid = await _coachAuthUidForWrite();
  const readUid = writeUid || await _cauthUid();

  coachFavoriteTeams = coachFavoriteTeams.filter(x => String(x?.optionValue || "") !== String(choice.optionValue));
  coachFavoriteTeams.push(choice);

  if (sb && writeUid) {
    try {
      await sb.from("coach_favorite_teams").upsert({
        user_id: writeUid,
        club_name: choice.clubName || "",
        team_name: buildFullTeamName(choice.clubName || "", choice.teamName || "", _coachSeasonKey()),
        team_category: choice.category || "",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,club_name,team_name,team_category" });
    } catch (err) {
      console.warn("[coach] favorite upsert failed", err);
      _coachSetFavoritePersistStatus("error", "No s'ha pogut desar automàticament el favorit.");
    }
    const exists = await _coachFavoriteExistsRemote(choice, writeUid);
    _coachSetFavoritePersistStatus(exists ? "ok" : "error", exists
      ? "Equip favorit desat i verificat a la BD."
      : "No s'ha pogut verificar el favorit a la BD.");
  } else {
    _coachSetFavoritePersistStatus("warn", "Equip favorit desat en local (sessio BD no activa).");
  }

  _coachSaveFavoritesLocal(readUid || "", coachFavoriteTeams);
}

function _coachApplyTabTeamValue(tabKey, optionValue) {
  coachTabTeamValues[tabKey] = String(optionValue || "").trim();

  if (tabKey === "planning") {
    coachTrainingsLoaded = false;
    coachEditingSharedTrainingId = null;
    return;
  }
  if (tabKey === "objectives") {
    coachPlayerObjsLoaded = false;
    coachEditingPlayer = null;
    return;
  }
  if (tabKey === "match") {
    coachBoardRemoteLoadedKey = "";
    coachSelectedConvocatoriaMatchKey = "";
    const club = _cclub("match");
    const team = _cteam("match");
    const category = _ccategory("match");
    coachMatchState.players = _coachRosterFromConvocatoria(club, team, category);
    coachMatchState.events = [];
    coachMatchState.savedId = null;
    coachMatchState.opponent = "";
    coachMatchState.linkedMatchId = "";
    coachMatchState.linkedMatchLabel = "";
  }
}

function _coachApplyTeamSelectionAllTabs(optionValue) {
  const normalized = String(optionValue || "").trim();
  for (const tab of ["planning", "objectives", "match"]) {
    coachTabTeamValues[tab] = normalized;
  }
  coachTeamInput = _coachTeamFromOptionValue(normalized);
  coachTrainingsLoaded = false;
  coachPlayerObjsLoaded = false;
  coachEditingPlayer = null;
  const club = _coachClubFromOptionValue(normalized);
  if (club) {
    coachClubInput = club;
    coachClubSearch = club;
  }
  const matchClub = _cclub("match");
  const matchTeam = _cteam("match");
  const matchCategory = _ccategory("match");
  coachBoardRemoteLoadedKey = "";
  coachSelectedConvocatoriaMatchKey = "";
  coachMatchState.players = _coachRosterFromConvocatoria(matchClub, matchTeam, matchCategory);
  coachMatchState.events = [];
  coachMatchState.savedId = null;
  coachMatchState.opponent = "";
  coachMatchState.linkedMatchId = "";
  coachMatchState.linkedMatchLabel = "";
}

function _coachShouldRenderInteractivePuck() {
  return coachBoardState?.ballMode !== "attached";
}

function _coachMovePlayerForCarry(action, destination) {
  if (action?.startKind !== "player" || !action?.startId) return false;
  return _coachUpdateBoardEntityPosition("player", action.startId, destination);
}

function _coachMovePlayerForScreen(action, blockedPlayerId) {
  if (action?.startKind !== "player" || !action?.startId) return false;
  const blockedPlayer = _coachBoardPlayerById(blockedPlayerId);
  if (!blockedPlayer) return false;
  
  // Calculate a position beside the blocked player (not on top)
  // Distance: 3 units horizontally, based on their relative position
  const dx = blockedPlayer.x - action.start.x;
  const distFactor = Math.abs(dx) > 0.1 ? Math.sign(dx) : 1;
  const newX = blockedPlayer.x - (distFactor * 3); // Position beside, not on top
  const newY = blockedPlayer.y;
  
  return _coachUpdateBoardEntityPosition("player", action.startId, { x: newX, y: newY });
}

function _coachTabTeamHeader(tabKey, options = null) {
  const source = Array.isArray(options) ? options : _coachBuildClubTeamOptions();
  if (!source.length) return "";

  const current = _coachResolveTeamChoice(tabKey, source);
  if (!current?.teamName) return "";

  const currentValue = String(current.optionValue || "");
  const fav = _coachIsFavorite(currentValue);
  const catLabel = current.category
    ? ((typeof CAT_LABELS !== "undefined" && CAT_LABELS[current.category]) ? CAT_LABELS[current.category] : current.category)
    : "";
  const teamLabel = typeof shortTeamDisplayName === "function" ? shortTeamDisplayName(current.teamName || "") : (current.teamName || "");
  const label = catLabel ? `${teamLabel} · ${catLabel}` : teamLabel;

  // Show ALL favorites, always at fixed positions. The active one is highlighted differently.
  const allChips = coachFavoriteTeams.map(item => {
    const isActive = String(item?.optionValue || "") === currentValue;
    const itemCat = item.category
      ? ((typeof CAT_LABELS !== "undefined" && CAT_LABELS[item.category]) ? CAT_LABELS[item.category] : item.category)
      : "";
    const itemTeam = typeof shortTeamDisplayName === "function" ? shortTeamDisplayName(item.teamName || "") : (item.teamName || "");
    const itemLabel = itemCat ? `${itemTeam} · ${itemCat}` : itemTeam;
    if (isActive) {
      return `<div style="background:#1a2035;border:1.5px solid #1a2035;color:#fff;font-weight:700;font-size:12px;padding:8px 12px;border-radius:999px;display:inline-flex;align-items:center;gap:7px">
        <span>${_cesc(itemLabel)}</span>
        <span onclick="coachToggleFavoriteTeamChip('${_cesc(item.optionValue)}')" title="${fav ? "Treure favorit" : "Afegir favorit"}" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:${fav ? "rgba(245,158,11,.25)" : "rgba(255,255,255,.2)"};color:${fav ? "#f59e0b" : "#fff"};font-size:13px;font-weight:800;line-height:1;cursor:pointer">${_coachFavoriteIcon(item.optionValue)}</span>
      </div>`;
    }
    return `<button onclick="coachSelectTabTeam('${_cesc(tabKey)}','${_cesc(item.optionValue)}')" style="background:#fff;border:1.5px solid #dbe3f0;color:#334155;font-weight:700;font-size:12px;padding:8px 12px;border-radius:999px;cursor:pointer">${_cesc(itemLabel)}</button>`;
  }).join("");

  // If current team is not in favorites, add its chip at the start too
  const currentInFavs = coachFavoriteTeams.some(item => String(item?.optionValue || "") === currentValue);
  const currentChip = currentInFavs ? "" : `<div style="background:#1a2035;border:1.5px solid #1a2035;color:#fff;font-weight:700;font-size:12px;padding:8px 12px;border-radius:999px;display:inline-flex;align-items:center;gap:7px">
      <span>${_cesc(label)}</span>
      <span onclick="coachToggleFavoriteTeamChip('${_cesc(currentValue)}')" title="Afegir favorit" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:rgba(255,255,255,.2);color:#fff;font-size:13px;font-weight:800;line-height:1;cursor:pointer">☆</span>
    </div>`;

  return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
    ${currentChip}${allChips}
  </div>`;
}

function _coachEnsureTeamSelection(options = null) {
  const sourceOptions = Array.isArray(options) ? options : _coachBuildClubTeamOptions();

  if (!sourceOptions.length) {
    return sourceOptions;
  }

  let selectedClub = sourceOptions.find(o => String(o.clubName) === String(coachClubInput || "")) || null;
  let selectedTeam = String(coachTeamInput || "").trim();

  if (!selectedClub && selectedTeam) {
    selectedClub = sourceOptions.find(o => (o.teams || []).some(t => _coachTeamEq(t?.teamName || "", selectedTeam) || _coachTeamLoose(t?.teamName || "", selectedTeam))) || null;
  }

  if (!selectedClub) selectedClub = sourceOptions[0] || null;
  if (!selectedClub) return sourceOptions;

  if (!selectedTeam) {
    const favoriteValue = String(coachFavoriteTeams?.[0]?.optionValue || "").trim();
    if (favoriteValue) {
      const favChoice = _coachResolveTeamChoiceByValue(favoriteValue, sourceOptions);
      if (favChoice?.teamName) {
        selectedClub = sourceOptions.find(o => String(o.clubName) === String(favChoice.clubName || "")) || selectedClub;
        selectedTeam = String(favChoice.teamName || "").trim();
        const selectedValue = String(favChoice.optionValue || "");
        for (const tab of ["planning", "objectives", "match"]) {
          coachTabTeamValues[tab] = selectedValue;
        }
      }
    }
  }

  const hasTeamInClub = selectedTeam
    ? (selectedClub.teams || []).some(t => _coachTeamEq(t?.teamName || "", selectedTeam))
    : false;
  if (selectedTeam && !hasTeamInClub) selectedTeam = "";

  if (!selectedTeam) {
    const firstTeam = (selectedClub.teams || [])[0] || null;
    if (firstTeam?.teamName) {
      selectedTeam = String(firstTeam.teamName || "").trim();
      const selectedValue = String(firstTeam.optionValue || _coachOptionValue(selectedTeam, firstTeam?.category || "", selectedClub.clubName));
      for (const tab of ["planning", "objectives", "match"]) {
        if (!String(coachTabTeamValues?.[tab] || "").trim()) coachTabTeamValues[tab] = selectedValue;
      }
    }
  }

  coachClubInput = selectedClub.clubName;
  coachTeamInput = selectedTeam;

  if (selectedTeam) {
    const selectedMeta = (selectedClub.teams || []).find(t => _coachTeamEq(t?.teamName || "", selectedTeam)) || null;
    const selectedValue = String(selectedMeta?.optionValue || _coachOptionValue(selectedTeam, selectedMeta?.category || "", selectedClub.clubName));
    for (const tab of ["planning", "objectives", "match"]) {
      if (!String(coachTabTeamValues?.[tab] || "").trim()) {
        coachTabTeamValues[tab] = selectedValue;
      }
    }
  }
  return sourceOptions;
}

function _coachCategoryTokenSet(category = "") {
  const out = new Set();
  const raw = String(category || "").trim();
  if (!raw) return out;

  const normRaw = _coachSearchNorm(raw);
  if (normRaw) out.add(normRaw);

  try {
    const key = String(typeof normalizeCompKey === "function" ? normalizeCompKey(raw) : raw).trim();
    const normKey = _coachSearchNorm(key);
    if (normKey) out.add(normKey);
    const label = String((typeof CAT_LABELS !== "undefined" && CAT_LABELS[key]) ? CAT_LABELS[key] : "").trim();
    const normLabel = _coachSearchNorm(label);
    if (normLabel) out.add(normLabel);
  } catch {}

  return out;
}

function _coachCategoryMatchesAny(text, wantedCategory = "") {
  const wanted = _coachCategoryTokenSet(wantedCategory);
  if (!wanted.size) return true;
  const source = _coachSearchNorm(text || "");
  if (!source) return false;
  const escapeRe = value => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const token of wanted) {
    if (!token) continue;
    const tokenPattern = token
      .split(/\s+/)
      .filter(Boolean)
      .map(escapeRe)
      .join("\\s+");
    if (!tokenPattern) continue;
    const boundary = new RegExp(`(^|[^a-z0-9])${tokenPattern}($|[^a-z0-9])`, "i");
    if (boundary.test(source)) return true;
  }
  return false;
}

function _coachConvocatoriaMatchesCategory(convocatoria, wantedCategory = "") {
  const wanted = _coachCategoryTokenSet(wantedCategory);
  if (!wanted.size) return true;

  const comp = String(convocatoria?.matchCompetition || convocatoria?.compName || convocatoria?.category || "").trim();
  if (!comp) return false;
  return _coachCategoryMatchesAny(comp, wantedCategory);
}

function _coachConvocatoriaTimestamp(convocatoria) {
  const date = String(convocatoria?.matchDate || "").trim();
  const time = String(convocatoria?.matchTime || "").trim();
  const matchTs = date
    ? Date.parse(`${date}${time ? `T${time}` : "T00:00:00"}`)
    : NaN;
  if (Number.isFinite(matchTs) && matchTs > 0) return matchTs;
  return Date.parse(convocatoria?.createdAt || convocatoria?.updatedAt || "") || 0;
}

function _coachConvocatoriaMatchIdentity(convocatoria) {
  const explicit = String(convocatoria?.matchKey || "").trim();
  if (explicit) return explicit;
  return [
    convocatoria?.matchCompetition || "",
    convocatoria?.matchDate || "",
    convocatoria?.matchTime || "",
    convocatoria?.matchHome || "",
    convocatoria?.matchAway || "",
  ].map(v => encodeURIComponent(String(v || ""))).join("::");
}

function _coachConvocatoriaOptionLabel(convocatoria) {
  const date = String(convocatoria?.matchDate || "").trim() || "Data pendent";
  const time = String(convocatoria?.matchTime || "").trim();
  const home = String(convocatoria?.matchHome || "").trim();
  const away = String(convocatoria?.matchAway || "").trim();
  const comp = String(convocatoria?.matchCompetition || "").trim();
  const teams = home || away ? `${home || "Equip"} vs ${away || "Rival"}` : "Partit";
  return `${date}${time ? ` · ${time}` : ""} · ${teams}${comp ? ` · ${comp}` : ""}`;
}

function _coachUpcomingMatchIdentity(match) {
  if (!match) return "";
  const key = String(match?.key || "").trim();
  if (key) return key;
  return [
    String(match?.compId || ""),
    String(match?.dateKey || ""),
    String(match?.time || ""),
    String(match?.home || ""),
    String(match?.away || ""),
  ].map(v => encodeURIComponent(v)).join("::");
}

function _coachUpcomingMatchLabel(match) {
  if (!match) return "Partit";
  const date = String(match?.date || "").trim() || "Data pendent";
  const time = String(match?.time || "").trim();
  const home = String(match?.home || "").trim();
  const away = String(match?.away || "").trim();
  const comp = String(match?.compName || "").trim();
  const teams = home || away ? `${home || "Equip"} vs ${away || "Rival"}` : "Partit";
  return `${date}${time ? ` · ${time}` : ""} · ${teams}${comp ? ` · ${comp}` : ""}`;
}

function _coachGetUpcomingMatches(clubName, teamName, category = "") {
  if (typeof getUpcomingMatchesForConvocatoria === "function") {
    const list = getUpcomingMatchesForConvocatoria(clubName, teamName, category);
    return Array.isArray(list) ? list : [];
  }
  return [];
}

function _coachGetPreviousMatches(clubName, teamName, category = "") {
  if (typeof getPreviousPlayedMatchesForTeam === "function") {
    const list = getPreviousPlayedMatchesForTeam(clubName, teamName, Number.POSITIVE_INFINITY, category);
    return Array.isArray(list) ? list : [];
  }
  return [];
}

function _coachApplyUpcomingMatch(match) {
  if (!match) return;
  const team = _cteam();
  coachMatchState.matchDate = String(match?.date || coachMatchState.matchDate || "").trim() || coachMatchState.matchDate;
  const isHome = _coachTeamEq(match?.home || "", team) || _coachTeamLoose(match?.home || "", team);
  coachMatchState.isHome = isHome;
  coachMatchState.opponent = String(isHome ? (match?.away || "") : (match?.home || "")).trim();

  const club = _cclub();
  const category = _ccategory();
  const identity = _coachUpcomingMatchIdentity(match);
  if (identity) {
    coachSelectedUpcomingMatchKey = identity;
    coachSelectedPreviousMatchKey = "";
    const conv = _coachFindConvocatoriaForMatch(club, team, category, match);
    if (conv) coachSelectedConvocatoriaMatchKey = _coachConvocatoriaMatchIdentity(conv);
  }
  _coachSyncLinkedMatchFromState();
}

function _coachApplyPreviousMatch(match) {
  if (!match) return;
  const team = _cteam();
  coachMatchState.matchDate = String(match?.date || coachMatchState.matchDate || "").trim() || coachMatchState.matchDate;
  const isHome = _coachTeamEq(match?.home || "", team) || _coachTeamLoose(match?.home || "", team);
  coachMatchState.isHome = isHome;
  coachMatchState.opponent = String(isHome ? (match?.away || "") : (match?.home || "")).trim();

  const club = _cclub();
  const category = _ccategory();
  const identity = _coachUpcomingMatchIdentity(match);
  if (identity) {
    coachSelectedPreviousMatchKey = identity;
    coachSelectedUpcomingMatchKey = "";
    const conv = _coachFindConvocatoriaForMatch(club, team, category, match);
    if (conv) coachSelectedConvocatoriaMatchKey = _coachConvocatoriaMatchIdentity(conv);
  }
  _coachSyncLinkedMatchFromState();
}

function _coachListTeamConvocatories(clubName, teamName, category = "") {
  const store = _coachLoadConvocatoriaStore();
  const wantedClub = String(clubName || "").trim();
  const wantedTeam = String(teamName || "").trim();
  const wantedCategory = String(category || "").trim();
  if (!wantedTeam) return [];

  const candidates = new Map();
  for (const [key, convocatoria] of Object.entries(store || {})) {
    const parts = String(key || "").split("::");
    if (parts.length < 2) continue;
    const keyClub = String(parts[0] || "").trim();
    const keyTeam = String(parts[1] || "").trim();

    const teamMatches = _coachTeamEq(keyTeam, wantedTeam) || _coachTeamLoose(keyTeam, wantedTeam);
    if (!teamMatches) continue;
    if (!_coachConvocatoriaMatchesCategory(convocatoria, wantedCategory)) continue;

    const clubMatches = !wantedClub
      || _coachTeamEq(keyClub, wantedClub)
      || _coachTeamLoose(keyClub, wantedClub)
      || _coachSearchNorm(keyClub) === _coachSearchNorm(wantedClub);
    const ts = _coachConvocatoriaTimestamp(convocatoria);
    const id = _coachConvocatoriaMatchIdentity(convocatoria) || `${key}::${ts}`;

    const prev = candidates.get(id);
    if (!prev) {
      candidates.set(id, { convocatoria, ts, clubMatches });
      continue;
    }
    const betterClub = clubMatches && !prev.clubMatches;
    const newer = ts > prev.ts;
    if (betterClub || (clubMatches === prev.clubMatches && newer)) {
      candidates.set(id, { convocatoria, ts, clubMatches });
    }
  }

  return [...candidates.values()]
    .sort((a, b) => {
      if (a.clubMatches !== b.clubMatches) return a.clubMatches ? -1 : 1;
      return b.ts - a.ts;
    })
    .map(item => item.convocatoria);
}

function _coachFindConvocatoriaByMatchKey(clubName, teamName, category = "", matchKey = "") {
  const wanted = String(matchKey || "").trim();
  if (!wanted) return null;
  return _coachListTeamConvocatories(clubName, teamName, category)
    .find(convocatoria => _coachConvocatoriaMatchIdentity(convocatoria) === wanted) || null;
}

function _coachFindLatestConvocatoria(clubName, teamName, category = "") {
  return _coachListTeamConvocatories(clubName, teamName, category)[0] || null;
}

function _coachMatchTeamsEquivalent(homeA, awayA, homeB, awayB) {
  const aHome = String(homeA || "").trim();
  const aAway = String(awayA || "").trim();
  const bHome = String(homeB || "").trim();
  const bAway = String(awayB || "").trim();
  if (!aHome || !aAway || !bHome || !bAway) return false;
  const sameOrder = _coachTeamEq(aHome, bHome) && _coachTeamEq(aAway, bAway);
  const swappedOrder = _coachTeamEq(aHome, bAway) && _coachTeamEq(aAway, bHome);
  return sameOrder || swappedOrder;
}

function _coachFindConvocatoriaForMatch(clubName, teamName, category = "", match = null) {
  if (!match) return null;

  const wantedIdentity = _coachUpcomingMatchIdentity(match);
  if (wantedIdentity) {
    const byIdentity = _coachFindConvocatoriaByMatchKey(clubName, teamName, category, wantedIdentity);
    if (byIdentity) return byIdentity;
  }

  const matchDate = String(match?.date || "").trim();
  const home = String(match?.home || "").trim();
  const away = String(match?.away || "").trim();
  if (!matchDate || !home || !away) return null;

  return _coachListTeamConvocatories(clubName, teamName, category)
    .find(conv => {
      const convDate = String(conv?.matchDate || "").trim();
      if (convDate !== matchDate) return false;
      return _coachMatchTeamsEquivalent(conv?.matchHome, conv?.matchAway, home, away);
    }) || null;
}

function _coachRosterFromConvocatoria(clubName, teamName, category = "", matchKey = "") {
  const wantedKey = String(matchKey || "").trim();
  const convocatoria = wantedKey
    ? _coachFindConvocatoriaByMatchKey(clubName, teamName, category, wantedKey)
    : _coachFindLatestConvocatoria(clubName, teamName, category);
  if (!convocatoria || !Array.isArray(convocatoria.players)) return [];
  const included = convocatoria.players.filter(p => p?.checked !== false && p?.status !== "baixa");
  const source = included.length ? included : convocatoria.players;
  return source
    .map(p => ({
      name: String(p?.name || "").trim(),
      number: String(p?.number ?? p?.dorsal ?? "").trim(),
      pos: /porter|gk/i.test(String(p?.position || "")) ? "PORT" : "MIG",
      isStarter: p?.checked !== false,
      side: "D",
      squad: "favorite",
    }))
    .filter(p => p.name)
    .filter((p, idx, arr) => arr.findIndex(x => teamMatchesCalendarExact(x.name, p.name)) === idx);
}

function _coachPlayerClubCandidates(player) {
  const values = [
    player?.clubName,
    player?.club,
    player?.club_name,
    player?.registeredClub,
    player?.teamClub,
  ];

  for (const stat of (player?.teamStats || [])) {
    values.push(stat?.clubName, stat?.club, stat?.club_name, stat?.teamClub);
  }

  return [...new Set(values.map(v => String(v || "").trim()).filter(Boolean))];
}

function _coachMergeRosterPlayers(...lists) {
  const deduped = [];
  for (const list of lists) {
    for (const player of (list || [])) {
      const name = String(player?.name || "").trim();
      if (!name) continue;
      const exists = deduped.some(x => teamMatchesCalendarExact(x.name, name));
      if (exists) continue;
      deduped.push({
        name,
        number: String(player?.number || "").trim(),
        pos: player?.pos || "MIG",
        isStarter: player?.isStarter !== false,
        side: player?.side || "D",
        squad: player?.squad || "favorite",
      });
    }
  }

  return deduped.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

async function _coachLoadActaArchive() {
  if (Array.isArray(coachActaArchiveCache)) return coachActaArchiveCache;
  if (coachActaArchivePromise) return coachActaArchivePromise;

  coachActaArchivePromise = Promise.all(
    COACH_ACTA_ARCHIVE_FILES.map(async file => {
      try {
        const res = await fetch(file, { cache: "no-store" });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : Object.values(data || {});
      } catch {
        return [];
      }
    })
  ).then(chunks => {
    coachActaArchiveCache = chunks.flat().filter(Boolean);
    coachActaArchivePromise = null;
    return coachActaArchiveCache;
  }).catch(() => {
    coachActaArchiveCache = [];
    coachActaArchivePromise = null;
    return coachActaArchiveCache;
  });

  return coachActaArchivePromise;
}

async function _coachRosterFromActaArchive(clubName, teamName, category = "") {
  const wantedTeam = String(teamName || "").trim();
  const wantedClub = String(clubName || "").trim();
  const wantedCategory = String(category || "").trim();
  const wantedCategoryLabel = wantedCategory
    ? String((typeof CAT_LABELS !== "undefined" && CAT_LABELS[wantedCategory]) ? CAT_LABELS[wantedCategory] : wantedCategory).trim()
    : "";
  if (!wantedTeam) return [];

  const archive = await _coachLoadActaArchive();
  const roster = [];

  for (const acta of (archive || [])) {
    const home = String(acta?.home || "").trim();
    const away = String(acta?.away || "").trim();
    const title = String(acta?.title || "").trim();
    const homeMatches = _coachTeamEq(home, wantedTeam);
    const awayMatches = _coachTeamEq(away, wantedTeam);
    if (!homeMatches && !awayMatches) continue;

    const clubMatches = !wantedClub
      || _coachTeamLoose(title, wantedClub)
      || _coachTeamLoose(home, wantedClub)
      || _coachTeamLoose(away, wantedClub)
      || _coachSearchNorm(title).includes(_coachSearchNorm(wantedClub));
    if (!clubMatches) continue;

    const compText = `${String(acta?.compName || "")} ${String(acta?.actaMeta?.compName || "")}`.trim();
    const categoryMatches = !wantedCategory
      || _coachSearchNorm(compText).includes(_coachSearchNorm(wantedCategory))
      || _coachSearchNorm(compText).includes(_coachSearchNorm(wantedCategoryLabel));
    if (!categoryMatches) continue;

    const sidePlayers = homeMatches
      ? (acta?.playerStats?.homePlayers || [])
      : (acta?.playerStats?.awayPlayers || []);

    for (const player of sidePlayers) {
      const name = String(player?.name || "").trim();
      if (!name) continue;
      roster.push({
        name,
        pos: /porter|gk/i.test(String(player?.position || "")) ? "PORT" : "MIG",
        isStarter: true,
        side: "D",
        squad: "favorite",
      });
    }
  }

  return _coachMergeRosterPlayers(roster);
}

function _coachRosterFromTeam(teamName, clubName = "", category = "") {
  const wantedTeam = String(teamName || "").trim();
  const wantedClub = String(clubName || "").trim();
  const wantedCategory = String(category || "").trim();
  if (!wantedTeam) return [];

  const playerMap = (typeof DB !== "undefined" && DB?.jugadors) ? DB.jugadors : null;
  if (!playerMap || typeof playerMap !== "object") return [];

  const roster = [];
  for (const p of Object.values(playerMap)) {
    const name = String(p?.name || "").trim();
    if (!name) continue;

    const candidateTeams = [];
    const regTeam = String(p?.registeredTeam || "").trim();
    if (regTeam) candidateTeams.push(regTeam);
    const stats = Array.isArray(p?.teamStats) ? p.teamStats : [];
    let statTeamMatch = false;
    let hasCategoryEvidence = false;

    if (wantedCategory) {
      const directCategoryText = [
        p?.category,
        p?.cat,
        p?.teamCategory,
        p?.registeredCategory,
        p?.comp,
        p?.compName,
      ].map(x => String(x || "").trim()).filter(Boolean).join(" ");
      if (_coachCategoryMatchesAny(directCategoryText, wantedCategory)) {
        hasCategoryEvidence = true;
      }
    }

    for (const stat of stats) {
      const statTeam = String(stat?.team || "").trim();
      if (statTeam) candidateTeams.push(statTeam);

      if (wantedCategory && !hasCategoryEvidence) {
        const statCategoryText = [
          stat?.cat,
          stat?.category,
          stat?.comp,
          stat?.compName,
          stat?.teamCategory,
        ].map(x => String(x || "").trim()).filter(Boolean).join(" ");
        if (_coachCategoryMatchesAny(statCategoryText, wantedCategory)) {
          hasCategoryEvidence = true;
        }
      }

      if (!statTeam || !_coachTeamEq(statTeam, wantedTeam)) continue;
      if (!wantedCategory) {
        statTeamMatch = true;
        continue;
      }

      const statCatText = [
        stat?.cat,
        stat?.category,
        stat?.comp,
        stat?.compName,
      ].map(x => String(x || "").trim()).filter(Boolean).join(" ");
      if (_coachCategoryMatchesAny(statCatText, wantedCategory)) {
        statTeamMatch = true;
      }
    }

    let matchesTeam = candidateTeams.some(t => _coachTeamEq(t, wantedTeam));
    if (wantedCategory && stats.length) {
      matchesTeam = statTeamMatch;
    }
    if (!matchesTeam) continue;
    if (wantedCategory && !hasCategoryEvidence) continue;

    const candidateClubs = _coachPlayerClubCandidates(p);
    const matchesClub = !wantedClub
      || !candidateClubs.length
      || candidateClubs.some(c => _coachTeamEq(c, wantedClub) || _coachTeamLoose(c, wantedClub) || _coachSearchNorm(c) === _coachSearchNorm(wantedClub));
    if (!matchesClub) continue;

    roster.push({
      name,
      pos: p?.isGK ? "PORT" : "MIG",
      isStarter: true,
      side: "D",
      squad: "favorite",
    });
  }

  return _coachMergeRosterPlayers(roster);
}

async function _coachRosterForSelection(clubName, teamName, category = "") {
  const cacheKey = `${_coachSearchNorm(clubName)}::${_coachSearchNorm(teamName)}::${_coachSearchNorm(category)}`;
  if (coachRosterSelectionCache.has(cacheKey)) return _cclone(coachRosterSelectionCache.get(cacheKey));

  const fromConv = _coachRosterFromConvocatoria(clubName, teamName, category);
  if (fromConv.length) {
    const mergedConv = _coachMergeRosterPlayers(fromConv);
    coachRosterSelectionCache.set(cacheKey, _cclone(mergedConv));
    return mergedConv;
  }

  const fromDb = _coachRosterFromTeam(teamName, clubName, category);
  if (fromDb.length) {
    const mergedDb = _coachMergeRosterPlayers(fromDb);
    coachRosterSelectionCache.set(cacheKey, _cclone(mergedDb));
    return mergedDb;
  }

  const fromActa = await _coachRosterFromActaArchive(clubName, teamName, category);

  const merged = fromActa.length
    ? _coachMergeRosterPlayers(fromActa)
    : [];
  coachRosterSelectionCache.set(cacheKey, _cclone(merged));
  return merged;
}

function _cclone(value) {
  return JSON.parse(JSON.stringify(value));
}

function _clamp(val, min, max) {
  return Math.max(min, Math.min(max, Number(val) || 0));
}

function _coachToolMeta(toolId) {
  return COACH_TACTIC_TOOLS.find(tool => tool.id === toolId) || COACH_TACTIC_TOOLS[0];
}

function _coachLoadSavedPlays() {
  try {
    const raw = localStorage.getItem(COACH_TACTIC_PLAYBOOK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _coachPersistSavedPlays() {
  try {
    localStorage.setItem(COACH_TACTIC_PLAYBOOK_KEY, JSON.stringify(coachSavedPlays || []));
  } catch {}
}

function _coachBoardPlayerColor(player) {
  if (player?.isGoalie) return "#fbbf24";
  if ((player?.side || player?.team) === "away") return "#ffffff";
  return "#ef4444";
}

function _coachBoardPlayerTextColor(player) {
  return (player?.side || player?.team) === "away" ? "#0f172a" : "#ffffff";
}

function _coachBoardTeamKey() {
  return String(_cteam() || "sense-equip").trim().toLowerCase();
}

function _coachLoadBoardStateStore() {
  try {
    const raw = localStorage.getItem(COACH_TACTIC_BOARD_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function _coachCurrentBoardStoragePayload() {
  return {
    tool: coachBoardState?.tool || "move",
    ballMode: coachBoardState?.ballMode || "attached",
    puckAttachedTo: coachBoardState?.puckAttachedTo || null,
    recording: Boolean(coachBoardState?.recording),
    recordingFrames: Array.isArray(coachBoardState?.recordingFrames) ? coachBoardState.recordingFrames : [],
    board: {
      tacticIdx: coachTacticIdx,
      players: _cclone(coachBoardState?.players || []),
      puck: _cclone(coachBoardState?.puck || { x: 22, y: 50 }),
      annotations: _cclone(coachBoardState?.annotations || []),
    },
    updatedAt: new Date().toISOString(),
  };
}

function _coachLoadBoardStateForTeam(teamKey) {
  const store = _coachLoadBoardStateStore();
  const key = String(teamKey || "").trim();
  if (!key) return null;
  return store[key] || null;
}

function _coachPersistBoardState() {
  try {
    if (!coachBoardState) return;
    const key = _coachBoardTeamKey();
    if (!key) return;
    const store = _coachLoadBoardStateStore();
    const payload = _coachCurrentBoardStoragePayload();
    store[key] = payload;
    localStorage.setItem(COACH_TACTIC_BOARD_STATE_KEY, JSON.stringify(store));
    _coachScheduleBoardStateRemoteSave(payload);
  } catch {}
}

async function _coachLoadBoardStateRemote() {
  const sb = _csb();
  const uid = await _cauthUid();
  const team = String(_cteam("match") || "").trim();
  if (!sb || !uid || !team) return;

  const season = _coachSeasonKey();
  const loadKey = `${uid}::${season}::${team.toLowerCase()}`;
  if (coachBoardRemoteLoadedKey === loadKey) return;

  try {
    const { data, error } = await sb
      .from("coach_tactic_board_states")
      .select("board_state, updated_at")
      .eq("user_id", uid)
      .eq("team_name", team)
      .eq("season", season)
      .maybeSingle();
    if (error) {
      coachBoardRemoteLoadedKey = loadKey;
      return;
    }

    if (data?.board_state && typeof data.board_state === "object") {
      const payload = data.board_state;
      if (payload?.board) {
        _coachApplyBoardSnapshot(payload.board);
        coachBoardState.tool = payload.tool || coachBoardState.tool;
        coachBoardState.ballMode = payload.ballMode === "free" ? "free" : "attached";
        coachBoardState.puckAttachedTo = payload.puckAttachedTo || coachBoardState.puckAttachedTo;
        coachBoardState.recording = Boolean(payload.recording);
        coachBoardState.recordingFrames = Array.isArray(payload.recordingFrames) ? payload.recordingFrames : [];
        _coachResolveAttachedPuckPosition();
      }
    }
  } catch {
  } finally {
    coachBoardRemoteLoadedKey = loadKey;
  }
}

function _coachScheduleBoardStateRemoteSave(payload) {
  if (coachBoardRemoteSaveTimer) clearTimeout(coachBoardRemoteSaveTimer);
  const nonce = ++coachBoardRemoteSaveNonce;
  coachBoardRemoteSaveTimer = setTimeout(() => {
    void _coachPersistBoardStateRemote(payload, nonce);
  }, 700);
}

async function _coachPersistBoardStateRemote(payload, nonce) {
  if (nonce !== coachBoardRemoteSaveNonce) return;

  const sb = _csb();
  const uid = await _coachAuthUidForWrite();
  const team = String(_cteam("match") || _cteam() || "").trim();
  if (!sb || !uid || !team) return;

  const season = _coachSeasonKey();
  try {
    await sb.from("coach_tactic_board_states").upsert({
      user_id: uid,
      team_name: team,
      season,
      board_state: payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,team_name,season" });
  } catch {}
}

function _coachPlayerInitials(name) {
  const clean = String(name || "").trim();
  if (!clean) return "";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function _coachLineupForBoard() {
  const all = Array.isArray(coachMatchState?.players)
    ? coachMatchState.players.filter(p => String(p?.squad || "favorite") !== "rival")
    : [];
  const starters = all.filter(p => p?.isStarter);
  return starters.length ? starters : all;
}

function _coachHomeFieldLabels(maxCount) {
  const lineup = _coachLineupForBoard().filter(p => String(p?.pos || "").toUpperCase() !== "PORT");
  const labels = lineup.slice(0, maxCount).map(p => _coachPlayerInitials(p?.name || "")).filter(Boolean);
  const fallback = ["D", "M1", "M2", "A", "A2"];
  while (labels.length < maxCount) labels.push(fallback[labels.length] || `P${labels.length + 1}`);
  return labels;
}

function _coachHomeGoalieLabel() {
  const gk = _coachLineupForBoard().find(p => String(p?.pos || "").toUpperCase() === "PORT");
  return _coachPlayerInitials(gk?.name || "") || "GK";
}

function _coachGoalieAreaBounds(side) {
  const area = (side === "away" ? COACH_GOALIE_AREAS.away : COACH_GOALIE_AREAS.home) || COACH_GOALIE_AREAS.home;
  return {
    minX: area.xMin,
    maxX: area.xMax,
    minY: area.yMin,
    maxY: area.yMax,
  };
}

function _coachConstrainPlayerPoint(player, point) {
  const x = _clamp(point.x, 4, 96);
  const y = _clamp(point.y, 8.5, 91.5);
  if (!player?.isGoalie) return { x, y };
  const b = _coachGoalieAreaBounds(player.side || player.team || "home");
  return { x: _clamp(x, b.minX, b.maxX), y: _clamp(y, b.minY, b.maxY) };
}

function _coachResolveAttachedPuckPosition() {
  if (!coachBoardState || coachBoardState.ballMode !== "attached") return;
  const attached = (coachBoardState.players || []).find(p => p.id === coachBoardState.puckAttachedTo && !p.isGoalie)
    || (coachBoardState.players || []).find(p => !p.isGoalie && (p.side || p.team) === "home")
    || (coachBoardState.players || []).find(p => !p.isGoalie)
    || null;
  if (!attached) return;
  coachBoardState.puckAttachedTo = attached.id;
  coachBoardState.puck.x = attached.x;
  coachBoardState.puck.y = attached.y;
}

function _coachTeamCounts(side) {
  const sidePlayers = (coachBoardState?.players || []).filter(p => (p.side || p.team) === side);
  const goalies = sidePlayers.filter(p => p.isGoalie).length;
  const field = sidePlayers.length - goalies;
  return { total: sidePlayers.length, goalies, field, maxField: goalies > 0 ? 4 : 5 };
}

function _coachNormalizeBoardPlayers(players, tacticIdx) {
  const tactic = COACH_TACTICS[tacticIdx] || COACH_TACTICS[0];
  const hasHomeGoalie = tactic.homeGoalie !== false;
  const hasAwayGoalie = tactic.awayGoalie !== false;
  const awayMinField = 4;

  let out = (players || []).map(raw => {
    const side = String(raw?.side || raw?.team || "home") === "away" ? "away" : "home";
    const isGoalie = Boolean(raw?.isGoalie || /gk/i.test(String(raw?.id || "")));
    return {
      id: String(raw?.id || "").trim(),
      label: String(raw?.label || "").trim() || (isGoalie ? "GK" : (side === "away" ? "R" : "P")),
      team: side,
      side,
      isGoalie,
      x: Number(raw?.x),
      y: Number(raw?.y),
    };
  }).filter(p => p.id);

  out = out.filter(p => {
    if (p.side === "home" && p.isGoalie && !hasHomeGoalie) return false;
    if (p.side === "away" && p.isGoalie && !hasAwayGoalie) return false;
    return true;
  });

  for (const side of ["home", "away"]) {
    const sidePlayers = out.filter(p => p.side === side);
    const goalies = sidePlayers.filter(p => p.isGoalie);
    const field = sidePlayers.filter(p => !p.isGoalie);
    const maxField = goalies.length > 0 ? 4 : 5;
    const keepField = field.slice(0, maxField);
    const minField = side === "away" ? awayMinField : 0;
    const defaults = side === "away"
      ? [{ x: 62, y: 25 }, { x: 70, y: 40 }, { x: 70, y: 60 }, { x: 62, y: 75 }]
      : (Array.isArray(tactic.homePositions) ? tactic.homePositions : (tactic.positions || []));
    while (keepField.length < Math.min(minField, maxField)) {
      const pos = defaults[keepField.length] || { x: side === "away" ? 70 : 35, y: _clamp(25 + keepField.length * 12, 14, 86) };
      keepField.push({
        id: `${side}_auto_${keepField.length + 1}`,
        label: side === "away" ? `R${keepField.length + 1}` : `A${keepField.length + 1}`,
        team: side,
        side,
        isGoalie: false,
        x: pos.x,
        y: pos.y,
      });
    }
    const keep = [...goalies.slice(0, 1), ...keepField].slice(0, 5);
    out = out.filter(p => p.side !== side).concat(keep);
  }

  return out.map(player => {
    const constrained = _coachConstrainPlayerPoint(player, { x: player.x, y: player.y });
    return { ...player, x: constrained.x, y: constrained.y };
  });
}

function _coachBuildBoardPlayers(tacticIdx) {
  const tactic = COACH_TACTICS[tacticIdx] || COACH_TACTICS[0];
  const homePositions = Array.isArray(tactic.homePositions) ? tactic.homePositions : (tactic.positions || []);
  const awayPositions = [{ x: 62, y: 25 }, { x: 70, y: 40 }, { x: 70, y: 60 }, { x: 62, y: 75 }];
  const homeLabels = _coachHomeFieldLabels(homePositions.length);
  const players = [];

  if (tactic.homeGoalie !== false) {
    players.push({ id: "gk_home", label: _coachHomeGoalieLabel(), team: "home", side: "home", isGoalie: true, x: 9, y: 50 });
  }

  homePositions.forEach((pos, idx) => {
    players.push({
      id: `home_${idx + 1}`,
      label: homeLabels[idx] || `P${idx + 1}`,
      team: "home",
      side: "home",
      isGoalie: false,
      x: pos.x,
      y: pos.y,
    });
  });

  awayPositions.forEach((pos, idx) => {
    players.push({
      id: `away_${idx + 1}`,
      label: `R${idx + 1}`,
      team: "away",
      side: "away",
      isGoalie: false,
      x: pos.x,
      y: pos.y,
    });
  });

  if (tactic.awayGoalie !== false) {
    players.push({ id: "away_gk", label: "GK", team: "away", side: "away", isGoalie: true, x: 91, y: 50 });
  }

  return _coachNormalizeBoardPlayers(players, tacticIdx);
}

function _coachDefaultBoardState(tacticIdx = coachTacticIdx) {
  const players = _coachBuildBoardPlayers(tacticIdx);
  const firstCarrier = players.find(p => !p.isGoalie && (p.side || p.team) === "home") || players.find(p => !p.isGoalie) || null;
  return {
    tacticIdx,
    tool: "move",
    ballMode: "attached",
    puckAttachedTo: firstCarrier?.id || null,
    players,
    puck: firstCarrier ? { x: firstCarrier.x, y: firstCarrier.y } : { x: 22, y: 50 },
    annotations: [],
    selectedEntity: null,
    pendingAction: null,
    fullscreen: false,
    recording: false,
    recordingFrames: [],
  };
}

function _coachEnsureBoardState(forceReset = false) {
  if (!coachSavedPlays.length) coachSavedPlays = _coachLoadSavedPlays();
  if (forceReset || !coachBoardState || coachBoardState.tacticIdx !== coachTacticIdx) {
    const fullscreen = coachBoardState?.fullscreen || false;
    const persisted = !forceReset ? _coachLoadBoardStateForTeam(_coachBoardTeamKey()) : null;
    if (persisted?.board) {
      coachTacticIdx = _clamp(Number(persisted.board?.tacticIdx ?? coachTacticIdx), 0, COACH_TACTICS.length - 1);
      coachBoardState = _coachDefaultBoardState(coachTacticIdx);
      coachBoardState.players = _coachNormalizeBoardPlayers(persisted.board.players || coachBoardState.players, coachTacticIdx);
      coachBoardState.puck = persisted.board.puck ? _cclone(persisted.board.puck) : coachBoardState.puck;
      coachBoardState.annotations = Array.isArray(persisted.board.annotations) ? _cclone(persisted.board.annotations) : [];
      coachBoardState.tool = persisted.tool || coachBoardState.tool;
      coachBoardState.ballMode = persisted.ballMode === "free" ? "free" : "attached";
      coachBoardState.puckAttachedTo = persisted.puckAttachedTo || coachBoardState.puckAttachedTo;
      coachBoardState.recording = Boolean(persisted.recording);
      coachBoardState.recordingFrames = Array.isArray(persisted.recordingFrames) ? persisted.recordingFrames : [];
      _coachResolveAttachedPuckPosition();
    } else {
      coachBoardState = _coachDefaultBoardState(coachTacticIdx);
    }
    coachBoardState.fullscreen = fullscreen;
  }
}

function _coachCurrentBoardSnapshot() {
  _coachEnsureBoardState();
  _coachResolveAttachedPuckPosition();
  return {
    tacticIdx: coachTacticIdx,
    players: _cclone(coachBoardState.players),
    puck: _cclone(coachBoardState.puck),
    annotations: _cclone(coachBoardState.annotations),
  };
}

function _coachApplyBoardSnapshot(snapshot) {
  _coachEnsureBoardState();
  const nextTacticIdx = Number.isFinite(Number(snapshot?.tacticIdx)) ? Number(snapshot.tacticIdx) : coachTacticIdx;
  const fullscreen = coachBoardState?.fullscreen || false;
  const tool = coachBoardState?.tool || "move";
  const ballMode = coachBoardState?.ballMode || "attached";
  const puckAttachedTo = coachBoardState?.puckAttachedTo || null;
  const recording = coachBoardState?.recording || false;
  const recordingFrames = recording ? (coachBoardState?.recordingFrames || []) : [];

  coachTacticIdx = _clamp(nextTacticIdx, 0, COACH_TACTICS.length - 1);
  coachBoardState = _coachDefaultBoardState(coachTacticIdx);
  coachBoardState.players = Array.isArray(snapshot?.players) && snapshot.players.length
    ? _coachNormalizeBoardPlayers(snapshot.players, coachTacticIdx)
    : coachBoardState.players;
  coachBoardState.puck = snapshot?.puck ? _cclone(snapshot.puck) : coachBoardState.puck;
  coachBoardState.annotations = Array.isArray(snapshot?.annotations) ? _cclone(snapshot.annotations) : [];
  coachBoardState.fullscreen = fullscreen;
  coachBoardState.tool = tool;
  coachBoardState.ballMode = ballMode === "free" ? "free" : "attached";
  coachBoardState.puckAttachedTo = puckAttachedTo;
  coachBoardState.recording = recording;
  coachBoardState.recordingFrames = recordingFrames;
  _coachResolveAttachedPuckPosition();
}

function _coachBoardMessage(msg) {
  coachTacticsMsg = msg || "";
}

function _coachBoardRecordFrame(label) {
  if (!coachBoardState?.recording) return;
  const snapshot = _coachCurrentBoardSnapshot();
  const frames = coachBoardState.recordingFrames || [];
  const prev = frames[frames.length - 1]?.snapshot || null;
  if (prev && JSON.stringify(prev) === JSON.stringify(snapshot)) return;
  frames.push({
    id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: label || "Acció",
    snapshot,
    capturedAt: new Date().toISOString(),
  });
  coachBoardState.recordingFrames = frames;
  _coachPersistBoardState();
}

function _coachActiveSavedPlays() {
  const team = String(_cteam() || "").trim().toLowerCase();
  return (coachSavedPlays || []).filter(play => String(play?.team || "").trim().toLowerCase() === team);
}

function _coachBoardPayload() {
  return {
    tacticIdx: coachTacticIdx,
    tacticName: COACH_TACTICS[coachTacticIdx]?.name || "",
    board: _coachCurrentBoardSnapshot(),
    savedPlayIds: _coachActiveSavedPlays().map(play => play.id),
  };
}

function _coachToggleBallMode(mode) {
  _coachEnsureBoardState();
  coachBoardState.ballMode = mode === "free" ? "free" : "attached";
  if (coachBoardState.ballMode === "attached") {
    const selected = coachBoardState.selectedEntity?.kind === "player"
      ? coachBoardState.players.find(p => p.id === coachBoardState.selectedEntity.id && !p.isGoalie)
      : null;
    if (selected) coachBoardState.puckAttachedTo = selected.id;
    _coachResolveAttachedPuckPosition();
  }
  _coachBoardMessage(coachBoardState.ballMode === "attached"
    ? "Mode bola: enganxada a un jugador."
    : "Mode bola: objecte lliure en primer pla.");
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
}

function _coachBallActionFollow(tool, kind, id, point) {
  if (!coachBoardState) return;

  if (tool === "shot") {
    coachBoardState.ballMode = "free";
    coachBoardState.puckAttachedTo = null;
    coachBoardState.puck.x = point.x;
    coachBoardState.puck.y = point.y;
    return;
  }

  if (coachBoardState.ballMode !== "attached") return;
  if (tool !== "pass") return;

  if (kind === "player") {
    const player = coachBoardState.players.find(p => p.id === id && !p.isGoalie);
    if (player) {
      coachBoardState.puckAttachedTo = player.id;
      coachBoardState.puck.x = player.x;
      coachBoardState.puck.y = player.y;
      return;
    }
  }
  coachBoardState.puckAttachedTo = null;
  coachBoardState.puck.x = point.x;
  coachBoardState.puck.y = point.y;
}

function _coachPointInsideGoal(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const inHomeGoal = x >= 8.8 && x <= 11.0 && y >= 45 && y <= 55;
  const inAwayGoal = x >= 89 && x <= 91.2 && y >= 45 && y <= 55;
  return inHomeGoal || inAwayGoal;
}

function _coachStopPlayback() {
  if (coachPlaybackTimer) {
    clearInterval(coachPlaybackTimer);
    coachPlaybackTimer = null;
  }
}

function _coachBoardPointFromEvent(evt) {
  const svg = evt?.target?.closest?.("svg[data-coach-board='1']") || document.getElementById("coach-tactics-board-svg");
  if (!svg) return { x: 50, y: 50 };
  const rect = svg.getBoundingClientRect();
  const x = ((evt.clientX - rect.left) / rect.width) * 100;
  const y = ((evt.clientY - rect.top) / rect.height) * 100;
  return {
    x: _clamp(x, 4, 96),
    y: _clamp(y, 4, 96),
  };
}

function _coachBoardEntityPoint(kind, id, fallbackPoint) {
  if (kind === "player") {
    const player = coachBoardState.players.find(item => item.id === id);
    if (player) return { x: player.x, y: player.y, label: player.label };
  }
  if (kind === "puck") {
    return { x: coachBoardState.puck.x, y: coachBoardState.puck.y, label: "Pilota" };
  }
  return { x: fallbackPoint.x, y: fallbackPoint.y, label: "Camp" };
}

function _coachBoardPlayerById(playerId) {
  const pid = String(playerId || "").trim();
  if (!pid) return null;
  return (coachBoardState?.players || []).find(p => String(p?.id || "") === pid) || null;
}

function _coachHexToRgba(hex, alpha = 0.16) {
  const clean = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return `rgba(124,58,237,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function _coachZigzagPathPoints(a, b, segments = 6, amplitude = 0.9) {
  const ax = Number(a?.x || 0);
  const ay = Number(a?.y || 0);
  const bx = Number(b?.x || 0);
  const by = Number(b?.y || 0);
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.max(0.001, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const pts = [`${ax},${ay}`];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const side = i % 2 === 0 ? -1 : 1;
    const x = ax + dx * t + px * amplitude * side;
    const y = ay + dy * t + py * amplitude * side;
    pts.push(`${x},${y}`);
  }
  pts.push(`${bx},${by}`);
  return pts.join(" ");
}

function _coachCreateAnnotation(tool, start, end, options = {}) {
  const ann = {
    id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: tool,
    start: { x: start.x, y: start.y },
    end: { x: end.x, y: end.y },
  };
  if (tool === "zone") {
    ann.zoneColor = String(options?.zoneColor || COACH_ZONE_COLORS[0]);
  }
  if (tool === "screen") {
    ann.blockedPlayerId = String(options?.blockedPlayerId || "");
  }
  return ann;
}

function _coachRenderTacticsTabRoot() {
  const root = document.getElementById("coach-tactics-root");
  _coachPersistBoardState();
  if (root) root.innerHTML = _renderTacticsPanelInner();
}

function _coachIsPhoneLikeScreen() {
  if (typeof window === "undefined") return false;
  const w = Number(window.innerWidth || 0);
  const h = Number(window.innerHeight || 0);
  const shortSide = Math.min(w, h);
  return shortSide > 0 && shortSide < 700;
}

function _coachUpdateBoardEntityPosition(kind, id, point) {
  if (kind === "player") {
    const player = coachBoardState.players.find(item => item.id === id);
    if (!player) return false;
    const next = _coachConstrainPlayerPoint(player, point);
    player.x = next.x;
    player.y = next.y;
    if (coachBoardState.ballMode === "attached" && coachBoardState.puckAttachedTo === player.id) {
      coachBoardState.puck.x = player.x;
      coachBoardState.puck.y = player.y;
    }
    return true;
  }
  if (kind === "puck") {
    if (coachBoardState.ballMode === "attached") return false;
    coachBoardState.puck.x = point.x;
    coachBoardState.puck.y = point.y;
    return true;
  }
  return false;
}

function _coachSyncDraggedEntityToDom(kind, id) {
  const svg = document.getElementById("coach-tactics-board-svg");
  if (!svg) return;

  if (kind === "player") {
    const player = coachBoardState.players.find(item => item.id === id);
    if (!player) return;
    const node = svg.querySelector(`[data-coach-entity-kind="player"][data-coach-entity-id="${id}"]`);
    if (!node) return;
    const circle = node.querySelector("circle");
    const label = node.querySelector("text");
    if (circle) {
      circle.setAttribute("cx", String(player.x));
      circle.setAttribute("cy", String(player.y));
    }
    if (label) {
      label.setAttribute("x", String(player.x));
      label.setAttribute("y", String(player.y + 0.3));
    }
    return;
  }

  if (kind === "puck") {
    const circles = svg.querySelectorAll("[data-coach-entity-kind='puck'] circle");
    if (!circles?.length) return;
    for (const puck of circles) {
      puck.setAttribute("cx", String(coachBoardState.puck.x));
      puck.setAttribute("cy", String(coachBoardState.puck.y));
    }
  }
}

/* ── Open / Close ────────────────────────────────────────────────────────── */
function openCoachPanel() {
  if (typeof profileHasRole === "function" && !profileHasRole(currentProfile, "entrenador")) {
    alert("No tens permisos d'entrenador.");
    return;
  }
  if (_coachSeasonKey() !== "current") {
    ["screen-home", "screen-picker", "screen-detail", "screen-acta", "screen-team",
     "screen-admin", "screen-coordinator"].forEach(id => {
      const hidden = document.getElementById(id);
      if (hidden) hidden.style.display = "none";
    });
    const guardEl = document.getElementById("screen-coach");
    if (guardEl) guardEl.style.display = "flex";
    Promise.resolve(renderCoachPanel()).catch(() => {});
    return;
  }
  ["screen-home", "screen-picker", "screen-detail", "screen-acta", "screen-team",
   "screen-admin", "screen-coordinator"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  const el = document.getElementById("screen-coach");
  if (el) el.style.display = "flex";
  // Force reload favorites from DB every time panel opens
  coachFavoriteTeamsLoaded = false;
  coachMatchState.opponent = "";
  if (coachPanelTab === "match" && coachMatchSubTab === "tactics") {
    _coachStopPlayback();
    coachTacticIdx = COACH_DEFAULT_TACTIC_IDX;
    _coachEnsureBoardState(true);
  }
  Promise.resolve(renderCoachPanel()).catch(err => {
    console.error("[coach-panel] open error", err);
    alert("No s'ha pogut obrir el panell entrenador. Recarrega la pàgina.");
  });
}

function closeCoachPanel() {
  const el = document.getElementById("screen-coach");
  if (el) el.style.display = "none";
  if (typeof renderHome === "function") renderHome();
}

async function coachSwitchToCurrentSeason() {
  if (_coachSeasonKey() === "current") {
    openCoachPanel();
    return;
  }
  if (typeof switchActiveSeason !== "function") {
    alert("No s'ha pogut canviar de temporada automàticament.");
    return;
  }
  try {
    await switchActiveSeason("current", { showLoading: true });
    openCoachPanel();
  } catch (err) {
    alert(`No s'ha pogut canviar a temporada actual: ${err?.message || "error desconegut"}`);
  }
}

function coachSetTab(tab) {
  coachPanelTab = tab;
  const resolved = _coachResolveTeamChoice(tab);
  if (resolved?.optionValue && !String(coachTabTeamValues?.[tab] || "").trim()) {
    coachTabTeamValues[tab] = resolved.optionValue;
  }
  renderCoachPanel();
}

function coachSetMatchSubTab(tab) {
  coachMatchSubTab = tab;
  if (tab === "tactics") {
    _coachStopPlayback();
    coachTacticIdx = COACH_DEFAULT_TACTIC_IDX;
    _coachEnsureBoardState(true);
    _coachBoardMessage("Pissarra neta (2-2) carregada.");
  }
  renderCoachPanel();
}

/* ── Main render ─────────────────────────────────────────────────────────── */
async function renderCoachPanel(clubSearchCursor) {
  const body = document.getElementById("coach-body");
  if (!body) return;

  if (_coachSeasonKey() !== "current") {
    body.innerHTML = `<div style="background:#fff7ed;border:1.5px solid #fdba74;border-radius:14px;padding:18px;margin-bottom:12px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;color:#9a3412;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Panell disponible a la temporada actual</div>
      <div style="font-size:13px;color:#7c2d12;line-height:1.55;margin-bottom:10px">Per evitar barrejar dades operatives (alineacions, objectius, entrenaments i tàctica), el panell d'Entrenador només funciona en temporada actual.</div>
      <button onclick="coachSwitchToCurrentSeason()" style="background:#ea580c;border:none;color:#fff;font-weight:800;font-size:13px;padding:10px 14px;border-radius:10px;cursor:pointer">Canviar a temporada actual</button>
    </div>`;
    return;
  }

  const writeUid = await _coachAuthUidForWrite();
  const authBadge = writeUid
    ? `<div style="display:inline-flex;align-items:center;gap:7px;background:#ecfdf5;border:1px solid #86efac;color:#166534;font-size:12px;font-weight:700;padding:7px 10px;border-radius:999px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:#22c55e"></span>
        Sessio BD activa
      </div>`
    : `<div style="display:inline-flex;align-items:center;gap:7px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:12px;font-weight:700;padding:7px 10px;border-radius:999px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:#f59e0b"></span>
        Sessio BD no activa - cal login OTP
      </div>`;

  let options = _coachBuildClubTeamOptions();
  try {
    await _coachLoadSelectedClub(options);
  } catch (err) {
    console.warn("[coach-panel] load selected club failed", err);
  }
  try {
    await _coachLoadFavoriteTeams(options);
  } catch (err) {
    console.warn("[coach-panel] load favorite teams failed", err);
  }
  options = _coachEnsureTeamSelection(options);
  const team = _cteam();
  const club = _cclub();
  const query = _coachSearchNorm(coachClubSearch);
  const filteredClubOptions = query
    ? options.filter(o => _coachSearchNorm(o.clubName).includes(query))
    : options;
  const visibleClubOptions = filteredClubOptions.length ? filteredClubOptions : options;
  const selectedClub = options.find(o => o.clubName === club) || null;
  const selectedChoice = _coachResolveTeamChoice(coachPanelTab, options);
  const selectedTeamOptionValue = String(selectedChoice?.optionValue || "");
  const teamOptions = (selectedClub?.teams || []).map(t => {
    const teamName = String(t?.teamName || "").trim();
    const category = String(t?.category || "").trim();
    const categoryLabel = category
      ? ((typeof CAT_LABELS !== "undefined" && CAT_LABELS[category]) ? CAT_LABELS[category] : category)
      : "";
    const teamLabel = typeof shortTeamDisplayName === "function" ? shortTeamDisplayName(teamName) : teamName;
    const label = categoryLabel ? `${teamLabel} · ${categoryLabel}` : teamLabel;
    const value = String(t?.optionValue || _coachOptionValue(teamName, category, selectedClub?.clubName || ""));
    return `<option value="${_cesc(value)}" ${value === selectedTeamOptionValue ? "selected" : ""}>${_cesc(label)}</option>`;
  }).join("");

  const teamRow = options.length
    ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <label style="font-size:13px;font-weight:700;color:#64748b;white-space:nowrap">Club:</label>
        <input id="coach-club-search" value="${_cesc(coachClubSearch)}" placeholder="🔍 Cerca club..." oninput="coachSetClubSearch(this.value, this.selectionStart)" style="min-width:220px;flex:1;max-width:340px;padding:9px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff"/>
        <select onchange="coachSetClub(this.value)" style="min-width:220px;flex:1;max-width:340px;padding:9px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff">
          ${visibleClubOptions.map(o => `<option value="${_cesc(o.clubName)}" ${o.clubName === club ? "selected" : ""}>${_cesc(o.clubName)}</option>`).join("")}
        </select>
        <label style="font-size:13px;font-weight:700;color:#64748b;white-space:nowrap">Equip:</label>
        <select onchange="coachSetTeam(this.value)" style="min-width:220px;flex:1;max-width:380px;padding:9px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff">
          <option value="" ${selectedTeamOptionValue ? "" : "selected"}>Selecciona equip...</option>
          ${teamOptions}
        </select>
      </div>`
    : `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <label style="font-size:13px;font-weight:700;color:#64748b;white-space:nowrap">Equip:</label>
        <input id="coach-team-inp" value="${_cesc(team)}" placeholder="Nom de l'equip..."
          oninput="coachSetTeam(this.value)"
          style="flex:1;max-width:360px;padding:9px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none"/>
      </div>`;

  const tabs = [
    { key: "planning",   label: "📋 Planificació" },
    { key: "objectives", label: "🎯 Objectius" },
    { key: "match",      label: "⚽ Partits" },
  ];
  const tabsHtml = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px">
    ${tabs.map(t => {
      const on = coachPanelTab === t.key;
      return `<button onclick="coachSetTab('${t.key}')" style="background:${on ? "#1a2035" : "#fff"};border:1.5px solid ${on ? "#1a2035" : "#dbe3f0"};color:${on ? "#fff" : "#334155"};font-weight:700;font-size:13px;padding:10px 18px;border-radius:999px;cursor:pointer">${_cesc(t.label)}</button>`;
    }).join("")}
  </div>`;

  let content = "";
  if (coachPanelTab === "planning")   content = await _renderPlanningTab();
  else if (coachPanelTab === "objectives") content = await _renderObjectivesTab();
  else if (coachPanelTab === "match") {
    content = _renderMatchTab();
  }

  const tabHeader = _coachTabTeamHeader(coachPanelTab, options);
  const favoriteStatus = coachFavoritePersistStatus?.text
    ? `<div style="margin:-2px 0 10px 0;padding:9px 11px;border-radius:10px;font-size:12px;font-weight:700;color:${coachFavoritePersistStatus.type === "error" ? "#b91c1c" : coachFavoritePersistStatus.type === "warn" ? "#9a3412" : "#166534"};background:${coachFavoritePersistStatus.type === "error" ? "#fef2f2" : coachFavoritePersistStatus.type === "warn" ? "#fff7ed" : "#ecfdf5"};border:1px solid ${coachFavoritePersistStatus.type === "error" ? "#fecaca" : coachFavoritePersistStatus.type === "warn" ? "#fed7aa" : "#86efac"}">${_cesc(coachFavoritePersistStatus.text)}</div>`
    : "";
  body.innerHTML = teamRow + `<div style="display:flex;justify-content:flex-end;margin-bottom:10px">${authBadge}</div>` + favoriteStatus + tabsHtml + tabHeader + content;
  if (clubSearchCursor !== undefined) {
    const input = document.getElementById("coach-club-search");
    if (input) {
      input.focus();
      input.setSelectionRange(clubSearchCursor, clubSearchCursor);
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   PLANNING TAB
══════════════════════════════════════════════════════════════════════════ */
async function _renderPlanningTab() {
  const selectedTeam = _cteam("planning");
  const selectedChoice = _coachResolveTeamChoice("planning");
  const selectedTeamIdentity = _coachTeamIdentityLabel(selectedChoice) || selectedTeam;
  if (!selectedTeam) {
    return `<div style="background:#fff;border:1.5px dashed #dbe3f0;border-radius:14px;padding:24px;text-align:center;color:#64748b;font-size:14px">Selecciona un equip per veure i crear entrenaments.</div>`;
  }

  if (!coachTrainingsLoaded || coachTrainingsTeamKey !== selectedTeamIdentity) {
    await _loadTrainings();
  }

  const totalMins = coachTrainings.reduce((s, t) => s + Number(t.duration_minutes || 0), 0);
  const totalH    = Math.floor(totalMins / 60);
  const totalM    = totalMins % 60;

  /* Pillar checkboxes */
  const pillarCbs = COACH_PILLARS.map(p => {
    const on = coachPlanningPillars.includes(p.id);
    return `<label style="display:inline-flex;align-items:center;gap:5px;background:${on ? p.color : "#f8fafc"};border:1.5px solid ${on ? p.color : "#e2e6ef"};color:${on ? "#fff" : "#334155"};border-radius:8px;padding:6px 11px;cursor:pointer;font-size:12px;font-weight:600;margin:3px;transition:all .15s">
      <input type="checkbox" ${on ? "checked" : ""} onchange="coachTogglePillar('${p.id}')" style="display:none"/>
      ${_cesc(p.label)}
    </label>`;
  }).join("");

  /* Exercise suggestions */
  const suggestions = _getSuggestions(coachPlanningPillars);
  const suggestHtml = suggestions.length
    ? `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px;margin-top:12px">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#0284c7;letter-spacing:.06em;margin-bottom:8px">💡 Proposta d'exercicis</div>
        ${suggestions.map(s => `<div style="font-size:12px;color:#0f172a;padding:5px 0;border-bottom:1px solid #e0f2fe;line-height:1.45">• ${_cesc(s)}</div>`).join("")}
      </div>`
    : "";

  /* Training list */
  const listRows = coachTrainings.length
    ? coachTrainings.slice().reverse().map(t => {
        const dur = t.duration_minutes
          ? `${Math.floor(t.duration_minutes / 60)}h${t.duration_minutes % 60 ? String(t.duration_minutes % 60).padStart(2, "0") + "'" : ""}`
          : "";
        const source = String(t?._source || "coach");
        const sourceChip = source === "shared"
          ? `<span style="background:#fef3c7;color:#92400e;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700">Compartit</span>`
          : source === "coordinator"
            ? `<span style="background:#ede9fe;color:#5b21b6;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700">Coordinator</span>`
            : `<span style="background:#ecfdf5;color:#166534;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700">Entrenador</span>`;
        const sharedMeta = source === "shared" ? t?._sharedRaw : null;
        const locationNote = sharedMeta?.location ? `📍 ${sharedMeta.location}` : "";
        const timeNote = sharedMeta?.training_time ? `🕐 ${sharedMeta.training_time}` : "";
        const pillarsFromShared = source === "shared" && Array.isArray(sharedMeta?.pillars) && sharedMeta.pillars.length
          ? sharedMeta.pillars
          : (t.pillars || []);
        const badges = pillarsFromShared.map(pid => {
          const p = COACH_PILLARS.find(x => x.id === pid);
          return p ? `<span style="background:${p.color};color:#fff;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">${p.short}</span>` : "";
        }).join(" ");
        return `<div style="background:#fff;border:1px solid #e2e6ef;border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
              <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;color:#1a2035">${_cesc(t.plan_date || "")}</span>
              <span style="font-size:12px;color:#64748b">${dur}</span>
              ${timeNote ? `<span style="font-size:11px;color:#475569">${_cesc(timeNote)}</span>` : ""}
              ${locationNote ? `<span style="font-size:11px;color:#475569">${_cesc(locationNote)}</span>` : ""}
              ${sourceChip}
              <div style="display:flex;gap:3px;flex-wrap:wrap">${badges}</div>
            </div>
            ${t.notes ? `<div style="font-size:12px;color:#64748b;line-height:1.4">${_cesc(t.notes)}</div>` : ""}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
            ${source === "shared" ? `<button onclick="coachLoadCoordinatorTrainingToForm('${_cesc(t.id)}')" title="Carregar i enriquir" style="background:#fef3c7;border:1px solid #fbbf24;color:#92400e;cursor:pointer;font-size:11px;font-weight:700;padding:6px 8px;border-radius:8px">Enriquir</button>` : ""}
            ${source === "coordinator" ? `<button onclick="coachLoadCoordinatorTrainingToForm('${_cesc(t.id)}')" title="Carregar al formulari" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;cursor:pointer;font-size:11px;font-weight:700;padding:6px 8px;border-radius:8px">Carregar</button>` : ""}
            ${source === "coach" || source === "shared" ? `<button onclick="coachDeleteTraining('${t.id}')" title="Eliminar" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:16px;padding:2px 4px">✕</button>` : ""}
          </div>
        </div>`;
      }).join("")
    : `<div style="padding:24px;text-align:center;color:#94a3b8;font-size:13px">Cap entrenament registrat per a aquest equip.</div>`;

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">

      <!-- Stats card -->
      <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:14px">Resum temporada</div>
        <div style="display:flex;gap:12px">
          <div style="flex:1;background:#f0f9ff;border-radius:12px;padding:14px;text-align:center">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:38px;font-weight:900;color:#0284c7;line-height:1">${coachTrainings.length}</div>
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:4px">Entrenaments</div>
          </div>
          <div style="flex:1;background:#f0fdf4;border-radius:12px;padding:14px;text-align:center">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:38px;font-weight:900;color:#16a34a;line-height:1">${totalH}h${totalM ? totalM + "'" : ""}</div>
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:4px">Total hores</div>
          </div>
        </div>
        ${coachTrainings.length
          ? (() => {
              const pillCounts = {};
              coachTrainings.forEach(t => (t.pillars || []).forEach(p => { pillCounts[p] = (pillCounts[p] || 0) + 1; }));
              const topPillars = Object.entries(pillCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
              return topPillars.length
                ? `<div style="margin-top:14px"><div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px">Pilars més treballats</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      ${topPillars.map(([pid, cnt]) => {
                        const p = COACH_PILLARS.find(x => x.id === pid);
                        return p ? `<div style="display:flex;align-items:center;gap:5px;background:${p.color}15;border:1px solid ${p.color}40;border-radius:8px;padding:5px 10px"><span style="font-size:11px;font-weight:700;color:${p.color}">${p.label}</span><span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900;color:#1a2035">${cnt}×</span></div>` : "";
                      }).join("")}
                    </div></div>`
                : "";
            })()
          : ""}
      </div>

      <!-- New training form -->
      <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:14px">Nou entrenament</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <input type="date" id="coach-plan-date" value="${coachPlanningDate}" oninput="coachPlanningDate=this.value"
            style="padding:9px 11px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:13px;font-family:inherit;outline:none"/>
          <div style="display:flex;align-items:center;gap:6px">
            <input type="number" id="coach-plan-dur" value="${coachPlanningDuration}" min="15" max="240" step="15"
              oninput="coachPlanningDuration=Number(this.value)"
              style="width:70px;padding:9px 10px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:13px;font-family:inherit;outline:none;text-align:center"/>
            <span style="font-size:13px;color:#64748b">min</span>
          </div>
        </div>
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Pilars (màx. 4)</div>
        <div style="display:flex;flex-wrap:wrap;gap:0;margin-bottom:10px">${pillarCbs}</div>
        ${suggestHtml}
        <textarea id="coach-plan-notes" placeholder="Notes opcionals..." oninput="coachPlanningNotes=this.value"
          style="width:100%;padding:9px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:13px;font-family:inherit;resize:vertical;min-height:56px;outline:none;margin-top:10px;display:block">${_cesc(coachPlanningNotes)}</textarea>
        <button onclick="coachSaveTraining()" style="width:100%;background:#1a2035;border:none;color:#fff;font-weight:700;font-size:14px;padding:12px;border-radius:10px;cursor:pointer;margin-top:10px">+ Afegir entrenament</button>
        <div id="coach-plan-msg" style="font-size:12px;text-align:center;margin-top:6px;min-height:18px"></div>
      </div>
    </div>

    <!-- Historial -->
    <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px;margin-top:14px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">Historial d'entrenaments</div>
      ${listRows}
    </div>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   OBJECTIVES TAB
══════════════════════════════════════════════════════════════════════════ */
async function _renderObjectivesTab() {
  const team = _cteam("objectives");
  const club = _cclub("objectives");
  const category = _ccategory("objectives");
  const choice = _coachResolveTeamChoice("objectives");
  const teamIdentity = _coachTeamIdentityLabel(choice) || team;
  if (!team) {
    return `<div style="background:#fff;border:1.5px dashed #dbe3f0;border-radius:14px;padding:24px;text-align:center;color:#64748b;font-size:14px">Selecciona un equip per carregar jugadors i objectius.</div>`;
  }

  if (!coachPlayerObjsLoaded || coachPlayerObjsTeam !== teamIdentity || coachPlayerObjsClub !== club) {
    await _loadPlayerObjectives(teamIdentity, club);
  }

  const rosterNames = [...new Set((await _coachRosterForSelection(club, team, category)).map(p => p.name))].sort((a, b) => String(a).localeCompare(String(b)));
  const staleObjectivePlayers = Object.keys(coachPlayerObjs).filter(name => !rosterNames.some(r => _coachTeamEq(r, name)));
  const players = rosterNames;
  if (coachEditingPlayer && !players.some(name => _coachTeamEq(name, coachEditingPlayer))) {
    coachEditingPlayer = null;
  }
  const selectedPlayerName = String(coachEditingPlayer || "").trim();
  const playerSelectOptions = players.map(name =>
    `<option value="${_cesc(name)}" ${name === selectedPlayerName ? "selected" : ""}>${_cesc(name)}</option>`
  ).join("");

  /* Form — pre-fills from coachEditingPlayer if set */
  const editObj = coachEditingPlayer ? coachPlayerObjs[coachEditingPlayer] : null;
  const pillarInputs = COACH_PILLARS.map(p => {
    const d = editObj?.pillar_data?.[p.id] || {};
    return `<div style="background:#f8fafc;border-radius:10px;padding:10px">
      <div style="font-size:12px;font-weight:800;color:${p.color};margin-bottom:7px">${_cesc(p.label)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
        ${[["baseline", "Base", "#94a3b8"], ["target", "Objectiu", "#2563eb"], ["progress", "Progrés", "#16a34a"]].map(([k, lbl, col]) =>
          `<div>
            <div style="font-size:9px;color:${col};font-weight:700;text-transform:uppercase;margin-bottom:3px">${lbl}</div>
            <input type="number" min="0" max="10" step="0.5" id="coach-obj-${p.id}-${k}"
              value="${d[k] != null ? d[k] : ""}" placeholder="–"
              style="width:100%;padding:6px;border:1.5px solid #e2e6ef;border-radius:7px;font-size:13px;font-family:inherit;outline:none;text-align:center"/>
          </div>`
        ).join("")}
      </div>
    </div>`;
  }).join("");

  const addForm = `
    <div style="background:#fff;border-radius:14px;border:1.5px solid ${coachEditingPlayer ? "#2563eb" : "#e2e6ef"};padding:18px;margin-bottom:16px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">
        ${coachEditingPlayer ? `Editant: ${_cesc(coachEditingPlayer)}` : "Afegir / Editar jugador"}
      </div>
      <select id="coach-objective-player-select" onchange="coachPickObjectivePlayer(this.value)" style="width:100%;padding:10px 13px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;background:#fff">
        <option value="">Selecciona jugador trobat...</option>
        ${playerSelectOptions}
      </select>
      <div style="font-size:12px;color:#64748b;margin-bottom:12px">El nom del jugador no es pot entrar manualment. Selecciona'l des del desplegable.</div>
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Valors per pilar (0 – 10)</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-bottom:12px">${pillarInputs}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="coachSavePlayerObjective()" style="flex:1;background:#1a2035;border:none;color:#fff;font-weight:700;font-size:14px;padding:12px;border-radius:10px;cursor:pointer;min-width:140px">Desar objectius</button>
        ${coachEditingPlayer ? `<button onclick="coachClearEditingPlayer()" style="background:#f0f4f8;border:1.5px solid #e2e6ef;color:#334155;font-weight:600;font-size:13px;padding:12px 16px;border-radius:10px;cursor:pointer">Cancel·lar</button>` : ""}
      </div>
      <div id="coach-obj-msg" style="font-size:12px;margin-top:7px;min-height:18px"></div>
    </div>`;

  /* Player cards with spider chart */
  const legend = `<div style="display:flex;justify-content:flex-end;gap:12px;margin-bottom:10px;font-size:11px;color:#64748b">
    <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:14px;height:2px;background:#94a3b8;border-radius:1px"></span>Base</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:14px;height:2px;background:#2563eb;border-radius:1px"></span>Objectiu</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:14px;height:2px;background:#16a34a;border-radius:1px"></span>Progrés</span>
  </div>`;

  const cards = players.length
    ? `${legend}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
        ${players.map(name => {
          const obj = coachPlayerObjs[name];
          const svg = _spiderSVG({
            labels: COACH_PILLARS.map(p => p.short),
            datasets: [
              { data: COACH_PILLARS.map(p => Number(obj?.pillar_data?.[p.id]?.baseline || 0)) },
              { data: COACH_PILLARS.map(p => Number(obj?.pillar_data?.[p.id]?.target || 0)) },
              { data: COACH_PILLARS.map(p => Number(obj?.pillar_data?.[p.id]?.progress || 0)) },
            ],
          }, 210);
          /* Forecast: avg distance target→progress */
          const deltas = COACH_PILLARS.map(p => {
            const d = obj?.pillar_data?.[p.id] || {};
            return (d.target || 0) - (d.progress || 0);
          });
          const avgGap = (deltas.reduce((s, v) => s + v, 0) / deltas.length).toFixed(1);
          const gapColor = Number(avgGap) <= 0 ? "#16a34a" : Number(avgGap) < 1.5 ? "#d97706" : "#dc2626";
          const gapTxt   = Number(avgGap) <= 0 ? "✅ Objectius assolits!" : `${avgGap} pts de mitjana per assolir`;
          return `<div style="background:#fff;border:1.5px solid ${coachEditingPlayer === name ? "#2563eb" : "#e2e6ef"};border-radius:14px;padding:14px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div style="font-size:14px;font-weight:700;color:#1a2035">${_cesc(name)}</div>
              <div style="display:flex;gap:5px">
                <button onclick="coachEditPlayer('${_cesc(name)}')" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:7px;padding:4px 9px;font-size:11px;font-weight:700;cursor:pointer;color:#1d4ed8">Editar</button>
                <button onclick="coachDeletePlayerObj('${_cesc(name)}')" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:14px;padding:2px 4px">✕</button>
              </div>
            </div>
            <div style="display:flex;justify-content:center">${svg}</div>
            <div style="margin-top:8px;font-size:11px;font-weight:600;color:${gapColor};text-align:center">${gapTxt}</div>
          </div>`;
        }).join("")}
      </div>`
    : `<div style="background:#fff;border-radius:14px;border:1px dashed #e2e6ef;padding:28px;text-align:center;color:#94a3b8;font-size:13px">Afegeix jugadors amb el formulari per veure la seva evolució.</div>`;

  const categoryLabel = category
    ? ((typeof CAT_LABELS !== "undefined" && CAT_LABELS[category]) ? CAT_LABELS[category] : category)
    : "";
  const rosterHint = team
    ? `<div style="background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:9px 11px;margin-bottom:10px;font-size:12px;color:#475569">Jugadors carregats per l'equip seleccionat (${_cesc(teamIdentity || [club, team, categoryLabel].filter(Boolean).join(" "))}): <b style="color:#1a2035">${rosterNames.length}</b></div>`
    : "";

  const staleHint = staleObjectivePlayers.length
    ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:9px 11px;margin-bottom:10px;font-size:12px;color:#9a3412">S'han detectat <b>${staleObjectivePlayers.length}</b> objectius antics fora del roster actiu. Ja no es mostren a Objectius.</div>`
    : "";

  return rosterHint + staleHint + addForm + cards;
}

/* ══════════════════════════════════════════════════════════════════════════
   MATCH TAB
══════════════════════════════════════════════════════════════════════════ */
function _renderMatchTab() {
  const selectedTeam = _cteam("match");
  if (!selectedTeam) {
    return `<div style="background:#fff;border:1.5px dashed #dbe3f0;border-radius:14px;padding:24px;text-align:center;color:#64748b;font-size:14px">Selecciona un equip per preparar i gestionar el partit.</div>`;
  }

  const subTabs = [
    { key: "lineup",  label: "🧾 Pre-Partit" },
    { key: "live",    label: "⏱ En Viu" },
    { key: "tactics", label: "🗺 Tàctiques" },
  ];
  const subTabsHtml = `<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
    ${subTabs.map(t => {
      const on = coachMatchSubTab === t.key;
      return `<button onclick="coachSetMatchSubTab('${t.key}')" style="background:${on ? "#e5001c" : "#fff"};border:1.5px solid ${on ? "#e5001c" : "#e2e6ef"};color:${on ? "#fff" : "#334155"};font-weight:700;font-size:12px;padding:8px 15px;border-radius:999px;cursor:pointer">${_cesc(t.label)}</button>`;
    }).join("")}
  </div>`;

  let sub = "";
  if      (coachMatchSubTab === "lineup")  sub = _renderLineupTab();
  else if (coachMatchSubTab === "live")    sub = _renderLiveTab();
  else if (coachMatchSubTab === "tactics") sub = _renderTacticsTab();

  return subTabsHtml + sub;
}

/* ── Pre-Partit ─────────────────────────────────────────────────────────── */
function _renderLineupTab() {
  const { matchDate, opponent, isHome, players } = coachMatchState;
  const team = _cteam();
  const club = _cclub();
  const category = _ccategory();
  const convocatorias = _coachListTeamConvocatories(club, team, category);
  const upcomingMatches = _coachGetUpcomingMatches(club, team, category);
  const previousMatches = _coachGetPreviousMatches(club, team, category);
  if (coachSelectedUpcomingMatchKey && !upcomingMatches.some(m => _coachUpcomingMatchIdentity(m) === coachSelectedUpcomingMatchKey)) {
    coachSelectedUpcomingMatchKey = "";
  }
  const selectedUpcomingKey = coachSelectedUpcomingMatchKey || (upcomingMatches[0] ? _coachUpcomingMatchIdentity(upcomingMatches[0]) : "");
  if (coachSelectedPreviousMatchKey && !previousMatches.some(m => _coachUpcomingMatchIdentity(m) === coachSelectedPreviousMatchKey)) {
    coachSelectedPreviousMatchKey = "";
  }
  const selectedPreviousKey = coachSelectedPreviousMatchKey;
  if (coachSelectedConvocatoriaMatchKey && !convocatorias.some(c => _coachConvocatoriaMatchIdentity(c) === coachSelectedConvocatoriaMatchKey)) {
    coachSelectedConvocatoriaMatchKey = "";
  }
  const selectedConvocatoriaKey = coachSelectedConvocatoriaMatchKey || (convocatorias[0] ? _coachConvocatoriaMatchIdentity(convocatorias[0]) : "");
  const favoritePlayers = players.filter(p => String(p?.squad || "favorite") !== "rival");
  const rivalPlayers = players.filter(p => String(p?.squad || "favorite") === "rival");
  const starters = favoritePlayers.filter(p => p.isStarter);
  const byPos = pos => starters.filter(p => p.pos === pos).map(p => _cesc(p.name)).join(", ") || "—";

  const favoriteRows = favoritePlayers.map(p => {
    const i = players.findIndex(x => x === p);
    return `<tr style="border-bottom:1px solid #f0f4f8">
      <td style="padding:8px 8px;text-align:center;font-size:12px;font-weight:700;color:#334155">${_cesc(String(p.number || "—"))}</td>
      <td style="padding:8px 10px;font-size:13px;font-weight:600;color:#1a2035">${_cesc(p.name)}</td>
      <td style="padding:8px 6px;text-align:center">
        <button onclick="coachToggleStarter(${i})" style="background:${p.isStarter ? "#16a34a" : "#f0f4f8"};border:none;color:${p.isStarter ? "#fff" : "#94a3b8"};border-radius:6px;padding:4px 9px;font-size:10px;font-weight:700;cursor:pointer">${p.isStarter ? "TITULAR" : "SUPLENT"}</button>
      </td>
      <td style="padding:8px 6px;text-align:center">
        <select onchange="coachSetPlayerSide(${i},this.value)" style="padding:4px 6px;border:1.5px solid #e2e6ef;border-radius:6px;font-size:12px;font-family:inherit;background:#fff">
          <option value="D" ${p.side === "D" ? "selected" : ""}>Dreta</option>
          <option value="E" ${p.side === "E" ? "selected" : ""}>Esquerra</option>
        </select>
      </td>
      <td style="padding:8px 6px;text-align:center">
        <select onchange="coachSetPlayerPos(${i},this.value)" style="padding:4px 6px;border:1.5px solid #e2e6ef;border-radius:6px;font-size:12px;font-family:inherit;background:#fff">
          ${["PORT","DEF","MIG","DAV"].map(v => `<option value="${v}" ${p.pos === v ? "selected" : ""}>${v}</option>`).join("")}
        </select>
      </td>
      <td style="padding:8px 6px;text-align:center">
        <button onclick="coachRemovePlayer(${i})" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:14px;line-height:1">✕</button>
      </td>
    </tr>`;
  }).join("");

  const rivalRows = rivalPlayers.map(p => {
    const i = players.findIndex(x => x === p);
    return `<tr style="border-bottom:1px solid #f0f4f8">
      <td style="padding:8px 8px;text-align:center;font-size:12px;font-weight:700;color:#334155">${_cesc(String(p.number || "—"))}</td>
      <td style="padding:8px 10px;font-size:13px;font-weight:600;color:#1a2035">${_cesc(p.name)}</td>
      <td style="padding:8px 6px;text-align:center">
        <button onclick="coachToggleStarter(${i})" style="background:${p.isStarter ? "#16a34a" : "#f0f4f8"};border:none;color:${p.isStarter ? "#fff" : "#94a3b8"};border-radius:6px;padding:4px 9px;font-size:10px;font-weight:700;cursor:pointer">${p.isStarter ? "ACTIU" : "BANQUETA"}</button>
      </td>
      <td style="padding:8px 6px;text-align:center">
        <select onchange="coachSetPlayerPos(${i},this.value)" style="padding:4px 6px;border:1.5px solid #e2e6ef;border-radius:6px;font-size:12px;font-family:inherit;background:#fff">
          ${["PORT","DEF","MIG","DAV"].map(v => `<option value="${v}" ${p.pos === v ? "selected" : ""}>${v}</option>`).join("")}
        </select>
      </td>
      <td style="padding:8px 6px;text-align:center">
        <button onclick="coachRemovePlayer(${i})" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:14px;line-height:1">✕</button>
      </td>
    </tr>`;
  }).join("");

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">

      <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">Info del Partit</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="grid-column:1/-1">
            <div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:4px">Partits futurs (equip favorit)</div>
            <select onchange="coachSelectUpcomingMatch(this.value)" style="width:100%;padding:9px 10px;border:1.5px solid #dbe3f0;border-radius:9px;font-size:12px;font-family:inherit;background:#fff">
              ${upcomingMatches.length
                ? upcomingMatches.map(m => {
                    const key = _coachUpcomingMatchIdentity(m);
                    const selected = key === selectedUpcomingKey;
                    return `<option value="${_cesc(key)}" ${selected ? "selected" : ""}>${_cesc(_coachUpcomingMatchLabel(m))}</option>`;
                  }).join("")
                : `<option value="">No hi ha partits futurs disponibles</option>`}
            </select>
          </div>
          ${previousMatches.length ? `
          <div style="grid-column:1/-1">
            <div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:4px">Partits del passat (equip favorit)</div>
            <select onchange="coachSelectPreviousMatch(this.value)" style="width:100%;padding:9px 10px;border:1.5px solid #dbe3f0;border-radius:9px;font-size:12px;font-family:inherit;background:#fff">
              <option value="">-- Selecciona un partit --</option>
              ${previousMatches.map(m => {
                  const key = _coachUpcomingMatchIdentity(m);
                  const sel = key === selectedPreviousKey;
                  return `<option value="${_cesc(key)}" ${sel ? "selected" : ""}>${_cesc(_coachUpcomingMatchLabel(m))}</option>`;
                }).join("")}
            </select>
          </div>
          ` : ""}
          <div>
            <div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:4px">Data</div>
            <input type="date" value="${matchDate}" onchange="coachMatchState.matchDate=this.value;_coachSyncLinkedMatchFromState()"
              style="width:100%;padding:9px 10px;border:1.5px solid #e2e6ef;border-radius:9px;font-size:13px;font-family:inherit;outline:none"/>
          </div>
          <div>
            <div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:4px">Rival</div>
            <input type="text" value="${_cesc(opponent)}" placeholder="Nom rival..."
              onchange="coachMatchState.opponent=this.value;_coachSyncLinkedMatchFromState()"
              style="width:100%;padding:9px 10px;border:1.5px solid #e2e6ef;border-radius:9px;font-size:13px;font-family:inherit;outline:none"/>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <button onclick="coachMatchState.isHome=true;renderCoachPanel()" style="flex:1;background:${isHome ? "#1a2035" : "#f8fafc"};border:1.5px solid ${isHome ? "#1a2035" : "#e2e6ef"};color:${isHome ? "#fff" : "#64748b"};font-weight:700;font-size:13px;padding:10px;border-radius:10px;cursor:pointer">🏠 Casa</button>
          <button onclick="coachMatchState.isHome=false;renderCoachPanel()" style="flex:1;background:${!isHome ? "#1a2035" : "#f8fafc"};border:1.5px solid ${!isHome ? "#1a2035" : "#e2e6ef"};color:${!isHome ? "#fff" : "#64748b"};font-weight:700;font-size:13px;padding:10px;border-radius:10px;cursor:pointer">✈️ Fora</button>
        </div>
        <div style="background:#f8fafc;border-radius:10px;padding:11px 13px;font-size:12px;color:#334155;line-height:2">
          <div>🥅 <b>PORT:</b> ${byPos("PORT")}</div>
          <div>🛡️ <b>DEF:</b> ${byPos("DEF")}</div>
          <div>⚡ <b>MIG:</b> ${byPos("MIG")}</div>
          <div>⚽ <b>DAV:</b> ${byPos("DAV")}</div>
        </div>
      </div>

      <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">Equip favorit</div>
        <div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:4px">Convocatòria de l'equip seleccionat</div>
        <select onchange="coachSetLineupConvocatoriaMatch(this.value)" style="width:100%;padding:9px 10px;border:1.5px solid #dbe3f0;border-radius:9px;font-size:12px;font-family:inherit;background:#fff;margin-bottom:8px">
          ${convocatorias.length
            ? convocatorias.map(conv => {
                const key = _coachConvocatoriaMatchIdentity(conv);
                const selected = key === selectedConvocatoriaKey;
                return `<option value="${_cesc(key)}" ${selected ? "selected" : ""}>${_cesc(_coachConvocatoriaOptionLabel(conv))}</option>`;
              }).join("")
            : `<option value="">No hi ha convocatòries disponibles</option>`}
        </select>
        <button onclick="coachLoadLineupFromSelectedConvocatoria()" ${convocatorias.length ? "" : "disabled"} style="width:100%;background:${convocatorias.length ? "#eef2ff" : "#f1f5f9"};border:1px solid ${convocatorias.length ? "#c7d2fe" : "#e2e8f0"};color:${convocatorias.length ? "#3730a3" : "#94a3b8"};font-weight:700;font-size:12px;padding:9px;border-radius:10px;cursor:${convocatorias.length ? "pointer" : "not-allowed"};margin-bottom:8px">Carregar jugadors (${_cesc(club || "club")}${team ? ` · ${_cesc(team)}` : ""})</button>
        <div style="font-size:12px;color:#64748b;line-height:1.45;margin-bottom:10px">Blocs separats per evitar confusions: favorit i rival.</div>
        <input id="coach-add-number" type="text" placeholder="Dorsal (opcional)..."
          style="width:100%;padding:10px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none;margin-bottom:8px"/>
        <input id="coach-add-name" type="text" placeholder="Nom del jugador..."
          style="width:100%;padding:10px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none;margin-bottom:8px"/>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <select id="coach-add-side" style="padding:9px;border:1.5px solid #e2e6ef;border-radius:9px;font-size:13px;font-family:inherit;background:#fff">
            <option value="D">Mà dreta</option>
            <option value="E">Mà esquerra</option>
          </select>
          <select id="coach-add-pos" style="padding:9px;border:1.5px solid #e2e6ef;border-radius:9px;font-size:13px;font-family:inherit;background:#fff">
            <option value="MIG">MIG</option>
            <option value="DEF">DEF</option>
            <option value="DAV">DAV</option>
            <option value="PORT">PORT</option>
          </select>
        </div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#334155;margin-bottom:12px">
          <input type="checkbox" id="coach-add-starter" checked/> Titular
        </label>
        <button onclick="coachAddPlayerToLineup()" style="width:100%;background:#0891b2;border:none;color:#fff;font-weight:700;font-size:14px;padding:11px;border-radius:10px;cursor:pointer">+ Afegir a la plantilla</button>
      </div>

      <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">Equip rival</div>
        <input id="coach-rival-number" type="text" placeholder="Dorsal rival (obligatori)..."
          style="width:100%;padding:10px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none;margin-bottom:8px"/>
        <input id="coach-rival-name" type="text" placeholder="Nom rival (opcional)..."
          style="width:100%;padding:10px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none;margin-bottom:8px"/>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <select id="coach-rival-side" style="padding:9px;border:1.5px solid #e2e6ef;border-radius:9px;font-size:13px;font-family:inherit;background:#fff">
            <option value="D">Mà dreta</option>
            <option value="E">Mà esquerra</option>
          </select>
          <select id="coach-rival-pos" style="padding:9px;border:1.5px solid #e2e6ef;border-radius:9px;font-size:13px;font-family:inherit;background:#fff">
            <option value="MIG">MIG</option>
            <option value="DEF">DEF</option>
            <option value="DAV">DAV</option>
            <option value="PORT">PORT</option>
          </select>
        </div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#334155;margin-bottom:12px">
          <input type="checkbox" id="coach-rival-starter" checked/> Actiu a l'inici
        </label>
        <button onclick="coachAddRivalPlayer()" style="width:100%;background:#334155;border:none;color:#fff;font-weight:700;font-size:14px;padding:11px;border-radius:10px;cursor:pointer">+ Afegir rival</button>
      </div>
    </div>

    ${favoritePlayers.length ? `
    <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px;margin-top:14px;overflow-x:auto">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:10px">Equip favorit — ${favoritePlayers.length} jugadors · ${starters.length} titulars</div>
      <table style="width:100%;border-collapse:collapse;min-width:380px">
        <thead><tr style="border-bottom:2px solid #e2e6ef">
          <th style="padding:8px;text-align:center;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">#</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Jugador</th>
          <th style="padding:8px;text-align:center;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Estat</th>
          <th style="padding:8px;text-align:center;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Mà</th>
          <th style="padding:8px;text-align:center;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Pos</th>
          <th style="padding:8px;"></th>
        </tr></thead>
        <tbody>${favoriteRows}</tbody>
      </table>
    </div>` : ""}

    ${rivalPlayers.length ? `
    <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px;margin-top:14px;overflow-x:auto">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:10px">Equip rival — ${rivalPlayers.length} jugadors</div>
      <table style="width:100%;border-collapse:collapse;min-width:380px">
        <thead><tr style="border-bottom:2px solid #e2e6ef">
          <th style="padding:8px;text-align:center;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">#</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Jugador</th>
          <th style="padding:8px;text-align:center;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Estat</th>
          <th style="padding:8px;text-align:center;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Pos</th>
          <th style="padding:8px;"></th>
        </tr></thead>
        <tbody>${rivalRows}</tbody>
      </table>
    </div>` : ""}`;
}

/* ── Tàctiques ──────────────────────────────────────────────────────────── */
function _renderTacticsTab() {
  _coachEnsureBoardState();
  return `<div id="coach-tactics-root">${_renderTacticsPanelInner()}</div>`;
}

function _renderTacticsPanelInner() {
  _coachEnsureBoardState();
  const tactic = COACH_TACTICS[coachTacticIdx];
  const activeTool = _coachToolMeta(coachBoardState.tool);
  const ballMode = coachBoardState.ballMode === "free" ? "free" : "attached";
  const savedPlays = _coachActiveSavedPlays();
  const isFullscreen = Boolean(coachBoardState.fullscreen);
  const formationsCollapsed = Boolean(isFullscreen && coachBoardFullscreenFormationsCollapsed);
  const mobileWarning = _coachIsPhoneLikeScreen()
    ? `<div style="background:#fff7ed;border:1px solid #fdba74;color:#9a3412;border-radius:12px;padding:11px 12px;font-size:12px;font-weight:700;line-height:1.4;margin-bottom:10px">Aquesta funció està pensada per pantalla horitzontal i més gran (tablet o ordinador). En mòbil pot no ser prou fluida ni precisa.</div>`
    : "";

  const tacBtns = COACH_TACTICS.map((t, i) =>
    `<button onclick="coachSetTactic(${i})" style="background:${i === coachTacticIdx ? "#1a2035" : "#fff"};border:1.5px solid ${i === coachTacticIdx ? "#1a2035" : "#e2e6ef"};color:${i === coachTacticIdx ? "#fff" : "#334155"};font-weight:600;font-size:12px;padding:9px 13px;border-radius:10px;cursor:pointer;text-align:left;width:100%">
      <div style="font-weight:700">${_cesc(t.name)}</div>
      <div style="font-size:10px;opacity:.65;margin-top:2px;line-height:1.3">${_cesc(t.desc)}</div>
    </button>`
  ).join("");

  const toolButtons = COACH_TACTIC_TOOLS.map(tool => {
    const on = coachBoardState.tool === tool.id;
    return `<button onclick="coachSetBoardTool('${tool.id}')" style="display:inline-flex;align-items:center;gap:7px;background:${on ? tool.color : "#fff"};border:1.5px solid ${on ? tool.color : "#dbe3f0"};color:${on ? "#fff" : "#334155"};font-weight:800;font-size:14px;padding:10px 14px;border-radius:12px;cursor:pointer;min-height:44px"><span style="font-size:16px;line-height:1">${_cesc(tool.icon || "")}</span><span>${_cesc(tool.label)}</span></button>`;
  }).join("");

  const savedRows = savedPlays.length
    ? savedPlays.map(play => `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border:1px solid #e2e6ef;border-radius:10px;background:#fff">
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:700;color:#1a2035;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_cesc(play.name || "Jugada")}</div>
          <div style="font-size:10px;color:#64748b">${_cesc(play.tacticName || "")}${play.frames?.length ? ` · ${play.frames.length} frames` : ""}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button onclick="coachLoadSavedPlay('${_cesc(play.id)}')" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-weight:700;font-size:10px;padding:6px 8px;border-radius:8px;cursor:pointer">Carregar</button>
          <button onclick="coachPlaySavedPlay('${_cesc(play.id)}')" style="background:#ecfeff;border:1px solid #a5f3fc;color:#0f766e;font-weight:700;font-size:10px;padding:6px 8px;border-radius:8px;cursor:pointer">Reproduir</button>
          <button onclick="coachDeleteSavedPlay('${_cesc(play.id)}')" style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-weight:700;font-size:10px;padding:6px 8px;border-radius:8px;cursor:pointer">✕</button>
        </div>
      </div>`).join("")
    : `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:12px;border:1px dashed #dbe3f0;border-radius:10px">Encara no hi ha jugades guardades per a aquest equip.</div>`;

  const boardCard = _renderInteractiveBoardCard(Boolean(coachBoardState.fullscreen));
  const recordingBadge = coachBoardState.recording
    ? `<span style="display:inline-flex;align-items:center;gap:6px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-weight:700;font-size:11px;padding:5px 9px;border-radius:999px">● Gravació ${coachBoardState.recordingFrames.length ? `(${coachBoardState.recordingFrames.length})` : ""}</span>`
    : "";

  const controlsPanel = `
      <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px;overflow:auto">
        ${mobileWarning}
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em">Formacions base</div>
          ${isFullscreen ? `<button onclick="coachToggleFullscreenFormationsCollapsed()" style="background:#f8fafc;border:1px solid #e2e6ef;color:#475569;font-weight:800;font-size:12px;padding:7px 10px;border-radius:999px;cursor:pointer">${formationsCollapsed ? "▾" : "▴"}</button>` : ""}
        </div>
        <div style="display:${formationsCollapsed ? "none" : "flex"};flex-direction:column;gap:7px;margin-bottom:16px">${tacBtns}</div>
        <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Eines habituals</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">${toolButtons}</div>
        <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Gestió de la bola</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <button onclick="coachToggleBallMode('attached')" style="background:${ballMode === "attached" ? "#0f766e" : "#fff"};border:1.5px solid ${ballMode === "attached" ? "#0f766e" : "#99f6e4"};color:${ballMode === "attached" ? "#fff" : "#0f766e"};font-weight:800;font-size:13px;padding:9px 12px;border-radius:11px;cursor:pointer;min-height:42px">🔗 Enganxada a jugador</button>
          <button onclick="coachToggleBallMode('free')" style="background:${ballMode === "free" ? "#1d4ed8" : "#fff"};border:1.5px solid ${ballMode === "free" ? "#1d4ed8" : "#bfdbfe"};color:${ballMode === "free" ? "#fff" : "#1d4ed8"};font-weight:800;font-size:13px;padding:9px 12px;border-radius:11px;cursor:pointer;min-height:42px">⚪ Bola lliure</button>
        </div>
        <div style="font-size:12px;color:${activeTool.color};font-weight:700;margin-bottom:10px">${_cesc(activeTool.hint)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <button onclick="coachAddBoardPlayer('home')" style="background:#fee2e2;border:1px solid #fecaca;color:#b91c1c;font-weight:800;font-size:13px;padding:10px 12px;border-radius:10px;cursor:pointer">+ Jugador local</button>
          <button onclick="coachAddBoardPlayer('away')" style="background:#e2e8f0;border:1px solid #cbd5e1;color:#334155;font-weight:800;font-size:13px;padding:10px 12px;border-radius:10px;cursor:pointer">+ Jugador rival</button>
          <button onclick="coachResetBoard()" style="background:#f8fafc;border:1px solid #e2e6ef;color:#475569;font-weight:800;font-size:13px;padding:10px 12px;border-radius:10px;cursor:pointer">Reset formació</button>
          <button onclick="coachClearBoardActions()" style="background:#f8fafc;border:1px solid #e2e6ef;color:#475569;font-weight:800;font-size:13px;padding:10px 12px;border-radius:10px;cursor:pointer">Netejar accions</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
          <button onclick="coachToggleBoardRecording()" style="background:${coachBoardState.recording ? "#b91c1c" : "#fff"};border:1.5px solid ${coachBoardState.recording ? "#b91c1c" : "#fecaca"};color:${coachBoardState.recording ? "#fff" : "#b91c1c"};font-weight:800;font-size:12px;padding:8px 11px;border-radius:999px;cursor:pointer">${coachBoardState.recording ? "Aturar gravació" : "Gravar jugada"}</button>
          <button onclick="coachSaveBoardPlay()" style="background:#1a2035;border:none;color:#fff;font-weight:800;font-size:12px;padding:8px 11px;border-radius:999px;cursor:pointer">Guardar com a jugada</button>
          ${recordingBadge}
        </div>
        <div style="font-size:11px;color:#64748b;line-height:1.5;background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:10px">
          Opcions comunes afegides: moviment de jugadors, passades, xuts, conduccions, bloquejos, zones, jugadors rivals, gravació seqüencial i reproducció de jugades.
        </div>
      </div>`;

  if (isFullscreen) {
    return `
      <div style="position:fixed;inset:0;z-index:480;background:rgba(15,23,42,.78);padding:14px;display:flex;align-items:stretch;justify-content:center">
        <div style="width:min(1500px,100%);height:100%;display:grid;grid-template-columns:minmax(250px,20%) minmax(0,80%);gap:12px;align-items:stretch">
          ${controlsPanel}
          <div style="min-height:0;display:flex;flex-direction:column;gap:10px">${boardCard}</div>
        </div>
      </div>`;
  }

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
      ${controlsPanel}
      <div style="display:flex;flex-direction:column;gap:14px">
        ${boardCard}
        <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap">
            <div>
              <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em">Biblioteca de jugades</div>
              <div style="font-size:12px;color:#64748b">${savedPlays.length} jugades guardades per a ${_cesc(_cteam() || "aquest equip")}</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">${savedRows}</div>
        </div>
      </div>
    </div>`;
}

function _renderInteractiveBoardCard(isFullscreen) {
  const tactic = COACH_TACTICS[coachTacticIdx];
  const msg = coachTacticsMsg || (coachBoardState.pendingAction
    ? `Pendent: ${_coachToolMeta(coachBoardState.pendingAction.tool).label}. Tria el punt final.`
    : coachBoardState.selectedEntity
      ? "Jugador seleccionat. Toca el camp per moure'l."
      : _coachToolMeta(coachBoardState.tool).hint);

  const inner = `
    <div style="background:#fff;border-radius:18px;border:1.5px solid #e2e6ef;padding:${isFullscreen ? "18px 18px 12px" : "18px"};height:100%;box-shadow:${isFullscreen ? "0 20px 60px rgba(15,23,42,.28)" : "none"}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px">
        <div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:${isFullscreen ? "22px" : "17px"};font-weight:900;color:#1a2035;margin-bottom:4px">${_cesc(tactic.name)}</div>
          <div style="font-size:${isFullscreen ? "13px" : "12px"};color:#64748b;max-width:700px">${_cesc(tactic.desc)}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="coachToggleBoardFullscreen()" style="background:#1a2035;border:none;color:#fff;font-weight:800;font-size:12px;padding:9px 12px;border-radius:10px;cursor:pointer">${isFullscreen ? "Tornar a mida normal" : "Pantalla completa"}</button>
        </div>
      </div>
      <div style="font-size:12px;color:${_coachToolMeta(coachBoardState.tool).color};font-weight:700;margin-bottom:10px">${_cesc(msg)}</div>
      <div style="background:linear-gradient(180deg,#dbeafe 0%,#eff6ff 100%);border-radius:16px;padding:${isFullscreen ? "10px" : "10px"};border:1px solid #bfdbfe;min-height:${isFullscreen ? "calc(100vh - 130px)" : "320px"};height:${isFullscreen ? "100%" : "auto"};display:flex;align-items:center;justify-content:center">
        ${_tacticSVGInteractive(isFullscreen)}
      </div>
    </div>`;

  return `<div style="height:100%">${inner}</div>`;
}

/* ── En Viu ─────────────────────────────────────────────────────────────── */
const _EVT_TYPES = [
  { type: "goal",      label: "⚽ Gol",          color: "#e5001c" },
  { type: "shot",      label: "🎯 Tir",           color: "#0891b2" },
  { type: "assist",    label: "🤝 Assistència",   color: "#7c3aed" },
  { type: "1v1_won",   label: "✅ 1vs1 Guanyat",  color: "#16a34a" },
  { type: "1v1_lost",  label: "❌ 1vs1 Perdut",   color: "#dc2626" },
  { type: "ball_gain", label: "🔵 Recuperació",   color: "#2563eb" },
  { type: "ball_loss", label: "🔴 Pèrdua",        color: "#f59e0b" },
  { type: "gk_save_screen",    label: "🧤 Parada pantalla",      color: "#0f766e" },
  { type: "gk_save_fence_pass",label: "🧤 Parada pas de tanca",  color: "#0284c7" },
  { type: "gk_save_other",     label: "🧤 Parada altres",        color: "#475569" },
  { type: "gk_1v1_saved",      label: "🧤 1x1 parat",            color: "#16a34a" },
  { type: "gk_1v1_lost",       label: "🥅 1x1 perdut",           color: "#dc2626" },
];

const _GOALIE_EVT_TYPES = [
  { type: "gk_save_screen",     label: "Parada pantalla",     color: "#0f766e" },
  { type: "gk_save_fence_pass", label: "Parada pas de tanca", color: "#0284c7" },
  { type: "gk_save_other",      label: "Parada altres",       color: "#475569" },
  { type: "gk_1v1_saved",       label: "1x1 parat",           color: "#16a34a" },
  { type: "gk_1v1_lost",        label: "1x1 perdut",          color: "#dc2626" },
];

const _FIELD_EVT_TYPES = [
  { type: "goal",      label: "⚽ Gol",         color: "#e5001c" },
  { type: "shot",      label: "🎯 Tir",          color: "#0891b2" },
  { type: "assist",    label: "🤝 Assistència",  color: "#7c3aed" },
  { type: "1v1_won",   label: "✅ 1vs1 Guanyat", color: "#16a34a" },
  { type: "1v1_lost",  label: "❌ 1vs1 Perdut",  color: "#dc2626" },
  { type: "ball_gain", label: "🔵 Recuperació",  color: "#2563eb" },
  { type: "ball_loss", label: "🔴 Pèrdua",       color: "#f59e0b" },
];

function _renderLiveTab() {
  const { players, events, opponent } = coachMatchState;
  _coachSyncLinkedMatchFromState();
  const starters = players.filter(p => p.isStarter);
  const activePlayers = starters.length > 0 ? starters : players;
  const favoriteActivePlayers = activePlayers.filter(p => String(p?.squad || "favorite") !== "rival");
  const rivalActivePlayers = activePlayers.filter(p => String(p?.squad || "favorite") === "rival");

  /* Per-player stats */
  const pStats = {};
  for (const e of events) {
    if (!pStats[e.player]) pStats[e.player] = {};
    pStats[e.player][e.type] = (pStats[e.player][e.type] || 0) + 1;
  }

  const totalGoals = events.filter(e => e.type === "goal").length;
  const totalShots = events.filter(e => e.type === "shot").length;
  const won1v1 = events.filter(e => e.type === "1v1_won").length;
  const tot1v1 = events.filter(e => e.type === "1v1_lost").length + won1v1;
  const topByAct = Object.entries(pStats)
    .sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0))[0]?.[0] || null;

  const recentEvts = [...events].reverse().slice(0, 12);
  const evtLog = recentEvts.length
    ? recentEvts.map((e, ri) => {
        const et = _EVT_TYPES.find(t => t.type === e.type);
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f4f8">
          <span style="background:${et?.color || "#94a3b8"}18;color:${et?.color || "#94a3b8"};border-radius:5px;padding:3px 7px;font-size:10px;font-weight:700;white-space:nowrap">${et?.label || e.type}</span>
          <span style="font-size:12px;font-weight:600;color:#1a2035;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_cesc(e.player)}</span>
          <button onclick="coachRemoveEvent(${events.length - 1 - ri})" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:12px;flex-shrink:0">✕</button>
        </div>`;
      }).join("")
    : `<div style="padding:14px;text-align:center;color:#94a3b8;font-size:12px">Cap acció registrada.</div>`;

  const playerButtonsByGroup = (groupPlayers, title, accent) => {
    if (!groupPlayers.length) {
      return `<div style="background:#fff;border:1px dashed #dbe3f0;border-radius:12px;padding:14px;color:#94a3b8;font-size:12px">No hi ha jugadors actius a ${_cesc(title)}.</div>`;
    }

    const cards = groupPlayers.map(p => {
    const s = pStats[p.name] || {};
    const isGoalie = String(p.pos || "").toUpperCase() === "PORT";
    const eventButtons = isGoalie ? _GOALIE_EVT_TYPES : _FIELD_EVT_TYPES;
    const g   = s.goal || 0;
    const w   = s["1v1_won"] || 0;
    const l   = s["1v1_lost"] || 0;
    const gl  = s.ball_gain || 0;
    const bll = s.ball_loss || 0;
    const gkScreen = s.gk_save_screen || 0;
    const gkFence = s.gk_save_fence_pass || 0;
    const gkOther = s.gk_save_other || 0;
    const gk1v1S = s.gk_1v1_saved || 0;
    const gk1v1L = s.gk_1v1_lost || 0;
    return `<div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px">
      <div style="font-size:12px;font-weight:700;color:#1a2035;margin-bottom:7px;display:flex;justify-content:space-between">
        <span>${_cesc(p.name)}${p.number ? ` · #${_cesc(p.number)}` : ""}</span>
        <span style="font-size:10px;color:#94a3b8;font-weight:600">${p.pos || ""}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(${isGoalie ? 2 : 4},1fr);gap:3px;margin-bottom:3px">
        ${eventButtons.slice(0, isGoalie ? 3 : 4).map(et =>
          `<button onclick="coachAddEvent('${_cesc(p.name)}','${et.type}')"
            style="background:${et.color}12;border:1px solid ${et.color}35;color:${et.color};font-size:9px;font-weight:700;padding:6px 2px;border-radius:7px;cursor:pointer;line-height:1.3;text-align:center">${et.label}</button>`
        ).join("")}
      </div>
      <div style="display:grid;grid-template-columns:repeat(${isGoalie ? 2 : 3},1fr);gap:3px;margin-bottom:8px">
        ${eventButtons.slice(isGoalie ? 3 : 4).map(et =>
          `<button onclick="coachAddEvent('${_cesc(p.name)}','${et.type}')"
            style="background:${et.color}12;border:1px solid ${et.color}35;color:${et.color};font-size:9px;font-weight:700;padding:6px 2px;border-radius:7px;cursor:pointer;line-height:1.3;text-align:center">${et.label}</button>`
        ).join("")}
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${isGoalie
          ? `${(gkScreen || gkFence || gkOther) ? `<span style="background:#ecfeff;color:#0f766e;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:700">Parades ${gkScreen + gkFence + gkOther}</span>` : ""}
             ${(gk1v1S || gk1v1L) ? `<span style="background:#f0fdf4;color:#16a34a;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:700">1x1 ${gk1v1S}/${gk1v1S + gk1v1L}</span>` : ""}`
          : `${g ? `<span style="background:#fef2f2;color:#e5001c;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:700">⚽ ${g}</span>` : ""}
             ${(w || l) ? `<span style="background:#f0fdf4;color:#16a34a;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:700">1v1 ${w}/${w + l}</span>` : ""}
             ${(gl || bll) ? `<span style="background:#eff6ff;color:#2563eb;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:700">±${gl}/${bll}</span>` : ""}`}
      </div>
    </div>`;
    }).join("");

    return `<div style="margin-bottom:12px">
      <div style="display:inline-flex;align-items:center;gap:6px;background:${accent};color:#1a2035;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800;margin-bottom:8px">${_cesc(title)} · ${groupPlayers.length}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px">${cards}</div>
    </div>`;
  };

  const playerBtns = playerButtonsByGroup(favoriteActivePlayers, "Equip favorit", "#fee2e2")
    + playerButtonsByGroup(rivalActivePlayers, "Equip rival", "#e2e8f0");

  const linkedMatchCard = `<div style="background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:10px 12px;font-size:12px;color:#334155;line-height:1.5;margin-bottom:10px">
    <div style="font-weight:800;color:#1a2035;margin-bottom:4px">Partit vinculat a les accions</div>
    <div>${_cesc(coachMatchState.linkedMatchLabel || "Sense partit vinculat")}</div>
    <div style="font-size:11px;color:#64748b;margin-top:4px">ID: ${_cesc(coachMatchState.linkedMatchId || "—")}</div>
  </div>`;

  const liveInner = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;margin-bottom:14px">
      <!-- Summary -->
      <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">
          Directe ${opponent ? `vs ${_cesc(opponent)}` : ""}
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px">
          ${[["⚽", totalGoals, "Gols", "#e5001c"], ["🎯", totalShots, "Tirs", "#0891b2"],
             ["✅", tot1v1 ? `${won1v1}/${tot1v1}` : "0/0", "1vs1", "#16a34a"],
             ["📋", events.length, "Accions", "#7c3aed"]].map(([ic, v, l, c]) =>
            `<div style="background:${c}10;border-radius:10px;padding:12px;text-align:center">
              <div style="font-size:18px;margin-bottom:2px">${ic}</div>
              <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:900;color:${c};line-height:1">${v}</div>
              <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:3px">${l}</div>
            </div>`
          ).join("")}
        </div>
        ${topByAct ? `<div style="background:#fefce8;border:1px solid #fef08a;border-radius:10px;padding:10px;font-size:13px;margin-bottom:12px">🏆 <b>Més actiu:</b> ${_cesc(topByAct)}</div>` : ""}
        ${linkedMatchCard}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="coachSaveMatchEvents()" style="flex:1;background:#1a2035;border:none;color:#fff;font-weight:700;font-size:13px;padding:11px;border-radius:10px;cursor:pointer">💾 Desar dades</button>
          <button onclick="coachToggleLiveFullscreen()" style="background:#0f172a;border:none;color:#fff;font-weight:700;font-size:13px;padding:11px 13px;border-radius:10px;cursor:pointer">${coachLiveFullscreen ? "Sortir pantalla completa" : "Pantalla completa"}</button>
        </div>
        <div id="coach-match-msg" style="font-size:12px;color:#64748b;text-align:center;margin-top:6px;min-height:16px"></div>
      </div>

      <!-- Event log -->
      <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:10px">Últimes accions</div>
        ${evtLog}
      </div>
    </div>

    <!-- Player buttons grid -->
    <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">Captura d'accions</div>
      ${activePlayers.length
        ? `${playerBtns}`
        : `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px">Afegeix jugadors a la plantilla (Pre-Partit) per registrar accions.</div>`}
    </div>`;

  if (!coachLiveFullscreen) return liveInner;
  return `<div style="position:fixed;inset:0;z-index:490;background:rgba(15,23,42,.78);padding:14px;overflow:auto">
    <div style="max-width:1500px;margin:0 auto;background:#fff;border-radius:16px;padding:14px">${liveInner}</div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   SVG HELPERS
══════════════════════════════════════════════════════════════════════════ */

/** Spider / radar chart — pure SVG, no external libraries */
function _spiderSVG(data, size) {
  const n   = data.labels.length;
  const cx  = size / 2, cy = size / 2;
  const r   = size * 0.32;
  const max = 10;
  const ang = i => (i / n) * 2 * Math.PI - Math.PI / 2;
  const pt  = (i, val) => {
    const a = ang(i), d = (Math.min(Math.max(val, 0), max) / max) * r;
    return [cx + d * Math.cos(a), cy + d * Math.sin(a)];
  };

  /* Grid rings */
  let grid = "";
  for (let g = 1; g <= 5; g++) {
    const gr  = (g / 5) * r;
    const pts = data.labels.map((_, i) => { const a = ang(i); return `${cx + gr * Math.cos(a)},${cy + gr * Math.sin(a)}`; }).join(" ");
    grid += `<polygon points="${pts}" fill="${g === 5 ? "#f0f4f8" : "none"}" stroke="#e2e6ef" stroke-width="0.8"/>`;
  }

  /* Axes + labels */
  const axes = data.labels.map((lbl, i) => {
    const a = ang(i);
    return `<line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(a)}" y2="${cy + r * Math.sin(a)}" stroke="#cbd5e1" stroke-width="0.8"/>
      <text x="${cx + (r + 15) * Math.cos(a)}" y="${cy + (r + 15) * Math.sin(a)}" text-anchor="middle" dominant-baseline="middle" font-size="8.5" fill="#64748b" font-family="'Barlow Condensed',sans-serif" font-weight="700">${lbl}</text>`;
  }).join("");

  /* Datasets */
  const dsCfg = [
    { stroke: "#94a3b8", fill: "rgba(148,163,184,0.18)", sw: 1.5 },
    { stroke: "#2563eb", fill: "rgba(37,99,235,0.08)",   sw: 1.5 },
    { stroke: "#16a34a", fill: "rgba(22,163,74,0.22)",   sw: 2   },
  ];
  const polys = data.datasets.map((ds, di) => {
    if (!ds.data.some(v => v > 0)) return "";
    const pts = ds.data.map((v, i) => pt(i, v).join(",")).join(" ");
    const c   = dsCfg[di] || dsCfg[0];
    return `<polygon points="${pts}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="${c.sw}"/>`;
  }).join("");

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${grid}${axes}${polys}</svg>`;
}

/** Interactive top-down roller hockey rink SVG for tactics board */
function _tacticSVGInteractive(isFullscreen) {
  _coachEnsureBoardState();
  _coachResolveAttachedPuckPosition();
  const playerSvg = (coachBoardState.players || []).map(player => {
    const selected = coachBoardState.selectedEntity?.kind === "player" && coachBoardState.selectedEntity?.id === player.id;
    const fill = _coachBoardPlayerColor(player);
    const textColor = _coachBoardPlayerTextColor(player);
    return `<g data-coach-entity-kind="player" data-coach-entity-id="${_cesc(player.id)}" onclick="coachHandleBoardClick(event,'player','${_cesc(player.id)}');event.stopPropagation();" style="cursor:grab">
      <circle cx="${player.x}" cy="${player.y}" r="3.3" fill="${fill}" stroke="${selected ? "#fde68a" : "#0f172a"}" stroke-width="${selected ? "0.9" : "0.45"}" />
      <text x="${player.x}" y="${player.y + 0.3}" text-anchor="middle" dominant-baseline="middle" font-size="2.1" fill="${textColor}" font-family="'Barlow Condensed',sans-serif" font-weight="700">${_cesc(player.label)}</text>
    </g>`;
  }).join("");

  const puckSelected = coachBoardState.selectedEntity?.kind === "puck";
  const puckSvg = _coachShouldRenderInteractivePuck()
    ? `<g data-coach-entity-kind="puck" data-coach-entity-id="puck" onclick="coachHandleBoardClick(event,'puck','puck');event.stopPropagation();" style="cursor:grab">
        <circle cx="${coachBoardState.puck.x}" cy="${coachBoardState.puck.y}" r="2.5" fill="transparent" stroke="transparent" />
        <circle cx="${coachBoardState.puck.x}" cy="${coachBoardState.puck.y}" r="1.25" fill="#0f172a" stroke="${puckSelected ? "#fde68a" : "#ffffff"}" stroke-width="0.55" />
      </g>`
    : `<g style="pointer-events:none">
        <circle cx="${coachBoardState.puck.x}" cy="${coachBoardState.puck.y}" r="1.15" fill="#0f172a" stroke="#ffffff" stroke-width="0.5" />
      </g>`;

  const annotationsSvg = (coachBoardState.annotations || []).map(annotation => {
    const a = annotation.start || { x: 50, y: 50 };
    const b = annotation.end || a;
    const meta = {
      pass:   { stroke: "#2563eb", dash: "2.3 1.6", marker: "url(#coach-arrow-blue)", label: "PASS" },
      shot:   { stroke: "#dc2626", dash: "",        marker: "url(#coach-arrow-red)",  label: "XUT" },
      carry:  { stroke: "#0891b2", dash: "",        marker: "url(#coach-arrow-cyan)", label: "COND" },
      screen: { stroke: "#d97706", dash: "0.7 1.1", marker: "url(#coach-arrow-gold)", label: "BLQ" },
      zone:   { stroke: "#7c3aed", dash: "1.4 1.2", marker: "",                       label: "ZONA" },
    }[annotation.type] || { stroke: "#64748b", dash: "", marker: "", label: "ACC" };

    if (annotation.type === "zone") {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.max(2, Math.abs(a.x - b.x));
      const h = Math.max(2, Math.abs(a.y - b.y));
      const zoneColor = String(annotation?.zoneColor || meta.stroke || "#7c3aed");
      return `<g onclick="coachHandleBoardClick(event,'annotation','${_cesc(annotation.id)}');event.stopPropagation();" oncontextmenu="coachHandleBoardContextMenu(event,'annotation','${_cesc(annotation.id)}');" style="cursor:pointer">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.8" fill="${_coachHexToRgba(zoneColor, 0.16)}" stroke="${zoneColor}" stroke-width="0.55" stroke-dasharray="${meta.dash}" />
        <text x="${x + w / 2}" y="${y - 1.4}" text-anchor="middle" font-size="2" fill="${zoneColor}" font-family="'Barlow Condensed',sans-serif" font-weight="700">${meta.label}</text>
      </g>`;
    }

    if (annotation.type === "carry") {
      const zigzag = _coachZigzagPathPoints(a, b, 7, 0.9);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      return `<g onclick="coachHandleBoardClick(event,'annotation','${_cesc(annotation.id)}');event.stopPropagation();" style="cursor:pointer">
        <polyline points="${zigzag}" fill="none" stroke="${meta.stroke}" stroke-width="0.7" marker-end="${meta.marker}" />
        <polyline points="${zigzag}" fill="none" stroke="transparent" stroke-width="4" />
        <text x="${midX}" y="${midY - 1.7}" text-anchor="middle" font-size="2" fill="${meta.stroke}" font-family="'Barlow Condensed',sans-serif" font-weight="700">${meta.label}</text>
      </g>`;
    }

    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const blocked = annotation.type === "screen" ? _coachBoardPlayerById(annotation?.blockedPlayerId) : null;
    const crossX = blocked ? blocked.x : b.x;
    const crossY = blocked ? blocked.y : b.y;
    const cross = annotation.type === "screen"
      ? `<line x1="${crossX - 1.25}" y1="${crossY - 1.25}" x2="${crossX + 1.25}" y2="${crossY + 1.25}" stroke="#dc2626" stroke-width="0.55" />
         <line x1="${crossX + 1.25}" y1="${crossY - 1.25}" x2="${crossX - 1.25}" y2="${crossY + 1.25}" stroke="#dc2626" stroke-width="0.55" />`
      : "";
    return `<g onclick="coachHandleBoardClick(event,'annotation','${_cesc(annotation.id)}');event.stopPropagation();" style="cursor:pointer">
      <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${meta.stroke}" stroke-width="0.6" stroke-dasharray="${meta.dash}" marker-end="${meta.marker}" />
      <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="transparent" stroke-width="4" />
      ${cross}
      <text x="${midX}" y="${midY - 1.7}" text-anchor="middle" font-size="2" fill="${meta.stroke}" font-family="'Barlow Condensed',sans-serif" font-weight="700">${meta.label}</text>
    </g>`;
  }).join("");

  const pending = coachBoardState.pendingAction;
  const pendingSvg = pending
    ? `<circle cx="${pending.start.x}" cy="${pending.start.y}" r="1.6" fill="${_coachToolMeta(pending.tool).color}" opacity="0.35" />`
    : "";

  return `<svg id="coach-tactics-board-svg" data-coach-board="1" width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="touch-action:none;user-select:none;-webkit-user-select:none" onpointerdown="coachBoardPointerDown(event)" onpointermove="coachBoardPointerMove(event)" onpointerup="coachBoardPointerUp(event)" onpointercancel="coachBoardPointerUp(event)" onclick="coachHandleBoardClick(event)">
    <defs>
      <linearGradient id="coach-rink-bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#bfdbfe" />
        <stop offset="100%" stop-color="#dbeafe" />
      </linearGradient>
      <marker id="coach-arrow-blue" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#2563eb"/></marker>
      <marker id="coach-arrow-red" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#dc2626"/></marker>
      <marker id="coach-arrow-cyan" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#0891b2"/></marker>
      <marker id="coach-arrow-gold" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#d97706"/></marker>
    </defs>

    <rect x="1" y="6" width="98" height="88" rx="8" fill="url(#coach-rink-bg)" stroke="#0f172a" stroke-width="0.35" />
    <rect x="3.2" y="8.2" width="93.6" height="83.6" rx="6.5" fill="#dbeafe" stroke="#ffffff" stroke-width="0.45" />
    <line x1="50" y1="8.2" x2="50" y2="91.8" stroke="#ef4444" stroke-width="0.4" />
    <circle cx="50" cy="50" r="6.6" fill="none" stroke="#ef4444" stroke-width="0.3" />
    <path d="M18.2,35.5 Q28.8,50 18.2,64.5" fill="none" stroke="#1d4ed8" stroke-width="0.38" />
    <path d="M81.8,35.5 Q71.2,50 81.8,64.5" fill="none" stroke="#1d4ed8" stroke-width="0.38" />
    <rect x="8.8" y="45" width="2.2" height="10" fill="rgba(239,68,68,.72)" stroke="#ef4444" stroke-width="0.25" />
    <rect x="89" y="45" width="2.2" height="10" fill="rgba(239,68,68,.72)" stroke="#ef4444" stroke-width="0.25" />
    <rect x="8.8" y="35.5" width="11.7" height="29" rx="2.6" fill="rgba(255,255,255,.12)" stroke="#93c5fd" stroke-width="0.28" />
    <rect x="79.5" y="35.5" width="11.7" height="29" rx="2.6" fill="rgba(255,255,255,.12)" stroke="#93c5fd" stroke-width="0.28" />
    <rect x="3.2" y="8.2" width="93.6" height="83.6" rx="6.5" fill="transparent" />
    ${annotationsSvg}
    ${pendingSvg}
    ${playerSvg}
    ${puckSvg}
  </svg>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   SUPABASE OPERATIONS
══════════════════════════════════════════════════════════════════════════ */

async function _loadTrainings() {
  const sb = _csb();
  coachTrainings       = [];
  coachTrainingsLoaded = true;
  const uid = await _cauthUid();
  if (!sb || !uid) return;
  const choice = _coachResolveTeamChoice("planning");
  const team = _coachTeamIdentityLabel(choice) || _cteam("planning");
  coachTrainingsTeamKey = team;
  const legacyTeam = _cteam("planning");
  const clubName = String(choice?.clubName || _cclub("planning") || "").trim();
  const choiceCategory = String(choice?.category || "").trim();
  if (!team) return;

  // ── 1. Load from shared_trainings (unified object, coordinator + coach) ──
  try {
    let sq = sb.from("shared_trainings").select("*");
    if (clubName) sq = sq.eq("club_name", clubName);
    if (legacyTeam) sq = sq.eq("team_name", legacyTeam);
    sq = sq.order("training_date", { ascending: true });
    const { data: sharedData, error: sharedError } = await sq;
    if (!sharedError && Array.isArray(sharedData) && sharedData.length) {
      for (const row of sharedData) {
        coachTrainings.push({
          id: String(row.id),
          sharedTrainingId: String(row.id),
          plan_date: String(row.training_date || ""),
          duration_minutes: Number(row.duration_minutes || 0) || 0,
          pillars: Array.isArray(row.pillars) ? row.pillars : [],
          notes: [
            String(row.coach_notes || row.notes || "").trim(),
            String(row.location || "").trim() ? `Ubicació: ${row.location.trim()}` : "",
            String(row.locker_room || "").trim() ? `Vestidor: ${row.locker_room.trim()}` : "",
            row.training_time ? `Hora: ${String(row.training_time || "")}` : "",
          ].filter(Boolean).join(" · "),
          _source: "shared",
          _sharedRaw: row,
        });
      }
      // If we got shared trainings, return early — no need to load legacy tables
      return;
    }
  } catch {}

  // ── 2. Fallback: legacy coach_training_plans ──────────────────────────────
  let q = sb.from("coach_training_plans").select("*").eq("coach_user_id", uid);
  if (team) q = q.eq("team_name", team);
  q = q.order("plan_date", { ascending: true });
  let { data, error } = await q;
  if ((!data || !data.length) && legacyTeam && legacyTeam !== team) {
    const fallback = await sb.from("coach_training_plans").select("*").eq("coach_user_id", uid).eq("team_name", legacyTeam).order("plan_date", { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }
  if (!error && data) {
    coachTrainings = data.map(row => ({ ...row, _source: "coach" }));
  }

  // ── 3. Also merge legacy coordinator localStorage trainings ───────────────
  if (clubName && typeof loadCoordinatorTrainings === "function") {
    try {
      const byClub = loadCoordinatorTrainings(clubName) || [];
      const fromCoordinator = byClub
        .filter(t => {
          if (typeof coordinatorTrainingMatchesTeam === "function") {
            return coordinatorTrainingMatchesTeam(t, legacyTeam, choiceCategory);
          }
          const refs = Array.isArray(t?.teamRefs) ? t.teamRefs : [];
          const names = refs.length
            ? refs.map(ref => String(ref?.teamName || "").trim())
            : (Array.isArray(t?.teamNames) ? t.teamNames.map(n => String(n || "").trim()) : [String(t?.teamName || "").trim()]);
          const categories = refs.length
            ? refs.map(ref => String(ref?.category || "").trim())
            : (Array.isArray(t?.teamCategories) ? t.teamCategories.map(c => String(c || "").trim()) : []);
          return names.some((name, idx) => {
            const nameMatches = _coachTeamEq(name, legacyTeam) || _coachTeamLoose(name, legacyTeam);
            if (!nameMatches) return false;
            if (!choiceCategory) return true;
            return String(categories[idx] || "").trim() === choiceCategory;
          });
        })
        .map(t => ({
          id: `coord::${String(t?.id || "")}`,
          plan_date: String(t?.date || ""),
          duration_minutes: Number(t?.duration || 0) || 0,
          pillars: [],
          notes: [
            String(t?.notes || "").trim(),
            String(t?.location || "").trim() ? `Ubicacio: ${String(t.location).trim()}` : "",
            String(t?.time || "").trim() ? `Hora: ${String(t.time).trim()}` : "",
          ].filter(Boolean).join(" · "),
          _source: "coordinator",
          _coordinatorRaw: t,
        }))
        .filter(t => t.plan_date);

      const existingCoachDates = new Set(coachTrainings.map(t => `${String(t.plan_date || "")}::${Number(t.duration_minutes || 0)}`));
      for (const t of fromCoordinator) {
        const k = `${String(t.plan_date || "")}::${Number(t.duration_minutes || 0)}`;
        if (!existingCoachDates.has(k)) coachTrainings.push(t);
      }
    } catch {}
  }
}

async function coachSaveTraining() {
  const sb  = _csb();
  const msg = document.getElementById("coach-plan-msg");
  const setMsg = (txt, color) => { if (msg) { msg.style.color = color || "#64748b"; msg.textContent = txt; } };

  const uid = await _coachAuthUidForWrite();
  if (!sb || !uid) { setMsg("Cal iniciar sessió amb email/OTP per desar a la BD.", "#e5001c"); return; }
  const choice = _coachResolveTeamChoice();
  const team = _coachTeamIdentityLabel(choice) || _cteam();
  const clubName = String(choice?.clubName || _cclub() || "").trim();
  const category = String(choice?.category || "").trim();
  if (!team) { setMsg("Indica primer l'equip.", "#e5001c"); return; }
  const date = (document.getElementById("coach-plan-date")?.value || coachPlanningDate).trim();
  if (!date) { setMsg("Selecciona una data.", "#e5001c"); return; }
  const duration = Number(document.getElementById("coach-plan-dur")?.value || coachPlanningDuration) || 90;
  const notes = (document.getElementById("coach-plan-notes")?.value || coachPlanningNotes).trim() || null;

  setMsg("Desant...");

  // ── Try shared_trainings first (unified object) ──────────────────────────
  // If editing an existing shared training, UPDATE instead of INSERT
  if (coachEditingSharedTrainingId) {
    const { error: updErr } = await sb.from("shared_trainings")
      .update({
        duration_minutes: duration,
        pillars:          coachPlanningPillars,
        coach_notes:      notes,
        enriched_by:      uid,
        updated_at:       new Date().toISOString(),
      })
      .eq("id", coachEditingSharedTrainingId);
    if (!updErr) {
      setMsg("✓ Entrenament compartit actualitzat.", "#16a34a");
      coachEditingSharedTrainingId = null;
      coachPlanningPillars = [];
      coachPlanningNotes   = "";
      coachTrainingsLoaded = false;
      await _loadTrainings();
      renderCoachPanel();
      return;
    }
  }

  const { data: sharedData, error: sharedError } = await sb.from("shared_trainings")
    .insert({
      club_name:        clubName,
      team_name:        team,
      team_category:    category,
      training_date:    date,
      training_time:    "00:00",  // coach doesn't set time — coordinator enriches later
      location:         "",
      locker_room:      "",
      duration_minutes: duration,
      pillars:          coachPlanningPillars,
      coach_notes:      notes,
      notes:            notes,
      created_by:       uid,
      enriched_by:      uid,
    })
    .select("id")
    .single();

  if (!sharedError && sharedData?.id) {
    setMsg("✓ Entrenament desat (shared_trainings).", "#16a34a");
    coachPlanningPillars  = [];
    coachPlanningNotes    = "";
    coachTrainingsLoaded  = false;
    await _loadTrainings();
    renderCoachPanel();
    return;
  }

  // ── Fallback: legacy coach_training_plans ────────────────────────────────
  const { error } = await sb.from("coach_training_plans").insert({
    coach_user_id:    uid,
    team_name:        team,
    plan_date:        date,
    duration_minutes: duration,
    pillars:          coachPlanningPillars,
    notes,
  });

  if (error) {
    setMsg("Error: " + error.message, "#e5001c");
  } else {
    setMsg("✓ Entrenament desat.", "#16a34a");
    coachPlanningPillars  = [];
    coachPlanningNotes    = "";
    coachTrainingsLoaded  = false;
    await _loadTrainings();
    renderCoachPanel();
  }
}

async function coachDeleteTraining(id) {
  if (!confirm("Eliminar aquest entrenament?")) return;
  const sb = _csb();
  const uid = await _cauthUid();
  if (!sb || !uid) return;
  const target = coachTrainings.find(t => String(t?.id || "") === String(id || ""));
  // Shared training: delete from shared_trainings
  if (target?._source === "shared" && target?.sharedTrainingId) {
    const { error } = await sb.from("shared_trainings").delete().eq("id", target.sharedTrainingId).eq("created_by", uid);
    if (error) { alert("Error: " + error.message); return; }
  } else {
    const { error } = await sb.from("coach_training_plans").delete().eq("id", id).eq("coach_user_id", uid);
    if (error) { alert("Error: " + error.message); return; }
  }
  coachTrainings = coachTrainings.filter(t => t.id !== id);
  renderCoachPanel();
}

// Enrich a shared training from the coach side (add pillars / notes)
async function coachEnrichSharedTraining(id) {
  const sb = _csb();
  const uid = await _coachAuthUidForWrite();
  const msg = document.getElementById("coach-plan-msg");
  const setMsg = (txt, color) => { if (msg) { msg.style.color = color || "#64748b"; msg.textContent = txt; } };
  if (!sb || !uid) { setMsg("Cal iniciar sessió amb email/OTP.", "#e5001c"); return; }
  const target = coachTrainings.find(t => String(t?.id || "") === String(id || ""));
  if (!target?.sharedTrainingId) { setMsg("Entrenament no compartit.", "#e5001c"); return; }
  const { error } = await sb.from("shared_trainings")
    .update({
      pillars:      coachPlanningPillars,
      coach_notes:  (document.getElementById("coach-plan-notes")?.value || coachPlanningNotes).trim() || null,
      enriched_by:  uid,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", target.sharedTrainingId);
  if (error) { setMsg("Error: " + error.message, "#e5001c"); return; }
  setMsg("✓ Entrenament enriquit.", "#16a34a");
  coachTrainingsLoaded = false;
  await _loadTrainings();
  renderCoachPanel();
}

function coachLoadCoordinatorTrainingToForm(id) {
  const targetId = String(id || "").trim();
  const found = coachTrainings.find(t => String(t?.id || "") === targetId && (String(t?._source || "") === "coordinator" || String(t?._source || "") === "shared"));
  if (!found) return;

  // Track which shared training we're enriching so coachSaveTraining can UPDATE
  coachEditingSharedTrainingId = (found._source === "shared" && found.sharedTrainingId)
    ? String(found.sharedTrainingId)
    : null;

  coachPlanningDate = String(found.plan_date || coachPlanningDate || "").trim() || coachPlanningDate;
  coachPlanningDuration = Number(found.duration_minutes || coachPlanningDuration || 90) || 90;
  // Pre-load existing pillars so user can see and adjust them
  if (found._source === "shared" && Array.isArray(found._sharedRaw?.pillars) && found._sharedRaw.pillars.length) {
    coachPlanningPillars = [...found._sharedRaw.pillars];
  }
  const existing = String(coachPlanningNotes || "").trim();
  const imported = String(found._sharedRaw?.coach_notes || found.notes || "").trim();
  coachPlanningNotes = [existing, imported].filter(Boolean).join(existing && imported ? "\n" : "");

  renderCoachPanel();
  const msg = document.getElementById("coach-plan-msg");
  if (msg) {
    msg.style.color = "#1d4ed8";
    msg.textContent = found._source === "shared"
      ? "Entrenament compartit carregat. Modifica els pilars i clica '+ Afegir' per desar-ho."
      : "Entrenament de coordinador carregat. Afegeix pilars/dimensions i desa.";
  }
}

async function _loadPlayerObjectives(team, clubName = "") {
  const sb = _csb();
  coachPlayerObjs       = {};
  coachPlayerObjsTeam   = team || "";
  coachPlayerObjsClub   = clubName || "";
  coachPlayerObjsLoaded = true;
  const uid = await _cauthUid();
  if (!sb || !uid) return;
  if (!team) return;
  let q = sb.from("coach_player_objectives").select("*").eq("coach_user_id", uid);
  if (team !== null && team !== undefined) q = q.eq("team_name", team);
  let { data, error } = await q;
  const legacyTeam = _cteam("objectives");
  if ((!data || !data.length) && legacyTeam && legacyTeam !== team) {
    const fallback = await sb.from("coach_player_objectives").select("*").eq("coach_user_id", uid).eq("team_name", legacyTeam);
    data = fallback.data;
    error = fallback.error;
  }
  if (!error && data) {
    for (const row of data) {
      coachPlayerObjs[row.player_name] = { id: row.id, pillar_data: row.pillar_data || {}, notes: row.notes };
    }
  }
}

async function coachSavePlayerObjective() {
  const sb  = _csb();
  const msg = document.getElementById("coach-obj-msg");
  const setMsg = (txt, color) => { if (msg) { msg.style.color = color || "#64748b"; msg.textContent = txt; } };

  const uid = await _coachAuthUidForWrite();
  if (!sb || !uid) { setMsg("Cal iniciar sessió amb email/OTP per desar a la BD.", "#e5001c"); return; }
  const name = String(coachEditingPlayer || "").trim();
  if (!name) { setMsg("Selecciona un jugador del desplegable.", "#e5001c"); return; }
  const choice = _coachResolveTeamChoice();
  const team = _coachTeamIdentityLabel(choice) || _cteam();

  const pillarData = {};
  for (const p of COACH_PILLARS) {
    pillarData[p.id] = {
      baseline: Number(document.getElementById(`coach-obj-${p.id}-baseline`)?.value || 0) || 0,
      target:   Number(document.getElementById(`coach-obj-${p.id}-target`)?.value   || 0) || 0,
      progress: Number(document.getElementById(`coach-obj-${p.id}-progress`)?.value || 0) || 0,
    };
  }

  setMsg("Desant...");
  const existing = coachPlayerObjs[name];
  let error;

  if (existing?.id) {
    ({ error } = await sb.from("coach_player_objectives")
      .update({ team_name: team, pillar_data: pillarData, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("coach_user_id", uid));
  } else {
    ({ error } = await sb.from("coach_player_objectives").upsert({
      coach_user_id: uid,
      team_name:     team || "",
      player_name:   name,
      season:        _coachSeasonKey(),
      pillar_data:   pillarData,
    }, { onConflict: "coach_user_id,team_name,player_name,season" }));
  }

  if (error) {
    setMsg("Error: " + error.message, "#e5001c");
  } else {
    setMsg("✓ Objectius desats.", "#16a34a");
    coachEditingPlayer    = null;
    coachPlayerObjsLoaded = false;
    await _loadPlayerObjectives(team, choice?.clubName || "");
    renderCoachPanel();
  }
}

async function coachDeletePlayerObj(playerName) {
  if (!confirm(`Eliminar objectius de ${playerName}?`)) return;
  const sb = _csb();
  const uid = await _cauthUid();
  if (!sb || !uid) return;
  const existing = coachPlayerObjs[playerName];
  let error;
  if (existing?.id) {
    ({ error } = await sb.from("coach_player_objectives").delete().eq("id", existing.id).eq("coach_user_id", uid));
  }
  if (error) { alert("Error: " + error.message); return; }
  coachPlayerObjsLoaded = false;
  const choice = _coachResolveTeamChoice();
  const teamIdentity = _coachTeamIdentityLabel(choice) || _cteam();
  await _loadPlayerObjectives(teamIdentity, choice?.clubName || "");
  renderCoachPanel();
}

async function coachSaveMatchEvents() {
  const sb  = _csb();
  const msg = document.getElementById("coach-match-msg");
  const setMsg = (txt, color) => { if (msg) { msg.style.color = color || "#64748b"; msg.textContent = txt; } };

  const uid = await _cauthUid();
  if (!sb || !uid) { setMsg("Sessió no activa. Torna a iniciar sessió.", "#e5001c"); return; }
  const choice = _coachResolveTeamChoice();
  const team = _coachTeamIdentityLabel(choice) || _cteam();
  if (!team) { setMsg("Indica l'equip.", "#e5001c"); return; }
  setMsg("Desant...");

  const payload = {
    coach_user_id:     uid,
    team_name:         team || "",
    match_date:        coachMatchState.matchDate,
    opponent:          coachMatchState.opponent || "",
    is_home:           coachMatchState.isHome,
    available_players: coachMatchState.players,
    events:            coachMatchState.events,
    tactics:           _coachBoardPayload(),
    updated_at:        new Date().toISOString(),
  };

  let error;
  if (coachMatchState.savedId) {
    ({ error } = await sb.from("coach_match_events").update(payload).eq("id", coachMatchState.savedId).eq("coach_user_id", uid));
  } else {
    const res = await sb.from("coach_match_events").insert(payload).select("id").single();
    error = res.error;
    if (!error && res.data?.id) coachMatchState.savedId = res.data.id;
  }

  if (error) setMsg("Error: " + error.message, "#e5001c");
  else       setMsg("✓ Desat!", "#16a34a");
}

/* ══════════════════════════════════════════════════════════════════════════
   UI EVENT HANDLERS
══════════════════════════════════════════════════════════════════════════ */

async function coachSetTeam(val) {
  const resolved = _coachResolveTeamChoiceByValue(val);
  if (resolved?.clubName) {
    coachClubInput = resolved.clubName;
    coachClubSearch = resolved.clubName;
    Promise.resolve(_coachPersistSelectedClub(resolved.clubName));
  }
  _coachApplyTeamSelectionAllTabs(String(resolved?.optionValue || val || "").trim());
  coachSelectedUpcomingMatchKey = "";
  coachSelectedPreviousMatchKey = "";
  const club = String(resolved?.clubName || _cclub() || "").trim();
  const team = String(resolved?.teamName || _cteam() || "").trim();
  const category = String(resolved?.category || _ccategory() || "").trim();
  const upcoming = _coachGetUpcomingMatches(club, team, category);
  if (upcoming.length) _coachApplyUpcomingMatch(upcoming[0]);
  renderCoachPanel();
}

function coachSelectTabTeam(tabKey, optionValue) {
  _coachApplyTeamSelectionAllTabs(optionValue);
  coachSelectedUpcomingMatchKey = "";
  coachSelectedPreviousMatchKey = "";
  const resolved = _coachResolveTeamChoiceByValue(optionValue);
  const club = String(resolved?.clubName || _cclub() || "").trim();
  const team = String(resolved?.teamName || _cteam() || "").trim();
  const category = String(resolved?.category || _ccategory() || "").trim();
  const upcoming = _coachGetUpcomingMatches(club, team, category);
  if (upcoming.length) _coachApplyUpcomingMatch(upcoming[0]);
  renderCoachPanel();
}

async function coachToggleFavoriteSelectedTeam(tabKey) {
  const current = _coachResolveTeamChoice(tabKey);
  if (!current?.optionValue) return;
  await _coachToggleFavoriteTeam(current.optionValue);
  renderCoachPanel();
}

async function coachToggleFavoriteTeamChip(optionValue) {
  await _coachToggleFavoriteTeam(optionValue);
  renderCoachPanel();
}

function coachSetClub(val) {
  coachClubInput = (val || "").trim();
  coachClubSearch = coachClubInput;
  coachTeamInput = "";
  coachSelectedConvocatoriaMatchKey = "";
  coachSelectedUpcomingMatchKey = "";
  for (const tab of ["planning", "objectives", "match"]) coachTabTeamValues[tab] = "";
  coachTrainingsLoaded = false;
  coachPlayerObjsLoaded = false;
  coachEditingPlayer = null;
  Promise.resolve(_coachPersistSelectedClub(coachClubInput));
  renderCoachPanel();
}

function coachSetClubSearch(value, cursor) {
  coachClubSearch = String(value || "");

  const queryNorm = _coachSearchNorm(coachClubSearch);
  const options = _coachBuildClubTeamOptions();

  if (queryNorm) {
    const filtered = options.filter(o => _coachSearchNorm(o.clubName).includes(queryNorm));
    const exact = filtered.find(o => _coachSearchNorm(o.clubName) === queryNorm) || null;

    let nextClub = null;
    if (exact) nextClub = exact;
    else if (filtered.length === 1) nextClub = filtered[0];
    else if (filtered.length > 1) {
      const currentStillVisible = filtered.some(o => o.clubName === coachClubInput);
      if (!currentStillVisible) nextClub = filtered[0];
    }

    if (nextClub) {
      coachClubInput = nextClub.clubName;
      const hasCurrentTeam = (nextClub.teams || []).some(t => _coachTeamEq(t?.teamName || "", coachTeamInput));
      if (!hasCurrentTeam) {
        coachTeamInput = "";
        for (const tab of ["planning", "objectives", "match"]) coachTabTeamValues[tab] = "";
      }
    }
  }

  renderCoachPanel(Number.isFinite(Number(cursor)) ? Number(cursor) : undefined);
}

function coachLoadLineupFromConvocatoria() {
  const club = _cclub();
  const team = _cteam();
  const category = _ccategory();
  const selectedMatchKey = String(coachSelectedConvocatoriaMatchKey || "").trim();
  if (!club || !team) {
    alert("Selecciona club i equip.");
    return;
  }

  const players = _coachRosterFromConvocatoria(club, team, category, selectedMatchKey);
  if (!players.length) {
    alert(selectedMatchKey
      ? "No s'han trobat jugadors per aquesta convocatòria seleccionada."
      : "No hi ha convocatòries disponibles per aquest equip.");
    return;
  }

  const rivals = (coachMatchState.players || []).filter(p => String(p?.squad || "") === "rival");
  coachMatchState.players = _coachMergeRosterPlayers(players, rivals);
  const convocatoria = selectedMatchKey
    ? _coachFindConvocatoriaByMatchKey(club, team, category, selectedMatchKey)
    : _coachFindLatestConvocatoria(club, team, category);
  if (convocatoria) {
    coachSelectedConvocatoriaMatchKey = _coachConvocatoriaMatchIdentity(convocatoria);
    coachMatchState.matchDate = String(convocatoria.matchDate || coachMatchState.matchDate || "").slice(0, 10) || coachMatchState.matchDate;
    coachMatchState.opponent = String(convocatoria.matchAway || "").trim();
    const teamHome = _coachTeamEq(convocatoria?.matchHome || "", team) || _coachTeamLoose(convocatoria?.matchHome || "", team);
    if (teamHome || _coachTeamEq(convocatoria?.matchAway || "", team) || _coachTeamLoose(convocatoria?.matchAway || "", team)) {
      coachMatchState.isHome = teamHome;
    }
  }
  _coachSyncLinkedMatchFromState();
  renderCoachPanel();
}

function coachSetLineupConvocatoriaMatch(matchKey) {
  coachSelectedConvocatoriaMatchKey = String(matchKey || "").trim();
  renderCoachPanel();
}

function coachSelectUpcomingMatch(matchKey) {
  const club = _cclub();
  const team = _cteam();
  const category = _ccategory();
  const wanted = String(matchKey || "").trim();
  coachSelectedUpcomingMatchKey = wanted;
  if (!wanted) {
    renderCoachPanel();
    return;
  }
  const match = _coachGetUpcomingMatches(club, team, category)
    .find(item => _coachUpcomingMatchIdentity(item) === wanted) || null;
  if (match) _coachApplyUpcomingMatch(match);
  renderCoachPanel();
}

function coachSelectPreviousMatch(matchKey) {
  const club = _cclub();
  const team = _cteam();
  const category = _ccategory();
  const wanted = String(matchKey || "").trim();
  coachSelectedPreviousMatchKey = wanted;
  if (!wanted) {
    renderCoachPanel();
    return;
  }
  const match = _coachGetPreviousMatches(club, team, category)
    .find(item => _coachUpcomingMatchIdentity(item) === wanted) || null;
  if (match) {
    _coachApplyPreviousMatch(match);

    const conv = _coachFindConvocatoriaForMatch(club, team, category, match);
    if (conv) {
      const convKey = _coachConvocatoriaMatchIdentity(conv);
      coachSelectedConvocatoriaMatchKey = convKey;
      const roster = _coachRosterFromConvocatoria(club, team, category, convKey);
      if (roster.length) {
        const rivals = (coachMatchState.players || []).filter(p => String(p?.squad || "") === "rival");
        coachMatchState.players = _coachMergeRosterPlayers(roster, rivals);
      }
    }
  }
  renderCoachPanel();
}

function coachLoadLineupFromSelectedConvocatoria() {
  coachLoadLineupFromConvocatoria();
}

function coachTogglePillar(id) {
  const idx = coachPlanningPillars.indexOf(id);
  if (idx >= 0) coachPlanningPillars.splice(idx, 1);
  else if (coachPlanningPillars.length < 4) coachPlanningPillars.push(id);
  renderCoachPanel();
}

function _getSuggestions(pillars) {
  const out = [];
  for (const pid of pillars) {
    const exs = COACH_EXERCISES[pid] || [];
    out.push(...exs.slice(0, 2));
  }
  return out;
}

function coachEditPlayer(name) {
  coachEditingPlayer = name;
  renderCoachPanel();
  setTimeout(() => document.getElementById("coach-objective-player-select")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
}

function coachPickObjectivePlayer(name) {
  const picked = String(name || "").trim();
  if (!picked) {
    coachEditingPlayer = null;
    renderCoachPanel();
    return;
  }
  coachEditingPlayer = picked;
  renderCoachPanel();
}

function coachClearEditingPlayer() {
  coachEditingPlayer = null;
  renderCoachPanel();
}

function coachAddPlayerToLineup() {
  const name = (document.getElementById("coach-add-name")?.value || "").trim();
  if (!name) return;
  if (coachMatchState.players.find(p => p.name === name)) { alert("Jugador ja afegit."); return; }
  coachMatchState.players.push({
    name,
    number: String(document.getElementById("coach-add-number")?.value || "").trim(),
    isStarter: document.getElementById("coach-add-starter")?.checked ?? true,
    side:      document.getElementById("coach-add-side")?.value || "D",
    pos:       document.getElementById("coach-add-pos")?.value  || "MIG",
    squad:     "favorite",
  });
  _coachSyncLinkedMatchFromState();
  renderCoachPanel();
}

function coachAddRivalPlayer() {
  const dorsal = String(document.getElementById("coach-rival-number")?.value || "").trim();
  const rawName = String(document.getElementById("coach-rival-name")?.value || "").trim();
  if (!dorsal) {
    alert("El dorsal del rival es obligatori.");
    return;
  }

  const duplicate = coachMatchState.players.find(p => String(p?.squad || "favorite") === "rival" && String(p?.number || "") === dorsal);
  if (duplicate) {
    alert("Ja existeix un rival amb aquest dorsal.");
    return;
  }

  coachMatchState.players.push({
    name: rawName || `Rival #${dorsal}`,
    number: dorsal,
    isStarter: document.getElementById("coach-rival-starter")?.checked ?? true,
    side: document.getElementById("coach-rival-side")?.value || "D",
    pos: document.getElementById("coach-rival-pos")?.value || "MIG",
    squad: "rival",
  });
  _coachSyncLinkedMatchFromState();
  renderCoachPanel();
}

function coachRemovePlayer(idx) {
  coachMatchState.players.splice(idx, 1);
  renderCoachPanel();
}

function coachToggleStarter(idx) {
  coachMatchState.players[idx].isStarter = !coachMatchState.players[idx].isStarter;
  renderCoachPanel();
}

function coachSetPlayerSide(idx, val) { coachMatchState.players[idx].side = val; }
function coachSetPlayerPos(idx, val)  { coachMatchState.players[idx].pos  = val; }

function coachAddEvent(playerName, eventType) {
  _coachSyncLinkedMatchFromState();
  const playerMeta = (coachMatchState.players || []).find(p => String(p?.name || "") === String(playerName || ""));
  coachMatchState.events.push({
    player: playerName,
    player_squad: String(playerMeta?.squad || "favorite"),
    type: eventType,
    minute: null,
    ts: Date.now(),
    match_id: coachMatchState.linkedMatchId || "",
  });
  renderCoachPanel();
}

function _coachSyncLinkedMatchFromState() {
  const team = String(_cteam("match") || _cteam() || "").trim();
  const date = String(coachMatchState.matchDate || "").trim();
  const opp = String(coachMatchState.opponent || "").trim();
  if (!team || !date) {
    coachMatchState.linkedMatchId = "";
    coachMatchState.linkedMatchLabel = "";
    return;
  }
  const id = `${_coachSeasonKey()}::${team}::${date}::${opp}`;
  coachMatchState.linkedMatchId = id;
  coachMatchState.linkedMatchLabel = `${date} · ${team} vs ${opp || "Rival per definir"}`;
}

function coachToggleLiveFullscreen() {
  coachLiveFullscreen = !coachLiveFullscreen;
  renderCoachPanel();
}

function coachRemoveEvent(idx) {
  coachMatchState.events.splice(idx, 1);
  renderCoachPanel();
}

function coachSetTactic(idx) {
  _coachStopPlayback();
  coachTacticIdx = idx;
  _coachEnsureBoardState(true);
  _coachBoardMessage(`Formació ${COACH_TACTICS[idx]?.name || ""} carregada.`);
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
}

function coachSetBoardTool(toolId) {
  _coachEnsureBoardState();
  coachBoardState.tool = toolId;
  coachBoardState.selectedEntity = null;
  coachBoardState.pendingAction = null;
  _coachBoardMessage(_coachToolMeta(toolId).hint);
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
}

function coachToggleBoardFullscreen() {
  _coachEnsureBoardState();
  coachBoardState.fullscreen = !coachBoardState.fullscreen;
  coachBoardFullscreenFormationsCollapsed = coachBoardState.fullscreen;
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
}

function coachToggleFullscreenFormationsCollapsed() {
  coachBoardFullscreenFormationsCollapsed = !coachBoardFullscreenFormationsCollapsed;
  _coachRenderTacticsTabRoot();
}

function coachAddBoardPlayer(team) {
  _coachEnsureBoardState();
  const isAway = team === "away";
  const side = isAway ? "away" : "home";
  const counts = _coachTeamCounts(side);
  if (counts.total >= 5 || counts.field >= counts.maxField) {
    _coachBoardMessage(`Límit assolit: ${side === "away" ? "rival" : "local"} amb màxim de 5 jugadors.`);
    _coachRenderTacticsTabRoot();
    return;
  }
  const sameTeam = coachBoardState.players.filter(player => (player.side || player.team) === side && !player.isGoalie);
  const nextIdx = sameTeam.length + 1;
  coachBoardState.players.push({
    id: `${isAway ? "away" : "home"}_extra_${Date.now()}`,
    label: `${isAway ? "R" : "A"}${nextIdx}`,
    team: side,
    side,
    isGoalie: false,
    x: isAway ? 64 : 36,
    y: _clamp(18 + nextIdx * 6, 12, 88),
  });
  coachBoardState.players = _coachNormalizeBoardPlayers(coachBoardState.players, coachTacticIdx);
  _coachBoardRecordFrame(isAway ? "Afegit rival" : "Afegit atacant");
  _coachBoardMessage(isAway ? "Rival afegit al camp." : "Jugador propi afegit al camp.");
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
}

function coachResetBoard() {
  _coachStopPlayback();
  _coachEnsureBoardState(true);
  _coachBoardMessage("Pissarra reiniciada a la formació base.");
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
}

function coachClearBoardActions() {
  _coachEnsureBoardState();
  coachBoardState.annotations = [];
  coachBoardState.pendingAction = null;
  coachBoardState.selectedEntity = null;
  _coachBoardRecordFrame("Neteja d'accions");
  _coachBoardMessage("Accions esborrades.");
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
}

function coachRemoveSelectedBoardItem() {
  _coachEnsureBoardState();
  if (coachBoardState.selectedEntity?.kind === "player") {
    const idx = coachBoardState.players.findIndex(player => player.id === coachBoardState.selectedEntity.id);
    if (idx >= 0 && !coachBoardState.players[idx].isGoalie) {
      const target = coachBoardState.players[idx];
      if ((target.side || target.team) === "away") {
        const tactic = COACH_TACTICS[coachTacticIdx] || COACH_TACTICS[0];
        const minAway = Array.isArray(tactic.awayPositions) ? tactic.awayPositions.length : 4;
        const awayField = coachBoardState.players.filter(player => (player.side || player.team) === "away" && !player.isGoalie).length;
        if (awayField <= minAway) {
          _coachBoardMessage(`El rival ha de mantenir com a mínim ${minAway} jugadors de camp en aquesta formació.`);
          _coachRenderTacticsTabRoot();
          return;
        }
      }
      coachBoardState.players.splice(idx, 1);
      coachBoardState.players = _coachNormalizeBoardPlayers(coachBoardState.players, coachTacticIdx);
      coachBoardState.selectedEntity = null;
      _coachBoardRecordFrame("Jugador eliminat");
      _coachBoardMessage("Jugador eliminat de la pissarra.");
      _coachPersistBoardState();
      _coachRenderTacticsTabRoot();
      return;
    }
  }
  if (coachBoardState.selectedEntity?.kind === "annotation") {
    coachBoardState.annotations = coachBoardState.annotations.filter(item => item.id !== coachBoardState.selectedEntity.id);
    coachBoardState.selectedEntity = null;
    _coachBoardRecordFrame("Acció eliminada");
    _coachBoardMessage("Acció eliminada.");
    _coachPersistBoardState();
    _coachRenderTacticsTabRoot();
    return;
  }
  _coachBoardMessage("Selecciona un jugador o una acció per eliminar.");
  _coachRenderTacticsTabRoot();
}

function coachToggleBoardRecording() {
  _coachEnsureBoardState();
  if (coachBoardState.recording) {
    coachBoardState.recording = false;
    _coachBoardMessage(`Gravació aturada. ${coachBoardState.recordingFrames.length} frames capturats.`);
  } else {
    coachBoardState.recording = true;
    coachBoardState.recordingFrames = [{
      id: `frame_${Date.now()}`,
      label: "Inici",
      snapshot: _coachCurrentBoardSnapshot(),
      capturedAt: new Date().toISOString(),
    }];
    _coachBoardMessage("Gravació iniciada. Cada moviment i acció quedarà guardat.");
  }
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
}

function coachSaveBoardPlay() {
  _coachEnsureBoardState();
  const team = _cteam();
  if (!team) {
    _coachBoardMessage("Indica primer l'equip per guardar una jugada.");
    _coachRenderTacticsTabRoot();
    return;
  }

  const defaultName = `${COACH_TACTICS[coachTacticIdx]?.name || "Jugada"} ${new Date().toLocaleDateString("ca-ES")}`;
  const playName = window.prompt("Nom de la jugada", defaultName);
  if (!playName) return;

  const frames = coachBoardState.recordingFrames.length
    ? coachBoardState.recordingFrames.map(frame => ({
        id: frame.id,
        label: frame.label,
        snapshot: _cclone(frame.snapshot),
        capturedAt: frame.capturedAt,
      }))
    : [{
        id: `frame_${Date.now()}`,
        label: "Snapshot",
        snapshot: _coachCurrentBoardSnapshot(),
        capturedAt: new Date().toISOString(),
      }];

  coachSavedPlays.unshift({
    id: `play_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: playName.trim(),
    team,
    tacticIdx: coachTacticIdx,
    tacticName: COACH_TACTICS[coachTacticIdx]?.name || "",
    frames,
    createdAt: new Date().toISOString(),
  });
  coachSavedPlays = coachSavedPlays.slice(0, 40);
  _coachPersistSavedPlays();
  coachBoardState.recording = false;
  coachBoardState.recordingFrames = [];
  _coachBoardMessage(`Jugada guardada: ${playName.trim()}`);
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
}

function coachLoadSavedPlay(playId) {
  _coachEnsureBoardState();
  const play = _coachActiveSavedPlays().find(item => item.id === playId);
  if (!play) return;
  _coachStopPlayback();
  const lastFrame = play.frames?.[play.frames.length - 1]?.snapshot || play.frames?.[0]?.snapshot || null;
  if (!lastFrame) return;
  _coachApplyBoardSnapshot(lastFrame);
  _coachBoardMessage(`Jugada carregada: ${play.name}`);
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
}

function coachPlaySavedPlay(playId) {
  _coachEnsureBoardState();
  const play = _coachActiveSavedPlays().find(item => item.id === playId);
  if (!play || !Array.isArray(play.frames) || !play.frames.length) return;
  _coachStopPlayback();
  let frameIdx = 0;
  _coachApplyBoardSnapshot(play.frames[0].snapshot);
  _coachBoardMessage(`Reproduint: ${play.name}`);
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
  coachPlaybackTimer = setInterval(() => {
    frameIdx += 1;
    if (frameIdx >= play.frames.length) {
      _coachStopPlayback();
      _coachBoardMessage(`Reproducció finalitzada: ${play.name}`);
      _coachRenderTacticsTabRoot();
      return;
    }
    _coachApplyBoardSnapshot(play.frames[frameIdx].snapshot);
    _coachPersistBoardState();
    _coachRenderTacticsTabRoot();
  }, 650);
}

function coachDeleteSavedPlay(playId) {
  const play = _coachActiveSavedPlays().find(item => item.id === playId);
  if (!play) return;
  if (!confirm(`Eliminar la jugada ${play.name}?`)) return;
  coachSavedPlays = coachSavedPlays.filter(item => item.id !== playId);
  _coachPersistSavedPlays();
  _coachBoardMessage(`Jugada eliminada: ${play.name}`);
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
}

function _coachBoardEntityFromTarget(target) {
  const node = target?.closest?.("[data-coach-entity-kind]");
  if (!node) return null;
  return {
    kind: String(node.getAttribute("data-coach-entity-kind") || "").trim(),
    id: String(node.getAttribute("data-coach-entity-id") || "").trim(),
  };
}

function coachBoardPointerDown(evt) {
  _coachEnsureBoardState();
  if (coachBoardState.tool !== "move") return;

  const entity = _coachBoardEntityFromTarget(evt.target);
  if (entity?.kind === "puck" && coachBoardState.ballMode === "attached") return;
  if (!entity || !(entity.kind === "player" || entity.kind === "puck")) return;

  evt.preventDefault();
  coachBoardDragState = {
    pointerId: evt.pointerId,
    kind: entity.kind,
    id: entity.id,
    moved: false,
  };
  coachBoardState.selectedEntity = { kind: entity.kind, id: entity.id };

  if (typeof evt.currentTarget?.setPointerCapture === "function") {
    try { evt.currentTarget.setPointerCapture(evt.pointerId); } catch {}
  }
}

function coachBoardPointerMove(evt) {
  if (!coachBoardDragState) return;
  if (evt.pointerId !== coachBoardDragState.pointerId) return;

  evt.preventDefault();
  const point = _coachBoardPointFromEvent(evt);
  const moved = _coachUpdateBoardEntityPosition(coachBoardDragState.kind, coachBoardDragState.id, point);
  if (!moved) return;
  coachBoardDragState.moved = true;
  _coachSyncDraggedEntityToDom(coachBoardDragState.kind, coachBoardDragState.id);
}

function coachBoardPointerUp(evt) {
  if (!coachBoardDragState) return;
  if (evt.pointerId !== coachBoardDragState.pointerId) return;

  if (typeof evt.currentTarget?.releasePointerCapture === "function") {
    try { evt.currentTarget.releasePointerCapture(evt.pointerId); } catch {}
  }

  if (coachBoardDragState.moved) {
    _coachBoardRecordFrame("Moviment");
    _coachBoardMessage("Element reposicionat.");
    coachBoardSuppressClickUntil = Date.now() + 260;
    _coachPersistBoardState();
  }

  coachBoardDragState = null;
  _coachRenderTacticsTabRoot();
}

function coachHandleBoardContextMenu(evt, kind, id) {
  evt?.preventDefault?.();
  evt?.stopPropagation?.();
  _coachEnsureBoardState();
  if (kind !== "annotation") return;
  const annotation = (coachBoardState.annotations || []).find(item => String(item?.id || "") === String(id || ""));
  if (!annotation || annotation.type !== "zone") return;

  const current = String(annotation.zoneColor || COACH_ZONE_COLORS[0]);
  const idx = COACH_ZONE_COLORS.findIndex(c => c === current);
  const next = COACH_ZONE_COLORS[(idx + 1 + COACH_ZONE_COLORS.length) % COACH_ZONE_COLORS.length] || COACH_ZONE_COLORS[0];
  annotation.zoneColor = next;
  _coachBoardRecordFrame("Color zona");
  _coachBoardMessage("Color de zona actualitzat.");
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
}

function coachHandleBoardClick(evt, kind, id) {
  _coachEnsureBoardState();
  if (Date.now() < coachBoardSuppressClickUntil) return;
  if (coachBoardDragState?.moved) return;
  const point = _coachBoardPointFromEvent(evt);
  const tool = coachBoardState.tool;

  if (tool === "erase") {
    if (kind === "annotation") {
      coachBoardState.annotations = coachBoardState.annotations.filter(item => item.id !== id);
      coachBoardState.selectedEntity = null;
      _coachBoardRecordFrame("Acció esborrada");
      _coachBoardMessage("Acció esborrada.");
    } else {
      _coachBoardMessage("Selecciona una acció dibuixada per esborrar-la.");
    }
    _coachPersistBoardState();
    _coachRenderTacticsTabRoot();
    return;
  }

  if (tool === "move") {
    if (kind === "puck" && coachBoardState.ballMode === "attached") {
      _coachBoardMessage("En mode enganxat, la bola segueix el jugador i no es pot seleccionar directament.");
      _coachRenderTacticsTabRoot();
      return;
    }
    if (kind === "player" || kind === "puck") {
      coachBoardState.selectedEntity = { kind, id };
      _coachBoardMessage(kind === "puck" ? "Pilota seleccionada. Toca el camp per moure-la." : "Jugador seleccionat. Toca el camp per moure'l.");
      _coachPersistBoardState();
      _coachRenderTacticsTabRoot();
      return;
    }

    if (!coachBoardState.selectedEntity) {
      _coachBoardMessage("Selecciona primer un jugador o la pilota.");
      _coachRenderTacticsTabRoot();
      return;
    }

    if (coachBoardState.selectedEntity.kind === "player") {
      _coachUpdateBoardEntityPosition("player", coachBoardState.selectedEntity.id, point);
    } else {
      if (coachBoardState.ballMode === "attached") {
        _coachBoardMessage("En mode enganxat, la bola segueix un jugador. Canvia a bola lliure per moure-la manualment.");
        _coachRenderTacticsTabRoot();
        return;
      }
      _coachUpdateBoardEntityPosition("puck", "puck", point);
    }
    coachBoardState.selectedEntity = null;
    _coachBoardRecordFrame("Moviment");
    _coachBoardMessage("Element reposicionat.");
    _coachPersistBoardState();
    _coachRenderTacticsTabRoot();
    return;
  }

  const actionTools = ["pass", "shot", "carry", "screen", "zone"];
  if (!actionTools.includes(tool)) return;

  if (tool === "carry" && !coachBoardState.pendingAction && kind !== "player") {
    _coachBoardMessage("Per conduir, selecciona primer un jugador i després marca el destí.");
    _coachRenderTacticsTabRoot();
    return;
  }

  if (tool === "screen" && !coachBoardState.pendingAction && kind !== "player") {
    _coachBoardMessage("Per bloquejar, selecciona primer un jugador i despres un rival.");
    _coachRenderTacticsTabRoot();
    return;
  }

  const entityPoint = _coachBoardEntityPoint(kind, id, point);
  if (!coachBoardState.pendingAction) {
    coachBoardState.pendingAction = {
      tool,
      start: { x: entityPoint.x, y: entityPoint.y },
      startKind: kind || "field",
      startId: id || "",
    };
    _coachBoardMessage(`Origen marcat per ${_coachToolMeta(tool).label.toLowerCase()}. Tria el destí.`);
    _coachPersistBoardState();
    _coachRenderTacticsTabRoot();
    return;
  }

  const pending = coachBoardState.pendingAction;
  const annOpts = {};
  if (tool === "zone") {
    annOpts.zoneColor = COACH_ZONE_COLORS[0];
  }

  if (tool === "screen") {
    const p1 = pending?.startKind === "player" ? _coachBoardPlayerById(pending.startId) : null;
    const p2 = kind === "player" ? _coachBoardPlayerById(id) : null;
    const s1 = String(p1?.side || p1?.team || "");
    const s2 = String(p2?.side || p2?.team || "");
    if (!p1 || !p2 || !s1 || !s2 || s1 === s2) {
      _coachBoardMessage("El bloqueig ha de ser entre jugadors d'equips contraris.");
      _coachRenderTacticsTabRoot();
      return;
    }
    annOpts.blockedPlayerId = String(id || "");
  }

  coachBoardState.annotations.push(_coachCreateAnnotation(tool, pending.start, entityPoint, annOpts));
  if (tool === "carry") {
    _coachMovePlayerForCarry(pending, entityPoint);
  }
  if (tool === "screen") {
    _coachMovePlayerForScreen(pending, annOpts.blockedPlayerId);
  }
  _coachBallActionFollow(tool, kind, id, entityPoint);
  coachBoardState.pendingAction = null;
  if (tool === "shot" || tool === "carry") {
    coachBoardState.tool = "move";
  }
  _coachBoardRecordFrame(`Acció ${tool}`);
  _coachBoardMessage(tool === "shot" && _coachPointInsideGoal(entityPoint)
    ? "Gol!!!"
    : `${_coachToolMeta(tool).label} afegida a la pissarra.${(tool === "shot" || tool === "carry") ? " Mode Moure activat." : ""}`);
  _coachPersistBoardState();
  _coachRenderTacticsTabRoot();
}

/* ── Window exports ──────────────────────────────────────────────────────── */
window.openCoachPanel          = openCoachPanel;
window.closeCoachPanel         = closeCoachPanel;
window.coachSwitchToCurrentSeason = coachSwitchToCurrentSeason;
window.coachSetTab             = coachSetTab;
window.coachSetMatchSubTab     = coachSetMatchSubTab;
window.coachSetTeam            = coachSetTeam;
window.coachSetClub            = coachSetClub;
window.coachSetClubSearch      = coachSetClubSearch;
window.coachSelectTabTeam      = coachSelectTabTeam;
window.coachToggleFavoriteSelectedTeam = coachToggleFavoriteSelectedTeam;
window.coachToggleFavoriteTeamChip = coachToggleFavoriteTeamChip;
window.coachTogglePillar       = coachTogglePillar;
window.coachSaveTraining       = coachSaveTraining;
window.coachDeleteTraining     = coachDeleteTraining;
window.coachEnrichSharedTraining = coachEnrichSharedTraining;
window.coachLoadCoordinatorTrainingToForm = coachLoadCoordinatorTrainingToForm;
window.coachSavePlayerObjective  = coachSavePlayerObjective;
window.coachDeletePlayerObj    = coachDeletePlayerObj;
window.coachEditPlayer         = coachEditPlayer;
window.coachPickObjectivePlayer = coachPickObjectivePlayer;
window.coachClearEditingPlayer = coachClearEditingPlayer;
window.coachAddPlayerToLineup  = coachAddPlayerToLineup;
window.coachAddRivalPlayer     = coachAddRivalPlayer;
window.coachRemovePlayer       = coachRemovePlayer;
window.coachToggleStarter      = coachToggleStarter;
window.coachSetPlayerSide      = coachSetPlayerSide;
window.coachSetPlayerPos       = coachSetPlayerPos;
window.coachLoadLineupFromConvocatoria = coachLoadLineupFromConvocatoria;
window.coachSetLineupConvocatoriaMatch = coachSetLineupConvocatoriaMatch;
window.coachLoadLineupFromSelectedConvocatoria = coachLoadLineupFromSelectedConvocatoria;
window.coachSelectUpcomingMatch = coachSelectUpcomingMatch;
window.coachSelectPreviousMatch = coachSelectPreviousMatch;
window.coachToggleLiveFullscreen = coachToggleLiveFullscreen;
window.coachAddEvent           = coachAddEvent;
window.coachRemoveEvent        = coachRemoveEvent;
window.coachSetTactic          = coachSetTactic;
window.coachSetBoardTool       = coachSetBoardTool;
window.coachToggleBallMode     = _coachToggleBallMode;
window.coachToggleBoardFullscreen = coachToggleBoardFullscreen;
window.coachToggleFullscreenFormationsCollapsed = coachToggleFullscreenFormationsCollapsed;
window.coachAddBoardPlayer     = coachAddBoardPlayer;
window.coachResetBoard         = coachResetBoard;
window.coachClearBoardActions  = coachClearBoardActions;
window.coachRemoveSelectedBoardItem = coachRemoveSelectedBoardItem;
window.coachToggleBoardRecording = coachToggleBoardRecording;
window.coachSaveBoardPlay      = coachSaveBoardPlay;
window.coachLoadSavedPlay      = coachLoadSavedPlay;
window.coachPlaySavedPlay      = coachPlaySavedPlay;
window.coachDeleteSavedPlay    = coachDeleteSavedPlay;
window.coachBoardPointerDown   = coachBoardPointerDown;
window.coachBoardPointerMove   = coachBoardPointerMove;
window.coachBoardPointerUp     = coachBoardPointerUp;
window.coachHandleBoardClick   = coachHandleBoardClick;
window.coachHandleBoardContextMenu = coachHandleBoardContextMenu;
window.coachSaveMatchEvents    = coachSaveMatchEvents;
window.renderCoachPanel        = renderCoachPanel;
