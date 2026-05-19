// FECAPA app.js v8
const SHIELD   = "https://sidgad.cloud/fecapa/images//logos_clubes/";
const DATA_URL = "./data.json";
const SIDGAD_COMP_URL = "./competicions-sidgad.json";
const FAV_KEY  = "hoquei_favs_v8";
const LEVEL_FAV_KEY = "hoquei_level_favs_v1";

// ── Supabase auth ─────────────────────────────────────────────
const SUPABASE_URL = "https://ggltghiojxllxajeblme.supabase.co";
const SUPABASE_KEY = "sb_publishable_SPmYJDTieqtV8EDT-DdHyA_nc_sK7RE";
const _sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
const SOFT_SESSION_KEY = "hoquei_user_v1";
let currentUser    = null;
let currentProfile = null;

function _saveSoftSession(profile) {
  localStorage.setItem(SOFT_SESSION_KEY, JSON.stringify(profile));
}
function _clearSoftSession() {
  localStorage.removeItem(SOFT_SESSION_KEY);
}
function _loadSoftSession() {
  try { return JSON.parse(localStorage.getItem(SOFT_SESSION_KEY)); } catch { return null; }
}

async function initAuth() {
  if (!_sb) return;
  const { data: { session } } = await _sb.auth.getSession();
  if (session) {
    await _loadProfile(session.user);
  } else {
    const soft = _loadSoftSession();
    if (soft?.email) {
      currentProfile = soft;
      currentUser    = { email: soft.email, id: soft.id };
    }
  }
  _sb.auth.onAuthStateChange(async (event, session) => {
    if (session) { await _loadProfile(session.user); }
    else         { currentUser = null; currentProfile = null; _clearSoftSession(); }
    renderHome();
  });
}
async function _loadProfile(user) {
  currentUser = user;
  const { data } = await _sb.from("profiles").select("*").eq("id", user.id).single();
  if (data) {
    currentProfile = data;
    _saveSoftSession(data);
    await loadFavsFromCloud();
  }
}

// ── Cloud favorites sync ──────────────────────────────────────
async function loadFavsFromCloud() {
  if (!_sb || !currentProfile?.id) return;
  const { data, error } = await _sb.rpc("get_user_favorites", { p_user_id: currentProfile.id });
  if (error || !data) return;
  let changed = false;
  for (const f of data) {
    if (f.fav_type === "team" && f.fav_data) {
      const d = f.fav_data;
      if (d.compId && d.teamName && !isFav(d.compId, d.teamName)) { favs.push(d); changed = true; }
    } else if (f.fav_type === "club" && f.fav_data) {
      const d = f.fav_data;
      if (d.key && !isClubFav(d.key)) { clubFavs.push(d); changed = true; }
    } else if (f.fav_type === "player") {
      if (!isPlayerFav(f.fav_key)) { playerFavs.push(f.fav_key); changed = true; }
    } else if (f.fav_type === "level" && f.fav_data) {
      const d = f.fav_data;
      if (d.nodeKey && !isLevelFav(d.nodeKey)) { levelFavs.push(d); changed = true; }
    }
  }
  if (changed) { saveFavs(); saveClubFavs(); savePlayerFavs(); saveLevelFavs(); }
}
async function _syncFavToCloud(type, key, data) {
  if (!_sb || !currentProfile?.id) return;
  _sb.rpc("upsert_user_favorite", { p_user_id: currentProfile.id, p_type: type, p_key: key, p_data: data });
}
async function _removeFavFromCloud(type, key) {
  if (!_sb || !currentProfile?.id) return;
  _sb.rpc("delete_user_favorite", { p_user_id: currentProfile.id, p_type: type, p_key: key });
}

function renderLoginButton() {
  if (!_sb) return `<button onclick="openPicker()" style="background:#e5001c;border:none;color:#fff;font-weight:700;font-size:13px;padding:7px 14px;border-radius:9px;cursor:pointer">+ Afegir equip</button>`;
  const loginBtn = currentUser
    ? `<button onclick="openUserModal()" style="background:#1a2035;border:none;color:#fff;font-weight:700;font-size:13px;padding:7px 12px;border-radius:9px;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
        <span style="background:#e5001c;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900">${(currentUser.email||"?")[0].toUpperCase()}</span>
        ${currentProfile?.role==="admin"?"Admin":currentProfile?.role==="entrenador"?"Entrenador":""}
       </button>`
    : `<button onclick="openLoginModal()" style="background:#f0f4f8;border:1.5px solid #e2e6ef;color:#334155;font-weight:700;font-size:13px;padding:7px 12px;border-radius:9px;cursor:pointer">👤 Login</button>`;
  return `<div style="display:flex;gap:6px;align-items:center">${loginBtn}<button onclick="openPicker()" style="background:#e5001c;border:none;color:#fff;font-weight:700;font-size:13px;padding:7px 14px;border-radius:9px;cursor:pointer">+ Afegir equip</button></div>`;
}

// Login modal
function openLoginModal() {
  const body = $("login-modal-body");
  body.innerHTML = `
    <div style="padding:20px 18px 32px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;color:#1a2035">Accés a l'app</div>
        <button onclick="closeLoginModal()" style="background:#f0f4f8;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:16px">✕</button>
      </div>
      <p style="font-size:14px;color:#64748b;margin-bottom:16px;line-height:1.5">Introdueix el teu e-mail per accedir.</p>
      <input id="login-email-input" type="email" placeholder="el-teu@email.com" autocomplete="email"
        style="width:100%;padding:12px 14px;border:1.5px solid #e2e6ef;border-radius:12px;font-size:15px;margin-bottom:12px;outline:none"/>
      <button onclick="loginWithEmail()" style="width:100%;background:#1a2035;border:none;color:#fff;font-weight:700;font-size:15px;padding:13px;border-radius:12px;cursor:pointer;margin-bottom:8px">Accedir</button>
      <div id="login-msg" style="margin-top:8px;text-align:center;font-size:13px;color:#64748b"></div>
    </div>`;
  $("login-modal-bd").style.display = "block";
  $("login-modal").classList.add("lm-open");
  setTimeout(() => $("login-email-input")?.focus(), 300);
}
function closeLoginModal() {
  $("login-modal").classList.remove("lm-open");
  $("login-modal-bd").style.display = "none";
}

async function loginWithEmail() {
  const email = $("login-email-input")?.value?.trim();
  const msg   = $("login-msg");
  if (!email || !email.includes("@")) { msg.textContent = "Introdueix un e-mail vàlid."; return; }
  msg.textContent = "Comprovant...";

  // Comprova si l'email ja existeix a la base de dades
  const { data: profiles } = await _sb.rpc("get_profile_by_email", { p_email: email });
  if (profiles && profiles.length > 0) {
    // Usuari registrat → accés directe via sessió lleugera
    const profile = profiles[0];
    currentProfile = profile;
    currentUser    = { email: profile.email, id: profile.id };
    _saveSoftSession(profile);
    await loadFavsFromCloud();
    closeLoginModal();
    renderHome();
    return;
  }

  // Usuari nou → envia magic link per registrar-se
  msg.textContent = "Enviant enllaç de registre...";
  const { error } = await _sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
  if (error) { msg.style.color = "#e5001c"; msg.textContent = "Error: " + error.message; }
  else       { msg.style.color = "#16a34a"; msg.textContent = "✓ Ets nou! Comprova el correu per activar el compte."; }
}
window.loginWithEmail = loginWithEmail;
window.sendMagicLink  = loginWithEmail; // alias

// User menu modal
function openUserModal() {
  const roleLabel = currentProfile?.role === "admin" ? "Administrador" : currentProfile?.role === "entrenador" ? "Entrenador" : "Usuari";
  const adminBtn  = currentProfile?.role === "admin"
    ? `<button onclick="closeUserModal();openAdminPanel()" style="width:100%;background:#1a2035;border:none;color:#fff;font-weight:700;font-size:14px;padding:12px;border-radius:12px;cursor:pointer;margin-bottom:10px">⚙️ Panell Admin</button>`
    : "";
  const teamSection = currentProfile?.role === "entrenador"
    ? `<div style="margin-bottom:16px">
        <div style="font-size:13px;color:#64748b;margin-bottom:6px">Equip assignat</div>
        <div style="display:flex;gap:8px">
          <input id="user-team-input" type="text" value="${esc(currentProfile?.team_name||"")}" placeholder="Nom de l'equip"
            style="flex:1;padding:10px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none"/>
          <button onclick="saveTeamName()" style="background:#1a2035;border:none;color:#fff;font-weight:700;font-size:13px;padding:10px 14px;border-radius:10px;cursor:pointer">Desar</button>
        </div>
        <div id="user-team-msg" style="margin-top:6px;font-size:12px;color:#64748b"></div>
      </div>`
    : "";
  $("user-modal-body").innerHTML = `
    <div style="padding:20px 18px 32px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;color:#1a2035">El meu compte</div>
        <button onclick="closeUserModal()" style="background:#f0f4f8;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="background:#f0f4f8;border-radius:12px;padding:14px 16px;margin-bottom:16px">
        <div style="font-size:13px;color:#64748b;margin-bottom:4px">E-mail</div>
        <div style="font-size:15px;font-weight:600;color:#1a2035">${esc(currentUser?.email||"")}</div>
        <div style="margin-top:8px;font-size:12px;color:#64748b">Rol: <span style="font-weight:700;color:#1a2035">${roleLabel}</span></div>
      </div>
      ${teamSection}
      ${adminBtn}
      <button onclick="signOut()" style="width:100%;background:#f0f4f8;border:1.5px solid #e2e6ef;color:#e5001c;font-weight:700;font-size:14px;padding:12px;border-radius:12px;cursor:pointer">Tancar sessió</button>
    </div>`;
  $("user-modal-bd").style.display = "block";
  $("user-modal").classList.add("lm-open");
}
function closeUserModal() {
  $("user-modal").classList.remove("lm-open");
  $("user-modal-bd").style.display = "none";
}
async function saveTeamName() {
  const team = $("user-team-input")?.value?.trim() || null;
  const msg  = $("user-team-msg");
  if (!_sb || !currentProfile?.id) return;
  msg.style.color = "#64748b"; msg.textContent = "Desant...";
  const { error } = await _sb.rpc("update_own_team_name", { p_user_id: currentProfile.id, p_team_name: team });
  if (error) { msg.style.color = "#e5001c"; msg.textContent = "Error: " + error.message; }
  else {
    currentProfile.team_name = team;
    _saveSoftSession(currentProfile);
    msg.style.color = "#16a34a"; msg.textContent = "✓ Desat";
  }
}
async function signOut() {
  await _sb?.auth.signOut();
  currentUser = null; currentProfile = null;
  _clearSoftSession();
  closeUserModal();
  renderHome();
}
window.signOut         = signOut;
window.saveTeamName    = saveTeamName;
window.openLoginModal  = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.openUserModal   = openUserModal;
window.closeUserModal  = closeUserModal;

