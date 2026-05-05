// FECAPA app.js v7
const SHIELD   = "https://sidgad.cloud/fecapa/images//logos_clubes/";
const DATA_URL = "./data.json";
const FAV_KEY  = "hoquei_favs_v7";

let DB      = null;
let homeTab = "favs"; // "favs" | "all"
let allSearch    = "";
let allFilterCat = "ALL";

let favs = [];
try { favs = JSON.parse(localStorage.getItem(FAV_KEY)||"[]"); } catch {}
const saveFavs = () => localStorage.setItem(FAV_KEY, JSON.stringify(favs));
const isFav    = (cid,tn) => favs.some(f=>f.compId===cid&&f.teamName===tn);
function toggleFav(compId, teamName, compName, category) {
  if (isFav(compId,teamName)) favs = favs.filter(f=>!(f.compId===compId&&f.teamName===teamName));
  else favs.push({compId,teamName,compName,category});
  saveFavs();
}

const $ = id => document.getElementById(id);
const esc = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/'/g,"&#39;");

const CAT_EMOJI = {
  "Nacional Catalana":"👑","1ª Catalana":"⭐","2ª Catalana":"🔵","3ª Catalana":"🟣",
  "Fem":"♀","Júnior":"🎯","Juvenil":"⚡","Infantil":"🏆","Aleví":"💪",
  "Benjamí":"🔥","Prebenjamí":"⭐","Veterans":"🧓","Altres":"📋",
};
const CAT_COLOR = {
  "Nacional Catalana":"#003da5","1ª Catalana":"#1a5dc7","2ª Catalana":"#2563eb",
  "3ª Catalana":"#7c3aed","Fem":"#db2777","Júnior":"#ea580c","Juvenil":"#16a34a",
  "Infantil":"#0891b2","Aleví":"#7c3aed","Benjamí":"#dc2626","Prebenjamí":"#d97706",
  "Veterans":"#6b7280","Altres":"#6b7280",
};

// clubIndex: teamId → {name, clubId}
// Classification rows already have teamId — use it directly
function getClubIdByTeamId(teamId) {
  if (!DB || !teamId) return null;
  return (DB.clubIndex||{})[teamId]?.clubId || null;
}

// Fallback name lookup (for match cards where we only have team name)
let _nameMap = null;
function buildNameMap() {
  if (_nameMap || !DB) return;
  _nameMap = new Map();
  for (const v of Object.values(DB.clubIndex||{})) {
    if (!v.clubId || !v.name) continue;
    // store both uppercase and lowercase versions
    const nl = v.name.toLowerCase();
    _nameMap.set(nl, v.clubId);
    const base = nl.replace(/\s+[a-d]$/, "").trim();
    if (!_nameMap.has(base)) _nameMap.set(base, v.clubId);
  }
}

function getClubId(name) {
  if (!DB || !name) return null;
  buildNameMap();
  const n    = name.toLowerCase();
  const base = n.replace(/\s+[a-d]$/, "").trim();
  if (_nameMap.has(n))    return _nameMap.get(n);
  if (_nameMap.has(base)) return _nameMap.get(base);
  // fuzzy
  for (const [k, v] of _nameMap) {
    if (k.length > 5 && (k.includes(base) || base.includes(k))) return v;
  }
  return null;
}

// Get clubId from a classification row (has direct clubId) or fall back to name lookup
function rowClubId(row) {
  return row.clubId || getClubIdByTeamId(row.teamId) || getClubId(row.team) || null;
}

function shieldImg(clubId, size) {
  size = size||22;
  const r = size<=22?4:8, p = size>22?2:1;
  const ph = `<span style="width:${size}px;height:${size}px;background:#e8ecf4;border-radius:${r}px;display:inline-block;flex-shrink:0"></span>`;
  if (!clubId) return ph;
  return `<img src="${SHIELD}${clubId}.gif" width="${size}" height="${size}" style="object-fit:contain;background:#f5f7fc;border-radius:${r}px;padding:${p}px;flex-shrink:0;vertical-align:middle" onerror="this.outerHTML='<span style=\\'width:${size}px;height:${size}px;background:#e8ecf4;border-radius:${r}px;display:inline-block;flex-shrink:0\\'></span>'" alt=""/>`;
}

