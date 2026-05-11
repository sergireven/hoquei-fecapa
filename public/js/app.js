// FECAPA app.js v8
const SHIELD   = "https://sidgad.cloud/fecapa/images//logos_clubes/";
const DATA_URL = "./data.json";
const FAV_KEY  = "hoquei_favs_v8";
let selectedSeason = null;

function getCurrentSeason() {
  return selectedSeason || DB?.season || "";
}

function getActiveData() {
  const season = getCurrentSeason();
  return DB?.snapshots?.[season] || DB || {};
}

function getSeasonOptions() {
  return DB?.availableSeasons || [DB?.season].filter(Boolean);
}

function stripSeasonSuffix(name) {
  return String(name || "").replace(/\s*\(\d{4}-\d{2}\)\s*$/, "");
}
let DB      = null;
let homeTab = "favs"; // "favs" | "all" | "club"
let allSearch     = "";
let allFilterCat  = "ALL";
let allOnlyActive = true;  // hide 100% finished comps by default
let clubSearch    = "";
let selectedClub  = null;  // { name, teams:[{compId, teamName, teamId}] }

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

// ── Club ID lookups ───────────────────────────────────────────
function getClubIdByTeamId(teamId) {
  if (!teamId) return null;
  return (getActiveData()?.clubIndex || {})[teamId]?.clubId || null;
}

let _nameMap = null;
function buildNameMap() {
  if (_nameMap || !DB) return;
  _nameMap = new Map();

  const snapshots = DB?.snapshots
    ? Object.values(DB.snapshots)
    : [DB];

  for (const snapshot of snapshots) {
    for (const comps of Object.values(snapshot?.categories || {})) {
      for (const comp of comps) {
        for (const r of (comp.classification || [])) {
          if (!r.clubId || !r.team) continue;
          const n = r.team.toLowerCase();
          const base = n.replace(/\s+[a-z]$/, "").trim();
          if (!_nameMap.has(n)) _nameMap.set(n, r.clubId);
          if (!_nameMap.has(base)) _nameMap.set(base, r.clubId);
        }
      }
    }
  }
}

function getClubId(name) {
  if (!DB||!name) return null;
  buildNameMap();
  const n    = name.toLowerCase();
  const base = n.replace(/\s+[a-d]$/,"").trim();
  if (_nameMap.has(n))    return _nameMap.get(n);
  if (_nameMap.has(base)) return _nameMap.get(base);
  for (const [k,v] of _nameMap) {
    if (k.length>5 && (k.includes(base)||base.includes(k))) return v;
  }
  return null;
}

function rowClubId(row) {
  return row.clubId || getClubIdByTeamId(row.teamId) || getClubId(row.team) || null;
}

function shieldImg(clubId, size) {
  size = size||22;
  const r = size<=22?4:8, p = size>22?2:1;
  if (!clubId) return `<span style="width:${size}px;height:${size}px;background:#e8ecf4;border-radius:${r}px;display:inline-block;flex-shrink:0"></span>`;
  // clubId can be a full filename like "278_3.png" or just "278"
  const src = clubId.includes(".") ? SHIELD + clubId : SHIELD + clubId + ".gif";
  return `<img src="${src}" width="${size}" height="${size}" style="object-fit:contain;background:#f5f7fc;border-radius:${r}px;padding:${p}px;flex-shrink:0;vertical-align:middle" onerror="this.style.visibility='hidden'" alt=""/>`;
}

function findComp(compId) {
  const data = getActiveData();
  for (const comps of Object.values(data?.categories || {})) {
    const found = (comps || []).find(c => c.id === compId);
    if (found) return found;
  }
  return null;
}

const posColor = p => p===1?"#d97706":p===2?"#64748b":p===3?"#b45309":"#6b7a99";
const teamIn   = (name,filter) => !!(filter&&name&&name.toLowerCase().includes(filter.toLowerCase()));
const isActive = comp => (comp.pctPlayed||0) < 100;

// Parse DD-MM date to sortable number (MMDD)
function dateSort(m) {
  if (!m.date) return 9999;
  const parts = m.date.split("-");
  if (parts.length !== 2) return 9999;
  return parseInt(parts[1]) * 100 + parseInt(parts[0]); // MM*100 + DD
}

// Get last played and next pending, sorted by actual date
function getLastAndNext(matches, teamName) {
  const mine = matches.filter(m =>
    teamIn(m.home, teamName) || teamIn(m.away, teamName)
  );
  const played  = mine.filter(m => m.played !== false && m.homeScore != null)
                      .sort((a,b) => dateSort(a) - dateSort(b));
  const pending = mine.filter(m => m.played === false  || m.homeScore == null)
                      .sort((a,b) => dateSort(a) - dateSort(b));
  return {
    last: played.length ? played[played.length - 1] : null,
    next: pending.length ? pending[0] : null,
  };
}

