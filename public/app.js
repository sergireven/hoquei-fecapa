// ============================================================
// FECAPA Hoquei Patins — app.js v2
// ============================================================

const SHIELD   = "https://sidgad.cloud/fecapa/images/logos_clubes/";
const DATA_URL = "./data.json";
const FAV_KEY  = "hoquei_favs_v2";      // [{compId, teamName}]
const HIST_KEY = "hoquei_hist_v2";      // last visited comp IDs

// ── State ─────────────────────────────────────────────────────
const S = {
  data:      null,           // full data.json
  view:      "home",         // home | picker | detail
  comp:      null,           // selected competition object
  filterCat: "ALL",
  search:    "",
  tab:       "summary",
  filterTeam:null,
};

// Favourites: [{compId, teamName, compName, category}]
let favs = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
function saveFavs() { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); }
function isFav(compId, teamName) {
  return favs.some(f => f.compId === compId && f.teamName === teamName);
}
function toggleFav(compId, teamName, compName, category) {
  if (isFav(compId, teamName)) {
    favs = favs.filter(f => !(f.compId === compId && f.teamName === teamName));
  } else {
    favs.push({ compId, teamName, compName, category });
  }
  saveFavs();
}

// ── Helpers ───────────────────────────────────────────────────
const esc   = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const img   = (id,cls="team-shield") => id
  ? `<img class="${cls}" src="${SHIELD}${id}.gif" onerror="this.style.display='none'" alt=""/>`
  : `<span class="${cls}-ph"></span>`;

function posColor(p) {
  return p===1?"#d97706":p===2?"#64748b":p===3?"#b45309":"#94a3b8";
}
function resultBadge(hs, as, isHome) {
  if (hs==null||as==null) return "";
  const win = isHome ? hs>as : as>hs;
  const draw = hs===as;
  if (draw) return `<span class="rbadge draw">E</span>`;
  return win ? `<span class="rbadge win">V</span>` : `<span class="rbadge loss">D</span>`;
}

// Find competition by id across all categories
function findComp(compId) {
  if (!S.data) return null;
  for (const comps of Object.values(S.data.categories)) {
    const c = comps.find(c => c.id === compId);
    if (c) return c;
  }
  return null;
}

// Get club ID for a team name from the global index
function clubId(teamName) {
  if (!S.data||!teamName) return null;
  // Direct match in clubIndex by name
  for (const [, v] of Object.entries(S.data.clubIndex||{})) {
    if (v.name && v.name.toLowerCase() === teamName.toLowerCase()) return v.clubId;
  }
  // Fuzzy
  for (const [, v] of Object.entries(S.data.clubIndex||{})) {
    if (v.name && teamName.toLowerCase().includes(v.name.toLowerCase().replace(/\s+[a-d]$/i,""))) return v.clubId;
  }
  return null;
}

function clubIdFromRow(row) {
  return row.clubId || clubId(row.team) || null;
}

// ── Category config ───────────────────────────────────────────
const CATS = {
  "ALL":              { emoji:"🏒", color:"#e5001c" },
  "Nacional Catalana":{ emoji:"👑", color:"#003da5" },
  "1ª Catalana":      { emoji:"⭐", color:"#1a5dc7" },
  "2ª Catalana":      { emoji:"🔵", color:"#2563eb" },
  "3ª Catalana":      { emoji:"🟣", color:"#7c3aed" },
  "Fem":              { emoji:"♀",  color:"#db2777" },
  "Júnior":           { emoji:"🎯", color:"#ea580c" },
  "Juvenil":          { emoji:"⚡", color:"#16a34a" },
  "Infantil":         { emoji:"🏆", color:"#0891b2" },
  "Aleví":            { emoji:"💪", color:"#7c3aed" },
  "Benjamí":          { emoji:"🔥", color:"#dc2626" },
  "Prebenjamí":       { emoji:"⭐", color:"#d97706" },
  "Veterans":         { emoji:"🧓", color:"#6b7280" },
  "Altres":           { emoji:"📋", color:"#6b7280" },
};

