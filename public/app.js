// ============================================================
// FECAPA Hoquei Patins — app.js v3
// ============================================================

const SHIELD   = "https://sidgad.cloud/fecapa/images/logos_clubes/";
const DATA_URL = "./data.json";
const FAV_KEY  = "hoquei_favs_v3";

// ── State ─────────────────────────────────────────────────────
const S = {
  data:       null,
  view:       "home",   // home | picker | detail
  comp:       null,
  filterCat:  "ALL",
  search:     "",
  tab:        "summary",
  filterTeam: null,
};

// ── Favourites ────────────────────────────────────────────────
let favs = [];
try { favs = JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch {}
const saveFavs  = () => localStorage.setItem(FAV_KEY, JSON.stringify(favs));
const isFav     = (cid, tn) => favs.some(f => f.compId===cid && f.teamName===tn);
function toggleFav(compId, teamName, compName, category) {
  if (isFav(compId, teamName)) {
    favs = favs.filter(f => !(f.compId===compId && f.teamName===teamName));
  } else {
    favs.push({ compId, teamName, compName, category });
  }
  saveFavs();
}

// ── Screens ───────────────────────────────────────────────────
const screens = {
  home:   document.getElementById("screen-home"),
  picker: document.getElementById("screen-picker"),
  detail: document.getElementById("screen-detail"),
};
function showScreen(name) {
  Object.entries(screens).forEach(([k,el]) => el.style.display = k===name ? "flex" : "none");
  S.view = name;
}

// ── Utils ─────────────────────────────────────────────────────
const esc = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

function sImg(clubId, cls="shield-sm") {
  if (!clubId) return `<span class="${cls}-ph"></span>`;
  return `<img class="${cls}" src="${SHIELD}${clubId}.gif" onerror="this.style.display='none'" alt=""/>`;
}

function posColor(p) {
  if (p===1) return "#d97706";
  if (p===2) return "#64748b";
  if (p===3) return "#b45309";
  return "#94a3b8";
}

function getClubId(teamName) {
  if (!S.data || !teamName) return null;
  const idx = S.data.clubIndex || {};
  for (const v of Object.values(idx)) {
    if (v.name && v.name.toLowerCase() === teamName.toLowerCase()) return v.clubId;
  }
  // fuzzy: strip trailing A/B/C/D
  const base = teamName.toLowerCase().replace(/\s+[a-d]$/, "").trim();
  for (const v of Object.values(idx)) {
    if (v.name && v.name.toLowerCase().replace(/\s+[a-d]$/,"").trim() === base) return v.clubId;
  }
  return null;
}

function getClubIdFromRow(row) {
  return row.clubId || getClubId(row.team);
}

function findComp(compId) {
  if (!S.data) return null;
  for (const comps of Object.values(S.data.categories)) {
    const c = comps.find(c => c.id === compId);
    if (c) return c;
  }
  return null;
}

function getCatForComp(comp) {
  if (!S.data) return "Altres";
  for (const [cat, comps] of Object.entries(S.data.categories)) {
    if (comps.some(c => c.id === comp.id)) return cat;
  }
  return "Altres";
}

// ── Match card ────────────────────────────────────────────────
function matchCard(m, myTeam) {
  const riH    = myTeam && m.home && m.home.toLowerCase().includes(myTeam.toLowerCase());
  const riA    = myTeam && m.away && m.away.toLowerCase().includes(myTeam.toLowerCase());
  const played = m.played !== false && m.homeScore != null;
  const cidH   = getClubId(m.home);
  const cidA   = getClubId(m.away);

  // Result badge & border
  let borderColor = "transparent";
  let badge = "";
  if (played && myTeam) {
    const win  = riH ? m.homeScore > m.awayScore : m.awayScore > m.homeScore;
    const draw = m.homeScore === m.awayScore;
    borderColor = draw ? "#d97706" : win ? "#16a34a" : "#dc2626";
    const [bg, color, label] = draw
      ? ["#fef3c7","#b45309","Empat"]
      : win
        ? ["#dcfce7","#16a34a","Victòria"]
        : ["#fee2e2","#dc2626","Derrota"];
    badge = `<span style="display:inline-block;background:${bg};color:${color};font-size:10px;font-weight:700;padding:1px 7px;border-radius:6px;margin-top:4px">${label}</span>`;
  }

  const scoreEl = played
    ? `<div style="background:#e5001c;color:#fff;border-radius:8px;padding:5px 10px;font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;min-width:60px;text-align:center;display:inline-block">${m.homeScore} – ${m.awayScore}</div>`
    : `<div style="background:#1a5dc7;color:#fff;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;min-width:60px;text-align:center;display:inline-block">VS</div>`;

  const dateEl = `<div style="font-size:10px;color:#6b7a99;margin-top:3px">${esc(m.date||"")}${!played&&m.time?` · ${esc(m.time)}`:""}</div>`;

  return `
    <div style="background:#fff;border:1.5px solid #e2e6ef;border-left:4px solid ${borderColor};border-radius:11px;padding:10px 12px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,30,80,.05)">
      ${m.jornada ? `<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Jornada ${m.jornada}</div>` : ""}
      <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">
          <span style="font-size:12px;font-weight:${riH?800:500};color:${riH?"#003da5":"#334155"};text-align:right;line-height:1.2">${esc(m.home)}</span>
          ${sImg(cidH,"shield-sm")}
        </div>
        <div style="text-align:center">
          ${scoreEl}
          ${dateEl}
          ${badge}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          ${sImg(cidA,"shield-sm")}
          <span style="font-size:12px;font-weight:${riA?800:500};color:${riA?"#003da5":"#334155"};text-align:left;line-height:1.2">${esc(m.away)}</span>
        </div>
      </div>
    </div>`;
}

// ── HOME ──────────────────────────────────────────────────────
function renderHome() {
  showScreen("home");
  const $home = screens.home;

  if (!favs.length) {
    $home.innerHTML = `
      <div style="background:linear-gradient(135deg,#003da5 0%,#001f6e 55%,#e5001c 100%);padding:36px 20px 28px;position:relative;overflow:hidden">
        <div style="max-width:520px;margin:0 auto;position:relative;z-index:1;text-align:center">
          <div style="font-size:52px;margin-bottom:12px">🏒</div>
          <h1 style="font-family:'Barlow Condensed',sans-serif;font-size:clamp(28px,8vw,48px);font-weight:900;color:#fff;line-height:.95;margin-bottom:8px">HOQUEI PATINS<br/><span style="color:#f0a500">CATALUNYA</span></h1>
          <p style="color:rgba(255,255,255,.7);font-size:13px;margin-bottom:20px">Segueix el teu equip favorit a la FECAPA</p>
          <button onclick="goToPicker()" style="background:#e5001c;border:none;color:#fff;font-weight:700;font-size:15px;padding:13px 28px;border-radius:12px;cursor:pointer;display:inline-flex;align-items:center;gap:8px">🔍 Cerca el teu equip</button>
        </div>
      </div>
      <div style="max-width:600px;margin:0 auto;padding:32px 16px;text-align:center;color:#6b7a99">
        <p style="font-size:14px">Entra a una competició, selecciona el teu equip i clica ⭐ per afegir-lo aquí.</p>
      </div>`;
    return;
  }

  const cards = favs.map(fav => {
    const comp  = findComp(fav.compId);
    if (!comp) return "";
    const cl    = comp.classification || [];
    const cal   = comp.calendar || [];
    const myRow = cl.find(r => r.team && r.team.toLowerCase().includes(fav.teamName.toLowerCase()));
    const myCal = cal.filter(m =>
      (m.home && m.home.toLowerCase().includes(fav.teamName.toLowerCase())) ||
      (m.away && m.away.toLowerCase().includes(fav.teamName.toLowerCase()))
    );
    const last = [...myCal].reverse().find(m => m.played !== false && m.homeScore != null);
    const next = myCal.find(m => m.played === false || m.homeScore == null);
    const cid  = myRow ? getClubIdFromRow(myRow) : getClubId(fav.teamName);
    const cat  = CAT_CONFIG[fav.category] || CAT_CONFIG["Altres"];

    return `
      <div style="background:#fff;border:1.5px solid #e2e6ef;border-top:4px solid ${cat.color};border-radius:14px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
        <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #e2e6ef">
          ${sImg(cid,"shield-md")}
          <div style="flex:1;min-width:0">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fav.teamName)}</div>
            <div style="font-size:11px;color:#6b7a99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(comp.name.replace(/\s*\(2025-26\)/,""))}</div>
          </div>
          <button onclick="removeFav('${fav.compId}','${esc(fav.teamName).replace(/'/g,"\\'")}');event.stopPropagation()" style="background:none;border:none;color:#94a3b8;font-size:16px;cursor:pointer;padding:4px 6px;border-radius:6px">✕</button>
        </div>
        ${myRow ? `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #e2e6ef">
          ${[
            {v:myRow.pos+"è", l:"Posició", c:posColor(myRow.pos)},
            {v:myRow.pts,     l:"Punts",   c:"#e5001c"},
            {v:myRow.pg,      l:"Victòries",c:"#16a34a"},
            {v:myRow.pp,      l:"Derrotes", c:"#dc2626"},
          ].map(s=>`
            <div style="text-align:center;padding:10px 6px;border-right:1px solid #e2e6ef">
              <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:${s.c}">${s.v}</div>
              <div style="font-size:9px;color:#6b7a99;text-transform:uppercase;letter-spacing:.04em;margin-top:2px">${s.l}</div>
            </div>`).join("")}
        </div>` : ""}
        <div style="padding:10px 12px">
          ${last ? `<div style="font-size:10px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px">Últim resultat</div>${matchCard(last, fav.teamName)}` : ""}
          ${next ? `<div style="font-size:10px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px">Proper partit</div>${matchCard(next, fav.teamName)}` : ""}
        </div>
        <div style="display:flex;gap:6px;padding:8px 12px 12px;border-top:1px solid #e2e6ef">
          <button onclick="openComp('${fav.compId}','${esc(fav.teamName).replace(/'/g,"\\'")}','classif')" style="flex:1;background:#f0f4f8;border:1px solid #e2e6ef;border-radius:8px;padding:7px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">📊 Classificació</button>
          <button onclick="openComp('${fav.compId}','${esc(fav.teamName).replace(/'/g,"\\'")}','calendar')" style="flex:1;background:#f0f4f8;border:1px solid #e2e6ef;border-radius:8px;padding:7px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">📅 Calendari</button>
        </div>
      </div>`;
  }).join("");

  const updAt = S.data?.updatedAt ? new Date(S.data.updatedAt).toLocaleDateString("ca-ES") : "?";
  $home.innerHTML = `
    <div style="background:#fff;border-bottom:1px solid #e2e6ef;padding:11px 16px;position:sticky;top:0;z-index:50">
      <div style="max-width:600px;margin:0 auto;display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:800">🏒 <span style="color:#e5001c">FECAPA</span></div>
        <button onclick="goToPicker()" style="background:#f0f4f8;border:1px solid #e2e6ef;border-radius:10px;padding:7px 14px;cursor:pointer;font-size:13px;font-weight:600;color:#1a2035">🔍 Cercar</button>
      </div>
    </div>
    <div style="max-width:600px;margin:0 auto;padding:16px 14px 32px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">Els meus equips</div>
      ${cards}
      <button onclick="goToPicker()" style="width:100%;background:#fff;border:2px dashed #e2e6ef;color:#6b7a99;font-size:14px;font-weight:600;padding:14px;border-radius:12px;cursor:pointer;margin-top:4px">+ Afegir equip favorit</button>
      <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:14px">Dades actualitzades: ${updAt}</p>
    </div>`;
}

window.removeFav = function(compId, teamName) {
  favs = favs.filter(f => !(f.compId===compId && f.teamName===teamName));
  saveFavs();
  renderHome();
};

window.goToPicker = function() {
  showScreen("picker");
  renderFilterTabs();
  renderPicker();
  setTimeout(() => document.getElementById("search-input").focus(), 100);
};

// ── PICKER ────────────────────────────────────────────────────
const CAT_CONFIG = {
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

function renderFilterTabs() {
  const cats = ["ALL", ...Object.keys(S.data.categories)];
  document.getElementById("filter-tabs").innerHTML = cats.map(cat => {
    const cfg   = CAT_CONFIG[cat] || { emoji:"📋" };
    const label = cat === "ALL" ? "Totes" : cat;
    const count = cat === "ALL"
      ? Object.values(S.data.categories).reduce((s,v)=>s+v.length, 0)
      : (S.data.categories[cat]||[]).length;
    return `<button class="filter-btn ${S.filterCat===cat?"active":""}" data-cat="${cat}">
      ${cfg.emoji} ${label} <span style="font-size:10px;opacity:.6">${count}</span>
    </button>`;
  }).join("");
  document.getElementById("filter-tabs").querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      S.filterCat = btn.dataset.cat;
      renderFilterTabs();
      renderPicker();
    });
  });
}

