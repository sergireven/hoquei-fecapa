// FECAPA app.js v6 — clean rewrite
const SHIELD   = "https://sidgad.cloud/fecapa/images/logos_clubes/";
const DATA_URL = "./data.json";
const FAV_KEY  = "hoquei_favs_v6";

// ── State ─────────────────────────────────────────────────────
let DB = null; // full data.json

// Favourites: [{compId, teamName, category}]
let favs = [];
try { favs = JSON.parse(localStorage.getItem(FAV_KEY)||"[]"); } catch {}
const saveFavs = () => localStorage.setItem(FAV_KEY, JSON.stringify(favs));
const isFav    = (cid,tn) => favs.some(f=>f.compId===cid&&f.teamName===tn);

// ── Utils ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/'/g,"&#39;");

function getClubId(name) {
  if (!DB||!name) return null;
  const n = name.toLowerCase();
  // exact match
  for (const v of Object.values(DB.clubIndex||{})) {
    if (v.clubId && (v.name||"").toLowerCase()===n) return v.clubId;
  }
  // fuzzy: strip trailing letter
  const base = n.replace(/\s+[a-d]$/,"").trim();
  for (const v of Object.values(DB.clubIndex||{})) {
    if (!v.clubId) continue;
    const vb = (v.name||"").toLowerCase().replace(/\s+[a-d]$/,"").trim();
    if (vb===base||vb.includes(base)||base.includes(vb)) return v.clubId;
  }
  return null;
}

function shieldImg(clubId, size) {
  size = size||24;
  if (!clubId) return `<span style="width:${size}px;height:${size}px;background:#e8ecf4;border-radius:6px;display:inline-block;flex-shrink:0"></span>`;
  return `<img src="${SHIELD}${clubId}.gif" width="${size}" height="${size}" style="object-fit:contain;background:#f5f7fc;border-radius:6px;padding:2px;flex-shrink:0;vertical-align:middle" onerror="this.style.visibility='hidden'" alt=""/>`;
}

function findComp(compId) {
  if (!DB) return null;
  for (const comps of Object.values(DB.categories)) {
    const c = comps.find(c=>c.id===compId);
    if (c) return c;
  }
  return null;
}

function teamIn(name, filter) {
  if (!filter||!name) return false;
  return name.toLowerCase().includes(filter.toLowerCase());
}

const posColor = p => p===1?"#d97706":p===2?"#64748b":p===3?"#b45309":"#6b7a99";