// ── Render helpers ────────────────────────────────────────────
function matchCard(m, myTeam, showJornada=false) {
  const riH   = myTeam && m.home?.toLowerCase().includes(myTeam.toLowerCase());
  const riA   = myTeam && m.away?.toLowerCase().includes(myTeam.toLowerCase());
  const played= m.played !== false && m.homeScore != null;
  const cid_h = clubId(m.home);
  const cid_a = clubId(m.away);

  let borderCls = played ? "" : "pending";
  let badge = "";
  if (played && myTeam) {
    const isHome = riH;
    badge = resultBadge(m.homeScore, m.awayScore, isHome);
    const win = isHome ? m.homeScore > m.awayScore : m.awayScore > m.homeScore;
    const draw = m.homeScore === m.awayScore;
    borderCls = draw ? "draw" : win ? "win" : "loss";
  }

  const score = played
    ? `<span class="score">${m.homeScore} – ${m.awayScore}</span>`
    : `<span class="score pending-score">VS</span>`;

  return `
    <div class="match-card ${borderCls}">
      ${showJornada && m.jornada ? `<div class="jornada-label">Jornada ${m.jornada}</div>` : ""}
      <div class="match-row">
        <div class="match-team left ${riH?"mine":""}">
          ${img(cid_h,"mshield")}
          <span class="mname">${esc(m.home)}</span>
        </div>
        <div class="match-center">
          ${score}
          <div class="match-date">${esc(m.date||"")}${!played&&m.time?` · ${esc(m.time)}`:""}</div>
          ${badge}
        </div>
        <div class="match-team right ${riA?"mine":""}">
          <span class="mname">${esc(m.away)}</span>
          ${img(cid_a,"mshield")}
        </div>
      </div>
    </div>`;
}

// ── HOME SCREEN — favourites dashboard ───────────────────────
function renderHome() {
  const $home = document.getElementById("screen-home");
  $home.style.display = "flex";
  document.getElementById("screen-picker").style.display = "none";
  document.getElementById("screen-detail").style.display = "none";

  if (!favs.length) {
    $home.innerHTML = `
      <div class="hero">
        <div class="hero-inner">
          <div class="hero-badge">🏒 Temporada ${S.data?.season||"2025-26"}</div>
          <h1 class="hero-title">HOQUEI<br/><span>PATINS</span><br/>CATALUNYA</h1>
          <p class="hero-sub">Segueix el teu equip favorit</p>
          <button class="btn-primary" onclick="goToPicker()">🔍 Cerca el teu equip</button>
        </div>
      </div>
      <div class="home-body">
        <div class="empty-favs">
          <div style="font-size:48px;margin-bottom:12px">⭐</div>
          <p>Encara no tens equips favorits.<br/>Cerca el teu equip i afegeix-lo!</p>
          <button class="btn-secondary" onclick="goToPicker()" style="margin-top:16px">Veure totes les competicions</button>
        </div>
      </div>`;
    return;
  }

  // Render fav cards
  const cards = favs.map(fav => {
    const comp = findComp(fav.compId);
    if (!comp) return `<div class="fav-card error">Competició no trobada</div>`;

    const cl   = comp.classification || [];
    const cal  = comp.calendar || [];
    const myRow = cl.find(r => r.team?.toLowerCase().includes(fav.teamName.toLowerCase()));
    const myCal = cal.filter(m =>
      m.home?.toLowerCase().includes(fav.teamName.toLowerCase()) ||
      m.away?.toLowerCase().includes(fav.teamName.toLowerCase())
    );
    const lastMatch = [...myCal].reverse().find(m => m.played !== false && m.homeScore != null);
    const nextMatch = myCal.find(m => m.played === false || m.homeScore == null);
    const cid = myRow ? clubIdFromRow(myRow) : clubId(fav.teamName);
    const pos  = myRow?.pos;
    const pc   = posColor(pos);
    const cat  = CATS[fav.category] || CATS["Altres"];

    return `
      <div class="fav-card" style="--cat-color:${cat.color}">
        <div class="fav-header">
          <div class="fav-shield">${img(cid,"fav-shield-img")}</div>
          <div class="fav-title">
            <div class="fav-team">${esc(fav.teamName)}</div>
            <div class="fav-comp">${esc(comp.name.replace(/\s*\(2025-26\)/,""))}</div>
          </div>
          <button class="fav-remove" onclick="removeFav('${fav.compId}','${esc(fav.teamName)}')" title="Eliminar favorit">✕</button>
        </div>

        ${myRow ? `
        <div class="fav-stats">
          <div class="fav-stat">
            <div class="fav-stat-val" style="color:${pc}">${pos}è</div>
            <div class="fav-stat-lbl">Posició</div>
          </div>
          <div class="fav-stat">
            <div class="fav-stat-val" style="color:#e5001c">${myRow.pts}</div>
            <div class="fav-stat-lbl">Punts</div>
          </div>
          <div class="fav-stat">
            <div class="fav-stat-val" style="color:#16a34a">${myRow.pg}</div>
            <div class="fav-stat-lbl">Victòries</div>
          </div>
          <div class="fav-stat">
            <div class="fav-stat-val" style="color:#dc2626">${myRow.pp}</div>
            <div class="fav-stat-lbl">Derrotes</div>
          </div>
        </div>` : ""}

        ${lastMatch ? `
        <div class="fav-section-title">Últim resultat</div>
        ${matchCard(lastMatch, fav.teamName)}` : ""}

        ${nextMatch ? `
        <div class="fav-section-title">Proper partit</div>
        ${matchCard(nextMatch, fav.teamName)}` : ""}

        <div class="fav-actions">
          <button class="btn-link" onclick="openComp('${fav.compId}', '${esc(fav.teamName)}', 'classif')">
            📊 Classificació completa
          </button>
          <button class="btn-link" onclick="openComp('${fav.compId}', '${esc(fav.teamName)}', 'calendar')">
            📅 Calendari
          </button>
        </div>
      </div>`;
  }).join("");

  const updatedAt = S.data?.updatedAt ? new Date(S.data.updatedAt).toLocaleDateString("ca-ES") : "?";

  $home.innerHTML = `
    <div class="home-header">
      <div class="home-header-inner">
        <div class="home-logo">🏒 <span>FECAPA</span></div>
        <button class="btn-search" onclick="goToPicker()" title="Cercar competicions">🔍</button>
      </div>
    </div>
    <div class="home-body">
      <div class="home-section-title">Els meus equips</div>
      ${cards}
      <button class="btn-add-fav" onclick="goToPicker()">+ Afegir equip favorit</button>
      <p class="update-note">Dades actualitzades: ${updatedAt}</p>
    </div>`;
}