function renderPicker() {
  const q = S.search.toLowerCase();
  let cats = S.filterCat === "ALL"
    ? Object.entries(S.data.categories)
    : [[S.filterCat, S.data.categories[S.filterCat] || []]];

  if (q) {
    cats = cats.map(([cat, comps]) => [cat, comps.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.teams||[]).some(t => t.name.toLowerCase().includes(q)) ||
      (c.classification||[]).some(r => r.team && r.team.toLowerCase().includes(q))
    )]).filter(([,c]) => c.length > 0);
  }

  const body = document.getElementById("picker-body");
  if (!cats.length || cats.every(([,c])=>!c.length)) {
    body.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#6b7a99"><div style="font-size:40px;margin-bottom:10px">🔍</div><p>Cap resultat per "<b>${esc(q)}</b>"</p></div>`;
    return;
  }

  body.innerHTML = cats.map(([cat, comps]) => {
    if (!comps.length) return "";
    const cfg = CAT_CONFIG[cat] || { emoji:"📋", color:"#666" };
    return `
      <div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span style="font-size:16px">${cfg.emoji}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:800;text-transform:uppercase;color:${cfg.color}">${cat}</span>
          <span style="font-size:11px;font-weight:700;color:#6b7a99;background:#e2e6ef;border-radius:10px;padding:1px 7px">${comps.length}</span>
        </div>
        ${comps.map(comp => `
          <div onclick="openComp('${comp.id}')" style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;margin-bottom:7px;overflow:hidden;cursor:pointer;box-shadow:0 1px 3px rgba(0,30,80,.05);transition:all .15s" onmouseover="this.style.borderColor='#1a5dc7';this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='#e2e6ef';this.style.transform='none'">
            <div style="display:flex;align-items:center;gap:10px;padding:11px 13px">
              <div style="width:38px;height:38px;border-radius:9px;background:#f0f4f8;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <span style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:800;color:#003da5">${comp.pctPlayed!=null?comp.pctPlayed+"%":"?"}</span>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(comp.name.replace(/\s*\(2025-26\)/,""))}</div>
                <div style="font-size:11px;color:#6b7a99;margin-top:2px">${(comp.classification||comp.teams||[]).length} equips</div>
              </div>
              <span style="color:#94a3b8;font-size:18px">›</span>
            </div>
            <div style="height:3px;background:#f0f4f8"><div style="height:100%;background:linear-gradient(90deg,#003da5,#e5001c);width:${comp.pctPlayed||0}%"></div></div>
          </div>`).join("")}
      </div>`;
  }).join("");
}