function findComp(compId) {
  if (!DB) return null;
  for (const comps of Object.values(DB.categories)) {
    const c = comps.find(c=>c.id===compId);
    if (c) return c;
  }
  return null;
}

const posColor = p => p===1?"#d97706":p===2?"#64748b":p===3?"#b45309":"#6b7a99";
const teamIn   = (name,filter) => !!(filter&&name&&name.toLowerCase().includes(filter.toLowerCase()));

function matchCard(m, myTeam) {
  const riH    = teamIn(m.home, myTeam);
  const riA    = teamIn(m.away, myTeam);
  const played = m.played!==false && m.homeScore!=null;
  const cidH   = getClubId(m.home);
  const cidA   = getClubId(m.away);
  let border = "#e2e6ef", badge = "";
  if (played && myTeam) {
    const draw = m.homeScore===m.awayScore;
    const win  = riH ? m.homeScore>m.awayScore : m.awayScore>m.homeScore;
    border = draw?"#d97706":win?"#16a34a":"#dc2626";
    const [bg,tc,lb] = draw?["#fef3c7","#b45309","Empat"]:win?["#dcfce7","#16a34a","Victòria"]:["#fee2e2","#dc2626","Derrota"];
    badge = `<div style="text-align:center;margin-top:5px"><span style="background:${bg};color:${tc};font-size:11px;font-weight:700;padding:2px 10px;border-radius:6px">${lb}</span></div>`;
  }
  const score = played
    ? `<div style="background:#e5001c;color:#fff;border-radius:8px;padding:4px 12px;font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;line-height:1.1;white-space:nowrap;min-width:64px;text-align:center">${m.homeScore} – ${m.awayScore}</div>`
    : `<div style="background:#1a5dc7;color:#fff;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;white-space:nowrap;min-width:48px;text-align:center">VS</div>`;
  return `
    <div style="background:#fff;border:1.5px solid ${border};border-left:4px solid ${border};border-radius:10px;padding:9px 11px;margin-bottom:5px">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="flex:1;display:flex;align-items:center;justify-content:flex-end;gap:5px;min-width:0">
          <span style="font-size:12px;font-weight:${riH?800:500};color:${riH?"#003da5":"#334155"};text-align:right;line-height:1.3;overflow-wrap:anywhere">${esc(m.home)}</span>
          ${shieldImg(cidH,22)}
        </div>
        <div style="flex-shrink:0;text-align:center;min-width:68px">
          ${score}
          <div style="font-size:10px;color:#94a3b8;margin-top:2px;white-space:nowrap">${esc(m.date||"")}${!played&&m.time?` · ${esc(m.time)}`:""}</div>
        </div>
        <div style="flex:1;display:flex;align-items:center;justify-content:flex-start;gap:5px;min-width:0">
          ${shieldImg(cidA,22)}
          <span style="font-size:12px;font-weight:${riA?800:500};color:${riA?"#003da5":"#334155"};text-align:left;line-height:1.3;overflow-wrap:anywhere">${esc(m.away)}</span>
        </div>
      </div>
      ${badge}
    </div>`;
}

// ── HOME ──────────────────────────────────────────────────────
function renderHome() {
  $("screen-detail").style.display  = "none";
  $("screen-picker").style.display  = "none";
  $("screen-home").style.display    = "flex";
  renderHomeHeader();
  if (homeTab === "favs") renderFavs();
  else renderAllComps();
}