// ── Match card ────────────────────────────────────────────────
function matchCard(m, myTeam, compact) {
  const riH    = teamIn(m.home, myTeam);
  const riA    = teamIn(m.away, myTeam);
  const played = m.played!==false && m.homeScore!=null;
  const cidH   = getClubId(m.home);
  const cidA   = getClubId(m.away);
  let   border = "#e2e6ef";
  let   badge  = "";

  if (played && myTeam) {
    const draw = m.homeScore===m.awayScore;
    const win  = riH ? m.homeScore>m.awayScore : m.awayScore>m.homeScore;
    border = draw?"#d97706":win?"#16a34a":"#dc2626";
    if (!compact) {
      const [bg,tc,lb] = draw?["#fef3c7","#b45309","Empat"]:win?["#dcfce7","#16a34a","Victòria"]:["#fee2e2","#dc2626","Derrota"];
      badge = `<div style="text-align:center;margin-top:5px"><span style="background:${bg};color:${tc};font-size:11px;font-weight:700;padding:2px 10px;border-radius:6px">${lb}</span></div>`;
    }
  }

  const scoreBlock = played
    ? `<div style="background:#e5001c;color:#fff;border-radius:8px;padding:4px 12px;font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;line-height:1.1;white-space:nowrap;min-width:64px;text-align:center">${m.homeScore} – ${m.awayScore}</div>`
    : `<div style="background:#1a5dc7;color:#fff;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;white-space:nowrap;min-width:48px;text-align:center">VS</div>`;

  return `
    <div style="background:#fff;border:1.5px solid ${border};border-left:4px solid ${border};border-radius:10px;padding:9px 11px;margin-bottom:5px">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="flex:1;display:flex;align-items:center;justify-content:flex-end;gap:5px;min-width:0">
          <span style="font-size:12px;font-weight:${riH?800:500};color:${riH?"#003da5":"#334155"};text-align:right;line-height:1.3;overflow-wrap:anywhere">${esc(m.home)}</span>
          ${shieldImg(cidH,22)}
        </div>
        <div style="flex-shrink:0;text-align:center">
          ${scoreBlock}
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

// ── SCREEN: Home ──────────────────────────────────────────────
function renderHome() {
  $("screen-detail").style.display  = "none";
  $("screen-picker").style.display  = "none";
  $("screen-home").style.display    = "flex";

  const body = $("home-body");
  if (!favs.length) {
    body.innerHTML = `
      <div style="text-align:center;padding:40px 20px 32px">
        <div style="font-size:48px;margin-bottom:12px">🏒</div>
        <h2 style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800;color:#1a2035;margin-bottom:8px">Cap equip afegit</h2>
        <p style="color:#6b7a99;font-size:14px;line-height:1.6;margin-bottom:24px">Afegeix els equips que vols seguir i veuràs aquí la seva posició, últim resultat i proper partit.</p>
        <button onclick="openPicker()" style="background:#e5001c;border:none;color:#fff;font-weight:700;font-size:15px;padding:13px 28px;border-radius:12px;cursor:pointer">+ Afegir el meu equip</button>
      </div>`;
    return;
  }

  body.innerHTML = favs.map(fav => {
    const comp  = findComp(fav.compId);
    if (!comp) return "";
    const cl    = comp.classification||[];
    const cal   = comp.calendar||[];
    const myRow = cl.find(r => teamIn(r.team, fav.teamName));
    const myCal = cal.filter(m => teamIn(m.home,fav.teamName)||teamIn(m.away,fav.teamName));
    const last  = [...myCal].reverse().find(m => m.played!==false&&m.homeScore!=null);
    const next  = myCal.find(m => m.played===false||m.homeScore==null);
    const cid   = myRow?(myRow.clubId||getClubId(myRow.team)):getClubId(fav.teamName);
    const cat   = DB.categories[fav.category]?"✓":"";

    return `
      <div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:14px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,30,80,.07)">

        <!-- Header -->
        <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #f0f2f8">
          ${shieldImg(cid, 40)}
          <div style="flex:1;min-width:0">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fav.teamName)}</div>
            <div style="font-size:11px;color:#6b7a99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((comp.name||"").replace(/\s*\(2025-26\)/,""))}</div>
          </div>
          <button onclick="removeFav('${esc(fav.compId)}','${esc(fav.teamName)}')" style="background:none;border:none;color:#cbd5e1;font-size:18px;cursor:pointer;padding:4px;line-height:1" title="Eliminar">✕</button>
        </div>

        <!-- Position strip -->
        ${myRow ? `
        <div style="display:grid;grid-template-columns:repeat(5,1fr);background:#fafbfd;border-bottom:1px solid #f0f2f8">
          ${[
            {v:myRow.pos+"è", l:"Posició", c:posColor(myRow.pos)},
            {v:myRow.pts,     l:"Punts",   c:"#e5001c"},
            {v:myRow.gf,      l:"GF",      c:"#16a34a"},
            {v:myRow.gc,      l:"GC",      c:"#dc2626"},
            {v:myRow.pj,      l:"Jugats",  c:"#334155"},
          ].map(s=>`<div style="text-align:center;padding:10px 4px;border-right:1px solid #f0f2f8">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;color:${s.c};line-height:1">${s.v}</div>
            <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;margin-top:2px;letter-spacing:.04em">${s.l}</div>
          </div>`).join("")}
        </div>` : ""}

        <!-- Last & next -->
        <div style="padding:10px 12px">
          ${last ? `<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">Últim resultat</div>${matchCard(last,fav.teamName,false)}` : ""}
          ${next ? `<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;${last?"margin-top:8px":""}">Proper partit</div>${matchCard(next,fav.teamName,false)}` : ""}
          ${!last&&!next?`<p style="text-align:center;color:#94a3b8;font-size:13px;padding:4px 0">Sense partits registrats</p>`:""}
        </div>

        <!-- Actions -->
        <div style="display:flex;gap:6px;padding:0 12px 12px">
          <button onclick="openDetail('${esc(fav.compId)}','${esc(fav.teamName)}','classif')" style="flex:1;background:#f5f7fc;border:1px solid #e2e6ef;border-radius:8px;padding:8px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">📊 Classificació</button>
          <button onclick="openDetail('${esc(fav.compId)}','${esc(fav.teamName)}','calendar')" style="flex:1;background:#f5f7fc;border:1px solid #e2e6ef;border-radius:8px;padding:8px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">📅 Calendari</button>
        </div>
      </div>`;
  }).join("") + `
    <button onclick="openPicker()" style="width:100%;background:#fff;border:2px dashed #e2e6ef;color:#94a3b8;font-size:14px;font-weight:600;padding:14px;border-radius:12px;cursor:pointer;margin-top:4px">+ Afegir equip</button>
    <p style="text-align:center;font-size:11px;color:#cbd5e1;margin-top:12px">Actualitzat: ${DB?.updatedAt?new Date(DB.updatedAt).toLocaleDateString("ca-ES"):"?"}</p>`;
}

window.removeFav = function(compId, teamName) {
  favs = favs.filter(f=>!(f.compId===compId&&f.teamName===teamName));
  saveFavs(); renderHome();
};

// ── SCREEN: Picker (add favourite) ───────────────────────────
function openPicker() {
  $("screen-home").style.display   = "none";
  $("screen-detail").style.display = "none";
  $("screen-picker").style.display = "flex";
  renderPicker();
}
window.openPicker = openPicker;

function renderPicker() {
  // Build category list (only cats with data)
  const catNames = Object.entries(DB.categories)
    .filter(([,v])=>v.length>0)
    .map(([k])=>k);

  const CAT_EMOJI = {
    "Nacional Catalana":"👑","1ª Catalana":"⭐","2ª Catalana":"🔵",
    "3ª Catalana":"🟣","Fem":"♀","Júnior":"🎯","Juvenil":"⚡",
    "Infantil":"🏆","Aleví":"💪","Benjamí":"🔥","Prebenjamí":"⭐",
    "Veterans":"🧓","Altres":"📋",
  };

  $("picker-content").innerHTML = `
    <div style="padding:20px 16px">
      <h2 style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;color:#1a2035;margin-bottom:4px">Afegir equip favorit</h2>
      <p style="font-size:13px;color:#6b7a99;margin-bottom:20px">Selecciona la categoria i l'equip</p>

      <!-- Step 1: Category -->
      <div style="margin-bottom:16px">
        <label style="display:block;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">1. Categoria</label>
        <select id="pick-cat" onchange="onPickCat()" style="width:100%;background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:11px 14px;font-size:14px;color:#1a2035;cursor:pointer;appearance:auto">
          <option value="">— Selecciona una categoria —</option>
          ${catNames.map(c=>`<option value="${esc(c)}">${CAT_EMOJI[c]||"🏒"} ${esc(c)}</option>`).join("")}
        </select>
      </div>

      <!-- Step 2: Competition (shown after cat) -->
      <div id="pick-comp-wrap" style="display:none;margin-bottom:16px">
        <label style="display:block;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">2. Competició</label>
        <select id="pick-comp" onchange="onPickComp()" style="width:100%;background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:11px 14px;font-size:14px;color:#1a2035;cursor:pointer;appearance:auto">
          <option value="">— Selecciona la competició —</option>
        </select>
      </div>

      <!-- Step 3: Team (shown after comp) -->
      <div id="pick-team-wrap" style="display:none;margin-bottom:20px">
        <label style="display:block;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">3. Equip</label>
        <select id="pick-team" style="width:100%;background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:11px 14px;font-size:14px;color:#1a2035;cursor:pointer;appearance:auto">
          <option value="">— Selecciona l'equip —</option>
        </select>
      </div>

      <!-- Add button -->
      <div id="pick-add-wrap" style="display:none">
        <button onclick="addFavFromPicker()" style="width:100%;background:#e5001c;border:none;color:#fff;font-weight:700;font-size:15px;padding:13px;border-radius:12px;cursor:pointer">⭐ Afegir als favorits</button>
      </div>
    </div>`;
}

window.onPickCat = function() {
  const cat = $("pick-cat").value;
  $("pick-comp-wrap").style.display = cat ? "block" : "none";
  $("pick-team-wrap").style.display = "none";
  $("pick-add-wrap").style.display  = "none";
  if (!cat) return;

  const comps = DB.categories[cat]||[];
  $("pick-comp").innerHTML = `<option value="">— Selecciona la competició —</option>` +
    comps.map(c=>`<option value="${esc(c.id)}">${esc(c.name.replace(/\s*\(2025-26\)/,""))}</option>`).join("");
};

window.onPickComp = function() {
  const compId = $("pick-comp").value;
  $("pick-team-wrap").style.display = compId ? "block" : "none";
  $("pick-add-wrap").style.display  = "none";
  if (!compId) return;

  const comp = findComp(compId);
  if (!comp) return;

  // Get all team names from classification or calendar
  const cl    = comp.classification||[];
  const cal   = comp.calendar||[];
  const names = cl.length
    ? cl.map(r=>r.team).filter(Boolean)
    : [...new Set([...cal.map(m=>m.home),...cal.map(m=>m.away)].filter(Boolean))].sort();

  $("pick-team").innerHTML = `<option value="">— Selecciona l'equip —</option>` +
    names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");

  $("pick-team").onchange = () => {
    $("pick-add-wrap").style.display = $("pick-team").value ? "block" : "none";
  };
};