// Admin panel
function openAdminPanel() {
  ["screen-home","screen-picker","screen-detail","screen-acta"].forEach(id => $(id).style.display = "none");
  $("screen-admin").style.display = "flex";
  renderAdminPanel();
}
function closeAdminPanel() {
  $("screen-admin").style.display = "none";
  renderHome();
}
async function renderAdminPanel() {
  const body = $("admin-body");
  body.innerHTML = `<div style="text-align:center;padding:32px;color:#94a3b8">Carregant usuaris...</div>`;
  const { data: profiles, error } = await _sb.rpc("get_all_profiles_admin", { admin_email: currentUser?.email });
  if (error || !profiles) { body.innerHTML = `<div style="color:#e5001c;padding:16px">Error: ${esc(error?.message||"Sense accés")}</div>`; return; }
  const ROLES = ["","entrenador","admin"];
  const rows = profiles.map(p => `
    <tr style="border-bottom:1px solid #f0f4f8">
      <td style="padding:10px 8px;font-size:13px;color:#1a2035;font-weight:500;word-break:break-all">${esc(p.email)}</td>
      <td style="padding:10px 8px;text-align:center">
        <select onchange="updateUserRole('${esc(p.id)}',this.value)"
          style="border:1.5px solid #e2e6ef;border-radius:8px;padding:5px 8px;font-size:13px;font-family:inherit;cursor:pointer">
          ${ROLES.map(r => `<option value="${r}" ${p.role===r?"selected":""}>${r||"—"}</option>`).join("")}
        </select>
      </td>
      <td style="padding:10px 8px;font-size:12px;color:#64748b">${esc(p.team_name||"")}</td>
      <td style="padding:10px 8px;text-align:center">
        <button onclick="adminDeleteUser('${esc(p.id)}')" title="Eliminar" style="background:none;border:none;color:#e5001c;cursor:pointer;font-size:15px;line-height:1;padding:2px 6px">✕</button>
      </td>
    </tr>`).join("");
  body.innerHTML = `
    <div style="background:#fff;border-radius:12px;border:1.5px solid #e2e6ef;padding:16px;margin-bottom:16px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">Afegir / editar usuari</div>
      <input id="admin-add-email" type="email" placeholder="email@exemple.com"
        style="width:100%;padding:10px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;margin-bottom:8px;font-family:inherit;outline:none"/>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <select id="admin-add-role" onchange="adminToggleTeamField()"
          style="flex:1;border:1.5px solid #e2e6ef;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;cursor:pointer">
          <option value="">Sense rol</option>
          <option value="entrenador">Entrenador</option>
          <option value="admin">Admin</option>
        </select>
        <input id="admin-add-team" type="text" placeholder="Equip (entrenador)"
          style="flex:1;padding:10px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none;display:none"/>
      </div>
      <button onclick="adminAddUser()" style="width:100%;background:#1a2035;border:none;color:#fff;font-weight:700;font-size:14px;padding:11px;border-radius:10px;cursor:pointer">Afegir / actualitzar</button>
      <div id="admin-add-msg" style="margin-top:8px;font-size:13px;text-align:center"></div>
    </div>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin-bottom:12px">${profiles.length} usuaris</div>
    <div style="overflow-x:auto;background:#fff;border-radius:12px;border:1.5px solid #e2e6ef">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:2px solid #e2e6ef">
          <th style="padding:10px 8px;text-align:left;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em">E-mail</th>
          <th style="padding:10px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em">Rol</th>
          <th style="padding:10px 8px;text-align:left;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em">Equip</th>
          <th style="padding:10px 8px"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
function adminToggleTeamField() {
  const role = $("admin-add-role")?.value;
  const tf = $("admin-add-team");
  if (tf) tf.style.display = role === "entrenador" ? "block" : "none";
}
async function adminAddUser() {
  const email = $("admin-add-email")?.value?.trim();
  const role  = $("admin-add-role")?.value || null;
  const team  = $("admin-add-team")?.value?.trim() || null;
  const msg   = $("admin-add-msg");
  if (!email || !email.includes("@")) { msg.style.color = "#e5001c"; msg.textContent = "E-mail invàlid."; return; }
  msg.style.color = "#64748b"; msg.textContent = "Desant...";
  const { error } = await _sb.rpc("admin_manage_user", { admin_email: currentUser.email, p_email: email, p_role: role, p_team: team });
  if (error) { msg.style.color = "#e5001c"; msg.textContent = "Error: " + error.message; }
  else { msg.style.color = "#16a34a"; msg.textContent = "✓ Usuari desat."; renderAdminPanel(); }
}
async function adminDeleteUser(uid) {
  if (!confirm("Eliminar aquest usuari?")) return;
  const { error } = await _sb.rpc("admin_delete_user", { admin_email: currentUser.email, target_id: uid });
  if (error) alert("Error: " + error.message);
  else renderAdminPanel();
}
async function updateUserRole(uid, role) {
  const { error } = await _sb.rpc("update_user_role_admin", { admin_email: currentUser?.email, target_id: uid, new_role: role||null });
  if (error) alert("Error: " + error.message);
}
window.openAdminPanel      = openAdminPanel;
window.closeAdminPanel     = closeAdminPanel;
window.updateUserRole      = updateUserRole;
window.adminAddUser        = adminAddUser;
window.adminDeleteUser     = adminDeleteUser;
window.adminToggleTeamField = adminToggleTeamField;

let DB      = null;
let currentJugadorId = null;
let homeTab = "favs"; // "favs" | "all" | "club"
let allSearch     = "";
let allFilterCat  = "ALL";
let allOnlyActive = true;  // hide 100% finished comps by default
let allCompsOpenState = {};
let clubSearch    = "";
let selectedClub  = null;  // { name, teams:[{compId, teamName, teamId}] }

let favs = [];
try { favs = JSON.parse(localStorage.getItem(FAV_KEY)||"[]"); } catch {}
const saveFavs = () => localStorage.setItem(FAV_KEY, JSON.stringify(favs));
const isFav    = (cid,tn) => favs.some(f=>f.compId===cid&&f.teamName===tn);
function toggleFav(compId, teamName, compName, category) {
  const key = `${compId}::${teamName}`;
  if (isFav(compId,teamName)) {
    favs = favs.filter(f=>!(f.compId===compId&&f.teamName===teamName));
    _removeFavFromCloud("team", key);
  } else {
    favs.push({compId,teamName,compName,category});
    _syncFavToCloud("team", key, {compId,teamName,compName,category});
  }
  saveFavs();
}

const PLAYER_FAV_KEY = "hoquei_player_favs_v1";
let playerFavs = [];
try { playerFavs = JSON.parse(localStorage.getItem(PLAYER_FAV_KEY)||"[]"); } catch {}
const savePlayerFavs  = () => localStorage.setItem(PLAYER_FAV_KEY, JSON.stringify(playerFavs));
const isPlayerFav     = jid => playerFavs.includes(jid);
function togglePlayerFav(jid) {
  if (isPlayerFav(jid)) {
    playerFavs = playerFavs.filter(id=>id!==jid);
    _removeFavFromCloud("player", jid);
  } else {
    playerFavs.push(jid);
    _syncFavToCloud("player", jid, null);
  }
  savePlayerFavs();
}

let levelFavs = [];
try { levelFavs = JSON.parse(localStorage.getItem(LEVEL_FAV_KEY)||"[]"); } catch {}
const saveLevelFavs = () => localStorage.setItem(LEVEL_FAV_KEY, JSON.stringify(levelFavs));
const isLevelFav = nodeKey => levelFavs.some(f=>f.nodeKey===nodeKey);
function toggleLevelFav(fav) {
  const key = fav.nodeKey;
  if (isLevelFav(key)) {
    levelFavs = levelFavs.filter(f=>f.nodeKey!==key);
    _removeFavFromCloud("level", key);
  } else {
    levelFavs.push(fav);
    _syncFavToCloud("level", key, fav);
  }
  saveLevelFavs();
}

let favDragCtx = null;

function favKeyOf(type, item) {
  if (type === "club") return item.key;
  if (type === "level") return item.nodeKey;
  if (type === "team") return `${item.compId}::${item.teamName}`;
  if (type === "player") return item;
  return "";
}

function favListRef(type) {
  if (type === "club") return { list: clubFavs, save: saveClubFavs };
  if (type === "level") return { list: levelFavs, save: saveLevelFavs };
  if (type === "team") return { list: favs, save: saveFavs };
  if (type === "player") return { list: playerFavs, save: savePlayerFavs };
  return null;
}

function reorderFavByKey(type, fromKey, toKey) {
  const ref = favListRef(type);
  if (!ref || fromKey === toKey) return;
  const arr = ref.list;
  const fromIdx = arr.findIndex(x => favKeyOf(type, x) === fromKey);
  const toIdx = arr.findIndex(x => favKeyOf(type, x) === toKey);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);
  ref.save();
}

window.favDragStart = (type, key) => {
  favDragCtx = { type, key };
};

window.favDragOver = e => {
  if (e && e.preventDefault) e.preventDefault();
};

window.favDrop = (type, key) => {
  if (!favDragCtx) return;
  if (favDragCtx.type !== type) {
    favDragCtx = null;
    return;
  }
  reorderFavByKey(type, favDragCtx.key, key);
  favDragCtx = null;
  renderFavs();
};

window.favDragEnd = () => {
  favDragCtx = null;
};

let jugadorSearch = "";
let jugadorComposing = false;

const $ = id => document.getElementById(id);
const esc = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/'/g,"&#39;");

const CAT_EMOJI = {
  "Nacional Catalana":"👑","1ª Catalana":"⭐","2ª Catalana":"🔵","3ª Catalana":"🟣",
  "Fem":"♀","Júnior":"🎯","Juvenil":"⚡","Infantil":"🏆","Aleví":"💪",
  "Benjamí":"🔥","Prebenjamí":"⭐","Veterans":"🧓","Altres":"📋",
};
// Mapatge de slug d'acta (actesIndex values) → nom de categoria per mostrar
const CAT_LABELS = {
  "nacional-catalana":"Nacional Catalana","1a-catalana":"1a Catalana",
  "2a-catalana":"2a Catalana","3a-catalana":"3a Catalana",
  "juvenil":"Juvenil","junior":"Júnior","infantil":"Infantil",
  "alevi":"Aleví","benjami":"Benjamí","prebenjami":"Pre-benjamí",
  "fem":"Femení","veterans":"Veterans","altres":"Altres",
};
const CAT_COLOR = {
  "Nacional Catalana":"#003da5","1ª Catalana":"#1a5dc7","2ª Catalana":"#2563eb",
  "3ª Catalana":"#7c3aed","Fem":"#db2777","Júnior":"#ea580c","Juvenil":"#16a34a",
  "Infantil":"#0891b2","Aleví":"#7c3aed","Benjamí":"#dc2626","Prebenjamí":"#d97706",
  "Veterans":"#6b7280","Altres":"#6b7280",
};

function getPlayerSourceCatCounts(player) {
  const out = {};
  for (const src of (player?.sources || [])) {
    const cat = DB?.actesIndex?.[String(src?.id)];
    if (!cat) continue;
    out[cat] = (out[cat] || 0) + 1;
  }
  return out;
}

function normalizePlayerTeamStatsForDisplay(player) {
  const teamStats = [...(player?.teamStats || [])];
  if (teamStats.length <= 1) return teamStats;

  const uniqueCats = [...new Set(teamStats.map(t => t.cat).filter(Boolean))];
  const srcCatCounts = Object.entries(getPlayerSourceCatCounts(player));

  // Heuristic fix: if all teams have same category but sources clearly span multiple categories,
  // distribute categories by prominence (most matches team -> most frequent source category).
  if (uniqueCats.length === 1 && srcCatCounts.length > 1) {
    const catsSorted = srcCatCounts.sort((a,b) => b[1]-a[1]).map(([cat]) => cat);
    const teamsSorted = [...teamStats].sort((a,b) => (b.count||0) - (a.count||0));
    const assigned = teamsSorted.map((t, i) => ({ ...t, cat: catsSorted[i] || catsSorted[0] || t.cat }));
    return assigned;
  }

  return teamStats;
}

async function enrichPlayerOnDemand(jid) {
  const player = DB?.jugadors?.[jid];
  if (!player) return;
  if (Array.isArray(player.careerStats) && player.careerStats.length) return;
  try {
    const res = await fetch(`https://jok.cat/api/player/${jid}`);
    if (!res.ok) return;
    const data = await res.json();

    if (Array.isArray(data.playerStats) && data.playerStats.length) {
      player.careerStats = data.playerStats.map(s => ({
        seasonName:   s.seasonName,
        total_goals:  +s.total_goals,
        match_count:  +s.match_count,
        total_blue:   +s.total_blue,
        total_red:    +s.total_red,
      }));
    }
    const info = data.playerInfo?.[0];
    if (info?.number != null && player.number == null) player.number = info.number;
  } catch {}
}

// ── Club ID lookups ───────────────────────────────────────────
function getClubIdByTeamId(teamId) {
  if (!DB||!teamId) return null;
  return (DB.clubIndex||{})[teamId]?.clubId||null;
}

