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
  { name: "1-2-1  Estàndard", desc: "Formació equilibrada. 1 defensa, 2 migs, 1 davanter.",
    positions: [{ x: 28, y: 50 }, { x: 50, y: 30 }, { x: 50, y: 70 }, { x: 72, y: 50 }] },
  { name: "2-2  Defensiu",    desc: "2 defenses, 2 davanters. Solidesa darrere.",
    positions: [{ x: 30, y: 35 }, { x: 30, y: 65 }, { x: 65, y: 35 }, { x: 65, y: 65 }] },
  { name: "3-1  Ofensiu",     desc: "Pressió alta: 1 defensa, 3 davanters.",
    positions: [{ x: 28, y: 50 }, { x: 62, y: 25 }, { x: 68, y: 50 }, { x: 62, y: 75 }] },
  { name: "1-3  Contratac",   desc: "Tanca i surt ràpid: 3 defenses, 1 davanter.",
    positions: [{ x: 30, y: 25 }, { x: 35, y: 50 }, { x: 30, y: 75 }, { x: 72, y: 50 }] },
  { name: "Diamant",          desc: "Diamant clàssic. Pivot central.",
    positions: [{ x: 28, y: 50 }, { x: 50, y: 68 }, { x: 50, y: 32 }, { x: 72, y: 50 }] },
];

const COACH_TACTIC_TOOLS = [
  { id: "move",  label: "Moure",       color: "#1a2035", hint: "Selecciona jugador o pilota i toca el camp per reposicionar." },
  { id: "pass",  label: "Passada",     color: "#2563eb", hint: "Marca origen i destí per dibuixar una passada." },
  { id: "shot",  label: "Xut",         color: "#dc2626", hint: "Marca origen i final per indicar un tir." },
  { id: "carry", label: "Conducció",   color: "#0891b2", hint: "Traça la conducció o patinada amb pilota." },
  { id: "screen",label: "Bloqueig",    color: "#d97706", hint: "Indica un bloqueig o pantalla entre dos punts." },
  { id: "zone",  label: "Zona",        color: "#7c3aed", hint: "Defineix una zona o espai ocupat en dues pulsacions." },
  { id: "erase", label: "Esborrar",    color: "#64748b", hint: "Toca una acció dibuixada per eliminar-la." },
];

const COACH_TACTIC_PLAYBOOK_KEY = "hoquei_coach_playbook_v1";
const COACH_CONVOCATORIA_CACHE_KEY = "hoquei_coordinator_convocatorias_v2";

/* ── State ───────────────────────────────────────────────────────────────── */
let coachPanelTab        = "planning";
let coachClubInput       = "";
let coachClubSearch      = "";
let coachTeamInput       = "";   // overrides currentProfile.team_name when set
let coachTrainings       = [];
let coachTrainingsLoaded = false;
let coachPlanningPillars = [];
let coachPlanningDate    = new Date().toISOString().slice(0, 10);
let coachPlanningDuration = 90;
let coachPlanningNotes   = "";

let coachPlayerObjs      = {};   // { player_name: { id, pillar_data, notes } }
let coachPlayerObjsTeam  = null; // team used when last loaded
let coachPlayerObjsLoaded = false;
let coachEditingPlayer   = null; // name of player being edited in the form

let coachMatchState = {
  matchDate: new Date().toISOString().slice(0, 10),
  opponent:  "",
  isHome:    true,
  players:   [],   // [{name, isStarter, side:"D"|"E", pos:"DEF"|"MIG"|"DAV"|"PORT"}]
  events:    [],   // [{player, type, minute, ts}]
  savedId:   null,
};
let coachMatchSubTab = "lineup";
let coachTacticIdx   = 0;
let coachBoardState  = null;
let coachSavedPlays  = [];
let coachTacticsMsg  = "";
let coachPlaybackTimer = null;

/* ── Internal helpers ────────────────────────────────────────────────────── */
function _cesc(s) {
  return typeof esc === "function"
    ? esc(s)
    : String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function _csb()  { return typeof _sb !== "undefined" ? _sb : null; }
function _cuid() { return (typeof currentUser !== "undefined" ? currentUser?.id : null) || (typeof currentProfile !== "undefined" ? currentProfile?.id : null) || null; }
function _cclub() { return coachClubInput || ""; }
function _cteam() { return coachTeamInput || (typeof currentProfile !== "undefined" ? currentProfile?.team_name : "") || ""; }

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

function _coachSearchNorm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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
  const addPair = (clubName, teamName) => {
    const club = String(clubName || "").trim();
    const team = String(teamName || "").trim();
    if (!club || !team) return;
    if (!map.has(club)) map.set(club, new Set());
    map.get(club).add(team);
  };

  if (typeof buildClubMap === "function") {
    try {
      const clubMap = buildClubMap();
      for (const [, club] of clubMap.entries()) {
        for (const t of (club?.teams || [])) {
          addPair(club?.displayName || "", t?.teamName || "");
        }
      }
    } catch {
      // Fallback to convocatoria cache when global DB map is not ready yet.
    }
  }

  const convStore = _coachLoadConvocatoriaStore();
  for (const key of Object.keys(convStore || {})) {
    const parts = String(key || "").split("::");
    if (parts.length >= 2) addPair(parts[0], parts[1]);
  }

  return [...map.entries()]
    .map(([clubName, teamSet]) => ({
      clubName,
      teams: [...teamSet].sort((a, b) => String(a).localeCompare(String(b))),
    }))
    .sort((a, b) => String(a.clubName).localeCompare(String(b.clubName)));
}