window.addFavFromPicker = function() {
  const cat    = $("pick-cat").value;
  const compId = $("pick-comp").value;
  const team   = $("pick-team").value;
  const comp   = findComp(compId);
  if (!cat||!compId||!team||!comp) return;
  if (!isFav(compId, team)) {
    favs.push({ compId, teamName: team, category: cat, compName: comp.name });
    saveFavs();
  }
  $("screen-picker").style.display = "none";
  $("screen-home").style.display   = "flex";
  renderHome();
};

// ── SCREEN: Detail (classification + calendar) ────────────────
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

  document.querySelectorAll(".detail-tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab===detailTab));
  document.querySelectorAll(".panel").forEach(p =>
    p.classList.toggle("active", p.id===`panel-${detailTab}`));

  renderDetailClassif();
  renderDetailCalendar();
  window.scrollTo(0,0);
}
window.openDetail = openDetail;

document.getElementById("back-btn").addEventListener("click", () => {
  $("screen-detail").style.display = "none";
  $("screen-home").style.display   = "flex";
});

document.querySelectorAll(".detail-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    detailTab = tab.dataset.tab;
    document.querySelectorAll(".detail-tab").forEach(t => t.classList.toggle("active",t===tab));
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active",p.id===`panel-${detailTab}`));
  });
});