function removeFav(compId, teamName) {
  favs = favs.filter(f => !(f.compId===compId && f.teamName===teamName));
  saveFavs();
  renderHome();
}

window.removeFav = removeFav;

// ── PICKER SCREEN ─────────────────────────────────────────────
function goToPicker() {
  S.view = "picker";
  document.getElementById("screen-home").style.display   = "none";
  document.getElementById("screen-picker").style.display = "flex";
  document.getElementById("screen-detail").style.display = "none";
  renderFilterTabs();
  renderPicker();
  document.getElementById("search-input").focus();
}
window.goToPicker = goToPicker;

function renderFilterTabs() {
  const cats = ["ALL", ...Object.keys(S.data.categories)];
  document.getElementById("filter-tabs").innerHTML = cats.map(cat => {
    const cfg   = CATS[cat]||{emoji:"📋"};
    const label = cat==="ALL"?"Totes":cat;
    const count = cat==="ALL"
      ? Object.values(S.data.categories).reduce((s,v)=>s+v.length,0)
      : (S.data.categories[cat]||[]).length;
    return `<button class="filter-btn ${S.filterCat===cat?"active":""}" onclick="setFilter('${cat}')">
      ${cfg.emoji} ${label} <span class="filter-count">${count}</span>
    </button>`;
  }).join("");
}
window.setFilter = cat => { S.filterCat=cat; renderFilterTabs(); renderPicker(); };