function renderHomeHeader() {
  $("home-header").innerHTML = `
    <div style="max-width:680px;margin:0 auto;display:flex;justify-content:space-between;align-items:center">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900">🏒 <span style="color:#e5001c">FECAPA</span></div>
      <button onclick="openPicker()" style="background:#e5001c;border:none;color:#fff;font-weight:700;font-size:13px;padding:7px 14px;border-radius:9px;cursor:pointer">+ Afegir equip</button>
    </div>
    <div style="max-width:680px;margin:8px auto 0;display:flex;gap:4px">
      <button onclick="setHomeTab('favs')" style="flex:1;background:${homeTab==='favs'?"#1a2035":"#f0f4f8"};color:${homeTab==='favs'?"#fff":"#6b7a99"};border:1.5px solid ${homeTab==='favs'?"#1a2035":"#e2e6ef"};border-radius:9px;padding:8px;font-size:13px;font-weight:700;cursor:pointer">
        ⭐ Els meus equips ${favs.length?`(${favs.length})`:""}
      </button>
      <button onclick="setHomeTab('all')" style="flex:1;background:${homeTab==='all'?"#1a2035":"#f0f4f8"};color:${homeTab==='all'?"#fff":"#6b7a99"};border:1.5px solid ${homeTab==='all'?"#1a2035":"#e2e6ef"};border-radius:9px;padding:8px;font-size:13px;font-weight:700;cursor:pointer">
        🔍 Totes les competicions
      </button>
    </div>`;
}

window.setHomeTab = function(tab) { homeTab = tab; renderHome(); };

// ── FAVS tab ──────────────────────────────────────────────────
function renderFavs() {
  const body = $("home-body");
  if (!favs.length) {
    body.innerHTML = `
      <div style="text-align:center;padding:48px 20px 32px">
        <div style="font-size:48px;margin-bottom:12px">⭐</div>
        <h2 style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800;color:#1a2035;margin-bottom:8px">Cap equip afegit</h2>
        <p style="color:#6b7a99;font-size:14px;line-height:1.6;margin-bottom:24px">Afegeix els equips que vols seguir i veuràs aquí la seva posició, últim resultat i proper partit.</p>
        <button onclick="openPicker()" style="background:#e5001c;border:none;color:#fff;font-weight:700;font-size:15px;padding:13px 28px;border-radius:12px;cursor:pointer">+ Afegir el meu equip</button>
      </div>`;
    return;
  }
  const updAt = DB?.updatedAt ? new Date(DB.updatedAt).toLocaleDateString("ca-ES") : "?";
  body.innerHTML = favs.map(fav => buildFavCard(fav)).join("") +
    `<p style="text-align:center;font-size:11px;color:#cbd5e1;margin-top:4px;padding-bottom:16px">Actualitzat: ${updAt}</p>`;
}