function renderDetailClassif() {
  const cl = detailComp.classification||[];
  if (!cl.length) {
    $("panel-classif").innerHTML = `<div style="text-align:center;padding:32px;color:#6b7a99">Classificació no disponible.<br/><a href="https://jok.cat/competicio/${detailComp.id}" target="_blank" style="color:#003da5">Veure a jok.cat →</a></div>`;
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
            const cid  = r.clubId||getClubId(r.team);
            const pc   = posColor(r.pos);
            const pos  = r.pos<=3?["🥇","🥈","🥉"][r.pos-1]:`<span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:${pc}">${r.pos}</span>`;
            return `<tr style="background:${mine?"#eff6ff":"transparent"};border-bottom:1px solid #f0f2f8">
              <td style="padding:9px 6px;text-align:center">${pos}</td>
              <td style="padding:9px 6px">
                <div style="display:flex;align-items:center;gap:6px">
                  ${shieldImg(cid,22)}
                  <span style="font-weight:${mine?800:500};color:${mine?"#003da5":"#334155"}">${esc(r.team)}</span>
                  ${mine?`<span style="color:#e5001c;font-size:10px">◀</span>`:""}
                </div>
              </td>
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
    $("panel-calendar").innerHTML = `<div style="text-align:center;padding:32px;color:#6b7a99">Calendari no disponible.<br/><a href="https://jok.cat/competicio/${detailComp.id}" target="_blank" style="color:#003da5">Veure a jok.cat →</a></div>`;
    return;
  }

  // Team chips
  const names = [...new Set([...all.map(m=>m.home),...all.map(m=>m.away)].filter(Boolean))].sort();
  const chips = `
    <div style="margin-bottom:12px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Filtrar per equip</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        <button onclick="setCalTeam(null)" style="background:${!detailTeam?"#003da5":"#f0f4f8"};border:1.5px solid ${!detailTeam?"#003da5":"#e2e6ef"};border-radius:18px;padding:5px 12px;font-size:12px;font-weight:600;color:${!detailTeam?"#fff":"#334155"};cursor:pointer">Tots</button>
        ${names.map(t=>{
          const act = teamIn(t, detailTeam);
          const cid = getClubId(t);
          return `<button onclick="setCalTeam('${esc(t)}')" style="display:inline-flex;align-items:center;gap:4px;background:${act?"#003da5":"#f0f4f8"};border:1.5px solid ${act?"#003da5":"#e2e6ef"};border-radius:18px;padding:5px 10px 5px 6px;font-size:12px;font-weight:600;color:${act?"#fff":"#334155"};cursor:pointer">
            ${shieldImg(cid,16)} ${esc(t.replace(/Club Hoquei |CH |Cp |Club Patí /gi,"").trim())}
          </button>`;
        }).join("")}
      </div>
    </div>`;

  const matches = detailTeam
    ? all.filter(m=>teamIn(m.home,detailTeam)||teamIn(m.away,detailTeam))
    : all;

  const byJ = {};
  matches.forEach(m=>{
    const k = m.jornada?`Jornada ${m.jornada}`:(m.date||"?");
    (byJ[k]||(byJ[k]=[])).push(m);
  });

  $("panel-calendar").innerHTML = chips + Object.entries(byJ).map(([j,ms])=>`
    <div style="margin-bottom:12px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">${esc(j)}</div>
      ${ms.map(m=>matchCard(m,detailTeam,false)).join("")}
    </div>`).join("");
}

window.setCalTeam = function(t) { detailTeam=t; renderDetailClassif(); renderDetailCalendar(); };

// ── Init ──────────────────────────────────────────────────────
async function init() {
  try {
    $("loading-note").textContent = "Carregant dades...";
    const res = await fetch(DATA_URL+"?t="+Date.now());
    if (!res.ok) throw new Error("No s'han pogut carregar les dades");
    DB = await res.json();
    $("hero-season").textContent = DB.season||"2025-26";
    $("hero-sub").textContent    = `${DB.totalComps||0} competicions · Act. ${DB.updatedAt?new Date(DB.updatedAt).toLocaleDateString("ca-ES"):"?"}`;
    $("screen-loading").style.display = "none";
    renderHome();
  } catch(e) {
    $("loading-note").innerHTML = `<span style="color:#e5001c">⚠️ ${e.message}</span>`;
  }
}
init();
