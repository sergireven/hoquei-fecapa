// FECAPA app.js v8
const SHIELD   = "https://sidgad.cloud/fecapa/images//logos_clubes/";
const DATA_URL = "./data.json";
const SIDGAD_COMP_URL = "./competicions-sidgad.json";
const FAV_KEY  = "hoquei_favs_v8";

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
    }
  }
  if (changed) { saveFavs(); saveClubFavs(); savePlayerFavs(); }
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

let jugadorSearch = "";

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

  const sidgad = DB._sidgadCompData || null;
  const sidgadIdx = buildSidgadClassificationIndex(sidgad);

  for (const comps of Object.values(DB.categories)) {
    for (const comp of comps) {
      const jokRows = Array.isArray(comp.classification) ? comp.classification : [];
      const sidgadRows = sidgadIdx.byCompId.get(String(comp.id))
        || sidgadIdx.byName.get(normalizeCompKey(comp.name));

      if (hasClassRows(sidgadRows)) {
        comp.classification = sidgadRows;
        comp.classificationSource = "fecapa";
      } else if (hasClassRows(jokRows)) {
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
function matchCard(m, myTeam) {
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
      <button onclick="setHomeTab('favs')" style="flex:1;background:${homeTab==='favs'?"#1a2035":"#f0f4f8"};color:${homeTab==='favs'?"#fff":"#6b7a99"};border:1.5px solid ${homeTab==='favs'?"#1a2035":"#e2e6ef"};border-radius:9px;padding:8px 2px;font-size:11px;font-weight:700;cursor:pointer">⭐ Meus${(favs.length+clubFavs.length+playerFavs.length)?` (${favs.length+clubFavs.length+playerFavs.length})`:""}</button>
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
function renderJugadorsTab() {
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

  const playerRow = (jid, player) => {
    const name = fmtName(player);
    const age  = calcAge(player.birthDate);
    const team = player.teamStats?.[0];
    const catLabel = team ? (CAT_LABELS[team.cat] || team.cat) : null;
    const fav  = isPlayerFav(jid);
    const sub  = [
      team    ? `<span style="font-size:11px;color:#6b7a99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${esc(team.team)}</span>` : "",
      catLabel? `<span style="font-size:10px;font-weight:700;background:#f0f4f8;color:#475569;border-radius:4px;padding:1px 5px;flex-shrink:0">${esc(catLabel)}</span>` : "",
      player.isGK ? `<span style="font-size:10px;font-weight:700;background:#dbeafe;color:#1d4ed8;border-radius:4px;padding:1px 5px;flex-shrink:0">🥅</span>` : "",
      age     ? `<span style="font-size:11px;color:#94a3b8;flex-shrink:0">${age}a</span>` : "",
    ].filter(Boolean);
    return `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #f0f2f8">
      <div data-jid="${esc(jid)}" style="flex:1;min-width:0;cursor:pointer">
        <div style="font-size:14px;font-weight:600;color:#1a2035;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
        ${sub.length?`<div style="display:flex;align-items:center;gap:5px;margin-top:2px;flex-wrap:wrap">${sub.join("")}</div>`:""}
      </div>
      <button onclick="event.stopPropagation();togglePlayerFavAndRender('${esc(jid)}')" style="background:none;border:none;font-size:22px;cursor:pointer;padding:4px 2px;flex-shrink:0;line-height:1;color:${fav?"#f59e0b":"#cbd5e1"}">${fav?"★":"☆"}</button>
    </div>`;
  };

  const q = jugadorSearch.trim();
  let listHtml = "";

  // Jugadors seguits
  if (playerFavs.length) {
    const rows = playerFavs.map(jid=>({jid,p:DB.jugadors[jid]})).filter(x=>x.p).map(x=>playerRow(x.jid,x.p)).join("");
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

  body.innerHTML = `
    <div style="margin-bottom:14px">
      <input type="text" id="jugador-search-input" placeholder="🔍  Cerca per nom o cognom..." value="${esc(q)}"
        style="width:100%;padding:12px 14px;border:1.5px solid #e2e6ef;border-radius:12px;font-size:15px;background:#fff;outline:none;-webkit-appearance:none"
        oninput="setJugadorSearch(this.value)" autocomplete="off" autocorrect="off" spellcheck="false"/>
    </div>
    ${listHtml}`;

  const inp = $("jugador-search-input");
  if (inp) {
    inp.value = q;
    inp.focus();
    inp.selectionStart = inp.selectionEnd = inp.value.length;
  }
}
window.setJugadorSearch = q => { jugadorSearch=q; renderJugadorsTab(); };
window.togglePlayerFavAndRender = jid => { togglePlayerFav(jid); renderJugadorsTab(); };

// ── FAVS ──────────────────────────────────────────────────────
function renderFavs() {
  const body=$("home-body");
  if (!favs.length && !clubFavs.length) {
    body.innerHTML=`<div style="text-align:center;padding:48px 20px 32px">
      <div style="font-size:48px;margin-bottom:12px">⭐</div>
      <h2 style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800;color:#1a2035;margin-bottom:8px">Cap equip afegit</h2>
      <p style="color:#6b7a99;font-size:14px;line-height:1.6;margin-bottom:24px">Afegeix els equips que vols seguir.</p>
      <button onclick="openPicker()" style="background:#e5001c;border:none;color:#fff;font-weight:700;font-size:15px;padding:13px 28px;border-radius:12px;cursor:pointer">+ Afegir el meu equip</button>
    </div>`;
    return;
  }
  const updAt=DB?.updatedAt?new Date(DB.updatedAt).toLocaleDateString("ca-ES"):"?";
  const clubMap = clubFavs.length ? buildClubMap() : null;
  const both = favs.length && clubFavs.length;
  const clubSection = clubFavs.length ? `
    ${both?`<div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin-bottom:8px">🏟 Clubs</div>`:""}
    ${clubFavs.map(f=>buildClubFavCard(f,clubMap)).join("")}` : "";
  const teamSection = favs.length ? `
    ${both?`<div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin:${clubFavs.length?"16px":0} 0 8px">🏒 Equips</div>`:""}
    ${favs.map(buildFavCard).join("")}` : "";
  body.innerHTML=clubSection+teamSection+
    `<p style="text-align:center;font-size:11px;color:#cbd5e1;margin-top:4px;padding-bottom:16px">Actualitzat: ${updAt}</p>`;
}

function buildClubFavCard(fav, clubMap) {
  const club = clubMap?.get(fav.key);
  const displayName = club?.displayName || fav.displayName;
  const clubId = club?.clubId || fav.clubId;
  const teamCount = club?.teams.length ?? 0;
  return `
    <div style="background:#fff;border:1.5px solid #e2e6ef;border-top:4px solid #003da5;border-radius:14px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <div style="display:flex;align-items:center;gap:10px;padding:11px 13px">
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
    <div style="background:#fff;border:1.5px solid #e2e6ef;border-top:4px solid ${catColor};border-radius:14px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <div style="display:flex;align-items:center;gap:10px;padding:11px 13px">
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

window.removeFav = (compId,teamName) => {
  const key = `${compId}::${teamName}`;
  favs = favs.filter(f=>!(f.compId===compId&&f.teamName===teamName));
  saveFavs();
  _removeFavFromCloud("team", key);
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
        if (!club.teams.some(t=>t.compId===comp.id&&t.teamName===row.team))
          club.teams.push({ compId:comp.id, teamName:row.team, teamId:row.teamId, compName:comp.name, category:getCatForComp(comp) });
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
      for (const t of clubMap.get(key).teams)
        if (!main.teams.some(x=>x.compId===t.compId&&x.teamName===t.teamName))
          main.teams.push(t);
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
      <button onclick="toggleClubFav('${esc(club.key)}','${esc(club.displayName)}','${esc(club.clubId||"")}');renderClubDashboard()" style="background:${isClubFav(club.key)?"#fef9c3":"#f0f4f8"};border:1px solid ${isClubFav(club.key)?"#fcd34d":"#e2e6ef"};border-radius:8px;padding:6px 10px;font-size:13px;cursor:pointer;flex-shrink:0">${isClubFav(club.key)?"⭐":"☆"}</button>
      <label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#6b7a99;cursor:pointer;flex-shrink:0">
        <input type="checkbox" ${allOnlyActive?"checked":""} onchange="allOnlyActive=this.checked;selectedClub=null;selectClub('${esc(club.key)}')" style="accent-color:#003da5"/>
        En curs
      </label>
    </div>
    ${teamCards||`<p style="text-align:center;padding:32px;color:#94a3b8">Cap equip actiu</p>`}`;
}

// ── ALL COMPS ─────────────────────────────────────────────────
function renderAllComps(cursor) {
  const catNames=Object.keys(DB.categories).filter(k=>DB.categories[k].length>0);
  const allCats=["ALL",...catNames];

  const filterBar=`
    <div style="background:#fff;border-bottom:1px solid #e2e6ef;overflow-x:auto;white-space:nowrap">
      <div style="display:inline-flex;padding:0 12px">
        ${allCats.map(cat=>{
          const active=allFilterCat===cat, label=cat==="ALL"?"Totes":cat;
          const emoji=cat==="ALL"?"🏒":(CAT_EMOJI[cat]||"📋");
          const comps=cat==="ALL"?Object.values(DB.categories).flat():DB.categories[cat]||[];
          const count=allOnlyActive?comps.filter(isActive).length:comps.length;
          return `<button onclick="allFilterCat='${esc(cat)}';renderAllComps()" style="background:none;border:none;border-bottom:3px solid ${active?"#e5001c":"transparent"};font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:${active?"#e5001c":"#6b7a99"};padding:9px 10px 6px;cursor:pointer;white-space:nowrap;text-transform:uppercase">${emoji} ${label} <span style="font-size:10px;opacity:.6">${count}</span></button>`;
        }).join("")}
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

  let cats=allFilterCat==="ALL"?Object.entries(DB.categories):[[allFilterCat,DB.categories[allFilterCat]||[]]];
  cats=cats.map(([cat,comps])=>[cat, comps.filter(c=>{
    if (allOnlyActive && !isActive(c)) return false;
    if (!allSearch) return true;
    const q=allSearch.toLowerCase();
    return c.name.toLowerCase().includes(q)||(c.classification||[]).some(r=>r.team&&r.team.toLowerCase().includes(q));
  })]).filter(([,c])=>c.length>0);

  const compsHtml=cats.map(([cat,comps])=>{
    if (!comps.length) return "";
    const color=CAT_COLOR[cat]||"#666", emoji=CAT_EMOJI[cat]||"📋";
    return `
      <div style="margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;padding:0 14px">
          <span style="font-size:15px">${emoji}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:800;text-transform:uppercase;color:${color}">${cat}</span>
          <span style="font-size:11px;font-weight:700;color:#94a3b8;background:#e8ecf4;border-radius:10px;padding:1px 7px">${comps.length}</span>
        </div>
        <div style="padding:0 14px">
          ${comps.map(comp=>`
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
            </div>`).join("")}
        </div>
      </div>`;
  }).join("");

  $("home-body").innerHTML=filterBar+`<div style="max-width:720px;margin:0 auto;padding-bottom:24px">${
    cats.some(([,c])=>c.length)?compsHtml:`<div style="text-align:center;padding:40px;color:#94a3b8">Cap competició${allOnlyActive?" en curs":""} trobada</div>`
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
  $("detail-meta").textContent=`${(detailComp.classification||[]).length} equips · ${detailComp.pctPlayed??"?"}% jugat${srcLabel}`;
  document.querySelectorAll(".detail-tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===detailTab));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===`panel-${detailTab}`));
  renderDetailClassif(); renderDetailCalendar(); renderDetailJugadors();
  window.scrollTo(0,0);
}
window.openDetail=openDetail;

// ── Fitxa de jugador (bottom sheet) ──────────────────────────
function openPlayerModal(jid, fallbackName) {
  const player = DB?.jugadors?.[jid];
  const slug   = player?.slug ? decodeURIComponent(player.slug.replace(/\+/g," ")) : null;
  const name   = (slug ? slug.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : null)
               || fallbackName
               || "Jugador";

  // Team i categoria del teamStats principal
  const firstTeam  = player?.teamStats?.[0];
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
  const teamStats = player?.teamStats || [];

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
      ${ms.map(m=>matchCard(m,detailTeam)).join("")}
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

    try {
      const sidgadRes = await fetch(SIDGAD_COMP_URL+"?t="+Date.now());
      if (sidgadRes.ok) DB._sidgadCompData = JSON.parse(await sidgadRes.text());
    } catch {}
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