// ── Match card ────────────────────────────────────────────────
function matchCard(m, myTeam) {
  const riH    = teamIn(m.home,myTeam), riA = teamIn(m.away,myTeam);
  const played = m.played!==false && m.homeScore!=null;
  const cidH   = getClubId(m.home), cidA = getClubId(m.away);
  let border="#e2e6ef", badge="";
  if (played && myTeam) {
    const draw=m.homeScore===m.awayScore, win=riH?m.homeScore>m.awayScore:m.awayScore>m.homeScore;
    border=draw?"#d97706":win?"#16a34a":"#dc2626";
    const [bg,tc,lb]=draw?["#fef3c7","#b45309","Empat"]:win?["#dcfce7","#16a34a","Victòria"]:["#fee2e2","#dc2626","Derrota"];
    badge=`<div style="text-align:center;margin-top:5px"><span style="background:${bg};color:${tc};font-size:11px;font-weight:700;padding:2px 10px;border-radius:6px">${lb}</span></div>`;
  }
  const score=played
    ?`<div style="background:#e5001c;color:#fff;border-radius:8px;padding:4px 12px;font-family:'Barlow Condensed',sans-serif;font-size:clamp(17px,5vw,20px);font-weight:900;line-height:1.1;white-space:nowrap;min-width:60px;text-align:center">${m.homeScore} – ${m.awayScore}</div>`
    :`<div style="background:#1a5dc7;color:#fff;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;white-space:nowrap;min-width:48px;text-align:center">VS</div>`;
  return `
    <div style="background:#fff;border:1.5px solid ${border};border-left:4px solid ${border};border-radius:10px;padding:9px 11px;margin-bottom:5px">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="flex:1;display:flex;align-items:center;justify-content:flex-end;gap:5px;min-width:0">
          <span style="font-size:clamp(12px,3.5vw,14px);font-weight:${riH?800:500};color:${riH?"#003da5":"#334155"};text-align:right;line-height:1.3;overflow-wrap:anywhere">${esc(m.home)}</span>
          ${shieldImg(cidH,22)}
        </div>
        <div style="flex-shrink:0;text-align:center;min-width:68px">
          ${score}
          <div style="font-size:10px;color:#94a3b8;margin-top:2px;white-space:nowrap">${esc(m.date||"")}${!played&&m.time?` · ${esc(m.time)}`:""}</div>
        </div>
        <div style="flex:1;display:flex;align-items:center;justify-content:flex-start;gap:5px;min-width:0">
          ${shieldImg(cidA,22)}
          <span style="font-size:clamp(12px,3.5vw,14px);font-weight:${riA?800:500};color:${riA?"#003da5":"#334155"};text-align:left;line-height:1.3;overflow-wrap:anywhere">${esc(m.away)}</span>
        </div>
      </div>
      ${badge}
    </div>`;
}

// ── HOME header & tabs ────────────────────────────────────────
function renderHome() {
  $("screen-detail").style.display = "none";
  $("screen-picker").style.display = "none";
  $("screen-home").style.display   = "flex";

  const seasons = getSeasonOptions();
  const currentSeason = getCurrentSeason();

  $("home-header").innerHTML = `
    <div style="max-width:720px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900">🏒 <span style="color:#e5001c">FECAPA</span></div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${seasons.length ? `
          <select onchange="setSeason(this.value)" style="background:#fff;border:1.5px solid #e2e6ef;border-radius:9px;padding:7px 10px;font-size:13px;font-weight:700;color:#1a2035;cursor:pointer">
            ${seasons.map(season => `<option value="${esc(season)}" ${season===currentSeason?"selected":""}>${esc(season)}</option>`).join("")}
          </select>
        ` : ""}
        <button onclick="openPicker()" style="background:#e5001c;border:none;color:#fff;font-weight:700;font-size:13px;padding:7px 14px;border-radius:9px;cursor:pointer">+ Afegir equip</button>
      </div>
    </div>
    <div style="max-width:720px;margin:0 auto;display:flex;gap:4px">
      <button onclick="setHomeTab('favs')" style="flex:1;background:${homeTab==='favs'?"#1a2035":"#f0f4f8"};color:${homeTab==='favs'?"#fff":"#6b7a99"};border:1.5px solid ${homeTab==='favs'?"#1a2035":"#e2e6ef"};border-radius:10px;padding:10px 12px;font-weight:700;cursor:pointer">⭐ Els meus</button>
      <button onclick="setHomeTab('club')" style="flex:1;background:${homeTab==='club'?"#1a2035":"#f0f4f8"};color:${homeTab==='club'?"#fff":"#6b7a99"};border:1.5px solid ${homeTab==='club'?"#1a2035":"#e2e6ef"};border-radius:10px;padding:10px 12px;font-weight:700;cursor:pointer">🏟 Clubs</button>
      <button onclick="setHomeTab('all')" style="flex:1;background:${homeTab==='all'?"#1a2035":"#f0f4f8"};color:${homeTab==='all'?"#fff":"#6b7a99"};border:1.5px solid ${homeTab==='all'?"#1a2035":"#e2e6ef"};border-radius:10px;padding:10px 12px;font-weight:700;cursor:pointer">📋 Competicions</button>
    </div>`;

  if (homeTab === "favs") renderFavs();
  else if (homeTab === "club") renderClubTab();
  else renderAllComps();
}
window.setHomeTab = t => { homeTab=t; renderHome(); };
window.setSeason = function (season) {
  selectedSeason = season;
  window.selectedSeason = season;

  _nameMap = null;

  const categories = getActiveData()?.categories || {};
  if (allFilterCat && allFilterCat !== "ALL" && !categories[allFilterCat]) {
    allFilterCat = "ALL";
  }

  detailComp = null;
  selectedClub = null;

  renderHome();
};
// ── FAVS ──────────────────────────────────────────────────────
function renderFavs() {
  const body=$("home-body");
  if (!favs.length) {
    body.innerHTML=`<div style="text-align:center;padding:48px 20px 32px">
      <div style="font-size:48px;margin-bottom:12px">⭐</div>
      <h2 style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800;color:#1a2035;margin-bottom:8px">Cap equip afegit</h2>
      <p style="color:#6b7a99;font-size:14px;line-height:1.6;margin-bottom:24px">Afegeix els equips que vols seguir.</p>
      <button onclick="openPicker()" style="background:#e5001c;border:none;color:#fff;font-weight:700;font-size:15px;padding:13px 28px;border-radius:12px;cursor:pointer">+ Afegir el meu equip</button>
    </div>`;
    return;
  }
  const updAt=DB?.updatedAt?new Date(DB.updatedAt).toLocaleDateString("ca-ES"):"?";
  body.innerHTML=favs.map(buildFavCard).join("")+
    `<p style="text-align:center;font-size:11px;color:#cbd5e1;margin-top:4px;padding-bottom:16px">Actualitzat: ${updAt}</p>`;
}

