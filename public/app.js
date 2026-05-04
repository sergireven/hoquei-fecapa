// ============================================================
// FECAPA Hoquei Patins — app.js v5
// ============================================================

const SHIELD   = "https://sidgad.cloud/fecapa/images/logos_clubes/";
const DATA_URL = "./data.json";
const FAV_KEY  = "hoquei_favs_v5";

const S = {
  data: null, view: "home", comp: null,
  filterCat: "ALL", search: "", tab: "summary",
  filterTeam: null, prevView: "home",
};

// ── Favourites ────────────────────────────────────────────────
let favs = [];
try { favs = JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch {}
const saveFavs = () => localStorage.setItem(FAV_KEY, JSON.stringify(favs));
const isFav    = (cid, tn) => favs.some(f => f.compId===cid && f.teamName===tn);
function toggleFav(compId, teamName, compName, category) {
  if (isFav(compId, teamName)) favs = favs.filter(f => !(f.compId===compId && f.teamName===teamName));
  else favs.push({ compId, teamName, compName, category });
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
const esc = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/'/g,"&#39;");

function sImg(clubId, size) {
  size = size || 22;
  const r  = size <= 22 ? 4 : 8;
  const p  = size > 22 ? 2 : 1;
  const ph = `<span style="width:${size}px;height:${size}px;background:#f0f4f8;border-radius:${r}px;display:inline-block;flex-shrink:0"></span>`;
  if (!clubId) return ph;
  return `<img src="${SHIELD}${clubId}.gif" style="width:${size}px;height:${size}px;object-fit:contain;background:#f0f4f8;border-radius:${r}px;padding:${p}px;flex-shrink:0" onerror="this.style.display='none'" alt=""/>`;
}

const posColor = p => p===1?"#d97706":p===2?"#64748b":p===3?"#b45309":"#94a3b8";

function getClubId(name) {
  if (!S.data || !name) return null;
  const n = name.toLowerCase().replace(/\s+[a-d]$/,"").trim();
  for (const v of Object.values(S.data.clubIndex||{})) {
    if (!v.clubId) continue;
    if ((v.name||"").toLowerCase() === name.toLowerCase()) return v.clubId;
    const vn = (v.name||"").toLowerCase().replace(/\s+[a-d]$/,"").trim();
    if (vn === n) return v.clubId;
  }
  for (const v of Object.values(S.data.clubIndex||{})) {
    if (!v.clubId) continue;
    const vn = (v.name||"").toLowerCase().replace(/\s+[a-d]$/,"").trim();
    if (n.includes(vn) || vn.includes(n)) return v.clubId;
  }
  return null;
}

function findComp(compId) {
  if (!S.data) return null;
  for (const comps of Object.values(S.data.categories)) {
    const c = comps.find(c => c.id===compId);
    if (c) return c;
  }
  return null;
}

function getCatForComp(comp) {
  if (!S.data) return "Altres";
  for (const [cat,comps] of Object.entries(S.data.categories))
    if (comps.some(c => c.id===comp.id)) return cat;
  return "Altres";
}

function teamMatch(name, filter) {
  if (!filter || !name) return false;
  return name.toLowerCase().includes(filter.toLowerCase());
}

// ── Match card ────────────────────────────────────────────────
function matchCard(m, myTeam) {
  const riH    = teamMatch(m.home, myTeam);
  const riA    = teamMatch(m.away, myTeam);
  const played = m.played !== false && m.homeScore != null;
  const cidH   = getClubId(m.home);
  const cidA   = getClubId(m.away);

  let border = "#e2e6ef";
  let badge  = "";
  if (played && myTeam) {
    const draw = m.homeScore === m.awayScore;
    const win  = riH ? m.homeScore > m.awayScore : m.awayScore > m.homeScore;
    border = draw ? "#d97706" : win ? "#16a34a" : "#dc2626";
    const [bg,tc,lb] = draw
      ? ["#fef3c7","#b45309","Empat"]
      : win ? ["#dcfce7","#16a34a","Victòria"] : ["#fee2e2","#dc2626","Derrota"];
    badge = `<div style="text-align:center;margin-top:5px"><span style="background:${bg};color:${tc};font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px">${lb}</span></div>`;
  }

  const score = played
    ? `<div style="background:#e5001c;color:#fff;border-radius:8px;padding:5px 12px;font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;white-space:nowrap;line-height:1">${m.homeScore} – ${m.awayScore}</div>`
    : `<div style="background:#1a5dc7;color:#fff;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;white-space:nowrap">VS</div>`;

  return `
    <div style="background:#fff;border:1.5px solid ${border};border-left:4px solid ${border};border-radius:11px;padding:10px 12px;margin-bottom:6px">
      ${m.jornada?`<div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">J${m.jornada}</div>`:""}
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;display:flex;align-items:center;gap:6px;justify-content:flex-end;min-width:0">
          <span style="font-size:12px;font-weight:${riH?800:500};color:${riH?"#003da5":"#334155"};text-align:right;line-height:1.3;word-break:break-word">${esc(m.home)}</span>
          ${sImg(cidH,22)}
        </div>
        <div style="flex-shrink:0;text-align:center;min-width:74px">
          ${score}
          <div style="font-size:10px;color:#94a3b8;margin-top:3px">${esc(m.date||"")}${!played&&m.time?` · ${esc(m.time)}`:""}</div>
        </div>
        <div style="flex:1;display:flex;align-items:center;gap:6px;justify-content:flex-start;min-width:0">
          ${sImg(cidA,22)}
          <span style="font-size:12px;font-weight:${riA?800:500};color:${riA?"#003da5":"#334155"};text-align:left;line-height:1.3;word-break:break-word">${esc(m.away)}</span>
        </div>
      </div>
      ${badge}
    </div>`;
}

// ── CAT CONFIG ────────────────────────────────────────────────
const CAT_CONFIG = {
  "ALL":              {emoji:"🏒",color:"#e5001c"},
  "Nacional Catalana":{emoji:"👑",color:"#003da5"},
  "1ª Catalana":      {emoji:"⭐",color:"#1a5dc7"},
  "2ª Catalana":      {emoji:"🔵",color:"#2563eb"},
  "3ª Catalana":      {emoji:"🟣",color:"#7c3aed"},
  "Fem":              {emoji:"♀", color:"#db2777"},
  "Júnior":           {emoji:"🎯",color:"#ea580c"},
  "Juvenil":          {emoji:"⚡",color:"#16a34a"},
  "Infantil":         {emoji:"🏆",color:"#0891b2"},
  "Aleví":            {emoji:"💪",color:"#7c3aed"},
  "Benjamí":          {emoji:"🔥",color:"#dc2626"},
  "Prebenjamí":       {emoji:"⭐",color:"#d97706"},
  "Veterans":         {emoji:"🧓",color:"#6b7280"},
  "Altres":           {emoji:"📋",color:"#6b7280"},
};

// ── HOME ──────────────────────────────────────────────────────
function renderHome() {
  showScreen("home");
  if (!favs.length) {
    screens.home.innerHTML = `
      <div style="background:linear-gradient(135deg,#003da5 0%,#001f6e 60%,#e5001c 100%);padding:52px 20px 44px;text-align:center">
        <div style="font-size:56px;margin-bottom:14px">🏒</div>
        <h1 style="font-family:'Barlow Condensed',sans-serif;font-size:clamp(32px,8vw,52px);font-weight:900;color:#fff;line-height:.9;letter-spacing:-1px;margin-bottom:10px">HOQUEI PATINS<br/><span style="color:#f0a500">CATALUNYA</span></h1>
        <p style="color:rgba(255,255,255,.7);font-size:14px;margin-bottom:28px">Segueix el teu equip a la FECAPA</p>
        <button onclick="goToPicker()" style="background:#e5001c;border:none;color:#fff;font-weight:700;font-size:16px;padding:14px 32px;border-radius:14px;cursor:pointer">🔍 Cerca el teu equip</button>
      </div>
      <div style="max-width:500px;margin:0 auto;padding:32px 16px;text-align:center;color:#6b7a99">
        <p style="font-size:14px;line-height:1.7">Cerca la teva competició, selecciona el teu equip i clica <strong>⭐</strong> per afegir-lo als favorits.<br/>Apareixerà aquí amb posició, últim resultat i proper partit.</p>
      </div>`;
    return;
  }

  const cards = favs.map(buildFavCard).join("");
  const updAt = S.data?.updatedAt ? new Date(S.data.updatedAt).toLocaleDateString("ca-ES") : "?";

  screens.home.innerHTML = `
    <div style="background:#fff;border-bottom:1px solid #e2e6ef;padding:11px 16px;position:sticky;top:0;z-index:50;box-shadow:0 1px 4px rgba(0,20,60,.06)">
      <div style="max-width:620px;margin:0 auto;display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900">🏒 <span style="color:#e5001c">FECAPA</span></div>
        <button onclick="goToPicker()" style="background:#f0f4f8;border:1px solid #e2e6ef;border-radius:10px;padding:7px 14px;cursor:pointer;font-size:13px;font-weight:600;color:#1a2035">🔍 Cercar</button>
      </div>
    </div>
    <div style="max-width:620px;margin:0 auto;padding:16px 14px 32px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">Els meus equips</div>
      ${cards}
      <button onclick="goToPicker()" style="width:100%;background:#fff;border:2px dashed #e2e6ef;color:#94a3b8;font-size:14px;font-weight:600;padding:14px;border-radius:12px;cursor:pointer;margin-top:4px">+ Afegir equip favorit</button>
      <p style="text-align:center;font-size:11px;color:#cbd5e1;margin-top:14px">Actualitzat: ${updAt}</p>
    </div>`;
}

function buildFavCard(fav) {
  const comp = findComp(fav.compId);
  if (!comp) return "";
  const cl    = comp.classification || [];
  const cal   = comp.calendar || [];
  const myRow = cl.find(r => teamMatch(r.team, fav.teamName));
  const myCal = cal.filter(m => teamMatch(m.home, fav.teamName) || teamMatch(m.away, fav.teamName));
  const last  = [...myCal].reverse().find(m => m.played!==false && m.homeScore!=null);
  const next  = myCal.find(m => m.played===false || m.homeScore==null);
  const cid   = myRow ? (myRow.clubId || getClubId(myRow.team)) : getClubId(fav.teamName);
  const cat   = CAT_CONFIG[fav.category] || CAT_CONFIG["Altres"];

  // Mini classification: show ±2 rows around my team
  let classifHtml = "";
  if (cl.length && myRow) {
    const myIdx = cl.findIndex(r => teamMatch(r.team, fav.teamName));
    const from  = Math.max(0, myIdx - 2);
    const to    = Math.min(cl.length, myIdx + 3);
    const slice = cl.slice(from, to);

    classifHtml = `
      <div style="border-top:1px solid #f0f2f8;border-bottom:1px solid #f0f2f8">
        <div style="display:flex;background:#f8fafc;padding:4px 12px">
          <div style="width:28px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">#</div>
          <div style="flex:1;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Equip</div>
          <div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8">PJ</div>
          <div style="width:24px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#16a34a">G</div>
          <div style="width:24px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#d97706">E</div>
          <div style="width:24px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#dc2626">Pe</div>
          <div style="width:34px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#e5001c">Pts</div>
        </div>
        ${slice.map(r => {
          const mine = teamMatch(r.team, fav.teamName);
          const pc   = posColor(r.pos);
          const rcid = r.clubId || getClubId(r.team);
          return `<div style="display:flex;align-items:center;background:${mine?"#eff6ff":"#fff"};border-top:1px solid #f0f2f8;padding:6px 12px">
            <div style="width:28px;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;color:${pc}">${r.pos}</div>
            <div style="flex:1;display:flex;align-items:center;gap:5px;min-width:0">
              ${sImg(rcid,18)}
              <span style="font-size:12px;font-weight:${mine?800:500};color:${mine?"#003da5":"#334155"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.team)}</span>
            </div>
            <div style="width:28px;text-align:center;font-size:12px;color:#94a3b8">${r.pj??"-"}</div>
            <div style="width:24px;text-align:center;font-size:12px;color:#16a34a;font-weight:600">${r.pg??"-"}</div>
            <div style="width:24px;text-align:center;font-size:12px;color:#d97706">${r.pe??"-"}</div>
            <div style="width:24px;text-align:center;font-size:12px;color:#dc2626">${r.pp??"-"}</div>
            <div style="width:34px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;color:${mine?"#e5001c":"#1a2035"}">${r.pts??"-"}</div>
          </div>`;
        }).join("")}
      </div>`;
  }

  return `
    <div style="background:#fff;border:1.5px solid #e2e6ef;border-top:4px solid ${cat.color};border-radius:14px;overflow:hidden;margin-bottom:16px;box-shadow:0 2px 10px rgba(0,30,80,.07)">
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px">
        ${sImg(cid,38)}
        <div style="flex:1;min-width:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fav.teamName)}</div>
          <div style="font-size:11px;color:#6b7a99;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(comp.name.replace(/\s*\(2025-26\)/,""))}</div>
        </div>
        ${myRow?`
        <div style="background:${posColor(myRow.pos)}18;color:${posColor(myRow.pos)};border:1.5px solid ${posColor(myRow.pos)}44;border-radius:10px;padding:6px 10px;text-align:center;flex-shrink:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;line-height:1">${myRow.pos}è</div>
          <div style="font-size:9px;letter-spacing:.04em;margin-top:1px">${myRow.pts} pts</div>
        </div>`:""}
        <button onclick="removeFav('${esc(fav.compId)}','${esc(fav.teamName)}')" style="background:none;border:none;color:#cbd5e1;font-size:16px;cursor:pointer;padding:4px;flex-shrink:0" title="Eliminar">✕</button>
      </div>

      ${classifHtml}

      <div style="padding:10px 12px">
        ${last?`<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">Últim resultat</div>${matchCard(last,fav.teamName)}`:""}
        ${next?`<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;${last?"margin-top:8px":""}">Proper partit</div>${matchCard(next,fav.teamName)}`:""}
        ${!last&&!next?`<p style="font-size:12px;color:#94a3b8;padding:4px 0;text-align:center">Sense partits registrats</p>`:""}
      </div>

      <div style="display:flex;gap:6px;padding:0 12px 12px">
        <button onclick="openComp('${esc(fav.compId)}','${esc(fav.teamName)}','classif')" style="flex:1;background:#f0f4f8;border:1px solid #e2e6ef;border-radius:8px;padding:8px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">📊 Classificació</button>
        <button onclick="openComp('${esc(fav.compId)}','${esc(fav.teamName)}','calendar')" style="flex:1;background:#f0f4f8;border:1px solid #e2e6ef;border-radius:8px;padding:8px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">📅 Calendari</button>
      </div>
    </div>`;
}

window.removeFav = function(compId, teamName) {
  favs = favs.filter(f => !(f.compId===compId && f.teamName===teamName));
  saveFavs(); renderHome();
};

window.goToPicker = function() {
  S.prevView = S.view;
  showScreen("picker");
  renderFilterTabs();
  renderPicker();
  setTimeout(() => { try { document.getElementById("search-input").focus(); } catch {} }, 100);
};

// ── PICKER ────────────────────────────────────────────────────
function renderFilterTabs() {
  document.getElementById("filter-tabs").innerHTML = ["ALL",...Object.keys(S.data.categories)].map(cat => {
    const cfg   = CAT_CONFIG[cat] || {emoji:"📋"};
    const label = cat==="ALL" ? "Totes" : cat;
    const count = cat==="ALL"
      ? Object.values(S.data.categories).reduce((s,v)=>s+v.length,0)
      : (S.data.categories[cat]||[]).length;
    return `<button class="filter-btn ${S.filterCat===cat?"active":""}" data-cat="${cat}">${cfg.emoji} ${label} <span style="font-size:10px;opacity:.6">${count}</span></button>`;
  }).join("");
  document.getElementById("filter-tabs").querySelectorAll(".filter-btn").forEach(btn =>
    btn.addEventListener("click", () => { S.filterCat=btn.dataset.cat; renderFilterTabs(); renderPicker(); })
  );
}

function renderPicker() {
  const q = S.search.toLowerCase();
  let cats = S.filterCat==="ALL"
    ? Object.entries(S.data.categories)
    : [[S.filterCat, S.data.categories[S.filterCat]||[]]];
  if (q) cats = cats.map(([cat,comps]) => [cat, comps.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.classification||[]).some(r => r.team&&r.team.toLowerCase().includes(q)) ||
    (c.teams||[]).some(t => t.name&&t.name.toLowerCase().includes(q))
  )]).filter(([,c]) => c.length>0);

  const body = document.getElementById("picker-body");
  if (!cats.length || cats.every(([,c])=>!c.length)) {
    body.innerHTML = `<div style="text-align:center;padding:40px;color:#6b7a99"><div style="font-size:40px;margin-bottom:10px">🔍</div><p>Cap resultat per «<b>${esc(q)}</b>»</p></div>`;
    return;
  }
  body.innerHTML = cats.map(([cat,comps]) => {
    if (!comps.length) return "";
    const cfg = CAT_CONFIG[cat]||{emoji:"📋",color:"#666"};
    return `
      <div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span style="font-size:16px">${cfg.emoji}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:800;text-transform:uppercase;color:${cfg.color}">${cat}</span>
          <span style="font-size:11px;font-weight:700;color:#6b7a99;background:#e2e6ef;border-radius:10px;padding:1px 7px">${comps.length}</span>
        </div>
        ${comps.map(comp => `
          <div onclick="openComp('${comp.id}')" style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;margin-bottom:7px;overflow:hidden;cursor:pointer;box-shadow:0 1px 3px rgba(0,30,80,.04)" onmouseover="this.style.borderColor='#1a5dc7';this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='#e2e6ef';this.style.transform='none'">
            <div style="display:flex;align-items:center;gap:10px;padding:11px 13px">
              <div style="width:38px;height:38px;border-radius:9px;background:#f0f4f8;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <span style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:800;color:#003da5">${comp.pctPlayed!=null?comp.pctPlayed+"%":"?"}</span>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(comp.name.replace(/\s*\(2025-26\)/,""))}</div>
                <div style="font-size:11px;color:#6b7a99;margin-top:2px">${(comp.classification||comp.teams||[]).length} equips</div>
              </div>
              <span style="color:#94a3b8;font-size:18px;flex-shrink:0">›</span>
            </div>
            <div style="height:3px;background:#f0f4f8"><div style="height:100%;background:linear-gradient(90deg,#003da5,#e5001c);width:${comp.pctPlayed||0}%"></div></div>
          </div>`).join("")}
      </div>`;
  }).join("");
}

document.getElementById("search-input").addEventListener("input", e => { S.search=e.target.value; renderPicker(); });

// ── DETAIL ────────────────────────────────────────────────────
window.openComp = function(compId, highlightTeam, defaultTab) {
  const comp = findComp(compId);
  if (!comp) return;
  S.comp=comp; S.filterTeam=highlightTeam||null; S.tab=defaultTab||"summary"; S.prevView=S.view;
  showScreen("detail");
  document.getElementById("detail-comp-name").textContent = comp.name.replace(/\s*\(2025-26\)/,"");
  document.getElementById("detail-meta").textContent = `${(comp.classification||comp.teams||[]).length} equips · ${comp.pctPlayed??"?"}% jugat`;
  document.querySelectorAll(".detail-tab").forEach(t => t.classList.toggle("active", t.dataset.tab===S.tab));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id===`panel-${S.tab}`));
  renderDetailPanels();
  window.scrollTo(0,0);
};

document.getElementById("back-btn").addEventListener("click", () => {
  if (S.prevView==="picker") { showScreen("picker"); }
  else { renderHome(); }
});

document.querySelectorAll(".detail-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    S.tab=tab.dataset.tab;
    document.querySelectorAll(".detail-tab").forEach(t => t.classList.toggle("active",t===tab));
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active",p.id===`panel-${S.tab}`));
  });
});

// ── Summary panel ─────────────────────────────────────────────
function renderSummary() {
  const comp  = S.comp;
  const cl    = comp.classification||[];
  const cal   = comp.calendar||[];
  const panel = document.getElementById("panel-summary");

  // Team selector chips
  const teamNames = cl.length
    ? cl.map(r=>r.team).filter(Boolean)
    : [...new Set([...cal.map(m=>m.home),...cal.map(m=>m.away)].filter(Boolean))].sort();

  const chipsHtml = teamNames.length ? `
    <div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:14px;padding:12px 14px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,30,80,.05)">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Selecciona el teu equip ⭐</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${teamNames.map(t => {
          const active = teamMatch(t, S.filterTeam);
          const rcid   = getClubId(t);
          return `<div onclick="setFilterTeam('${esc(t)}','summary')" style="display:flex;align-items:center;gap:5px;background:${active?"#003da5":"#f0f4f8"};border:1.5px solid ${active?"#003da5":"#e2e6ef"};border-radius:18px;padding:5px 10px 5px 6px;font-size:12px;font-weight:600;color:${active?"#fff":"#334155"};cursor:pointer;transition:all .15s">
            ${sImg(rcid,16)}
            ${esc(t.replace(/Club Hoquei |CH |Cp |Club Patí /gi,"").trim())}
          </div>`;
        }).join("")}
      </div>
    </div>` : "";

  // Spotlight for selected team
  let spotlightHtml = "";
  if (S.filterTeam) {
    const myRow = cl.find(r => teamMatch(r.team, S.filterTeam));
    const myCal = cal.filter(m => teamMatch(m.home,S.filterTeam)||teamMatch(m.away,S.filterTeam));
    const last  = [...myCal].reverse().find(m => m.played!==false&&m.homeScore!=null);
    const next  = myCal.find(m => m.played===false||m.homeScore==null);
    const cid   = myRow?(myRow.clubId||getClubId(myRow.team)):getClubId(S.filterTeam);
    const faved = isFav(comp.id, S.filterTeam);
    const cat   = getCatForComp(comp);

    spotlightHtml = `
      <div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:14px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
        <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,rgba(0,61,165,.05),transparent);border-bottom:1px solid #e2e6ef">
          ${sImg(cid,36)}
          <div style="flex:1;min-width:0">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:800">${esc(S.filterTeam)}</div>
            <div style="font-size:11px;color:#6b7a99;margin-top:1px">${esc(comp.name.replace(/\s*\(2025-26\)/,""))}</div>
          </div>
          <button onclick="handleToggleFav('${esc(comp.id)}','${esc(S.filterTeam)}','${esc(comp.name)}','${esc(cat)}',this)" style="background:none;border:none;font-size:24px;cursor:pointer;color:${faved?"#f0a500":"#cbd5e1"};padding:4px" title="${faved?"Eliminar de favorits":"Afegir a favorits"}">${faved?"★":"☆"}</button>
        </div>
        ${myRow?`
        <div style="display:grid;grid-template-columns:repeat(6,1fr)">
          ${[{v:myRow.pos+"è",l:"Pos",c:posColor(myRow.pos)},{v:myRow.pts,l:"Pts",c:"#e5001c"},{v:myRow.pg,l:"V",c:"#16a34a"},{v:myRow.pe,l:"E",c:"#d97706"},{v:myRow.pp,l:"D",c:"#dc2626"},{v:myRow.pj,l:"PJ",c:"#334155"}].map(s=>`
          <div style="text-align:center;padding:10px 4px;border-right:1px solid #f0f2f8;border-bottom:1px solid #f0f2f8">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;color:${s.c};line-height:1">${s.v}</div>
            <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;margin-top:2px">${s.l}</div>
          </div>`).join("")}
        </div>`:""}
        <div style="padding:10px 12px">
          ${last?`<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">Últim resultat</div>${matchCard(last,S.filterTeam)}`:""}
          ${next?`<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;${last?"margin-top:8px":""}">Proper partit</div>${matchCard(next,S.filterTeam)}`:""}
          ${!last&&!next?`<p style="color:#94a3b8;font-size:13px;padding:4px 0;text-align:center">Sense partits registrats</p>`:""}
        </div>
      </div>`;
  }

  // Podium top 3
  let podiumHtml = "";
  if (cl.length) {
    podiumHtml = `
      <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,30,80,.07);margin-bottom:14px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;padding:11px 14px 8px;border-bottom:1px solid #e2e6ef">Top 3</div>
        ${cl.slice(0,3).map((r,i) => `
          <div onclick="setFilterTeam('${esc(r.team)}','summary')" style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:${i<2?"1px solid #f0f2f8":"none"};cursor:pointer" onmouseover="this.style.background='#f8faff'" onmouseout="this.style.background=''">
            <span style="font-size:20px;width:26px;text-align:center">${["🥇","🥈","🥉"][i]}</span>
            ${sImg(r.clubId||getClubId(r.team),30)}
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.team)}</div>
              <div style="font-size:11px;color:#6b7a99">${r.pj||0} partits · ${r.gf||0} gols</div>
            </div>
            <div style="text-align:center;flex-shrink:0">
              <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#e5001c">${r.pts||0}</div>
              <div style="font-size:9px;color:#94a3b8;text-transform:uppercase">pts</div>
            </div>
          </div>`).join("")}
      </div>`;
  }

  const tg = Math.round(cl.reduce((s,r)=>s+(r.pj||0),0)/2);
  const gg = cl.reduce((s,r)=>s+(r.gf||0),0);
  const statsHtml = cl.length ? `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
      ${[{v:cl.length,l:"Equips",c:"#003da5"},{v:tg,l:"Partits",c:"#e5001c"},{v:gg,l:"Gols",c:"#d97706"},{v:(comp.pctPlayed||0)+"%",l:"Jugat",c:"#16a34a"}].map(s=>`
      <div style="background:#fff;border-radius:12px;padding:12px 6px;text-align:center;box-shadow:0 1px 3px rgba(0,30,80,.05);border:1.5px solid #e2e6ef">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:${s.c};line-height:1">${s.v}</div>
        <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-top:3px;text-transform:uppercase;letter-spacing:.04em">${s.l}</div>
      </div>`).join("")}
    </div>` : "";

  panel.innerHTML = chipsHtml + spotlightHtml + (S.filterTeam?"":podiumHtml) + statsHtml + `
    <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:11px 13px;font-size:12px;color:#1d4ed8">
      💡 Act. ${S.data?.updatedAt?new Date(S.data.updatedAt).toLocaleDateString("ca-ES"):"?"} ·
      <a href="https://jok.cat/competicio/${comp.id}" target="_blank" rel="noopener" style="color:#1d4ed8;font-weight:600">jok.cat →</a>
    </div>`;
}

window.setFilterTeam = function(teamName, tab) {
  S.filterTeam=teamName; S.tab=tab||"summary";
  document.querySelectorAll(".detail-tab").forEach(t => t.classList.toggle("active",t.dataset.tab===S.tab));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active",p.id===`panel-${S.tab}`));
  renderDetailPanels(); window.scrollTo(0,0);
};

window.handleToggleFav = function(compId, teamName, compName, category, btn) {
  toggleFav(compId, teamName, compName, category);
  const f = isFav(compId, teamName);
  btn.style.color = f?"#f0a500":"#cbd5e1";
  btn.textContent = f?"★":"☆";
  // Also refresh home if needed
};

// ── Classification ────────────────────────────────────────────
function renderClassif() {
  const comp  = S.comp;
  const cl    = comp.classification||[];
  const panel = document.getElementById("panel-classif");

  if (!cl.length) {
    panel.innerHTML = `<div style="text-align:center;padding:36px;color:#6b7a99"><p>Classificació no disponible.<br/><a href="https://jok.cat/competicio/${comp.id}" target="_blank" style="color:#003da5">Veure a jok.cat →</a></p></div>`;
    return;
  }

  panel.innerHTML = `
    <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f8fafc">
          <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;text-align:center;border-bottom:1px solid #e2e6ef">#</th>
          <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;text-align:left;border-bottom:1px solid #e2e6ef">Equip</th>
          <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;text-align:center;border-bottom:1px solid #e2e6ef">PJ</th>
          <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;text-align:center;border-bottom:1px solid #e2e6ef">G</th>
          <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#d97706;text-transform:uppercase;text-align:center;border-bottom:1px solid #e2e6ef">E</th>
          <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;text-align:center;border-bottom:1px solid #e2e6ef">Pe</th>
          <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;text-align:center;border-bottom:1px solid #e2e6ef">GF</th>
          <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;text-align:center;border-bottom:1px solid #e2e6ef">GC</th>
          <th style="padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#e5001c;text-transform:uppercase;text-align:center;border-bottom:1px solid #e2e6ef">Pts</th>
        </tr></thead>
        <tbody>
          ${cl.map(r => {
            const mine = teamMatch(r.team, S.filterTeam);
            const pc   = posColor(r.pos);
            const cid  = r.clubId||getClubId(r.team);
            const pos  = r.pos<=3?["🥇","🥈","🥉"][r.pos-1]:`<span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:${pc}">${r.pos}</span>`;
            return `<tr style="${mine?"background:#eff6ff":""}">
              <td style="padding:9px 6px;text-align:center">${pos}</td>
              <td style="padding:9px 6px">
                <div style="display:flex;align-items:center;gap:7px">
                  ${sImg(cid,22)}
                  <span style="font-weight:${mine?800:500};color:${mine?"#003da5":"#334155"}">${esc(r.team)}</span>
                  ${mine?'<span style="color:#e5001c;font-size:10px">◀</span>':""}
                </div>
              </td>
              <td style="padding:9px 6px;text-align:center;color:#94a3b8">${r.pj??"-"}</td>
              <td style="padding:9px 6px;text-align:center;color:#16a34a;font-weight:600">${r.pg??"-"}</td>
              <td style="padding:9px 6px;text-align:center;color:#d97706">${r.pe??"-"}</td>
              <td style="padding:9px 6px;text-align:center;color:#dc2626">${r.pp??"-"}</td>
              <td style="padding:9px 6px;text-align:center;color:#94a3b8">${r.gf??"-"}</td>
              <td style="padding:9px 6px;text-align:center;color:#94a3b8">${r.gc??"-"}</td>
              <td style="padding:9px 6px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;color:${mine?"#e5001c":"#1a2035"}">${r.pts??"-"}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

// ── Calendar ──────────────────────────────────────────────────
function renderCalendar() {
  const comp  = S.comp;
  const all   = comp.calendar||[];
  const panel = document.getElementById("panel-calendar");

  if (!all.length) {
    panel.innerHTML = `<div style="text-align:center;padding:36px;color:#6b7a99"><p>Calendari no disponible.<br/><a href="https://jok.cat/competicio/${comp.id}" target="_blank" style="color:#003da5">Veure a jok.cat →</a></p></div>`;
    return;
  }

  // All unique team names for chips
  const teamNames = [...new Set([...all.map(m=>m.home),...all.map(m=>m.away)].filter(Boolean))].sort();

  const chipsHtml = `
    <div style="margin-bottom:12px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px">Filtrar per equip</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        <div onclick="setCalFilter(null)" style="background:${!S.filterTeam?"#003da5":"#f0f4f8"};border:1.5px solid ${!S.filterTeam?"#003da5":"#e2e6ef"};border-radius:18px;padding:5px 12px;font-size:12px;font-weight:600;color:${!S.filterTeam?"#fff":"#334155"};cursor:pointer">Tots</div>
        ${teamNames.map(t => {
          const active = teamMatch(t, S.filterTeam);
          const rcid   = getClubId(t);
          return `<div onclick="setCalFilter('${esc(t)}')" style="display:flex;align-items:center;gap:5px;background:${active?"#003da5":"#f0f4f8"};border:1.5px solid ${active?"#003da5":"#e2e6ef"};border-radius:18px;padding:5px 10px 5px 6px;font-size:12px;font-weight:600;color:${active?"#fff":"#334155"};cursor:pointer">
            ${sImg(rcid,16)} ${esc(t.replace(/Club Hoquei |CH |Cp |Club Patí /gi,"").trim())}
          </div>`;
        }).join("")}
      </div>
    </div>`;

  // Filter matches
  let matches = S.filterTeam
    ? all.filter(m => teamMatch(m.home,S.filterTeam)||teamMatch(m.away,S.filterTeam))
    : all;

  // Group by jornada
  const byJ = {};
  matches.forEach(m => {
    const k = m.jornada ? `Jornada ${m.jornada}` : (m.date||"Sense data");
    if (!byJ[k]) byJ[k]=[];
    byJ[k].push(m);
  });

  const calHtml = Object.entries(byJ).map(([j,ms]) => `
    <div style="margin-bottom:12px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;padding:0 2px">${esc(j)}</div>
      ${ms.map(m => matchCard(m, S.filterTeam)).join("")}
    </div>`).join("");

  panel.innerHTML = chipsHtml + calHtml;
}

window.setCalFilter = function(team) { S.filterTeam=team; renderCalendar(); };

function renderDetailPanels() { renderSummary(); renderClassif(); renderCalendar(); }

// ── Init ──────────────────────────────────────────────────────
async function init() {
  try {
    document.getElementById("loading-note").textContent = "Carregant dades...";
    const res = await fetch(DATA_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error("No s'han pogut carregar les dades");
    S.data = await res.json();
    document.getElementById("hero-season").textContent = S.data.season||"2025-26";
    document.getElementById("hero-sub").textContent = `${S.data.totalComps||0} competicions · Act. ${S.data.updatedAt?new Date(S.data.updatedAt).toLocaleDateString("ca-ES"):"?"}`;
    document.getElementById("screen-loading").style.display = "none";
    renderHome();
  } catch(err) {
    document.getElementById("loading-note").innerHTML = `<span style="color:#e5001c">⚠️ ${err.message}</span>`;
  }
}
init();