function buildFavCard(fav) {
  const comp  = findComp(fav.compId);
  if (!comp) return "";
  const cl    = comp.classification||[];
  const cal   = comp.calendar||[];
  const myRow = cl.find(r => teamIn(r.team, fav.teamName));
  const myCal = cal.filter(m => teamIn(m.home,fav.teamName)||teamIn(m.away,fav.teamName));
  const last  = [...myCal].reverse().find(m => m.played!==false&&m.homeScore!=null);
  const next  = myCal.find(m => m.played===false||m.homeScore==null);
  const cid   = myRow?rowClubId(myRow):getClubId(fav.teamName);
  const catColor = CAT_COLOR[fav.category]||"#e5001c";

  // Mini classification: ±2 rows around my team
  let classifHtml = "";
  if (cl.length && myRow) {
    const myIdx = cl.findIndex(r => teamIn(r.team, fav.teamName));
    const slice = cl.slice(Math.max(0,myIdx-2), Math.min(cl.length,myIdx+3));
    classifHtml = `
      <div style="border-top:1px solid #f0f2f8;border-bottom:1px solid #f0f2f8">
        <div style="display:flex;background:#f8fafc;padding:3px 12px">
          <div style="width:26px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8">#</div>
          <div style="flex:1;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8">Equip</div>
          <div style="width:26px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8">PJ</div>
          <div style="width:22px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#16a34a">G</div>
          <div style="width:22px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#d97706">E</div>
          <div style="width:22px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#dc2626">Pe</div>
          <div style="width:32px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#e5001c">Pts</div>
        </div>
        ${slice.map(r => {
          const mine = teamIn(r.team, fav.teamName);
          const rcid = rowClubId(r);
          return `<div style="display:flex;align-items:center;background:${mine?"#eff6ff":"#fff"};border-top:1px solid #f0f2f8;padding:5px 12px">
            <div style="width:26px;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:${posColor(r.pos)}">${r.pos}</div>
            <div style="flex:1;display:flex;align-items:center;gap:5px;min-width:0">
              ${shieldImg(rcid,18)}
              <span style="font-size:12px;font-weight:${mine?800:500};color:${mine?"#003da5":"#334155"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.team)}</span>
            </div>
            <div style="width:26px;text-align:center;font-size:12px;color:#94a3b8">${r.pj??"-"}</div>
            <div style="width:22px;text-align:center;font-size:12px;color:#16a34a;font-weight:600">${r.pg??"-"}</div>
            <div style="width:22px;text-align:center;font-size:12px;color:#d97706">${r.pe??"-"}</div>
            <div style="width:22px;text-align:center;font-size:12px;color:#dc2626">${r.pp??"-"}</div>
            <div style="width:32px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:${mine?"#e5001c":"#1a2035"}">${r.pts??"-"}</div>
          </div>`;
        }).join("")}
      </div>`;
  }

  return `
    <div style="background:#fff;border:1.5px solid #e2e6ef;border-top:4px solid ${catColor};border-radius:14px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <div style="display:flex;align-items:center;gap:10px;padding:11px 13px">
        ${shieldImg(cid,40)}
        <div style="flex:1;min-width:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fav.teamName)}</div>
          <div style="font-size:11px;color:#6b7a99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((comp.name||"").replace(/\s*\(2025-26\)/,""))}</div>
        </div>
        ${myRow?`<div style="background:${posColor(myRow.pos)}18;color:${posColor(myRow.pos)};border:1.5px solid ${posColor(myRow.pos)}44;border-radius:10px;padding:5px 9px;text-align:center;flex-shrink:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900;line-height:1">${myRow.pos}è</div>
          <div style="font-size:9px;letter-spacing:.04em;margin-top:1px">${myRow.pts} pts</div>
        </div>`:""}
        <button onclick="removeFav('${esc(fav.compId)}','${esc(fav.teamName)}')" style="background:none;border:none;color:#cbd5e1;font-size:16px;cursor:pointer;padding:4px;flex-shrink:0">✕</button>
      </div>
      ${classifHtml}
      <div style="padding:9px 12px">
        ${last?`<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">Últim resultat</div>${matchCard(last,fav.teamName)}`:""}
        ${next?`<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;${last?"margin-top:7px":""}">Proper partit</div>${matchCard(next,fav.teamName)}`:""}
        ${!last&&!next?`<p style="text-align:center;color:#94a3b8;font-size:13px;padding:2px 0">Sense partits registrats</p>`:""}
      </div>
      <div style="display:flex;gap:6px;padding:0 12px 11px">
        <button onclick="openDetail('${esc(fav.compId)}','${esc(fav.teamName)}','classif')" style="flex:1;background:#f5f7fc;border:1px solid #e2e6ef;border-radius:8px;padding:7px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">📊 Classificació</button>
        <button onclick="openDetail('${esc(fav.compId)}','${esc(fav.teamName)}','calendar')" style="flex:1;background:#f5f7fc;border:1px solid #e2e6ef;border-radius:8px;padding:7px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">📅 Calendari</button>
      </div>
    </div>`;
}

window.removeFav = function(compId, teamName) {
  favs = favs.filter(f=>!(f.compId===compId&&f.teamName===teamName));
  saveFavs(); renderHome();
};

// ── ALL COMPS tab ─────────────────────────────────────────────
function renderAllComps() {
  const catNames = Object.keys(DB.categories).filter(k => DB.categories[k].length>0);
  const allCats  = ["ALL", ...catNames];

  const filterBar = `
    <div style="background:#fff;border-bottom:1px solid #e2e6ef;overflow-x:auto;white-space:nowrap;margin-bottom:0">
      <div style="display:inline-flex;padding:0 12px">
        ${allCats.map(cat => {
          const active = allFilterCat===cat;
          const label  = cat==="ALL"?"Totes":cat;
          const emoji  = cat==="ALL"?"🏒":(CAT_EMOJI[cat]||"📋");
          const count  = cat==="ALL"
            ? Object.values(DB.categories).reduce((s,v)=>s+v.length,0)
            : DB.categories[cat].length;
          return `<button onclick="setAllFilter('${esc(cat)}')" style="background:none;border:none;border-bottom:3px solid ${active?"#e5001c":"transparent"};font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:${active?"#e5001c":"#6b7a99"};padding:10px 11px 7px;cursor:pointer;white-space:nowrap;text-transform:uppercase">${emoji} ${label} <span style="font-size:10px;opacity:.6">${count}</span></button>`;
        }).join("")}
      </div>
    </div>
    <div style="padding:10px 14px 6px;max-width:680px;margin:0 auto">
      <input id="all-search" placeholder="🔍  Cerca equip o competició..." value="${esc(allSearch)}"
        style="width:100%;background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:10px 14px;font-size:14px;color:#1a2035;outline:none"
        oninput="setAllSearch(this.value)"/>
    </div>`;

  let cats = allFilterCat==="ALL"
    ? Object.entries(DB.categories)
    : [[allFilterCat, DB.categories[allFilterCat]||[]]];

  if (allSearch) {
    const q = allSearch.toLowerCase();
    cats = cats.map(([cat,comps]) => [cat, comps.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.classification||[]).some(r=>r.team&&r.team.toLowerCase().includes(q))
    )]).filter(([,c])=>c.length>0);
  }

  const compsHtml = cats.map(([cat,comps]) => {
    if (!comps.length) return "";
    const color = CAT_COLOR[cat]||"#666";
    const emoji = CAT_EMOJI[cat]||"📋";
    return `
      <div style="margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;padding:0 14px">
          <span style="font-size:15px">${emoji}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:800;text-transform:uppercase;color:${color}">${cat}</span>
          <span style="font-size:11px;font-weight:700;color:#94a3b8;background:#e8ecf4;border-radius:10px;padding:1px 7px">${comps.length}</span>
        </div>
        <div style="padding:0 14px">
          ${comps.map(comp => `
            <div onclick="openDetail('${comp.id}')" style="background:#fff;border:1.5px solid #e2e6ef;border-radius:11px;margin-bottom:6px;overflow:hidden;cursor:pointer;box-shadow:0 1px 3px rgba(0,30,80,.04);transition:all .15s" onmouseover="this.style.borderColor='${color}';this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='#e2e6ef';this.style.transform='none'">
              <div style="display:flex;align-items:center;gap:9px;padding:10px 13px">
                <div style="width:36px;height:36px;border-radius:8px;background:${color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;color:${color}">${comp.pctPlayed!=null?comp.pctPlayed+"%":"?"}</span>
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(comp.name.replace(/\s*\(2025-26\)/,""))}</div>
                  <div style="font-size:11px;color:#94a3b8;margin-top:1px">${(comp.classification||[]).length||"?"} equips</div>
                </div>
                <span style="color:#cbd5e1;font-size:18px">›</span>
              </div>
              <div style="height:3px;background:#f0f4f8"><div style="height:100%;background:linear-gradient(90deg,${color},${color}88);width:${comp.pctPlayed||0}%"></div></div>
            </div>`).join("")}
        </div>
      </div>`;
  }).join("");

  $("home-body").innerHTML = filterBar + `<div style="max-width:680px;margin:0 auto;padding-bottom:24px">${
    cats.length && cats.some(([,c])=>c.length) ? compsHtml : `<div style="text-align:center;padding:40px;color:#94a3b8">Cap resultat per «${esc(allSearch)}»</div>`
  }</div>`;
}

window.setAllFilter = function(cat) { allFilterCat=cat; renderAllComps(); };
window.setAllSearch = function(v)   { allSearch=v;      renderAllComps(); };

// ── PICKER ────────────────────────────────────────────────────
function openPicker() {
  $("screen-home").style.display   = "none";
  $("screen-detail").style.display = "none";
  $("screen-picker").style.display = "flex";
  renderPicker();
}
window.openPicker = openPicker;

function renderPicker() {
  const catNames = Object.entries(DB.categories).filter(([,v])=>v.length>0).map(([k])=>k);
  $("picker-content").innerHTML = `
    <div style="padding:20px 16px 32px">
      <h2 style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;color:#1a2035;margin-bottom:4px">Afegir equip favorit</h2>
      <p style="font-size:13px;color:#6b7a99;margin-bottom:20px">Selecciona la categoria i l'equip</p>
      <div style="margin-bottom:14px">
        <label style="display:block;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">1. Categoria</label>
        <select id="pick-cat" onchange="onPickCat()" style="width:100%;background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:11px 14px;font-size:14px;color:#1a2035;cursor:pointer">
          <option value="">— Selecciona una categoria —</option>
          ${catNames.map(c=>`<option value="${esc(c)}">${CAT_EMOJI[c]||"🏒"} ${esc(c)}</option>`).join("")}
        </select>
      </div>
      <div id="pick-comp-wrap" style="display:none;margin-bottom:14px">
        <label style="display:block;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">2. Competició</label>
        <select id="pick-comp" onchange="onPickComp()" style="width:100%;background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:11px 14px;font-size:14px;color:#1a2035;cursor:pointer">
          <option value="">— Selecciona la competició —</option>
        </select>
      </div>
      <div id="pick-team-wrap" style="display:none;margin-bottom:20px">
        <label style="display:block;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">3. Equip</label>
        <select id="pick-team" style="width:100%;background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:11px 14px;font-size:14px;color:#1a2035;cursor:pointer">
          <option value="">— Selecciona l'equip —</option>
        </select>
      </div>
      <div id="pick-add-wrap" style="display:none">
        <button onclick="addFavFromPicker()" style="width:100%;background:#e5001c;border:none;color:#fff;font-weight:700;font-size:15px;padding:13px;border-radius:12px;cursor:pointer">⭐ Afegir als favorits</button>
      </div>
    </div>`;
}

window.onPickCat = function() {
  const cat = $("pick-cat").value;
  $("pick-comp-wrap").style.display = cat?"block":"none";
  $("pick-team-wrap").style.display = "none";
  $("pick-add-wrap").style.display  = "none";
  if (!cat) return;
  const comps = DB.categories[cat]||[];
  $("pick-comp").innerHTML = `<option value="">— Selecciona la competició —</option>` +
    comps.map(c=>`<option value="${esc(c.id)}">${esc(c.name.replace(/\s*\(2025-26\)/,""))}</option>`).join("");
};

window.onPickComp = function() {
  const compId = $("pick-comp").value;
  $("pick-team-wrap").style.display = compId?"block":"none";
  $("pick-add-wrap").style.display  = "none";
  if (!compId) return;
  const comp  = findComp(compId);
  if (!comp) return;
  const cl    = comp.classification||[];
  const cal   = comp.calendar||[];
  const names = cl.length
    ? cl.map(r=>r.team).filter(Boolean)
    : [...new Set([...cal.map(m=>m.home),...cal.map(m=>m.away)].filter(Boolean))].sort();
  $("pick-team").innerHTML = `<option value="">— Selecciona l'equip —</option>` +
    names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
  $("pick-team").onchange = () => {
    $("pick-add-wrap").style.display = $("pick-team").value?"block":"none";
  };
};