function renderPicker() {
  const q = S.search.toLowerCase();
  let cats = S.filterCat==="ALL"
    ? Object.entries(S.data.categories)
    : [[S.filterCat, S.data.categories[S.filterCat]||[]]];

  if (q) {
    cats = cats.map(([cat,comps]) => [cat, comps.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.teams?.some(t => t.name.toLowerCase().includes(q))
    )]).filter(([,c]) => c.length>0);
  }

  const body = document.getElementById("picker-body");
  if (!cats.length || cats.every(([,c])=>!c.length)) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Cap resultat per "<b>${esc(q)}</b>"</p></div>`;
    return;
  }

  body.innerHTML = cats.map(([cat, comps]) => {
    if (!comps.length) return "";
    const cfg = CATS[cat]||{emoji:"📋",color:"#666"};
    return `<div class="cat-group">
      <div class="cat-header">
        <span class="cat-emoji">${cfg.emoji}</span>
        <span class="cat-title" style="color:${cfg.color}">${cat}</span>
        <span class="cat-count">${comps.length}</span>
      </div>
      ${comps.map(comp => `
        <div class="comp-card" onclick="openComp('${comp.id}')">
          <div class="comp-card-inner">
            <div class="comp-pct"><span>${comp.pctPlayed!=null?comp.pctPlayed+"%":"?"}</span></div>
            <div class="comp-info">
              <div class="comp-name">${esc(comp.name.replace(/\s*\(2025-26\)/,""))}</div>
              <div class="comp-teams-count">${(comp.classification||comp.teams||[]).length} equips</div>
            </div>
            <span class="comp-arrow">›</span>
          </div>
          <div class="comp-progress"><div class="comp-progress-bar" style="width:${comp.pctPlayed||0}%"></div></div>
        </div>`).join("")}
    </div>`;
  }).join("");
}

document.getElementById("search-input").addEventListener("input", e => {
  S.search = e.target.value;
  renderPicker();
});

// ── DETAIL SCREEN ─────────────────────────────────────────────
function openComp(compId, highlightTeam, defaultTab) {
  const comp = findComp(compId);
  if (!comp) return;
  S.comp       = comp;
  S.filterTeam = highlightTeam || null;
  S.tab        = defaultTab || "summary";

  document.getElementById("screen-home").style.display   = "none";
  document.getElementById("screen-picker").style.display = "none";
  document.getElementById("screen-detail").style.display = "flex";

  const cleanName = comp.name.replace(/\s*\(2025-26\)/,"");
  document.getElementById("detail-comp-name").textContent = cleanName;
  document.getElementById("detail-meta").textContent =
    `${(comp.classification||comp.teams||[]).length} equips · ${comp.pctPlayed??"?"}% jugat`;

  document.querySelectorAll(".detail-tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === S.tab));
  document.querySelectorAll(".panel").forEach(p =>
    p.classList.toggle("active", p.id===`panel-${S.tab}`));

  renderDetailPanels();
  window.scrollTo(0,0);
}
window.openComp = openComp;

document.getElementById("back-btn").addEventListener("click", () => {
  if (S.view==="picker" || document.getElementById("screen-picker").style.display!=="none") {
    document.getElementById("screen-detail").style.display = "none";
    document.getElementById("screen-picker").style.display = "flex";
  } else {
    document.getElementById("screen-detail").style.display = "none";
    document.getElementById("screen-home").style.display   = "flex";
    S.view = "home";
  }
});

document.querySelectorAll(".detail-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    S.tab = tab.dataset.tab;
    document.querySelectorAll(".detail-tab").forEach(t => t.classList.toggle("active", t===tab));
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id===`panel-${S.tab}`));
  });
});

// ── Summary panel ─────────────────────────────────────────────
function renderSummary() {
  const comp = S.comp;
  const cl   = comp.classification||[];

  // If a favourite team is highlighted, show its mini-dashboard first
  let favHtml = "";
  if (S.filterTeam && cl.length) {
    const myRow = cl.find(r => r.team?.toLowerCase().includes(S.filterTeam.toLowerCase()));
    const cal   = (comp.calendar||[]).filter(m =>
      m.home?.toLowerCase().includes(S.filterTeam.toLowerCase()) ||
      m.away?.toLowerCase().includes(S.filterTeam.toLowerCase())
    );
    const last = [...cal].reverse().find(m => m.played!==false && m.homeScore!=null);
    const next = cal.find(m => m.played===false || m.homeScore==null);
    const cid  = myRow ? clubIdFromRow(myRow) : clubId(S.filterTeam);
    const pc   = posColor(myRow?.pos);

    favHtml = `
      <div class="team-spotlight">
        <div class="spotlight-header">
          ${img(cid,"spotlight-shield")}
          <div>
            <div class="spotlight-name">${esc(S.filterTeam)}</div>
            <div class="spotlight-comp">${esc(comp.name.replace(/\s*\(2025-26\)/,""))}</div>
          </div>
          <button class="btn-star ${isFav(comp.id,S.filterTeam)?"active":""}"
            onclick="toggleFavBtn('${comp.id}','${esc(S.filterTeam)}','${esc(comp.name)}','${esc(getCatForComp(comp))}')">
            ${isFav(comp.id,S.filterTeam)?"★":"☆"}
          </button>
        </div>
        ${myRow ? `
        <div class="spotlight-stats">
          <div class="sstat"><div class="sstat-v" style="color:${pc}">${myRow.pos}è</div><div class="sstat-l">Posició</div></div>
          <div class="sstat"><div class="sstat-v" style="color:#e5001c">${myRow.pts}</div><div class="sstat-l">Punts</div></div>
          <div class="sstat"><div class="sstat-v" style="color:#16a34a">${myRow.pg}</div><div class="sstat-l">Victòries</div></div>
          <div class="sstat"><div class="sstat-v" style="color:#d97706">${myRow.pe}</div><div class="sstat-l">Empats</div></div>
          <div class="sstat"><div class="sstat-v" style="color:#dc2626">${myRow.pp}</div><div class="sstat-l">Derrotes</div></div>
          <div class="sstat"><div class="sstat-v">${myRow.pj}</div><div class="sstat-l">Jugats</div></div>
        </div>` : ""}
        ${last ? `<div class="spotlight-section">Últim resultat</div>${matchCard(last,S.filterTeam)}` : ""}
        ${next ? `<div class="spotlight-section">Proper partit</div>${matchCard(next,S.filterTeam)}` : ""}
      </div>`;
  }

  // Top 3 podium
  if (!cl.length) {
    document.getElementById("panel-summary").innerHTML = favHtml + `
      <div class="empty-state"><p>Resum no disponible.<br>
      <a href="https://jok.cat/competicio/${comp.id}" target="_blank">Veure a jok.cat →</a></p></div>`;
    return;
  }

  const top3 = cl.slice(0,3);
  const medals = ["🥇","🥈","🥉"];
  const podiumHtml = `
    <div class="card" style="margin-bottom:14px">
      <div class="section-title">Classificació — Top 3</div>
      ${top3.map((r,i) => `
        <div class="podium-row" style="border-bottom:${i<2?"1px solid var(--border)":"none"}">
          <span style="font-size:20px;width:28px;text-align:center">${medals[i]}</span>
          ${img(clubIdFromRow(r),"podium-shield")}
          <div style="flex:1">
            <div class="podium-name">${esc(r.team)}</div>
            <div class="podium-meta">${r.pj||0} partits · ${r.gf||0} gols</div>
          </div>
          <div class="podium-pts">${r.pts||0}<div class="podium-pts-lbl">pts</div></div>
        </div>`).join("")}
    </div>`;

  const totalGames = Math.round(cl.reduce((s,r)=>s+(r.pj||0),0)/2);
  const totalGoals = cl.reduce((s,r)=>s+(r.gf||0),0);
  const statsHtml = `
    <div class="stats-row">
      ${[
        {v:cl.length,  l:"Equips",  c:"var(--blue)"},
        {v:totalGames, l:"Partits", c:"var(--red)"},
        {v:totalGoals, l:"Gols",    c:"var(--gold)"},
        {v:(comp.pctPlayed??0)+"%",l:"Jugat",c:"#16a34a"},
      ].map(s=>`<div class="stat-card"><div class="stat-val" style="color:${s.c}">${s.v}</div><div class="stat-lbl">${s.l}</div></div>`).join("")}
    </div>`;

  document.getElementById("panel-summary").innerHTML = favHtml + podiumHtml + statsHtml + `
    <div class="info-box">💡 Dades de <a href="https://jok.cat/competicio/${comp.id}" target="_blank" rel="noopener">jok.cat</a>
    · Act. ${S.data?.updatedAt ? new Date(S.data.updatedAt).toLocaleDateString("ca-ES") : "?"}</div>`;
}

function toggleFavBtn(compId, teamName, compName, category) {
  toggleFav(compId, teamName, compName, category);
  renderSummary(); // re-render to update star
}
window.toggleFavBtn = toggleFavBtn;

function getCatForComp(comp) {
  for (const [cat, comps] of Object.entries(S.data.categories)) {
    if (comps.some(c => c.id === comp.id)) return cat;
  }
  return "Altres";
}

// ── Classification panel ──────────────────────────────────────
function renderClassif() {
  const comp = S.comp;
  const cl   = comp.classification||[];

  if (!cl.length) {
    document.getElementById("panel-classif").innerHTML = `
      <div class="empty-state"><p>Classificació no disponible.<br>
      <a href="https://jok.cat/competicio/${comp.id}" target="_blank">Veure a jok.cat →</a></p></div>`;
    return;
  }

  const rows = cl.map(r => {
    const cid  = clubIdFromRow(r);
    const mine = S.filterTeam && r.team?.toLowerCase().includes(S.filterTeam.toLowerCase());
    const pc   = posColor(r.pos);
    return `<tr class="${mine?"my-team":""}">
      <td><span class="pos-badge" style="color:${pc};background:${pc}22">${r.pos<=3?["🥇","🥈","🥉"][r.pos-1]:r.pos}</span></td>
      <td>
        <div class="team-name-cell">
          ${img(cid,"team-shield")}
          <span>${esc(r.team)}</span>
          ${mine?'<span class="my-mark">◀</span>':""}
        </div>
      </td>
      <td>${r.pj??"-"}</td>
      <td class="green">${r.pg??"-"}</td>
      <td class="yellow">${r.pe??"-"}</td>
      <td class="red">${r.pp??"-"}</td>
      <td>${r.gf??"-"}</td>
      <td>${r.gc??"-"}</td>
      <td class="pts ${mine?"pts-mine":""}">${r.pts??"-"}</td>
    </tr>`;
  }).join("");

  document.getElementById("panel-classif").innerHTML = `
    <div class="classif-wrap">
      <table class="classif-table">
        <thead><tr>
          <th>#</th><th style="text-align:left">Equip</th>
          <th>PJ</th><th>PG</th><th>PE</th><th>PP</th>
          <th>GF</th><th>GC</th><th>Pts</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Calendar panel ────────────────────────────────────────────
