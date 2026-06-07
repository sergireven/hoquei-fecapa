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

/* ── State ───────────────────────────────────────────────────────────────── */
let coachPanelTab        = "planning";
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

/* ── Internal helpers ────────────────────────────────────────────────────── */
function _cesc(s) {
  return typeof esc === "function"
    ? esc(s)
    : String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function _csb()  { return typeof _sb !== "undefined" ? _sb : null; }
function _cuid() { return (typeof currentUser !== "undefined" ? currentUser?.id : null) || (typeof currentProfile !== "undefined" ? currentProfile?.id : null) || null; }
function _cteam() { return coachTeamInput || (typeof currentProfile !== "undefined" ? currentProfile?.team_name : "") || ""; }

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
  renderCoachPanel();
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
async function renderCoachPanel() {
  const body = document.getElementById("coach-body");
  if (!body) return;

  const team = _cteam();

  const teamRow = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <label style="font-size:13px;font-weight:700;color:#64748b;white-space:nowrap">Equip:</label>
      <input id="coach-team-inp" value="${_cesc(team)}" placeholder="Nom de l'equip..."
        oninput="coachSetTeam(this.value)"
        style="flex:1;max-width:300px;padding:9px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none"/>
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
  if (!coachPlayerObjsLoaded || coachPlayerObjsTeam !== team) {
    await _loadPlayerObjectives(team);
  }

  const players = Object.keys(coachPlayerObjs).sort();

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

  return addForm + cards;
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
  const starters  = players.filter(p => p.isStarter);
  const byPos     = pos => starters.filter(p => p.pos === pos).map(p => _cesc(p.name)).join(", ") || "—";

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

      <!-- Match info -->
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

      <!-- Add player -->
      <div style="background:#fff;border-radius:14px;border:1.5px solid #e2e6ef;padding:18px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">Afegir Jugador</div>
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

/* ── En Viu ─────────────────────────────────────────────────────────────── */
const _EVT_TYPES = [
  { type: "goal",      label: "⚽ Gol",          color: "#e5001c" },
  { type: "shot",      label: "🎯 Tir",           color: "#0891b2" },
  { type: "assist",    label: "🤝 Assistència",   color: "#7c3aed" },
  { type: "1v1_won",   label: "✅ 1vs1 Guanyat",  color: "#16a34a" },
  { type: "1v1_lost",  label: "❌ 1vs1 Perdut",   color: "#dc2626" },
  { type: "ball_gain", label: "🔵 Recuperació",   color: "#2563eb" },
  { type: "ball_loss", label: "🔴 Pèrdua",        color: "#f59e0b" },
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
    const g   = s.goal || 0;
    const w   = s["1v1_won"] || 0;
    const l   = s["1v1_lost"] || 0;
    const gl  = s.ball_gain || 0;
    const bll = s.ball_loss || 0;
    return `<div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px">
      <div style="font-size:12px;font-weight:700;color:#1a2035;margin-bottom:7px;display:flex;justify-content:space-between">
        <span>${_cesc(p.name)}</span>
        <span style="font-size:10px;color:#94a3b8;font-weight:600">${p.pos || ""}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:3px">
        ${_EVT_TYPES.slice(0, 4).map(et =>
          `<button onclick="coachAddEvent('${_cesc(p.name)}','${et.type}')"
            style="background:${et.color}12;border:1px solid ${et.color}35;color:${et.color};font-size:9px;font-weight:700;padding:6px 2px;border-radius:7px;cursor:pointer;line-height:1.3;text-align:center">${et.label}</button>`
        ).join("")}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-bottom:8px">
        ${_EVT_TYPES.slice(4).map(et =>
          `<button onclick="coachAddEvent('${_cesc(p.name)}','${et.type}')"
            style="background:${et.color}12;border:1px solid ${et.color}35;color:${et.color};font-size:9px;font-weight:700;padding:6px 2px;border-radius:7px;cursor:pointer;line-height:1.3;text-align:center">${et.label}</button>`
        ).join("")}
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${g   ? `<span style="background:#fef2f2;color:#e5001c;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:700">⚽ ${g}</span>` : ""}
        ${(w || l) ? `<span style="background:#f0fdf4;color:#16a34a;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:700">1v1 ${w}/${w + l}</span>` : ""}
        ${(gl || bll) ? `<span style="background:#eff6ff;color:#2563eb;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:700">±${gl}/${bll}</span>` : ""}
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

/** Top-down hockey rink SVG for a tactical formation */
function _tacticSVG(tactic) {
  const W = 290, H = 185, pad = 14;
  const fw = W - pad * 2, fh = H - pad * 2;

  const rink = `
    <rect width="${W}" height="${H}" fill="#1a3f6e" rx="8"/>
    <rect x="${pad}" y="${pad}" width="${fw}" height="${fh}" fill="#1e5fa8" rx="5" stroke="white" stroke-width="1.5" stroke-opacity="0.55"/>
    <line x1="${W / 2}" y1="${pad}" x2="${W / 2}" y2="${H - pad}" stroke="white" stroke-width="1" stroke-opacity="0.4"/>
    <circle cx="${W / 2}" cy="${H / 2}" r="17" fill="none" stroke="white" stroke-width="1" stroke-opacity="0.35"/>
    <rect x="${pad}" y="${H / 2 - 22}" width="28" height="44" fill="none" stroke="white" stroke-width="1" stroke-opacity="0.4"/>
    <rect x="${W - pad - 28}" y="${H / 2 - 22}" width="28" height="44" fill="none" stroke="white" stroke-width="1" stroke-opacity="0.4"/>
    <rect x="${pad}" y="${H / 2 - 9}" width="7" height="18" fill="white" fill-opacity="0.25" stroke="white" stroke-width="1"/>
    <rect x="${W - pad - 7}" y="${H / 2 - 9}" width="7" height="18" fill="white" fill-opacity="0.25" stroke="white" stroke-width="1"/>`;

  const posColors = ["#ef4444", "#f97316", "#eab308", "#22c55e"];
  const posLbls   = ["DEF", "MIG", "MIG", "DAV"];
  const playersSvg = (tactic.positions || []).map((pos, i) => {
    const x = pad + (pos.x / 100) * fw;
    const y = pad + (pos.y / 100) * fh;
    return `<circle cx="${x}" cy="${y}" r="11" fill="${posColors[i % posColors.length]}" stroke="white" stroke-width="1.5"/>
      <text x="${x}" y="${y + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="7.5" fill="white" font-family="'Barlow Condensed',sans-serif" font-weight="700">${posLbls[i] || "P"}</text>`;
  }).join("");

  const gkX = pad + 10, gkY = H / 2;
  const gkSvg = `<circle cx="${gkX}" cy="${gkY}" r="10" fill="#fbbf24" stroke="white" stroke-width="1.5"/>
    <text x="${gkX}" y="${gkY + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="7" fill="white" font-family="'Barlow Condensed',sans-serif" font-weight="700">GK</text>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${rink}${gkSvg}${playersSvg}</svg>`;
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
  coachTacticIdx = idx;
  renderCoachPanel();
}

/* ── Window exports ──────────────────────────────────────────────────────── */
window.openCoachPanel          = openCoachPanel;
window.closeCoachPanel         = closeCoachPanel;
window.coachSetTab             = coachSetTab;
window.coachSetMatchSubTab     = coachSetMatchSubTab;
window.coachSetTeam            = coachSetTeam;
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
window.coachAddEvent           = coachAddEvent;
window.coachRemoveEvent        = coachRemoveEvent;
window.coachSetTactic          = coachSetTactic;
window.coachSaveMatchEvents    = coachSaveMatchEvents;
window.renderCoachPanel        = renderCoachPanel;