document.getElementById("search-input").addEventListener("input", e => {
  S.search = e.target.value;
  renderPicker();
});

// ── DETAIL ────────────────────────────────────────────────────
window.openComp = function(compId, highlightTeam, defaultTab) {
  const comp = findComp(compId);
  if (!comp) return;
  S.comp       = comp;
  S.filterTeam = highlightTeam || null;
  S.tab        = defaultTab || "summary";
  S.prevView   = S.view;

  showScreen("detail");

  const cleanName = comp.name.replace(/\s*\(2025-26\)/,"");
  document.getElementById("detail-comp-name").textContent = cleanName;
  document.getElementById("detail-meta").textContent =
    `${(comp.classification||comp.teams||[]).length} equips · ${comp.pctPlayed??"?"}% jugat`;

  document.querySelectorAll(".detail-tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === S.tab));
  document.querySelectorAll(".panel").forEach(p =>
    p.classList.toggle("active", p.id === `panel-${S.tab}`));

  renderDetailPanels();
  window.scrollTo(0, 0);
};

document.getElementById("back-btn").addEventListener("click", () => {
  if (S.prevView === "picker") {
    showScreen("picker");
  } else {
    renderHome();
  }
});

document.querySelectorAll(".detail-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    S.tab = tab.dataset.tab;
    document.querySelectorAll(".detail-tab").forEach(t => t.classList.toggle("active", t===tab));
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id===`panel-${S.tab}`));
  });
});