window.addFavFromPicker = function() {
  const cat    = $("pick-cat").value;
  const compId = $("pick-comp").value;
  const team   = $("pick-team").value;
  const comp   = findComp(compId);
  if (!cat||!compId||!team||!comp) return;
  if (!isFav(compId,team)) {
    favs.push({compId, teamName:team, category:cat, compName:comp.name});
    saveFavs();
  }
  $("screen-picker").style.display = "none";
  homeTab = "favs";
  renderHome();
};

// ── DETAIL ────────────────────────────────────────────────────
let detailComp = null;
let detailTeam = null;
let detailTab  = "classif";

function openDetail(compId, teamName, tab) {
  detailComp = findComp(compId);
  detailTeam = teamName||null;
  detailTab  = tab||"classif";
  if (!detailComp) return;
  $("screen-home").style.display   = "none";
  $("screen-picker").style.display = "none";
  $("screen-detail").style.display = "flex";
  $("detail-comp-name").textContent = detailComp.name.replace(/\s*\(2025-26\)/,"");
  $("detail-meta").textContent = `${(detailComp.classification||[]).length} equips · ${detailComp.pctPlayed??"?"}% jugat`;
  document.querySelectorAll(".detail-tab").forEach(t => t.classList.toggle("active", t.dataset.tab===detailTab));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id===`panel-${detailTab}`));
  renderDetailClassif();
  renderDetailCalendar();
  window.scrollTo(0,0);
}
window.openDetail = openDetail;