function _coachEnsureTeamSelection() {
  const options = _coachBuildClubTeamOptions();
  const profileTeam = String(typeof currentProfile !== "undefined" ? currentProfile?.team_name || "" : "").trim();

  if (!options.length) {
    if (!coachTeamInput && profileTeam) coachTeamInput = profileTeam;
    return options;
  }

  let selectedClub = options.find(o => String(o.clubName) === String(coachClubInput || "")) || null;
  let selectedTeam = String(coachTeamInput || "").trim();

  if (!selectedClub && selectedTeam) {
    selectedClub = options.find(o => (o.teams || []).some(t => _coachTeamEq(t, selectedTeam) || _coachTeamLoose(t, selectedTeam))) || null;
  }

  if (!selectedClub && profileTeam) {
    selectedClub = options.find(o => (o.teams || []).some(t => _coachTeamEq(t, profileTeam) || _coachTeamLoose(t, profileTeam))) || null;
    if (selectedClub && !selectedTeam) {
      selectedTeam = (selectedClub.teams || []).find(t => _coachTeamEq(t, profileTeam)) || profileTeam;
    }
  }

  if (!selectedClub) selectedClub = options[0] || null;
  if (!selectedClub) return options;

  const hasTeamInClub = (selectedClub.teams || []).some(t => _coachTeamEq(t, selectedTeam));
  if (!selectedTeam || !hasTeamInClub) selectedTeam = selectedClub.teams?.[0] || "";

  coachClubInput = selectedClub.clubName;
  coachTeamInput = selectedTeam;
  return options;
}

function _coachFindLatestConvocatoria(clubName, teamName) {
  const store = _coachLoadConvocatoriaStore();
  const prefix = `${String(clubName || "").trim()}::${String(teamName || "").trim()}::`;
  let latest = null;
  let latestTs = 0;
  for (const [key, convocatoria] of Object.entries(store || {})) {
    if (!String(key).startsWith(prefix)) continue;
    const ts = Date.parse(convocatoria?.createdAt || convocatoria?.updatedAt || "") || 0;
    if (ts >= latestTs) {
      latestTs = ts;
      latest = convocatoria;
    }
  }
  return latest;
}