// ── Summary ───────────────────────────────────────────────────
function renderSummary() {
  const comp   = S.comp;
  const cl     = comp.classification || [];
  const cal    = comp.calendar || [];
  const panel  = document.getElementById("panel-summary");

  // Team spotlight if filterTeam is set
  let spotlightHtml = "";
  if (S.filterTeam) {
    const myRow = cl.find(r => r.team && r.team.toLowerCase().includes(S.filterTeam.toLowerCase()));
    const myCal = cal.filter(m =>
      (m.home && m.home.toLowerCase().includes(S.filterTeam.toLowerCase())) ||
      (m.away && m.away.toLowerCase().includes(S.filterTeam.toLowerCase()))
    );
    const last = [...myCal].reverse().find(m => m.played !== false && m.homeScore != null);
    const next = myCal.find(m => m.played === false || m.homeScore == null);
    const cid  = myRow ? getClubIdFromRow(myRow) : getClubId(S.filterTeam);
    const faved = isFav(comp.id, S.filterTeam);
    const cat  = getCatForComp(comp);

    spotlightHtml = `
      <div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:14px;overflow:hidden;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
        <div style="display:flex;align-items:center;gap:10px;padding:13px 14px;background:linear-gradient(135deg,rgba(0,61,165,.06),transparent);border-bottom:1px solid #e2e6ef">
          ${sImg(cid, "shield-md")}
          <div style="flex:1;min-width:0">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:800">${esc(S.filterTeam)}</div>
            <div style="font-size:11px;color:#6b7a99">${esc(comp.name.replace(/\s*\(2025-26\)/,""))}</div>
          </div>
          <button onclick="handleToggleFav('${comp.id}','${esc(S.filterTeam).replace(/'/g,"\\'")}','${esc(comp.name).replace(/'/g,"\\'")}','${esc(cat).replace(/'/g,"\\'")}',this)"
            style="background:none;border:none;font-size:24px;cursor:pointer;color:${faved?"#f0a500":"#cbd5e1"};padding:4px" title="${faved?"Eliminar de favorits":"Afegir a favorits"}">
            ${faved ? "★" : "☆"}
          </button>
        </div>
        ${myRow ? `
        <div style="display:grid;grid-template-columns:repeat(6,1fr);border-bottom:1px solid #e2e6ef">
          ${[
            {v:myRow.pos+"è", l:"Pos",   c:posColor(myRow.pos)},
            {v:myRow.pts,     l:"Pts",   c:"#e5001c"},
            {v:myRow.pg,      l:"V",     c:"#16a34a"},
            {v:myRow.pe,      l:"E",     c:"#d97706"},
            {v:myRow.pp,      l:"D",     c:"#dc2626"},
            {v:myRow.pj,      l:"PJ",    c:"#334155"},
          ].map(s=>`<div style="text-align:center;padding:10px 4px;border-right:1px solid #e2e6ef">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;color:${s.c};line-height:1">${s.v}</div>
            <div style="font-size:9px;color:#6b7a99;text-transform:uppercase;margin-top:2px">${s.l}</div>
          </div>`).join("")}
        </div>` : ""}
        <div style="padding:10px 12px">
          ${last ? `<div style="font-size:10px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px">Últim resultat</div>${matchCard(last,S.filterTeam)}` : ""}
          ${next ? `<div style="font-size:10px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px;margin-top:8px">Proper partit</div>${matchCard(next,S.filterTeam)}` : ""}
          ${!last && !next ? `<p style="color:#94a3b8;font-size:13px;padding:8px 0">Sense partits registrats</p>` : ""}
        </div>
      </div>`;
  }

  // Podium
  let podiumHtml = "";
  if (cl.length) {
    const top3 = cl.slice(0,3);
    const medals = ["🥇","🥈","🥉"];
    podiumHtml = `
      <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,30,80,.07);margin-bottom:14px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;padding:11px 14px 8px;border-bottom:1px solid #e2e6ef">Top 3</div>
        ${top3.map((r,i) => `
          <div onclick="setFilterTeam('${esc(r.team).replace(/'/g,"\\'")}','classif')" style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:${i<2?"1px solid #f0f2f8":"none"};cursor:pointer" onmouseover="this.style.background='#f8faff'" onmouseout="this.style.background=''">
            <span style="font-size:20px;width:28px;text-align:center">${medals[i]}</span>
            ${sImg(getClubIdFromRow(r), "shield-md")}
            <div style="flex:1">
              <div style="font-weight:700;font-size:14px">${esc(r.team)}</div>
              <div style="font-size:11px;color:#6b7a99">${r.pj||0} partits · ${r.gf||0} gols</div>
            </div>
            <div style="text-align:center">
              <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#e5001c">${r.pts||0}</div>
              <div style="font-size:9px;color:#6b7a99;text-transform:uppercase">pts</div>
            </div>
          </div>`).join("")}
      </div>`;
  }

  const totalGames = Math.round((cl.reduce((s,r)=>s+(r.pj||0),0))/2);
  const totalGoals = cl.reduce((s,r)=>s+(r.gf||0),0);
  const statsHtml = cl.length ? `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
      ${[
        {v:cl.length,  l:"Equips",  c:"#003da5"},
        {v:totalGames, l:"Partits", c:"#e5001c"},
        {v:totalGoals, l:"Gols",    c:"#d97706"},
        {v:(comp.pctPlayed||0)+"%",l:"Jugat",c:"#16a34a"},
      ].map(s=>`<div style="background:#fff;border-radius:12px;padding:12px 6px;text-align:center;box-shadow:0 1px 3px rgba(0,30,80,.05);border:1.5px solid #e2e6ef">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:${s.c};line-height:1">${s.v}</div>
        <div style="font-size:10px;font-weight:700;color:#6b7a99;margin-top:3px;text-transform:uppercase;letter-spacing:.04em">${s.l}</div>
      </div>`).join("")}
    </div>` : "";

  // Team selector (all teams in this competition)
  const teamNames = cl.length
    ? cl.map(r => r.team).filter(Boolean)
    : [...new Set([...((comp.calendar||[]).map(m=>m.home)), ...((comp.calendar||[]).map(m=>m.away))].filter(Boolean))].sort();

  const teamSelectorHtml = teamNames.length ? `
    <div style="background:#fff;border-radius:14px;padding:13px 14px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,30,80,.05);border:1.5px solid #e2e6ef">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;margin-bottom:9px">Selecciona el teu equip</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${teamNames.map(t => {
          const cid    = getClubId(t);
          const active = S.filterTeam && t.toLowerCase().includes(S.filterTeam.toLowerCase());
          return `<div onclick="setFilterTeam('${esc(t).replace(/'/g,"\\'")}','summary')"
            style="display:flex;align-items:center;gap:5px;background:${active?"#003da5":"#f0f4f8"};border:1.5px solid ${active?"#003da5":"#e2e6ef"};border-radius:18px;padding:5px 10px 5px 6px;font-size:12px;font-weight:600;color:${active?"#fff":"#334155"};cursor:pointer;transition:all .15s">
            ${sImg(cid,"chip-shield")}
            ${esc(t.replace(/Club Hoquei |CH |Cp |Club Patí /gi,"").trim())}
          </div>`;
        }).join("")}
      </div>
    </div>` : "";

  panel.innerHTML = spotlightHtml + (S.filterTeam ? "" : teamSelectorHtml) + podiumHtml + statsHtml + `
    <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:11px 13px;font-size:12px;color:#1d4ed8">
      💡 Act. ${S.data?.updatedAt ? new Date(S.data.updatedAt).toLocaleDateString("ca-ES") : "?"} ·
      <a href="https://jok.cat/competicio/${comp.id}" target="_blank" rel="noopener" style="color:#1d4ed8;font-weight:600">jok.cat →</a>
    </div>`;
}