function setupListeners() {
  const bb = $("back-btn");
  if (bb) bb.addEventListener("click", () => {
    $("screen-detail").style.display = "none";
    renderHome();
  });
  document.querySelectorAll(".detail-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      detailTab = tab.dataset.tab;
      document.querySelectorAll(".detail-tab").forEach(t => t.classList.toggle("active",t===tab));
      document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active",p.id===`panel-${detailTab}`));
    });
  });
}

function renderDetailClassif() {
  const cl = detailComp.classification||[];
  if (!cl.length) {
    $("panel-classif").innerHTML = `<div style="text-align:center;padding:32px;color:#6b7a99">Classificació no disponible.<br/><a href="https://jok.cat/competicio/${detailComp.id}" target="_blank">Veure a jok.cat →</a></div>`;
    return;
  }
  $("panel-classif").innerHTML = `
    <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f8fafc">
          ${["#","Equip","PJ","G","E","Pe","GF","GC","Pts"].map((h,i)=>`<th style="padding:8px ${i<2?6:4}px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;text-align:${i===1?"left":"center"};border-bottom:1px solid #e2e6ef">${h}</th>`).join("")}
        </tr></thead>
        <tbody>
          ${cl.map(r=>{
            const mine = teamIn(r.team, detailTeam);
            const cid  = rowClubId(r);
            const pc   = posColor(r.pos);
            const pos  = r.pos<=3?["🥇","🥈","🥉"][r.pos-1]:`<span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:${pc}">${r.pos}</span>`;
            return `<tr style="background:${mine?"#eff6ff":"transparent"};border-bottom:1px solid #f0f2f8">
              <td style="padding:9px 6px;text-align:center">${pos}</td>
              <td style="padding:9px 6px"><div style="display:flex;align-items:center;gap:6px">
                ${shieldImg(cid,22)}
                <span style="font-weight:${mine?800:500};color:${mine?"#003da5":"#334155"}">${esc(r.team)}</span>
                ${mine?`<span style="color:#e5001c;font-size:10px">◀</span>`:""}
              </div></td>
              <td style="padding:9px 4px;text-align:center;color:#94a3b8">${r.pj??"-"}</td>
              <td style="padding:9px 4px;text-align:center;color:#16a34a;font-weight:600">${r.pg??"-"}</td>
              <td style="padding:9px 4px;text-align:center;color:#d97706">${r.pe??"-"}</td>
              <td style="padding:9px 4px;text-align:center;color:#dc2626">${r.pp??"-"}</td>
              <td style="padding:9px 4px;text-align:center;color:#94a3b8">${r.gf??"-"}</td>
              <td style="padding:9px 4px;text-align:center;color:#94a3b8">${r.gc??"-"}</td>
              <td style="padding:9px 4px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;color:${mine?"#e5001c":"#1a2035"}">${r.pts??"-"}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

function renderDetailCalendar() {
  const all = detailComp.calendar||[];
  if (!all.length) {
    $("panel-calendar").innerHTML = `<div style="text-align:center;padding:32px;color:#6b7a99">Calendari no disponible.<br/><a href="https://jok.cat/competicio/${detailComp.id}" target="_blank">Veure a jok.cat →</a></div>`;
    return;
  }
  const names = [...new Set([...all.map(m=>m.home),...all.map(m=>m.away)].filter(Boolean))].sort();
  const chips = `
    <div style="margin-bottom:11px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Filtrar per equip</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        <button onclick="setCalTeam(null)" style="background:${!detailTeam?"#1a2035":"#f0f4f8"};border:1.5px solid ${!detailTeam?"#1a2035":"#e2e6ef"};border-radius:16px;padding:4px 11px;font-size:12px;font-weight:600;color:${!detailTeam?"#fff":"#334155"};cursor:pointer">Tots</button>
        ${names.map(t=>{
          const act = teamIn(t, detailTeam);
          const cid = getClubId(t);
          return `<button onclick="setCalTeam('${esc(t)}')" style="display:inline-flex;align-items:center;gap:4px;background:${act?"#1a2035":"#f0f4f8"};border:1.5px solid ${act?"#1a2035":"#e2e6ef"};border-radius:16px;padding:4px 10px 4px 5px;font-size:12px;font-weight:600;color:${act?"#fff":"#334155"};cursor:pointer">
            ${shieldImg(cid,16)} ${esc(t.replace(/Club Hoquei |CH |Cp |Club Patí /gi,"").trim())}
          </button>`;
        }).join("")}
      </div>
    </div>`;
  const matches = detailTeam ? all.filter(m=>teamIn(m.home,detailTeam)||teamIn(m.away,detailTeam)) : all;
  const byJ = {};
  matches.forEach(m=>{ const k=m.jornada?`Jornada ${m.jornada}`:(m.date||"?"); (byJ[k]||(byJ[k]=[])).push(m); });
  $("panel-calendar").innerHTML = chips + Object.entries(byJ).map(([j,ms])=>`
    <div style="margin-bottom:11px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">${esc(j)}</div>
      ${ms.map(m=>matchCard(m,detailTeam)).join("")}
    </div>`).join("");
}

window.setCalTeam = function(t) { detailTeam=t; renderDetailClassif(); renderDetailCalendar(); };

// ── Init ──────────────────────────────────────────────────────
async function init() {
  try {
    $("loading-note").textContent = "Carregant dades...";
    const res = await fetch(DATA_URL+"?t="+Date.now());
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
    const text = await res.text();
    DB = JSON.parse(text);
    if (!DB.categories) throw new Error("data.json incomplet");
    setupListeners();
    $("screen-loading").style.display = "none";
    $("screen-home").style.display    = "flex";
    renderHome();
  } catch(e) {
    $("loading-note").innerHTML = `<span style="color:#e5001c;font-weight:700">⚠️ Error</span><br/><span style="font-size:12px;color:#6b7a99">${esc(e.message)}</span>`;
  }
}
init();