function _coachRosterFromConvocatoria(clubName, teamName) {
  const convocatoria = _coachFindLatestConvocatoria(clubName, teamName);
  if (!convocatoria || !Array.isArray(convocatoria.players)) return [];
  const included = convocatoria.players.filter(p => p?.checked !== false && p?.status !== "baixa");
  const source = included.length ? included : convocatoria.players;
  return source
    .map(p => ({
      name: String(p?.name || "").trim(),
      pos: /porter|gk/i.test(String(p?.position || "")) ? "PORT" : "MIG",
      isStarter: p?.checked !== false,
      side: "D",
    }))
    .filter(p => p.name)
    .filter((p, idx, arr) => arr.findIndex(x => teamMatchesCalendarExact(x.name, p.name)) === idx);
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

function _coachBoardPlayerColor(team) {
  if (team === "away") return "#ffffff";
  if (team === "goalie") return "#fbbf24";
  return "#ef4444";
}

function _coachBoardPlayerTextColor(team) {
  return team === "away" ? "#0f172a" : "#ffffff";
}

function _coachBuildBoardPlayers(tacticIdx) {
  const tactic = COACH_TACTICS[tacticIdx] || COACH_TACTICS[0];
  const labels = ["D", "M1", "M2", "A"];
  const players = [{
    id: "gk_home",
    label: "GK",
    team: "goalie",
    x: 9,
    y: 50,
  }];

  (tactic.positions || []).forEach((pos, idx) => {
    players.push({
      id: `home_${idx + 1}`,
      label: labels[idx] || `P${idx + 1}`,
      team: "home",
      x: pos.x,
      y: pos.y,
    });
  });

  players.push(
    { id: "away_1", label: "R1", team: "away", x: 66, y: 26 },
    { id: "away_2", label: "R2", team: "away", x: 71, y: 50 },
    { id: "away_3", label: "R3", team: "away", x: 66, y: 74 },
    { id: "away_gk", label: "GK", team: "away", x: 91, y: 50 }
  );

  return players;
}

function _coachDefaultBoardState(tacticIdx = coachTacticIdx) {
  return {
    tacticIdx,
    tool: "move",
    players: _coachBuildBoardPlayers(tacticIdx),
    puck: { x: 22, y: 50 },
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
    coachBoardState = _coachDefaultBoardState(coachTacticIdx);
    coachBoardState.fullscreen = fullscreen;
  }
}

function _coachCurrentBoardSnapshot() {
  _coachEnsureBoardState();
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
  const recording = coachBoardState?.recording || false;
  const recordingFrames = recording ? (coachBoardState?.recordingFrames || []) : [];

  coachTacticIdx = _clamp(nextTacticIdx, 0, COACH_TACTICS.length - 1);
  coachBoardState = _coachDefaultBoardState(coachTacticIdx);
  coachBoardState.players = Array.isArray(snapshot?.players) && snapshot.players.length
    ? _cclone(snapshot.players)
    : coachBoardState.players;
  coachBoardState.puck = snapshot?.puck ? _cclone(snapshot.puck) : coachBoardState.puck;
  coachBoardState.annotations = Array.isArray(snapshot?.annotations) ? _cclone(snapshot.annotations) : [];
  coachBoardState.fullscreen = fullscreen;
  coachBoardState.tool = tool;
  coachBoardState.recording = recording;
  coachBoardState.recordingFrames = recordingFrames;
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
    y: _clamp(y, 6, 94),
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

function _coachCreateAnnotation(tool, start, end) {
  return {
    id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: tool,
    start: { x: start.x, y: start.y },
    end: { x: end.x, y: end.y },
  };
}

function _coachRenderTacticsTabRoot() {
  const root = document.getElementById("coach-tactics-root");
  if (root) root.innerHTML = _renderTacticsPanelInner();
}

/* ── Open / Close ────────────────────────────────────────────────────────── */
function openCoachPanel() {
  if (typeof profileHasRole === "function" && !profileHasRole(currentProfile, "entrenador")) {
    alert("No tens permisos d'entrenador.");
    return;
  }
  ["screen-home", "screen-picker", "screen-detail", "screen-acta", "screen-team",
   "screen-admin", "screen-coordinator"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  coachTeamInput = coachTeamInput || (typeof currentProfile !== "undefined" ? currentProfile?.team_name : "") || "";
  const el = document.getElementById("screen-coach");
  if (el) el.style.display = "flex";
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

function coachSetTab(tab) {
  coachPanelTab = tab;
  renderCoachPanel();
}

function coachSetMatchSubTab(tab) {
  coachMatchSubTab = tab;
  renderCoachPanel();
}

/* ── Main render ─────────────────────────────────────────────────────────── */
async function renderCoachPanel(clubSearchCursor) {
  const body = document.getElementById("coach-body");
  if (!body) return;

  const options = _coachEnsureTeamSelection();
  const team = _cteam();
  const club = _cclub();
  const query = _coachSearchNorm(coachClubSearch);
  const filteredClubOptions = query
    ? options.filter(o => _coachSearchNorm(o.clubName).includes(query))
    : options;
  const visibleClubOptions = filteredClubOptions.length ? filteredClubOptions : options;
  const selectedClub = options.find(o => o.clubName === club) || null;
  const teamOptions = (selectedClub?.teams || []).map(t => `<option value="${_cesc(t)}" ${teamMatchesCalendarExact(t, team) ? "selected" : ""}>${_cesc(t)}</option>`).join("");

  const teamRow = options.length
    ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <label style="font-size:13px;font-weight:700;color:#64748b;white-space:nowrap">Club:</label>
        <input id="coach-club-search" value="${_cesc(coachClubSearch)}" placeholder="🔍 Cerca club..." oninput="coachSetClubSearch(this.value, this.selectionStart)" style="min-width:220px;flex:1;max-width:340px;padding:9px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff"/>
        <select onchange="coachSetClub(this.value)" style="min-width:220px;flex:1;max-width:340px;padding:9px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff">
          ${visibleClubOptions.map(o => `<option value="${_cesc(o.clubName)}" ${o.clubName === club ? "selected" : ""}>${_cesc(o.clubName)}</option>`).join("")}
        </select>
        <label style="font-size:13px;font-weight:700;color:#64748b;white-space:nowrap">Equip:</label>
        <select onchange="coachSetTeam(this.value)" style="min-width:220px;flex:1;max-width:380px;padding:9px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff">
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
  else if (coachPanelTab === "match") content = _renderMatchTab();

  body.innerHTML = teamRow + tabsHtml + content;
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
  if (!coachTrainingsLoaded || coachPlayerObjsTeam !== _cteam()) {
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
        const badges = (t.pillars || []).map(pid => {
          const p = COACH_PILLARS.find(x => x.id === pid);
          return p ? `<span style="background:${p.color};color:#fff;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">${p.short}</span>` : "";
        }).join(" ");
        return `<div style="background:#fff;border:1px solid #e2e6ef;border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
              <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;color:#1a2035">${_cesc(t.plan_date || "")}</span>
              <span style="font-size:12px;color:#64748b">${dur}</span>
              <div style="display:flex;gap:3px;flex-wrap:wrap">${badges}</div>
            </div>
            ${t.notes ? `<div style="font-size:12px;color:#64748b;line-height:1.4">${_cesc(t.notes)}</div>` : ""}
          </div>
          <button onclick="coachDeleteTraining('${t.id}')" title="Eliminar" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:16px;padding:2px 4px;flex-shrink:0">✕</button>
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
  const team = _cteam();
  const club = _cclub();
  if (!coachPlayerObjsLoaded || coachPlayerObjsTeam !== team) {
    await _loadPlayerObjectives(team);
  }

  const rosterNames = _coachRosterFromConvocatoria(club, team).map(p => p.name);
  const players = [...new Set([...Object.keys(coachPlayerObjs), ...rosterNames])].sort((a, b) => String(a).localeCompare(String(b)));

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
      <input id="coach-new-player" type="text" placeholder="Nom del jugador..." value="${_cesc(coachEditingPlayer || "")}"
        style="width:100%;padding:10px 13px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px"/>
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
              { data: COACH_PILLARS.map(p => Number(obj.pillar_data?.[p.id]?.baseline || 0)) },
              { data: COACH_PILLARS.map(p => Number(obj.pillar_data?.[p.id]?.target || 0)) },
              { data: COACH_PILLARS.map(p => Number(obj.pillar_data?.[p.id]?.progress || 0)) },
            ],
          }, 210);
          /* Forecast: avg distance target→progress */
          const deltas = COACH_PILLARS.map(p => {
            const d = obj.pillar_data?.[p.id] || {};
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

  const rosterHint = team
    ? `<div style="background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:9px 11px;margin-bottom:10px;font-size:12px;color:#475569">Jugadors carregats per l'equip seleccionat (${_cesc(team)}): <b style="color:#1a2035">${rosterNames.length}</b></div>`
    : "";

  return rosterHint + addForm + cards;
}

/* ══════════════════════════════════════════════════════════════════════════
   MATCH TAB
══════════════════════════════════════════════════════════════════════════ */
function _renderMatchTab() {
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
  const starters = players.filter(p => p.isStarter);
  const byPos = pos => starters.filter(p => p.pos === pos).map(p => _cesc(p.name)).join(", ") || "—";

  const playerRows = players.map((p, i) =>
    `<tr style="border-bottom:1px solid #f0f4f8">
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
    </tr>`
  ).join("");

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">

      <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">Info del Partit</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div>
            <div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:4px">Data</div>
            <input type="date" value="${matchDate}" onchange="coachMatchState.matchDate=this.value"
              style="width:100%;padding:9px 10px;border:1.5px solid #e2e6ef;border-radius:9px;font-size:13px;font-family:inherit;outline:none"/>
          </div>
          <div>
            <div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:4px">Rival</div>
            <input type="text" value="${_cesc(opponent)}" placeholder="Nom rival..."
              onchange="coachMatchState.opponent=this.value"
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
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">Afegir Jugador</div>
        <button onclick="coachLoadLineupFromConvocatoria()" style="width:100%;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;font-weight:700;font-size:12px;padding:9px;border-radius:10px;cursor:pointer;margin-bottom:8px">Carregar jugadors de convocatòries (${_cesc(club || "club")}${team ? ` · ${_cesc(team)}` : ""})</button>
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
    </div>

    ${players.length ? `
    <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px;margin-top:14px;overflow-x:auto">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:10px">Plantilla — ${players.length} jugadors · ${starters.length} titulars</div>
      <table style="width:100%;border-collapse:collapse;min-width:380px">
        <thead><tr style="border-bottom:2px solid #e2e6ef">
          <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Jugador</th>
          <th style="padding:8px;text-align:center;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Estat</th>
          <th style="padding:8px;text-align:center;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Mà</th>
          <th style="padding:8px;text-align:center;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Pos</th>
          <th style="padding:8px;"></th>
        </tr></thead>
        <tbody>${playerRows}</tbody>
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
  const savedPlays = _coachActiveSavedPlays();

  const tacBtns = COACH_TACTICS.map((t, i) =>
    `<button onclick="coachSetTactic(${i})" style="background:${i === coachTacticIdx ? "#1a2035" : "#fff"};border:1.5px solid ${i === coachTacticIdx ? "#1a2035" : "#e2e6ef"};color:${i === coachTacticIdx ? "#fff" : "#334155"};font-weight:600;font-size:12px;padding:9px 13px;border-radius:10px;cursor:pointer;text-align:left;width:100%">
      <div style="font-weight:700">${_cesc(t.name)}</div>
      <div style="font-size:10px;opacity:.65;margin-top:2px;line-height:1.3">${_cesc(t.desc)}</div>
    </button>`
  ).join("");

  const toolButtons = COACH_TACTIC_TOOLS.map(tool => {
    const on = coachBoardState.tool === tool.id;
    return `<button onclick="coachSetBoardTool('${tool.id}')" style="background:${on ? tool.color : "#fff"};border:1.5px solid ${on ? tool.color : "#dbe3f0"};color:${on ? "#fff" : "#334155"};font-weight:700;font-size:12px;padding:8px 11px;border-radius:999px;cursor:pointer">${_cesc(tool.label)}</button>`;
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

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
      <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">Formacions base</div>
        <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:16px">${tacBtns}</div>
        <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Eines habituals</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${toolButtons}</div>
        <div style="font-size:12px;color:${activeTool.color};font-weight:700;margin-bottom:10px">${_cesc(activeTool.hint)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <button onclick="coachAddBoardPlayer('home')" style="background:#fee2e2;border:1px solid #fecaca;color:#b91c1c;font-weight:700;font-size:12px;padding:8px 10px;border-radius:9px;cursor:pointer">+ Atacant</button>
          <button onclick="coachAddBoardPlayer('away')" style="background:#e2e8f0;border:1px solid #cbd5e1;color:#334155;font-weight:700;font-size:12px;padding:8px 10px;border-radius:9px;cursor:pointer">+ Rival</button>
          <button onclick="coachResetBoard()" style="background:#f8fafc;border:1px solid #e2e6ef;color:#475569;font-weight:700;font-size:12px;padding:8px 10px;border-radius:9px;cursor:pointer">Reset formació</button>
          <button onclick="coachClearBoardActions()" style="background:#f8fafc;border:1px solid #e2e6ef;color:#475569;font-weight:700;font-size:12px;padding:8px 10px;border-radius:9px;cursor:pointer">Netejar accions</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
          <button onclick="coachToggleBoardRecording()" style="background:${coachBoardState.recording ? "#b91c1c" : "#fff"};border:1.5px solid ${coachBoardState.recording ? "#b91c1c" : "#fecaca"};color:${coachBoardState.recording ? "#fff" : "#b91c1c"};font-weight:800;font-size:12px;padding:8px 11px;border-radius:999px;cursor:pointer">${coachBoardState.recording ? "Aturar gravació" : "Gravar jugada"}</button>
          <button onclick="coachSaveBoardPlay()" style="background:#1a2035;border:none;color:#fff;font-weight:800;font-size:12px;padding:8px 11px;border-radius:999px;cursor:pointer">Guardar com a jugada</button>
          ${recordingBadge}
        </div>
        <div style="font-size:11px;color:#64748b;line-height:1.5;background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:10px">
          Opcions comunes afegides: moviment de jugadors, passades, xuts, conduccions, bloquejos, zones, jugadors rivals, gravació seqüencial i reproducció de jugades.
        </div>
      </div>

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
          <button onclick="coachRemoveSelectedBoardItem()" style="background:#f8fafc;border:1px solid #e2e6ef;color:#475569;font-weight:700;font-size:12px;padding:9px 12px;border-radius:10px;cursor:pointer">Eliminar seleccionat</button>
        </div>
      </div>
      <div style="font-size:12px;color:${_coachToolMeta(coachBoardState.tool).color};font-weight:700;margin-bottom:10px">${_cesc(msg)}</div>
      <div style="background:linear-gradient(180deg,#dbeafe 0%,#eff6ff 100%);border-radius:16px;padding:${isFullscreen ? "12px" : "10px"};border:1px solid #bfdbfe;min-height:${isFullscreen ? "calc(100vh - 170px)" : "320px"};display:flex;align-items:center;justify-content:center">
        ${_tacticSVGInteractive(isFullscreen)}
      </div>
    </div>`;

  if (!isFullscreen) return `<div>${inner}</div>`;

  return `
    <div style="position:fixed;inset:0;z-index:480;background:rgba(15,23,42,.78);padding:18px;display:flex;align-items:stretch;justify-content:center">
      <div style="width:min(1400px,100%);height:100%;display:flex;align-items:stretch">${inner}</div>
    </div>`;
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
  const activePlayers = players.filter(p => p.isStarter).length > 0
    ? players.filter(p => p.isStarter)
    : players;

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

  const playerBtns = activePlayers.map(p => {
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
        <span>${_cesc(p.name)}</span>
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

  return `
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
        <button onclick="coachSaveMatchEvents()" style="width:100%;background:#1a2035;border:none;color:#fff;font-weight:700;font-size:13px;padding:11px;border-radius:10px;cursor:pointer">💾 Desar dades</button>
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
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px">${playerBtns}</div>`
        : `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px">Afegeix jugadors a la plantilla (Pre-Partit) per registrar accions.</div>`}
    </div>`;
}

/* ── Tàctiques ──────────────────────────────────────────────────────────── */
function _renderTacticsTab() {
  const tactic = COACH_TACTICS[coachTacticIdx];

  const tacBtns = COACH_TACTICS.map((t, i) =>
    `<button onclick="coachSetTactic(${i})" style="background:${i === coachTacticIdx ? "#1a2035" : "#fff"};border:1.5px solid ${i === coachTacticIdx ? "#1a2035" : "#e2e6ef"};color:${i === coachTacticIdx ? "#fff" : "#334155"};font-weight:600;font-size:12px;padding:9px 13px;border-radius:10px;cursor:pointer;text-align:left;width:100%">
      <div style="font-weight:700">${_cesc(t.name)}</div>
      <div style="font-size:10px;opacity:.65;margin-top:2px;line-height:1.3">${_cesc(t.desc)}</div>
    </button>`
  ).join("");

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">
      <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">Formació</div>
        <div style="display:flex;flex-direction:column;gap:7px">${tacBtns}</div>
      </div>
      <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:900;color:#1a2035;margin-bottom:4px">${_cesc(tactic.name)}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:14px">${_cesc(tactic.desc)}</div>
        <div style="display:flex;justify-content:center">${_tacticSVG(tactic)}</div>
      </div>
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
  const width = isFullscreen ? 1200 : 760;
  const height = isFullscreen ? 720 : 460;
  const playerSvg = (coachBoardState.players || []).map(player => {
    const selected = coachBoardState.selectedEntity?.kind === "player" && coachBoardState.selectedEntity?.id === player.id;
    const fill = _coachBoardPlayerColor(player.team);
    const textColor = _coachBoardPlayerTextColor(player.team);
    return `<g onclick="coachHandleBoardClick(event,'player','${_cesc(player.id)}');event.stopPropagation();" style="cursor:pointer">
      <circle cx="${player.x}" cy="${player.y}" r="3.3" fill="${fill}" stroke="${selected ? "#fde68a" : "#0f172a"}" stroke-width="${selected ? "0.9" : "0.45"}" />
      <text x="${player.x}" y="${player.y + 0.3}" text-anchor="middle" dominant-baseline="middle" font-size="2.1" fill="${textColor}" font-family="'Barlow Condensed',sans-serif" font-weight="700">${_cesc(player.label)}</text>
    </g>`;
  }).join("");

  const puckSelected = coachBoardState.selectedEntity?.kind === "puck";
  const puckSvg = `<g onclick="coachHandleBoardClick(event,'puck','puck');event.stopPropagation();" style="cursor:pointer">
    <circle cx="${coachBoardState.puck.x}" cy="${coachBoardState.puck.y}" r="1.25" fill="#0f172a" stroke="${puckSelected ? "#fde68a" : "#ffffff"}" stroke-width="0.55" />
  </g>`;

  const annotationsSvg = (coachBoardState.annotations || []).map(annotation => {
    const a = annotation.start || { x: 50, y: 50 };
    const b = annotation.end || a;
    const meta = {
      pass:   { stroke: "#2563eb", dash: "2.3 1.6", marker: "url(#coach-arrow-blue)", label: "PASS" },
      shot:   { stroke: "#dc2626", dash: "",        marker: "url(#coach-arrow-red)",  label: "XUT" },
      carry:  { stroke: "#0891b2", dash: "1.6 1.1", marker: "url(#coach-arrow-cyan)", label: "COND" },
      screen: { stroke: "#d97706", dash: "0.7 1.1", marker: "url(#coach-arrow-gold)", label: "BLQ" },
      zone:   { stroke: "#7c3aed", dash: "1.4 1.2", marker: "",                       label: "ZONA" },
    }[annotation.type] || { stroke: "#64748b", dash: "", marker: "", label: "ACC" };

    if (annotation.type === "zone") {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.max(2, Math.abs(a.x - b.x));
      const h = Math.max(2, Math.abs(a.y - b.y));
      return `<g onclick="coachHandleBoardClick(event,'annotation','${_cesc(annotation.id)}');event.stopPropagation();" style="cursor:pointer">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.8" fill="rgba(124,58,237,0.12)" stroke="${meta.stroke}" stroke-width="0.55" stroke-dasharray="${meta.dash}" />
        <text x="${x + w / 2}" y="${y - 1.4}" text-anchor="middle" font-size="2" fill="${meta.stroke}" font-family="'Barlow Condensed',sans-serif" font-weight="700">${meta.label}</text>
      </g>`;
    }

    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    return `<g onclick="coachHandleBoardClick(event,'annotation','${_cesc(annotation.id)}');event.stopPropagation();" style="cursor:pointer">
      <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${meta.stroke}" stroke-width="0.6" stroke-dasharray="${meta.dash}" marker-end="${meta.marker}" />
      <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="transparent" stroke-width="4" />
      <text x="${midX}" y="${midY - 1.7}" text-anchor="middle" font-size="2" fill="${meta.stroke}" font-family="'Barlow Condensed',sans-serif" font-weight="700">${meta.label}</text>
    </g>`;
  }).join("");

  const pending = coachBoardState.pendingAction;
  const pendingSvg = pending
    ? `<circle cx="${pending.start.x}" cy="${pending.start.y}" r="1.6" fill="${_coachToolMeta(pending.tool).color}" opacity="0.35" />`
    : "";

  return `<svg id="coach-tactics-board-svg" data-coach-board="1" width="100%" height="100%" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" onclick="coachHandleBoardClick(event)">
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

    <rect x="1" y="1" width="98" height="58" rx="8" fill="url(#coach-rink-bg)" stroke="#0f172a" stroke-width="0.35" />
    <rect x="3.2" y="3.2" width="93.6" height="53.6" rx="6.5" fill="#dbeafe" stroke="#ffffff" stroke-width="0.45" />
    <line x1="50" y1="3.2" x2="50" y2="56.8" stroke="#ef4444" stroke-width="0.38" />
    <line x1="27" y1="3.2" x2="27" y2="56.8" stroke="#2563eb" stroke-width="0.34" opacity="0.85" />
    <line x1="73" y1="3.2" x2="73" y2="56.8" stroke="#2563eb" stroke-width="0.34" opacity="0.85" />
    <circle cx="50" cy="30" r="5.5" fill="none" stroke="#ef4444" stroke-width="0.3" />
    <circle cx="17" cy="18" r="4.5" fill="none" stroke="#ef4444" stroke-width="0.25" opacity="0.9" />
    <circle cx="17" cy="42" r="4.5" fill="none" stroke="#ef4444" stroke-width="0.25" opacity="0.9" />
    <circle cx="83" cy="18" r="4.5" fill="none" stroke="#ef4444" stroke-width="0.25" opacity="0.9" />
    <circle cx="83" cy="42" r="4.5" fill="none" stroke="#ef4444" stroke-width="0.25" opacity="0.9" />
    <line x1="7" y1="24" x2="7" y2="36" stroke="#dc2626" stroke-width="0.35" />
    <line x1="93" y1="24" x2="93" y2="36" stroke="#dc2626" stroke-width="0.35" />
    <path d="M7,24 Q13,30 7,36" fill="none" stroke="#60a5fa" stroke-width="0.32" />
    <path d="M93,24 Q87,30 93,36" fill="none" stroke="#60a5fa" stroke-width="0.32" />
    <rect x="4.7" y="21" width="2.3" height="18" fill="rgba(255,255,255,.25)" stroke="#ffffff" stroke-width="0.3" />
    <rect x="93" y="21" width="2.3" height="18" fill="rgba(255,255,255,.25)" stroke="#ffffff" stroke-width="0.3" />
    <rect x="3.2" y="3.2" width="93.6" height="53.6" rx="6.5" fill="transparent" />
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
  if (!sb || !_cuid()) return;
  const team = _cteam();
  let q = sb.from("coach_training_plans").select("*").eq("coach_user_id", _cuid());
  if (team) q = q.eq("team_name", team);
  q = q.order("plan_date", { ascending: true });
  const { data, error } = await q;
  if (!error && data) coachTrainings = data;
}

async function coachSaveTraining() {
  const sb  = _csb();
  const msg = document.getElementById("coach-plan-msg");
  const setMsg = (txt, color) => { if (msg) { msg.style.color = color || "#64748b"; msg.textContent = txt; } };

  if (!sb || !_cuid()) { setMsg("Sessió no activa.", "#e5001c"); return; }
  const team = _cteam();
  if (!team) { setMsg("Indica primer l'equip.", "#e5001c"); return; }
  const date = (document.getElementById("coach-plan-date")?.value || coachPlanningDate).trim();
  if (!date) { setMsg("Selecciona una data.", "#e5001c"); return; }

  setMsg("Desant...");
  const { error } = await sb.from("coach_training_plans").insert({
    coach_user_id:    _cuid(),
    team_name:        team,
    plan_date:        date,
    duration_minutes: Number(document.getElementById("coach-plan-dur")?.value || coachPlanningDuration) || 90,
    pillars:          coachPlanningPillars,
    notes:            (document.getElementById("coach-plan-notes")?.value || coachPlanningNotes).trim() || null,
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
  if (!sb || !_cuid()) return;
  const { error } = await sb.from("coach_training_plans").delete().eq("id", id).eq("coach_user_id", _cuid());
  if (error) { alert("Error: " + error.message); return; }
  coachTrainings = coachTrainings.filter(t => t.id !== id);
  renderCoachPanel();
}

async function _loadPlayerObjectives(team) {
  const sb = _csb();
  coachPlayerObjs       = {};
  coachPlayerObjsTeam   = team || "";
  coachPlayerObjsLoaded = true;
  if (!sb || !_cuid()) return;
  let q = sb.from("coach_player_objectives").select("*").eq("coach_user_id", _cuid());
  if (team !== null && team !== undefined) q = q.eq("team_name", team);
  const { data, error } = await q;
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

  if (!sb || !_cuid()) { setMsg("Sessió no activa.", "#e5001c"); return; }
  const name = (document.getElementById("coach-new-player")?.value || "").trim();
  if (!name) { setMsg("Introdueix el nom del jugador.", "#e5001c"); return; }
  const team = _cteam();

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
      .update({ pillar_data: pillarData, updated_at: new Date().toISOString() })
      .eq("id", existing.id));
  } else {
    ({ error } = await sb.from("coach_player_objectives").upsert({
      coach_user_id: _cuid(),
      team_name:     team || "",
      player_name:   name,
      season:        "2025-26",
      pillar_data:   pillarData,
    }, { onConflict: "coach_user_id,team_name,player_name,season" }));
  }

  if (error) {
    setMsg("Error: " + error.message, "#e5001c");
  } else {
    setMsg("✓ Objectius desats.", "#16a34a");
    coachEditingPlayer    = null;
    coachPlayerObjsLoaded = false;
    await _loadPlayerObjectives(team);
    renderCoachPanel();
  }
}

async function coachDeletePlayerObj(playerName) {
  if (!confirm(`Eliminar objectius de ${playerName}?`)) return;
  const sb = _csb();
  if (!sb || !_cuid()) return;
  const existing = coachPlayerObjs[playerName];
  let error;
  if (existing?.id) {
    ({ error } = await sb.from("coach_player_objectives").delete().eq("id", existing.id));
  }
  if (error) { alert("Error: " + error.message); return; }
  coachPlayerObjsLoaded = false;
  await _loadPlayerObjectives(_cteam());
  renderCoachPanel();
}

async function coachSaveMatchEvents() {
  const sb  = _csb();
  const msg = document.getElementById("coach-match-msg");
  const setMsg = (txt, color) => { if (msg) { msg.style.color = color || "#64748b"; msg.textContent = txt; } };

  if (!sb || !_cuid()) { setMsg("Sessió no activa.", "#e5001c"); return; }
  const team = _cteam();
  if (!team) { setMsg("Indica l'equip.", "#e5001c"); return; }
  setMsg("Desant...");

  const payload = {
    coach_user_id:     _cuid(),
    team_name:         team,
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
    ({ error } = await sb.from("coach_match_events").update(payload).eq("id", coachMatchState.savedId));
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

function coachSetTeam(val) {
  coachTeamInput        = (val || "").trim();
  coachTrainingsLoaded  = false;
  coachPlayerObjsLoaded = false;
  coachEditingPlayer    = null;
}

function coachSetClub(val) {
  coachClubInput = (val || "").trim();
  coachClubSearch = coachClubInput;
  const options = _coachBuildClubTeamOptions();
  const selected = options.find(o => o.clubName === coachClubInput) || null;
  if (selected && selected.teams.length) {
    coachTeamInput = selected.teams[0];
  }
  coachTrainingsLoaded = false;
  coachPlayerObjsLoaded = false;
  coachEditingPlayer = null;
  renderCoachPanel();
}

function coachSetClubSearch(value, cursor) {
  coachClubSearch = String(value || "");
  renderCoachPanel(Number.isFinite(Number(cursor)) ? Number(cursor) : undefined);
}

function coachLoadLineupFromConvocatoria() {
  const club = _cclub();
  const team = _cteam();
  if (!club || !team) {
    alert("Selecciona club i equip.");
    return;
  }

  const players = _coachRosterFromConvocatoria(club, team);
  if (!players.length) {
    alert("No hi ha convocatòries disponibles per aquest equip.");
    return;
  }

  coachMatchState.players = players;
  const convocatoria = _coachFindLatestConvocatoria(club, team);
  if (convocatoria) {
    coachMatchState.matchDate = String(convocatoria.matchDate || coachMatchState.matchDate || "").slice(0, 10) || coachMatchState.matchDate;
    const isHome = teamMatchesLoose(convocatoria.matchHome || "", team) || teamMatchesCalendarExact(convocatoria.matchHome || "", team);
    coachMatchState.isHome = !!isHome;
    coachMatchState.opponent = isHome ? String(convocatoria.matchAway || "") : String(convocatoria.matchHome || "");
  }
  renderCoachPanel();
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
  setTimeout(() => document.getElementById("coach-new-player")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
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
    isStarter: document.getElementById("coach-add-starter")?.checked ?? true,
    side:      document.getElementById("coach-add-side")?.value || "D",
    pos:       document.getElementById("coach-add-pos")?.value  || "MIG",
  });
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
  coachMatchState.events.push({ player: playerName, type: eventType, minute: null, ts: Date.now() });
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
  _coachRenderTacticsTabRoot();
}

function coachSetBoardTool(toolId) {
  _coachEnsureBoardState();
  coachBoardState.tool = toolId;
  coachBoardState.selectedEntity = null;
  coachBoardState.pendingAction = null;
  _coachBoardMessage(_coachToolMeta(toolId).hint);
  _coachRenderTacticsTabRoot();
}

function coachToggleBoardFullscreen() {
  _coachEnsureBoardState();
  coachBoardState.fullscreen = !coachBoardState.fullscreen;
  _coachRenderTacticsTabRoot();
}

function coachAddBoardPlayer(team) {
  _coachEnsureBoardState();
  const isAway = team === "away";
  const sameTeam = coachBoardState.players.filter(player => player.team === (isAway ? "away" : "home") && player.team !== "goalie");
  const nextIdx = sameTeam.length + 1;
  coachBoardState.players.push({
    id: `${isAway ? "away" : "home"}_extra_${Date.now()}`,
    label: `${isAway ? "R" : "A"}${nextIdx}`,
    team: isAway ? "away" : "home",
    x: isAway ? 64 : 36,
    y: _clamp(18 + nextIdx * 6, 12, 88),
  });
  _coachBoardRecordFrame(isAway ? "Afegit rival" : "Afegit atacant");
  _coachBoardMessage(isAway ? "Rival afegit al camp." : "Jugador propi afegit al camp.");
  _coachRenderTacticsTabRoot();
}

function coachResetBoard() {
  _coachStopPlayback();
  _coachEnsureBoardState(true);
  _coachBoardMessage("Pissarra reiniciada a la formació base.");
  _coachRenderTacticsTabRoot();
}

function coachClearBoardActions() {
  _coachEnsureBoardState();
  coachBoardState.annotations = [];
  coachBoardState.pendingAction = null;
  coachBoardState.selectedEntity = null;
  _coachBoardRecordFrame("Neteja d'accions");
  _coachBoardMessage("Accions esborrades.");
  _coachRenderTacticsTabRoot();
}

function coachRemoveSelectedBoardItem() {
  _coachEnsureBoardState();
  if (coachBoardState.selectedEntity?.kind === "player") {
    const idx = coachBoardState.players.findIndex(player => player.id === coachBoardState.selectedEntity.id);
    if (idx >= 0 && coachBoardState.players[idx].team !== "goalie") {
      coachBoardState.players.splice(idx, 1);
      coachBoardState.selectedEntity = null;
      _coachBoardRecordFrame("Jugador eliminat");
      _coachBoardMessage("Jugador eliminat de la pissarra.");
      _coachRenderTacticsTabRoot();
      return;
    }
  }
  if (coachBoardState.selectedEntity?.kind === "annotation") {
    coachBoardState.annotations = coachBoardState.annotations.filter(item => item.id !== coachBoardState.selectedEntity.id);
    coachBoardState.selectedEntity = null;
    _coachBoardRecordFrame("Acció eliminada");
    _coachBoardMessage("Acció eliminada.");
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
  _coachRenderTacticsTabRoot();
}

function coachHandleBoardClick(evt, kind, id) {
  _coachEnsureBoardState();
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
    _coachRenderTacticsTabRoot();
    return;
  }

  if (tool === "move") {
    if (kind === "player" || kind === "puck") {
      coachBoardState.selectedEntity = { kind, id };
      _coachBoardMessage(kind === "puck" ? "Pilota seleccionada. Toca el camp per moure-la." : "Jugador seleccionat. Toca el camp per moure'l.");
      _coachRenderTacticsTabRoot();
      return;
    }

    if (!coachBoardState.selectedEntity) {
      _coachBoardMessage("Selecciona primer un jugador o la pilota.");
      _coachRenderTacticsTabRoot();
      return;
    }

    if (coachBoardState.selectedEntity.kind === "player") {
      const player = coachBoardState.players.find(item => item.id === coachBoardState.selectedEntity.id);
      if (player) {
        player.x = point.x;
        player.y = point.y;
      }
    } else {
      coachBoardState.puck.x = point.x;
      coachBoardState.puck.y = point.y;
    }
    coachBoardState.selectedEntity = null;
    _coachBoardRecordFrame("Moviment");
    _coachBoardMessage("Element reposicionat.");
    _coachRenderTacticsTabRoot();
    return;
  }

  const actionTools = ["pass", "shot", "carry", "screen", "zone"];
  if (!actionTools.includes(tool)) return;

  const entityPoint = _coachBoardEntityPoint(kind, id, point);
  if (!coachBoardState.pendingAction) {
    coachBoardState.pendingAction = { tool, start: { x: entityPoint.x, y: entityPoint.y } };
    _coachBoardMessage(`Origen marcat per ${_coachToolMeta(tool).label.toLowerCase()}. Tria el destí.`);
    _coachRenderTacticsTabRoot();
    return;
  }

  coachBoardState.annotations.push(_coachCreateAnnotation(tool, coachBoardState.pendingAction.start, entityPoint));
  coachBoardState.pendingAction = null;
  _coachBoardRecordFrame(`Acció ${tool}`);
  _coachBoardMessage(`${_coachToolMeta(tool).label} afegida a la pissarra.`);
  _coachRenderTacticsTabRoot();
}

/* ── Window exports ──────────────────────────────────────────────────────── */
window.openCoachPanel          = openCoachPanel;
window.closeCoachPanel         = closeCoachPanel;
window.coachSetTab             = coachSetTab;
window.coachSetMatchSubTab     = coachSetMatchSubTab;
window.coachSetTeam            = coachSetTeam;
window.coachSetClub            = coachSetClub;
window.coachSetClubSearch      = coachSetClubSearch;
window.coachTogglePillar       = coachTogglePillar;
window.coachSaveTraining       = coachSaveTraining;
window.coachDeleteTraining     = coachDeleteTraining;
window.coachSavePlayerObjective  = coachSavePlayerObjective;
window.coachDeletePlayerObj    = coachDeletePlayerObj;
window.coachEditPlayer         = coachEditPlayer;
window.coachClearEditingPlayer = coachClearEditingPlayer;
window.coachAddPlayerToLineup  = coachAddPlayerToLineup;
window.coachRemovePlayer       = coachRemovePlayer;
window.coachToggleStarter      = coachToggleStarter;
window.coachSetPlayerSide      = coachSetPlayerSide;
window.coachSetPlayerPos       = coachSetPlayerPos;
window.coachLoadLineupFromConvocatoria = coachLoadLineupFromConvocatoria;
window.coachAddEvent           = coachAddEvent;
window.coachRemoveEvent        = coachRemoveEvent;
window.coachSetTactic          = coachSetTactic;
window.coachSetBoardTool       = coachSetBoardTool;
window.coachToggleBoardFullscreen = coachToggleBoardFullscreen;
window.coachAddBoardPlayer     = coachAddBoardPlayer;
window.coachResetBoard         = coachResetBoard;
window.coachClearBoardActions  = coachClearBoardActions;
window.coachRemoveSelectedBoardItem = coachRemoveSelectedBoardItem;
window.coachToggleBoardRecording = coachToggleBoardRecording;
window.coachSaveBoardPlay      = coachSaveBoardPlay;
window.coachLoadSavedPlay      = coachLoadSavedPlay;
window.coachPlaySavedPlay      = coachPlaySavedPlay;
window.coachDeleteSavedPlay    = coachDeleteSavedPlay;
window.coachHandleBoardClick   = coachHandleBoardClick;
window.coachSaveMatchEvents    = coachSaveMatchEvents;
window.renderCoachPanel        = renderCoachPanel;