window.setFilterTeam = function(teamName, tab) {
  S.filterTeam = teamName;
  S.tab = tab || "summary";
  document.querySelectorAll(".detail-tab").forEach(t => t.classList.toggle("active", t.dataset.tab===S.tab));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id===`panel-${S.tab}`));
  renderDetailPanels();
  window.scrollTo(0,0);
};

window.handleToggleFav = function(compId, teamName, compName, category, btn) {
  toggleFav(compId, teamName, compName, category);
  const faved = isFav(compId, teamName);
  btn.style.color = faved ? "#f0a500" : "#cbd5e1";
  btn.textContent = faved ? "★" : "☆";
};

// ── Classification ────────────────────────────────────────────
function renderClassif() {
  const comp  = S.comp;
  const cl    = comp.classification || [];
  const panel = document.getElementById("panel-classif");

  if (!cl.length) {
    panel.innerHTML = `<div style="text-align:center;padding:36px;color:#6b7a99">
      <p>Classificació no disponible.<br/>
      <a href="https://jok.cat/competicio/${comp.id}" target="_blank">Veure a jok.cat →</a></p></div>`;
    return;
  }

  const rows = cl.map(r => {
    const cid  = getClubIdFromRow(r);
    const mine = S.filterTeam && r.team && r.team.toLowerCase().includes(S.filterTeam.toLowerCase());
    const pc   = posColor(r.pos);
    const posEl = r.pos<=3
      ? ["🥇","🥈","🥉"][r.pos-1]
      : `<span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:${pc}">${r.pos}</span>`;

    return `<tr style="${mine?"background:#eff6ff":""}">
      <td style="padding:9px 6px;text-align:center">${posEl}</td>
      <td style="padding:9px 6px">
        <div style="display:flex;align-items:center;gap:7px">
          ${sImg(cid,"shield-sm")}
          <span style="font-weight:${mine?800:500};color:${mine?"#003da5":"#334155"}">${esc(r.team)}</span>
          ${mine?'<span style="color:#e5001c;font-size:10px">◀</span>':""}
        </div>
      </td>
      <td style="padding:9px 6px;text-align:center;color:#6b7a99">${r.pj??"-"}</td>
      <td style="padding:9px 6px;text-align:center;color:#16a34a;font-weight:600">${r.pg??"-"}</td>
      <td style="padding:9px 6px;text-align:center;color:#d97706">${r.pe??"-"}</td>
      <td style="padding:9px 6px;text-align:center;color:#dc2626">${r.pp??"-"}</td>
      <td style="padding:9px 6px;text-align:center;color:#6b7a99">${r.gf??"-"}</td>
      <td style="padding:9px 6px;text-align:center;color:#6b7a99">${r.gc??"-"}</td>
      <td style="padding:9px 6px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;color:${mine?"#e5001c":"#1a2035"}">${r.pts??"-"}</td>
    </tr>`;
  }).join("");

  panel.innerHTML = `
    <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f0f4f8">
            <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.06em;text-align:center;border-bottom:1px solid #e2e6ef">#</th>
            <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.06em;text-align:left;border-bottom:1px solid #e2e6ef">Equip</th>
            <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.06em;text-align:center;border-bottom:1px solid #e2e6ef">PJ</th>
            <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.06em;text-align:center;border-bottom:1px solid #e2e6ef">G</th>
            <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:.06em;text-align:center;border-bottom:1px solid #e2e6ef">E</th>
            <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.06em;text-align:center;border-bottom:1px solid #e2e6ef">Pe</th>
            <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.06em;text-align:center;border-bottom:1px solid #e2e6ef">GF</th>
            <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.06em;text-align:center;border-bottom:1px solid #e2e6ef">GC</th>
            <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#e5001c;text-transform:uppercase;letter-spacing:.06em;text-align:center;border-bottom:1px solid #e2e6ef">Pts</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Calendar ──────────────────────────────────────────────────
function renderCalendar() {
  const comp    = S.comp;
  let matches   = comp.calendar || [];
  const panel   = document.getElementById("panel-calendar");

  if (!matches.length) {
    panel.innerHTML = `<div style="text-align:center;padding:36px;color:#6b7a99">
      <p>Calendari no disponible.<br/>
      <a href="https://jok.cat/competicio/${comp.id}" target="_blank">Veure a jok.cat →</a></p></div>`;
    return;
  }

  // All team names for chips
  const teamNames = [...new Set([
    ...matches.map(m=>m.home), ...matches.map(m=>m.away)
  ].filter(Boolean))].sort();

  const chipsHtml = `
    <div style="margin-bottom:12px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px">Filtrar per equip</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        <div onclick="setCalFilter(null)" style="background:${!S.filterTeam?"#003da5":"#f0f4f8"};border:1.5px solid ${!S.filterTeam?"#003da5":"#e2e6ef"};border-radius:18px;padding:5px 12px;font-size:12px;font-weight:600;color:${!S.filterTeam?"#fff":"#334155"};cursor:pointer">Tots</div>
        ${teamNames.map(t => {
          const cid    = getClubId(t);
          const active = S.filterTeam && t.toLowerCase().includes(S.filterTeam.toLowerCase());
          return `<div onclick="setCalFilter('${esc(t).replace(/'/g,"\\'")}') " style="display:flex;align-items:center;gap:5px;background:${active?"#003da5":"#f0f4f8"};border:1.5px solid ${active?"#003da5":"#e2e6ef"};border-radius:18px;padding:5px 10px 5px 6px;font-size:12px;font-weight:600;color:${active?"#fff":"#334155"};cursor:pointer">
            ${sImg(cid,"chip-shield")} ${esc(t.replace(/Club Hoquei |CH |Cp |Club Patí /gi,"").trim())}
          </div>`;
        }).join("")}
      </div>
    </div>`;

  if (S.filterTeam) {
    matches = matches.filter(m =>
      (m.home && m.home.toLowerCase().includes(S.filterTeam.toLowerCase())) ||
      (m.away && m.away.toLowerCase().includes(S.filterTeam.toLowerCase()))
    );
  }

  // Group by jornada
  const byJ = {};
  matches.forEach(m => {
    const k = m.jornada ? `Jornada ${m.jornada}` : (m.date || "Sense data");
    if (!byJ[k]) byJ[k] = [];
    byJ[k].push(m);
  });

  const calHtml = Object.entries(byJ).map(([j, ms]) => `
    <div style="margin-bottom:12px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#6b7a99;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;padding:0 2px">${esc(j)}</div>
      ${ms.map(m => matchCard(m, S.filterTeam)).join("")}
    </div>`).join("");

  panel.innerHTML = chipsHtml + calHtml;
}

window.setCalFilter = function(team) {
  S.filterTeam = team;
  renderCalendar();
};

// ── Render all detail panels ──────────────────────────────────
function renderDetailPanels() {
  renderSummary();
  renderClassif();
  renderCalendar();
}

// ── CSS for shields ───────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  .shield-sm  { width:22px;height:22px;object-fit:contain;background:#f0f4f8;border-radius:4px;padding:1px;flex-shrink:0 }
  .shield-sm-ph { width:22px;height:22px;background:#f0f4f8;border-radius:4px;display:inline-block;flex-shrink:0 }
  .shield-md  { width:34px;height:34px;object-fit:contain;background:#f0f4f8;border-radius:8px;padding:2px;flex-shrink:0 }
  .shield-md-ph { width:34px;height:34px;background:#f0f4f8;border-radius:8px;display:inline-block;flex-shrink:0 }
  .chip-shield { width:16px;height:16px;object-fit:contain;flex-shrink:0 }
  .chip-shield-ph { width:16px;height:16px;display:inline-block }
`;
document.head.appendChild(style);

// ── Init ──────────────────────────────────────────────────────
async function init() {
  try {
    document.getElementById("loading-note").textContent = "Carregant dades...";
    const res = await fetch(DATA_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error("No s'han pogut carregar les dades");
    S.data = await res.json();

    document.getElementById("hero-season").textContent = S.data.season || "2025-26";
    document.getElementById("hero-sub").textContent =
      `${S.data.totalComps||0} competicions · Act. ${S.data.updatedAt ? new Date(S.data.updatedAt).toLocaleDateString("ca-ES") : "?"}`;

    document.getElementById("screen-loading").style.display = "none";
    renderHome();
  } catch(err) {
    document.getElementById("loading-note").innerHTML =
      `<span style="color:#e5001c">⚠️ ${err.message}</span>`;
  }
}

init();