function renderCalendar() {
  const comp  = S.comp;
  let matches = comp.calendar||[];

  if (!matches.length) {
    document.getElementById("panel-calendar").innerHTML = `
      <div class="empty-state"><p>Calendari no disponible.<br>
      <a href="https://jok.cat/competicio/${comp.id}" target="_blank">Veure a jok.cat →</a></p></div>`;
    return;
  }

  // Team filter chips
  const teamNames = [...new Set([...matches.map(m=>m.home),...matches.map(m=>m.away)].filter(Boolean))].sort();
  const chipsHtml = `
    <div class="team-filter-wrap">
      <div class="team-filter-label">Filtrar per equip</div>
      <div class="team-chips">
        <div class="team-chip ${!S.filterTeam?"active":""}" onclick="setCalFilter(null)">Tots</div>
        ${teamNames.map(t => {
          const cid = clubId(t);
          return `<div class="team-chip ${S.filterTeam===t?"active":""}" onclick="setCalFilter('${esc(t)}')">
            ${img(cid,"chip-shield")} ${esc(t.replace(/Club Hoquei |CH |Cp /gi,""))}
          </div>`;
        }).join("")}
      </div>
    </div>`;

  if (S.filterTeam) {
    matches = matches.filter(m =>
      m.home?.toLowerCase().includes(S.filterTeam.toLowerCase()) ||
      m.away?.toLowerCase().includes(S.filterTeam.toLowerCase())
    );
  }

  const legend = S.filterTeam ? `
    <div class="cal-legend">
      <span class="rbadge win">V Victòria</span>
      <span class="rbadge draw">E Empat</span>
      <span class="rbadge loss">D Derrota</span>
      <span class="rbadge pending-badge">Pendent</span>
    </div>` : "";

  // Group by jornada
  const byJ = {};
  matches.forEach(m => {
    const k = m.jornada ? `Jornada ${m.jornada}` : (m.date||"Sense data");
    if (!byJ[k]) byJ[k]=[];
    byJ[k].push(m);
  });

  const calHtml = Object.entries(byJ).map(([j,ms]) => `
    <div class="cal-section">
      <div class="cal-label">${esc(j)}</div>
      ${ms.map(m => matchCard(m, S.filterTeam, false)).join("")}
    </div>`).join("");

  document.getElementById("panel-calendar").innerHTML = chipsHtml + legend + calHtml;
}

window.setCalFilter = team => { S.filterTeam = team; renderCalendar(); };

function renderDetailPanels() {
  renderSummary();
  renderClassif();
  renderCalendar();
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  try {
    document.getElementById("loading-note").textContent = "Carregant dades de FECAPA...";
    const res = await fetch(DATA_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error("No s'han pogut carregar les dades");
    S.data = await res.json();

    document.getElementById("hero-season").textContent  = S.data.season||"2025-26";
    document.getElementById("hero-sub").textContent = `${S.data.totalComps||0} competicions · Act. ${
      S.data.updatedAt ? new Date(S.data.updatedAt).toLocaleDateString("ca-ES") : "?"
    }`;

    document.getElementById("screen-loading").style.display = "none";
    renderHome();
  } catch(err) {
    document.getElementById("loading-note").innerHTML =
      `<span style="color:#e5001c">⚠️ ${err.message}</span>`;
  }
}

init();