function buildFavCard(fav) {
  const comp=findComp(fav.compId); if (!comp) return "";
  const cl=comp.classification||[], cal=comp.calendar||[];
  const myRow=cl.find(r=>teamIn(r.team,fav.teamName));
  const myCal=cal.filter(m=>teamIn(m.home,fav.teamName)||teamIn(m.away,fav.teamName));
  const {last, next} = getLastAndNext(cal, fav.teamName);
  const cid=myRow?rowClubId(myRow):getClubId(fav.teamName);
  const catColor=CAT_COLOR[fav.category]||"#e5001c";

  let classifHtml="";
  if (cl.length&&myRow) {
    const myIdx=cl.findIndex(r=>teamIn(r.team,fav.teamName));
    const slice=cl.slice(Math.max(0,myIdx-2),Math.min(cl.length,myIdx+3));
    classifHtml=`
      <div style="border-top:1px solid #f0f2f8;border-bottom:1px solid #f0f2f8">
        <div style="display:flex;background:#f8fafc;padding:3px 12px">
          ${["#","Equip","PJ","G","E","Pe","Pts"].map((h,i)=>`<div style="width:${i===0?26:i===1?'auto':i===6?32:22}px;${i===1?"flex:1;":""}font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:${i===3?"#16a34a":i===4?"#d97706":i===5?"#dc2626":i===6?"#e5001c":"#94a3b8"};${i>1?"text-align:center":""}">${h}</div>`).join("")}
        </div>
        ${slice.map(r=>{
          const mine=teamIn(r.team,fav.teamName), rcid=rowClubId(r);
          return `<div style="display:flex;align-items:center;background:${mine?"#eff6ff":"#fff"};border-top:1px solid #f0f2f8;padding:5px 12px">
            <div style="width:26px;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:${posColor(r.pos)}">${r.pos}</div>
            <div style="flex:1;display:flex;align-items:center;gap:5px;min-width:0">${shieldImg(rcid,18)}<span style="font-size:12px;font-weight:${mine?800:500};color:${mine?"#003da5":"#334155"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.team)}</span></div>
            <div style="width:22px;text-align:center;font-size:12px;color:#94a3b8">${r.pj??"-"}</div>
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
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:clamp(16px,5vw,20px);font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fav.teamName)}</div>
          <div style="font-size:11px;color:#6b7a99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(stripSeasonSuffix(comp.name||""))}</div>
        </div>
        ${myRow?`<div style="background:${posColor(myRow.pos)}18;color:${posColor(myRow.pos)};border:1.5px solid ${posColor(myRow.pos)}44;border-radius:10px;padding:5px 9px;text-align:center;flex-shrink:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900;line-height:1">${myRow.pos}è</div>
          <div style="font-size:9px;margin-top:1px">${myRow.pts} pts</div>
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

window.removeFav = (compId,teamName) => { favs=favs.filter(f=>!(f.compId===compId&&f.teamName===teamName)); saveFavs(); renderHome(); };

// ── CLUB TAB ──────────────────────────────────────────────────
function renderClubTab() {
  // Build club list from all competitions
  const clubMap = new Map(); // clubName (normalized) → { displayName, clubId, teams:[] }

const data = getActiveData();
for (const comps of Object.values(data?.categories || {})) {
    for (const comp of comps) {
      if (allOnlyActive && !isActive(comp)) continue;
      for (const row of (comp.classification||[])) {
        if (!row.team) continue;
        // Normalize club name: remove trailing A/B/C/D/E
        const clubName = row.team.toLowerCase().replace(/\s+[a-e]$/,"").trim();
        if (!clubMap.has(clubName)) {
          const cid = rowClubId(row);
          clubMap.set(clubName, { displayName: row.team.replace(/\s+[A-E]$/,"").trim(), clubId: cid, teams:[] });
        }
        const club = clubMap.get(clubName);
        // Update clubId if we now have one
        if (!club.clubId) club.clubId = rowClubId(row);
        // Add team if not already there
        if (!club.teams.some(t=>t.compId===comp.id&&t.teamName===row.team)) {
          club.teams.push({ compId:comp.id, teamName:row.team, teamId:row.teamId, compName:comp.name, category:getCatForComp(comp) });
        }
      }
    }
  }

  // Sort clubs alphabetically
  const clubs = [...clubMap.entries()].sort((a,b)=>a[0].localeCompare(b[0]));

  const q = clubSearch.toLowerCase();
  const filtered = q ? clubs.filter(([k,v]) => k.includes(q) || v.displayName.toLowerCase().includes(q)) : clubs;

  if (selectedClub) {
    renderClubDashboard();
    return;
  }

  $("home-body").innerHTML = `
    <div style="padding:0 0 8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <input id="club-search" placeholder="🔍 Cerca club..." value="${esc(clubSearch)}"
          style="flex:1;min-width:180px;background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:9px 13px;font-size:14px;color:#1a2035;outline:none"
          oninput="clubSearch=this.value;renderClubTab()"/>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#6b7a99;cursor:pointer;white-space:nowrap">
          <input type="checkbox" ${allOnlyActive?"checked":""} onchange="allOnlyActive=this.checked;renderClubTab()" style="width:16px;height:16px;accent-color:#003da5"/>
          Només en curs
        </label>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">
        ${filtered.map(([key,club])=>`
          <button onclick="selectClub('${esc(key)}')" style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:12px 8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;transition:all .15s;text-align:center" onmouseover="this.style.borderColor='#003da5';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#e2e6ef';this.style.transform='none'">
            ${shieldImg(club.clubId,36)}
            <div style="font-size:12px;font-weight:700;color:#1a2035;line-height:1.2">${esc(club.displayName)}</div>
            <div style="font-size:10px;color:#94a3b8">${club.teams.length} equip${club.teams.length!==1?"s":""}</div>
          </button>`).join("")}
      </div>
      ${!filtered.length?`<p style="text-align:center;padding:32px;color:#94a3b8">Cap club trobat per «${esc(clubSearch)}»</p>`:""}
    </div>`;
}

function getCatForComp(comp) {
  const data = getActiveData();
  for (const [cat, comps] of Object.entries(data?.categories || {})) {
    if ((comps || []).some(c => c.id === comp.id)) return cat;
  }
  return "Altres";
}

window.selectClub = function(key) {
  // Rebuild club data for selected key
  const clubMap = new Map();
  const data = getActiveData();
  for (const comps of Object.values(data?.categories || {})) {
    for (const comp of comps) {
      if (allOnlyActive && !isActive(comp)) continue;
      for (const row of (comp.classification||[])) {
        if (!row.team) continue;
        const k = row.team.toLowerCase().replace(/\s+[a-e]$/,"").trim();
        if (!clubMap.has(k)) clubMap.set(k,{displayName:row.team.replace(/\s+[A-E]$/,"").trim(),clubId:rowClubId(row),teams:[]});
        const club=clubMap.get(k);
        if (!club.clubId) club.clubId=rowClubId(row);
        if (!club.teams.some(t=>t.compId===comp.id&&t.teamName===row.team))
          club.teams.push({compId:comp.id,teamName:row.team,teamId:row.teamId,compName:comp.name,category:getCatForComp(comp)});
      }
    }
  }
  const entry=clubMap.get(key);
  if (entry) { selectedClub={key,...entry}; renderClubDashboard(); }
};

function renderClubDashboard() {
  const club = selectedClub;
  const catOrder = ["Prebenjamí","Benjamí","Aleví","Infantil","Juvenil","Júnior","1ª Catalana","2ª Catalana","3ª Catalana","Nacional Catalana","Fem","Veterans","Altres"];

  // Sort teams by category order
  const sorted = [...club.teams].sort((a,b)=>{
    const ai=catOrder.indexOf(a.category), bi=catOrder.indexOf(b.category);
    return (ai===-1?99:ai)-(bi===-1?99:bi);
  });

  const teamCards = sorted.map(t=>{
    const comp=findComp(t.compId); if (!comp) return "";
    const cl=comp.classification||[], cal=comp.calendar||[];
    const myRow=cl.find(r=>teamIn(r.team,t.teamName));
    const myCal=cal.filter(m=>teamIn(m.home,t.teamName)||teamIn(m.away,t.teamName));
    const {last, next} = getLastAndNext(cal, t.teamName);
    const catColor=CAT_COLOR[t.category]||"#6b7a99";
    const catEmoji=CAT_EMOJI[t.category]||"🏒";

    return `
      <div style="background:#fff;border:1.5px solid #e2e6ef;border-left:4px solid ${catColor};border-radius:12px;overflow:hidden;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #f0f2f8">
          <span style="font-size:14px">${catEmoji}</span>
          <div style="flex:1;min-width:0">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.teamName)}</div>
            <div style="font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(stripSeasonSuffix(comp.name))}</div>
          </div>
          ${myRow?`<span style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:900;color:${posColor(myRow.pos)};flex-shrink:0">${myRow.pos}è · ${myRow.pts}pts</span>`:""}
          <button onclick="openDetail('${esc(t.compId)}','${esc(t.teamName)}','classif')" style="background:#f0f4f8;border:1px solid #e2e6ef;color:#003da5;border-radius:7px;padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0">→</button>
        </div>
        <div style="padding:7px 10px">
          ${last?matchCard(last,t.teamName):""}
          ${next?matchCard(next,t.teamName):`${!last?`<p style="font-size:11px;color:#94a3b8;padding:2px">Sense partits</p>`:""}`}
        </div>
      </div>`;
  }).join("");

  $("home-body").innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <button onclick="selectedClub=null;renderClubTab()" style="background:#f0f4f8;border:1px solid #e2e6ef;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:600;color:#334155;cursor:pointer">← Clubs</button>
      ${shieldImg(club.clubId,36)}
      <div style="flex:1;min-width:0">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900">${esc(club.displayName)}</div>
        <div style="font-size:11px;color:#94a3b8">${sorted.length} equip${sorted.length!==1?"s":""} · ${allOnlyActive?"en curs":"tots"}</div>
      </div>
      <label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#6b7a99;cursor:pointer;flex-shrink:0">
        <input type="checkbox" ${allOnlyActive?"checked":""} onchange="allOnlyActive=this.checked;selectedClub=null;selectClub('${esc(club.key)}')" style="accent-color:#003da5"/>
        En curs
      </label>
    </div>
    ${teamCards||`<p style="text-align:center;padding:32px;color:#94a3b8">Cap equip actiu</p>`}`;
}

// ── ALL COMPS ─────────────────────────────────────────────────
function renderAllComps() {
  const data = getActiveData();
  const categories = data?.categories || {};

  const catNames = Object.keys(categories).filter(k => (categories[k] || []).length > 0);
  const allCats = ["ALL", ...catNames];

  const filterBar = `
    <div style="background:#fff;border-bottom:1px solid #e2e6ef;overflow-x:auto;white-space:nowrap">
      <div style="display:inline-flex;padding:0 12px">
        ${allCats.map(cat => {
          const active = allFilterCat === cat;
          const label = cat === "ALL" ? "Totes" : cat;
          const emoji = cat === "ALL" ? "🏒" : (CAT_EMOJI[cat] || "📋");
          const comps = cat === "ALL" ? Object.values(categories).flat() : (categories[cat] || []);
          const count = allOnlyActive ? comps.filter(isActive).length : comps.length;
          return `<button onclick="allFilterCat='${esc(cat)}';renderAllComps()" style="background:none;border:none;border-bottom:3px solid ${active?"#e5001c":"transparent"};font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:${active?"#1a2035":"#6b7a99"};padding:11px 10px 8px;cursor:pointer">${emoji} ${esc(label)} <span style="opacity:.7">${count}</span></button>`;
        }).join("")}
      </div>
    </div>
    <div style="padding:8px 14px 4px;max-width:720px;margin:0 auto;display:flex;gap:8px;align-items:center">
      <input id="all-search" placeholder="🔍 Cerca equip o competició..." value="${esc(allSearch)}"
        style="flex:1;background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:9px 13px;font-size:14px;color:#1a2035;outline:none"
        oninput="allSearch=this.value;renderAllComps()"/>
      <label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#6b7a99;cursor:pointer;white-space:nowrap">
        <input type="checkbox" ${allOnlyActive?"checked":""} onchange="allOnlyActive=this.checked;renderAllComps()" style="accent-color:#003da5"/>
        En curs
      </label>
    </div>`;

  let cats = allFilterCat === "ALL"
    ? Object.entries(categories)
    : [[allFilterCat, categories[allFilterCat] || []]];

  cats = cats.map(([cat, comps]) => [cat, comps.filter(c => {
    if (allOnlyActive && !isActive(c)) return false;
    if (!allSearch) return true;
    const q = allSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.classification || []).some(r => r.team && r.team.toLowerCase().includes(q));
  })]).filter(([,c]) => c.length > 0);

  const compsHtml = cats.map(([cat, comps]) => {
    if (!comps.length) return "";
    const color = CAT_COLOR[cat] || "#666";
    const emoji = CAT_EMOJI[cat] || "📋";
    return `
      <div style="margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;padding:0 14px">
          <span style="font-size:15px">${emoji}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:800;text-transform:uppercase;color:${color}">${cat}</span>
          <span style="font-size:11px;font-weight:700;color:#94a3b8;background:#e8ecf4;border-radius:10px;padding:1px 7px">${comps.length}</span>
        </div>
        <div style="padding:0 14px">
          ${comps.map(comp => `
            <div onclick="openDetail('${comp.id}')" style="background:#fff;border:1.5px solid #e2e6ef;border-radius:11px;margin-bottom:6px;overflow:hidden;cursor:pointer;box-shadow:0 1px 3px rgba(0,30,80,.04)">
              <div style="display:flex;align-items:center;gap:9px;padding:10px 13px">
                <div style="width:36px;height:36px;border-radius:8px;background:${color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;color:${color}">${comp.pctPlayed != null ? comp.pctPlayed + "%" : "?"}</span>
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(stripSeasonSuffix(comp.name))}</div>
                  <div style="font-size:11px;color:#94a3b8;margin-top:1px">${(comp.classification || []).length || "?"} equips</div>
                </div>
                <span style="color:#cbd5e1;font-size:18px">›</span>
              </div>
              <div style="height:3px;background:#f0f4f8"><div style="height:100%;background:linear-gradient(90deg,${color},${color}88);width:${comp.pctPlayed || 0}%"></div></div>
            </div>`).join("")}
        </div>
      </div>`;
  }).join("");

  $("home-body").innerHTML = filterBar + `<div style="max-width:720px;margin:0 auto;padding-bottom:24px">${
    cats.some(([,c]) => c.length) ? compsHtml : `<div style="text-align:center;padding:40px;color:#94a3b8">Cap competició${allOnlyActive?" en curs":""} trobada</div>`
  }</div>`;
}// ── PICKER ────────────────────────────────────────────────────
function openPicker() {
  $("screen-home").style.display="none"; $("screen-detail").style.display="none";
  $("screen-picker").style.display="flex"; renderPicker();
}
window.openPicker=openPicker;

function renderPicker() {
  const data = getActiveData();
  const catNames = Object.entries(data?.categories || {})
    .filter(([, v]) => v.length > 0)
    .map(([k]) => k);
  $("picker-content").innerHTML=`
    <div style="padding:20px 16px 32px">
      <h2 style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;color:#1a2035;margin-bottom:4px">Afegir equip favorit</h2>
      <p style="font-size:13px;color:#6b7a99;margin-bottom:16px">Selecciona categoria, competició i equip</p>
      <label style="display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:#6b7a99;cursor:pointer;margin-bottom:16px">
        <input type="checkbox" id="picker-active" ${allOnlyActive?"checked":""} onchange="allOnlyActive=this.checked;renderPicker()" style="width:16px;height:16px;accent-color:#003da5"/>
        Mostrar només competicions en curs
      </label>
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

window.onPickCat = function () {
  const cat = $("pick-cat").value;
  $("pick-comp-wrap").style.display = cat ? "block" : "none";
  $("pick-team-wrap").style.display = "none";
  $("pick-add-wrap").style.display = "none";
  if (!cat) return;

  const comps = ((getActiveData()?.categories || {})[cat] || [])
    .filter(c => !allOnlyActive || isActive(c));

  $("pick-comp").innerHTML =
    `<option value="">— Selecciona la competició —</option>` +
    comps.map(c => `<option value="${esc(c.id)}">${esc(stripSeasonSuffix(c.name))}</option>`).join("");
};

window.onPickComp=function(){
  const compId=$("pick-comp").value;
  $("pick-team-wrap").style.display=compId?"block":"none"; $("pick-add-wrap").style.display="none";
  if (!compId) return;
  const comp=findComp(compId); if (!comp) return;
  const cl=comp.classification||[], cal=comp.calendar||[];
  const names=cl.length?cl.map(r=>r.team).filter(Boolean):[...new Set([...cal.map(m=>m.home),...cal.map(m=>m.away)].filter(Boolean))].sort();
  $("pick-team").innerHTML=`<option value="">— Selecciona l'equip —</option>`+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
  $("pick-team").onchange=()=>{ $("pick-add-wrap").style.display=$("pick-team").value?"block":"none"; };
};

window.addFavFromPicker=function(){
  const cat=$("pick-cat").value, compId=$("pick-comp").value, team=$("pick-team").value;
  const comp=findComp(compId);
  if (!cat||!compId||!team||!comp) return;
  if (!isFav(compId,team)) { favs.push({compId,teamName:team,category:cat,compName:comp.name}); saveFavs(); }
  $("screen-picker").style.display="none"; homeTab="favs"; renderHome();
};

// ── DETAIL ────────────────────────────────────────────────────
let detailComp=null, detailTeam=null, detailTab="classif";

function openDetail(compId,teamName,tab){
  detailComp=findComp(compId); detailTeam=teamName||null; detailTab=tab||"classif";
  if (!detailComp) return;
  $("screen-home").style.display="none"; $("screen-picker").style.display="none"; $("screen-detail").style.display="flex";
  $("detail-comp-name").textContent = stripSeasonSuffix(detailComp.name);
  $("detail-meta").textContent=`${(detailComp.classification||[]).length} equips · ${detailComp.pctPlayed??"?"}% jugat`;
  document.querySelectorAll(".detail-tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===detailTab));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===`panel-${detailTab}`));
  renderDetailClassif();
  renderDetailCalendar();
  renderDetailJugadors();
  renderDetailEntrenador();
  window.scrollTo(0,0);
}
window.openDetail=openDetail;

function setupListeners(){
  const bb=$("back-btn");
  if(bb) bb.addEventListener("click",()=>{ $("screen-detail").style.display="none"; renderHome(); });
  document.querySelectorAll(".detail-tab").forEach(tab=>{
    tab.addEventListener("click",()=>{
      detailTab=tab.dataset.tab;
      document.querySelectorAll(".detail-tab").forEach(t=>t.classList.toggle("active",t===tab));
      document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===`panel-${detailTab}`));
    });
  });
}

function renderDetailClassif(){
  const cl=detailComp.classification||[];
  if (!cl.length){ $("panel-classif").innerHTML=`<div style="text-align:center;padding:32px;color:#94a3b8">Classificació no disponible.<br/><a href="https://jok.cat/competicio/${detailComp.id}" target="_blank">jok.cat →</a></div>`; return; }
  $("panel-classif").innerHTML=`
    <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f8fafc">
          ${["#","Equip","PJ","G","E","Pe","GF","GC","Pts"].map((h,i)=>`<th style="padding:8px ${i<2?6:4}px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:${i===3?"#16a34a":i===4?"#d97706":i===5?"#dc2626":i===8?"#e5001c":"#94a3b8"};text-transform:uppercase;text-align:${i===1?"left":"center"};border-bottom:1px solid #e2e6ef">${h}</th>`).join("")}
        </tr></thead>
        <tbody>${cl.map(r=>{
          const mine=teamIn(r.team,detailTeam), cid=rowClubId(r), pc=posColor(r.pos);
          const pos=r.pos<=3?["🥇","🥈","🥉"][r.pos-1]:`<span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:${pc}">${r.pos}</span>`;
          return `<tr style="background:${mine?"#eff6ff":"transparent"};border-bottom:1px solid #f0f2f8">
            <td style="padding:9px 6px;text-align:center">${pos}</td>
            <td style="padding:9px 6px"><div style="display:flex;align-items:center;gap:6px">${shieldImg(cid,22)}<span style="font-size:13px;font-weight:${mine?800:500};color:${mine?"#003da5":"#334155"}">${esc(r.team)}</span>${mine?`<span style="color:#e5001c;font-size:10px">◀</span>`:""}</div></td>
            <td style="padding:9px 4px;text-align:center;color:#94a3b8">${r.pj??"-"}</td>
            <td style="padding:9px 4px;text-align:center;color:#16a34a;font-weight:600">${r.pg??"-"}</td>
            <td style="padding:9px 4px;text-align:center;color:#d97706">${r.pe??"-"}</td>
            <td style="padding:9px 4px;text-align:center;color:#dc2626">${r.pp??"-"}</td>
            <td style="padding:9px 4px;text-align:center;color:#94a3b8">${r.gf??"-"}</td>
            <td style="padding:9px 4px;text-align:center;color:#94a3b8">${r.gc??"-"}</td>
            <td style="padding:9px 4px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;color:${mine?"#e5001c":"#1a2035"}">${r.pts??"-"}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>`;
}

function renderDetailCalendar(){
  const all=detailComp.calendar||[];
  if (!all.length){ $("panel-calendar").innerHTML=`<div style="text-align:center;padding:32px;color:#94a3b8">Calendari no disponible.<br/><a href="https://jok.cat/competicio/${detailComp.id}" target="_blank">jok.cat →</a></div>`; return; }
  const names=[...new Set([...all.map(m=>m.home),...all.map(m=>m.away)].filter(Boolean))].sort();
  const chips=`<div style="margin-bottom:10px">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Filtrar per equip</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      <button onclick="setCalTeam(null)" style="background:${!detailTeam?"#1a2035":"#f0f4f8"};border:1.5px solid ${!detailTeam?"#1a2035":"#e2e6ef"};border-radius:16px;padding:4px 11px;font-size:12px;font-weight:600;color:${!detailTeam?"#fff":"#334155"};cursor:pointer">Tots</button>
      ${names.map(t=>{const act=teamIn(t,detailTeam),cid=getClubId(t);return`<button onclick="setCalTeam('${esc(t)}')" style="display:inline-flex;align-items:center;gap:4px;background:${act?"#1a2035":"#f0f4f8"};border:1.5px solid ${act?"#1a2035":"#e2e6ef"};border-radius:16px;padding:4px 10px 4px 5px;font-size:12px;font-weight:600;color:${act?"#fff":"#334155"};cursor:pointer">${shieldImg(cid,16)} ${esc(t.replace(/Club Hoquei |CH |Cp |Club Patí /gi,"").trim())}</button>`;}).join("")}
    </div>
  </div>`;
  const matches=detailTeam?all.filter(m=>teamIn(m.home,detailTeam)||teamIn(m.away,detailTeam)):all;
  const byJ={};
  matches.forEach(m=>{const k=m.jornada?`Jornada ${m.jornada}`:(m.date||"?");(byJ[k]||(byJ[k]=[])).push(m);});
  $("panel-calendar").innerHTML=chips+Object.entries(byJ).map(([j,ms])=>`
    <div style="margin-bottom:10px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">${esc(j)}</div>
      ${ms.map(m=>matchCard(m,detailTeam)).join("")}
    </div>`).join("");
}
window.setCalTeam=t=>{ detailTeam=t; renderDetailClassif(); renderDetailCalendar(); };

function getTeamDataMap() {
  return detailComp?.teamScorers || {};
}

function getPlayerStatsMap() {
  return detailComp?.playerStats || {};
}

function getTeamStatsMap() {
  return detailComp?.teamStats || {};
}

function buildPlayersByTeam(detailComp) {
  const teamScorers = detailComp?.teamScorers || {};
  const playerStats = detailComp?.playerStats || {};
  const result = {};

  for (const [teamId, data] of Object.entries(teamScorers)) {
    const players = data?.players || [];
    const scorers = data?.scorers || [];
    const cards   = data?.cards || [];

    const byId = new Map();

    for (const p of players) {
      byId.set(p.id, {
        id: p.id,
        name: p.name,
        goals: 0,
        cards: 0,
        detectedInRoster: true,
      });
    }

    for (const s of scorers) {
      const prev = byId.get(s.id) || {
        id: s.id,
        name: s.name,
        goals: 0,
        cards: 0,
        detectedInRoster: false,
      };
      prev.goals = Math.max(prev.goals || 0, s.goals || 0);
      if (!prev.name) prev.name = s.name;
      byId.set(s.id, prev);
    }

    for (const c of cards) {
      const prev = byId.get(c.id) || {
        id: c.id,
        name: c.name,
        goals: 0,
        cards: 0,
        detectedInRoster: false,
      };
      prev.cards = Math.max(prev.cards || 0, c.cards || 0);
      if (!prev.name) prev.name = c.name;
      byId.set(c.id, prev);
    }

    for (const [playerId, stat] of Object.entries(playerStats)) {
      if (stat.teamId !== teamId) continue;
      const prev = byId.get(playerId) || {
        id: playerId,
        name: stat.name,
        goals: 0,
        cards: 0,
        detectedInRoster: !!stat.detectedInRoster,
      };

      prev.name = prev.name || stat.name || "";
      prev.goals = Math.max(prev.goals || 0, stat.goals || 0);
      prev.cards = Math.max(prev.cards || 0, stat.cards || 0);
      prev.detectedInRoster = prev.detectedInRoster || !!stat.detectedInRoster;

      byId.set(playerId, prev);
    }

    result[teamId] = [...byId.values()].sort((a, b) => {
      if ((b.goals || 0) !== (a.goals || 0)) return (b.goals || 0) - (a.goals || 0);
      return (a.name || "").localeCompare(b.name || "");
    });
  }

  return result;
}

function renderDetailJugadors() {
  const panel = $("panel-jugadors");
  if (!panel) return;

  const teamScorers = getTeamDataMap();
  const playerStats = getPlayerStatsMap();
  const teamStats   = getTeamStatsMap();

  const hasTeamScorers = Object.keys(teamScorers).length > 0;
  const hasPlayerStats = Object.keys(playerStats).length > 0;

  if (!hasTeamScorers && !hasPlayerStats) {
    panel.innerHTML = `
      <div style="text-align:center;padding:32px;color:#94a3b8">
        <div style="font-size:36px;margin-bottom:10px">📊</div>
        <p>Estadístiques de jugadors no disponibles.<br/>Torna a executar el scraper amb suport de pàgines d'equip.</p>
      </div>`;
    return;
  }

  const playersByTeam = buildPlayersByTeam(detailComp);

  const teamEntries = Object.entries(playersByTeam)
    .map(([teamId, players]) => {
      const row = (detailComp.classification || []).find(r => r.teamId === teamId);
      const fallback = (detailComp.teams || []).find(t => t.id === teamId);
      const teamName = row?.team || fallback?.name || `Equip ${teamId}`;
      const cid = row ? rowClubId(row) : getClubIdByTeamId(teamId);
      const stat = teamStats[teamId] || {};

      const header = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          ${shieldImg(cid, 24)}
          <div style="flex:1;min-width:0">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;color:#1a2035;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${esc(teamName)}
            </div>
            <div style="font-size:11px;color:#94a3b8">
              ${players.length} jugadors detectats
              ${stat.totalGoalsFromTopList != null ? ` · ${stat.totalGoalsFromTopList} gols top` : ""}
              ${stat.totalCardsFromTopList != null ? ` · ${stat.totalCardsFromTopList} targetes top` : ""}
            </div>
          </div>
        </div>`;

      const table = players.length ? `
        <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,30,80,.07)">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:8px 6px;text-align:left;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:1px solid #e2e6ef">Jugador</th>
                <th style="padding:8px 6px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#e5001c;text-transform:uppercase;border-bottom:1px solid #e2e6ef">Gols</th>
                <th style="padding:8px 6px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#d97706;text-transform:uppercase;border-bottom:1px solid #e2e6ef">Targetes</th>
                <th style="padding:8px 6px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e6ef">Detectat</th>
              </tr>
            </thead>
            <tbody>
              ${players.map(p => `
                <tr style="border-bottom:1px solid #f0f2f8">
                  <td style="padding:9px 6px">
                    <div style="font-size:13px;font-weight:600;color:#1a2035;text-transform:capitalize">
                      ${esc(p.name || "Jugador sense nom")}
                    </div>
                    <div style="font-size:10px;color:#94a3b8">ID ${esc(p.id)}</div>
                  </td>
                  <td style="padding:9px 6px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:#e5001c">
                    ${p.goals || 0}
                  </td>
                  <td style="padding:9px 6px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:#d97706">
                    ${p.cards || 0}
                  </td>
                  <td style="padding:9px 6px;text-align:center">
                    <span style="display:inline-block;background:${p.detectedInRoster ? "#dcfce7" : "#f1f5f9"};color:${p.detectedInRoster ? "#16a34a" : "#64748b"};border-radius:999px;padding:3px 8px;font-size:10px;font-weight:700">
                      ${p.detectedInRoster ? "Plantilla" : "Stats"}
                    </span>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>` : `
        <p style="color:#94a3b8;font-size:13px">Sense jugadors detectats per aquest equip.</p>`;

      return `
        <div style="margin-bottom:16px">
          ${header}
          ${table}
        </div>`;
    });

  panel.innerHTML = `
    <div style="margin-bottom:12px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:#1a2035;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">
        👥 Jugadors per equip
      </div>
      ${teamEntries.join("") || `<p style="color:#94a3b8;font-size:13px">Sense dades d'equip.</p>`}
    </div>`;
}
// -- Pantalla Entrenador
function renderDetailEntrenador() {
  const panel = $("panel-entrenador");
  if (!panel) return;

  const teamStats = getTeamStatsMap();
  const entries = Object.entries(teamStats);

  if (!entries.length) {
    panel.innerHTML = `
      <div style="text-align:center;padding:32px;color:#94a3b8">
        <div style="font-size:36px;margin-bottom:10px">🧠</div>
        <p>Estadístiques d'entrenador no disponibles encara.</p>
      </div>`;
    return;
  }

  const cards = entries.map(([teamId, stat]) => {
    const row = (detailComp.classification || []).find(r => r.teamId === teamId);
    const cid = row ? rowClubId(row) : getClubIdByTeamId(teamId);

    const avgAge = stat.avgAge != null ? stat.avgAge : "-";
    const avgMatchesPlayed = stat.avgMatchesPlayed != null ? stat.avgMatchesPlayed : "-";
    const playersWithKnownAge = stat.playersWithKnownAge || 0;
    const playersWithKnownMatchesPlayed = stat.playersWithKnownMatchesPlayed || 0;
    const totalPlayersDetected = stat.totalPlayersDetected || 0;
    const multiCategoryPlayers = stat.multiCategoryPlayers || 0;

    return `
      <div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:14px;padding:12px;margin-bottom:10px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          ${shieldImg(cid, 24)}
          <div style="flex:1;min-width:0">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;color:#1a2035;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${esc(stat.teamName || `Equip ${teamId}`)}
            </div>
            <div style="font-size:11px;color:#94a3b8">
              ${esc(stat.competitionCategory || "")}
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:8px">
          <div style="background:#f8fafc;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700">Jugadors</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#003da5">
              ${totalPlayersDetected}
            </div>
          </div>

          <div style="background:#f8fafc;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700">Golejadors</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#e5001c">
              ${stat.totalScorersDetected || 0}
            </div>
          </div>

          <div style="background:#f8fafc;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700">Gols top</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#16a34a">
              ${stat.totalGoalsFromTopList || 0}
            </div>
          </div>

          <div style="background:#f8fafc;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700">Targetes top</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#d97706">
              ${stat.totalCardsFromTopList || 0}
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:8px">
          <div style="background:#faf5ff;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700">Edat mitjana</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#7c3aed">
              ${avgAge}
            </div>
          </div>

          <div style="background:#eff6ff;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700">Mitjana PJ</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#2563eb">
              ${avgMatchesPlayed}
            </div>
          </div>

          <div style="background:#ecfeff;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700">Multicategoria</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#0891b2">
              ${multiCategoryPlayers}
            </div>
          </div>

          <div style="background:#fefce8;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700">Cobertura edat</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#ca8a04">
              ${playersWithKnownAge}/${totalPlayersDetected}
            </div>
          </div>
        </div>

        <div style="background:#f8fafc;border-radius:10px;padding:10px">
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#475569">
            <span><strong>PJ coneguts:</strong> ${playersWithKnownMatchesPlayed}/${totalPlayersDetected}</span>
            <span><strong>Targetats:</strong> ${stat.totalCardedPlayersDetected || 0}</span>
          </div>
        </div>
      </div>`;
  }).join("");

  panel.innerHTML = `
    <div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:#1a2035;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">
        🧠 Resum entrenador
      </div>
      ${cards}
    </div>`;
}
// ── Init ──────────────────────────────────────────────────────
async function init(){
  try {
    $("loading-note").textContent="Carregant dades...";
    const res=await fetch(DATA_URL+"?t="+Date.now());
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
    DB = JSON.parse(await res.text());
    if (!DB.categories && !DB.snapshots) throw new Error("data.json incomplet");
    selectedSeason = DB?.season || getSeasonOptions()[0] || null;
    setupListeners();
    $("screen-loading").style.display = "none";
    $("screen-home").style.display = "flex";
    renderHome();
  } catch(e) {
    $("loading-note").innerHTML=`<span style="color:#e5001c;font-weight:700">⚠️ Error</span><br/><span style="font-size:12px;color:#6b7a99">${esc(e.message)}</span>`;
  }
}
init();