let _nameMap = null;
function buildNameMap() {
  if (_nameMap||!DB) return;
  _nameMap = new Map();
  // Use classification rows — correct mixed-case names with reliable clubId
  for (const comps of Object.values(DB.categories||{})) {
    for (const comp of comps) {
      for (const r of (comp.classification||[])) {
        if (!r.clubId||!r.team) continue;
        const n = r.team.toLowerCase();
        const base = n.replace(/\s+[a-z]$/,"").trim();
        if (!_nameMap.has(n))    _nameMap.set(n,    r.clubId);
        if (!_nameMap.has(base)) _nameMap.set(base, r.clubId);
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

function normalizeCompKey(name) {
  return String(name || "")
    .replace(/\s*\((?:20\d{2}|\d{4})[-/]?\d{2,4}\)\s*/g, " ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasClassRows(rows) {
  return Array.isArray(rows) && rows.some(r => r && String(r.team || "").trim());
}

function buildSidgadClassificationIndex(raw) {
  const byCompId = new Map();
  const byName = new Map();
  const values = Object.values(raw || {});

  for (const comp of values) {
    if (!comp || typeof comp !== "object") continue;

    const compNameKey = normalizeCompKey(comp.name);
    const groups = comp.classificationByGroup || {};
    const groupEntries = Object.entries(groups).filter(([, rows]) => hasClassRows(rows));
    const flatRows = hasClassRows(comp.classification) ? comp.classification : null;

    for (const [idc, rows] of groupEntries) {
      if (!byCompId.has(String(idc))) byCompId.set(String(idc), rows);
    }

    if (flatRows) {
      const idcs = [...new Set((comp.matches || []).map(m => String(m?.idc || "")).filter(Boolean))];
      if (idcs.length === 1 && !byCompId.has(idcs[0])) byCompId.set(idcs[0], flatRows);
      if (comp.id && !byCompId.has(String(comp.id))) byCompId.set(String(comp.id), flatRows);
      if (compNameKey && !byName.has(compNameKey)) byName.set(compNameKey, flatRows);
      continue;
    }

    if (compNameKey && groupEntries.length && !byName.has(compNameKey)) {
      byName.set(compNameKey, groupEntries[0][1]);
    }
  }

  return { byCompId, byName };
}

function applyClassificationSourceMerge() {
  if (!DB?.categories) return;

  for (const comps of Object.values(DB.categories)) {
    for (const comp of comps) {
      const jokRows = Array.isArray(comp.classification) ? comp.classification : [];
      if (hasClassRows(jokRows)) {
        comp.classification = jokRows;
        comp.classificationSource = "jok";
      } else {
        comp.classification = [];
        comp.classificationSource = "none";
      }
    }
  }
}

function classifSourceBadgeHtml(comp) {
  const src = comp?.classificationSource;
  if (src === "fecapa") {
    return `<span style="display:inline-flex;align-items:center;gap:5px;background:#e8f2ff;border:1px solid #bfdbfe;color:#003da5;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:700"><span>🛡️</span><span>FECAPA</span></span>`;
  }
  if (src === "jok") {
    return `<span style="display:inline-flex;align-items:center;gap:5px;background:#eefcf3;border:1px solid #bbf7d0;color:#166534;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:700"><span>🌐</span><span>jok.cat</span></span>`;
  }
  return "";
}
//-- Busca competicions
function findComp(compId) {
  if (!DB) return null;
  for (const comps of Object.values(DB.categories)) {
    const c = comps.find(c=>c.id===compId);
    if (c) return c;
  }
  return null;
}

const teamMapCache = new Map();

function normTeamName(name) {
  return String(name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function baseTeamName(name) {
  return normTeamName(name).replace(/\s+[a-e]$/, "").trim();
}

function getTeamIdFromComp(comp, teamName) {
  if (!comp || !teamName) return null;
  const rows = Array.isArray(comp.classification) ? comp.classification : [];
  if (!rows.length) return null;

  const target = normTeamName(teamName);
  const targetBase = baseTeamName(teamName);

  const exact = rows.find(r => r?.teamId && normTeamName(r.team) === target);
  if (exact?.teamId) return String(exact.teamId);

  const exactBase = rows.find(r => r?.teamId && baseTeamName(r.team) === targetBase);
  if (exactBase?.teamId) return String(exactBase.teamId);

  const fuzzy = rows.find(r => {
    if (!r?.teamId || !r.team) return false;
    const n = normTeamName(r.team);
    const b = baseTeamName(r.team);
    return n.includes(targetBase) || targetBase.includes(n) || b.includes(targetBase) || targetBase.includes(b);
  });
  return fuzzy?.teamId ? String(fuzzy.teamId) : null;
}

async function searchJokTeamId(teamName) {
  if (!teamName) return null;
  try {
    const q = encodeURIComponent(teamName);
    const res = await fetch(`https://jok.cat/api/search/teams/${q}`);
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr) || !arr.length) return null;

    const target = normTeamName(teamName);
    const targetBase = baseTeamName(teamName);

    let best = null;
    let bestScore = -1;
    for (const item of arr) {
      const cand = normTeamName(item?.teamName || "");
      const candBase = baseTeamName(item?.teamName || "");
      let score = 0;
      if (cand === target) score += 100;
      if (candBase === targetBase) score += 90;
      if (cand.includes(targetBase) || targetBase.includes(cand)) score += 25;
      if (candBase.includes(targetBase) || targetBase.includes(candBase)) score += 25;
      if (String(item?.seasonName || "").includes("2025")) score += 5;
      if (score > bestScore && item?.idTeam) {
        bestScore = score;
        best = item;
      }
    }
    return best?.idTeam ? String(best.idTeam) : null;
  } catch {
    return null;
  }
}

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractCoordsDeep(node) {
  if (!node) return null;
  const latKeys = ["lat", "latitude", "latitud", "y", "coordlat", "coord_lat"];
  const lonKeys = ["lon", "lng", "long", "longitude", "longitud", "x", "coordlon", "coord_lng", "coord_long"];

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = extractCoordsDeep(child);
      if (found) return found;
    }
    return null;
  }

  if (typeof node !== "object") return null;

  const keys = Object.keys(node);
  const latKey = keys.find(k => latKeys.includes(String(k).toLowerCase()));
  const lonKey = keys.find(k => lonKeys.includes(String(k).toLowerCase()));
  if (latKey && lonKey) {
    const lat = toNumberOrNull(node[latKey]);
    const lon = toNumberOrNull(node[lonKey]);
    if (lat != null && lon != null) return { lat, lon };
  }

  for (const value of Object.values(node)) {
    const found = extractCoordsDeep(value);
    if (found) return found;
  }
  return null;
}

function buildMapTarget(label, coords) {
  const safeLabel = String(label || "Pavello").trim() || "Pavello";
  if (coords?.lat != null && coords?.lon != null) {
    const ll = `${coords.lat},${coords.lon}`;
    return {
      label: safeLabel,
      hasCoords: true,
      google: `https://www.google.com/maps?q=${encodeURIComponent(ll)}`,
      apple: `https://maps.apple.com/?ll=${encodeURIComponent(ll)}&q=${encodeURIComponent(safeLabel)}`,
    };
  }
  return {
    label: safeLabel,
    hasCoords: false,
    google: `https://www.google.com/maps?q=${encodeURIComponent(safeLabel)}`,
    apple: `https://maps.apple.com/?q=${encodeURIComponent(safeLabel)}`,
  };
}

function openBestMapUrl(target) {
  if (!target) return;
  const ua = navigator.userAgent || "";
  const isApple = /iPad|iPhone|iPod|Macintosh/i.test(ua);
  const url = isApple ? target.apple : target.google;
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

async function resolveHomeVenueMapTarget(compId, homeTeam) {
  const key = `${compId || ""}::${baseTeamName(homeTeam)}`;
  if (teamMapCache.has(key)) return teamMapCache.get(key);

  const comp = compId ? findComp(compId) : null;
  let teamId = getTeamIdFromComp(comp, homeTeam);
  if (!teamId) teamId = await searchJokTeamId(homeTeam);

  let target = null;
  if (teamId) {
    try {
      const res = await fetch(`https://jok.cat/api/team/${encodeURIComponent(teamId)}`);
      if (res.ok) {
        const payload = await res.json();
        const info = payload?.teamInfo?.[0] || {};
        const label = info.clubName || info.teamName || homeTeam;
        const coords = extractCoordsDeep(payload);
        target = buildMapTarget(label, coords);
      }
    } catch {}
  }

  if (!target) target = buildMapTarget(homeTeam, null);
  teamMapCache.set(key, target);
  return target;
}

window.openMatchVenue = async function(compId, homeTeam) {
  const target = await resolveHomeVenueMapTarget(compId, homeTeam);
  openBestMapUrl(target);
};
// -- Busca actes (cerca en el cache de categories carregades)
const actesCache = {}; // catSlug → { actaId: actaData }

async function loadCatActes(slug) {
  if (actesCache[slug]) return actesCache[slug];
  try {
    const res = await fetch(`./actes/${slug}.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    actesCache[slug] = await res.json();
  } catch(e) {
    actesCache[slug] = {};
  }
  return actesCache[slug];
}

function findActa(actaId) {
  if (!DB || !actaId) return null;
  const id = String(actaId);
  for (const actes of Object.values(actesCache)) {
    if (actes[id]) return actes[id];
  }
  return null;
}
// -- Fa match actes
function getMatchActa(match) {
  if (!match) return null;

  if (match.actaId) {
    const acta = findActa(match.actaId);
    if (acta) return acta;
  }

  if (match.actaUrl) {
    return {
      actaId: match.actaId || null,
      actaUrl: match.actaUrl,
      actaSlug: match.actaSlug || "",
    };
  }

  return null;
}

function getSafeActaUrl(rawUrl) {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl, window.location.href);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {}

  return null;
}

window.openActa = async function(actaId, fallbackUrl) {
  let acta = actaId ? findActa(actaId) : null;

  if (!acta && actaId && DB?.actesIndex) {
    const slug = DB.actesIndex[String(actaId)];
    if (slug) {
      const actes = await loadCatActes(slug);
      acta = actes[String(actaId)] || null;
    }
  }

  if (acta?.loaded && (acta?.playerStats || acta?.playerStatsRaw)) {
    openActaDetail(acta);
    return;
  }
  const url = acta?.actaUrl || fallbackUrl || acta?.url || "";
  const safeUrl = getSafeActaUrl(url);
  if (safeUrl) window.open(safeUrl, "_blank", "noopener,noreferrer");
};

// ── ACTA DETAIL PAGE ─────────────────────────────────────────

function parsePlayerBlock(block, links) {
  const result = [];
  // Match: (name with spaces/accents) followed by exactly 3 integers
  const re = /((?:[A-Za-zÀ-ÿ'\-]+ )+?)(\d+) (\d+) (\d+)(?= [A-Za-zÀ-ÿ]|$)/g;
  let m, i = 0;
  while ((m = re.exec(block)) !== null) {
    result.push({ name: m[1].trim(), g: +m[2], b: +m[3], v: +m[4], url: links[i]?.url || null, jugadorId: links[i]?.jugadorId || null });
    i++;
  }
  // Fallback: if regex missed some, try simpler split by known player count
  if (!result.length && links.length) {
    const tokens = block.trim().split(/\s+/);
    let j = 0;
    links.forEach((link, li) => {
      const nameParts = [];
      while (j < tokens.length && !/^\d+$/.test(tokens[j])) nameParts.push(tokens[j++]);
      const g = +tokens[j++] || 0, b = +tokens[j++] || 0, v = +tokens[j++] || 0;
      result.push({ name: nameParts.join(" "), g, b, v, url: link.url, jugadorId: link.jugadorId });
    });
  }
  return result;
}

function playerTableHtml(players, teamName, teamColor) {
  if (!players.length) return `<p style="font-size:13px;color:#94a3b8;padding:8px 0">Sense dades de jugadors</p>`;
  const hasStats = players.some(p => p.g || p.b || p.v);
  return `
    <div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;text-transform:uppercase;color:${teamColor};letter-spacing:.05em;margin-bottom:6px">${esc(teamName)}</div>
      <div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;overflow:hidden">
        <div style="display:flex;background:#f8fafc;padding:6px 12px;border-bottom:1px solid #e2e6ef">
          <div style="flex:1;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Jugador</div>
          ${hasStats?`<div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#16a34a">G</div>
          <div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#2563eb">B</div>
          <div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#dc2626">V</div>`:""}
        </div>
        ${players.map(p => `
          <div style="display:flex;align-items:center;padding:7px 12px;border-top:1px solid #f0f2f8">
            <div style="flex:1;font-size:13px;font-weight:500;min-width:0">
              ${(()=>{const m=p.url?.match(/\/jugador\/(\d+)\//);const jid=m?.[1];if(jid)return`<button class="player-name-btn" data-jid="${jid}">${esc(p.name)}</button>`;if(p.url)return`<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" style="color:#003da5;text-decoration:none;font-weight:600">${esc(p.name)}</a>`;return esc(p.name);})()}
            </div>
            ${hasStats?`
            <div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:${p.g?"900":"400"};color:${p.g?"#16a34a":"#cbd5e1"}">${p.g||"·"}</div>
            <div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:${p.b?"900":"400"};color:${p.b?"#2563eb":"#cbd5e1"}">${p.b||"·"}</div>
            <div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:${p.v?"900":"400"};color:${p.v?"#dc2626":"#cbd5e1"}">${p.v||"·"}</div>`:""}
          </div>`).join("")}
      </div>
    </div>`;
}

function openActaDetail(acta) {
  let homePlayers, awayPlayers;
  if (acta.playerStats) {
    homePlayers = acta.playerStats.homePlayers || [];
    awayPlayers = acta.playerStats.awayPlayers || [];
  } else {
    const psr = acta.playerStatsRaw || {};
    const links = acta.playerLinks || [];
    homePlayers = parsePlayerBlock(psr.homeBlock || "", links);
    awayPlayers = parsePlayerBlock(psr.awayBlock || "", links.slice(homePlayers.length));
  }

  const homeId = getClubId(acta.home);
  const awayId = getClubId(acta.away);
  const date = acta.actaMeta?.date || acta.date || "";
  const time = acta.actaMeta?.time || acta.time || "";
  const refs = (acta.referees || []).filter(r => r && r.length > 2);
  const compName = (acta.compName || acta.actaMeta?.compName || "").replace(/\s*\(2025-26\)/,"");
  const jornada = acta.jornada ? `J${acta.jornada}` : "";
  const actaUrl = acta.actaUrl || acta.url || "";

  $("acta-header-title").textContent = `${acta.home} – ${acta.away}`;
  $("acta-header-meta").textContent = [jornada, date, time, compName].filter(Boolean).join(" · ");

  $("acta-body").innerHTML = `
    <!-- Score header -->
    <div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:14px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <div style="display:flex;align-items:center;padding:16px 14px;gap:8px">
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center">
          ${shieldImg(homeId, 44)}
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;line-height:1.2">${esc(acta.home)}</div>
        </div>
        <div style="text-align:center;flex-shrink:0;min-width:80px">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:36px;font-weight:900;line-height:1;color:#1a2035">${acta.homeScore ?? "–"} · ${acta.awayScore ?? "–"}</div>
          ${date||time?`<div style="font-size:11px;color:#94a3b8;margin-top:4px">${[date,time].filter(Boolean).join(" ")}</div>`:""}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center">
          ${shieldImg(awayId, 44)}
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;line-height:1.2">${esc(acta.away)}</div>
        </div>
      </div>
      <div style="border-top:1px solid #f0f2f8;padding:10px 14px;display:flex;flex-wrap:wrap;gap:12px;align-items:center">
        ${compName?`<div style="font-size:12px;color:#6b7a99"><span style="font-weight:700">Competició:</span> ${esc(compName)}</div>`:""}
        ${refs.length?`<div style="font-size:12px;color:#6b7a99"><span style="font-weight:700">Àrbitres:</span> ${refs.map(r=>esc(r)).join(", ")}</div>`:""}
      </div>
      ${actaUrl?`<div style="border-top:1px solid #f0f2f8;padding:10px 14px">
        <a href="${esc(actaUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#003da5;text-decoration:none">📄 Veure acta a jok.cat →</a>
      </div>`:""}
    </div>

    <!-- Players -->
    <div class="acta-teams-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start">
      ${playerTableHtml(homePlayers, acta.home, "#003da5")}
      ${playerTableHtml(awayPlayers, acta.away, "#e5001c")}
    </div>`;

  ["screen-home","screen-detail","screen-picker"].forEach(id => $(id).style.display="none");
  $("screen-acta").style.display = "flex";
  window.scrollTo(0, 0);
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
function matchCard(m, myTeam, compId) {
  const riH    = teamIn(m.home,myTeam), riA = teamIn(m.away,myTeam);
  const played = m.played!==false && m.homeScore!=null;
  const cidH   = getClubId(m.home), cidA = getClubId(m.away);
  const acta   = getMatchActa(m);
  const hasActa = !!(acta && (acta.actaUrl || acta.url));

  let border="#e2e6ef", badge="";
  if (played && myTeam) {
    const draw=m.homeScore===m.awayScore, win=riH?m.homeScore>m.awayScore:m.awayScore>m.homeScore;
    border=draw?"#d97706":win?"#16a34a":"#dc2626";
    const [bg,tc,lb]=draw?["#fef3c7","#b45309","Empat"]:win?["#dcfce7","#16a34a","Victòria"]:["#fee2e2","#dc2626","Derrota"];
    badge=`<div style="text-align:center;margin-top:5px"><span style="background:${bg};color:${tc};font-size:11px;font-weight:700;padding:2px 10px;border-radius:6px">${lb}</span></div>`;
  }

  const score=played
    ?`<div style="background:#e5001c;color:#fff;border-radius:8px;padding:4px 12px;font-family:'Barlow Condensed',sans-serif;font-size:clamp(17px,5vw,20px);font-weight:900;line-height:1.1;white-space:nowrap;min-width:48px;text-align:center">${m.homeScore} - ${m.awayScore}</div>`
    :`<div style="background:#1a5dc7;color:#fff;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;white-space:nowrap;min-width:48px;text-align:center">VS</div>`;

  const actaBadge = hasActa
    ? `<div style="text-align:center;margin-top:6px"><span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px">📄 Acta</span></div>`
    : "";

  const venueBtn = !played
    ? `<button onclick="event.stopPropagation();openMatchVenue('${esc(compId||"")}','${esc(m.home||"")}')" title="Obrir mapa del pavello local" style="margin-top:6px;background:#ecfeff;color:#0f766e;border:1px solid #99f6e4;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;cursor:pointer">📍 Mapa</button>`
    : "";

  const clickAttrs = hasActa
    ? `onclick="openActa('${esc(acta.actaId||"")}','${esc(acta.actaUrl||acta.url||"")}')" style="background:#fff;border:1.5px solid ${border};border-left:4px solid ${border};border-radius:10px;padding:9px 11px;margin-bottom:5px;cursor:pointer;box-shadow:0 1px 4px rgba(0,30,80,.06)"`
    : `style="background:#fff;border:1.5px solid ${border};border-left:4px solid ${border};border-radius:10px;padding:9px 11px;margin-bottom:5px"`;

  return `
    <div ${clickAttrs}>
      <div style="display:flex;align-items:center;gap:6px">
        <div style="flex:1;display:flex;align-items:center;justify-content:flex-end;gap:5px;min-width:0">
          <span style="font-size:clamp(12px,3.5vw,14px);font-weight:${riH?800:500};color:${riH?"#003da5":"#334155"};text-align:right;line-height:1.3;overflow-wrap:anywhere">${esc(m.home)}</span>
          ${shieldImg(cidH,22)}
        </div>
        <div style="flex-shrink:0;text-align:center;min-width:68px">
          ${score}
          <div style="font-size:10px;color:#94a3b8;margin-top:2px;white-space:nowrap">${esc(m.date||"")}${!played&&m.time?` · ${esc(m.time)}`:""}</div>
          ${actaBadge}
          ${venueBtn}
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
  $("home-header").innerHTML = `
    <div style="max-width:720px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900">🏒 <span style="color:#e5001c">FECAPA</span></div>
      ${renderLoginButton()}
    </div>
    <div style="max-width:720px;margin:0 auto;display:flex;gap:3px">
      <button onclick="setHomeTab('favs')" style="flex:1;background:${homeTab==='favs'?"#1a2035":"#f0f4f8"};color:${homeTab==='favs'?"#fff":"#6b7a99"};border:1.5px solid ${homeTab==='favs'?"#1a2035":"#e2e6ef"};border-radius:9px;padding:8px 2px;font-size:11px;font-weight:700;cursor:pointer">⭐ Meus${(favs.length+clubFavs.length+playerFavs.length+levelFavs.length)?` (${favs.length+clubFavs.length+playerFavs.length+levelFavs.length})`:""}</button>
      <button onclick="setHomeTab('club')" style="flex:1;background:${homeTab==='club'?"#1a2035":"#f0f4f8"};color:${homeTab==='club'?"#fff":"#6b7a99"};border:1.5px solid ${homeTab==='club'?"#1a2035":"#e2e6ef"};border-radius:9px;padding:8px 2px;font-size:11px;font-weight:700;cursor:pointer">🏟 Club</button>
      <button onclick="setHomeTab('all')" style="flex:1;background:${homeTab==='all'?"#1a2035":"#f0f4f8"};color:${homeTab==='all'?"#fff":"#6b7a99"};border:1.5px solid ${homeTab==='all'?"#1a2035":"#e2e6ef"};border-radius:9px;padding:8px 2px;font-size:11px;font-weight:700;cursor:pointer">🔍 Comps</button>
      <button onclick="setHomeTab('jugadors')" style="flex:1;background:${homeTab==='jugadors'?"#1a2035":"#f0f4f8"};color:${homeTab==='jugadors'?"#fff":"#6b7a99"};border:1.5px solid ${homeTab==='jugadors'?"#1a2035":"#e2e6ef"};border-radius:9px;padding:8px 2px;font-size:11px;font-weight:700;cursor:pointer">👤 Jugadors</button>
    </div>`;
  if (homeTab==="favs") renderFavs();
  else if (homeTab==="club") renderClubTab();
  else if (homeTab==="jugadors") renderJugadorsTab();
  else renderAllComps();
}
window.setHomeTab = t => { homeTab=t; renderHome(); };

// ── JUGADORS ──────────────────────────────────────────────────
function renderJugadorsTab(refreshOnly = false) {
  const body = $("home-body");
  const norm = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const fmtName = p => p.slug ? decodeURIComponent(p.slug.replace(/\+/g," ")).toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()) : "?";
  const calcAge = bd => {
    if (!bd) return null;
    const p=bd.split(/[\/\-]/), dob=p[0].length===4?new Date(`${p[0]}-${p[1]}-${p[2]}`):new Date(`${p[2]}-${p[1]}-${p[0]}`);
    if (isNaN(dob)) return null;
    const today=new Date();
    return today.getFullYear()-dob.getFullYear()-(today<new Date(today.getFullYear(),dob.getMonth(),dob.getDate())?1:0);
  };

  const playerRow = (jid, player, dndType = null) => {
    const name = fmtName(player);
    const age  = calcAge(player.birthDate);
    const team = normalizePlayerTeamStatsForDisplay(player)?.[0];
    const catLabel = team ? (CAT_LABELS[team.cat] || team.cat) : null;
    const fav  = isPlayerFav(jid);
    const sub  = [
      team    ? `<span style="font-size:11px;color:#6b7a99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${esc(team.team)}</span>` : "",
      catLabel? `<span style="font-size:10px;font-weight:700;background:#f0f4f8;color:#475569;border-radius:4px;padding:1px 5px;flex-shrink:0">${esc(catLabel)}</span>` : "",
      player.isGK ? `<span style="font-size:10px;font-weight:700;background:#dbeafe;color:#1d4ed8;border-radius:4px;padding:1px 5px;flex-shrink:0">🥅</span>` : "",
      age     ? `<span style="font-size:11px;color:#94a3b8;flex-shrink:0">${age}a</span>` : "",
    ].filter(Boolean);
    const dragAttrs = dndType === "player"
      ? `draggable="true" ondragstart="favDragStart('player','${esc(jid)}')" ondragend="favDragEnd()" ondragover="favDragOver(event)" ondrop="favDrop('player','${esc(jid)}')"`
      : "";
    const dragHandle = dndType === "player"
      ? `<div title="Arrossega per ordenar" style="color:#cbd5e1;font-size:16px;line-height:1;cursor:grab;user-select:none;flex-shrink:0">⋮⋮</div>`
      : "";
    return `<div ${dragAttrs} style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #f0f2f8">
      ${dragHandle}
      <div data-jid="${esc(jid)}" style="flex:1;min-width:0;cursor:pointer">
        <div style="font-size:14px;font-weight:600;color:#1a2035;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
        ${sub.length?`<div style="display:flex;align-items:center;gap:5px;margin-top:2px;flex-wrap:wrap">${sub.join("")}</div>`:""}
      </div>
      <button onclick="event.stopPropagation();togglePlayerFavAndRender('${esc(jid)}')" style="background:none;border:none;font-size:22px;cursor:pointer;padding:4px 2px;flex-shrink:0;line-height:1;color:${fav?"#f59e0b":"#cbd5e1"}">${fav?"★":"☆"}</button>
    </div>`;
  };

  const qRaw = jugadorSearch || "";
  const q = qRaw.trim();
  let listHtml = "";

  // Jugadors seguits
  if (playerFavs.length) {
    const rows = playerFavs.map(jid=>({jid,p:DB.jugadors[jid]})).filter(x=>x.p).map(x=>playerRow(x.jid,x.p,"player")).join("");
    if (rows) listHtml += `
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin-bottom:6px">⭐ Seguits</div>
      <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,30,80,.07);margin-bottom:16px">${rows}</div>`;
  }

  // Resultats de cerca
  if (q.length >= 2) {
    const qn = norm(q);
    const results = Object.entries(DB.jugadors||{})
      .filter(([jid,p]) => !isPlayerFav(jid) && norm(fmtName(p)).includes(qn))
      .sort(([,a],[,b]) => {
        const na=norm(fmtName(a)), nb=norm(fmtName(b));
        return (nb.startsWith(qn)?0:1)-(na.startsWith(qn)?0:1) || na.localeCompare(nb);
      })
      .slice(0, 50);
    listHtml += results.length
      ? `<div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin-bottom:6px">Resultats${results.length===50?" (50+)":` (${results.length})`}</div>
         <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,30,80,.07)">${results.map(([jid,p])=>playerRow(jid,p)).join("")}</div>`
      : `<div style="text-align:center;padding:32px;color:#94a3b8">Sense resultats per "<b>${esc(q)}</b>"</div>`;
  } else if (q.length === 1) {
    listHtml += `<div style="text-align:center;padding:16px;color:#94a3b8;font-size:13px">Escriu almenys 2 caràcters per cercar</div>`;
  } else if (!playerFavs.length) {
    listHtml = `<div style="text-align:center;padding:40px 20px;color:#94a3b8">
      <div style="font-size:40px;margin-bottom:10px">👤</div>
      <p style="font-size:14px;line-height:1.6">Cerca jugadors per nom o cognom.<br/><span style="font-size:12px">Marca'ls amb ★ per seguir-los.</span></p>
    </div>`;
  }

  if (!refreshOnly || !$("jugador-results")) {
    body.innerHTML = `
      <div style="margin-bottom:14px">
        <input type="text" id="jugador-search-input" placeholder="🔍  Cerca per nom o cognom..." value="${esc(qRaw)}"
          style="width:100%;padding:12px 14px;border:1.5px solid #e2e6ef;border-radius:12px;font-size:15px;background:#fff;outline:none;-webkit-appearance:none"
          oninput="setJugadorSearch(this.value)" oncompositionstart="jugadorCompStart()" oncompositionend="jugadorCompEnd(this.value)" autocomplete="off" autocorrect="off" spellcheck="false"/>
      </div>
      <div id="jugador-results"></div>`;
  }

  const results = $("jugador-results");
  if (results) results.innerHTML = listHtml;
}
window.jugadorCompStart = () => { jugadorComposing = true; };
window.jugadorCompEnd = v => { jugadorComposing = false; setJugadorSearch(v); };
window.setJugadorSearch = q => {
  jugadorSearch = q;
  if (!jugadorComposing) renderJugadorsTab(true);
};
window.togglePlayerFavAndRender = jid => { togglePlayerFav(jid); renderJugadorsTab(true); };

// ── FAVS ──────────────────────────────────────────────────────
function renderFavs() {
  const body=$("home-body");
  if (!favs.length && !clubFavs.length && !levelFavs.length && !playerFavs.length) {
    body.innerHTML=`<div style="text-align:center;padding:48px 20px 32px">
      <div style="font-size:48px;margin-bottom:12px">⭐</div>
      <h2 style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800;color:#1a2035;margin-bottom:8px">Cap favorit afegit</h2>
      <p style="color:#6b7a99;font-size:14px;line-height:1.6;margin-bottom:24px">Afegeix equips, nivells, clubs o jugadors.</p>
      <button onclick="openPicker()" style="background:#e5001c;border:none;color:#fff;font-weight:700;font-size:15px;padding:13px 28px;border-radius:12px;cursor:pointer">+ Afegir el meu equip</button>
    </div>`;
    return;
  }
  const updAt=DB?.updatedAt?new Date(DB.updatedAt).toLocaleDateString("ca-ES"):"?";
  const clubMap = clubFavs.length ? buildClubMap() : null;
  const hasAnyPrev = clubFavs.length || levelFavs.length || playerFavs.length;
  const both = favs.length && hasAnyPrev;
  const clubSection = clubFavs.length ? `
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin-bottom:8px">🏟 Clubs</div>
    ${clubFavs.map(f=>buildClubFavCard(f,clubMap)).join("")}` : "";
  const levelSection = levelFavs.length ? `
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin:${clubFavs.length?"16px":"0"} 0 8px">🧩 Nivells</div>
    ${levelFavs.map(buildLevelFavCard).join("")}` : "";
  const playerSection = playerFavs.length ? `
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin:${(clubFavs.length||levelFavs.length)?"16px":"0"} 0 8px">👤 Jugadors</div>
    ${playerFavs.map(buildPlayerFavCard).join("")}` : "";
  const teamSection = favs.length ? `
    ${both?`<div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin:${(clubFavs.length||levelFavs.length||playerFavs.length)?"16px":0} 0 8px">🏒 Equips</div>`:""}
    ${favs.map(buildFavCard).join("")}` : "";
  body.innerHTML=clubSection+levelSection+playerSection+teamSection+
    `<p style="text-align:center;font-size:11px;color:#cbd5e1;margin-top:4px;padding-bottom:16px">Actualitzat: ${updAt}</p>`;
}

function buildLevelFavCard(fav) {
  const color = fav.color || "#475569";
  const emoji = fav.emoji || "🧩";
  return `
    <div draggable="true" ondragstart="favDragStart('level','${esc(fav.nodeKey)}')" ondragend="favDragEnd()" ondragover="favDragOver(event)" ondrop="favDrop('level','${esc(fav.nodeKey)}')" style="background:#fff;border:1.5px solid #e2e6ef;border-top:4px solid ${color};border-radius:14px;overflow:hidden;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <div style="display:flex;align-items:center;gap:10px;padding:11px 13px">
        <div title="Arrossega per ordenar" style="color:#cbd5e1;font-size:16px;line-height:1;cursor:grab;user-select:none">⋮⋮</div>
        <div style="width:34px;height:34px;border-radius:9px;background:${color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:17px">${emoji}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fav.label||"Nivell")}</div>
          <div style="font-size:11px;color:#6b7a99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fav.pathLabel||"")}</div>
        </div>
        <button onclick="removeLevelFav('${esc(fav.nodeKey)}')" style="background:none;border:none;color:#cbd5e1;font-size:16px;cursor:pointer;padding:4px;flex-shrink:0">✕</button>
      </div>
      <div style="display:flex;gap:6px;padding:0 12px 11px">
        <button onclick="openLevelFav('${esc(fav.nodeKey)}')" style="flex:1;background:#f5f7fc;border:1px solid #e2e6ef;border-radius:8px;padding:7px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">🔍 Veure nivell</button>
      </div>
    </div>`;
}

function buildPlayerFavCard(jid) {
  const p = DB?.jugadors?.[jid];
  if (!p) return "";
  const name = p.slug ? decodeURIComponent(p.slug.replace(/\+/g," ")).toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()) : "?";
  const team = normalizePlayerTeamStatsForDisplay(p)?.[0];
  const catLabel = team ? (CAT_LABELS[team.cat] || team.cat) : "";
  return `
    <div draggable="true" ondragstart="favDragStart('player','${esc(jid)}')" ondragend="favDragEnd()" ondragover="favDragOver(event)" ondrop="favDrop('player','${esc(jid)}')" style="background:#fff;border:1.5px solid #e2e6ef;border-top:4px solid #1a5dc7;border-radius:14px;overflow:hidden;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <div style="display:flex;align-items:center;gap:10px;padding:11px 13px">
        <div title="Arrossega per ordenar" style="color:#cbd5e1;font-size:16px;line-height:1;cursor:grab;user-select:none">⋮⋮</div>
        <div style="width:34px;height:34px;border-radius:9px;background:#1a5dc718;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:17px">👤</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
          <div style="font-size:11px;color:#6b7a99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(team?.team || "")}${catLabel ? ` · ${esc(catLabel)}` : ""}</div>
        </div>
        <button onclick="removePlayerFavHome('${esc(jid)}')" style="background:none;border:none;color:#cbd5e1;font-size:16px;cursor:pointer;padding:4px;flex-shrink:0">✕</button>
      </div>
      <div style="display:flex;gap:6px;padding:0 12px 11px">
        <button onclick="openPlayerModal('${esc(jid)}','${esc(name)}')" style="flex:1;background:#f5f7fc;border:1px solid #e2e6ef;border-radius:8px;padding:7px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">👤 Veure fitxa</button>
      </div>
    </div>`;
}

function buildClubFavCard(fav, clubMap) {
  const club = clubMap?.get(fav.key);
  const displayName = club?.displayName || fav.displayName;
  const clubId = club?.clubId || fav.clubId;
  const teamCount = club?.teams.length ?? 0;
  return `
    <div draggable="true" ondragstart="favDragStart('club','${esc(fav.key)}')" ondragend="favDragEnd()" ondragover="favDragOver(event)" ondrop="favDrop('club','${esc(fav.key)}')" style="background:#fff;border:1.5px solid #e2e6ef;border-top:4px solid #003da5;border-radius:14px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <div style="display:flex;align-items:center;gap:10px;padding:11px 13px">
        <div title="Arrossega per ordenar" style="color:#cbd5e1;font-size:16px;line-height:1;cursor:grab;user-select:none">⋮⋮</div>
        ${shieldImg(clubId,40)}
        <div style="flex:1;min-width:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:clamp(16px,5vw,20px);font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(displayName)}</div>
          <div style="font-size:11px;color:#6b7a99">${teamCount} equip${teamCount!==1?"s":""}</div>
        </div>
        <button onclick="removeClubFav('${esc(fav.key)}')" style="background:none;border:none;color:#cbd5e1;font-size:16px;cursor:pointer;padding:4px;flex-shrink:0">✕</button>
      </div>
      <div style="display:flex;gap:6px;padding:0 12px 11px">
        <button onclick="selectClub('${esc(fav.key)}')" style="flex:1;background:#f5f7fc;border:1px solid #e2e6ef;border-radius:8px;padding:7px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">🏟 Veure club</button>
      </div>
    </div>`;
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
    <div draggable="true" ondragstart="favDragStart('team','${esc(fav.compId)}::${esc(fav.teamName)}')" ondragend="favDragEnd()" ondragover="favDragOver(event)" ondrop="favDrop('team','${esc(fav.compId)}::${esc(fav.teamName)}')" style="background:#fff;border:1.5px solid #e2e6ef;border-top:4px solid ${catColor};border-radius:14px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <div style="display:flex;align-items:center;gap:10px;padding:11px 13px">
        <div title="Arrossega per ordenar" style="color:#cbd5e1;font-size:16px;line-height:1;cursor:grab;user-select:none">⋮⋮</div>
        ${shieldImg(cid,40)}
        <div style="flex:1;min-width:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:clamp(16px,5vw,20px);font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fav.teamName)}</div>
          <div style="font-size:11px;color:#6b7a99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((comp.name||"").replace(/\s*\(2025-26\)/,""))}</div>
        </div>
        ${myRow?`<div style="background:${posColor(myRow.pos)}18;color:${posColor(myRow.pos)};border:1.5px solid ${posColor(myRow.pos)}44;border-radius:10px;padding:5px 9px;text-align:center;flex-shrink:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900;line-height:1">${myRow.pos}è</div>
          <div style="font-size:9px;margin-top:1px">${myRow.pts} pts</div>
        </div>`:""}
        <button onclick="removeFav('${esc(fav.compId)}','${esc(fav.teamName)}')" style="background:none;border:none;color:#cbd5e1;font-size:16px;cursor:pointer;padding:4px;flex-shrink:0">✕</button>
      </div>
      ${classifHtml}
      <div style="padding:9px 12px">
        ${last?`<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">Últim resultat</div>${matchCard(last,fav.teamName,comp.id)}`:""}
        ${next?`<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;${last?"margin-top:7px":""}">Proper partit</div>${matchCard(next,fav.teamName,comp.id)}`:""}
        ${!last&&!next?`<p style="text-align:center;color:#94a3b8;font-size:13px;padding:2px 0">Sense partits registrats</p>`:""}
      </div>
      <div style="display:flex;gap:6px;padding:0 12px 11px">
        <button onclick="openDetail('${esc(fav.compId)}','${esc(fav.teamName)}','classif')" style="flex:1;background:#f5f7fc;border:1px solid #e2e6ef;border-radius:8px;padding:7px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">📊 Classificació</button>
        <button onclick="openDetail('${esc(fav.compId)}','${esc(fav.teamName)}','calendar')" style="flex:1;background:#f5f7fc;border:1px solid #e2e6ef;border-radius:8px;padding:7px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">📅 Calendari</button>
      </div>
    </div>`;
}

window.removeFav = (compId,teamName) => {
  const key = `${compId}::${teamName}`;
  favs = favs.filter(f=>!(f.compId===compId&&f.teamName===teamName));
  saveFavs();
  _removeFavFromCloud("team", key);
  renderHome();
};

window.removeLevelFav = nodeKey => {
  levelFavs = levelFavs.filter(f=>f.nodeKey!==nodeKey);
  saveLevelFavs();
  _removeFavFromCloud("level", nodeKey);
  renderHome();
};

window.removePlayerFavHome = jid => {
  playerFavs = playerFavs.filter(id=>id!==jid);
  savePlayerFavs();
  _removeFavFromCloud("player", jid);
  renderHome();
};

window.openLevelFav = nodeKey => {
  const fav = levelFavs.find(f=>f.nodeKey===nodeKey);
  if (!fav) return;
  homeTab = "all";
  if (fav.l1Key) allFilterCat = fav.l1Key;
  if (fav.l1Key) allCompsOpenState[`l1:${fav.l1Key}`] = true;
  if (fav.l2Key) allCompsOpenState[`l2:${fav.l1Key}:${fav.l2Key}`] = true;
  if (fav.l3Key) allCompsOpenState[`l3:${fav.l1Key}:${fav.l2Key}:${fav.l3Key}`] = true;
  if (fav.l4Key) allCompsOpenState[`l4:${fav.l1Key}:${fav.l2Key}:${fav.l3Key}:${fav.l4Key}`] = true;
  renderHome();
};

const FAV_CLUBS_KEY = "hoquei_club_favs_v1";
let clubFavs = [];
try { clubFavs = JSON.parse(localStorage.getItem(FAV_CLUBS_KEY)||"[]"); } catch {}
const saveClubFavs = () => localStorage.setItem(FAV_CLUBS_KEY, JSON.stringify(clubFavs));
const isClubFav = key => clubFavs.some(f=>f.key===key);
function toggleClubFav(key, displayName, clubId) {
  if (isClubFav(key)) {
    clubFavs = clubFavs.filter(f=>f.key!==key);
    _removeFavFromCloud("club", key);
  } else {
    clubFavs.push({key, displayName, clubId});
    _syncFavToCloud("club", key, {key,displayName,clubId});
  }
  saveClubFavs();
}
window.removeClubFav = key => {
  clubFavs = clubFavs.filter(f=>f.key!==key);
  saveClubFavs();
  _removeFavFromCloud("club", key);
  renderHome();
};

// ── CLUB TAB ──────────────────────────────────────────────────

function competitionPriority(comp) {
  if (!comp) return 0;
  const name = String(comp.name || "").toUpperCase();
  let score = 0;
  if (/COPA|2\s*ª\s*FASE|2A\s*FASE|RANKING|FASE\s*FINAL/.test(name)) score += 1000;
  if (comp.sidgadParentId) score += 300;
  if (comp.classificationSource === "fecapa") score += 150;
  score += parseInt(comp.id, 10) || 0;
  return score;
}

function teamKeyFromRow(row) {
  if (row?.teamId) return `id:${row.teamId}`;
  return `name:${String(row?.team || "").toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function buildClubMap() {
  const clubMap = new Map(); // normalizedName → { displayName, clubId, teams:[] }
  for (const comps of Object.values(DB.categories)) {
    for (const comp of comps) {
      if (allOnlyActive && !isActive(comp)) continue;
      for (const row of (comp.classification||[])) {
        if (!row.team) continue;
        const clubName = row.team.toLowerCase().replace(/\s+[a-e]$/,"").trim();
        if (!clubMap.has(clubName)) {
          clubMap.set(clubName, { displayName: row.team.replace(/\s+[A-E]$/,"").trim(), clubId: rowClubId(row), teams:[] });
        }
        const club = clubMap.get(clubName);
        if (!club.clubId) club.clubId = rowClubId(row);
        const key = teamKeyFromRow(row);
        const existingIdx = club.teams.findIndex(t => t.teamKey === key);
        const candidate = { compId:comp.id, teamName:row.team, teamId:row.teamId, compName:comp.name, category:getCatForComp(comp), teamKey:key };
        if (existingIdx < 0) {
          club.teams.push(candidate);
        } else {
          const existing = club.teams[existingIdx];
          const keepCandidate = competitionPriority(comp) > competitionPriority(findComp(existing.compId));
          if (keepCandidate) club.teams[existingIdx] = candidate;
        }
      }
    }
  }
  // Merge entries that share the same club logo (same club, different name formats)
  const normId = id => id ? String(id).match(/\d+/)?.[0] : null;
  const byId = new Map();
  for (const [key, club] of clubMap) {
    const id = normId(club.clubId);
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(key);
  }
  for (const keys of byId.values()) {
    if (keys.length <= 1) continue;
    // Canonical = prefer name starting with "club", then longest
    const canonical = [...keys].sort((a,b) => {
      const ac = a.startsWith("club") ? 1 : 0, bc = b.startsWith("club") ? 1 : 0;
      return ac !== bc ? bc - ac : b.length - a.length;
    })[0];
    const main = clubMap.get(canonical);
    for (const key of keys) {
      if (key === canonical) continue;
      for (const t of clubMap.get(key).teams) {
        const existingIdx = main.teams.findIndex(x => x.teamKey === t.teamKey);
        if (existingIdx < 0) {
          main.teams.push(t);
        } else {
          const keepCandidate = competitionPriority(findComp(t.compId)) > competitionPriority(findComp(main.teams[existingIdx].compId));
          if (keepCandidate) main.teams[existingIdx] = t;
        }
      }
      clubMap.delete(key);
    }
  }
  return clubMap;
}

function renderClubTab(cursor) {
  const clubMap = buildClubMap();

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
          oninput="clubSearch=this.value;renderClubTab(this.selectionStart)"/>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#6b7a99;cursor:pointer;white-space:nowrap">
          <input type="checkbox" ${allOnlyActive?"checked":""} onchange="allOnlyActive=this.checked;renderClubTab()" style="width:16px;height:16px;accent-color:#003da5"/>
          Només en curs
        </label>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">
        ${filtered.map(([key,club])=>`
          <div onclick="selectClub('${esc(key)}')" style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:12px 8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;transition:all .15s;text-align:center;position:relative" onmouseover="this.style.borderColor='#003da5';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#e2e6ef';this.style.transform='none'">
            <button onclick="event.stopPropagation();toggleClubFav('${esc(key)}','${esc(club.displayName)}','${esc(club.clubId||"")}');renderClubTab()" style="position:absolute;top:5px;right:5px;background:none;border:none;font-size:15px;cursor:pointer;padding:2px;line-height:1">${isClubFav(key)?"⭐":"☆"}</button>
            ${shieldImg(club.clubId,36)}
            <div style="font-size:12px;font-weight:700;color:#1a2035;line-height:1.2">${esc(club.displayName)}</div>
            <div style="font-size:10px;color:#94a3b8">${club.teams.length} equip${club.teams.length!==1?"s":""}</div>
          </div>`).join("")}
      </div>
      ${!filtered.length?`<p style="text-align:center;padding:32px;color:#94a3b8">Cap club trobat per «${esc(clubSearch)}»</p>`:""}
    </div>`;
  if (cursor !== undefined) {
    const inp = document.getElementById('club-search');
    if (inp) { inp.focus(); inp.setSelectionRange(cursor, cursor); }
  }
}

function getCatForComp(comp) {
  if (!DB) return "Altres";
  for (const [cat,comps] of Object.entries(DB.categories))
    if (comps.some(c=>c.id===comp.id)) return cat;
  return "Altres";
}

window.selectClub = function(key) {
  const entry = buildClubMap().get(key);
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
            <div style="font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(comp.name.replace(/\s*\(2025-26\)/,""))}</div>
          </div>
          ${myRow?`<span style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:900;color:${posColor(myRow.pos)};flex-shrink:0">${myRow.pos}è · ${myRow.pts}pts</span>`:""}
          <button onclick="openDetail('${esc(t.compId)}','${esc(t.teamName)}','classif')" style="background:#f0f4f8;border:1px solid #e2e6ef;color:#003da5;border-radius:7px;padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0">→</button>
        </div>
        <div style="padding:7px 10px">
          ${last?matchCard(last,t.teamName,comp.id):""}
          ${next?matchCard(next,t.teamName,comp.id):`${!last?`<p style="font-size:11px;color:#94a3b8;padding:2px">Sense partits</p>`:""}`}
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
      <button onclick="toggleClubFav('${esc(club.key)}','${esc(club.displayName)}','${esc(club.clubId||"")}');renderClubDashboard()" style="background:${isClubFav(club.key)?"#fef9c3":"#f0f4f8"};border:1px solid ${isClubFav(club.key)?"#fcd34d":"#e2e6ef"};border-radius:8px;padding:6px 10px;font-size:13px;cursor:pointer;flex-shrink:0">${isClubFav(club.key)?"⭐":"☆"}</button>
      <label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#6b7a99;cursor:pointer;flex-shrink:0">
        <input type="checkbox" ${allOnlyActive?"checked":""} onchange="allOnlyActive=this.checked;selectedClub=null;selectClub('${esc(club.key)}')" style="accent-color:#003da5"/>
        En curs
      </label>
    </div>
    ${teamCards||`<p style="text-align:center;padding:32px;color:#94a3b8">Cap equip actiu</p>`}`;
}

// ── ALL COMPS ─────────────────────────────────────────────────
function normalizeCompName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function detectTier(nameNorm) {
  if (/\bOR\b/.test(nameNorm)) return "OR";
  if (/\bPLATA\b/.test(nameNorm)) return "PLATA";
  if (/\bBRONZE\b/.test(nameNorm)) return "BRONZE";
  if (/INICIACIO|INICIACI[OÓ]/.test(nameNorm)) return "INICIACIO";
  return "ALTRES";
}

function detectZone(nameNorm) {
  if (/\bGIRONA\b/.test(nameNorm)) return "Girona";
  if (/\bTARRAGONA\b/.test(nameNorm)) return "Tarragona";
  if (/\bBARCELONA\b|\bBCN\b/.test(nameNorm)) return "Barcelona";
  if (/\bLLEIDA\b/.test(nameNorm)) return "Lleida";
  return "Altres";
}

function detectBenjamiCup(nameNorm) {
  if (/\bCOPA\s*BCN\b/.test(nameNorm)) return "Copa BCN";
  if (/\bCOPA\s*FCP\b/.test(nameNorm)) return "Copa FCP";
  return null;
}

function tierLabel(t) {
  if (t === "OR") return "Or";
  if (t === "PLATA") return "Plata";
  if (t === "BRONZE") return "Bronze";
  if (t === "INICIACIO") return "Iniciació";
  return "Altres";
}

function getCompHierarchy(comp) {
  const n = normalizeCompName(comp?.name);
  const tier = detectTier(n);
  const tierOrder = { OR: 0, PLATA: 1, BRONZE: 2, INICIACIO: 3, ALTRES: 4 };
  const zoneOrder = { Barcelona: 0, Girona: 1, Tarragona: 2, Lleida: 3, Altres: 4 };

  if (/\bNACIONAL\b\s*\bCATAL/.test(n)) {
    return {
      level1: { key: "Nacional Catalana", label: "Nacional Catalana", emoji: "👑", color: "#003da5", order: 10 },
      level2: null,
      level3: null,
      level4: null,
    };
  }
  if (/\b1[ªA]\s*\bCATAL/.test(n) || /\bPRIMERA\b\s*\bCATAL/.test(n)) {
    return {
      level1: { key: "1ª Catalana", label: "1ª Catalana", emoji: "⭐", color: "#1a5dc7", order: 20 },
      level2: null,
      level3: null,
      level4: null,
    };
  }
  if (/\b2[ªA]\s*\bCATAL/.test(n) || /\bSEGONA\b\s*\bCATAL/.test(n)) {
    return {
      level1: { key: "2ª Catalana", label: "2ª Catalana", emoji: "🔵", color: "#2563eb", order: 30 },
      level2: null,
      level3: null,
      level4: null,
    };
  }
  if (/\b3[ªA]\s*\bCATAL/.test(n) || /\bTERCERA\b\s*\bCATAL/.test(n)) {
    return {
      level1: { key: "3ª Catalana", label: "3ª Catalana", emoji: "🟣", color: "#7c3aed", order: 40 },
      level2: null,
      level3: null,
      level4: null,
    };
  }

  if (/\bFEM\b|FEMENI|FEMENINA/.test(n)) {
    return {
      level1: { key: "Fem", label: "Fem", emoji: "♀", color: "#db2777", order: 50 },
      level2: null,
      level3: null,
      level4: null,
    };
  }

  const baseAge = /\bJUNIOR\b/.test(n) ? "Júnior"
    : /\bJUVENIL\b/.test(n) ? "Juvenil"
    : /\bINFANTIL\b/.test(n) ? "Infantil"
    : /\bALEVI\b/.test(n) ? "Aleví"
    : null;

  if (baseAge) {
    const ageOrder = { "Júnior": 100, "Juvenil": 110, "Infantil": 120, "Aleví": 130 };
    return {
      level1: {
        key: baseAge,
        label: baseAge,
        emoji: baseAge === "Júnior" ? "🎯" : baseAge === "Juvenil" ? "⚡" : baseAge === "Infantil" ? "🏆" : "💪",
        color: CAT_COLOR[baseAge] || "#6b7280",
        order: ageOrder[baseAge],
      },
      level2: {
        key: `${baseAge}::${tier}`,
        label: tierLabel(tier),
        order: tierOrder[tier],
      },
      level3: null,
      level4: null,
    };
  }

  const miniAge = /PREBENJAM[IÍ]/.test(n) || /\bPB\b/.test(n) ? "Prebenjamí"
    : /\bBENJAM[IÍ]\b/.test(n) ? "Benjamí"
    : null;

  if (miniAge) {
    const zone = detectZone(n);
    const base = miniAge === "Benjamí" ? 200 : 240;
    const cup = miniAge === "Benjamí" ? detectBenjamiCup(n) : null;
    const cupOrder = { "Copa BCN": 0, "Copa FCP": 1 };
    return {
      level1: {
        key: miniAge,
        label: miniAge,
        emoji: miniAge === "Benjamí" ? "🔥" : "⭐",
        color: CAT_COLOR[miniAge] || "#6b7280",
        order: base,
      },
      level2: {
        key: `${miniAge}::${zone}`,
        label: zone,
        order: zoneOrder[zone],
      },
      level3: {
        key: `${miniAge}::${zone}::${tier}`,
        label: tierLabel(tier),
        order: tierOrder[tier],
      },
      level4: cup ? {
        key: `${miniAge}::${zone}::${tier}::${cup}`,
        label: cup,
        order: cupOrder[cup] ?? 99,
      } : null,
    };
  }

  const fallback = getCatForComp(comp);
  return {
    level1: {
      key: fallback,
      label: fallback,
      emoji: CAT_EMOJI[fallback] || "📋",
      color: CAT_COLOR[fallback] || "#6b7280",
      order: 900,
    },
    level2: null,
    level3: null,
    level4: null,
  };
}

function collectAllCompsFromMeta(meta) {
  const comps = [...(meta.comps || [])];
  for (const [, g2] of (meta.groupsArr || [])) {
    comps.push(...(g2.comps || []));
    for (const [, g3] of (g2.groupsArr || [])) {
      comps.push(...(g3.comps || []));
      for (const [, g4] of (g3.groupsArr || [])) {
        comps.push(...(g4.comps || []));
      }
    }
  }
  return comps;
}

function computeClusterStats(meta) {
  const comps = collectAllCompsFromMeta(meta);
  const teamMap = new Map();
  for (const comp of comps) {
    for (const r of (comp.classification || [])) {
      if (!r.team || !(r.pj > 0)) continue;
      if (!teamMap.has(r.team)) teamMap.set(r.team, { team: r.team, gf: 0, gc: 0, pg: 0, pj: 0 });
      const s = teamMap.get(r.team);
      s.gf += r.gf || 0;
      s.gc += r.gc || 0;
      s.pg += r.pg || 0;
      s.pj += r.pj || 0;
    }
  }
  const teams = [...teamMap.values()].filter(t => t.pj >= 3);
  if (!teams.length) return null;
  return {
    topScorer:   teams.reduce((a, b) => a.gf > b.gf ? a : b),
    topWinner:   teams.reduce((a, b) => a.pg > b.pg ? a : b),
    bestDefense: teams.reduce((a, b) => a.gc < b.gc ? a : b),
  };
}

function renderClusterStats(meta, color) {
  const s = computeClusterStats(meta);
  if (!s) return `<div style="text-align:center;padding:10px;font-size:12px;color:#94a3b8">Sense dades suficients per calcular estadístiques</div>`;
  const card = (emoji, title, team, value, vc) => `
    <div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:9px 5px 8px;text-align:center;min-width:0;overflow:hidden">
      <div style="font-size:17px;line-height:1">${emoji}</div>
      <div style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;margin:3px 0 2px;white-space:nowrap">${title}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;color:#1a2035;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 3px">${esc(team)}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;color:${vc};margin-top:2px">${value}</div>
    </div>`;
  return `
    <div style="margin-top:10px;padding:10px 12px 12px;background:${color}0a;border:1.5px solid ${color}28;border-radius:12px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">📊 Rànquing global del grup</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
        ${card("⚽", "Més golejador",   s.topScorer.team,   s.topScorer.gf  +" GF", "#16a34a")}
        ${card("🏆", "Més victòries",   s.topWinner.team,   s.topWinner.pg  +" V",  "#003da5")}
        ${card("🛡️", "Menys gols enc.", s.bestDefense.team, s.bestDefense.gc+" GC", "#e5001c")}
      </div>
    </div>`;
}

function renderConsolidatedClassif(subMeta, color) {
  const comps = collectAllCompsFromMeta(subMeta)
    .filter(c => !allOnlyActive || isActive(c))
    .filter(c => (c.classification||[]).some(r => r.team && r.pts != null));
  if (!comps.length) return "";
  const topTeams = [];
  for (const comp of comps) {
    const cl = (comp.classification||[]).filter(r => r.team && r.pts != null);
    const sorted = [...cl].sort((a,b) => (a.pos||999)-(b.pos||999) || (b.pts||0)-(a.pts||0));
    for (const r of sorted.slice(0,3)) {
      const avg = (r.gf || 0) - (r.gc || 0);
      topTeams.push({ team:r.team, pts:r.pts||0, pj:r.pj||0, gf:r.gf||0, gc:r.gc||0, avg,
        compName: comp.name.replace(/\s*\(\d{4}-\d{2}\)/,"") });
    }
  }
  if (!topTeams.length) return "";
  topTeams.sort((a,b) => b.pts - a.pts || b.avg - a.avg);
  const posIcon = i => i===0?"🥇":i===1?"🥈":i===2?"🥉":
    `<span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:#6b7a99">${i+1}</span>`;
  return `
    <div style="margin-top:8px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px">📋 Classificació consolidada · top 3 per lliga</div>
      <div style="background:#fff;border-radius:11px;overflow:hidden;border:1.5px solid #e2e6ef">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f8fafc">
            ${["#","Equip","PJ","Pts","Avg"].map((h,i)=>`<th style="padding:5px ${i<2?5:3}px;font-size:9px;font-weight:700;color:${i===3?color:"#94a3b8"};text-transform:uppercase;text-align:${i===1?"left":"center"};border-bottom:1px solid #e2e6ef">${h}</th>`).join("")}
          </tr></thead>
          <tbody>${topTeams.map((t,i)=>`
            <tr style="border-bottom:1px solid #f0f2f8">
              <td style="padding:6px 3px;text-align:center;font-size:12px">${posIcon(i)}</td>
              <td style="padding:6px 5px">
                <div style="font-size:12px;font-weight:700;color:#1a2035;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">${esc(t.team)}</div>
                <div style="font-size:9px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">${esc(t.compName)}</div>
              </td>
              <td style="padding:6px 3px;text-align:center;font-size:11px;color:#94a3b8">${t.pj}</td>
              <td style="padding:6px 3px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;color:${color}">${t.pts}</td>
              <td style="padding:6px 3px;text-align:center;font-size:11px;font-weight:600;color:${t.avg>0?"#16a34a":t.avg<0?"#dc2626":"#6b7a99"}">${t.avg>0?"+":""}${t.avg}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

function buildCompsHierarchy() {
  const allComps = [];
  const seen = new Set();
  for (const comps of Object.values(DB.categories || {})) {
    for (const comp of comps) {
      if (!comp?.id || seen.has(comp.id)) continue;
      seen.add(comp.id);
      allComps.push(comp);
    }
  }

  const root = new Map();
  for (const comp of allComps) {
    const meta = getCompHierarchy(comp);
    const l1 = meta.level1;
    const l2 = meta.level2;
    const l3 = meta.level3;
    const l4 = meta.level4;

    if (!root.has(l1.key)) {
      root.set(l1.key, { ...l1, groups: new Map(), comps: [] });
    }
    const g1 = root.get(l1.key);

    if (!l2) {
      g1.comps.push(comp);
      continue;
    }

    if (!g1.groups.has(l2.key)) {
      g1.groups.set(l2.key, { ...l2, groups: new Map(), comps: [] });
    }
    const g2 = g1.groups.get(l2.key);

    if (!l3) {
      g2.comps.push(comp);
      continue;
    }

    if (!g2.groups.has(l3.key)) {
      g2.groups.set(l3.key, { ...l3, groups: new Map(), comps: [] });
    }
    const g3 = g2.groups.get(l3.key);

    if (!l4) {
      g3.comps.push(comp);
      continue;
    }

    if (!g3.groups.has(l4.key)) {
      g3.groups.set(l4.key, { ...l4, comps: [] });
    }
    g3.groups.get(l4.key).comps.push(comp);
  }

  const sortComps = list => list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  const sortMapEntries = map => [...map.entries()].sort((a, b) => (a[1].order - b[1].order) || a[1].label.localeCompare(b[1].label));

  const level1 = sortMapEntries(root).map(([key, g1]) => {
    sortComps(g1.comps);
    const level2 = sortMapEntries(g1.groups).map(([k2, g2]) => {
      sortComps(g2.comps);
      const level3 = sortMapEntries(g2.groups).map(([k3, g3]) => {
        sortComps(g3.comps);
        const level4 = sortMapEntries(g3.groups || new Map()).map(([k4, g4]) => {
          sortComps(g4.comps);
          return [k4, g4];
        });
        return [k3, { ...g3, groupsArr: level4 }];
      });
      return [k2, { ...g2, groupsArr: level3 }];
    });
    return [key, { ...g1, groupsArr: level2 }];
  });

  return level1;
}

function renderAllComps(cursor) {
  const hierarchy = buildCompsHierarchy();
  const topKeys = hierarchy.map(([k]) => k);
  if (allFilterCat !== "ALL" && !topKeys.includes(allFilterCat)) allFilterCat = "ALL";
  const allCats=["ALL",...topKeys];

  const filterComps = comps => comps.filter(c => {
    if (allOnlyActive && !isActive(c)) return false;
    if (!allSearch) return true;
    const q = allSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.classification || []).some(r => r.team && r.team.toLowerCase().includes(q));
  });

  const computeCount = node => {
    let total = filterComps(node.comps || []).length;
    for (const [, g2] of (node.groupsArr || [])) {
      total += filterComps(g2.comps || []).length;
      for (const [, g3] of (g2.groupsArr || [])) {
        total += filterComps(g3.comps || []).length;
        for (const [, g4] of (g3.groupsArr || [])) total += filterComps(g4.comps || []).length;
      }
    }
    return total;
  };

  const renderCompCard = (comp, color) => `
    <div onclick="openDetail('${comp.id}')" style="background:#fff;border:1.5px solid #e2e6ef;border-radius:11px;margin-bottom:6px;overflow:hidden;cursor:pointer;box-shadow:0 1px 3px rgba(0,30,80,.04)" onmouseover="this.style.borderColor='${color}';this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='#e2e6ef';this.style.transform='none'">
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
    </div>`;

  const isNodeOpen = (nodeKey, defaultOpen) => {
    if (Object.prototype.hasOwnProperty.call(allCompsOpenState, nodeKey)) return !!allCompsOpenState[nodeKey];
    return !!defaultOpen;
  };
  window.toggleCompsNode = nodeKey => {
    allCompsOpenState[nodeKey] = !isNodeOpen(nodeKey, false);
    renderAllComps();
  };
  window.toggleClusterStats = (l1Key, l2Keys) => {
    const statsKey = `stats:${l1Key}`;
    const opening = !isNodeOpen(statsKey, false);
    allCompsOpenState[statsKey] = opening;
    if (opening) {
      allCompsOpenState[`l1:${l1Key}`] = true;
      (l2Keys || []).forEach(k => { allCompsOpenState[`l2:${l1Key}:${k}`] = true; });
    }
    renderAllComps();
  };
  window.toggleSubgroupStats = (statsKey, nodeKey) => {
    const opening = !isNodeOpen(statsKey, false);
    allCompsOpenState[statsKey] = opening;
    if (opening) allCompsOpenState[nodeKey] = true;
    renderAllComps();
  };
  window.toggleLevelFavNode = (nodeKey, l1Key, l2Key, l3Key, l4Key, labelText, pathLabel, nodeColor, nodeEmoji) => {
    toggleLevelFav({
      nodeKey,
      l1Key: l1Key || null,
      l2Key: l2Key || null,
      l3Key: l3Key || null,
      l4Key: l4Key || null,
      label: labelText,
      pathLabel,
      color: nodeColor,
      emoji: nodeEmoji || "🧩",
    });
    renderAllComps();
  };

  const catMetas = allCats.map(key => {
    const active = allFilterCat === key;
    if (key === "ALL") {
      const count = hierarchy.reduce((acc, [,n]) => acc + computeCount(n), 0);
      return { key, active, label: "Totes", emoji: "🏒", count, color: "#1a2035" };
    }
    const item = hierarchy.find(([k]) => k === key);
    if (!item) return null;
    return { key, active, label: item[1].label, emoji: item[1].emoji || "📋", count: computeCount(item[1]), color: item[1].color || "#6b7280" };
  }).filter(Boolean);

  const filterBar=`
    <div style="background:#fff;border-bottom:1px solid #e2e6ef;padding:10px 14px 8px">
      <div style="max-width:720px;margin:0 auto">
        <button onclick="allFilterCat='ALL';renderAllComps()" style="width:100%;margin-bottom:8px;background:${allFilterCat==="ALL"?"#1a2035":"#f0f4f8"};color:${allFilterCat==="ALL"?"#fff":"#475569"};border:1.5px solid ${allFilterCat==="ALL"?"#1a2035":"#e2e6ef"};border-radius:10px;padding:9px 12px;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;display:flex;justify-content:space-between;align-items:center">
          <span>🏒 Totes les competicions</span>
          <span style="font-size:11px;opacity:.7;font-weight:600">${hierarchy.reduce((acc,[,n])=>acc+computeCount(n),0)}</span>
        </button>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
          ${catMetas.filter(m=>m.key!=="ALL").map(m=>{
            const bg = m.active ? m.color : "#f8fafc";
            const fg = m.active ? "#fff" : "#334155";
            const bd = m.active ? m.color : "#e2e6ef";
            return `<button onclick="allFilterCat='${esc(m.key)}';renderAllComps()" style="background:${bg};color:${fg};border:1.5px solid ${bd};border-radius:9px;padding:4px 2px 3px;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-align:center;line-height:1.2;overflow:hidden">
              <div style="font-size:12px;line-height:1.1">${m.emoji}</div>
              <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 2px;font-size:10px">${esc(m.label)}</div>
              <div style="font-size:9px;opacity:.7;font-weight:600">${m.count}</div>
            </button>`;
          }).join("")}
        </div>
      </div>
    </div>
    <div style="padding:8px 14px 4px;max-width:720px;margin:0 auto;display:flex;gap:8px;align-items:center">
      <input id="all-search" placeholder="🔍 Cerca equip o competició..." value="${esc(allSearch)}"
        style="flex:1;background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:9px 13px;font-size:14px;color:#1a2035;outline:none"
        oninput="allSearch=this.value;renderAllComps(this.selectionStart)"/>
      <label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#6b7a99;cursor:pointer;white-space:nowrap">
        <input type="checkbox" ${allOnlyActive?"checked":""} onchange="allOnlyActive=this.checked;renderAllComps()" style="accent-color:#003da5"/>
        En curs
      </label>
    </div>`;

  const visibleTop = allFilterCat === "ALL"
    ? hierarchy
    : hierarchy.filter(([key]) => key === allFilterCat);

  const compsHtml=visibleTop.map(([,meta])=>{
    const color = meta.color || "#666";
    const emoji = meta.emoji || "📋";
    const label = meta.label || "Altres";
    const key1 = `l1:${meta.key}`;
    const open1 = isNodeOpen(key1, true);
    const topLeafComps = filterComps(meta.comps || []);
    const level2 = (meta.groupsArr || []).map(([,g2]) => {
      const key2 = `l2:${meta.key}:${g2.key}`;
      const open2 = isNodeOpen(key2, false);
      const level2LeafComps = filterComps(g2.comps || []);
      const level3 = (g2.groupsArr || []).map(([,g3]) => {
        const key3 = `l3:${meta.key}:${g2.key}:${g3.key}`;
        const statsKey3 = `stats:${key3}`;
        const open3 = isNodeOpen(key3, false);
        const statsOpen3 = isNodeOpen(statsKey3, false);
        const isMiniCat = ["Benjamí", "Prebenjamí"].includes(meta.key);
        const isBenjami = meta.key === "Benjamí";
        const comps3 = filterComps(g3.comps || []);
        const level4 = (g3.groupsArr || []).map(([,g4]) => {
          const key4 = `l4:${meta.key}:${g2.key}:${g3.key}:${g4.key}`;
          const statsKey4 = `stats:${key4}`;
          const open4 = isNodeOpen(key4, false);
          const statsOpen4 = isNodeOpen(statsKey4, false);
          const fav4 = isLevelFav(key4);
          const comps4 = filterComps(g4.comps || []);
          if (!comps4.length && !statsOpen4) return "";
          return `
            <div style="margin-top:7px;padding-left:14px;border-left:2px dashed ${color}33">
              <div style="display:flex;gap:4px;align-items:stretch;margin-bottom:6px">
                <button onclick="toggleCompsNode('${esc(key4)}')" style="flex:1;min-width:0;text-align:left;background:#fff;border:1px solid #e2e6ef;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:11px;font-weight:700;color:#475569;display:flex;align-items:center;justify-content:space-between;gap:6px">
                  <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g4.label} <span style="font-size:10px;color:#94a3b8">(${comps4.length})</span></span>
                  <span style="color:#94a3b8;flex-shrink:0">${open4 ? '▾' : '▸'}</span>
                </button>
                <button onclick="toggleLevelFavNode('${esc(key4)}','${esc(meta.key)}','${esc(g2.key)}','${esc(g3.key)}','${esc(g4.key)}','${esc(g4.label)}','${esc(meta.label + ' › ' + g2.label + ' › ' + g3.label + ' › ' + g4.label)}','${esc(color)}','🏆')" style="background:${fav4?'#fef9c3':'#f0f4f8'};color:${fav4?'#a16207':'#6b7a99'};border:1.5px solid ${fav4?'#fcd34d':'#e2e6ef'};border-radius:8px;padding:6px 9px;cursor:pointer;font-size:13px;flex-shrink:0" title="Favorit de nivell">${fav4?'★':'☆'}</button>
                <button data-sk="${esc(statsKey4)}" data-nk="${esc(key4)}" onclick="toggleSubgroupStats(this.dataset.sk,this.dataset.nk)" style="background:${statsOpen4?color:'#f0f4f8'};color:${statsOpen4?'#fff':'#6b7a99'};border:1.5px solid ${statsOpen4?color:'#e2e6ef'};border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px;flex-shrink:0" title="Estadístiques del subgrup">📊</button>
              </div>
              ${open4 ? comps4.map(c=>renderCompCard(c, color)).join("") : ""}
              ${statsOpen4 ? renderClusterStats(g4, color) : ""}
              ${statsOpen4 ? renderConsolidatedClassif(g4, color) : ""}
            </div>`;
        }).join("");
        const fav3 = isLevelFav(key3);
        const count3 = comps3.length + (g3.groupsArr||[]).reduce((a,[,x]) => a + filterComps(x.comps||[]).length, 0);
        if (!comps3.length && !level4 && !statsOpen3) return "";
        return `
          <div style="margin-top:8px;padding-left:18px;border-left:2px solid #e2e6ef">
            <div style="display:flex;gap:4px;align-items:stretch;margin-bottom:6px">
              <button onclick="toggleCompsNode('${esc(key3)}')" style="flex:1;min-width:0;text-align:left;background:#f8fafc;border:1px solid #e2e6ef;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:12px;font-weight:700;color:#475569;display:flex;align-items:center;justify-content:space-between;gap:6px">
                <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g3.label} <span style="font-size:10px;color:#94a3b8">(${count3})</span></span>
                <span style="color:#94a3b8;flex-shrink:0">${open3 ? '▾' : '▸'}</span>
              </button>
              <button onclick="toggleLevelFavNode('${esc(key3)}','${esc(meta.key)}','${esc(g2.key)}','${esc(g3.key)}','','${esc(g3.label)}','${esc(meta.label + ' › ' + g2.label + ' › ' + g3.label)}','${esc(color)}','🥉')" style="background:${fav3?'#fef9c3':'#f0f4f8'};color:${fav3?'#a16207':'#6b7a99'};border:1.5px solid ${fav3?'#fcd34d':'#e2e6ef'};border-radius:8px;padding:6px 9px;cursor:pointer;font-size:13px;flex-shrink:0" title="Favorit de nivell">${fav3?'★':'☆'}</button>
              ${isMiniCat && !isBenjami ? `<button data-sk="${esc(statsKey3)}" data-nk="${esc(key3)}" onclick="toggleSubgroupStats(this.dataset.sk,this.dataset.nk)" style="background:${statsOpen3?color:'#f0f4f8'};color:${statsOpen3?'#fff':'#6b7a99'};border:1.5px solid ${statsOpen3?color:'#e2e6ef'};border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px;flex-shrink:0" title="Estadístiques del subgrup">📊</button>` : ""}
            </div>
            ${open3 ? comps3.map(c=>renderCompCard(c, color)).join("") : ""}
            ${open3 ? level4 : ""}
            ${statsOpen3 && !isBenjami ? renderClusterStats(g3, color) : ""}
            ${statsOpen3 && !isBenjami ? renderConsolidatedClassif(g3, color) : ""}
          </div>`;
      }).join("");
      const isAgeCat = ["Júnior","Juvenil","Infantil","Aleví"].includes(meta.key);
      const fav2 = isLevelFav(key2);
      const statsKey2 = `stats:${key2}`;
      const statsOpen2 = isNodeOpen(statsKey2, false);
      const l2Count = level2LeafComps.length + (g2.groupsArr||[]).reduce((a,[,x])=>a+filterComps(x.comps||[]).length + (x.groupsArr||[]).reduce((aa,[,y])=>aa+filterComps(y.comps||[]).length,0),0);
      if (!level2LeafComps.length && !level3 && !statsOpen2) return "";
      return `
        <div style="margin-top:10px;padding-left:12px;border-left:3px solid ${color}33">
          <div style="display:flex;gap:4px;align-items:stretch;margin-bottom:6px">
            <button onclick="toggleCompsNode('${esc(key2)}')" style="flex:1;min-width:0;text-align:left;background:${color}14;border:1px solid ${color}33;border-radius:8px;padding:7px 9px;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;color:${color};display:flex;align-items:center;justify-content:space-between;gap:6px">
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g2.label} <span style="font-size:10px;color:#6b7a99;font-weight:600">(${l2Count})</span></span>
              <span style="color:${color};flex-shrink:0">${open2 ? '▾' : '▸'}</span>
            </button>
            <button onclick="toggleLevelFavNode('${esc(key2)}','${esc(meta.key)}','${esc(g2.key)}','','','${esc(g2.label)}','${esc(meta.label + ' › ' + g2.label)}','${esc(color)}','🥈')" style="background:${fav2?'#fef9c3':'#f0f4f8'};color:${fav2?'#a16207':'#6b7a99'};border:1.5px solid ${fav2?'#fcd34d':'#e2e6ef'};border-radius:8px;padding:7px 9px;cursor:pointer;font-size:14px;flex-shrink:0" title="Favorit de nivell">${fav2?'★':'☆'}</button>
            ${isAgeCat ? `<button data-sk="${esc(statsKey2)}" data-nk="${esc(key2)}" onclick="toggleSubgroupStats(this.dataset.sk,this.dataset.nk)" style="background:${statsOpen2?color:'#f0f4f8'};color:${statsOpen2?'#fff':'#6b7a99'};border:1.5px solid ${statsOpen2?color:'#e2e6ef'};border-radius:8px;padding:7px 10px;cursor:pointer;font-size:14px;flex-shrink:0" title="Rànquing del grup">📊</button>` : ""}
          </div>
          ${open2 ? level2LeafComps.map(c=>renderCompCard(c, color)).join("") : ""}
          ${open2 ? level3 : ""}
          ${statsOpen2 ? renderClusterStats(g2, color) : ""}
          ${statsOpen2 ? renderConsolidatedClassif(g2, color) : ""}
        </div>`;
    }).join("");

    const isAgeCatL1 = ["Júnior","Juvenil","Infantil","Aleví"].includes(meta.key);
    const isMiniCatL1 = ["Benjamí", "Prebenjamí"].includes(meta.key);
    const showL1Stats = !isAgeCatL1 && !isMiniCatL1;
    const statsKey1 = `stats:${meta.key}`;
    const fav1 = isLevelFav(key1);
    const statsOpen1 = isNodeOpen(statsKey1, false);
    const l2Keys1 = (meta.groupsArr||[]).map(([,g2])=>g2.key);
    if (!topLeafComps.length && !level2 && !statsOpen1) return "";

    return `
      <div style="margin-bottom:20px">
        <div style="padding:0 14px">
          <div style="display:flex;gap:5px;align-items:stretch">
            <button onclick="toggleCompsNode('${esc(key1)}')" style="flex:1;min-width:0;text-align:left;background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:9px 11px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px">
              <span style="display:flex;align-items:center;gap:7px;min-width:0">
                <span style="font-size:15px">${emoji}</span>
                <span style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:800;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</span>
                <span style="font-size:11px;font-weight:700;color:#94a3b8;background:#e8ecf4;border-radius:10px;padding:1px 7px">${computeCount(meta)}</span>
              </span>
              <span style="color:#94a3b8">${open1 ? '▾' : '▸'}</span>
            </button>
            <button onclick="toggleLevelFavNode('${esc(key1)}','${esc(meta.key)}','','','','${esc(label)}','${esc(label)}','${esc(color)}','${esc(emoji)}')" style="background:${fav1?'#fef9c3':'#f0f4f8'};color:${fav1?'#a16207':'#6b7a99'};border:1.5px solid ${fav1?'#fcd34d':'#e2e6ef'};border-radius:10px;padding:9px 11px;cursor:pointer;font-size:15px;flex-shrink:0" title="Favorit de nivell">${fav1?'★':'☆'}</button>
            ${showL1Stats ? `<button data-l1key="${esc(meta.key)}" data-l2keys="${esc(JSON.stringify(l2Keys1))}" onclick="toggleClusterStats(this.dataset.l1key, JSON.parse(this.dataset.l2keys))" style="background:${statsOpen1?color:'#f0f4f8'};color:${statsOpen1?'#fff':'#6b7a99'};border:1.5px solid ${statsOpen1?color:'#e2e6ef'};border-radius:10px;padding:9px 12px;cursor:pointer;font-size:15px;flex-shrink:0" title="Rànquing global del grup">📊</button>` : ""}
          </div>
          ${open1 ? `<div style="margin-top:8px">${topLeafComps.map(c=>renderCompCard(c, color)).join("")}${level2}</div>` : ""}
          ${statsOpen1 && showL1Stats ? renderClusterStats(meta, color) : ""}
        </div>
      </div>`;
  }).filter(Boolean).join("");

  $("home-body").innerHTML=filterBar+`<div style="max-width:720px;margin:0 auto;padding-bottom:24px">${
    compsHtml?compsHtml:`<div style="text-align:center;padding:40px;color:#94a3b8">Cap competició${allOnlyActive?" en curs":""} trobada</div>`
  }</div>`;
  if (cursor !== undefined) {
    const inp = document.getElementById('all-search');
    if (inp) { inp.focus(); inp.setSelectionRange(cursor, cursor); }
  }
}

// ── PICKER ────────────────────────────────────────────────────
function openPicker() {
  $("screen-home").style.display="none"; $("screen-detail").style.display="none";
  $("screen-picker").style.display="flex"; renderPicker();
}
window.openPicker=openPicker;

function renderPicker() {
  const catNames=Object.entries(DB.categories).filter(([,v])=>v.length>0).map(([k])=>k);
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

window.onPickCat=function(){
  const cat=$("pick-cat").value;
  $("pick-comp-wrap").style.display=cat?"block":"none";
  $("pick-team-wrap").style.display="none"; $("pick-add-wrap").style.display="none";
  if (!cat) return;
  const comps=(DB.categories[cat]||[]).filter(c=>!allOnlyActive||isActive(c));
  $("pick-comp").innerHTML=`<option value="">— Selecciona la competició —</option>`+
    comps.map(c=>`<option value="${esc(c.id)}">${esc(c.name.replace(/\s*\(2025-26\)/,""))}</option>`).join("");
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
  $("detail-comp-name").textContent=detailComp.name.replace(/\s*\(2025-26\)/,"");
  const srcLabel = detailComp.classificationSource === "fecapa" ? " · FECAPA" : (detailComp.classificationSource === "jok" ? " · jok.cat" : "");
  const status = (detailComp.pctPlayed == null || detailComp.pctPlayed === 0) ? "No començada" : (detailComp.pctPlayed >= 100 ? "Finalitzada" : "En curs");
  const statusColor = detailComp.pctPlayed >= 100 ? "#6b7a99" : (detailComp.pctPlayed == 0 ? "#94a3b8" : "#e5001c");
  const eqLabel = (detailComp.classification||[]).length; 
  $("detail-meta").innerHTML=`<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <span>${eqLabel} equip${eqLabel!==1?"s":""}</span>
    <span style="color:${statusColor};font-weight:700">${status} · ${detailComp.pctPlayed??"?"}%</span>
    <span style="opacity:.7">${srcLabel}</span>
  </div>`;
  document.querySelectorAll(".detail-tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===detailTab));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===`panel-${detailTab}`));
  renderDetailClassif(); renderDetailCalendar(); renderDetailJugadors();
  window.scrollTo(0,0);
}
window.openDetail=openDetail;

// ── Fitxa de jugador (bottom sheet) ──────────────────────────
async function openPlayerModal(jid, fallbackName) {
  await enrichPlayerOnDemand(jid);
  const player = DB?.jugadors?.[jid];
  const slug   = player?.slug ? decodeURIComponent(player.slug.replace(/\+/g," ")) : null;
  const name   = (slug ? slug.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : null)
               || fallbackName
               || "Jugador";

  // Team i categoria del teamStats principal
  const fixedTeamStats = normalizePlayerTeamStatsForDisplay(player);
  const firstTeam  = fixedTeamStats?.[0];
  const teamSuffix = firstTeam ? `, ${firstTeam.team}` : "";
  const catSuffix  = firstTeam ? `, ${CAT_LABELS[firstTeam.cat] || firstTeam.cat || ""}` : "";
  const url    = player?.url || `https://jok.cat/jugador/${jid}`;

  // ── Dades bàsiques ───────────────────────────────────────────
  const numberSuffix = player?.number != null
    ? `, Número: ${player.number}`
    : "";

  // Edat calculada de birthDate (DD/MM/YYYY o YYYY-MM-DD)
  let ageSuffix = "", birthDateStr = "";
  if (player?.birthDate) {
    const p = player.birthDate.split(/[\/\-]/);
    const dob = p[0].length === 4
      ? new Date(`${p[0]}-${p[1]}-${p[2]}`)
      : new Date(`${p[2]}-${p[1]}-${p[0]}`);
    if (!isNaN(dob)) {
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear()
        - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
      ageSuffix = `, ${age} anys`;
      birthDateStr = player.birthDate;
    }
  }

  // Chips: data de naixement + posició (sempre si coneguda)
  const metaChips = [];
  if (birthDateStr) metaChips.push(
    `<span style="display:inline-flex;align-items:center;gap:3px;background:#f0f4f8;color:#475569;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">📅 ${birthDateStr}</span>`
  );
  if (player?.isGK === true) metaChips.push(
    `<span style="display:inline-flex;align-items:center;gap:3px;background:#dbeafe;color:#1d4ed8;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700">🥅 Porter</span>`
  );
  else if (player?.isGK === false) metaChips.push(
    `<span style="display:inline-flex;align-items:center;gap:3px;background:#f0fdf4;color:#15803d;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700">⛸️ Jugador</span>`
  );
  const metaRow = metaChips.length
    ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px">${metaChips.join("")}</div>`
    : "";

  // ── Estadístiques de temporada ────────────────────────────────
  const cs      = [...(player?.careerStats || [])].sort((a, b) => b.seasonName.localeCompare(a.seasonName));
  const current = cs[0];
  const history = cs.slice(1);

  const statBox = (val, lbl, color) =>
    `<div class="pm-stat"><div class="pm-stat-val" style="color:${color}">${val ?? "–"}</div><div class="pm-stat-lbl">${lbl}</div></div>`;

  // ── Equips (teamStats del scraper) ────────────────────────────
  const teamStats = fixedTeamStats || [];

  // Fallback: categories des de sources si no hi ha teamStats
  const catCounts = {};
  if (!teamStats.length) {
    for (const src of (player?.sources || [])) {
      const cat = DB?.actesIndex?.[src.id];
      if (cat) catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
  }
  const catEntries = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

  // Secció principal: equips amb barra visual
  const displayRows = teamStats.length
    ? teamStats.map(t => ({ label: esc(t.team), sublabel: esc(CAT_LABELS[t.cat] || t.cat || ""), count: t.count }))
    : catEntries.map(([cat, cnt]) => ({ label: esc(CAT_LABELS[cat] || cat), sublabel: "", count: cnt }));
  const maxCount = displayRows[0]?.count || 1;

  const breakdownSection = displayRows.length ? `
    <div class="pm-section-title" style="margin-top:${current?"12px":"0"}">${teamStats.length ? "Equips" : "Categories"}</div>
    ${displayRows.map(r => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.label}</div>
          ${r.sublabel ? `<div style="font-size:10px;color:#94a3b8">${r.sublabel}</div>` : ""}
        </div>
        <div style="width:60px;height:7px;background:#f0f4f8;border-radius:4px;overflow:hidden;flex-shrink:0">
          <div style="width:${Math.round(r.count/maxCount*100)}%;height:100%;background:#003da5;border-radius:4px"></div>
        </div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:#003da5;width:24px;text-align:right;flex-shrink:0">${r.count}</div>
      </div>`).join("")}` : "";

  const currentSection = current ? `
    <div class="pm-section">
      <div class="pm-section-title">Temporada ${esc(current.seasonName)}</div>
      <div style="display:flex;background:#f8fafc;border-radius:12px">
        ${statBox(current.match_count, "Partits",   "#1a2035")}
        ${statBox(current.total_goals, "Gols",      "#e5001c")}
        ${statBox(current.total_blue || "·", "Blaves",    "#2563eb")}
        ${statBox(current.total_red  || "·", "Vermelles", "#dc2626")}
      </div>
      ${breakdownSection}
    </div>` : (breakdownSection ? `<div class="pm-section">${breakdownSection}</div>` : "");

  const historySection = history.length ? `
    <div class="pm-section">
      <div class="pm-section-title">Temporades anteriors</div>
      ${history.map(s => `
        <div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid #f8fafc">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:#1a2035;width:68px">${esc(s.seasonName)}</div>
          <div style="flex:1;display:flex;gap:14px;flex-wrap:wrap">
            <span style="font-size:13px;color:#6b7a99"><b style="color:#1a2035">${s.match_count}</b> P</span>
            <span style="font-size:13px;color:#6b7a99"><b style="color:#e5001c">${s.total_goals}</b> G</span>
            ${s.total_blue ? `<span style="font-size:13px;color:#6b7a99"><b style="color:#2563eb">${s.total_blue}</b> B</span>` : ""}
            ${s.total_red  ? `<span style="font-size:13px;color:#6b7a99"><b style="color:#dc2626">${s.total_red}</b> R</span>` : ""}
          </div>
        </div>`).join("")}
    </div>` : "";

  const noDataHtml = !current && !displayRows.length ? `
    <div class="pm-section" style="color:#94a3b8;font-size:13px;text-align:center;padding:24px 16px">
      Dades detallades no disponibles encara.<br/>Les estadístiques es carreguen progressivament.
    </div>` : "";

  $("player-modal-body").innerHTML = `
    <div style="display:flex;justify-content:center;padding:12px 0 2px">
      <div style="width:38px;height:4px;background:#e2e6ef;border-radius:2px"></div>
    </div>
    <div style="padding:12px 16px 14px;display:flex;justify-content:space-between;align-items:flex-start">
      <div style="flex:1;min-width:0">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#1a2035;line-height:1.15">${esc(name)}${teamSuffix}${catSuffix}${numberSuffix}${ageSuffix}</div>
        ${metaRow}
      </div>
      <button onclick="closePlayerModal()" style="background:#f0f4f8;border:none;border-radius:10px;width:34px;height:34px;font-size:17px;cursor:pointer;flex-shrink:0;margin-left:8px;display:flex;align-items:center;justify-content:center">✕</button>
    </div>
    ${currentSection}
    ${historySection}
    ${noDataHtml}
    <div class="pm-section">
      <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#003da5;text-decoration:none">🔗 Veure perfil a jok.cat →</a>
    </div>
    <div style="height:env(safe-area-inset-bottom,0px)"></div>`;

  $("player-modal").classList.add("pm-open");
  $("player-modal-bd").style.display = "block";
  currentJugadorId = jid;
}

function closePlayerModal() {
  $("player-modal").classList.remove("pm-open");
  $("player-modal-bd").style.display = "none";
  currentJugadorId = null;
}
window.closePlayerModal = closePlayerModal;

function setupListeners(){
  const bb=$("back-btn");
  if(bb) bb.addEventListener("click",()=>{ $("screen-detail").style.display="none"; renderHome(); });
  const ab=$("acta-back-btn");
  if(ab) ab.addEventListener("click",()=>{
    $("screen-acta").style.display="none";
    // Return to detail if it was open, otherwise home
    if (detailComp) { $("screen-detail").style.display="flex"; window.scrollTo(0,0); }
    else renderHome();
  });
  // Delegació de clics als noms de jugadors (qualsevol pantalla)
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-jid]");
    if (btn) openPlayerModal(btn.dataset.jid, btn.textContent.trim());
  });
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
  const sourceBadge = classifSourceBadgeHtml(detailComp);
  if (!cl.length){ $("panel-classif").innerHTML=`<div style="text-align:center;padding:32px;color:#94a3b8">Classificació no disponible.<br/><a href="https://jok.cat/competicio/${detailComp.id}" target="_blank">jok.cat →</a></div>`; return; }
  $("panel-classif").innerHTML=`
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">${sourceBadge}</div>
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
      ${ms.map(m=>matchCard(m,detailTeam,detailComp.id)).join("")}
    </div>`).join("");
}
window.setCalTeam=t=>{ detailTeam=t; renderDetailClassif(); renderDetailCalendar(); renderDetailJugadors(); };

function getCatSlugForComp(comp) {
  const toSlug = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
  for (const [catName, comps] of Object.entries(DB.categories||{}))
    if (comps.some(c=>c.id===comp.id)) return toSlug(catName);
  return null;
}

async function renderDetailJugadors(){
  const catSlug = getCatSlugForComp(detailComp);

  // Noms d'equip del calendari per als filtres
  const calNames = [...new Set([
    ...(detailComp.calendar||[]).map(m=>m.home),
    ...(detailComp.calendar||[]).map(m=>m.away)
  ].filter(Boolean))].sort();

  const chips = calNames.length ? `<div style="margin-bottom:10px">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Filtrar per equip</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      <button onclick="setJugadorsTeam(null)" style="background:${!detailTeam?"#1a2035":"#f0f4f8"};border:1.5px solid ${!detailTeam?"#1a2035":"#e2e6ef"};border-radius:16px;padding:4px 11px;font-size:12px;font-weight:600;color:${!detailTeam?"#fff":"#334155"};cursor:pointer">Tots</button>
      ${calNames.map(t=>{const act=teamIn(t,detailTeam),cid=getClubId(t);return`<button onclick="setJugadorsTeam('${esc(t)}')" style="display:inline-flex;align-items:center;gap:4px;background:${act?"#1a2035":"#f0f4f8"};border:1.5px solid ${act?"#1a2035":"#e2e6ef"};border-radius:16px;padding:4px 10px 4px 5px;font-size:12px;font-weight:600;color:${act?"#fff":"#334155"};cursor:pointer">${shieldImg(cid,16)} ${esc(t.replace(/Club Hoquei |CH |Cp |Club Patí /gi,"").trim())}</button>`;}).join("")}
    </div>
  </div>` : "";

  $("panel-jugadors").innerHTML = chips + `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">Carregant jugadors...</div>`;

  const actes = await loadCatActes(catSlug);
  const compIdStr = String(detailComp.id);

  const fmtName = p => p.slug ? decodeURIComponent(p.slug.replace(/\+/g," ")).replace(/\b\w/g,c=>c.toUpperCase()) : "?";
  const calcAge = bd => {
    if (!bd) return null;
    const pts=bd.split(/[\/\-]/), dob=pts[0].length===4?new Date(`${pts[0]}-${pts[1]}-${pts[2]}`):new Date(`${pts[2]}-${pts[1]}-${pts[0]}`);
    if (isNaN(dob)) return null;
    const now=new Date(), y=now.getFullYear()-dob.getFullYear();
    return y-(now<new Date(now.getFullYear(),dob.getMonth(),dob.getDate())?1:0);
  };

  // Agrega estadístiques per jugador des de les actes d'aquesta competició
  const statsMap = {};
  for (const acta of Object.values(actes)) {
    if (String(acta.compId) !== compIdStr) continue;
    if (!acta.playerStats) continue;
    const add = (player, team) => {
      if (!player.jugadorId) return;
      if (detailTeam && !teamIn(team, detailTeam)) return;
      const s = statsMap[player.jugadorId] ||= { name: player.name, team, g:0, b:0, v:0, partits:0 };
      s.g += player.g||0; s.b += player.b||0; s.v += player.v||0; s.partits++;
    };
    for (const p of acta.playerStats.homePlayers||[]) add(p, acta.home);
    for (const p of acta.playerStats.awayPlayers||[]) add(p, acta.away);
  }

  const ids = Object.keys(statsMap).sort((a,b) => statsMap[b].g - statsMap[a].g);

  if (!ids.length) {
    $("panel-jugadors").innerHTML = chips + `<div style="text-align:center;padding:32px;color:#94a3b8">Jugadors no disponibles.</div>`;
    return;
  }

  const tableRows = ids.map(jid => {
    const s = statsMap[jid];
    const p = DB.jugadors?.[jid];
    const name = p?.slug ? fmtName(p) : (s.name||"?").replace(/\b\w/g,c=>c.toUpperCase());
    const age  = calcAge(p?.birthDate);
    const gk   = p?.isGK ? " 🥅" : "";
    return `<tr data-jid="${jid}" style="cursor:pointer;border-bottom:1px solid #f0f4f8">
      <td style="padding:7px 8px;font-size:13px;font-weight:600;color:#1a2035">${esc(name)}${gk}</td>
      <td style="padding:7px 8px;font-size:13px;color:#334155;text-align:center">${age??'—'}</td>
      <td style="padding:7px 8px;font-size:12px;color:#64748b;text-align:center">${esc(p?.registeredTeam||'—')}</td>
      <td style="padding:7px 8px;font-size:13px;font-weight:700;color:#1a2035;text-align:center">${s.g}</td>
      <td style="padding:7px 8px;font-size:13px;color:#2563eb;text-align:center">${s.b}</td>
      <td style="padding:7px 8px;font-size:13px;color:#64748b;text-align:center">${s.partits}</td>
    </tr>`;
  }).join("");

  $("panel-jugadors").innerHTML = chips + `<div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="border-bottom:2px solid #e2e6ef">
        <th style="padding:6px 8px;text-align:left;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Jugador</th>
        <th style="padding:6px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Edat</th>
        <th style="padding:6px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Inscrit</th>
        <th style="padding:6px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#e5001c">⚽ Gols</th>
        <th style="padding:6px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#2563eb">🟦 Blaves</th>
        <th style="padding:6px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Partits</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>`;
}

function setJugadorsTeam(team) {
  detailTeam = team;
  renderDetailClassif(); renderDetailCalendar(); renderDetailJugadors();
}

// ── Init ──────────────────────────────────────────────────────
async function init(){
  try {
    $("loading-note").textContent="Carregant dades...";
    const res=await fetch(DATA_URL+"?t="+Date.now());
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
    DB=JSON.parse(await res.text());
    if (!DB.categories) throw new Error("data.json incomplet");

    applyClassificationSourceMerge();

    if (DB.lastUpdate) {
      const d = new Date(DB.lastUpdate);
      const fmt = new Intl.DateTimeFormat('ca', {weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
      const bar = $("last-update-bar");
      bar.textContent = `Darrera actualització: ${fmt.format(d)}`;
      bar.style.display = "block";
    }
    setupListeners();
    $("screen-loading").style.display="none";
    $("screen-home").style.display="flex";
    await initAuth();
    renderHome();
  } catch(e) {
    $("loading-note").innerHTML=`<span style="color:#e5001c;font-weight:700">⚠️ Error</span><br/><span style="font-size:12px;color:#6b7a99">${esc(e.message)}</span>`;
  }
}
init();
