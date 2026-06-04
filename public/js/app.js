// FECAPA app.js v8
const SHIELD   = "https://sidgad.cloud/fecapa/images//logos_clubes/";
const DATA_URL = "./data.json";
const SEASON_MANIFEST_URL = "./season-archive/manifest.json";
const SELECTED_SEASON_KEY = "hoquei_selected_season_v1";
const VENUES_URL = "./venues.json";
const SIDGAD_COMP_URL = "./competicions-sidgad.json";
const FECAPA_CATEGORIES_URL = "./fecapa-categories.json";
const CLASSIFICATION_SOURCE_PILOTS_URL = "./classification-source-pilots.json";
const FINALS_PILOT_API_URL = "/api/finals-pilot";
const FAV_KEY  = "hoquei_favs_v8";
const LEVEL_FAV_KEY = "hoquei_level_favs_v1";

const finalsPilotLoadState = new Map();

const CLASSIFICATION_SOURCE_PILOTS = [
  { jokCompId: "4191", fecapaCompetitionId: "3949", preferredGroupToken: "PLATA 1" },
  { jokCompId: "4192", fecapaCompetitionId: "3949", preferredGroupToken: "PLATA 2" },
  { jokCompId: "4193", fecapaCompetitionId: "3949", preferredGroupToken: "PLATA 3" },
  { jokCompId: "4194", fecapaCompetitionId: "3949", preferredGroupToken: "PLATA 4" },
  { jokCompId: "4195", fecapaCompetitionId: "3949", preferredGroupToken: "PLATA 5" },
  { jokCompId: "4196", fecapaCompetitionId: "3949", preferredGroupToken: "PLATA 6" },
  { jokCompId: "4237", fecapaCompetitionId: "3960", preferredGroupToken: "BRONZE TARRAGONA" },
  { jokCompId: "4595", fecapaCompetitionId: "3960", preferredGroupToken: "GRUP A" },
  { jokCompId: "4598", fecapaCompetitionId: "3960", preferredGroupToken: "GRUP B" },
  { jokCompId: "4301", fecapaCompetitionId: "4300", preferredGroupToken: "OR 1" },
  { jokCompId: "4302", fecapaCompetitionId: "4300", preferredGroupToken: "OR 2" },
  { jokCompId: "4303", fecapaCompetitionId: "4300", preferredGroupToken: "OR 3" },
  { jokCompId: "4305", fecapaCompetitionId: "4304", preferredGroupToken: "PLATA 1" },
  { jokCompId: "4311", fecapaCompetitionId: "4304", preferredGroupToken: "PLATA 2" },
  { jokCompId: "4307", fecapaCompetitionId: "4304", preferredGroupToken: "PLATA 3" },
  { jokCompId: "4308", fecapaCompetitionId: "4304", preferredGroupToken: "PLATA 4" },
  { jokCompId: "4309", fecapaCompetitionId: "4304", preferredGroupToken: "PLATA 5" },
  { jokCompId: "4310", fecapaCompetitionId: "4304", preferredGroupToken: "PLATA 6" },
  { jokCompId: "4141", fecapaCompetitionId: "3946", preferredGroupToken: "OR 1" },
  { jokCompId: "4143", fecapaCompetitionId: "3946", preferredGroupToken: "OR 2" },
  { jokCompId: "4144", fecapaCompetitionId: "3946", preferredGroupToken: "OR 3" },
  { jokCompId: "4145", fecapaCompetitionId: "3946", preferredGroupToken: "OR 4" },
  { jokCompId: "4147", fecapaCompetitionId: "3946", preferredGroupToken: "OR 5" },
  { jokCompId: "4149", fecapaCompetitionId: "3946", preferredGroupToken: "OR 6" },
  { jokCompId: "4158", fecapaCompetitionId: "3947", preferredGroupToken: "PLATA 1" },
  { jokCompId: "4222", fecapaCompetitionId: "3947", preferredGroupToken: "PLATA 2" },
  { jokCompId: "4224", fecapaCompetitionId: "3947", preferredGroupToken: "PLATA 3" },
  { jokCompId: "4225", fecapaCompetitionId: "3947", preferredGroupToken: "PLATA 4" },
  { jokCompId: "4226", fecapaCompetitionId: "3947", preferredGroupToken: "PLATA 5" },
  { jokCompId: "4227", fecapaCompetitionId: "3947", preferredGroupToken: "PLATA 6" },
  { jokCompId: "4228", fecapaCompetitionId: "3947", preferredGroupToken: "PLATA 7" },
  { jokCompId: "4229", fecapaCompetitionId: "3947", preferredGroupToken: "PLATA 8" },
  { jokCompId: "4475", fecapaCompetitionId: "4452", preferredGroupToken: "OR COPA BCN 1" },
  { jokCompId: "4476", fecapaCompetitionId: "4452", preferredGroupToken: "OR COPA BCN 2" },
  { jokCompId: "4477", fecapaCompetitionId: "4452", preferredGroupToken: "OR COPA BCN 3" },
  { jokCompId: "4478", fecapaCompetitionId: "4452", preferredGroupToken: "PLATA COPA BCN 4" },
  { jokCompId: "4479", fecapaCompetitionId: "4452", preferredGroupToken: "PLATA COPA BCN 5" },
  { jokCompId: "4480", fecapaCompetitionId: "4452", preferredGroupToken: "PLATA COPA BCN 6" },
  { jokCompId: "4481", fecapaCompetitionId: "4459", preferredGroupToken: "COPA FCP 1" },
  { jokCompId: "4482", fecapaCompetitionId: "4459", preferredGroupToken: "COPA FCP 2" },
  { jokCompId: "4483", fecapaCompetitionId: "4459", preferredGroupToken: "COPA FCP 3" },
  { jokCompId: "4484", fecapaCompetitionId: "4463", preferredGroupToken: "RANKING 1" },
  { jokCompId: "4485", fecapaCompetitionId: "4463", preferredGroupToken: "RANKING 2" },
  { jokCompId: "4486", fecapaCompetitionId: "4463", preferredGroupToken: "RANKING 3" },
  { jokCompId: "4487", fecapaCompetitionId: "4463", preferredGroupToken: "RANKING 4" },
  { jokCompId: "4488", fecapaCompetitionId: "4463", preferredGroupToken: "RANKING 5" },
  { jokCompId: "4470", fecapaCompetitionId: "4469", preferredGroupToken: "OR P1" },
  { jokCompId: "4471", fecapaCompetitionId: "4469", preferredGroupToken: "OR P2" },
  { jokCompId: "4472", fecapaCompetitionId: "4469", preferredGroupToken: "OR P3" },
  { jokCompId: "4473", fecapaCompetitionId: "4469", preferredGroupToken: "OR P4" },
  { jokCompId: "4104", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR 1" },
  { jokCompId: "4105", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR 2" },
  { jokCompId: "4106", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR 3" },
  { jokCompId: "4107", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR 4" },
  { jokCompId: "4108", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR 5" },
  { jokCompId: "4109", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR 6" },
  { jokCompId: "4110", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR 7" },
  { jokCompId: "4111", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR 8" },
  { jokCompId: "4112", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR 9" },
  { jokCompId: "4113", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR 10" },
  { jokCompId: "4339", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR CC1" },
  { jokCompId: "4340", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR CC2" },
  { jokCompId: "4341", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR CC3" },
  { jokCompId: "4342", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR CC4" },
  { jokCompId: "4343", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR RK 1" },
  { jokCompId: "4344", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR RK 2" },
  { jokCompId: "4345", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR RK 3" },
  { jokCompId: "4412", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR P1" },
  { jokCompId: "4413", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR P2" },
  { jokCompId: "4414", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR P3" },
  { jokCompId: "4415", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR P4" },
  { jokCompId: "4621", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR 17 AL 20" },
  { jokCompId: "4622", fecapaCompetitionId: "3934", preferredGroupToken: "INFANTIL OR 21 AL 24" },
  { jokCompId: "4083", fecapaCompetitionId: "3931", preferredGroupToken: "JÚNIOR PLATA 1" },
  { jokCompId: "4084", fecapaCompetitionId: "3931", preferredGroupToken: "JÚNIOR PLATA 2" },
  { jokCompId: "4085", fecapaCompetitionId: "3931", preferredGroupToken: "JÚNIOR PLATA 3" },
  { jokCompId: "4086", fecapaCompetitionId: "3931", preferredGroupToken: "JÚNIOR PLATA 4" },
  { jokCompId: "4357", fecapaCompetitionId: "3931", preferredGroupToken: "JÚNIOR PLATA CC1" },
  { jokCompId: "4358", fecapaCompetitionId: "3931", preferredGroupToken: "JÚNIOR PLATA CC2" },
  { jokCompId: "4359", fecapaCompetitionId: "3931", preferredGroupToken: "JÚNIOR PLATA CF1" },
  { jokCompId: "4360", fecapaCompetitionId: "3931", preferredGroupToken: "JÚNIOR PLATA CF2" },
  { jokCompId: "4088", fecapaCompetitionId: "3930", preferredGroupToken: "JÚNIOR OR 1" },
  { jokCompId: "4074", fecapaCompetitionId: "3933", preferredGroupToken: "JUVENIL PLATA 1" },
];

// ── Supabase auth ─────────────────────────────────────────────
const SUPABASE_URL = "https://ggltghiojxllxajeblme.supabase.co";
const SUPABASE_KEY = "sb_publishable_SPmYJDTieqtV8EDT-DdHyA_nc_sK7RE";
const _sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
const SOFT_SESSION_KEY = "hoquei_user_v1";
const USER_LOCATION_KEY = "hoquei_user_location_v1";
let currentUser    = null;
let currentProfile = null;

const ROLE_OPTIONS = ["", "entrenador", "coordinador", "gestor_botiga", "admin"];
const ROLE_LABELS = {
  "": "—",
  entrenador: "Entrenador",
  coordinador: "Coordinador",
  gestor_botiga: "Gestor de botiga",
  admin: "Admin",
};

function getRoleLabel(role, fallback = "") {
  const key = String(role || "").trim();
  return ROLE_LABELS[key] || fallback;
}

function loadUserLocationStore() {
  try { return JSON.parse(localStorage.getItem(USER_LOCATION_KEY) || "{}"); }
  catch { return {}; }
}

function saveUserLocationStore(store) {
  localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(store || {}));
}

function getCurrentUserLocation() {
  const userId = String(currentUser?.id || "");
  if (!userId) return null;
  const store = loadUserLocationStore();
  const loc = store?.[userId] || null;
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null;
  return loc;
}

function setCurrentUserLocation(location) {
  const userId = String(currentUser?.id || "");
  if (!userId || !location) return;
  const store = loadUserLocationStore();
  store[userId] = {
    label: String(location.label || "").trim(),
    lat: Number(location.lat),
    lng: Number(location.lng),
    updatedAt: new Date().toISOString(),
  };
  saveUserLocationStore(store);
}

function getProfileLocation(profile) {
  if (!profile) return null;

  const fromPacked = profile.user_location;
  if (fromPacked && Number.isFinite(Number(fromPacked.lat)) && Number.isFinite(Number(fromPacked.lng))) {
    return {
      label: String(fromPacked.label || "").trim() || "Zona usuari",
      lat: Number(fromPacked.lat),
      lng: Number(fromPacked.lng),
      updatedAt: fromPacked.updatedAt || null,
    };
  }

  const label = String(profile.location_label || profile.user_location_label || "").trim();
  const lat = Number(profile.location_lat ?? profile.user_location_lat);
  const lng = Number(profile.location_lng ?? profile.user_location_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    label: label || "Zona usuari",
    lat,
    lng,
    updatedAt: profile.location_updated_at || profile.updated_at || null,
  };
}

async function persistUserLocationToCloud(location) {
  if (!_sb || !currentProfile?.id || !location) return false;

  const packedLoc = {
    label: String(location.label || "").trim(),
    lat: Number(location.lat),
    lng: Number(location.lng),
    updatedAt: new Date().toISOString(),
  };

  // Preferred path: explicit RPC for own-profile safe update.
  const rpc = await _sb.rpc("update_own_location", {
    p_user_id: currentProfile.id,
    p_location_label: packedLoc.label,
    p_location_lat: packedLoc.lat,
    p_location_lng: packedLoc.lng,
  });
  if (!rpc.error) {
    currentProfile = {
      ...currentProfile,
      location_label: packedLoc.label,
      location_lat: packedLoc.lat,
      location_lng: packedLoc.lng,
      user_location: packedLoc,
    };
    _saveSoftSession(currentProfile);
    return true;
  }

  // Fallback 1: scalar columns on profiles.
  const updateScalar = await _sb
    .from("profiles")
    .update({
      location_label: packedLoc.label,
      location_lat: packedLoc.lat,
      location_lng: packedLoc.lng,
    })
    .eq("id", currentProfile.id);
  if (!updateScalar.error) {
    currentProfile = {
      ...currentProfile,
      location_label: packedLoc.label,
      location_lat: packedLoc.lat,
      location_lng: packedLoc.lng,
      user_location: packedLoc,
    };
    _saveSoftSession(currentProfile);
    return true;
  }

  // Fallback 2: packed JSON column.
  const updateJson = await _sb
    .from("profiles")
    .update({ user_location: packedLoc })
    .eq("id", currentProfile.id);
  if (!updateJson.error) {
    currentProfile = {
      ...currentProfile,
      user_location: packedLoc,
    };
    _saveSoftSession(currentProfile);
    return true;
  }

  console.error("[location] cloud save failed", {
    rpc: rpc.error?.message || null,
    scalar: updateScalar.error?.message || null,
    json: updateJson.error?.message || null,
  });
  return false;
}

async function geocodeUserArea(query) {
  const q = String(query || "").trim();
  if (!q) throw new Error("Indica una ciutat o barri");

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es,ad&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`No s'ha pogut geocodificar (${res.status})`);

  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error("No s'ha trobat cap ubicació");

  const best = rows[0] || {};
  const lat = Number(best.lat);
  const lng = Number(best.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Resposta de geocodificació invàlida");

  return {
    label: q,
    lat,
    lng,
  };
}

function haversineKm(fromLat, fromLng, toLat, toLng) {
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function getVenueCoordinates(teamName) {
  if (!venuesDB?.venues || !teamName) return null;
  const venue = venuesDB.venues[teamName];
  if (!venue) return null;
  const rawLat = venue?.lat ?? venue?.coordinates?.lat;
  const rawLng = venue?.lng ?? venue?.coordinates?.lng;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function estimateTravelForMatch(match, myTeam) {
  if (!currentUser?.id || !match || !myTeam) return null;
  const played = match.played !== false && match.homeScore != null;
  if (played) return null;
  const isLocal = teamIn(match.home, myTeam);
  if (isLocal) return null;

  const userLoc = getCurrentUserLocation();
  if (!userLoc) return null;

  const venueCoords = getVenueCoordinates(match.home);
  if (!venueCoords) return null;

  const km = haversineKm(userLoc.lat, userLoc.lng, venueCoords.lat, venueCoords.lng);
  if (!Number.isFinite(km)) return null;

  const avgSpeedKmh = 35;
  const minutes = Math.max(8, Math.round((km / avgSpeedKmh) * 60));
  return {
    km,
    minutes,
    originLabel: userLoc.label,
  };
}

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
    const profileLoc = getProfileLocation(data);
    if (profileLoc) setCurrentUserLocation(profileLoc);
    _saveSoftSession(data);
    await loadFavsFromCloud();
  }
}

// ── Cloud favorites sync ──────────────────────────────────────
async function loadFavsFromCloud() {
  if (!_sb || !currentProfile?.id) return;
  const { data, error } = await _sb.rpc("get_user_favorites", { p_user_id: currentProfile.id });
  if (error || !data) return;
  const cloudEmpty = data.length === 0;
  const hasLocals = favs.length || clubFavs.length || playerFavs.length || levelFavs.length;
  if (cloudEmpty && hasLocals) {
    for (const f of favs)       _syncFavToCloud("team",   `${f.compId}::${f.teamName}`, f);
    for (const f of clubFavs)   _syncFavToCloud("club",   f.key, f);
    for (const id of playerFavs) _syncFavToCloud("player", id, null);
    for (const f of levelFavs)  _syncFavToCloud("level",  f.nodeKey, f);
    return;
  }
  favs = []; clubFavs = []; playerFavs = []; levelFavs = [];
  for (const f of data) {
    if (f.fav_type === "team" && f.fav_data) {
      const d = f.fav_data;
      if (d.compId && d.teamName) favs.push(d);
    } else if (f.fav_type === "club" && f.fav_data) {
      const d = f.fav_data;
      if (d.key) clubFavs.push(d);
    } else if (f.fav_type === "player") {
      if (f.fav_key) playerFavs.push(f.fav_key);
    } else if (f.fav_type === "level" && f.fav_data) {
      const d = f.fav_data;
      if (d.nodeKey) levelFavs.push(d);
    }
  }
  saveFavs(); saveClubFavs(); savePlayerFavs(); saveLevelFavs();
}
async function _syncFavToCloud(type, key, data) {
  if (!_sb || !currentProfile?.id) { console.warn("[fav] sync skip — no profile", type, key); return; }
  const { error } = await _sb.rpc("upsert_user_favorite", { p_user_id: currentProfile.id, p_type: type, p_key: key, p_data: data });
  if (error) console.error("[fav] upsert error", type, key, error);
}
async function _removeFavFromCloud(type, key) {
  if (!_sb || !currentProfile?.id) { console.warn("[fav] remove skip — no profile", type, key); return; }
  const { error } = await _sb.rpc("delete_user_favorite", { p_user_id: currentProfile.id, p_type: type, p_key: key });
  if (error) console.error("[fav] delete error", type, key, error);
}

function renderLoginButton() {
  if (!_sb) return `<button onclick="openPicker()" style="background:#e5001c;border:none;color:#fff;font-weight:700;font-size:13px;padding:7px 14px;border-radius:9px;cursor:pointer">+ Afegir equip</button>`;
  const roleBadge = getRoleLabel(currentProfile?.role, "");
  const loginBtn = currentUser
    ? `<button onclick="openUserModal()" style="background:#1a2035;border:none;color:#fff;font-weight:700;font-size:13px;padding:7px 12px;border-radius:9px;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
        <span style="background:#e5001c;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900">${(currentUser.email||"?")[0].toUpperCase()}</span>
        ${esc(roleBadge)}
       </button>`
    : `<button onclick="openLoginModal()" style="background:#f0f4f8;border:1.5px solid #e2e6ef;color:#334155;font-weight:700;font-size:13px;padding:7px 12px;border-radius:9px;cursor:pointer">👤 Login</button>`;
  const adminBtn = currentProfile?.role === "admin"
    ? `<button onclick="openAdminPanel()" style="background:#f59e0b;border:none;color:#1a2035;font-weight:800;font-size:13px;padding:7px 12px;border-radius:9px;cursor:pointer">⚙️ Panell Admin</button>`
    : "";
  return `<div style="display:flex;gap:6px;align-items:center">${loginBtn}${adminBtn}<button onclick="openPicker()" style="background:#e5001c;border:none;color:#fff;font-weight:700;font-size:13px;padding:7px 14px;border-radius:9px;cursor:pointer">+ Afegir equip</button></div>`;
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
      <form onsubmit="event.preventDefault();loginWithEmail()">
        <input id="login-email-input" type="email" placeholder="el-teu@email.com" autocomplete="email"
          style="width:100%;padding:12px 14px;border:1.5px solid #e2e6ef;border-radius:12px;font-size:15px;margin-bottom:12px;outline:none"/>
        <button type="submit" style="width:100%;background:#1a2035;border:none;color:#fff;font-weight:700;font-size:15px;padding:13px;border-radius:12px;cursor:pointer;margin-bottom:8px">Accedir</button>
      </form>
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
    const profileLoc = getProfileLocation(profile);
    if (profileLoc) setCurrentUserLocation(profileLoc);
    _saveSoftSession(profile);
    await loadFavsFromCloud();
    closeLoginModal();
    // Rerenderitza segons la pantalla visible; detailComp pot quedar en memòria
    // tot i estar a Home, i això impedia refrescar el botó d'Admin/Login.
    const detailVisible = $("screen-detail")?.style?.display === "flex";
    if (detailVisible && detailComp) {
      await renderDetailClassif(); renderDetailCalendar(); renderDetailJugadors();
    } else {
      renderHome();
    }
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
  const roleLabel = getRoleLabel(currentProfile?.role, "Usuari");
  const userLoc = getCurrentUserLocation();
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
  const locationSection = `<div style="margin-bottom:16px">
      <div style="font-size:13px;color:#64748b;margin-bottom:6px">La teva zona (ciutat o barri)</div>
      <div style="display:flex;gap:8px">
        <input id="user-location-input" type="text" value="${esc(userLoc?.label || "")}" placeholder="Ex.: Gràcia, Barcelona"
          style="flex:1;padding:10px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;font-family:inherit;outline:none"/>
        <button onclick="saveUserLocation()" style="background:#1a2035;border:none;color:#fff;font-weight:700;font-size:13px;padding:10px 14px;border-radius:10px;cursor:pointer">Desar</button>
      </div>
      <div style="margin-top:5px;font-size:11px;color:#94a3b8">Només a nivell ciutat/barri. No guardis adreça exacta.</div>
      <div id="user-location-msg" style="margin-top:6px;font-size:12px;color:#64748b">${userLoc ? `Actual: ${esc(userLoc.label)} · ${new Date(userLoc.updatedAt || Date.now()).toLocaleString("ca-ES")}` : ""}</div>
    </div>`;
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
      ${locationSection}
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

async function saveUserLocation() {
  const input = $("user-location-input");
  const msg = $("user-location-msg");
  if (!currentUser?.id || !input || !msg) return;

  const query = String(input.value || "").trim();
  if (!query) {
    msg.style.color = "#e5001c";
    msg.textContent = "Introdueix una ciutat o barri.";
    return;
  }

  msg.style.color = "#64748b";
  msg.textContent = "Geocodificant...";

  try {
    const loc = await geocodeUserArea(query);
    setCurrentUserLocation(loc);
    const cloudSaved = await persistUserLocationToCloud(loc);
    msg.style.color = cloudSaved ? "#16a34a" : "#92400e";
    msg.textContent = cloudSaved
      ? `✓ Ubicació desada a BBDD: ${loc.label}`
      : `Ubicació desada localment: ${loc.label}. Falta persistència a BBDD (schema/RLS).`;
    const homeVisible = $("screen-home")?.style?.display === "flex";
    if (homeVisible) renderHome();
  } catch (err) {
    msg.style.color = "#e5001c";
    msg.textContent = `Error: ${err?.message || "No s'ha pogut desar"}`;
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
window.saveUserLocation = saveUserLocation;
window.openLoginModal  = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.openUserModal   = openUserModal;
window.closeUserModal  = closeUserModal;

// Admin panel
const ADMIN_BENJAMI_TARGET_COMP = "BENJAMÍ COPA BARCELONA 2ª FASE";
let adminPanelView = "mapping";
let adminBenjamiModelCache = null;
let adminFecapaCategoriesCache = null;
let adminEntityMappingCache = null;
let adminAuditSearchQuery = "";
let adminAuditSearchTimer = null;
let adminMappingIssueFilters = { error: true, warning: false, outdated: false, mapping_ok_fecapa_empty: true };
let adminMappingIncidentExpandAll = null;

const numOrNull = raw => {
  const n = parseInt(String(raw || "").trim(), 10);
  return Number.isFinite(n) ? n : null;
};

function normalizeSpace(str) {
  return String(str || "").replace(/\s+/g, " ").trim();
}

function textOf(el, selector) {
  return normalizeSpace(el?.querySelector(selector)?.textContent || "");
}

function parseBenjamiGroupTable(groupName, tableEl) {
  const teams = [...tableEl.querySelectorAll("tbody tr")].map(row => {
    const cells = [...row.querySelectorAll("td")];
    const teamCell = cells[2] || null;
    const logoSrcRaw = cells[1]?.querySelector("img")?.getAttribute("src") || "";
    const logoSrc = normalizeSpace(logoSrcRaw);
    const teamName = normalizeSpace(textOf(teamCell, ".no_mobile") || teamCell?.textContent || "");
    const teamShort = normalizeSpace(textOf(teamCell, ".mobile"));

    return {
      position: numOrNull(cells[0]?.textContent),
      teamName,
      teamShort: teamShort || null,
      logoSrc: logoSrc || null,
      points: numOrNull(cells[3]?.textContent),
      played: numOrNull(cells[4]?.textContent),
      won: numOrNull(cells[5]?.textContent),
      drawn: numOrNull(cells[6]?.textContent),
      lost: numOrNull(cells[7]?.textContent),
      goalsFor: numOrNull(cells[8]?.textContent),
      goalsAgainst: numOrNull(cells[9]?.textContent),
      goalDiff: numOrNull(cells[10]?.textContent),
      penalties: numOrNull(cells[11]?.textContent),
    };
  }).filter(t => t.teamName);

  return {
    groupName,
    teamCount: teams.length,
    teams,
  };
}

function buildAdminBenjamiModelFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const containers = [...doc.querySelectorAll(".tab_modal_container")];

  const targetContainer = containers.find(container => {
    const header = normalizeSpace(container.querySelector("#titulo_competicion_header_text")?.textContent || "");
    return header === ADMIN_BENJAMI_TARGET_COMP;
  });

  if (!targetContainer) {
    throw new Error(`No s'ha trobat el bloc de la competició ${ADMIN_BENJAMI_TARGET_COMP}`);
  }

  const classifTab = targetContainer.querySelector(".tab_modal_contenido#tab_modal_contenido_competicion");
  if (!classifTab) {
    throw new Error("No s'ha trobat la pestanya de classificació de la competició");
  }

  const titles = [...classifTab.querySelectorAll(".div_titulo_fase_idc")].map(el => normalizeSpace(el.textContent));
  const tables = [...classifTab.querySelectorAll("table.tabla_standard")];
  const groups = [];
  const count = Math.min(titles.length, tables.length);

  for (let i = 0; i < count; i += 1) {
    groups.push(parseBenjamiGroupTable(titles[i], tables[i]));
  }

  return {
    source: "fecapa_html",
    competition: ADMIN_BENJAMI_TARGET_COMP,
    generatedAt: new Date().toISOString(),
    groupCount: groups.length,
    teamCount: groups.reduce((acc, g) => acc + g.teamCount, 0),
    groups,
  };
}

async function getAdminBenjamiModel() {
  if (adminBenjamiModelCache) return adminBenjamiModelCache;

  const res = await fetch(`./HOQUEI%20PATINS%20_%20FCP.html?t=${Date.now()}`);
  if (!res.ok) throw new Error(`No s'ha pogut carregar l'HTML (${res.status})`);
  const html = await res.text();

  adminBenjamiModelCache = buildAdminBenjamiModelFromHtml(html);
  return adminBenjamiModelCache;
}

function renderAdminTopNav(activeView) {
  const btn = (view, label) => `<button onclick="adminSetView('${view}')" style="flex:1;background:${activeView === view ? "#1a2035" : "#f0f4f8"};border:1.5px solid ${activeView === view ? "#1a2035" : "#e2e6ef"};color:${activeView === view ? "#fff" : "#334155"};font-weight:700;font-size:13px;padding:10px 12px;border-radius:10px;cursor:pointer">${label}</button>`;
  return `<div style="display:flex;gap:8px;margin-bottom:12px">
    ${btn("users", "Usuaris")}
    ${btn("mapping", "Mapeig FECAPA↔jok")}
  </div>`;
}

function adminCategoryLabel(key) {
  if (key === "nacional_catalana") return "Nacional Catalana";
  if (key === "primera_catalana") return "Primera Catalana";
  if (key === "segona_catalana") return "Segona Catalana";
  if (key === "tercera_catalana") return "Tercera Catalana";
  if (key === "fem") return "Femení";
  if (key === "junior") return "Júnior";
  if (key === "juvenil") return "Juvenil";
  if (key === "infantil") return "Infantil";
  if (key === "prebenjami") return "Prebenjamí";
  if (key === "benjami") return "Benjamí";
  if (key === "alevi") return "Aleví";
  if (key === "veterans") return "Veterans";
  return key;
}

async function getAdminFecapaCategoriesModel({ force = false } = {}) {
  if (!force && adminFecapaCategoriesCache) return adminFecapaCategoriesCache;
  // Admin must reflect persisted fecapa-categories output (no live scraping).
  const res = await fetch(`./fecapa-categories.json?t=${Date.now()}`);
  if (!res.ok) {
    let detail = "";
    try {
      const errJson = await res.json();
      detail = errJson?.error ? `: ${errJson.error}` : "";
    } catch {}
    throw new Error(`No s'ha pogut carregar fecapa-categories.json (${res.status})${detail}`);
  }
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || "Resposta invàlida de FECAPA scraper");
  adminFecapaCategoriesCache = data;
  return data;
}

function renderAdminFecapaCompetition(comp) {
  return `<div style="background:#fff;border-radius:12px;border:1.5px solid #e2e6ef;padding:12px 12px 4px;margin-bottom:12px">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;color:#1a2035;line-height:1.2">${esc(comp.competitionName)}</div>
    <div style="font-size:11px;color:#64748b;margin:4px 0 10px">ID ${esc(comp.competitionId)} · ${comp.groupCount} grups · ${comp.teamCount} equips</div>
    ${comp.groups.map(renderAdminBenjamiTable).join("")}
  </div>`;
}

async function renderAdminFecapaCategoriesPanel(body) {
  body.innerHTML = `${renderAdminTopNav("fecapa_cats")}<div style="text-align:center;padding:32px;color:#94a3b8">Carregant fecapa-categories.json...</div>`;
  try {
    const model = await getAdminFecapaCategoriesModel({ force: true });
    const categoryKeys = ["nacional_catalana", "primera_catalana", "segona_catalana", "tercera_catalana", "fem", "junior", "juvenil", "infantil", "prebenjami", "benjami", "alevi", "veterans"];
    const totalComps = categoryKeys.reduce((acc, k) => acc + (model.categories?.[k]?.length || 0), 0);
    const totalTeams = categoryKeys.reduce((acc, k) => acc + (model.categories?.[k] || []).reduce((n, c) => n + (c.teamCount || 0), 0), 0);

    body.innerHTML = `
      ${renderAdminTopNav("fecapa_cats")}
      <div style="background:#fff;border-radius:12px;border:1.5px solid #e2e6ef;padding:12px 14px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;color:#1a2035">Classificacions de FECAPA</div>
            <div style="font-size:12px;color:#64748b">${totalComps} competicions · ${totalTeams} equips · source: ${esc(model.source || "unknown")}${Number(model.failedCompetitions || 0) ? ` · errors: ${model.failedCompetitions}` : ""}</div>
          </div>
          <button onclick="adminReloadFecapaCategories()" style="background:#1a2035;border:none;color:#fff;font-weight:700;font-size:12px;padding:9px 12px;border-radius:9px;cursor:pointer">Recarregar</button>
        </div>
      </div>
      ${categoryKeys.map(key => {
        const comps = model.categories?.[key] || [];
        return `<div style="margin-bottom:14px">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#1a2035;margin:0 2px 10px">${adminCategoryLabel(key)} (${comps.length})</div>
          ${comps.length ? comps.map(renderAdminFecapaCompetition).join("") : `<div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:12px;color:#64748b;font-size:13px">Sense competicions trobades</div>`}
        </div>`;
      }).join("")}
      <details style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px 12px">
        <summary style="cursor:pointer;font-weight:700;color:#1a2035">Model de dades JSON (fecapa-categories.json)</summary>
        <pre style="margin-top:10px;white-space:pre-wrap;word-break:break-word;background:#0f172a;color:#e2e8f0;border-radius:10px;padding:10px;font-size:11px;line-height:1.5">${esc(JSON.stringify(model, null, 2))}</pre>
      </details>`;
  } catch (err) {
    body.innerHTML = `${renderAdminTopNav("fecapa_cats")}<div style="background:#fff;border-radius:12px;border:1.5px solid #fecaca;color:#b91c1c;padding:14px">Error carregant fecapa-categories.json: ${esc(err?.message || "desconegut")}</div>`;
  }
}

async function getAdminClassificationSourcePilotsModel({ force = false } = {}) {
  if (!force && classificationSourcePilotsDB) return classificationSourcePilotsDB;
  const res = await fetch(`${CLASSIFICATION_SOURCE_PILOTS_URL}?t=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`No s'ha pogut carregar ${CLASSIFICATION_SOURCE_PILOTS_URL} (${res.status})`);
  }
  classificationSourcePilotsDB = await res.json();
  return classificationSourcePilotsDB;
}

function pilotKey(pilot) {
  return [
    String(pilot?.jokCompId || "").trim(),
    String(pilot?.fecapaCompetitionId || "").trim(),
    normalizeCompKey(pilot?.preferredGroupToken || ""),
  ].join("::");
}

function buildAuditDerivedPilots(audit) {
  const derived = [];
  const seen = new Set();

  for (const entry of (audit?.competitions || [])) {
    for (const grp of (entry?.groups || [])) {
      if (!grp?.jokcatOutdated) continue;

      const jokCompId = String(grp.jokcatCompId || grp.suggestedJokcatCompId || "").trim();
      const fecapaCompetitionId = String(entry?.competitionId || entry?.fecapaCompetitionId || "").trim();
      if (!jokCompId || !fecapaCompetitionId) continue;

      const preferredGroupToken = String(grp.fecapaGroupName || grp.groupName || grp.fecapaGroupId || entry?.competitionName || "").trim();
      const pilot = {
        jokCompId,
        fecapaCompetitionId,
        preferredGroupToken,
        source: "audit_outdated",
      };

      const key = pilotKey(pilot);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      derived.push(pilot);
    }
  }

  return derived;
}

function mergePilotsWithPriority(primaryPilots, fallbackPilots) {
  const out = [];
  const seen = new Set();
  for (const pilot of [...(primaryPilots || []), ...(fallbackPilots || [])]) {
    const key = pilotKey(pilot);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(pilot);
  }
  return out;
}

async function renderAdminClassificationSourcePilotsPanel(body) {
  body.innerHTML = `${renderAdminTopNav("source_pilots")}<div style="text-align:center;padding:32px;color:#94a3b8">Carregant pilots...</div>`;
  try {
    const model = await getAdminClassificationSourcePilotsModel({ force: true });
    let fecapaModel = null;
    try {
      fecapaModel = await getAdminFecapaCategoriesModel({ force: false });
    } catch {
      fecapaModel = null;
    }

    const pilots = getClassificationSourcePilots();
    const derivedPilotsCount = pilots.filter(p => p?.source === "audit_outdated").length;
    const uniqueJok = new Set(pilots.map(p => String(p?.jokCompId || "")).filter(Boolean)).size;
    const uniqueFecapa = new Set(pilots.map(p => String(p?.fecapaCompetitionId || "")).filter(Boolean)).size;

    const jokComps = Object.values(DB?.categories || {}).flat().filter(Boolean);
    const jokById = new Map(jokComps.map(c => [String(c?.id || ""), c]));

    const fecapaComps = Object.values(fecapaModel?.categories || fecapaCategoriesDB?.categories || {})
      .flat()
      .filter(Boolean);
    const fecapaById = new Map(fecapaComps.map(c => [String(c?.competitionId || ""), c]));

    const resolveFecapaGroup = pilot => {
      const comp = fecapaById.get(String(pilot?.fecapaCompetitionId || ""));
      if (!comp) return { comp: null, group: null };

      const token = normalizeCompKey(pilot?.preferredGroupToken || "");
      const groups = Array.isArray(comp?.groups) ? comp.groups : [];
      if (!token) return { comp, group: null };

      const group = groups.find(g => normalizeCompKey(g?.groupName || "").includes(token)) || null;
      return { comp, group };
    };

    body.innerHTML = `
      ${renderAdminTopNav("source_pilots")}
      <div style="background:#fff;border-radius:12px;border:1.5px solid #e2e6ef;padding:12px 14px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;color:#1a2035">Pilot mappings jok.cat → FECAPA</div>
            <div style="font-size:12px;color:#64748b">${pilots.length} mappings · ${derivedPilotsCount} derivats de JOK desactualitzat · ${uniqueJok} jok IDs · ${uniqueFecapa} FECAPA competicions</div>
          </div>
          <button onclick="adminReloadClassificationSourcePilots()" style="background:#1a2035;border:none;color:#fff;font-weight:700;font-size:12px;padding:9px 12px;border-radius:9px;cursor:pointer">Recarregar</button>
        </div>
      </div>
      <details open style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px 12px;margin-bottom:12px">
        <summary style="cursor:pointer;font-weight:700;color:#1a2035">Mappings actius (${pilots.length})</summary>
        <div style="margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px">
          ${pilots.map(p => {
            const jokComp = jokById.get(String(p?.jokCompId || "")) || null;
            const { comp: fecapaComp, group: fecapaGroup } = resolveFecapaGroup(p);
            const jokGroupName = jokComp?.name || "No trobat";
            const fecapaCompName = fecapaComp?.competitionName || "No trobada";
            const fecapaGroupName = fecapaGroup?.groupName || "No resolt";
            const fecapaGroupId = fecapaGroup?.groupId ? ` (#${fecapaGroup.groupId})` : "";
            const derivedTag = p?.source === "audit_outdated"
              ? `<span style="font-size:10px;color:#1d4ed8;background:#dbeafe;border:1px solid #bfdbfe;border-radius:999px;padding:2px 6px;font-weight:700">audit · FECAPA-first</span>`
              : "";

            return `<div style="border:1px solid #e2e6ef;border-radius:10px;padding:8px 10px;background:#f8fafc">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:3px">
                <div style="font-size:11px;color:#0f766e;font-weight:800;text-transform:uppercase;letter-spacing:.05em">jok.cat</div>
                ${derivedTag}
              </div>
              <div style="font-size:12px;color:#1a2035;font-weight:700">ID ${esc(String(p?.jokCompId || "?"))}</div>
              <div style="font-size:11px;color:#475569">Grup/Lliga: ${esc(jokGroupName)}</div>

              <div style="height:1px;background:#e2e8f0;margin:6px 0"></div>

              <div style="font-size:11px;color:#1d4ed8;font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">FECAPA</div>
              <div style="font-size:12px;color:#1a2035;font-weight:700">Comp ${esc(String(p?.fecapaCompetitionId || "?"))}</div>
              <div style="font-size:11px;color:#475569">Competició: ${esc(fecapaCompName)}</div>
              <div style="font-size:11px;color:#475569">Grup: ${esc(fecapaGroupName)}${esc(fecapaGroupId)}</div>
              <div style="font-size:11px;color:#64748b">Token: ${esc(String(p?.preferredGroupToken || ""))}</div>
            </div>`;
          }).join("") || `<div style="font-size:12px;color:#94a3b8">Sense mappings</div>`}
        </div>
      </details>
      <details style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px 12px">
        <summary style="cursor:pointer;font-weight:700;color:#1a2035">Model de dades JSON (${esc(CLASSIFICATION_SOURCE_PILOTS_URL)})</summary>
        <pre style="margin-top:10px;white-space:pre-wrap;word-break:break-word;background:#0f172a;color:#e2e8f0;border-radius:10px;padding:10px;font-size:11px;line-height:1.5">${esc(JSON.stringify(model, null, 2))}</pre>
      </details>`;
  } catch (err) {
    body.innerHTML = `${renderAdminTopNav("source_pilots")}<div style="background:#fff;border-radius:12px;border:1.5px solid #fecaca;color:#b91c1c;padding:14px">Error carregant pilots: ${esc(err?.message || "desconegut")}</div>`;
  }
}

function renderAdminBenjamiTable(group) {
  return `<div style="overflow-x:auto;background:#fff;border-radius:12px;border:1.5px solid #e2e6ef;margin-bottom:14px">
    <div style="padding:12px 12px 8px;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#1a2035">${esc(group.groupName)}</div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="border-top:1px solid #e2e6ef;border-bottom:1px solid #e2e6ef;background:#f8fafc">
          <th style="padding:8px 6px;text-align:left;font-size:11px;color:#64748b">#</th>
          <th style="padding:8px 6px;text-align:left;font-size:11px;color:#64748b">Equip</th>
          <th style="padding:8px 6px;text-align:center;font-size:11px;color:#64748b">Pts</th>
          <th style="padding:8px 6px;text-align:center;font-size:11px;color:#64748b">J</th>
          <th style="padding:8px 6px;text-align:center;font-size:11px;color:#64748b">G</th>
          <th style="padding:8px 6px;text-align:center;font-size:11px;color:#64748b">E</th>
          <th style="padding:8px 6px;text-align:center;font-size:11px;color:#64748b">P</th>
          <th style="padding:8px 6px;text-align:center;font-size:11px;color:#64748b">F</th>
          <th style="padding:8px 6px;text-align:center;font-size:11px;color:#64748b">C</th>
          <th style="padding:8px 6px;text-align:center;font-size:11px;color:#64748b">Gav</th>
        </tr>
      </thead>
      <tbody>
        ${group.teams.map(team => `<tr style="border-bottom:1px solid #f0f2f8">
          <td style="padding:8px 6px;font-size:12px;font-weight:700;color:#334155">${team.position ?? "-"}</td>
          <td style="padding:8px 6px">
            <div style="font-size:12px;font-weight:600;color:#1a2035">${esc(team.teamName)}</div>
            ${team.teamShort ? `<div style="font-size:10px;color:#94a3b8">${esc(team.teamShort)}</div>` : ""}
          </td>
          <td style="padding:8px 6px;text-align:center;font-size:12px;font-weight:700;color:#e5001c">${team.points ?? "-"}</td>
          <td style="padding:8px 6px;text-align:center;font-size:12px">${team.played ?? "-"}</td>
          <td style="padding:8px 6px;text-align:center;font-size:12px">${team.won ?? "-"}</td>
          <td style="padding:8px 6px;text-align:center;font-size:12px">${team.drawn ?? "-"}</td>
          <td style="padding:8px 6px;text-align:center;font-size:12px">${team.lost ?? "-"}</td>
          <td style="padding:8px 6px;text-align:center;font-size:12px">${team.goalsFor ?? "-"}</td>
          <td style="padding:8px 6px;text-align:center;font-size:12px">${team.goalsAgainst ?? "-"}</td>
          <td style="padding:8px 6px;text-align:center;font-size:12px">${team.goalDiff ?? "-"}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`;
}

async function renderAdminBenjamiPanel(body) {
  body.innerHTML = `${renderAdminTopNav("benjami")}<div style="text-align:center;padding:32px;color:#94a3b8">Carregant classificació...</div>`;
  try {
    const model = await getAdminBenjamiModel();
    body.innerHTML = `
      ${renderAdminTopNav("benjami")}
      <div style="background:#fff;border-radius:12px;border:1.5px solid #e2e6ef;padding:12px 14px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;color:#1a2035">Representació desacoblada del HTML</div>
            <div style="font-size:12px;color:#64748b">${esc(model.competition)} · ${model.groupCount} grups · ${model.teamCount} equips</div>
          </div>
          <button onclick="adminReloadBenjamiModel()" style="background:#1a2035;border:none;color:#fff;font-weight:700;font-size:12px;padding:9px 12px;border-radius:9px;cursor:pointer">Recarregar HTML</button>
        </div>
      </div>
      ${model.groups.map(renderAdminBenjamiTable).join("")}
      <details style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px 12px">
        <summary style="cursor:pointer;font-weight:700;color:#1a2035">Model de dades JSON</summary>
        <pre style="margin-top:10px;white-space:pre-wrap;word-break:break-word;background:#0f172a;color:#e2e8f0;border-radius:10px;padding:10px;font-size:11px;line-height:1.5">${esc(JSON.stringify(model, null, 2))}</pre>
      </details>`;
  } catch (err) {
    body.innerHTML = `${renderAdminTopNav("benjami")}<div style="background:#fff;border-radius:12px;border:1.5px solid #fecaca;color:#b91c1c;padding:14px">Error carregant classificació: ${esc(err?.message || "desconegut")}</div>`;
  }
}

function openAdminPanel() {
  ["screen-home","screen-picker","screen-detail","screen-acta"].forEach(id => $(id).style.display = "none");
  $("screen-admin").style.display = "flex";
  adminPanelView = "mapping";
  renderAdminPanel();
}
function closeAdminPanel() {
  $("screen-admin").style.display = "none";
  renderHome();
}

// ── Auditoria FECAPA ↔ jok.cat ────────────────────────────────
let adminAuditCache = null;
const AUDIT_FEEDBACK_KEY = "hoquei_audit_feedback_v1";

function loadAuditFeedback() {
  try { return JSON.parse(localStorage.getItem(AUDIT_FEEDBACK_KEY) || "{}"); }
  catch { return {}; }
}

function saveAuditFeedback(feedback) {
  localStorage.setItem(AUDIT_FEEDBACK_KEY, JSON.stringify(feedback));
}

function downloadableAuditFeedbackPayload() {
  const all = loadAuditFeedback();
  const nonEmpty = Object.fromEntries(
    Object.entries(all).filter(([, v]) => v && (v.verdict || (v.manualJokcatGroupId || "").trim()))
  );
  return {
    schemaVersion: 1,
    source: "audit_ui_local_export",
    exportedAt: new Date().toISOString(),
    actor: currentUser?.email || null,
    auditBuiltAt: adminAuditCache?.builtAt || null,
    totalMatches: Object.keys(nonEmpty).length,
    matches: nonEmpty,
  };
}

function auditDomKey(compId, groupKey) {
  return String(`${compId}__${groupKey}`).replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function getAdminAuditData({ force = false } = {}) {
  if (!force && adminAuditCache) return adminAuditCache;
  const res = await fetch(`./classification-audit.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`No s'ha pogut carregar classification-audit.json (${res.status})`);
  const data = await res.json();
  adminAuditCache = data;
  return data;
}

async function getAdminEntityMappingData({ force = false } = {}) {
  if (!force && adminEntityMappingCache) return adminEntityMappingCache;
  const res = await fetch(`./entity-mapping.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`No s'ha pogut carregar entity-mapping.json (${res.status})`);
  const data = await res.json();
  adminEntityMappingCache = data;
  return data;
}

function isGoldenCatVisualName(value) {
  const normalized = normalizeAuditSearchText(value);
  return normalized.includes("goldencat") || normalized.includes("golden cat");
}

function inferAuditCategoryKey(entry, grp) {
  const raw = String(entry?.category || "").toLowerCase();
  const base = raw && raw !== "altres" ? raw : null;
  if (base) return base;

  const text = normalizeAuditSearchText([
    entry?.competitionName,
    grp?.groupName,
    grp?.jokcatCompName,
    grp?.suggestedJokcatCompName,
  ].filter(Boolean).join(" "));

  if (text.includes("prebenjami")) return "prebenjami";
  if (text.includes("benjami")) return "benjami";
  if (text.includes("alevi")) return "alevi";
  if (text.includes("infantil")) return "infantil";
  if (text.includes("juvenil")) return "juvenil";
  if (text.includes("junior")) return "junior";
  if (text.includes("veterans")) return "veterans";
  if (text.includes("fem")) return "fem";
  if (text.includes("primera catalana")) return "primera_catalana";
  if (text.includes("segona catalana")) return "segona_catalana";
  if (text.includes("tercera catalana")) return "tercera_catalana";
  if (text.includes("nacional catalana")) return "nacional_catalana";
  return raw || "altres";
}

window.adminMappingToggleIssueFilter = (filterKey, checked) => {
  adminMappingIssueFilters = {
    ...adminMappingIssueFilters,
    [filterKey]: !!checked,
  };
  renderAdminPanel();
};

function renderAuditFreshnessTag(isFresh, isOutdated, reason) {
  if (isOutdated === true || isFresh === false) {
    const reasonText = reason === "team_pj_lag" || reason === "global_and_team_pj_lag"
      ? " · PJ equips"
      : reason === "global_jornada_lag"
        ? " · Jornades"
        : "";
    return `<span style="background:#fef9c3;color:#854d0e;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;letter-spacing:.03em">jok desactualitzat${reasonText}</span>`;
  }
  if (isFresh === true)  return `<span style="background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;letter-spacing:.03em">jok al dia</span>`;
  return `<span style="background:#f1f5f9;color:#94a3b8;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;letter-spacing:.03em">?</span>`;
}

function normalizeAuditSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`´]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeAuditMappingName(value) {
  return normalizeAuditSearchText(value)
    .replace(/\(\d{4}\s*-\s*\d{2,4}\)/g, " ")
    .replace(/\b\d{4}\s*-\s*\d{2,4}\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasSameNameMapping(entry, grp) {
  const jokName = normalizeAuditMappingName(grp?.jokcatCompName || grp?.suggestedJokcatCompName || "");
  if (!jokName) return false;
  const candidates = [
    normalizeAuditMappingName(entry?.competitionName || ""),
    normalizeAuditMappingName(grp?.groupName || ""),
  ].filter(Boolean);
  return candidates.some(name => name === jokName || name.includes(jokName) || jokName.includes(name));
}

function auditGroupMatchesQuery(entry, grp, queryNorm) {
  if (!queryNorm) return true;
  const haystack = normalizeAuditSearchText([
    entry.competitionName,
    entry.competitionId,
    grp.groupName,
    grp.fecapaGroupId,
    grp.groupId,
    grp.jokcatCompId,
    grp.suggestedJokcatCompId,
    grp.jokcatCompName,
    grp.suggestedJokcatCompName,
  ].filter(Boolean).join(" "));
  return haystack.includes(queryNorm);
}

function prepareAuditCompetitionForView(entry, queryNorm) {
  const compHaystack = normalizeAuditSearchText(`${entry.competitionName || ""} ${entry.competitionId || ""}`);
  const showAllGroups = queryNorm && compHaystack.includes(queryNorm);
  const filteredGroups = showAllGroups || !queryNorm
    ? (entry.groups || [])
    : (entry.groups || []).filter(grp => auditGroupMatchesQuery(entry, grp, queryNorm));

  if (!filteredGroups.length) return null;

  const fecapaGroups = filteredGroups.filter(g => g.fecapaGroupId || g.groupId);
  const groupsOk = fecapaGroups.length;
  const groupsMissing = filteredGroups.length - groupsOk;
  const groupsWithMatching = fecapaGroups.filter(g => !!g.jokcatCompId).length;
  const groupsWithoutMatching = groupsOk - groupsWithMatching;
  return {
    ...entry,
    groups: filteredGroups,
    groupsOk,
    groupsMissing,
    groupsWithMatching,
    groupsWithoutMatching,
    hasIncomplete: groupsWithoutMatching > 0,
  };
}

function buildAuditEntryFromGroups(entry, groups) {
  const fecapaGroups = groups.filter(g => g.fecapaGroupId || g.groupId);
  const groupsOk = fecapaGroups.length;
  const groupsMissing = groups.length - groupsOk;
  const groupsWithMatching = fecapaGroups.filter(g => !!g.jokcatCompId).length;
  const groupsWithoutMatching = groupsOk - groupsWithMatching;
  return {
    ...entry,
    groups,
    groupsOk,
    groupsMissing,
    groupsWithMatching,
    groupsWithoutMatching,
    hasIncomplete: groupsWithoutMatching > 0,
  };
}

function buildAuditCategoryBuckets(entries) {
  const byCategory = new Map();
  for (const entry of entries || []) {
    const key = entry.category || "altres";
    if (!byCategory.has(key)) byCategory.set(key, { key, missing: [], matched: [] });
    const bucket = byCategory.get(key);

    const missingGroups = (entry.groups || []).filter(g => {
      const isFecapaGroup = Boolean(g.fecapaGroupId || g.groupId);
      if (!isFecapaGroup) return true;
      return !g.jokcatCompId;
    });
    const matchedGroups = (entry.groups || []).filter(g => {
      const isFecapaGroup = Boolean(g.fecapaGroupId || g.groupId);
      return isFecapaGroup && !!g.jokcatCompId;
    });

    if (missingGroups.length) bucket.missing.push(buildAuditEntryFromGroups(entry, missingGroups));
    if (matchedGroups.length) bucket.matched.push(buildAuditEntryFromGroups(entry, matchedGroups));
  }

  const order = [
    "nacional_catalana", "primera_catalana", "segona_catalana", "tercera_catalana",
    "fem", "junior", "juvenil", "infantil", "alevi", "benjami", "prebenjami", "veterans",
  ];
  const orderIndex = new Map(order.map((k, i) => [k, i]));
  return [...byCategory.values()].sort((a, b) => {
    const ai = orderIndex.has(a.key) ? orderIndex.get(a.key) : 999;
    const bi = orderIndex.has(b.key) ? orderIndex.get(b.key) : 999;
    if (ai !== bi) return ai - bi;
    return String(a.key).localeCompare(String(b.key));
  });
}

function renderAuditTable(rows, source) {
  const normalizedRows = (rows || []).map((t, i) => ({
    pos: t.pos ?? t.position ?? i + 1,
    team: t.team ?? t.teamName ?? "",
    pts: t.pts ?? t.points ?? null,
    pj: t.pj ?? t.played ?? null,
    pg: t.pg ?? t.won ?? null,
    pe: t.pe ?? t.drawn ?? null,
    pp: t.pp ?? t.lost ?? null,
    gf: t.gf ?? t.goalsFor ?? null,
    gc: t.gc ?? t.goalsAgainst ?? null,
  }));

  if (!normalizedRows.length) return `<div style="padding:10px;color:#94a3b8;font-size:12px">Sense classificació (${source})</div>`;

  return `<table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e6ef">
      <th style="padding:5px 4px;text-align:left;color:#64748b;font-weight:600">#</th>
      <th style="padding:5px 4px;text-align:left;color:#64748b;font-weight:600">Equip</th>
      <th style="padding:5px 4px;text-align:center;color:#64748b;font-weight:600">Pts</th>
      <th style="padding:5px 4px;text-align:center;color:#64748b;font-weight:600">J</th>
      <th style="padding:5px 4px;text-align:center;color:#64748b;font-weight:600">G</th>
      <th style="padding:5px 4px;text-align:center;color:#64748b;font-weight:600">E</th>
      <th style="padding:5px 4px;text-align:center;color:#64748b;font-weight:600">P</th>
      <th style="padding:5px 4px;text-align:center;color:#64748b;font-weight:600">Avg</th>
    </tr></thead>
    <tbody>${normalizedRows.map(t => {
      const avg = calcGoalAverage(t.gf, t.gc);
      const avgColor = goalAverageColor(avg);
      return `<tr style="border-bottom:1px solid #f8fafc">
      <td style="padding:4px 4px;font-weight:700;color:#334155">${t.pos ?? "-"}</td>
      <td style="padding:4px 4px;color:#1a2035;font-weight:500">${esc(normalizeJokClubDisplayName(t.team))}</td>
      <td style="padding:4px 4px;text-align:center;font-weight:700;color:#e5001c">${t.pts ?? "-"}</td>
      <td style="padding:4px 4px;text-align:center">${t.pj ?? "-"}</td>
      <td style="padding:4px 4px;text-align:center">${t.pg ?? "-"}</td>
      <td style="padding:4px 4px;text-align:center">${t.pe ?? "-"}</td>
      <td style="padding:4px 4px;text-align:center">${t.pp ?? "-"}</td>
      <td style="padding:4px 4px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:800;color:${avgColor}">${formatGoalAverage(avg)}</td>
    </tr>`;
    }).join("")}</tbody>
  </table>`;
}

function renderAuditFeedbackPanel(entry, grp, idx) {
  const groupKey = grp.fecapaGroupId || grp.groupId || `${grp.groupName || "group"}_${idx}`;
  const encodedGroupKey = encodeURIComponent(groupKey);
  const domKey = auditDomKey(entry.competitionId, encodedGroupKey);
  const feedbackKey = `${entry.competitionId}::${groupKey}`;
  const saved = loadAuditFeedback()[feedbackKey] || {};

  return `<div style="background:#fff;border:1.5px dashed #cbd5e1;border-radius:10px;padding:8px;min-width:220px">
    <div style="font-size:11px;color:#334155;font-weight:700;margin-bottom:6px">Match manual</div>
    <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:4px">
      <input id="audit-correct-${domKey}" type="checkbox" ${saved.verdict === "correct" ? "checked" : ""} onchange="auditToggleCorrect('${domKey}')" />
      Correcte
    </label>
    <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:6px">
      <input id="audit-incorrect-${domKey}" type="checkbox" ${saved.verdict === "incorrect" ? "checked" : ""} onchange="auditToggleIncorrect('${domKey}')" />
      Incorrecte
    </label>
    <input id="audit-jokid-${domKey}" type="text" value="${esc(saved.manualJokcatGroupId || grp.suggestedJokcatCompId || "")}" placeholder="ID grup/lliga jok.cat" style="width:100%;padding:6px 8px;border:1.5px solid #e2e6ef;border-radius:8px;font-size:12px;margin-bottom:6px" />
    <button onclick="auditSaveFeedback('${entry.competitionId}','${encodedGroupKey}','${domKey}')" style="width:100%;background:#1a2035;border:none;color:#fff;font-weight:700;font-size:12px;padding:7px 10px;border-radius:8px;cursor:pointer">Guardar</button>
    <div id="audit-msg-${domKey}" style="margin-top:6px;font-size:11px;color:#16a34a">${saved.updatedAt ? `Desat local: ${new Date(saved.updatedAt).toLocaleString("ca-ES")}` : ""}</div>
  </div>`;
}

function renderAuditGroupRow(entry, grp, idx) {
  const isMissing = grp.status === "fecapa_missing";
  const freshnessTag = renderAuditFreshnessTag(grp.isFresh, grp.jokcatOutdated, grp.freshnessReason);
  const groupKey = grp.fecapaGroupId || grp.groupId || `${grp.groupName || "group"}_${idx}`;
  const feedbackKey = `${entry.competitionId}::${groupKey}`;
  const feedback = loadAuditFeedback()[feedbackKey] || null;
  const fecapaRows = grp.fecapaClassification || [];
  const jokRows = grp.jokcatClassification || grp.suggestedJokcatClassification || [];
  const effectiveJokId = grp.jokcatCompId || grp.suggestedJokcatCompId || "—";
  const effectiveJokName = normalizeJokClubDisplayName(grp.jokcatCompName || grp.suggestedJokcatCompName || "—");
  const effectiveCalc = grp.coincidenceCalc || grp.suggestedCoincidenceCalc || "matched/max(FECAPA,JOK)";
  const effectiveRatio = grp.jokcatMatchRatio || grp.suggestedJokcatMatchRatio || 0;
  const ratioLabel = isMissing ? "solapament equips (competicio FECAPA)" : "coincidencia";
  const ratioCalc = isMissing
    ? effectiveCalc.replace("matched/max(FECAPA,JOK)", "matched/max(FECAPA_comp,JOK)")
    : effectiveCalc;
  const rightSourceTag = grp.jokcatCompId
    ? `<span style="background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px">jok match</span>`
    : grp.suggestedJokcatCompId
      ? `<span style="background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px">jok suggerit</span>`
      : `<span style="background:#f1f5f9;color:#64748b;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px">sense jok</span>`;
  const feedbackBadge = feedback?.verdict === "correct"
    ? `<span style="background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px">Manual: Correcte</span>`
    : feedback?.verdict === "incorrect"
      ? `<span style="background:#fee2e2;color:#991b1b;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px">Manual: Incorrecte</span>`
      : "";

  const idsInfo = `<span style="font-size:10px;color:#64748b">FECAPA ID: ${esc(grp.fecapaGroupId || grp.groupId || "—")}</span>
    <span style="font-size:10px;color:#64748b">jok ID: ${esc(effectiveJokId)}</span>
    <span style="font-size:10px;color:#64748b">jok nom: ${esc(effectiveJokName)}</span>`;

  return `<div style="border:1.5px solid ${isMissing ? "#fde68a" : "#e2e6ef"};border-radius:10px;margin-bottom:10px;overflow:hidden">
    <div style="padding:8px 10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:${isMissing ? "#fffbeb" : "#f8fafc"}">
      ${isMissing ? `<span style="background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px">jok fallback</span>` : `<span style="background:#eff6ff;color:#1e40af;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px">FECAPA↔jok</span>`}
      ${rightSourceTag}
      ${freshnessTag}
      ${feedbackBadge}
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:#1a2035">${esc(grp.groupName)}</span>
      ${idsInfo}
      ${effectiveRatio > 0 ? `<span style="font-size:10px;color:#94a3b8">${ratioLabel}: ${effectiveRatio}% · ${esc(ratioCalc)}</span>` : ""}
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 240px minmax(0,1fr);gap:8px;padding:8px">
      <div style="border:1px solid #e2e6ef;border-radius:8px;overflow:auto">
        <div style="padding:6px 8px;background:#f8fafc;border-bottom:1px solid #e2e6ef;font-size:11px;font-weight:700;color:#334155">FECAPA</div>
        ${renderAuditTable(fecapaRows, "fecapa")}
      </div>
      ${renderAuditFeedbackPanel(entry, grp, idx)}
      <div style="border:1px solid #e2e6ef;border-radius:8px;overflow:auto">
        <div style="padding:6px 8px;background:#f8fafc;border-bottom:1px solid #e2e6ef;font-size:11px;font-weight:700;color:#334155">jok.cat ${grp.jokcatCompId ? "(matching)" : (grp.suggestedJokcatCompId ? "(suggerit)" : "")}</div>
        ${renderAuditTable(jokRows, "jok")}
      </div>
    </div>
  </div>`;
}

function renderAuditCompetition(entry) {
  const statusIcon = entry.hasIncomplete ? "⚠️" : "✅";
  const fecapaSide = entry.groups.filter(g => g.fecapaGroupId || g.groupId);
  const jokOnly = entry.groups.filter(g => !g.fecapaGroupId && !g.groupId);
  const groupsHtml = fecapaSide.map((g, idx) => renderAuditGroupRow(entry, g, idx)).join("");
  const jokOnlyHtml = jokOnly.length ? `<details style="margin:8px 0 0;border:1.5px dashed #cbd5e1;border-radius:10px;padding:8px">
    <summary style="cursor:pointer;font-size:12px;font-weight:700;color:#475569">Grups jok.cat sense parella FECAPA (${jokOnly.length})</summary>
    <div style="margin-top:8px">${jokOnly.map((g, idx) => renderAuditGroupRow(entry, g, idx + fecapaSide.length)).join("")}</div>
  </details>` : "";
  return `<details style="background:#fff;border-radius:12px;border:1.5px solid ${entry.hasIncomplete ? "#fde68a" : "#e2e6ef"};margin-bottom:10px">
    <summary style="padding:12px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;list-style:none">
      <span style="font-size:15px">${statusIcon}</span>
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;color:#1a2035;flex:1">${esc(entry.competitionName)}</span>
      <span style="font-size:11px;color:#64748b">${entry.groupsWithMatching ?? 0}/${entry.groupsOk} grups amb matching${entry.groupsWithoutMatching > 0 ? ` · ${entry.groupsWithoutMatching} sense matching` : ""}${entry.groupsMissing > 0 ? ` · +${entry.groupsMissing} jok fallback` : ""} · ${entry.fecapaTeamCount} equips</span>
    </summary>
    <div style="padding:0 10px 10px">${groupsHtml}${jokOnlyHtml}</div>
  </details>`;
}

async function renderAdminAuditPanel(body) {
  body.innerHTML = `${renderAdminTopNav("audit")}<div style="text-align:center;padding:32px;color:#94a3b8">Carregant auditoria...</div>`;
  try {
    const audit = await getAdminAuditData({ force: false });
    const queryNorm = normalizeAuditSearchText(adminAuditSearchQuery);
    const filteredCompetitions = (audit.competitions || [])
      .map(entry => prepareAuditCompetitionForView(entry, queryNorm))
      .filter(Boolean);
    const byCategory = buildAuditCategoryBuckets(filteredCompetitions);
    const builtAt = audit.builtAt ? new Date(audit.builtAt).toLocaleString("ca-ES") : "—";

    const categoryBlocksHtml = byCategory.map(cat => {
      const missingGroupsCount = cat.missing.reduce((acc, e) => acc + (e.groupsWithoutMatching || 0) + (e.groupsMissing || 0), 0);
      const matchedGroupsCount = cat.matched.reduce((acc, e) => acc + (e.groupsWithMatching || 0), 0);
      return `<section style="margin-bottom:16px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:#1a2035;margin:0 2px 8px;text-transform:uppercase;letter-spacing:.06em">${esc(adminCategoryLabel(cat.key))}</div>
        ${cat.missing.length ? `<div style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:800;color:#92400e;margin:0 2px 8px;text-transform:uppercase;letter-spacing:.05em">⚠️ Sense matching (${missingGroupsCount})</div>${cat.missing.map(renderAuditCompetition).join("")}` : `<div style="font-size:12px;color:#94a3b8;margin:0 2px 8px">Sense grups pendents de matching</div>`}
        ${cat.matched.length ? `<div style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:800;color:#166534;margin:10px 2px 8px;text-transform:uppercase;letter-spacing:.05em">✅ Amb matching (${matchedGroupsCount})</div>${cat.matched.map(renderAuditCompetition).join("")}` : ""}
      </section>`;
    }).join("");

    body.innerHTML = `
      ${renderAdminTopNav("audit")}
      <div style="background:#fff;border-radius:12px;border:1.5px solid #e2e6ef;padding:12px 14px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;color:#1a2035">Auditoria FECAPA ↔ jok.cat</div>
            <div style="font-size:12px;color:#64748b">
              Generat: ${builtAt} ·
              ${audit.totalGroupsOk} grups FECAPA ·
              ${audit.totalGroupsMissing} grups jok fallback ·
              <span style="color:#166534">${audit.totalFresh} frescos</span> ·
              <span style="color:#854d0e">${audit.totalStale} desfasats</span>
            </div>
            <div style="font-size:11px;color:#94a3b8;margin-top:3px">Mostrant ${filteredCompetitions.length} de ${(audit.competitions || []).length} competicions</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" value="${esc(adminAuditSearchQuery)}" oninput="adminAuditSetSearch(this.value)" placeholder="Cercar grup, FECAPA ID, jok ID, nom..." style="width:min(320px,68vw);padding:8px 10px;border:1.5px solid #e2e6ef;border-radius:9px;font-size:12px;font-family:inherit;outline:none" />
            <button onclick="adminExportAuditFeedback()" style="background:#0f766e;border:none;color:#fff;font-weight:700;font-size:12px;padding:9px 12px;border-radius:9px;cursor:pointer">Exportar feedback</button>
            <button onclick="adminClearAuditFeedback()" style="background:#f8fafc;border:1.5px solid #e2e6ef;color:#475569;font-weight:700;font-size:12px;padding:8px 11px;border-radius:9px;cursor:pointer">Netejar local</button>
            <button onclick="adminReloadAudit()" style="background:#1a2035;border:none;color:#fff;font-weight:700;font-size:12px;padding:9px 12px;border-radius:9px;cursor:pointer">Recarregar</button>
          </div>
        </div>
        <div style="margin-top:8px;font-size:11px;color:#94a3b8">MVP: exporta el JSON i puja'l a .github/audit-feedback/inbox/ per executar el workflow manual de processament.</div>
      </div>
      ${filteredCompetitions.length === 0 ? `<div style="background:#fff;border-radius:12px;border:1.5px solid #e2e6ef;padding:14px;color:#64748b;font-size:12px">Sense resultats per a la cerca actual.</div>` : ""}
      ${filteredCompetitions.length ? categoryBlocksHtml : ""}`;
  } catch (err) {
    body.innerHTML = `${renderAdminTopNav("audit")}<div style="background:#fff;border-radius:12px;border:1.5px solid #fecaca;color:#b91c1c;padding:14px">
      Error carregant auditoria: ${esc(err?.message || "desconegut")}<br>
      <small style="color:#94a3b8">Executa: node api/build-classification-audit.js</small>
    </div>`;
  }
}

async function renderAdminMappingHubPanel(body) {
  body.innerHTML = `${renderAdminTopNav("mapping")}<div style="text-align:center;padding:32px;color:#94a3b8">Carregant dades de mapeig...</div>`;

  const [fecapaRes, pilotsRes, auditRes, mappingRes] = await Promise.allSettled([
    getAdminFecapaCategoriesModel({ force: false }),
    getAdminClassificationSourcePilotsModel({ force: false }),
    getAdminAuditData({ force: false }),
    getAdminEntityMappingData({ force: false }),
  ]);

  const warnings = [];
  const fecapaModel = fecapaRes.status === "fulfilled" ? fecapaRes.value : null;
  const pilotsModel = pilotsRes.status === "fulfilled" ? pilotsRes.value : { pilots: [] };
  const audit = auditRes.status === "fulfilled" ? auditRes.value : null;
  const entityMapping = mappingRes.status === "fulfilled" ? mappingRes.value : null;

  if (fecapaRes.status === "rejected") warnings.push(`FECAPA categories: ${fecapaRes.reason?.message || "error"}`);
  if (pilotsRes.status === "rejected") warnings.push(`Pilots: ${pilotsRes.reason?.message || "error"}`);
  if (auditRes.status === "rejected") warnings.push(`Auditoria: ${auditRes.reason?.message || "error"}`);
  if (mappingRes.status === "rejected") warnings.push(`Entity mapping: ${mappingRes.reason?.message || "error"}`);

  const jokComps = [];
  for (const [catKey, comps] of Object.entries(DB?.categories || {})) {
    for (const comp of comps || []) jokComps.push({ ...comp, _categoryKey: catKey });
  }
  const jokById = new Map(jokComps.map(c => [String(c?.id || ""), c]));

  const fecapaComps = Object.values(fecapaModel?.categories || {}).flat().filter(Boolean);
  const fecapaById = new Map(fecapaComps.map(c => [String(c?.competitionId || ""), c]));

  const jokTeamCount = new Set(jokComps.flatMap(c => (c.classification || []).map(r => normalizeCompKey(r?.team || "")).filter(Boolean))).size;
  const fecapaTeamCount = fecapaComps.reduce((acc, c) => acc + Number(c?.teamCount || 0), 0);
  const fecapaGroupCount = fecapaComps.reduce((acc, c) => acc + (Array.isArray(c?.groups) ? c.groups.length : 0), 0);
  const jokGroupCount = audit ? Number(audit.totalGroupsOk || 0) + Number(audit.totalGroupsMissing || 0) : jokComps.length;
  const jokPlayersCount = Object.keys(DB?.jugadors || {}).length;
  const jokActesCount = Object.keys(DB?.actesIndex || {}).length;

  const mappingRows = [
    { label: "Competicions", jok: jokComps.length, fecapa: fecapaComps.length },
    { label: "Grups", jok: jokGroupCount, fecapa: fecapaGroupCount },
    { label: "Equips (aprox. únics)", jok: jokTeamCount, fecapa: fecapaTeamCount },
    { label: "Jugadors", jok: jokPlayersCount, fecapa: "—" },
    { label: "Actes", jok: jokActesCount, fecapa: "—" },
  ];

  if (entityMapping?.summary) {
    const bySource = type => (entityMapping?.mappings?.[type] || []).reduce((acc, row) => {
      const src = row?.source || "other";
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {});
    const cmp = bySource("competition");
    const grp = bySource("group");
    const team = bySource("team");
    mappingRows.push(
      { label: "IDs canònics competicions", jok: cmp.jok || 0, fecapa: cmp.fecapa || 0 },
      { label: "IDs canònics grups", jok: grp.jok || 0, fecapa: grp.fecapa || 0 },
      { label: "IDs canònics equips", jok: team.jok || 0, fecapa: team.fecapa || 0 }
    );
  }

  const allGroups = [];
  for (const entry of audit?.competitions || []) {
    (entry.groups || []).forEach((grp, idx) => {
      if (isGoldenCatVisualName(entry?.competitionName) || isGoldenCatVisualName(grp?.groupName) || isGoldenCatVisualName(grp?.jokcatCompName) || isGoldenCatVisualName(grp?.suggestedJokcatCompName)) {
        return;
      }

      const isFecapaGroup = Boolean(grp.fecapaGroupId || grp.groupId);
      const hasFinal = Boolean(grp.jokcatCompId);
      const hasSuggested = Boolean(grp.suggestedJokcatCompId);
      const ratio = Number(grp.jokcatMatchRatio || grp.suggestedJokcatMatchRatio || 0);
      const fecapaRows = Array.isArray(grp.fecapaClassification) ? grp.fecapaClassification.length : 0;
      const mappingOkButFecapaEmpty = isFecapaGroup && !hasFinal && hasSuggested && fecapaRows === 0 && hasSameNameMapping(entry, grp);

      const issueTypes = [];
      let status = "ok";
      let reason = "Mapeig correcte";
      if (!isFecapaGroup) {
        status = "error";
        issueTypes.push("error");
        reason = "Grup només detectat a jok.cat (sense grup FECAPA equivalent)";
      } else if (mappingOkButFecapaEmpty) {
        status = "ok";
        issueTypes.push("mapping_ok_fecapa_empty");
        reason = "Mapping OK però FECAPA buit (mateix nom)";
      } else if (!hasFinal && hasSuggested) {
        status = "error";
        issueTypes.push("error");
        reason = `Sense matching definitiu. Suggerència automàtica (${ratio}% coincidència)`;
      } else if (!hasFinal) {
        status = "error";
        issueTypes.push("error");
        reason = "Sense matching automàtic ni suggerència prou forta";
      } else {
        if (ratio > 0 && ratio < 70) {
          issueTypes.push("warning");
          status = "warning";
          reason = `Coincidència baixa (${ratio}%)`;
        }
        if (grp.jokcatOutdated) {
          issueTypes.push("outdated");
          status = status === "error" ? status : "warning";
          reason = grp.freshnessReason === "team_pj_lag" || grp.freshnessReason === "global_and_team_pj_lag"
            ? "JOK desactualitzat en PJ"
            : "JOK desactualitzat en jornades";
        }
        if (issueTypes.length === 0) {
          status = "ok";
          reason = "Mapeig correcte";
        }
      }

      const groupKey = grp.fecapaGroupId || grp.groupId || `${grp.groupName || "group"}_${idx}`;
      allGroups.push({ entry, grp, idx, groupKey, status, reason, ratio, issueTypes, displayCategory: inferAuditCategoryKey(entry, grp) });
    });
  }

  const visibleGroups = allGroups;
  const issueGroups = visibleGroups.filter(x => x.issueTypes.some(t => adminMappingIssueFilters[t]));
  const okGroups = visibleGroups.filter(x => x.status === "ok");
  const visibleIssueCounts = visibleGroups.reduce((acc, row) => {
    for (const key of row.issueTypes) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { error: 0, warning: 0, outdated: 0, mapping_ok_fecapa_empty: 0 });

  const groupedByCategory = groups => {
    const map = new Map();
    for (const row of groups) {
      const k = row.displayCategory || inferAuditCategoryKey(row.entry, row.grp);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(row);
    }
    return [...map.entries()].sort((a, b) => adminCategoryLabel(a[0]).localeCompare(adminCategoryLabel(b[0])));
  };

  const renderAuditRowCompact = (row, isOpenByDefault = false) => {
    const { entry, grp, idx, reason, ratio, status, issueTypes } = row;
    const color = status === "error" ? "#b91c1c" : status === "warning" ? "#92400e" : "#166534";
    const bg = status === "error" ? "#fef2f2" : status === "warning" ? "#fffbeb" : "#f0fdf4";
    const effectiveJokId = grp.jokcatCompId || grp.suggestedJokcatCompId || "—";
    const effectiveJokName = normalizeJokClubDisplayName(grp.jokcatCompName || grp.suggestedJokcatCompName || "—");
    const domKey = auditDomKey(entry.competitionId, encodeURIComponent(row.groupKey));
    const suggestion = grp.suggestedJokcatCompId
      ? `<div style="font-size:11px;color:#475569;margin-bottom:8px">Suggerit: jok ID ${esc(String(grp.suggestedJokcatCompId))} · ${esc(normalizeJokClubDisplayName(grp.suggestedJokcatCompName || ""))} (${Number(grp.suggestedJokcatMatchRatio || 0)}%)</div>`
      : "";

    return `<details ${isOpenByDefault ? "open" : ""} style="background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;margin-bottom:8px">
      <summary style="cursor:pointer;list-style:none;padding:9px 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:${bg}">
        <span style="font-size:10px;font-weight:800;color:${color};text-transform:uppercase">${status}</span>
        ${issueTypes.includes("warning") ? `<span style="background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px">warning</span>` : ""}
        ${issueTypes.includes("outdated") ? `<span style="background:#dbeafe;color:#1d4ed8;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px">JOK desactualitzat</span>` : ""}
        ${issueTypes.includes("mapping_ok_fecapa_empty") ? `<span style="background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px">Mapping OK · FECAPA buit</span>` : ""}
        <span style="font-size:12px;font-weight:700;color:#1a2035">${esc(entry.competitionName)}</span>
        <span style="font-size:11px;color:#475569">FECAPA: ${esc(grp.groupName || "—")}</span>
        <span style="font-size:11px;color:#475569">jok: ${esc(effectiveJokName)}</span>
        <span style="font-size:11px;color:#64748b">% coincidència: ${ratio || 0}%</span>
        <span style="font-size:11px;color:${color};font-weight:700">${esc(reason)}</span>
      </summary>
      <div style="padding:10px">
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
          <span style="font-size:11px;color:#64748b">FECAPA ID grup: ${esc(String(grp.fecapaGroupId || grp.groupId || "—"))}</span>
          <span style="font-size:11px;color:#64748b">jok ID: ${esc(String(effectiveJokId))}</span>
          <span style="font-size:11px;color:#64748b">Càlcul: ${esc(grp.coincidenceCalc || grp.suggestedCoincidenceCalc || "matched/max(FECAPA,JOK)")}</span>
        </div>
        ${suggestion}
        <div style="display:grid;grid-template-columns:minmax(0,1fr) 240px minmax(0,1fr);gap:8px">
          <div style="border:1px solid #e2e6ef;border-radius:8px;overflow:auto">
            <div style="padding:6px 8px;background:#f8fafc;border-bottom:1px solid #e2e6ef;font-size:11px;font-weight:700;color:#334155">FECAPA</div>
            ${renderAuditTable(grp.fecapaClassification || [], "fecapa")}
          </div>
          ${renderAuditFeedbackPanel(entry, grp, idx)}
          <div style="border:1px solid #e2e6ef;border-radius:8px;overflow:auto">
            <div style="padding:6px 8px;background:#f8fafc;border-bottom:1px solid #e2e6ef;font-size:11px;font-weight:700;color:#334155">jok.cat</div>
            ${renderAuditTable(grp.jokcatClassification || grp.suggestedJokcatClassification || [], "jok")}
          </div>
        </div>
      </div>
    </details>`;
  };

  const pilots = getClassificationSourcePilots();
  const incidentRowOpenByDefault = row => {
    if (adminMappingIncidentExpandAll === true) return true;
    if (adminMappingIncidentExpandAll === false) return false;
    return row.status === "error";
  };
  const pilotByCategory = new Map();
  for (const p of pilots) {
    const jokComp = jokById.get(String(p?.jokCompId || "")) || null;
    if (isGoldenCatVisualName(jokComp?.name || "")) continue;
    const catKey = jokComp?._categoryKey || inferAuditCategoryKey({ competitionName: jokComp?.name || "" }, null) || "altres";
    if (!pilotByCategory.has(catKey)) pilotByCategory.set(catKey, []);

    const comp = fecapaById.get(String(p?.fecapaCompetitionId || "")) || null;
    const token = normalizeCompKey(p?.preferredGroupToken || "");
    const group = (comp?.groups || []).find(g => normalizeCompKey(g?.groupName || "").includes(token)) || null;

    pilotByCategory.get(catKey).push({
      jokName: jokComp?.name || "No trobat",
      jokId: p?.jokCompId || "",
      fecapaCompName: comp?.competitionName || "No trobada",
      fecapaCompId: p?.fecapaCompetitionId || "",
      fecapaGroupName: group?.groupName || "No resolt",
      fecapaGroupId: group?.groupId || "",
      token: p?.preferredGroupToken || "",
    });
  }

  const pilotCategoryBlocks = [...pilotByCategory.entries()]
    .sort((a, b) => adminCategoryLabel(a[0]).localeCompare(adminCategoryLabel(b[0])))
    .map(([catKey, rows]) => `<details style="background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:8px 10px;margin-bottom:8px">
      <summary style="cursor:pointer;font-weight:700;color:#1a2035">${esc(adminCategoryLabel(catKey))} · ${rows.length} mappings</summary>
      <div style="margin-top:8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px">
        ${rows.map(r => `<div style="border:1px solid #e2e6ef;border-radius:9px;padding:8px;background:#f8fafc">
          <div style="font-size:11px;color:#0f766e;font-weight:800;text-transform:uppercase">jok.cat</div>
          <div style="font-size:12px;color:#1a2035;font-weight:700">${esc(r.jokName)}</div>
          <div style="font-size:11px;color:#64748b">ID ${esc(String(r.jokId))}</div>
          <div style="height:1px;background:#e2e8f0;margin:6px 0"></div>
          <div style="font-size:11px;color:#1d4ed8;font-weight:800;text-transform:uppercase">FECAPA</div>
          <div style="font-size:12px;color:#1a2035;font-weight:700">${esc(r.fecapaCompName)}</div>
          <div style="font-size:11px;color:#64748b">Comp ID ${esc(String(r.fecapaCompId))}</div>
          <div style="font-size:11px;color:#475569">Grup: ${esc(r.fecapaGroupName)}${r.fecapaGroupId ? ` (#${esc(String(r.fecapaGroupId))})` : ""}</div>
          <div style="font-size:11px;color:#64748b">Token: ${esc(String(r.token))}</div>
        </div>`).join("")}
      </div>
    </details>`)
    .join("");

  const lowConfidence = issueGroups
    .filter(g => !g.grp?.jokcatCompId)
    .sort((a, b) => Number(a.ratio || 0) - Number(b.ratio || 0))
    .slice(0, 10);

  body.innerHTML = `
    ${renderAdminTopNav("mapping")}
    ${warnings.length ? `<div style="background:#fff7ed;border:1.5px solid #fdba74;color:#9a3412;border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:12px">⚠️ Algunes fonts no s'han pogut carregar: ${esc(warnings.join(" · "))}</div>` : ""}

    <section style="background:#fff;border-radius:12px;border:1.5px solid #e2e6ef;padding:12px 14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        <div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;color:#1a2035">Hub únic de mapeig FECAPA ↔ jok.cat</div>
          <div style="font-size:12px;color:#64748b">Flux recomanat: 1) incidències, 2) resum, 3) pilots, 4) regles, 5) prioritats.</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="adminReloadMappingHub()" style="background:#1a2035;border:none;color:#fff;font-weight:700;font-size:12px;padding:9px 12px;border-radius:9px;cursor:pointer">Recarregar tot</button>
          <button onclick="adminExportAuditFeedback()" style="background:#0f766e;border:none;color:#fff;font-weight:700;font-size:12px;padding:9px 12px;border-radius:9px;cursor:pointer">Exportar feedback</button>
          <button onclick="adminClearAuditFeedback()" style="background:#f8fafc;border:1.5px solid #e2e6ef;color:#475569;font-weight:700;font-size:12px;padding:8px 11px;border-radius:9px;cursor:pointer">Netejar feedback local</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px">
        <div style="background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:8px"><div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Grups FECAPA</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#1a2035">${okGroups.length + issueGroups.length}</div></div>
        <div style="background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:8px"><div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Errors</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#b91c1c">${visibleIssueCounts.error}</div></div>
        <div style="background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:8px"><div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Warnings</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#92400e">${visibleIssueCounts.warning}</div></div>
        <div style="background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:8px"><div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">JOK desactualitzat</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#1d4ed8">${visibleIssueCounts.outdated}</div></div>
        <div style="background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:8px"><div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Mapping OK · FECAPA buit</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#166534">${visibleIssueCounts.mapping_ok_fecapa_empty}</div></div>
        <div style="background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:8px"><div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Correctes</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#166534">${okGroups.length}</div></div>
        <div style="background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:8px"><div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Pilots</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:#1a2035">${pilots.length}</div></div>
      </div>
      <div style="margin-top:8px;font-size:11px;color:#64748b;background:#f8fafc;border:1px solid #e2e6ef;border-radius:8px;padding:7px 9px">
        Recomanació d'ús: revisa primer incidències obertes, aplica revisió manual/suggerència, i després valida pilots i regles.
      </div>
    </section>

    <details style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px 12px;margin-bottom:12px">
      <summary style="cursor:pointer;font-weight:800;color:#1a2035">2) Resum de mapeig per source</summary>
      <div style="margin-top:10px;overflow:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e6ef"><th style="padding:8px;text-align:left">Mètrica</th><th style="padding:8px;text-align:center">jok.cat</th><th style="padding:8px;text-align:center">FECAPA</th></tr></thead>
          <tbody>
            ${mappingRows.map(r => `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px;color:#334155">${esc(r.label)}</td><td style="padding:8px;text-align:center;font-weight:700;color:#0f766e">${esc(String(r.jok))}</td><td style="padding:8px;text-align:center;font-weight:700;color:#1d4ed8">${esc(String(r.fecapa))}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-top:8px">${entityMapping ? `Entity mapping generat: ${esc(entityMapping.generatedAt || "—")}` : "No hi ha entity-mapping.json disponible (executa npm run build:mapping)."}</div>
    </details>

    <details open style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px 12px;margin-bottom:12px">
      <summary style="cursor:pointer;font-weight:800;color:#1a2035">1) Incidències de mapeig per grup (amb motiu) + revisió manual</summary>
      <div style="margin-top:10px">
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;align-items:center">
          ${[
            ["error", "Error", "#b91c1c"],
            ["warning", "Warning", "#92400e"],
            ["outdated", "JOK desactualitzat", "#1d4ed8"],
            ["mapping_ok_fecapa_empty", "Mapping OK però FECAPA buit", "#166534"],
          ].map(([key, label, color]) => `<label style="display:inline-flex;align-items:center;gap:6px;background:#f8fafc;border:1px solid #e2e6ef;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;color:${color};cursor:pointer"><input type="checkbox" ${adminMappingIssueFilters[key] ? "checked" : ""} onchange="adminMappingToggleIssueFilter('${key}', this.checked)" style="accent-color:${color}" />${label}</label>`).join("")}
          <button onclick="adminMappingToggleIncidents(true)" style="background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;font-weight:700;font-size:12px;padding:6px 10px;border-radius:999px;cursor:pointer">Descol·lapsar tot</button>
          <button onclick="adminMappingToggleIncidents(false)" style="background:#f8fafc;border:1px solid #e2e6ef;color:#475569;font-weight:700;font-size:12px;padding:6px 10px;border-radius:999px;cursor:pointer">Col·lapsar tot</button>
        </div>
        <input type="text" value="${esc(adminAuditSearchQuery)}" oninput="adminAuditSetSearch(this.value)" placeholder="Filtra per competició, grup, ID o nom..." style="width:100%;padding:8px 10px;border:1.5px solid #e2e6ef;border-radius:9px;font-size:12px;font-family:inherit;outline:none;margin-bottom:8px" />
        ${(groupedByCategory(issueGroups)).map(([cat, rows]) => `<details open style="border:1px solid #e2e6ef;border-radius:10px;padding:8px;margin-bottom:8px"><summary style="cursor:pointer;font-weight:700;color:#92400e">${esc(adminCategoryLabel(cat))} · ${rows.length} incidències</summary><div style="margin-top:8px">${rows.map(r => renderAuditRowCompact(r, incidentRowOpenByDefault(r))).join("")}</div></details>`).join("") || `<div style="font-size:12px;color:#166534">No hi ha incidències amb el filtre actual.</div>`}
        <details style="border:1px solid #e2e6ef;border-radius:10px;padding:8px;margin-top:10px">
          <summary style="cursor:pointer;font-weight:700;color:#166534">Correctes (col·lapsat) · ${okGroups.length}</summary>
          <div style="margin-top:8px">${(groupedByCategory(okGroups)).map(([cat, rows]) => `<details style="border:1px solid #e2e6ef;border-radius:9px;padding:6px;margin-bottom:7px"><summary style="cursor:pointer;font-size:12px;font-weight:700;color:#166534">${esc(adminCategoryLabel(cat))} · ${rows.length}</summary><div style="margin-top:7px">${rows.slice(0, 30).map(r => renderAuditRowCompact(r, false)).join("")}${rows.length > 30 ? `<div style="font-size:11px;color:#94a3b8">Mostrant 30 de ${rows.length} grups correctes.</div>` : ""}</div></details>`).join("")}</div>
        </details>
      </div>
    </details>

    <details open style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px 12px;margin-bottom:12px">
      <summary style="cursor:pointer;font-weight:800;color:#1a2035">3) Pilots (resum simple per categoria)</summary>
      <div style="margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-bottom:10px">
        ${[...pilotByCategory.entries()].sort((a, b) => adminCategoryLabel(a[0]).localeCompare(adminCategoryLabel(b[0]))).map(([cat, rows]) => `<div style="background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:8px"><div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">${esc(adminCategoryLabel(cat))}</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;color:#1a2035">${rows.length}</div></div>`).join("") || `<div style="font-size:12px;color:#94a3b8">Sense pilots carregats</div>`}
      </div>
      ${pilotCategoryBlocks || `<div style="font-size:12px;color:#94a3b8">Sense detall de pilots.</div>`}
    </details>

    <details style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px 12px;margin-bottom:12px">
      <summary style="cursor:pointer;font-weight:800;color:#1a2035">4) Regles de mapeig (lectura ràpida)</summary>
      <div style="margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px">
        <div style="border:1px solid #e2e6ef;border-radius:10px;padding:9px;background:#f8fafc"><div style="font-size:11px;font-weight:800;color:#1a2035">Prioritat de font</div><div style="font-size:12px;color:#475569;margin-top:4px">Prebenjamí (no 3x3) es força a FECAPA. Per la resta, es conserva jok o FECAPA segons matching i regles de pilot.</div></div>
        <div style="border:1px solid #e2e6ef;border-radius:10px;padding:9px;background:#f8fafc"><div style="font-size:11px;font-weight:800;color:#1a2035">Coincidència equips</div><div style="font-size:12px;color:#475569;margin-top:4px">El % de coincidència es calcula per solapament d'equips: matched/max(FECAPA,JOK). Serveix per suggerir mappings.</div></div>
        <div style="border:1px solid #e2e6ef;border-radius:10px;padding:9px;background:#f8fafc"><div style="font-size:11px;font-weight:800;color:#1a2035">Pilots jok→FECAPA</div><div style="font-size:12px;color:#475569;margin-top:4px">Els pilots tenen prioritat per grups concrets via jokCompId + fecapaCompetitionId + token de grup.</div></div>
        <div style="border:1px solid #e2e6ef;border-radius:10px;padding:9px;background:#f8fafc"><div style="font-size:11px;font-weight:800;color:#1a2035">Desactualització</div><div style="font-size:12px;color:#475569;margin-top:4px">Si jok.cat està desfasat en jornades o PJ, el mapping pot ser correcte però marcat com warning.</div></div>
      </div>
    </details>

    <details style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px 12px;margin-bottom:12px">
      <summary style="cursor:pointer;font-weight:800;color:#1a2035">5) Ajuda de gestió: prioritats recomanades</summary>
      <div style="margin-top:10px">
        ${lowConfidence.length ? `<div style="font-size:12px;color:#64748b;margin-bottom:8px">Top incidències amb menys confiança (suggerides per revisar primer):</div>
          <div style="display:grid;grid-template-columns:1fr;gap:6px">
            ${lowConfidence.map(item => `<div style="border:1px solid #e2e6ef;border-radius:9px;padding:7px;background:#f8fafc">
              <div style="font-size:12px;font-weight:700;color:#1a2035">${esc(item.entry.competitionName)}</div>
              <div style="font-size:11px;color:#475569">${esc(item.grp.groupName || "—")} · coincidència ${Number(item.ratio || 0)}% · motiu: ${esc(item.reason)}</div>
            </div>`).join("")}
          </div>` : `<div style="font-size:12px;color:#166534">No hi ha incidències de baixa confiança pendents.</div>`}
      </div>
    </details>
  `;
}

window.auditToggleCorrect = domKey => {
  const a = $(`audit-correct-${domKey}`);
  const b = $(`audit-incorrect-${domKey}`);
  if (a?.checked && b) b.checked = false;
};
window.auditToggleIncorrect = domKey => {
  const a = $(`audit-correct-${domKey}`);
  const b = $(`audit-incorrect-${domKey}`);
  if (b?.checked && a) a.checked = false;
};
window.auditSaveFeedback = (compId, encodedGroupKey, domKey) => {
  const groupKey = decodeURIComponent(encodedGroupKey);
  const feedbackKey = `${compId}::${groupKey}`;
  const correct = $(`audit-correct-${domKey}`)?.checked;
  const incorrect = $(`audit-incorrect-${domKey}`)?.checked;
  const manualJokcatGroupId = ($(`audit-jokid-${domKey}`)?.value || "").trim();

  const verdict = correct ? "correct" : incorrect ? "incorrect" : null;
  const all = loadAuditFeedback();
  all[feedbackKey] = {
    competitionId: compId,
    groupKey,
    verdict,
    manualJokcatGroupId,
    updatedAt: new Date().toISOString(),
  };
  saveAuditFeedback(all);

  const msg = $(`audit-msg-${domKey}`);
  if (msg) {
    msg.style.color = "#92400e";
    msg.textContent = `Desat local. Per aplicar al JSON d'auditoria, copia-ho a classification-audit-feedback.json i reexecuta el build.`;
  }
};

async function renderAdminPanel() {
  const body = $("admin-body");
  if (["mapping", "fecapa_cats", "source_pilots", "audit"].includes(adminPanelView)) {
    await renderAdminMappingHubPanel(body);
    return;
  }

  body.innerHTML = `${renderAdminTopNav("users")}<div style="text-align:center;padding:32px;color:#94a3b8">Carregant usuaris...</div>`;
  const { data: profiles, error } = await _sb.rpc("get_all_profiles_admin", { admin_email: currentUser?.email });
  if (error || !profiles) { body.innerHTML = `${renderAdminTopNav("users")}<div style="color:#e5001c;padding:16px">Error: ${esc(error?.message||"Sense accés")}</div>`; return; }
  const rows = profiles.map(p => `
    <tr style="border-bottom:1px solid #f0f4f8">
      <td style="padding:10px 8px;font-size:13px;color:#1a2035;font-weight:500;word-break:break-all">${esc(p.email)}</td>
      <td style="padding:10px 8px;text-align:center">
        <select onchange="updateUserRole('${esc(p.id)}',this.value)"
          style="border:1.5px solid #e2e6ef;border-radius:8px;padding:5px 8px;font-size:13px;font-family:inherit;cursor:pointer">
          ${ROLE_OPTIONS.map(r => `<option value="${r}" ${p.role===r?"selected":""}>${esc(getRoleLabel(r, r))}</option>`).join("")}
        </select>
      </td>
      <td style="padding:10px 8px;font-size:12px;color:#64748b">${esc(p.team_name||"")}</td>
      <td style="padding:10px 8px;text-align:center">
        <button onclick="adminDeleteUser('${esc(p.id)}')" title="Eliminar" style="background:none;border:none;color:#e5001c;cursor:pointer;font-size:15px;line-height:1;padding:2px 6px">✕</button>
      </td>
    </tr>`).join("");
  body.innerHTML = `
    ${renderAdminTopNav("users")}
    <div style="background:#fff;border-radius:12px;border:1.5px solid #e2e6ef;padding:16px;margin-bottom:16px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.06em;margin-bottom:12px">Afegir / editar usuari</div>
      <input id="admin-add-email" type="email" placeholder="email@exemple.com"
        style="width:100%;padding:10px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;margin-bottom:8px;font-family:inherit;outline:none"/>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <select id="admin-add-role" onchange="adminToggleTeamField()"
          style="flex:1;border:1.5px solid #e2e6ef;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;cursor:pointer">
          <option value="">Sense rol</option>
          <option value="entrenador">Entrenador</option>
          <option value="coordinador">Coordinador</option>
          <option value="gestor_botiga">Gestor de botiga</option>
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
window.adminSetView = view => {
  adminPanelView = ["mapping", "fecapa_cats", "source_pilots", "audit"].includes(view) ? "mapping" : "users";
  renderAdminPanel();
};
window.adminReloadBenjamiModel = () => {
  adminBenjamiModelCache = null;
  renderAdminPanel();
};
window.adminReloadFecapaCategories = () => {
  adminFecapaCategoriesCache = null;
  renderAdminPanel();
};
window.adminReloadAudit = async () => {
  adminAuditCache = null;
  try {
    await getAdminAuditData({ force: true });
  } catch {}
  applyClassificationSourceMerge();
  renderAdminPanel();
};
window.adminReloadClassificationSourcePilots = () => {
  classificationSourcePilotsDB = null;
  renderAdminPanel();
};
window.adminReloadMappingHub = async () => {
  adminFecapaCategoriesCache = null;
  adminAuditCache = null;
  adminEntityMappingCache = null;
  classificationSourcePilotsDB = null;
  adminMappingIncidentExpandAll = null;
  try {
    await getAdminAuditData({ force: true });
  } catch {}
  applyClassificationSourceMerge();
  renderAdminPanel();
};
window.adminAuditSetSearch = value => {
  adminAuditSearchQuery = String(value || "");
  if (adminAuditSearchTimer) clearTimeout(adminAuditSearchTimer);
  adminAuditSearchTimer = setTimeout(() => {
    renderAdminPanel();
  }, 220);
};
window.adminExportAuditFeedback = () => {
  const payload = downloadableAuditFeedbackPayload();
  if (!payload.totalMatches) {
    alert("No hi ha feedback local per exportar.");
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const actor = (currentUser?.email || "anon").replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `audit-feedback-${actor}-${stamp}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
window.adminClearAuditFeedback = () => {
  if (!confirm("Vols esborrar tot el feedback local d'auditoria?")) return;
  saveAuditFeedback({});
  renderAdminPanel();
};
window.adminMappingToggleIncidents = shouldExpand => {
  adminMappingIncidentExpandAll = !!shouldExpand;
  renderAdminPanel();
};

let DB      = null;
let venuesDB = null;
let fecapaCategoriesDB = null;
let classificationSourcePilotsDB = null;
let currentJugadorId = null;
let homeTab = "favs"; // "favs" | "all" | "club"
let seasonCatalog = [{ key: "current", label: "Actual", dataUrl: DATA_URL, actesBaseUrl: "./actes" }];
let activeSeasonKey = "current";
const seasonDataCache = new Map();
const globalJugadorsIndex = new Map();
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
const PLAYER_FAV_META_KEY = "hoquei_player_fav_meta_v1";
let playerFavs = [];
try { playerFavs = JSON.parse(localStorage.getItem(PLAYER_FAV_KEY)||"[]"); } catch {}
let playerFavMeta = {};
try { playerFavMeta = JSON.parse(localStorage.getItem(PLAYER_FAV_META_KEY)||"{}"); } catch {}
const savePlayerFavs  = () => localStorage.setItem(PLAYER_FAV_KEY, JSON.stringify(playerFavs));
const savePlayerFavMeta = () => localStorage.setItem(PLAYER_FAV_META_KEY, JSON.stringify(playerFavMeta));
const isPlayerFav     = jid => playerFavs.includes(jid);

function rememberPlayerFavMeta(jid, explicitName = null) {
  const key = String(jid || "").trim();
  if (!key) return;
  const p = getPlayerById(key);
  const slug = p?.slug ? decodeURIComponent(String(p.slug).replace(/\+/g, " ")) : "";
  const name = explicitName || (slug ? formatPlayerDisplayName(slug) : "") || playerFavMeta?.[key]?.name || `Jugador ${key}`;
  const team = normalizePlayerTeamStatsForDisplay(p)?.[0] || null;
  playerFavMeta[key] = {
    name,
    team: team?.team || playerFavMeta?.[key]?.team || "",
    cat: team?.cat || playerFavMeta?.[key]?.cat || "",
    updatedAt: new Date().toISOString(),
  };
  savePlayerFavMeta();
}

function togglePlayerFav(jid) {
  if (isPlayerFav(jid)) {
    playerFavs = playerFavs.filter(id=>id!==jid);
    delete playerFavMeta[String(jid)];
    savePlayerFavMeta();
    _removeFavFromCloud("player", jid);
  } else {
    playerFavs.push(jid);
    rememberPlayerFavMeta(jid);
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
const decodeHtml = s => String(s||"").replace(/&#039;/g,"'").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"');

function getSeasonLabelFromData(data, fallback = "Temporada") {
  const seasonRaw = data?.season;
  if (typeof seasonRaw === "string" && seasonRaw.trim()) return seasonRaw.trim();
  if (Array.isArray(seasonRaw) && seasonRaw.length) return String(seasonRaw[0] || fallback).trim() || fallback;
  return fallback;
}

function stripSeasonSuffix(name) {
  return String(name || "")
    .replace(/\s*\((?:20\d{2})-(?:\d{2,4})\)\s*$/, "")
    .trim();
}

async function fetchJsonFile(url) {
  const raw = String(url || "").trim();
  const urls = [raw];
  if (raw.startsWith("./")) urls.push(raw.slice(2));
  else if (raw && !raw.startsWith("/") && !raw.startsWith("http")) urls.push(`./${raw}`);

  let lastStatus = null;
  for (const candidate of [...new Set(urls)].filter(Boolean)) {
    const res = await fetch(`${candidate}${candidate.includes("?") ? "&" : "?"}t=${Date.now()}`);
    if (res.ok) return res.json();
    lastStatus = res.status;
  }

  throw new Error(`HTTP ${lastStatus || 404} carregant ${raw}`);
}

function mergePlayerSources(a = [], b = []) {
  const merged = [];
  const seen = new Set();
  for (const src of [...a, ...b]) {
    const key = `${src?.type || ""}::${src?.id || ""}`;
    if (!src || seen.has(key)) continue;
    seen.add(key);
    merged.push(src);
  }
  return merged;
}

function mergePlayerRecord(base, incoming) {
  if (!base) return incoming;
  if (!incoming) return base;
  const out = { ...base, ...incoming };

  const baseCareer = Array.isArray(base.careerStats) ? base.careerStats : [];
  const inCareer = Array.isArray(incoming.careerStats) ? incoming.careerStats : [];
  out.careerStats = inCareer.length >= baseCareer.length ? inCareer : baseCareer;

  const baseTeamStats = Array.isArray(base.teamStats) ? base.teamStats : [];
  const inTeamStats = Array.isArray(incoming.teamStats) ? incoming.teamStats : [];
  out.teamStats = inTeamStats.length >= baseTeamStats.length ? inTeamStats : baseTeamStats;

  out.sources = mergePlayerSources(base.sources, incoming.sources);
  return out;
}

function rebuildGlobalJugadorsIndex() {
  globalJugadorsIndex.clear();
  for (const data of seasonDataCache.values()) {
    const jugadors = data?.jugadors || {};
    for (const [jid, player] of Object.entries(jugadors)) {
      const prev = globalJugadorsIndex.get(jid);
      globalJugadorsIndex.set(jid, mergePlayerRecord(prev, player));
    }
  }
}

function getPlayerById(jid, options = {}) {
  const { allowCrossSeason = false } = options || {};
  const key = String(jid || "").trim();
  if (!key) return null;
  return DB?.jugadors?.[key] || (allowCrossSeason ? globalJugadorsIndex.get(key) : null) || null;
}

function getAllPlayersEntries(options = {}) {
  const { allowCrossSeason = false } = options || {};
  if (DB?.jugadors) {
    return Object.entries(DB.jugadors);
  }
  if (!allowCrossSeason) return [];
  return Array.from(globalJugadorsIndex.entries());
}

function saveSelectedSeasonKey(key) {
  try { localStorage.setItem(SELECTED_SEASON_KEY, String(key || "current")); } catch {}
}

function loadSelectedSeasonKey() {
  try { return localStorage.getItem(SELECTED_SEASON_KEY) || "current"; } catch { return "current"; }
}

function getActiveSeasonLabel() {
  const item = seasonCatalog.find(s => s.key === activeSeasonKey) || seasonCatalog[0] || null;
  return item?.label || getSeasonLabelFromData(DB, "Temporada");
}

function getActiveSeasonEntry() {
  return seasonCatalog.find(s => s.key === activeSeasonKey) || seasonCatalog[0] || null;
}

function normalizeActesBaseUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

function inferArchiveActesBaseUrl(seasonKey) {
  const key = String(seasonKey || "").trim();
  if (!key || key === "current") return "./actes";
  return `./season-archive/actes/${key}`;
}

function getSeasonActesBaseUrl(seasonKey = activeSeasonKey) {
  const entry = seasonCatalog.find(s => s.key === seasonKey) || null;
  if (entry?.actesBaseUrl) return normalizeActesBaseUrl(entry.actesBaseUrl);
  return normalizeActesBaseUrl(inferArchiveActesBaseUrl(seasonKey));
}

function setGlobalLoadingState(isLoading, noteText = "Carregant dades...") {
  const loading = $("screen-loading");
  const note = $("loading-note");
  if (note) note.textContent = noteText;

  if (isLoading) {
    ["screen-home", "screen-picker", "screen-detail", "screen-acta", "screen-team", "screen-admin"].forEach(id => {
      const el = $(id);
      if (el) el.style.display = "none";
    });
    if (loading) loading.style.display = "flex";
    return;
  }

  if (loading) loading.style.display = "none";
}

async function loadSeasonCatalog() {
  let manifest = null;
  try {
    manifest = await fetchJsonFile(SEASON_MANIFEST_URL);
  } catch {
    manifest = null;
  }

  const fromManifest = Array.isArray(manifest?.seasons) ? manifest.seasons : [];
  const normalized = fromManifest
    .map((s, idx) => ({
      key: String(s?.key || s?.season || `archive-${idx + 1}`).trim(),
      label: String(s?.label || s?.season || `Arxiu ${idx + 1}`).trim(),
      dataUrl: String(s?.dataUrl || "").trim(),
      actesBaseUrl: normalizeActesBaseUrl(s?.actesBaseUrl || s?.actesUrl || ""),
    }))
    .filter(s => s.key && s.dataUrl);

  seasonCatalog = [{
    key: "current",
    label: getSeasonLabelFromData(DB, "Actual"),
    dataUrl: DATA_URL,
    actesBaseUrl: "./actes",
  }, ...normalized
    .filter(s => s.key !== "current")
    .map(s => ({
      ...s,
      actesBaseUrl: s.actesBaseUrl || inferArchiveActesBaseUrl(s.key),
    }))];

  // Always start app on current season; previous selection should not override startup default.
  activeSeasonKey = "current";
}

async function switchActiveSeason(nextKey, options = {}) {
  const { showLoading = true } = options;
  const target = seasonCatalog.find(s => s.key === nextKey);
  if (!target) return;
  if (activeSeasonKey === nextKey) return;

  const prevSeasonKey = activeSeasonKey;
  const prevDb = DB;

  if (showLoading) {
    setGlobalLoadingState(true, `Carregant temporada ${target.label}...`);
  }

  try {
    if (!seasonDataCache.has(nextKey)) {
      const data = await fetchJsonFile(target.dataUrl);
      if (!data?.categories) throw new Error(`Dataset invàlid per ${target.label}`);
      seasonDataCache.set(nextKey, data);
      rebuildGlobalJugadorsIndex();
    }

    DB = seasonDataCache.get(nextKey);
    activeSeasonKey = nextKey;
    allOnlyActive = activeSeasonKey === "current";
    _nameMap = null;
    _nameMapNorm = null;
    _clubTokenToIds = null;
    saveSelectedSeasonKey(nextKey);
    applyClassificationSourceMerge();
    runIdentityRegressionChecks();
    detailComp = null;
    detailTeam = null;
    detailTeamId = null;
    selectedClub = null;
    homeTab = "favs";
    renderHome();
  } catch (err) {
    DB = prevDb;
    activeSeasonKey = prevSeasonKey;
    throw err;
  } finally {
    if (showLoading) {
      setGlobalLoadingState(false);
    }
  }
}

async function getSeasonDataForKey(seasonKey) {
  const key = String(seasonKey || "").trim();
  if (!key) return null;
  if (seasonDataCache.has(key)) return seasonDataCache.get(key) || null;

  const target = seasonCatalog.find(s => s.key === key);
  if (!target?.dataUrl) return null;

  try {
    const data = await fetchJsonFile(target.dataUrl);
    if (!data?.categories) return null;
    seasonDataCache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

window.onSeasonSelectChange = async (value) => {
  try {
    await switchActiveSeason(String(value || "current"));
  } catch (err) {
    console.error("season-switch error", err);
    alert(`No s'ha pogut canviar de temporada: ${err?.message || "error desconegut"}`);
  }
};

function normalizeJokClubDisplayName(name) {
  return String(name || "")
    .replace(/&#0*39;|&apos;|&rsquo;/gi, "'")
    .replace(/[’`´]/g, "'")
    .replace(/\s*'\s*/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPlayerDisplayName(rawName) {
  if (!rawName) return "?";
  return String(rawName)
    .normalize("NFC")
    .toLocaleLowerCase("ca")
    .replace(/(^|[\s'’\-])(\p{L})/gu, (m, sep, letter) => `${sep}${letter.toLocaleUpperCase("ca")}`)
    .replace(/\s+/g, " ")
    .trim();
}

function shortTeamDisplayName(name) {
  return normalizeJokClubDisplayName(name)
    .replace(/^(Club Hoquei |CH |Cp |Club Patí )/gi, "")
    .trim();
}

function normalizeTeamKeyForMatching(name) {
  return normalizeTeamName(shortTeamDisplayName(name || ""))
    .replace(/\bhoquei\b/g, "")
    .replace(/\bphc\b/g, "")
    .replace(/\bhc\b/g, "")
    .replace(/\bch\b/g, "")
    .replace(/\bclub\b/g, "")
    .replace(/\bpati\b/g, "")
    .replace(/\bcp\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const TEAM_SQUAD_SUFFIX_RE = /\s+([A-Z])$/i;

function teamMatchesLoose(a, b) {
  const ka = normalizeTeamKeyForMatching(a);
  const kb = normalizeTeamKeyForMatching(b);
  if (!ka || !kb) return false;
  const sa = extractTeamSuffix(a);
  const sb = extractTeamSuffix(b);
  // If both sides have explicit team letters, do not merge different squads (e.g. Ripollet B vs C).
  if (sa && sb && sa !== sb) return false;
  // If only one side has an explicit squad suffix and the base is the same,
  // avoid collapsing a specific squad into a generic club entry.
  if ((sa && !sb) || (!sa && sb)) {
    const baseA = normalizeTeamNameStrict(getTeamBase(a));
    const baseB = normalizeTeamNameStrict(getTeamBase(b));
    if (baseA && baseB && baseA === baseB) return false;
  }
  return ka === kb || ka.includes(kb) || kb.includes(ka);
}

function normalizeTeamNameStrict(name) {
  return normalizeTeamName(shortTeamDisplayName(name || ""));
}

function extractTeamSuffix(name) {
  const m = String(name || "").match(TEAM_SQUAD_SUFFIX_RE);
  return m ? m[1].toUpperCase() : null;
}

function getTeamBase(name) {
  return String(name || "").replace(TEAM_SQUAD_SUFFIX_RE, "").trim();
}

function findBestClassifRow(classificationRows, teamName) {
  const rows = classificationRows || [];
  const targetNorm = normalizeTeamNameStrict(teamName || "");
  const targetSuffix = extractTeamSuffix(teamName);
  const targetBase = getTeamBase(teamName);
  
  if (targetNorm) {
    const exact = rows.find(r => normalizeTeamNameStrict(r?.team || "") === targetNorm);
    if (exact) return exact;
  }
  
  if (targetBase && targetSuffix) {
    const sameBaseAndSuffix = rows.filter(r => {
      const rBase = getTeamBase(r?.team || "");
      const rSuffix = extractTeamSuffix(r?.team || "");
      return rBase && normalizeTeamNameStrict(rBase) === normalizeTeamNameStrict(targetBase)
        && rSuffix === targetSuffix;
    });
    if (sameBaseAndSuffix.length === 1) return sameBaseAndSuffix[0];
    if (sameBaseAndSuffix.length > 1) {
      const refClubId = getClubId(teamName);
      if (refClubId) {
        const byClubId = sameBaseAndSuffix.find(r => r.clubId === refClubId);
        if (byClubId) return byClubId;
      }
      return sameBaseAndSuffix[0];
    }
  }
  
  const targetKey = normalizeTeamKeyForMatching(teamName || "");
  if (!targetKey) return null;
  const keyMatches = rows.filter(r => {
    const rowKey = normalizeTeamKeyForMatching(r?.team || "");
    return rowKey && (rowKey === targetKey || (rowKey.includes(targetKey) && rowKey.length < targetKey.length + 5));
  });
  if (keyMatches.length === 1) return keyMatches[0];
  if (keyMatches.length > 1) {
    const refClubId = getClubId(teamName);
    if (refClubId) {
      const byClubId = keyMatches.find(r => r.clubId === refClubId);
      if (byClubId) return byClubId;
    }
    return keyMatches[0];
  }
  
  return null;
}

function resolveCanonicalClassifTeamName(classificationRows, teamName) {
  return findBestClassifRow(classificationRows, teamName)?.team || null;
}

function calcGoalAverage(gf, gc) {
  if (gf == null && gc == null) return null;
  return Number(gf || 0) - Number(gc || 0);
}

function goalAverageColor(avg) {
  if (avg == null) return "#64748b";
  if (avg > 0) return "#16a34a";
  if (avg < 0) return "#dc2626";
  return "#64748b";
}

function formatGoalAverage(avg) {
  if (avg == null) return "-";
  return `${avg > 0 ? "+" : ""}${avg}`;
}

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

function getPlayerSourceCatCounts(player, seasonData = DB) {
  const out = {};
  for (const src of (player?.sources || [])) {
    const cat = seasonData?.actesIndex?.[String(src?.id)];
    if (!cat) continue;
    out[cat] = (out[cat] || 0) + 1;
  }
  return out;
}

function normalizePlayerTeamStatsForDisplay(player, seasonData = DB) {
  const teamStats = [...(player?.teamStats || [])];
  if (teamStats.length <= 1) return teamStats;

  const uniqueCats = [...new Set(teamStats.map(t => t.cat).filter(Boolean))];
  const srcCatCounts = Object.entries(getPlayerSourceCatCounts(player, seasonData));

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

async function buildPlayerTeamStatsFromSources(player, jid, options = {}) {
  const seasonData = options?.seasonData || DB;
  const seasonKey = options?.seasonKey || activeSeasonKey;
  const sources = (player?.sources || []).filter(s => s?.type === "acta" && s?.id != null);
  if (!sources.length) return [];

  const wantedId = String(jid || player?.jugadorId || player?.id || "").trim();
  if (!wantedId) return [];

  const teamCatCounts = {};

  const addAppearance = (players, team, cat, compId = null) => {
    if (!Array.isArray(players) || !team || !cat) return;
    const appeared = players.some(p => {
      const pid = String(
        p?.jugadorId
        || p?.id
        || (p?.url?.match(/\/jugador\/(\d+)\//)?.[1] || "")
      );
      return pid === wantedId;
    });
    if (!appeared) return;

    const key = `${team}::${cat}`;
    if (!teamCatCounts[key]) teamCatCounts[key] = { team, cat, count: 0, compIds: [] };
    teamCatCounts[key].count += 1;
    if (compId != null && compId !== "") {
      const cid = String(compId);
      if (!teamCatCounts[key].compIds.includes(cid)) teamCatCounts[key].compIds.push(cid);
    }
  };

  for (const src of sources) {
    const actaId = String(src.id);
    const cat = seasonData?.actesIndex?.[actaId];
    if (!cat) continue;

    const actes = await loadCatActes(cat, seasonKey);
    const acta = actes?.[actaId];
    if (!acta?.playerStats) continue;

    addAppearance(acta.playerStats.homePlayers, acta.home, cat, acta?.compId);
    addAppearance(acta.playerStats.awayPlayers, acta.away, cat, acta?.compId);
  }

  return Object.values(teamCatCounts).sort((a, b) => b.count - a.count);
}

async function enrichPlayerOnDemand(jid) {
  const player = getPlayerById(jid);
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
let _nameMapNorm = null;
let _clubTokenToIds = null;

const CLUB_TOKEN_STOPWORDS = new Set([
  "club", "hoquei", "hockey", "pati", "patins", "patin", "esportiu", "esports", "es",
  "cp", "ch", "hc", "phc", "ce", "cn", "ue", "fd", "fc", "a", "b", "c", "d", "e", "f", "g",
  "de", "del", "d", "la", "el", "els", "les", "i", "y", "the", "team", "masculina", "femeni", "femeni",
]);

function tokenizeClubName(name) {
  const clean = normalizeTeamName(shortTeamDisplayName(name || ""))
    .replace(/\s+[a-z]$/, "")
    .trim();
  if (!clean) return [];
  return clean
    .split(" ")
    .map(t => t.trim())
    .filter(Boolean)
    .filter(t => t.length >= 3)
    .filter(t => !CLUB_TOKEN_STOPWORDS.has(t));
}

function buildNameMap() {
  if (_nameMap || !DB) return;
  _nameMap = new Map();
  _nameMapNorm = new Map();
  _clubTokenToIds = new Map();
  // Use classification rows — correct mixed-case names with reliable clubId
  const allSeasonData = [DB].filter(Boolean);

  for (const seasonData of allSeasonData) {
    for (const comps of Object.values(seasonData.categories||{})) {
      for (const comp of comps) {
        const compTeamToClub = comp?.teamToClub || {};
        for (const r of (comp.classification||[])) {
          if (!r?.team) continue;
          const fromRow = r.clubId != null ? String(r.clubId) : null;
          const fromTeamId = r.teamId != null ? String(compTeamToClub[String(r.teamId)] || "") : "";
          const clubId = fromRow || fromTeamId;
          if (!clubId) continue;
          const n = r.team.toLowerCase();
          const base = n.replace(/\s+[a-z]$/,"").trim();
          const norm = normalizeTeamKeyForMatching(r.team);
          const baseNorm = normalizeTeamKeyForMatching(getTeamBase(r.team));
          if (!_nameMap.has(n))    _nameMap.set(n, clubId);
          if (!_nameMap.has(base)) _nameMap.set(base, clubId);
          if (norm && !_nameMapNorm.has(norm)) _nameMapNorm.set(norm, clubId);
          if (baseNorm && !_nameMapNorm.has(baseNorm)) _nameMapNorm.set(baseNorm, clubId);

          const uniqTokens = [...new Set(tokenizeClubName(r.team))];
          for (const token of uniqTokens) {
            if (!_clubTokenToIds.has(token)) _clubTokenToIds.set(token, new Map());
            const tokenMap = _clubTokenToIds.get(token);
            tokenMap.set(clubId, (tokenMap.get(clubId) || 0) + 1);
          }
        }

        // Extra mapping from comp roster keeps logos stable even when classif rows miss clubId.
        for (const t of (comp.teams || [])) {
          const teamId = t?.id ?? t?.teamId;
          const teamName = t?.name || t?.teamName || "";
          if (!teamName) continue;
          const mappedClubId = teamId != null ? String(compTeamToClub[String(teamId)] || "") : "";
          if (!mappedClubId) continue;

          const n = String(teamName).toLowerCase();
          const base = n.replace(/\s+[a-z]$/, "").trim();
          const norm = normalizeTeamKeyForMatching(teamName);
          const baseNorm = normalizeTeamKeyForMatching(getTeamBase(teamName));
          if (!_nameMap.has(n)) _nameMap.set(n, mappedClubId);
          if (!_nameMap.has(base)) _nameMap.set(base, mappedClubId);
          if (norm && !_nameMapNorm.has(norm)) _nameMapNorm.set(norm, mappedClubId);
          if (baseNorm && !_nameMapNorm.has(baseNorm)) _nameMapNorm.set(baseNorm, mappedClubId);

          const uniqTokens = [...new Set(tokenizeClubName(teamName))];
          for (const token of uniqTokens) {
            if (!_clubTokenToIds.has(token)) _clubTokenToIds.set(token, new Map());
            const tokenMap = _clubTokenToIds.get(token);
            tokenMap.set(mappedClubId, (tokenMap.get(mappedClubId) || 0) + 1);
          }
        }
      }
    }
  }
}

function getClubId(name) {
  if (!DB||!name) return null;
  if (isDescansaTeamName(name) || isPlaceholderTeamName(name)) return null;
  buildNameMap();
  const n = String(name).toLowerCase();
  const base = n.replace(/\s+[a-z]$/, "").trim();
  const norm = normalizeTeamKeyForMatching(name);
  const baseNorm = normalizeTeamKeyForMatching(getTeamBase(name));
  if (_nameMap.has(n))    return _nameMap.get(n);
  if (_nameMap.has(base)) return _nameMap.get(base);
  if (norm && _nameMapNorm?.has(norm)) return _nameMapNorm.get(norm);
  if (baseNorm && _nameMapNorm?.has(baseNorm)) return _nameMapNorm.get(baseNorm);
  for (const [k,v] of _nameMap) {
    if (k.length>5 && (k.includes(base)||base.includes(k))) return v;
  }

  // High-confidence fallback: infer club by distinctive locality tokens.
  const tokens = tokenizeClubName(name);
  if (!tokens.length) return null;

  const scores = new Map();
  for (const token of tokens) {
    const tokenMap = _clubTokenToIds?.get(token);
    if (!tokenMap) continue;
    for (const [clubId, count] of tokenMap.entries()) {
      scores.set(clubId, (scores.get(clubId) || 0) + count);
    }
  }

  if (norm) {
    for (const [k, clubId] of (_nameMapNorm || new Map()).entries()) {
      if (!k || !clubId) continue;
      if (k === norm || k.includes(norm) || norm.includes(k)) {
        scores.set(clubId, (scores.get(clubId) || 0) + 3);
      }
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [bestId, bestScore] = ranked[0];
  const secondScore = ranked[1]?.[1] || 0;
  if (bestScore >= 3 && bestScore >= secondScore + 2) return bestId;
  return null;
}

function rowClubId(row, comp = null) {
  if (!row) return null;
  if (row.clubId) return row.clubId;

  if (row.teamId != null) {
    if (comp?.teamToClub?.[String(row.teamId)]) return comp.teamToClub[String(row.teamId)];
    const byTeamId = getClubIdByTeamId(row.teamId);
    if (byTeamId) return byTeamId;
  }

  if (comp?.teams?.length && row.team) {
    const matchingTeam = comp.teams.find(t => {
      const name = t?.name || t?.teamName || "";
      return teamMatchesCalendarExact(name, row.team) || teamMatchesLoose(name, row.team);
    });
    const matchingId = matchingTeam?.id ?? matchingTeam?.teamId;
    if (matchingId != null) {
      const fromCompMap = comp.teamToClub?.[String(matchingId)];
      if (fromCompMap) return fromCompMap;
      const fromIndex = getClubIdByTeamId(matchingId);
      if (fromIndex) return fromIndex;
    }
  }

  return getClubId(row.team) || null;
}

function shieldImg(clubId, size) {
  size = size||22;
  const r = size<=22?4:8, p = size>22?2:1;
  if (!clubId) return `<span style="width:${size}px;height:${size}px;background:#e8ecf4;border-radius:${r}px;display:inline-block;flex-shrink:0"></span>`;
  const safeId = String(clubId || "").trim();
  const hasExt = safeId.includes(".");
  // clubId can be a full filename like "278_3.png" or just "278".
  // When extension is unknown, try gif -> png -> jpg before showing placeholder.
  const src = hasExt ? SHIELD + safeId : SHIELD + safeId + ".gif";
  const fallbackScript = hasExt
    ? "if(this.dataset.try==='orig'){this.dataset.try='png';this.src=this.dataset.base+'.png';return;}if(this.dataset.try==='png'){this.dataset.try='gif';this.src=this.dataset.base+'.gif';return;}if(this.dataset.try==='gif'){this.dataset.try='jpg';this.src=this.dataset.base+'.jpg';return;}this.onerror=null;this.style.display='none'"
    : "if(this.dataset.try==='gif'){this.dataset.try='png';this.src=this.dataset.base+'.png';return;}if(this.dataset.try==='png'){this.dataset.try='jpg';this.src=this.dataset.base+'.jpg';return;}this.onerror=null;this.style.display='none'";
  const baseNoExt = hasExt ? safeId.replace(/\.[^.]+$/, "") : safeId;
  const dataAttrs = hasExt
    ? ` data-base="${SHIELD + baseNoExt}" data-try="orig"`
    : ` data-base="${SHIELD + safeId}" data-try="gif"`;
  return `<img src="${src}" width="${size}" height="${size}"${dataAttrs} style="object-fit:contain;background:#f5f7fc;border-radius:${r}px;padding:${p}px;flex-shrink:0;vertical-align:middle" onerror="${fallbackScript}" alt=""/>`;
}

function runIdentityRegressionChecks() {
  const checks = [];
  checks.push({
    key: "team_match_suffix_isolation",
    ok: teamMatchesLoose("Club Hoquei Ripollet B", "Club Hoquei Ripollet C") === false,
  });
  checks.push({
    key: "team_match_diacritics",
    ok: teamMatchesLoose("CH Mataró B", "Ch Mataro B") === true,
  });
  checks.push({
    key: "lupa_param_roundtrip",
    ok: decodeURIComponent(encodeURIComponent("Cp Vilanova d'Hoquei")) === "Cp Vilanova d'Hoquei",
  });
  checks.push({
    key: "shield_fallback_markup",
    ok: /onerror=/.test(shieldImg("123", 22)),
  });

  const failed = checks.filter(c => !c.ok);
  if (failed.length) {
    console.warn("[regression-check] identity safeguards failed:", failed.map(c => c.key));
  } else {
    console.log("[regression-check] identity safeguards OK");
  }
}

function normalizeCompKey(name) {
  return String(name || "")
    .replace(/\s*\((?:20\d{2}|\d{4})[-/]?\d{2,4}\)\s*/g, " ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function is3x3Competition(compOrName) {
  const raw = typeof compOrName === "string" ? compOrName : (compOrName?.name || "");
  const n = normalizeCompKey(raw);
  return /\b3\s*x\s*3\b/.test(n) || n.includes("3x3");
}

function isPrebenjamiCompetition(comp) {
  if (!comp) return false;
  const cat = normalizeCompKey(getCatForComp(comp) || "");
  const name = normalizeCompKey(comp?.name || "");
  return cat.includes("prebenjami") || name.includes("prebenjami") || /\bpb\b/.test(name);
}

function hasClassRows(rows) {
  return Array.isArray(rows) && rows.some(r => r && String(r.team || "").trim());
}

function getClassificationSourcePilots() {
  const loaded = classificationSourcePilotsDB?.pilots;
  const basePilots = Array.isArray(loaded) && loaded.length ? loaded : CLASSIFICATION_SOURCE_PILOTS;
  const derivedPilots = buildAuditDerivedPilots(adminAuditCache);
  return mergePilotsWithPriority(derivedPilots, basePilots);
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

  const POSTSEASON_RE = /(play\s*-?\s*off|eliminat|copa|fase\s*final|final\s*a\s*4|final\s*four|2\s*ª?\s*fase)/i;
  const cleanBaseName = value => normalizeCompKey(String(value || "")
    .replace(/\bplay\s*-?\s*off\b/ig, " ")
    .replace(/\beliminat(?:ories|oria)?\b/ig, " ")
    .replace(/\bcopa\b/ig, " ")
    .replace(/\bfase\s*final\b/ig, " ")
    .replace(/\bfinal\s*a\s*4\b|\bfinal\s*four\b/ig, " ")
    .replace(/\b2\s*ª?\s*fase\b/ig, " ")
  );

  const normalizeFecapaClassificationRows = rows =>
    (rows || []).map(r => ({
      pos: r?.position ?? r?.pos ?? null,
      teamId: r?.teamId || null,
      team: normalizeJokClubDisplayName(r?.teamName || r?.team || ""),
      clubId: r?.logoSrc || r?.clubId || null,
      pts: r?.points ?? r?.pts ?? null,
      pj: r?.played ?? r?.pj ?? null,
      pg: r?.won ?? r?.pg ?? null,
      pe: r?.drawn ?? r?.pe ?? null,
      pp: r?.lost ?? r?.pp ?? null,
      gf: r?.goalsFor ?? r?.gf ?? null,
      gc: r?.goalsAgainst ?? r?.gc ?? null,
    })).filter(r => String(r.team || "").trim());

  const bestFecapaGroupForPilot = (pilot, jokComp) => {
    const allComps = Object.values(fecapaCategoriesDB?.categories || {})
      .flat()
      .filter(Boolean);
    const targetComp = allComps.find(c => String(c?.competitionId || "") === String(pilot.fecapaCompetitionId || ""));
    if (!targetComp) return null;

    const groups = Array.isArray(targetComp.groups) ? targetComp.groups : [];
    if (!groups.length) return null;

    const jokTeams = new Set((jokComp?.classification || [])
      .map(r => normalizeTeamName(r?.team || ""))
      .filter(Boolean));

    const scoreGroup = group => {
      const gTeams = (group?.teams || [])
        .map(r => normalizeTeamName(r?.teamName || r?.team || ""))
        .filter(Boolean);
      const overlap = gTeams.filter(t => jokTeams.has(t)).length;
      const hasRows = hasClassRows(normalizeFecapaClassificationRows(group?.teams || []));
      return {
        group,
        overlap,
        teamCount: gTeams.length,
        hasRows,
      };
    };

    const chooseBestGroup = candidates => {
      if (!Array.isArray(candidates) || !candidates.length) return null;
      const scored = candidates.map(scoreGroup);
      scored.sort((a, b) => {
        if (a.hasRows !== b.hasRows) return (b.hasRows ? 1 : 0) - (a.hasRows ? 1 : 0);
        if (a.overlap !== b.overlap) return b.overlap - a.overlap;
        if (a.teamCount !== b.teamCount) return b.teamCount - a.teamCount;
        return 0;
      });
      return scored[0]?.group || null;
    };

    const preferredToken = normalizeCompKey(pilot.preferredGroupToken || "");
    if (preferredToken) {
      const tokenMatches = groups.filter(g => normalizeCompKey(g?.groupName || "").includes(preferredToken));
      const preferred = chooseBestGroup(tokenMatches);
      if (preferred) return preferred;
    }

    const best = chooseBestGroup(groups);
    return best || groups[0] || null;
  };

  const allFecapaComps = Object.values(fecapaCategoriesDB?.categories || {})
    .flat()
    .filter(Boolean);

  const collectFecapaCandidatesForComp = (jokComp, pilot) => {
    const byId = pilot
      ? allFecapaComps.filter(c => String(c?.competitionId || "") === String(pilot.fecapaCompetitionId || ""))
      : [];
    const byName = allFecapaComps.filter(c => normalizeCompKey(c?.competitionName || "") === normalizeCompKey(jokComp?.name || ""));

    const seen = new Set();
    const out = [];
    for (const c of [...byId, ...byName]) {
      const key = String(c?.competitionId || "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  };

  const normalizeFecapaPhasesFromComp = fecapaComp => {
    const raw = Array.isArray(fecapaComp?.competitionPhases) ? fecapaComp.competitionPhases : [];
    let phases = normalizePostSeasonPhases(raw);
    if (phases.length > 0) return phases;

    const groups = Array.isArray(fecapaComp?.groups) ? fecapaComp.groups : [];
    const groupFallback = normalizePostSeasonPhases(groups
      .filter(g => POSTSEASON_RE.test(String(g?.groupName || "")))
      .map((g, idx) => ({
        phaseId: `${String(fecapaComp?.competitionId || "comp")}-group-phase-${idx + 1}`,
        phaseName: String(g?.groupName || "Fase final").trim(),
        phaseType: /play\s*-?\s*off/i.test(String(g?.groupName || ""))
          ? "playoff"
          : (/eliminat/i.test(String(g?.groupName || ""))
            ? "eliminatories"
            : (/copa/i.test(String(g?.groupName || ""))
              ? "copa"
              : "fase_final")),
        isPostSeason: true,
        matches: [],
      })));
    if (groupFallback.length > 0) return groupFallback;

    const compName = String(fecapaComp?.competitionName || "");
    if (POSTSEASON_RE.test(compName)) {
      phases = normalizePostSeasonPhases([{
        phaseId: `${String(fecapaComp?.competitionId || "comp")}-comp-phase-1`,
        phaseName: compName,
        phaseType: /play\s*-?\s*off/i.test(compName)
          ? "playoff"
          : (/eliminat/i.test(compName)
            ? "eliminatories"
            : (/copa/i.test(compName)
              ? "copa"
              : "fase_final")),
        isPostSeason: true,
        matches: [],
      }]);
    }

    return phases;
  };

  for (const comps of Object.values(DB.categories)) {
    for (const comp of comps) {
      if (is3x3Competition(comp)) continue;

      const jokRows = Array.isArray(comp.classification) ? comp.classification : [];
      const existingSource = String(comp.classificationSource || "").toLowerCase();
      if (hasClassRows(jokRows)) {
        comp.classification = jokRows;
        comp.classificationSource = existingSource === "fecapa" ? "fecapa" : "jok";
      } else {
        comp.classification = [];
        comp.classificationSource = "none";
      }

      const pilot = getClassificationSourcePilots().find(p => String(p.jokCompId) === String(comp.id));

      const fecapaCandidates = collectFecapaCandidatesForComp(comp, pilot);
      const mergedPhases = normalizePostSeasonPhases(
        fecapaCandidates.flatMap(c => normalizeFecapaPhasesFromComp(c))
      );

      comp.postSeasonPhases = mergedPhases;
      comp.hasPostSeasonPhases = mergedPhases.some(p => p?.isPostSeason === true);

      const phaseMatches = mergedPhases.flatMap(p => p.matches || []);
      if ((!Array.isArray(comp.calendar) || !comp.calendar.length) && phaseMatches.length) {
        comp.calendar = phaseMatches.map(m => ({ ...m, compId: String(comp.id || "") }));
      }

      if (!pilot) continue;

      const bestFecapaGroup = bestFecapaGroupForPilot(pilot, comp);
      if (!bestFecapaGroup) continue;

      const fecapaRows = normalizeFecapaClassificationRows(bestFecapaGroup.teams || []);
      // No forcem FECAPA si el grup resolt no té classificació: mantenim jok.cat.
      if (!hasClassRows(fecapaRows)) {
        comp.classificationPilot = {
          jokCompId: String(comp.id),
          fecapaCompetitionId: String(pilot.fecapaCompetitionId),
          fecapaGroupId: String(bestFecapaGroup.groupId || ""),
          fecapaGroupName: String(bestFecapaGroup.groupName || ""),
          source: String(pilot.source || "config"),
          fallback: "jok_no_fecapa_rows",
        };
        continue;
      }

      comp.classification = fecapaRows;
      comp.classificationSource = "fecapa";
      comp.classificationPilot = {
        jokCompId: String(comp.id),
        fecapaCompetitionId: String(pilot.fecapaCompetitionId),
        fecapaGroupId: String(bestFecapaGroup.groupId || ""),
        fecapaGroupName: String(bestFecapaGroup.groupName || ""),
        source: String(pilot.source || "config"),
      };
    }
  }

  // Regla UI: prebenjamí es mostra com a font FECAPA.
  for (const comps of Object.values(DB.categories)) {
    for (const comp of comps) {
      if (is3x3Competition(comp)) continue;
      if (!isPrebenjamiCompetition(comp)) continue;
      comp.classificationSource = "fecapa";
    }
  }

  applyCompetitionActivityHeuristics();
}

function classifSourceBadgeHtml(comp) {
  const src = comp?.classificationSource;
  if (src === "fecapa") {
    return `<span style="display:inline-flex;align-items:center;gap:5px;background:#e8f2ff;border:1px solid #bfdbfe;color:#003da5;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:700"><span style="width:14px;height:10px;display:inline-block;border-radius:2px;border:1px solid rgba(0,0,0,.12);background:repeating-linear-gradient(to bottom,#facc15 0,#facc15 2px,#dc2626 2px,#dc2626 4px)"></span><span>fecapa</span></span>`;
  }
  if (src === "jok") {
    return `<span style="display:inline-flex;align-items:center;gap:5px;background:#eefcf3;border:1px solid #bbf7d0;color:#166534;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:700"><span>🌐</span><span>jok.cat</span></span>`;
  }
  return "";
}

function classifSourceIconHtml(comp) {
  const src = String(comp?.classificationSource || "").toLowerCase();
  if (src === "fecapa") {
    return `<span title="Classificació FECAPA" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:999px;background:#e8f2ff;border:1px solid #bfdbfe"><span style="width:14px;height:10px;display:inline-block;border-radius:2px;border:1px solid rgba(0,0,0,.12);background:repeating-linear-gradient(to bottom,#facc15 0,#facc15 2px,#dc2626 2px,#dc2626 4px)"></span></span>`;
  }
  if (src === "jok") {
    return `<span title="Classificació jok.cat" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:999px;background:#eefcf3;border:1px solid #bbf7d0;font-size:13px;line-height:1">🌐</span>`;
  }
  return "";
}
//-- Busca competicions
function findComp(compId) {
  if (!DB) return null;
  const wanted = String(compId || "");
  for (const comps of Object.values(DB.categories)) {
    const c = comps.find(c => String(c?.id || "") === wanted);
    if (c) return c;
  }
  return null;
}
// -- Busca actes (cerca en el cache de categories carregades)
const actesCache = {}; // seasonKey::catSlug → { actaId: actaData }
const actaLinkHydrationState = new Map(); // seasonKey::compId -> {status, promise?}
const actaLookupById = new Map(); // seasonKey::actaId -> acta
const actaLookupBySignature = new Map(); // seasonKey::compId::home|away|date|hs|as -> acta
const actaLookupByBaseSignature = new Map(); // seasonKey::compId::home|away|date -> [acta]

function getActesCacheKey(slug, seasonKey = activeSeasonKey) {
  return `${String(seasonKey || "current")}::${String(slug || "")}`;
}

async function loadCatActes(slug, seasonKey = activeSeasonKey) {
  const key = getActesCacheKey(slug, seasonKey);
  if (actesCache[key]) return actesCache[key];

  const baseUrl = getSeasonActesBaseUrl(seasonKey);
  const fileUrl = `${baseUrl}/${slug}.json`;
  try {
    const res = await fetch(`${fileUrl}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    actesCache[key] = await res.json();
  } catch(e) {
    actesCache[key] = {};
  }

  indexSeasonActesLookup(actesCache[key], seasonKey);
  return actesCache[key];
}

function buildActaSignatureBase(home, away, date) {
  const h = normalizeTeamName(home || "");
  const a = normalizeTeamName(away || "");
  const d = String(date || "").trim();
  if (!h || !a || !d) return "";
  return `${h}|${a}|${d}`;
}

function buildActaSignature(home, away, date, homeScore, awayScore) {
  const base = buildActaSignatureBase(home, away, date);
  if (!base || homeScore == null || awayScore == null) return "";
  return `${base}|${Number(homeScore)}|${Number(awayScore)}`;
}

function getActaDateForLookup(acta) {
  return String(acta?.date || acta?.matchDate || acta?.actaMeta?.date || "").trim();
}

function indexSeasonActesLookup(actesById, seasonKey = activeSeasonKey) {
  const sk = String(seasonKey || "current");
  for (const acta of Object.values(actesById || {})) {
    if (!acta) continue;

    const actaId = String(acta?.actaId || acta?.id || "").trim();
    if (actaId) {
      actaLookupById.set(`${sk}::${actaId}`, acta);
    }

    const compId = String(acta?.compId || "").trim();
    if (!compId) continue;

    const date = getActaDateForLookup(acta);
    const scoreKey = buildActaSignature(acta?.home, acta?.away, date, acta?.homeScore, acta?.awayScore);
    if (scoreKey) {
      actaLookupBySignature.set(`${sk}::${compId}::${scoreKey}`, acta);
    }

    const baseKey = buildActaSignatureBase(acta?.home, acta?.away, date);
    if (baseKey) {
      const bucketKey = `${sk}::${compId}::${baseKey}`;
      const list = actaLookupByBaseSignature.get(bucketKey) || [];
      list.push(acta);
      actaLookupByBaseSignature.set(bucketKey, list);
    }
  }
}

function findActaByMatchSignature(match, compIdHint = null, seasonKey = activeSeasonKey) {
  if (!match) return null;
  const compId = String(compIdHint || match?.compId || "").trim();
  if (!compId) return null;

  const sk = String(seasonKey || "current");
  const scoreKey = buildActaSignature(match?.home, match?.away, match?.date, match?.homeScore, match?.awayScore);
  if (scoreKey) {
    const strict = actaLookupBySignature.get(`${sk}::${compId}::${scoreKey}`);
    if (strict) return strict;
  }

  const baseKey = buildActaSignatureBase(match?.home, match?.away, match?.date);
  if (!baseKey) return null;
  const bucket = actaLookupByBaseSignature.get(`${sk}::${compId}::${baseKey}`) || [];
  if (bucket.length === 1) return bucket[0] || null;
  return null;
}

function getActaDateValue(acta) {
  return String(acta?.date || acta?.matchDate || acta?.actaMeta?.date || "").trim();
}

function buildActaLookupKey(home, away, date) {
  const h = normalizeTeamName(home || "");
  const a = normalizeTeamName(away || "");
  const d = String(date || "").trim();
  if (!h || !a || !d) return "";
  return `${h}|${a}|${d}`;
}

function buildActaScoreLookupKey(home, away, date, homeScore, awayScore) {
  const base = buildActaLookupKey(home, away, date);
  if (!base) return "";
  if (homeScore == null || awayScore == null) return "";
  return `${base}|${Number(homeScore)}|${Number(awayScore)}`;
}

function getActaIdValue(acta) {
  const id = String(acta?.actaId || acta?.id || "").trim();
  return id || null;
}

function getActaUrlValue(acta) {
  return String(acta?.actaUrl || acta?.url || "").trim() || null;
}

async function hydrateCompetitionActaLinks(comp, seasonKey = activeSeasonKey) {
  if (!comp?.id) return false;
  const compId = String(comp.id || "");
  const stateKey = `${String(seasonKey || "current")}::${compId}`;
  const prev = actaLinkHydrationState.get(stateKey);
  if (prev?.status === "done") return false;
  if (prev?.status === "loading" && prev.promise) return prev.promise;

  const run = (async () => {
    try {
      const catSlug = getCatSlugForComp(comp);
      if (!catSlug) {
        actaLinkHydrationState.set(stateKey, { status: "done", empty: true });
        return false;
      }

      const actes = await loadCatActes(catSlug, seasonKey);
      const byId = new Map();
      const byBase = new Map();
      const byScore = new Map();

      for (const acta of Object.values(actes || {})) {
        if (String(acta?.compId || "") !== compId) continue;

        const actaId = getActaIdValue(acta);
        const actaUrl = getActaUrlValue(acta);
        if (actaId) byId.set(actaId, acta);
        if (!actaUrl && !actaId) continue;

        const date = getActaDateValue(acta);
        const baseKey = buildActaLookupKey(acta?.home, acta?.away, date);
        if (baseKey) {
          const list = byBase.get(baseKey) || [];
          list.push(acta);
          byBase.set(baseKey, list);
        }

        const scoreKey = buildActaScoreLookupKey(acta?.home, acta?.away, date, acta?.homeScore, acta?.awayScore);
        if (scoreKey && !byScore.has(scoreKey)) {
          byScore.set(scoreKey, acta);
        }
      }

      const patchMatch = m => {
        if (!m || !m.home || !m.away) return false;
        if (m.actaUrl) return false;

        let resolved = null;

        const matchActaId = String(m?.actaId || "").trim();
        if (matchActaId && byId.has(matchActaId)) {
          resolved = byId.get(matchActaId);
        }

        if (!resolved) {
          const strict = buildActaScoreLookupKey(m.home, m.away, m.date, m.homeScore, m.awayScore);
          if (strict && byScore.has(strict)) {
            resolved = byScore.get(strict);
          }
        }

        if (!resolved) {
          const base = buildActaLookupKey(m.home, m.away, m.date);
          const cands = base ? (byBase.get(base) || []) : [];
          if (cands.length === 1) resolved = cands[0];
        }

        if (!resolved) return false;

        const newId = getActaIdValue(resolved);
        const newUrl = getActaUrlValue(resolved);
        if (!newId && !newUrl) return false;

        if (!m.actaId && newId) m.actaId = newId;
        if (!m.actaUrl && newUrl) m.actaUrl = newUrl;
        return !!m.actaUrl;
      };

      let changed = false;
      for (const m of (comp.calendar || [])) {
        if (patchMatch(m)) changed = true;
      }
      for (const phase of (comp.postSeasonPhases || [])) {
        for (const m of (phase?.matches || [])) {
          if (patchMatch(m)) changed = true;
        }
      }

      actaLinkHydrationState.set(stateKey, { status: "done", changed });
      return changed;
    } catch (err) {
      actaLinkHydrationState.set(stateKey, { status: "done", error: err?.message || String(err) });
      return false;
    }
  })();

  actaLinkHydrationState.set(stateKey, { status: "loading", promise: run });
  return run;
}

async function preloadReinforcementActes(comp, teamName, teamInClassif, currentCatSlug, actes) {
  const teamPlayerIds = new Set();
  const teamAliases = [teamName, teamInClassif?.team].filter(Boolean);

  const sideMatchesTeam = (sideName) => {
    if (!sideName) return false;
    return teamAliases.some(alias => normalizeTeamName(sideName) === normalizeTeamName(alias) || teamMatchesLoose(sideName, alias));
  };

  for (const acta of Object.values(actes || {})) {
    if (String(acta?.compId || "") !== String(comp?.id || "")) continue;
    const isHome = sideMatchesTeam(acta.home || "");
    const isAway = sideMatchesTeam(acta.away || "");
    if (!isHome && !isAway) continue;
    const players = isHome ? (acta.playerStats?.homePlayers || []) : (acta.playerStats?.awayPlayers || []);
    for (const p of players) {
      if (p?.jugadorId != null) teamPlayerIds.add(String(p.jugadorId));
    }
  }

  const extraCats = new Set();
  for (const pid of teamPlayerIds) {
    const player = DB?.jugadors?.[pid];
    for (const src of (player?.sources || [])) {
      if (src?.type !== "acta" || src?.id == null) continue;
      const slug = DB?.actesIndex?.[String(src.id)];
      if (!slug || slug === currentCatSlug) continue;
      extraCats.add(slug);
    }
  }

  await Promise.all([...extraCats].map(slug => loadCatActes(slug)));
}

function findActa(actaId, seasonKey = activeSeasonKey) {
  if (!DB || !actaId) return null;
  const id = String(actaId);

  const byIndexedId = actaLookupById.get(`${String(seasonKey || "current")}::${id}`);
  if (byIndexedId) return byIndexedId;

  for (const slug of Object.values(DB?.actesIndex || {})) {
    const key = getActesCacheKey(slug, seasonKey);
    const actes = actesCache[key];
    if (actes?.[id]) return actes[id];
  }

  const prefix = `${String(seasonKey || "current")}::`;
  for (const [key, actes] of Object.entries(actesCache)) {
    if (!key.startsWith(prefix)) continue;
    if (actes?.[id]) return actes[id];
  }
  return null;
}
// -- Fa match actes
function getMatchActa(match, compIdHint = null) {
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

  const bySignature = findActaByMatchSignature(match, compIdHint, activeSeasonKey);
  if (bySignature) return bySignature;

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
  let acta = actaId ? findActa(actaId, activeSeasonKey) : null;

  if (!acta && actaId && DB?.actesIndex) {
    const slug = DB.actesIndex[String(actaId)];
    if (slug) {
      const actes = await loadCatActes(slug, activeSeasonKey);
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
  // Match: player name + G B V and optional FD Pe
  const re = /((?:[A-Za-zÀ-ÿ'\-]+ )+?)(\d+) (\d+) (\d+)(?: (\d+) (\d+))?(?= [A-Za-zÀ-ÿ]|$)/g;
  let m, i = 0;
  while ((m = re.exec(block)) !== null) {
    result.push({
      name: m[1].trim(),
      g: +m[2],
      b: +m[3],
      v: +m[4],
      fd: m[5] != null ? +m[5] : null,
      pe: m[6] != null ? +m[6] : null,
      url: links[i]?.url || null,
      jugadorId: links[i]?.jugadorId || null
    });
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
      result.push({ name: nameParts.join(" "), g, b, v, fd: null, pe: null, url: link.url, jugadorId: link.jugadorId });
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
        <div style="display:flex;align-items:center;background:#f8fafc;padding:6px 12px;border-bottom:1px solid #e2e6ef">
          <div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">#</div>
          <div style="flex:1;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Jugador</div>
          ${hasStats?`<div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#16a34a">G</div>
          <div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#2563eb">B</div>
          <div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#dc2626">V</div>`:""}
        </div>
        ${players.map(p => {
          const jid = p.jugadorId;
          const playerNumber = jid && DB?.jugadors?.[jid]?.number;
          return `
          <div style="display:flex;align-items:center;padding:7px 12px;border-top:1px solid #f0f2f8">
            <div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:#64748b">${playerNumber ?? "–"}</div>
            <div style="flex:1;font-size:13px;font-weight:500;min-width:0">
              ${(()=>{const m=p.url?.match(/\/jugador\/(\d+)\//);const jid=m?.[1];if(jid)return`<button class="player-name-btn" data-jid="${jid}">${esc(p.name)}</button>`;if(p.url)return`<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" style="color:#003da5;text-decoration:none;font-weight:600">${esc(p.name)}</a>`;return esc(p.name);})()}
            </div>
            ${hasStats?`
            <div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:${p.g?"900":"400"};color:${p.g?"#16a34a":"#cbd5e1"}">${p.g||"·"}</div>
            <div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:${p.b?"900":"400"};color:${p.b?"#2563eb":"#cbd5e1"}">${p.b||"·"}</div>
            <div style="width:28px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:${p.v?"900":"400"};color:${p.v?"#dc2626":"#cbd5e1"}">${p.v||"·"}</div>`:""}
          </div>`;
        }).join("")}
      </div>
    </div>`;
}

function getVenueLinks(teamName) {
  if (!venuesDB?.venues || !teamName) return "";
  const venue = venuesDB.venues[teamName];
  if (!venue) return "";
  const address = String(venue.address || "").trim();
  if (!address) return "";
  return `<div style="border-top:1px solid #f0f2f8;padding:10px 14px;font-size:12px;color:#6b7a99">
    <span style="font-weight:700">On s'ha jugat:</span> ${esc(address)}
  </div>`;
}

function getTeamFouls(players) {
  let hasFoulsData = false;
  let total = 0;
  for (const p of (players || [])) {
    const v = Number(p?.fd);
    if (!Number.isFinite(v)) continue;
    hasFoulsData = true;
    total += v;
  }
  return hasFoulsData ? total : null;
}

window.openActaTeamFromHeader = function(compId, teamName) {
  const wantedTeam = String(teamName || "").trim();
  if (!wantedTeam) return;

  let comp = compId ? findComp(compId) : null;
  if (!comp) {
    const allComps = Object.values(DB?.categories || {}).flat();
    comp = allComps.find(c =>
      (c.classification || []).some(r => teamMatchesLoose(r?.team || "", wantedTeam))
      || (c.calendar || []).some(m => teamMatchesLoose(m?.home || "", wantedTeam) || teamMatchesLoose(m?.away || "", wantedTeam))
    ) || null;
  }
  if (!comp) return;

  const rowMatch = (comp.classification || []).find(r => teamMatchesLoose(r?.team || "", wantedTeam));
  const teamForDetail = rowMatch?.team || wantedTeam;
  openDetail(comp.id, teamForDetail, "calendar");
};

async function enrichActaPlayerNumbers(acta) {
  const allPlayers = [
    ...(acta.playerStats?.homePlayers || []),
    ...(acta.playerStats?.awayPlayers || [])
  ];
  const playerIds = new Set();
  for (const p of allPlayers) {
    const m = p.url?.match(/\/jugador\/(\d+)\//);
    if (m?.[1]) playerIds.add(m[1]);
  }

  for (const jid of playerIds) {
    await enrichPlayerOnDemand(jid);
  }

  rerenderActaPlayers();
}

function rerenderActaPlayers() {
  const acta = currentActa;
  if (!acta) return;
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
  const grid = $("acta-body").querySelector(".acta-teams-grid");
  if (grid) {
    grid.innerHTML = `
      ${playerTableHtml(homePlayers, acta.home, "#003da5")}
      ${playerTableHtml(awayPlayers, acta.away, "#e5001c")}`;
  }
}

let currentActa = null;

function openActaDetail(acta) {
  currentActa = acta;
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
  const compName = stripSeasonSuffix(acta.compName || acta.actaMeta?.compName || "");
  const jornada = acta.jornada ? `J${acta.jornada}` : "";
  const actaUrl = acta.actaUrl || acta.url || "";
  const homeFouls = getTeamFouls(homePlayers);
  const awayFouls = getTeamFouls(awayPlayers);
  const compIdEsc = esc(String(acta.compId || ""));
  const homeEsc = esc(acta.home || "");
  const awayEsc = esc(acta.away || "");

  $("acta-header-title").innerHTML = `
    <button onclick="openActaTeamFromHeader('${compIdEsc}','${homeEsc}')" style="background:none;border:none;padding:0;margin:0;color:#003da5;font:inherit;font-weight:800;cursor:pointer">${homeEsc}</button>
    <span style="color:#64748b"> – </span>
    <button onclick="openActaTeamFromHeader('${compIdEsc}','${awayEsc}')" style="background:none;border:none;padding:0;margin:0;color:#003da5;font:inherit;font-weight:800;cursor:pointer">${awayEsc}</button>`;
  $("acta-header-meta").textContent = [jornada, date, time, compName].filter(Boolean).join(" · ");

  $("acta-body").innerHTML = `
    <!-- Score header -->
    <div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:14px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <div style="display:flex;align-items:center;padding:16px 14px;gap:8px">
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center">
          ${shieldImg(homeId, 44)}
          <button onclick="openActaTeamFromHeader('${compIdEsc}','${homeEsc}')" style="background:none;border:none;padding:0;margin:0;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;line-height:1.2;color:#003da5;cursor:pointer">${homeEsc}</button>
        </div>
        <div style="text-align:center;flex-shrink:0;min-width:80px">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:36px;font-weight:900;line-height:1;color:#1a2035">${acta.homeScore ?? "–"} · ${acta.awayScore ?? "–"}</div>
          ${(homeFouls != null || awayFouls != null) ? `<div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:#64748b;margin-top:2px">Faltes: ${homeFouls ?? "-"} · ${awayFouls ?? "-"}</div>` : ""}
          ${date||time?`<div style="font-size:11px;color:#94a3b8;margin-top:4px">${[date,time].filter(Boolean).join(" ")}</div>`:""}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center">
          ${shieldImg(awayId, 44)}
          <button onclick="openActaTeamFromHeader('${compIdEsc}','${awayEsc}')" style="background:none;border:none;padding:0;margin:0;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;line-height:1.2;color:#003da5;cursor:pointer">${awayEsc}</button>
        </div>
      </div>
      <div style="border-top:1px solid #f0f2f8;padding:10px 14px;display:flex;flex-wrap:wrap;gap:12px;align-items:center">
        ${compName?`<div style="font-size:12px;color:#6b7a99"><span style="font-weight:700">Competició:</span> ${esc(compName)}</div>`:""}
        ${refs.length?`<div style="font-size:12px;color:#6b7a99"><span style="font-weight:700">Àrbitres:</span> ${refs.map(r=>esc(r)).join(", ")}</div>`:""}
      </div>
      ${actaUrl?`<div style="border-top:1px solid #f0f2f8;padding:10px 14px">
        <a href="${esc(actaUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#003da5;text-decoration:none">📄 Veure acta a jok.cat →</a>
      </div>`:""}
      ${getVenueLinks(acta.home)}
    </div>

    <!-- Players -->
    <div class="acta-teams-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start">
      ${playerTableHtml(homePlayers, acta.home, "#003da5")}
      ${playerTableHtml(awayPlayers, acta.away, "#e5001c")}
    </div>`;

  ["screen-home","screen-detail","screen-picker"].forEach(id => $(id).style.display="none");
  $("screen-acta").style.display = "flex";
  window.scrollTo(0, 0);
  enrichActaPlayerNumbers(acta);
}

const posColor = p => p===1?"#d97706":p===2?"#64748b":p===3?"#b45309":"#6b7a99";
const teamIn = teamMatchesLoose;

function getCompPlayedPct(comp) {
  const effective = Number(comp?.pctPlayedEffective);
  if (Number.isFinite(effective)) return Math.max(0, Math.min(100, Math.round(effective)));
  const raw = Number(comp?.pctPlayed);
  if (Number.isFinite(raw)) return Math.max(0, Math.min(100, Math.round(raw)));
  return 0;
}

const isActive = comp => getCompPlayedPct(comp) < 100;

function parseCalendarDateToTimestamp(dateInput, compName = "") {
  if (!dateInput) return null;
  const raw = String(dateInput).trim();
  if (!raw) return null;

  const yyyyMmDd = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (yyyyMmDd) {
    const y = parseInt(yyyyMmDd[1], 10);
    const m = parseInt(yyyyMmDd[2], 10);
    const d = parseInt(yyyyMmDd[3], 10);
    return Date.UTC(y, m - 1, d);
  }

  const ddMmYyyy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (ddMmYyyy) {
    const d = parseInt(ddMmYyyy[1], 10);
    const m = parseInt(ddMmYyyy[2], 10);
    const y = parseInt(ddMmYyyy[3], 10);
    return Date.UTC(y, m - 1, d);
  }

  const ddMm = raw.match(/^(\d{1,2})[\/-](\d{1,2})$/);
  if (ddMm) {
    const d = parseInt(ddMm[1], 10);
    const m = parseInt(ddMm[2], 10);
    const seasonStart = extractSeasonStartYear(compName);
    const y = m >= 8 ? seasonStart : seasonStart + 1;
    return Date.UTC(y, m - 1, d);
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getInactiveTeamsForCompetition(comp) {
  const cal = Array.isArray(comp?.calendar) ? comp.calendar : [];
  if (!cal.length) return new Set();

  const nowTs = Date.now();
  const stats = new Map();
  const toBaseKey = name => normalizeTeamName(getTeamBase(name || ""));
  const classRows = Array.isArray(comp?.classification) ? comp.classification : [];
  const classMap = new Map(classRows
    .filter(r => String(r?.team || "").trim())
    .map(r => [normalizeTeamName(r.team), Number(r?.pj ?? 0)]));
  const classBaseSet = new Set(classRows
    .map(r => toBaseKey(r?.team || ""))
    .filter(Boolean));

  const touch = (teamName, isPlayed, isPastPending) => {
    if (!teamName || isDescansaTeamName(teamName)) return;
    const key = normalizeTeamName(teamName);
    if (!key) return;
    const cur = stats.get(key) || { played: 0, pendingPast: 0, pendingFuture: 0, baseKey: toBaseKey(teamName) };
    if (isPlayed) cur.played += 1;
    else if (isPastPending) cur.pendingPast += 1;
    else cur.pendingFuture += 1;
    stats.set(key, cur);
  };

  for (const m of cal) {
    const played = m?.homeScore != null && m?.awayScore != null;
    const ts = parseCalendarDateToTimestamp(m?.date || "", comp?.name || "");
    const isPastPending = !played && ts != null && ts < nowTs;
    touch(m?.home || "", played, isPastPending);
    touch(m?.away || "", played, isPastPending);
  }

  const activeBaseKeys = new Set([...stats.values()]
    .filter(s => s.played > 0 && classBaseSet.has(s.baseKey))
    .map(s => s.baseKey)
    .filter(Boolean));

  const inactive = new Set();
  for (const [teamKey, s] of stats.entries()) {
    const pj = classMap.get(teamKey);
    const absentInClassif = pj == null;
    const zeroClassifGames = pj === 0;
    const zeroPlayed = s.played === 0;
    const stalePendingOnly = s.pendingPast >= 3;
    const duplicatedAliasWithActiveBase = activeBaseKeys.has(s.baseKey) && !classMap.has(teamKey);

    if ((absentInClassif || zeroClassifGames || duplicatedAliasWithActiveBase) && zeroPlayed && stalePendingOnly) {
      inactive.add(teamKey);
    }
  }

  return inactive;
}

function buildPlayedCalendarPairKeys(comp) {
  const out = new Set();
  const cal = Array.isArray(comp?.calendar) ? comp.calendar : [];
  const toBaseKey = name => normalizeTeamName(getTeamBase(name || ""));

  for (const m of cal) {
    if (m?.homeScore == null || m?.awayScore == null) continue;
    const homeBase = toBaseKey(m?.home || "");
    const awayBase = toBaseKey(m?.away || "");
    if (!homeBase || !awayBase) continue;
    const pair = [homeBase, awayBase].sort().join("|");
    const date = String(m?.date || "").trim();
    out.add(`${date}|${pair}`);
  }

  return out;
}

function applyCompetitionActivityHeuristics() {
  if (!DB?.categories) return;

  for (const comps of Object.values(DB.categories || {})) {
    for (const comp of (comps || [])) {
      if (!comp || is3x3Competition(comp)) continue;
      const cal = Array.isArray(comp.calendar) ? comp.calendar : [];

      const rawPct = Number(comp?.pctPlayed);
      comp.pctPlayedRaw = Number.isFinite(rawPct) ? rawPct : null;
      comp.inactiveTeamsDetected = [];

      if (!cal.length) {
        comp.pctPlayedEffective = Number.isFinite(rawPct) ? rawPct : 0;
        continue;
      }

      const inactive = getInactiveTeamsForCompetition(comp);
      comp.inactiveTeamsDetected = [...inactive];
      const playedPairKeys = buildPlayedCalendarPairKeys(comp);

      const relevant = cal.filter(m => {
        const homeKey = normalizeTeamName(m?.home || "");
        const awayKey = normalizeTeamName(m?.away || "");
        const touchesInactive = inactive.has(homeKey) || inactive.has(awayKey);
        const played = m?.homeScore != null && m?.awayScore != null;
        if (!played) {
          const homeBase = normalizeTeamName(getTeamBase(m?.home || ""));
          const awayBase = normalizeTeamName(getTeamBase(m?.away || ""));
          const pair = [homeBase, awayBase].sort().join("|");
          const date = String(m?.date || "").trim();
          if (date && homeBase && awayBase && playedPairKeys.has(`${date}|${pair}`)) {
            return false;
          }
        }
        return played || !touchesInactive;
      });

      const playedRelevant = relevant.filter(m => m?.homeScore != null && m?.awayScore != null).length;
      const totalRelevant = relevant.length;
      const pctEffective = totalRelevant > 0
        ? Math.round((playedRelevant * 100) / totalRelevant)
        : (Number.isFinite(rawPct) ? rawPct : 0);

      comp.pctPlayedEffective = Math.max(0, Math.min(100, pctEffective));
      comp.pctPlayed = comp.pctPlayedEffective;
    }
  }
}

function isDescansaTeamName(teamName) {
  const n = normalizeCompKey(teamName || "");
  return n === "descansa"
    || n === "descans"
    || /^descansa\d+$/.test(n)
    || n.startsWith("descansa ");
}

function phaseTypeLabel(phaseType) {
  const t = String(phaseType || "").toLowerCase();
  if (t === "playoff") return "Playoff";
  if (t === "eliminatories") return "Eliminatòries";
  if (t === "copa") return "Copa";
  if (t === "fase_final") return "Fase final";
  return "Fase";
}

function normalizePostSeasonPhases(phases) {
  const out = [];
  const seenPhase = new Set();

  for (const phase of (phases || [])) {
    if (!phase || typeof phase !== "object") continue;
    const phaseName = String(phase.phaseName || phase.groupName || "").trim() || "Fase";
    const phaseType = String(phase.phaseType || "lliga").trim() || "lliga";
    const phaseKey = `${normalizeCompKey(phaseName)}::${phaseType}`;
    if (!phaseKey || seenPhase.has(phaseKey)) continue;
    seenPhase.add(phaseKey);

    const matches = [];
    const seenMatch = new Set();
    for (const m of (phase.matches || [])) {
      const home = normalizeJokClubDisplayName(m?.home || "");
      const away = normalizeJokClubDisplayName(m?.away || "");
      if (!home || !away) continue;
      const key = [
        normalizeCompKey(home),
        normalizeCompKey(away),
        String(m?.date || ""),
        String(m?.time || ""),
        String(m?.jornada || ""),
        String(m?.homeScore ?? ""),
        String(m?.awayScore ?? ""),
      ].join("|");
      if (seenMatch.has(key)) continue;
      seenMatch.add(key);
      matches.push({
        jornada: m?.jornada ?? null,
        home,
        away,
        date: String(m?.date || ""),
        time: String(m?.time || ""),
        homeScore: m?.homeScore ?? null,
        awayScore: m?.awayScore ?? null,
        played: m?.played !== false && m?.homeScore != null,
        source: String(m?.source || "fecapa"),
        actaId: m?.actaId ? String(m.actaId) : null,
        actaUrl: m?.actaUrl ? String(m.actaUrl) : null,
        phaseName,
        phaseType,
        venue: String(m?.venue || "").trim(),
        placeholder: m?.placeholder === true,
      });
    }

    out.push({
      phaseId: String(phase.phaseId || phaseKey),
      phaseName,
      phaseType,
      isPostSeason: phase.isPostSeason === true || ["playoff", "eliminatories", "copa", "fase_final"].includes(phaseType),
      matchCount: matches.length,
      matches,
    });
  }

  return out;
}

function mergePostSeasonPhasesFromCompetitions(comps) {
  return normalizePostSeasonPhases((comps || []).flatMap(c => c?.postSeasonPhases || []));
}

function scoredCalendarMatchesCount(comp) {
  return (comp?.calendar || []).filter(m => m?.homeScore != null && m?.awayScore != null).length;
}

function unresolvedCalendarMatchesCount(comp) {
  return (comp?.calendar || []).filter(m =>
    (m?.homeScore == null || m?.awayScore == null) &&
    String(m?.time || "") === "00:00"
  ).length;
}

function teamMatchesCalendarExact(a, b) {
  const ka = normalizeTeamNameStrict(a || "");
  const kb = normalizeTeamNameStrict(b || "");
  if (!!ka && !!kb && ka === kb) return true;

  const sa = extractTeamSuffix(a);
  const sb = extractTeamSuffix(b);
  if ((sa && !sb) || (!sa && sb)) return false;
  if (sa && sb && sa !== sb) return false;

  const ma = normalizeTeamKeyForMatching(a || "");
  const mb = normalizeTeamKeyForMatching(b || "");
  return !!ma && !!mb && ma === mb;
}

function competitionHasCalendarTeam(comp, teamName) {
  if (!comp || !teamName) return false;
  const regular = (comp.calendar || []).some(m =>
    teamMatchesCalendarExact(m?.home, teamName) || teamMatchesCalendarExact(m?.away, teamName)
  );
  if (regular) return true;
  return (comp.postSeasonPhases || []).some(phase =>
    (phase?.matches || []).some(m =>
      teamMatchesCalendarExact(m?.home, teamName) || teamMatchesCalendarExact(m?.away, teamName)
    )
  );
}

function competitionHasClassificationTeamId(comp, teamId) {
  if (!comp || !teamId) return false;
  const wanted = String(teamId);
  return (comp.classification || []).some(r => String(r?.teamId || "") === wanted);
}

function resolveSelectedTeam(comp, teamName, teamIdHint = null) {
  const rows = comp?.classification || [];
  const hint = String(teamIdHint || "").trim();
  if (hint) {
    const byId = rows.find(r => String(r?.teamId || "") === hint);
    if (byId) {
      return {
        teamName: byId.team || teamName || null,
        teamId: String(byId.teamId || hint),
      };
    }
  }

  const wanted = String(teamName || "").trim();
  if (!wanted) return { teamName: null, teamId: hint || null };

  const exactRows = rows.filter(r => teamMatchesCalendarExact(r?.team, wanted));
  if (exactRows.length === 1) {
    return {
      teamName: exactRows[0].team || wanted,
      teamId: exactRows[0].teamId ? String(exactRows[0].teamId) : null,
    };
  }

  const best = findBestClassifRow(rows, wanted);
  return {
    teamName: best?.team || wanted,
    teamId: best?.teamId ? String(best.teamId) : (hint || null),
  };
}

function buildDetailCompView(baseComp, preferredTeamName = null, preferredTeamId = null) {
  if (!baseComp || !DB?.categories) return baseComp;

  const catKey = getCatForComp(baseComp);
  const nameKey = normalizeCompKey(baseComp.name || "");
  const siblings = (DB.categories?.[catKey] || [])
    .filter(c => normalizeCompKey(c?.name || "") === nameKey);

  if (siblings.length <= 1) {
    return {
      ...baseComp,
      postSeasonPhases: normalizePostSeasonPhases(baseComp?.postSeasonPhases || []),
      detailMergeInfo: {
        merged: false,
        baseCompId: String(baseComp.id || ""),
        classificationFromCompId: String(baseComp.id || ""),
        calendarFromCompId: String(baseComp.id || ""),
        sameNameCompIds: [String(baseComp.id || "")],
      },
    };
  }

  // If detail opens from a competition card (no team context), keep data scoped to this competition.
  const hasTeamContext = !!String(preferredTeamName || "").trim() || !!String(preferredTeamId || "").trim();
  if (!hasTeamContext) {
    return {
      ...baseComp,
      postSeasonPhases: normalizePostSeasonPhases(baseComp?.postSeasonPhases || []),
      detailMergeInfo: {
        merged: false,
        baseCompId: String(baseComp.id || ""),
        classificationFromCompId: String(baseComp.id || ""),
        calendarFromCompId: String(baseComp.id || ""),
        sameNameCompIds: [String(baseComp.id || "")],
      },
    };
  }

  const classScore = c => {
    const rows = hasClassRows(c?.classification) ? c.classification.length : 0;
    return rows * 100 + scoredCalendarMatchesCount(c);
  };
  const calScore = c => {
    const scored = scoredCalendarMatchesCount(c);
    const unresolved = unresolvedCalendarMatchesCount(c);
    return (scored * 10) + (c?.calendar?.length || 0) + Number(c?.pctPlayed || 0) - (unresolved * 2);
  };

  const baseHasTeamByName = preferredTeamName ? competitionHasCalendarTeam(baseComp, preferredTeamName) : false;

  let classCandidates = siblings;
  if (preferredTeamId) {
    const byId = siblings.filter(c => competitionHasClassificationTeamId(c, preferredTeamId));
    if (byId.length) classCandidates = byId;
  } else if (preferredTeamName && baseHasTeamByName) {
    // If identity is name-only, keep the classif anchored to the clicked competition.
    classCandidates = [baseComp];
  }
  const bestClassComp = classCandidates.reduce((best, c) => classScore(c) > classScore(best) ? c : best, classCandidates[0]);

  let calendarCandidates = siblings;
  if (preferredTeamId) {
    const byTeamId = siblings.filter(c => competitionHasClassificationTeamId(c, preferredTeamId));
    if (byTeamId.length) calendarCandidates = byTeamId;
    else if (preferredTeamName) calendarCandidates = siblings.filter(c => competitionHasCalendarTeam(c, preferredTeamName));
  } else if (preferredTeamName) {
    // Name-only selection is ambiguous across sibling groups; prefer the clicked competition.
    if (baseHasTeamByName) calendarCandidates = [baseComp];
    else calendarCandidates = siblings.filter(c => competitionHasCalendarTeam(c, preferredTeamName));
  }
  const scopedCalendarCandidates = calendarCandidates.length ? calendarCandidates : siblings;
  const bestCalendarComp = scopedCalendarCandidates.reduce((best, c) => calScore(c) > calScore(best) ? c : best, scopedCalendarCandidates[0]);
  const phaseSourceComps = preferredTeamName ? [bestCalendarComp] : siblings;

  const merged = {
    ...baseComp,
    classification: Array.isArray(bestClassComp?.classification) ? bestClassComp.classification : [],
    calendar: Array.isArray(bestCalendarComp?.calendar)
      ? bestCalendarComp.calendar.map(m => ({ ...m, compId: String(bestCalendarComp.id || baseComp.id || "") }))
      : [],
    postSeasonPhases: normalizePostSeasonPhases(mergePostSeasonPhasesFromCompetitions(phaseSourceComps)),
    pctPlayed: Math.max(...siblings.map(c => Number(getCompPlayedPct(c) || 0))),
    detailMergeInfo: {
      merged: String(bestClassComp?.id || "") !== String(baseComp.id || "") || String(bestCalendarComp?.id || "") !== String(baseComp.id || ""),
      baseCompId: String(baseComp.id || ""),
      classificationFromCompId: String(bestClassComp?.id || baseComp.id || ""),
      calendarFromCompId: String(bestCalendarComp?.id || baseComp.id || ""),
      sameNameCompIds: siblings.map(c => String(c?.id || "")).filter(Boolean),
    },
  };

  if (bestClassComp?.classificationSource) merged.classificationSource = bestClassComp.classificationSource;
  if (bestClassComp?.classificationPilot) merged.classificationPilot = bestClassComp.classificationPilot;

  return merged;
}

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

function parseMatchKickoffTimestamp(match, compName = "") {
  const base = parseMatchTimestamp(match?.date || "", compName || "");
  const time = String(match?.time || "").trim();
  const tm = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!tm) return base;
  const hh = Math.max(0, Math.min(23, parseInt(tm[1], 10)));
  const mm = Math.max(0, Math.min(59, parseInt(tm[2], 10)));
  return base + ((hh * 60 + mm) * 60 * 1000);
}

function isPlaceholderTeamName(teamName) {
  const n = normalizeCompKey(teamName || "");
  return n === "per definir" || n === "tbd" || n === "pendent";
}

function isCalendarFilterNoiseName(teamName) {
  const raw = String(teamName || "").trim();
  if (!raw) return true;
  if (isDescansaTeamName(raw) || isPlaceholderTeamName(raw)) return true;

  const n = normalizeCompKey(raw);
  if (!n) return true;
  if (/^jornada\s*\d+\b/.test(n) || /^j\s*\d+\b/.test(n)) return true;
  if (/^(vuitens|quarts|semifinals?|semis?|final|eliminatories\s+previes)\b/.test(n)) return true;
  if (/(^|\b)(pavello|pabello|pavellon|pabellon|pavilion|seu|pista|cem|poliesportiu|municipal|palau|complex|zona\s+esportiva|camp\s+municipal)(\b|$)/.test(n)) return true;
  if (/^[a-z]{1,3}\s+\d+$/.test(n)) return true;
  return false;
}

function isLikelyCompetitionTeamName(teamName, comp = null) {
  const raw = String(teamName || "").trim();
  if (!raw || isCalendarFilterNoiseName(raw)) return false;

  const classifTeams = (comp?.classification || []).map(r => String(r?.team || "").trim()).filter(Boolean);
  const rosterTeams = (comp?.teams || []).map(t => String(t?.teamName || t?.name || "").trim()).filter(Boolean);
  const knownTeams = [...new Set([...classifTeams, ...rosterTeams])];

  if (knownTeams.length) {
    return knownTeams.some(t => teamMatchesCalendarExact(raw, t));
  }

  return !!getClubId(raw);
}

function getCalendarFilterableTeamNames(matches, comp = null) {
  return [...new Set([
    ...(matches || []).map(m => m?.home),
    ...(matches || []).map(m => m?.away),
  ])]
    .map(t => String(t || "").trim())
    .filter(Boolean)
    .filter(t => isLikelyCompetitionTeamName(t, comp))
    .sort();
}

function getDetailCalendarSourceMatches(comp) {
  if (!comp) return [];
  const allCalendar = comp.calendar || [];
  const phaseMatches = normalizePostSeasonPhases(comp.postSeasonPhases || []).flatMap(phase =>
    (phase?.matches || []).map(m => ({
      ...m,
      phaseName: m?.phaseName || phase.phaseName,
      phaseType: m?.phaseType || phase.phaseType,
    }))
  );
  if (!phaseMatches.length) return allCalendar;
  return mergePilotCalendarMatches(allCalendar, phaseMatches);
}

function getTiePhaseKey(phaseName, phaseType) {
  const n = normalizeCompKey(phaseName || phaseType || "fase");
  if (!n) return "fase";
  // Normalize leg-specific wording so anada/tornada (or ida/vuelta) share one tie key.
  return n
    .replace(/\bpartit\s+d\b/g, " ")
    .replace(/\b(anada|tornada|ida|vuelta)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "fase";
}

function buildTwoLegEliminationContext(matches, compName = "") {
  const ctxByMatch = new WeakMap();
  const groups = new Map();
  const phaseNameRe = /(eliminat|play\s*-?\s*off|fase\s*final|final\s*a\s*4|final\s*four|copa)/i;
  const twoLegHintRe = /(anada|tornada|ida|vuelta)/i;

  for (const m of (matches || [])) {
    if (!m || !m.home || !m.away) continue;
    if (m?.placeholder === true) continue;
    if (isDescansaTeamName(m.home) || isDescansaTeamName(m.away)) continue;

    const phaseType = String(m?.phaseType || "").toLowerCase();
    const phaseName = String(m?.phaseName || m?._phaseName || "");
    const isElim = ["eliminatories", "playoff", "fase_final", "copa"].includes(phaseType)
      || phaseNameRe.test(phaseName)
      || twoLegHintRe.test(phaseName);
    if (!isElim) continue;

    const homeKey = normalizeCompKey(m.home || "");
    const awayKey = normalizeCompKey(m.away || "");
    if (!homeKey || !awayKey || homeKey === awayKey) continue;

    const pairKey = [homeKey, awayKey].sort().join("|");
    const phaseKey = getTiePhaseKey(phaseName, phaseType);
    const key = `${phaseKey}::${pairKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  for (const tieMatches of groups.values()) {
    if (!Array.isArray(tieMatches) || tieMatches.length < 2) continue;

    tieMatches.sort((a, b) => parseMatchKickoffTimestamp(a, compName) - parseMatchKickoffTimestamp(b, compName));
    const first = tieMatches[0];
    const second = tieMatches[1];
    if (!first || !second) continue;

    const secondPlayed = second?.homeScore != null && second?.awayScore != null;
    const firstPlayed = first?.homeScore != null && first?.awayScore != null;

    let qualifiedTeam = null;
    let aggregateText = "";
    if (firstPlayed && secondPlayed) {
      const totals = new Map();
      const add = (team, goals) => {
        const key = normalizeCompKey(team || "");
        if (!key) return;
        const current = totals.get(key) || 0;
        totals.set(key, current + (Number(goals) || 0));
      };

      add(first.home, first.homeScore);
      add(first.away, first.awayScore);
      add(second.home, second.homeScore);
      add(second.away, second.awayScore);

      const secondHomeKey = normalizeCompKey(second.home || "");
      const secondAwayKey = normalizeCompKey(second.away || "");
      const gh = totals.get(secondHomeKey) || 0;
      const ga = totals.get(secondAwayKey) || 0;
      aggregateText = `${second.home} ${gh} - ${ga} ${second.away}`;
      if (gh !== ga) qualifiedTeam = gh > ga ? second.home : second.away;
    }

    ctxByMatch.set(second, {
      isSecondLeg: true,
      firstLeg: first,
      aggregateText,
      qualifiedTeam,
    });
  }

  return ctxByMatch;
}

// ── Match card ────────────────────────────────────────────────
function matchCard(m, myTeam, compId, options = {}) {
  const { showTravel = false, eliminationCtx = null } = options || {};
  const effectiveCompId = compId || m.compId;
  const riH    = teamIn(m.home,myTeam), riA = teamIn(m.away,myTeam);
  const played = m.played!==false && m.homeScore!=null;
  const isByeHome = isDescansaTeamName(m.home);
  const isByeAway = isDescansaTeamName(m.away);
  const cidH   = isByeHome ? null : getClubId(m.home);
  const cidA   = isByeAway ? null : getClubId(m.away);
  const acta   = getMatchActa(m, effectiveCompId);
  const hasActa = !!(acta && (acta.actaUrl || acta.url));

  // Debug logging
  if (!played) {
    console.log("Match card - played:", played, "compId param:", compId, "m.compId:", m.compId, "effectiveCompId:", effectiveCompId);
    if (!effectiveCompId) {
      console.warn("NO COMPID FOR MATCH:", { home: m.home, away: m.away });
    }
  }

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

  // Afegir icona de ubicació si no és jugat i hi ha coordenades
  let venueIcon = "";
  const venueCoords = !played && !isByeHome ? getVenueCoordinates(m.home) : null;
  if (venueCoords) {
    const coords = venueCoords;
    if (coords.lat && coords.lng) {
      const isApple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
      const mapsUrl = isApple
        ? `https://maps.apple.com/?q=${coords.lat},${coords.lng}`
        : `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
      const mapsApp = `maps://?q=${coords.lat},${coords.lng}`;
      venueIcon = `<div style="text-align:center;margin-top:6px"><a href="${isApple?mapsApp:mapsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#fff;color:#003da5;border:1px solid #e2e6ef;font-size:11px;font-weight:700;padding:2px 6px;border-radius:999px;text-decoration:none;cursor:pointer">📍</a></div>`;
    }
  }

  const travel = showTravel ? estimateTravelForMatch(m, myTeam) : null;
  const travelHtml = travel
    ? `<div style="margin-top:5px;font-size:10px;color:#0f766e;font-weight:700">🚗 ~${travel.minutes} min · ${travel.km.toFixed(1)} km</div>`
    : "";
  const venueLabel = String(m?.venue || "").trim();
  const venueHtml = venueLabel
    ? `<div style="margin-top:4px;font-size:10px;color:#64748b;font-weight:600;line-height:1.25">🏟 ${esc(venueLabel)}</div>`
    : "";
  const sourceRaw = String(m?.source || "").toLowerCase();
  const sourceLabel = sourceRaw.includes("jok") && sourceRaw.includes("fecapa")
    ? "jok+fecapa"
    : (sourceRaw.includes("jok") ? "jok.cat" : (sourceRaw.includes("fecapa") ? "fecapa" : ""));
  const sourceBg = sourceLabel === "jok.cat" ? "#eef2ff" : sourceLabel === "fecapa" ? "#ecfeff" : "#f8fafc";
  const sourceColor = sourceLabel === "jok.cat" ? "#3730a3" : sourceLabel === "fecapa" ? "#0e7490" : "#475569";
  const sourceHtml = sourceLabel
    ? `<div style="margin-top:4px"><span style="display:inline-flex;align-items:center;background:${sourceBg};color:${sourceColor};border:1px solid #e2e8f0;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700">${esc(sourceLabel)}</span></div>`
    : "";

  // Icones d'anàlisi (mostrar per a tots els usuaris)
  const encHome = encodeURIComponent(String(m.home || ""));
  const encAway = encodeURIComponent(String(m.away || ""));
  const encComp = encodeURIComponent(String(effectiveCompId || ""));
  const encMine = encodeURIComponent(String(myTeam || ""));
  const homeAnalysisIcon = !played && effectiveCompId && !isByeHome
    ? `<button onclick="event.stopPropagation(); openRivalAnalysis(decodeURIComponent('${encHome}'), decodeURIComponent('${encComp}'), decodeURIComponent('${encMine}'))" style="background:none;border:none;font-size:14px;cursor:pointer;padding:2px" title="Anàlisi ${m.home}">🔍</button>`
    : "";

  const awayAnalysisIcon = !played && effectiveCompId && !isByeAway
    ? `<button onclick="event.stopPropagation(); openRivalAnalysis(decodeURIComponent('${encAway}'), decodeURIComponent('${encComp}'), decodeURIComponent('${encMine}'))" style="background:none;border:none;font-size:14px;cursor:pointer;padding:2px" title="Anàlisi ${m.away}">🔍</button>`
    : "";

  const isQualifiedHome = !!(eliminationCtx?.qualifiedTeam && teamMatchesCalendarExact(eliminationCtx.qualifiedTeam, m.home));
  const isQualifiedAway = !!(eliminationCtx?.qualifiedTeam && teamMatchesCalendarExact(eliminationCtx.qualifiedTeam, m.away));
  const homeQualifiedBadge = isQualifiedHome
    ? `<span style="display:inline-flex;align-items:center;background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:700;white-space:nowrap">✅ Classificat</span>`
    : "";
  const awayQualifiedBadge = isQualifiedAway
    ? `<span style="display:inline-flex;align-items:center;background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:700;white-space:nowrap">✅ Classificat</span>`
    : "";

  const firstLeg = eliminationCtx?.firstLeg || null;
  const firstLegPlayed = firstLeg && firstLeg.homeScore != null && firstLeg.awayScore != null;
  const firstLegSummary = firstLeg
    ? `${normalizeJokClubDisplayName(firstLeg.home)} ${firstLegPlayed ? `${firstLeg.homeScore} - ${firstLeg.awayScore}` : "vs"} ${normalizeJokClubDisplayName(firstLeg.away)}`
    : "";
  const eliminationDetail = eliminationCtx?.isSecondLeg
    ? `<div style="margin-top:7px;padding:6px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Partit d'anada</div>
        <div style="font-size:12px;color:#334155;margin-top:2px">${esc(firstLegSummary)}</div>
        ${eliminationCtx.aggregateText ? `<div style="font-size:11px;color:#0f172a;font-weight:700;margin-top:3px">Global: ${esc(eliminationCtx.aggregateText)}</div>` : ""}
      </div>`
    : "";

  const clickAttrs = hasActa
    ? `onclick="openActa('${esc(acta.actaId||"")}','${esc(acta.actaUrl||acta.url||"")}')" style="background:#fff;border:1.5px solid ${border};border-left:4px solid ${border};border-radius:10px;padding:9px 11px;margin-bottom:5px;cursor:pointer;box-shadow:0 1px 4px rgba(0,30,80,.06)"`
    : `style="background:#fff;border:1.5px solid ${border};border-left:4px solid ${border};border-radius:10px;padding:9px 11px;margin-bottom:5px"`;

  return `
    <div ${clickAttrs}>
      <div style="display:flex;align-items:center;gap:6px">
        <div style="flex:1;display:flex;align-items:center;justify-content:flex-end;gap:5px;min-width:0">
          <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;min-width:0;flex-wrap:wrap">
            ${homeQualifiedBadge}
            <span style="font-size:clamp(12px,3.5vw,14px);font-weight:${riH?800:500};color:${riH?"#003da5":"#334155"};text-align:right;line-height:1.3;overflow-wrap:anywhere">${esc(normalizeJokClubDisplayName(m.home))}</span>
          </div>
          ${homeAnalysisIcon}
          ${isByeHome ? "" : shieldImg(cidH,22)}
        </div>
        <div style="flex-shrink:0;text-align:center;min-width:68px">
          ${score}
          <div style="font-size:10px;color:#94a3b8;margin-top:2px;white-space:nowrap">${m.jornada?`J${m.jornada} · `:""}${esc(m.date||"")}${!played&&m.time?` · ${esc(m.time)}`:""}</div>
          ${sourceHtml}
          ${venueHtml}
          ${travelHtml}
          ${actaBadge}
          ${venueIcon}
        </div>
        <div style="flex:1;display:flex;align-items:center;justify-content:flex-start;gap:5px;min-width:0">
          ${isByeAway ? "" : shieldImg(cidA,22)}
          ${awayAnalysisIcon}
          <div style="display:flex;align-items:center;gap:4px;justify-content:flex-start;min-width:0;flex-wrap:wrap">
            <span style="font-size:clamp(12px,3.5vw,14px);font-weight:${riA?800:500};color:${riA?"#003da5":"#334155"};text-align:left;line-height:1.3;overflow-wrap:anywhere">${esc(normalizeJokClubDisplayName(m.away))}</span>
            ${awayQualifiedBadge}
          </div>
        </div>
      </div>
      ${eliminationDetail}
      ${badge}
    </div>`;
}

// ── HOME header & tabs ────────────────────────────────────────
function renderHome() {
  $("screen-detail").style.display = "none";
  $("screen-picker").style.display = "none";
  $("screen-home").style.display   = "flex";
  const seasonOptions = seasonCatalog.map(s =>
    `<option value="${esc(s.key)}" ${s.key === activeSeasonKey ? "selected" : ""}>${esc(s.label)}</option>`
  ).join("");
  $("home-header").innerHTML = `
    <div style="max-width:720px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900"><img src="Designer_2.png" style="height:28px;vertical-align:middle;margin-right:6px;object-fit:contain"/><span style="color:#e5001c">okCat360</span></div>
      ${renderLoginButton()}
    </div>
    <div style="max-width:720px;margin:0 auto;display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Temporada</div>
      <select onchange="onSeasonSelectChange(this.value)" style="flex:1;max-width:280px;background:#fff;border:1.5px solid #e2e6ef;border-radius:9px;padding:7px 10px;font-size:12px;color:#1a2035;font-weight:600;cursor:pointer">
        ${seasonOptions}
      </select>
      <div style="font-size:11px;color:#94a3b8;white-space:nowrap">${esc(getActiveSeasonLabel())}</div>
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
  const fmtName = p => p.slug ? formatPlayerDisplayName(decodeURIComponent(p.slug.replace(/\+/g," "))) : "?";
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

  const playerMissingRow = (jid, meta, dndType = null) => {
    const name = meta?.name || `Jugador ${jid}`;
    const dragAttrs = dndType === "player"
      ? `draggable="true" ondragstart="favDragStart('player','${esc(jid)}')" ondragend="favDragEnd()" ondragover="favDragOver(event)" ondrop="favDrop('player','${esc(jid)}')"`
      : "";
    const dragHandle = dndType === "player"
      ? `<div title="Arrossega per ordenar" style="color:#cbd5e1;font-size:16px;line-height:1;cursor:grab;user-select:none;flex-shrink:0">⋮⋮</div>`
      : "";
    return `<div ${dragAttrs} style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #f0f2f8">
      ${dragHandle}
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:#1a2035;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">No visible en aquesta temporada</div>
      </div>
      <button onclick="event.stopPropagation();togglePlayerFavAndRender('${esc(jid)}')" style="background:none;border:none;font-size:22px;cursor:pointer;padding:4px 2px;flex-shrink:0;line-height:1;color:#f59e0b">★</button>
    </div>`;
  };

  const qRaw = jugadorSearch || "";
  const q = qRaw.trim();
  let listHtml = "";

  // Jugadors seguits
  if (playerFavs.length) {
    const rows = playerFavs.map(jid => {
      const p = getPlayerById(jid);
      if (p) {
        rememberPlayerFavMeta(jid);
        return playerRow(jid, p, "player");
      }
      return playerMissingRow(jid, playerFavMeta?.[String(jid)] || null, "player");
    }).join("");
    if (rows) listHtml += `
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin-bottom:6px">⭐ Seguits</div>
      <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,30,80,.07);margin-bottom:16px">${rows}</div>`;
  }

  // Resultats de cerca
  if (q.length >= 2) {
    const qn = norm(q);
    const results = getAllPlayersEntries()
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
  void hydrateActaLinksForFavoriteComps();
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
  body.innerHTML=clubSection+levelSection+playerSection+teamSection;
}

async function hydrateActaLinksForFavoriteComps() {
  const ids = [...new Set((favs || []).map(f => String(f?.compId || "")).filter(Boolean))];
  if (!ids.length) return;

  let changed = false;
  for (const compId of ids) {
    const comp = findComp(compId);
    if (!comp) continue;
    const updated = await hydrateCompetitionActaLinks(comp, activeSeasonKey);
    if (updated) changed = true;
  }

  if (changed && homeTab === "favs") {
    renderFavs();
  }
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
  const p = getPlayerById(jid);
  if (p) rememberPlayerFavMeta(jid);
  const meta = playerFavMeta?.[String(jid)] || null;
  const name = p?.slug ? formatPlayerDisplayName(decodeURIComponent(p.slug.replace(/\+/g," "))) : (meta?.name || `Jugador ${jid}`);
  const team = normalizePlayerTeamStatsForDisplay(p)?.[0] || (meta ? { team: meta.team, cat: meta.cat } : null);
  const catLabel = team?.cat ? (CAT_LABELS[team.cat] || team.cat) : "";
  const seasonNote = p ? "" : `<div style="font-size:10px;color:#94a3b8;margin-top:3px">No disponible en aquesta temporada</div>`;
  const ctaLabel = p ? "👤 Veure fitxa" : "👤 Veure resum";
  return `
    <div draggable="true" ondragstart="favDragStart('player','${esc(jid)}')" ondragend="favDragEnd()" ondragover="favDragOver(event)" ondrop="favDrop('player','${esc(jid)}')" style="background:#fff;border:1.5px solid #e2e6ef;border-top:4px solid #1a5dc7;border-radius:14px;overflow:hidden;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <div style="display:flex;align-items:center;gap:10px;padding:11px 13px">
        <div title="Arrossega per ordenar" style="color:#cbd5e1;font-size:16px;line-height:1;cursor:grab;user-select:none">⋮⋮</div>
        <div style="width:34px;height:34px;border-radius:9px;background:#1a5dc718;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:17px">👤</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
          <div style="font-size:11px;color:#6b7a99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(team?.team || "")}${catLabel ? ` · ${esc(catLabel)}` : ""}</div>
          ${seasonNote}
        </div>
        <button onclick="removePlayerFavHome('${esc(jid)}')" style="background:none;border:none;color:#cbd5e1;font-size:16px;cursor:pointer;padding:4px;flex-shrink:0">✕</button>
      </div>
      <div style="display:flex;gap:6px;padding:0 12px 11px">
        <button onclick="openPlayerModal('${esc(jid)}','${esc(name)}')" style="flex:1;background:#f5f7fc;border:1px solid #e2e6ef;border-radius:8px;padding:7px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">${ctaLabel}</button>
      </div>
    </div>`;
}

function buildClubFavCard(fav, clubMap) {
  const club = clubMap?.get(fav.key) || clubMap?.get(decodeHtml(fav.key));
  const displayName = normalizeJokClubDisplayName(club?.displayName || fav.displayName);
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
  if (is3x3Competition(comp)) return "";
  const cl=comp.classification||[], cal=comp.calendar||[];
  const hideClassifUi = shouldHideClassificationUi(comp);
  const myRow=cl.find(r=>teamMatchesLoose(r.team,fav.teamName));
  const myCal=cal.filter(m=>teamIn(m.home,fav.teamName)||teamIn(m.away,fav.teamName));
  const {last, next} = getLastAndNext(cal, fav.teamName);
  const cid=myRow?rowClubId(myRow):getClubId(fav.teamName);
  const catColor=CAT_COLOR[fav.category]||"#e5001c";
  const sourceBadge = classifSourceBadgeHtml(comp);

  let classifHtml="";
  if (cl.length&&myRow) {
    const myIdx=cl.findIndex(r=>teamMatchesLoose(r.team,fav.teamName));
    const slice=cl.slice(Math.max(0,myIdx-2),Math.min(cl.length,myIdx+3));
    classifHtml=`
      <div style="border-top:1px solid #f0f2f8;border-bottom:1px solid #f0f2f8">
        <div style="display:flex;background:#f8fafc;padding:3px 12px">
          ${["#","Equip","PJ","G","E","Pe","Avg","Pts"].map((h,i)=>`<div style="width:${i===0?26:i===1?'auto':i===7?32:i===6?30:22}px;${i===1?"flex:1;":""}font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:${i===3?"#16a34a":i===4?"#d97706":i===5?"#dc2626":i===6?"#64748b":i===7?"#e5001c":"#94a3b8"};${i>1?"text-align:center":""}">${h}</div>`).join("")}
        </div>
        ${slice.map(r=>{
          const mine=teamMatchesLoose(r.team,fav.teamName), rcid=rowClubId(r);
          const avg = calcGoalAverage(r.gf, r.gc);
          const avgColor = goalAverageColor(avg);
          return `<div style="display:flex;align-items:center;background:${mine?"#eff6ff":"#fff"};border-top:1px solid #f0f2f8;padding:5px 12px">
            <div style="width:26px;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:${posColor(r.pos)}">${r.pos}</div>
            <div style="flex:1;display:flex;align-items:center;gap:5px;min-width:0">${shieldImg(rcid,18)}<span style="font-size:12px;font-weight:${mine?800:500};color:${mine?"#003da5":"#334155"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(normalizeJokClubDisplayName(r.team))}</span></div>
            <div style="width:22px;text-align:center;font-size:12px;color:#94a3b8">${r.pj??"-"}</div>
            <div style="width:22px;text-align:center;font-size:12px;color:#16a34a;font-weight:600">${r.pg??"-"}</div>
            <div style="width:22px;text-align:center;font-size:12px;color:#d97706">${r.pe??"-"}</div>
            <div style="width:22px;text-align:center;font-size:12px;color:#dc2626">${r.pp??"-"}</div>
            <div style="width:30px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:${avgColor}">${formatGoalAverage(avg)}</div>
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
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:clamp(16px,5vw,20px);font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(normalizeJokClubDisplayName(fav.teamName))}</div>
          <div style="font-size:11px;color:#6b7a99;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(stripSeasonSuffix(comp.name||""))}</div>
          ${sourceBadge ? `<div style="margin-top:4px">${sourceBadge}</div>` : ""}
        </div>
        ${myRow?`<div style="background:${posColor(myRow.pos)}18;color:${posColor(myRow.pos)};border:1.5px solid ${posColor(myRow.pos)}44;border-radius:10px;padding:5px 9px;text-align:center;flex-shrink:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900;line-height:1">${myRow.pos}è</div>
          <div style="font-size:9px;margin-top:1px">${myRow.pts} pts</div>
        </div>`:""}
        <button onclick="removeFav('${esc(fav.compId)}','${esc(fav.teamName)}')" style="background:none;border:none;color:#cbd5e1;font-size:16px;cursor:pointer;padding:4px;flex-shrink:0">✕</button>
      </div>
      ${classifHtml}
      <div style="padding:9px 12px">
        ${last?`<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">Últim resultat</div>${matchCard(last,fav.teamName,fav.compId)}`:""}
        ${next?`<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;${last?"margin-top:7px":""}">Proper partit</div>${matchCard(next,fav.teamName,fav.compId,{ showTravel:true })}`:""}
        ${!last&&!next?`<p style="text-align:center;color:#94a3b8;font-size:13px;padding:2px 0">Sense partits registrats</p>`:""}
      </div>
      <div style="display:flex;gap:6px;padding:0 12px 11px">
        ${hideClassifUi ? "" : `<button onclick="openDetail('${esc(fav.compId)}','${esc(fav.teamName)}','classif')" style="flex:1;background:#f5f7fc;border:1px solid #e2e6ef;border-radius:8px;padding:7px;font-size:12px;font-weight:600;color:#003da5;cursor:pointer">📊 Classificació</button>`}
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

function teamKeyFromRow(row, category) {
  const catKey = normalizeCompKey(category || "altres");
  if (row?.teamId) return `id:${row.teamId}::cat:${catKey}`;
  return `name:${String(row?.team || "").toLowerCase().replace(/\s+/g, " ").trim()}::cat:${catKey}`;
}

function semanticClubKey(name) {
  return String(name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(club|hoquei|hockey|pati|patins|patin|ch|cp|hc|clubes|clubi|d|de|del|la|el|els|les)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rowsForClubMap(comp) {
  const classRows = (comp?.classification || [])
    .filter(r => r && String(r.team || "").trim())
    .filter(r => !isDescansaTeamName(r.team) && !isPlaceholderTeamName(r.team));
  if (classRows.length) return classRows;

  const teamRows = (comp?.teams || [])
    .map(t => {
      const teamId = t?.id || t?.teamId || null;
      const teamName = normalizeJokClubDisplayName(t?.name || t?.teamName || "");
      const clubId = teamId ? (comp?.teamToClub?.[String(teamId)] || null) : null;
      return {
        teamId,
        team: teamName,
        clubId,
      };
    })
    .filter(r => String(r.team || "").trim() && !isDescansaTeamName(r.team));

  if (teamRows.length) return teamRows;

  const seen = new Set();
  const calRows = [];
  for (const m of (comp?.calendar || [])) {
    const pair = [m?.home, m?.away];
    for (const rawName of pair) {
      const team = normalizeJokClubDisplayName(rawName || "");
      if (!team || isDescansaTeamName(team)) continue;
      const k = team.toLowerCase().replace(/\s+/g, " ").trim();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      calRows.push({ teamId: null, team, clubId: getClubId(team) || null });
    }
  }

  return calRows;
}

function buildClubMap() {
  const clubMap = new Map(); // normalizedName → { displayName, clubId, teams:[] }
  for (const comps of Object.values(DB.categories)) {
    for (const comp of comps) {
      if (is3x3Competition(comp)) continue;
      for (const row of rowsForClubMap(comp)) {
        if (!row.team) continue;
        const teamName = decodeHtml(row.team);
        const clubName = teamName.toLowerCase().replace(/\s+[a-e]$/,"").trim();
        if (!clubMap.has(clubName)) {
          clubMap.set(clubName, { displayName: teamName.replace(/\s+[A-E]$/,"").trim(), clubId: rowClubId(row, comp), teams:[] });
        }
        const club = clubMap.get(clubName);
        if (!club.clubId) club.clubId = rowClubId(row, comp);
        const category = getCatForComp(comp);
        const key = teamKeyFromRow(row, category);
        const existingIdx = club.teams.findIndex(t => t.teamKey === key);
        const candidate = { compId:comp.id, teamName:row.team, teamId:row.teamId, compName:comp.name, category, teamKey:key };
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
    // Canonical = prefer name starting with "club", then shortest (main club names tend to be shorter than section names like "veterans")
    const canonical = [...keys].sort((a,b) => {
      const ac = a.startsWith("club") ? 1 : 0, bc = b.startsWith("club") ? 1 : 0;
      return ac !== bc ? bc - ac : a.length - b.length;
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

  // Merge aliases by semantic club name (e.g. "CH Ripollet" vs "Club Hoquei Ripollet").
  const bySemantic = new Map();
  for (const key of clubMap.keys()) {
    const semantic = semanticClubKey(key);
    if (!semantic || semantic.length < 4) continue;
    if (!bySemantic.has(semantic)) bySemantic.set(semantic, []);
    bySemantic.get(semantic).push(key);
  }

  for (const keys of bySemantic.values()) {
    if (keys.length <= 1) continue;
    const canonical = [...keys].sort((a, b) => a.length - b.length)[0];
    const main = clubMap.get(canonical);
    if (!main) continue;
    for (const key of keys) {
      if (key === canonical) continue;
      const other = clubMap.get(key);
      if (!other) continue;
      if (!main.clubId && other.clubId) main.clubId = other.clubId;
      for (const t of other.teams) {
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
  const totalClubsCount = filtered.length;

  if (selectedClub) {
    renderClubDashboard();
    return;
  }

  $("home-body").innerHTML = `
    <div style="padding:0 0 8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#6b7a99;cursor:pointer;white-space:nowrap">
          <input type="checkbox" ${allOnlyActive?"checked":""} onchange="allOnlyActive=this.checked;renderClubTab()" style="width:16px;height:16px;accent-color:#003da5"/>
          Només en curs
        </label>
        <div style="font-size:12px;font-weight:700;color:#334155;background:#f8fafc;border:1px solid #e2e6ef;border-radius:999px;padding:5px 10px;white-space:nowrap">Total clubs: ${totalClubsCount}</div>
        <input id="club-search" placeholder="🔍 Cerca club..." value="${esc(clubSearch)}"
          style="flex:1;min-width:180px;background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:9px 13px;font-size:14px;color:#1a2035;outline:none"
          oninput="clubSearch=this.value;renderClubTab(this.selectionStart)"/>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">
        ${filtered.map(([key,club])=>{
          // Check how many teams have venues mapped
          const teamsWithVenue = club.teams.filter(t=>venuesDB?.venues?.[t.teamName]?.lat).length;
          const venueIcon = teamsWithVenue > 0 ? "📍" : "❌";
          const venuePercent = club.teams.length > 0 ? Math.round(teamsWithVenue / club.teams.length * 100) : 0;
          return `
          <div onclick="selectClub('${esc(key)}')" style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:12px 8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;transition:all .15s;text-align:center;position:relative" onmouseover="this.style.borderColor='#003da5';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#e2e6ef';this.style.transform='none'">
            <button onclick="event.stopPropagation();toggleClubFav('${esc(key)}','${esc(club.displayName)}','${esc(club.clubId||"")}');renderClubTab()" style="position:absolute;top:5px;right:5px;background:none;border:none;font-size:15px;cursor:pointer;padding:2px;line-height:1">${isClubFav(key)?"⭐":"☆"}</button>
            ${shieldImg(club.clubId,36)}
            <div style="font-size:12px;font-weight:700;color:#1a2035;line-height:1.2">${esc(club.displayName)}</div>
            <div style="font-size:10px;color:#94a3b8"><span title="${teamsWithVenue}/${club.teams.length} equips amb ubicació">${club.teams.length} equip${club.teams.length!==1?"s":""} <span style="font-size:12px;margin-left:2px">${venueIcon}</span></span></div>
          </div>`;
        }).join("")}
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
  if (entry) { selectedClub={key,...entry}; renderClubDashboard(); window.scrollTo(0,0); }
};

function findClubKeyByTeamName(teamName) {
  const wanted = String(teamName || "").trim();
  if (!wanted) return null;

  const map = buildClubMap();
  const strictWanted = normalizeTeamNameStrict(wanted);
  for (const [key, club] of map.entries()) {
    const teams = club?.teams || [];
    const match = teams.some(t => {
      const name = String(t?.teamName || "");
      if (!name) return false;
      return normalizeTeamNameStrict(name) === strictWanted || teamMatchesLoose(name, wanted);
    });
    if (match) return key;
  }

  const fallbackKey = wanted.toLowerCase().replace(/\s+[a-e]$/, "").trim();
  return map.has(fallbackKey) ? fallbackKey : null;
}

window.openClubFromClassif = teamName => {
  const key = findClubKeyByTeamName(teamName);
  homeTab = "club";
  selectedClub = null;
  clubSearch = "";

  ["screen-detail", "screen-picker", "screen-acta", "screen-admin"].forEach(id => {
    const el = $(id);
    if (el) el.style.display = "none";
  });
  $("screen-home").style.display = "flex";

  if (key) {
    selectClub(key);
    return;
  }

  clubSearch = shortTeamDisplayName(teamName || "");
  renderHome();
  window.scrollTo(0, 0);
};

function renderClubDashboard() {
  const club = selectedClub;

  // Hydrate finals calendars for this club in background so status/next matches are accurate.
  const pilotComps = [...new Set((club?.teams || []).map(t => String(t?.compId || "")).filter(Boolean))]
    .map(id => findComp(id))
    .filter(c => isFinalsPilotComp(c));
  if (pilotComps.length) {
    Promise.all(pilotComps.map(c => ensurePilotFinalsDataForComp(c)))
      .then(changed => {
        if (changed.some(Boolean)) {
          applyCompetitionActivityHeuristics();
          if (selectedClub?.key === club?.key) renderClubDashboard();
        }
      })
      .catch(() => {});
  }

  const catOrder = ["Prebenjamí","Benjamí","Aleví","Infantil","Juvenil","Júnior","1ª Catalana","2ª Catalana","3ª Catalana","Nacional Catalana","Veterans","Altres","Fem"];

  // Sort teams by category order
  const sorted = [...club.teams].sort((a,b)=>{
    const ai=catOrder.indexOf(a.category), bi=catOrder.indexOf(b.category);
    return (ai===-1?99:ai)-(bi===-1?99:bi);
  });

  const teamCards = sorted.map(t=>{
    const comp=findComp(t.compId); if (!comp) return "";
    const cl=comp.classification||[], cal=comp.calendar||[];
    const teamCalendar = cal.filter(m=>teamIn(m.home,t.teamName)||teamIn(m.away,t.teamName));
    const hasPendingTeamMatch = teamCalendar.some(m =>
      !isPlaceholderTeamName(m?.home) &&
      !isPlaceholderTeamName(m?.away) &&
      !isDescansaTeamName(m?.home) &&
      !isDescansaTeamName(m?.away) &&
      (m?.homeScore == null || m?.awayScore == null)
    );
    if (allOnlyActive && !isActive(comp) && !hasPendingTeamMatch) return "";
    const playedPct = getCompPlayedPct(comp);
    const statusFlag = (!hasPendingTeamMatch && playedPct >= 100)
      ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#ecfdf3;color:#166534;border:1px solid #bbf7d0;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:800;line-height:1;flex-shrink:0">✅ Acabada</span>`
      : `<span style="display:inline-flex;align-items:center;gap:4px;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:800;line-height:1;flex-shrink:0">🟠 En curs</span>`;
    const myRow=cl.find(r=>teamIn(r.team,t.teamName));
    const myCal=cal.filter(m=>teamIn(m.home,t.teamName)||teamIn(m.away,t.teamName));
    const {last, next} = getLastAndNext(cal, t.teamName);
    const catColor=CAT_COLOR[t.category]||"#6b7a99";
    const catEmoji=CAT_EMOJI[t.category]||"🏒";
    const teamFavOn = isFav(t.compId, t.teamName);

    return `
      <div style="background:#fff;border:1.5px solid #e2e6ef;border-left:4px solid ${catColor};border-radius:12px;overflow:hidden;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #f0f2f8">
          <span style="font-size:14px">${catEmoji}</span>
          <div style="flex:1;min-width:0">
            <button onclick="openTeamProfileFromClub('${esc(t.compId)}','${esc(t.teamName)}','${esc(String(t.teamId||""))}','${esc(t.category||"")}','${esc(club.key||"")}')" style="background:none;border:none;padding:0;margin:0;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#003da5;cursor:pointer;text-align:left;max-width:100%">${decodeHtml(t.teamName)}</button>
            <div style="font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(stripSeasonSuffix(comp.name||""))}</div>
          </div>
          ${myRow?`<span style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:900;color:${posColor(myRow.pos)};flex-shrink:0">${myRow.pos}è · ${myRow.pts}pts</span>`:""}
          ${statusFlag}
          <button onclick="toggleFav('${esc(t.compId)}','${esc(t.teamName)}','${esc(comp.name||"")}','${esc(t.category||"")}');renderClubDashboard()" style="background:${teamFavOn?"#fef9c3":"#f0f4f8"};border:1px solid ${teamFavOn?"#fcd34d":"#e2e6ef"};color:${teamFavOn?"#92400e":"#64748b"};border-radius:7px;padding:4px 8px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0" title="${teamFavOn?"Treure de favorits":"Afegir a favorits"}">${teamFavOn?"⭐":"☆"}</button>
          <button onclick="openDetail('${esc(t.compId)}','${esc(t.teamName)}','classif')" style="background:#f0f4f8;border:1px solid #e2e6ef;color:#003da5;border-radius:7px;padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0">→</button>
        </div>
        <div style="padding:7px 10px">
          ${last?matchCard(last,t.teamName,t.compId):""}
          ${next?matchCard(next,t.teamName,t.compId):`${!last?`<p style="font-size:11px;color:#94a3b8;padding:2px">Sense partits</p>`:""}`}
        </div>
      </div>`;
  }).join("");

  $("home-body").innerHTML = `
    <div style="position:relative;background:linear-gradient(to bottom,#fff,rgba(255,255,255,.98));padding:8px 0;margin-bottom:14px;box-shadow:0 2px 4px rgba(0,30,80,.04);border-bottom:1px solid #f0f2f8">
      <div style="display:flex;align-items:center;gap:10px">
        <button onclick="selectedClub=null;renderClubTab()" style="background:#f0f4f8;border:1px solid #e2e6ef;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:600;color:#334155;cursor:pointer">← Clubs</button>
        ${shieldImg(club.clubId,36)}
        <div style="flex:1;min-width:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900">${esc(club.displayName)}</div>
          <div style="font-size:11px;color:#94a3b8">${sorted.length} equip${sorted.length!==1?"s":""} · ${allOnlyActive?"en curs":"tots"}</div>
          ${(() => {
            // Get unique addresses from teams
            const addresses = new Map();
            sorted.forEach(t => {
              if (venuesDB?.venues?.[t.teamName]?.lat && venuesDB?.venues?.[t.teamName]?.address) {
                const key = venuesDB.venues[t.teamName].lat + ',' + venuesDB.venues[t.teamName].lng;
                if (!addresses.has(key)) {
                  addresses.set(key, {
                    lat: venuesDB.venues[t.teamName].lat,
                    lng: venuesDB.venues[t.teamName].lng,
                    address: venuesDB.venues[t.teamName].address
                  });
                }
              }
            });

            if (addresses.size === 0) return '';

            return '<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">' +
              Array.from(addresses.values()).map(loc => {
                const isApple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
                const mapsUrl = isApple
                  ? `https://maps.apple.com/?q=${loc.lat},${loc.lng}`
                  : `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
                const shortAddr = loc.address.split(',')[0];
                return '<a href="' + mapsUrl + '" target="_blank" rel="noopener noreferrer" style="font-size:9px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:3px 6px;border-radius:4px;text-decoration:none;display:inline-block;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + loc.address + '">' + shortAddr + '</a>';
              }).join('') +
              '</div>';
          })()}
        </div>
        <button onclick="toggleClubFav('${esc(club.key)}','${esc(club.displayName)}','${esc(club.clubId||"")}');renderClubDashboard()" style="background:${isClubFav(club.key)?"#fef9c3":"#f0f4f8"};border:1px solid ${isClubFav(club.key)?"#fcd34d":"#e2e6ef"};border-radius:8px;padding:6px 10px;font-size:13px;cursor:pointer;flex-shrink:0">${isClubFav(club.key)?"⭐":"☆"}</button>
        <label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#6b7a99;cursor:pointer;flex-shrink:0">
          <input type="checkbox" ${allOnlyActive?"checked":""} onchange="allOnlyActive=this.checked;selectedClub=null;selectClub('${esc(club.key)}')" style="accent-color:#003da5"/>
          En curs
        </label>
      </div>
    </div>
    ${teamCards||`<p style="text-align:center;padding:32px;color:#94a3b8">Cap equip actiu</p>`}`;
}

function formatSeasonLabel(rawSeason) {
  const s = String(rawSeason || "").trim();
  if (!s) return String(DB?.season || "").replace("-", "/");
  const m = s.match(/(20\d{2})[-/](\d{2,4})/);
  if (!m) return s;
  return `${m[1]}/${String(m[2]).slice(-2)}`;
}

function seasonFromComp(comp) {
  const fromName = String(comp?.name || "").match(/\(([^)]+)\)\s*$/)?.[1] || "";
  return formatSeasonLabel(fromName || DB?.season || "");
}

function extractSquadLetter(teamName) {
  const m = String(teamName || "").trim().match(/\s([A-Z])$/i);
  return m ? m[1].toUpperCase() : "";
}

function hashString32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).toUpperCase();
}

function buildStrongTeamIdentity(input) {
  const clubName = normalizeJokClubDisplayName(input?.clubName || "");
  const baseTeamName = normalizeJokClubDisplayName(getTeamBase(input?.teamName || ""));
  const category = String(input?.category || "Altres").trim();
  const letter = String(input?.letter || "").trim().toUpperCase();
  const season = formatSeasonLabel(input?.season || DB?.season || "");

  const seed = [
    normalizeCompKey(clubName),
    normalizeCompKey(baseTeamName),
    normalizeCompKey(category),
    letter,
    normalizeCompKey(season),
  ].join("|");

  return {
    strongId: `TEAM-${hashString32(seed)}`,
    displayName: `${baseTeamName}${category ? ` ${category}` : ""}${letter ? ` ${letter}` : ""} ${season}`.trim(),
    clubName,
    baseTeamName,
    category,
    letter,
    season,
  };
}

function resolveClubTeamContext(compId, teamName, teamId = null) {
  const map = buildClubMap();
  const wantedCompId = String(compId || "");
  const wantedTeamId = String(teamId || "").trim();

  for (const [clubKey, club] of map.entries()) {
    for (const t of (club?.teams || [])) {
      if (String(t?.compId || "") !== wantedCompId) continue;
      const idMatch = wantedTeamId && String(t?.teamId || "") === wantedTeamId;
      const nameMatch = teamMatchesCalendarExact(t?.teamName || "", teamName || "");
      if (!idMatch && !nameMatch) continue;
      return {
        clubKey,
        clubName: club?.displayName || "",
        teamName: t?.teamName || teamName || "",
        teamId: t?.teamId || teamId || null,
        category: t?.category || getCatForComp(findComp(compId)) || "Altres",
      };
    }
  }

  return {
    clubKey: null,
    clubName: normalizeJokClubDisplayName(getTeamBase(teamName || "")),
    teamName: teamName || "",
    teamId: teamId || null,
    category: getCatForComp(findComp(compId)) || "Altres",
  };
}

function gatherTeamProfileCompetitions(profile) {
  const out = [];
  const seen = new Set();

  for (const [category, comps] of Object.entries(DB?.categories || {})) {
    for (const comp of (comps || [])) {
      if (!comp || is3x3Competition(comp)) continue;
      const season = seasonFromComp(comp);
      if (season !== profile.season) continue;

      const candidates = getTeamCompetitionCandidates(comp, profile.teamName, profile.teamId || null);
      const matched = candidates.filter(name => {
        const sameCategory = normalizeCompKey(category || "") === normalizeCompKey(profile.category || "");
        const sameLetter = extractTeamSuffix(name || "") === (profile.letter || null);
        const looseAliasMatch = sameCategory && sameLetter && teamMatchesLoose(name, profile.teamName || "");
        const id = buildStrongTeamIdentity({
          clubName: profile.clubName,
          teamName: name,
          category,
          letter: extractSquadLetter(name),
          season,
        }).strongId;
        return id === profile.strongId || looseAliasMatch;
      });
      if (!matched.length) continue;

      const key = String(comp.id || "");
      if (seen.has(key)) continue;
      seen.add(key);

      const teamRow = (comp.classification || []).find(r => matched.some(n => teamMatchesCalendarExact(r?.team || "", n))) || null;
      const regular = (comp.calendar || []).filter(m => matched.some(n => teamMatchesCalendarExact(m?.home || "", n) || teamMatchesCalendarExact(m?.away || "", n)));
      const played = regular.filter(m => m?.homeScore != null && m?.awayScore != null);
      const future = regular.filter(m => m?.homeScore == null || m?.awayScore == null).sort((a,b) => parseMatchTimestamp(a?.date || "", comp?.name || "") - parseMatchTimestamp(b?.date || "", comp?.name || ""));
      const phaseFuture = buildUpcomingPhaseMatchesForTeam(comp, matched);

      out.push({
        comp,
        category,
        matched,
        teamRow,
        matchCount: regular.length,
        playedCount: played.length,
        nextDate: future[0]?.date || "",
        phaseFutureCount: phaseFuture.length,
      });
    }
  }

  return out.sort((a,b) => {
    if (b.playedCount !== a.playedCount) return b.playedCount - a.playedCount;
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return String(a.comp?.name || "").localeCompare(String(b.comp?.name || ""));
  });
}

async function buildTeamProfilePlayersRows(compEntries) {
  const map = {};
  for (const entry of compEntries) {
    const comp = entry.comp;
    const catSlug = getCatSlugForComp(comp);
    const actes = await loadCatActes(catSlug);
    const compId = String(comp?.id || "");

    for (const acta of Object.values(actes || {})) {
      if (String(acta?.compId || "") !== compId) continue;
      if (!acta?.playerStats) continue;
      const homeIsTeam = entry.matched.some(n => teamMatchesCalendarExact(acta?.home || "", n));
      const awayIsTeam = entry.matched.some(n => teamMatchesCalendarExact(acta?.away || "", n));
      if (!homeIsTeam && !awayIsTeam) continue;

      const add = p => {
        if (!p?.jugadorId) return;
        const id = String(p.jugadorId);
        const cur = map[id] ||= { name: p.name || "?", g: 0, b: 0, v: 0, partits: 0 };
        cur.g += Number(p.g || 0);
        cur.b += Number(p.b || 0);
        cur.v += Number(p.v || 0);
        cur.partits += 1;
      };

      if (homeIsTeam) for (const p of (acta.playerStats.homePlayers || [])) add(p);
      if (awayIsTeam) for (const p of (acta.playerStats.awayPlayers || [])) add(p);
    }
  }

  return Object.entries(map)
    .sort((a,b) => b[1].g - a[1].g)
    .map(([id, s]) => ({ id, ...s }));
}

async function renderTeamProfile() {
  const body = $("team-body");
  if (!body || !teamProfile) return;
  body.innerHTML = `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">Carregant dades de l'equip...</div>`;

  const comps = gatherTeamProfileCompetitions(teamProfile);
  const totals = comps.reduce((acc, e) => {
    acc.gf += Number(e.teamRow?.gf || 0);
    acc.gc += Number(e.teamRow?.gc || 0);
    acc.pg += Number(e.teamRow?.pg || 0);
    acc.pe += Number(e.teamRow?.pe || 0);
    acc.pp += Number(e.teamRow?.pp || 0);
    return acc;
  }, { gf:0, gc:0, pg:0, pe:0, pp:0 });

  const players = await buildTeamProfilePlayersRows(comps);

  const stat = (value, label, color = "#1a2035") => `<div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px;text-align:center"><div style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:${color}">${value}</div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700">${label}</div></div>`;
  const compCards = comps.map(e => {
    const comp = e.comp;
    const cleanName = String(comp?.name || "").replace(/\s*\(([^)]+)\)\s*$/, "").trim();
    return `<div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <div style="font-size:13px;font-weight:800;color:#1a2035">${esc(cleanName)}</div>
        <span style="background:#f8fafc;border:1px solid #e2e6ef;color:#475569;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700">${esc(e.category)}</span>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:#64748b;margin-bottom:8px">
        <span>Partits: <b style="color:#1a2035">${e.matchCount}</b></span>
        <span>Jugats: <b style="color:#1a2035">${e.playedCount}</b></span>
        ${e.nextDate ? `<span>Proper: <b style="color:#1a2035">${esc(e.nextDate)}</b></span>` : ""}
        ${e.phaseFutureCount ? `<span>Fases futures: <b style="color:#1a2035">${e.phaseFutureCount}</b></span>` : ""}
      </div>
      <button onclick="openDetail('${esc(comp.id)}','${esc(e.matched[0] || teamProfile.teamName)}','classif','${esc(String(teamProfile.teamId||""))}')" style="background:#f5f7fc;border:1px solid #e2e6ef;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:700;color:#003da5;cursor:pointer">Obrir competició</button>
    </div>`;
  }).join("");

  const playerRows = players.length
    ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:2px solid #e2e6ef"><th style="padding:6px 8px;text-align:left;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Jugador</th><th style="padding:6px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#e5001c">Gols</th><th style="padding:6px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#2563eb">Blaves</th><th style="padding:6px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Partits</th></tr></thead><tbody>${players.map(p => `<tr style="border-bottom:1px solid #f0f4f8"><td style="padding:7px 8px;font-size:13px;font-weight:600;color:#1a2035"><button data-jid="${esc(String(p.id || ""))}" style="background:none;border:none;padding:0;margin:0;color:#003da5;font:inherit;font-weight:700;cursor:pointer;text-align:left">${esc(String(p.name || "?"))}</button></td><td style="padding:7px 8px;text-align:center;font-size:13px;font-weight:700;color:#1a2035">${p.g}</td><td style="padding:7px 8px;text-align:center;font-size:13px;color:#2563eb">${p.b}</td><td style="padding:7px 8px;text-align:center;font-size:13px;color:#64748b">${p.partits}</td></tr>`).join("")}</tbody></table></div>`
    : `<div style="text-align:center;padding:16px;color:#94a3b8">Jugadors no disponibles.</div>`;

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px">
      ${stat(comps.length, "Competicions")}
      ${stat(totals.gf, "Gols Fets", "#e5001c")}
      ${stat(totals.gc, "Gols Encaixats", "#64748b")}
      ${stat(totals.pg, "Victòries", "#16a34a")}
      ${stat(totals.pe, "Empats", "#d97706")}
      ${stat(totals.pp, "Derrotes", "#dc2626")}
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;padding:8px 10px;margin-bottom:10px;font-size:11px;color:#475569;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <div><span style="font-weight:700;color:#1a2035">TeamID:</span> ${esc(teamProfile.strongId)} · ${esc(teamProfile.displayName)}</div>
      <button onclick="openTeamAdvancedStatsFromProfile()" style="background:#f5f7fc;border:1px solid #d8dee9;border-radius:8px;padding:5px 9px;font-size:12px;font-weight:700;color:#003da5;cursor:pointer;white-space:nowrap" title="Estadístiques avançades (totes les competicions)">🔍 Estadístiques avançades</button>
    </div>
    <div style="margin-bottom:12px">${compCards || `<div style="text-align:center;padding:16px;color:#94a3b8">No s'han trobat competicions per aquest equip aquesta temporada.</div>`}</div>
    <div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px">${playerRows}</div>`;
}

function openTeamProfile(compId, teamName, teamId = null, categoryHint = null, clubKeyHint = null, source = "home") {
  const ctx = resolveClubTeamContext(compId, teamName, teamId);
  const comp = findComp(compId);
  const season = seasonFromComp(comp);
  const category = categoryHint || ctx.category || getCatForComp(comp) || "Altres";
  const letter = extractSquadLetter(ctx.teamName || teamName || "");
  const identity = buildStrongTeamIdentity({
    clubName: ctx.clubName,
    teamName: ctx.teamName || teamName,
    category,
    letter,
    season,
  });

  teamProfile = {
    ...identity,
    compId: String(compId || ""),
    teamName: ctx.teamName || teamName || "",
    teamId: ctx.teamId || teamId || null,
    category,
    clubKey: clubKeyHint || ctx.clubKey || null,
  };
  teamProfileReturnScreen = source;

  ["screen-home","screen-detail","screen-picker","screen-acta","screen-admin"].forEach(id => { const el=$(id); if (el) el.style.display="none"; });
  $("screen-team").style.display = "flex";
  $("team-header-title").textContent = teamProfile.displayName;
  $("team-header-meta").innerHTML = `${esc(teamProfile.clubName)} · ${esc(teamProfile.category)} · ${esc(teamProfile.season)}`;
  renderTeamProfile();
  window.scrollTo(0,0);
}

window.openTeamProfileFromClub = (compId, teamName, teamId = null, category = null, clubKey = null) => {
  openTeamProfile(compId, teamName, teamId, category, clubKey, "home");
};

window.openTeamProfileFromClassif = (teamName, teamId = null) => {
  if (!detailComp?.id) return;
  openTeamProfile(detailComp.id, teamName, teamId, getCatForComp(detailComp), null, "detail");
};

async function calculateGlobalTeamMetrics(profile) {
  const entries = gatherTeamProfileCompetitions(profile);
  if (!entries.length) return null;

  const playedMatches = [];
  const playersByMatch = {};
  const playerStats = {};
  const playerCards = {};
  let points = 0;
  let bestPos = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    const comp = entry.comp;
    const matched = entry.matched || [];
    if (!comp || !matched.length) continue;

    if (entry.teamRow) {
      points += Number(entry.teamRow.pts || 0);
      const p = Number(entry.teamRow.pos || 0);
      if (p > 0 && p < bestPos) bestPos = p;
    }

    for (const m of (comp.calendar || [])) {
      if (m?.homeScore == null || m?.awayScore == null) continue;
      const isHome = matched.some(n => teamMatchesCalendarExact(m.home || "", n));
      const isAway = matched.some(n => teamMatchesCalendarExact(m.away || "", n));
      if (!isHome && !isAway) continue;

      const myScore = isHome ? Number(m.homeScore || 0) : Number(m.awayScore || 0);
      const theirScore = isHome ? Number(m.awayScore || 0) : Number(m.homeScore || 0);
      playedMatches.push({
        ts: parseMatchTimestamp(m?.date || "", comp?.name || ""),
        myScore,
        theirScore,
      });
    }

    const catSlug = getCatSlugForComp(comp);
    const actes = catSlug ? await loadCatActes(catSlug) : {};
    for (const acta of Object.values(actes || {})) {
      if (String(acta?.compId || "") !== String(comp?.id || "")) continue;
      const homeIsTeam = matched.some(n => teamMatchesCalendarExact(acta?.home || "", n));
      const awayIsTeam = matched.some(n => teamMatchesCalendarExact(acta?.away || "", n));
      if (!homeIsTeam && !awayIsTeam) continue;

      const players = [
        ...(homeIsTeam ? (acta?.playerStats?.homePlayers || []) : []),
        ...(awayIsTeam ? (acta?.playerStats?.awayPlayers || []) : []),
      ];

      const matchKey = `${String(comp?.id || "")}|${String(acta?.actaId || acta?.id || acta?.matchDate || acta?.date || "")}`;
      playersByMatch[matchKey] = Math.max(playersByMatch[matchKey] || 0, players.length);

      for (const p of players) {
        if (!p?.jugadorId) continue;
        const pid = String(p.jugadorId);
        const ps = playerStats[pid] ||= { name: p.name || "—", goals: 0, matches: 0 };
        ps.goals += Number(p.g || 0);
        ps.matches += 1;

        const pc = playerCards[pid] ||= { name: p.name || "—", blaves: 0, vermelles: 0 };
        pc.blaves += Number(p.b || 0);
        pc.vermelles += Number(p.v || 0);
      }
    }
  }

  if (!playedMatches.length) return null;

  playedMatches.sort((a, b) => b.ts - a.ts);
  const last5 = playedMatches.slice(0, 5);
  const trend = { w: 0, d: 0, l: 0 };
  const recentForm = [];
  for (const m of last5) {
    if (m.myScore > m.theirScore) { trend.w += 1; recentForm.push("W"); }
    else if (m.myScore === m.theirScore) { trend.d += 1; recentForm.push("D"); }
    else { trend.l += 1; recentForm.push("L"); }
  }

  const totalMatches = playedMatches.length;
  const goalsFor = playedMatches.reduce((acc, m) => acc + m.myScore, 0);
  const goalsAgainst = playedMatches.reduce((acc, m) => acc + m.theirScore, 0);
  const shutouts = playedMatches.filter(m => m.theirScore === 0).length;
  const avgGoals = Number((goalsFor / Math.max(1, totalMatches)).toFixed(2));
  const avgGoalsAgainst = Number((goalsAgainst / Math.max(1, totalMatches)).toFixed(2));

  const playerCountVals = Object.values(playersByMatch);
  const avgPlayersPerMatch = playerCountVals.length
    ? Number((playerCountVals.reduce((a, b) => a + b, 0) / playerCountVals.length).toFixed(1))
    : 0;

  const topScorer = Object.values(playerStats).length
    ? Object.values(playerStats).reduce((a, b) => a.goals >= b.goals ? a : b)
    : { name: "—", goals: 0, matches: 0 };

  const ages = [];
  let goalkeepers = 0;
  for (const pid of Object.keys(playerStats)) {
    const player = getPlayerById(pid);
    if (player?.isGK) goalkeepers += 1;
    if (!player?.birthDate) continue;
    const parts = String(player.birthDate).split(/[\/\-]/);
    const dob = parts[0]?.length === 4
      ? new Date(`${parts[0]}-${parts[1]}-${parts[2]}`)
      : new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (isNaN(dob)) continue;
    const now = new Date();
    const y = now.getFullYear() - dob.getFullYear();
    const age = y - (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
    if (age > 0 && age < 100) ages.push(age);
  }
  if (!goalkeepers) goalkeepers = 1;
  const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : "—";

  const suspended = [];
  let totalYellowCards = 0;
  let totalRedCards = 0;
  for (const c of Object.values(playerCards)) {
    totalYellowCards += Number(c.blaves || 0);
    totalRedCards += Number(c.vermelles || 0);
    if ((c.blaves || 0) >= 5) suspended.push(`${c.name} (${c.blaves} blaves)`);
    if ((c.vermelles || 0) > 0) suspended.push(`${c.name} (vermella)`);
  }

  const alsoFemNames = [];
  let reinforcesOthersCount = 0;
  let alsoFemCount = 0;
  for (const pid of Object.keys(playerStats)) {
    const player = getPlayerById(pid);
    if (!player) continue;
    const cats = new Set((player.teamStats || []).map(ts => String(ts?.cat || "").toLowerCase()).filter(Boolean));
    if (cats.has("fem")) {
      alsoFemCount += 1;
      alsoFemNames.push(playerStats[pid].name);
    }
    const nonFemCats = [...cats].filter(c => c !== "fem");
    if (nonFemCats.length > 1) reinforcesOthersCount += 1;
  }

  return {
    teamName: profile?.displayName || profile?.teamName || "Equip",
    trend,
    recentForm,
    recentFormOldToNew: [...recentForm].reverse(),
    avgPlayersPerMatch,
    avgGoals,
    avgGoalsAgainst,
    shutouts,
    totalMatches,
    points,
    position: Number.isFinite(bestPos) ? bestPos : "—",
    goalsFor,
    goalsAgainst,
    goalsDiff: goalsFor - goalsAgainst,
    winRate: last5.length ? Math.round((trend.w / last5.length) * 100) : 0,
    topScorer,
    suspended,
    goalkeepers,
    winProbability: last5.length ? Math.round((trend.w / last5.length) * 100) : 0,
    reinforcements: [],
    reinforcesOthersCount,
    reinforcedByLowerCount: 0,
    alsoFemCount,
    alsoFemNames: alsoFemNames.sort((a, b) => String(a).localeCompare(String(b), "ca")),
    probabilityModel: null,
    referenceTeamName: "",
    avgAge,
    improvement: "N/A",
    totalYellowCards,
    avgYellowCards: (totalYellowCards / Math.max(1, totalMatches)).toFixed(3),
    totalRedCards,
    avgRedCards: (totalRedCards / Math.max(1, totalMatches)).toFixed(3),
  };
}

window.openTeamAdvancedStatsFromProfile = async function() {
  if (!teamProfile) return;
  const metrics = await calculateGlobalTeamMetrics(teamProfile);
  if (!metrics) {
    alert("No hi ha prou dades per calcular les estadístiques globals d'aquest equip");
    return;
  }
  showRivalModal(metrics, teamProfile.displayName || teamProfile.teamName || "Equip", "Totes les competicions");
};

window.openTeamAdvancedStatsFromClassif = async function(teamName) {
  if (!detailComp?.id || !teamName) return;
  await openRivalAnalysis(teamName, detailComp.id, detailTeam || "");
};

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
    const gender = /\bFEM\b|FEMENI|FEMENINA/.test(n) ? "Femenina" : "Masculina";
    return {
      level1: { key: "1ª Catalana", label: "1ª Catalana", emoji: "⭐", color: "#1a5dc7", order: 20 },
      level2: { key: `1ª Catalana::${gender}`, label: gender, order: gender === "Femenina" ? 1 : 0 },
      level3: null,
      level4: null,
    };
  }
  if (/\b2[ªA]\s*\bCATAL/.test(n) || /\bSEGONA\b\s*\bCATAL/.test(n)) {
    const gender = /\bFEM\b|FEMENI|FEMENINA/.test(n) ? "Femenina" : "Masculina";
    return {
      level1: { key: "2ª Catalana", label: "2ª Catalana", emoji: "🔵", color: "#2563eb", order: 30 },
      level2: { key: `2ª Catalana::${gender}`, label: gender, order: gender === "Femenina" ? 1 : 0 },
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

  if (/\bFEM|MINIFEM/.test(n)) {
    // Extract age/category from FEM11, FEM 11, FEM13, FEM 13, FEM15, FEM 15, FEM17, FEM 17, FEM19, FEM 19, MINIFEM, etc
    let femCategory = "Fem";
    let categoryOrder = 9;

    if (/MINIFEM/.test(n)) {
      femCategory = "MiniFem";
      categoryOrder = 0;
    } else if (/FEM\s*11/.test(n)) {
      femCategory = "FEM 11";
      categoryOrder = 1;
    } else if (/FEM\s*13/.test(n)) {
      femCategory = "FEM 13";
      categoryOrder = 2;
    } else if (/FEM\s*15/.test(n)) {
      femCategory = "FEM 15";
      categoryOrder = 3;
    } else if (/FEM\s*17/.test(n)) {
      femCategory = "FEM 17";
      categoryOrder = 4;
    } else if (/FEM\s*19/.test(n)) {
      femCategory = "FEM 19";
      categoryOrder = 5;
    }

    const tier = detectTier(n);
    return {
      level1: { key: "Fem", label: "Fem", emoji: "♀", color: "#db2777", order: 50 },
      level2: { key: `Fem::${femCategory}`, label: femCategory, order: categoryOrder },
      level3: { key: `Fem::${femCategory}::${tier}`, label: tierLabel(tier), order: tierOrder[tier] },
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
        compName: comp.name.replace(/\s*\(\d{4}-\d{2}\)/,""),
        source: comp.classificationSource || "none" });
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
            ${["#","Equip","PJ","Pts","Avg","Src"].map((h,i)=>`<th style="padding:5px ${i<2?5:3}px;font-size:9px;font-weight:700;color:${i===3?color:"#94a3b8"};text-transform:uppercase;text-align:${i===1?"left":"center"};border-bottom:1px solid #e2e6ef">${h}</th>`).join("")}
          </tr></thead>
          <tbody>${topTeams.map((t,i)=>`
            <tr style="border-bottom:1px solid #f0f2f8">
              <td style="padding:6px 3px;text-align:center;font-size:12px">${posIcon(i)}</td>
              <td style="padding:6px 5px">
                <div style="font-size:12px;font-weight:700;color:#1a2035;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">${esc(normalizeJokClubDisplayName(t.team))}</div>
                <div style="font-size:9px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">${esc(t.compName)}</div>
              </td>
              <td style="padding:6px 3px;text-align:center;font-size:11px;color:#94a3b8">${t.pj}</td>
              <td style="padding:6px 3px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;color:${color}">${t.pts}</td>
              <td style="padding:6px 3px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:${goalAverageColor(t.avg)}">${formatGoalAverage(t.avg)}</td>
              <td style="padding:6px 3px;text-align:center;font-size:10px;color:#64748b">${t.source === "fecapa" ? "🛡️" : (t.source === "jok" ? "🌐" : "-")}</td>
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
      if (is3x3Competition(comp)) continue;
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

  const renderCompCard = (comp, color, showSourceIcon = false) => `
    <div onclick="openDetail('${comp.id}')" style="background:#fff;border:1.5px solid #e2e6ef;border-radius:11px;margin-bottom:6px;overflow:hidden;cursor:pointer;box-shadow:0 1px 3px rgba(0,30,80,.04)" onmouseover="this.style.borderColor='${color}';this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='#e2e6ef';this.style.transform='none'">
      <div style="display:flex;align-items:center;gap:9px;padding:10px 13px">
        <div style="width:36px;height:36px;border-radius:8px;background:${color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;color:${color}">${comp.pctPlayed!=null?comp.pctPlayed+"%":"?"}</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(stripSeasonSuffix(comp.name||""))}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:1px">${(comp.classification||[]).length||"?"} equips</div>
        </div>
        ${showSourceIcon ? classifSourceIconHtml(comp) : ""}
        <span style="color:#cbd5e1;font-size:18px">›</span>
      </div>
      <div style="height:3px;background:#f0f4f8"><div style="height:100%;background:linear-gradient(90deg,${color},${color}88);width:${comp.pctPlayed||0}%"></div></div>
    </div>`;

  const summarizeSourcesFromComps = comps => {
    const summary = { hasFecapa: false, hasJok: false };
    for (const c of (comps || [])) {
      const src = String(c?.classificationSource || "").toLowerCase();
      if (src === "fecapa") summary.hasFecapa = true;
      if (src === "jok") summary.hasJok = true;
      if (summary.hasFecapa && summary.hasJok) break;
    }
    return summary;
  };

  const mergeSourceSummary = (a, b) => ({
    hasFecapa: !!(a?.hasFecapa || b?.hasFecapa),
    hasJok: !!(a?.hasJok || b?.hasJok),
  });

  const summarizeNodeSources = node => {
    let summary = summarizeSourcesFromComps(filterComps(node?.comps || []));
    for (const [, child] of (node?.groupsArr || [])) {
      summary = mergeSourceSummary(summary, summarizeNodeSources(child));
      if (summary.hasFecapa && summary.hasJok) break;
    }
    return summary;
  };

  const renderGroupSourceIcon = summary => {
    if (summary?.hasFecapa && summary?.hasJok) {
      return `<span title="Sources mixtes: FECAPA + jok.cat" style="display:inline-flex;align-items:center;gap:4px;background:#fff;border:1px solid #dbe3f0;border-radius:999px;padding:2px 6px;font-size:10px;color:#64748b"><span style="width:12px;height:8px;display:inline-block;border-radius:2px;border:1px solid rgba(0,0,0,.12);background:repeating-linear-gradient(to bottom,#facc15 0,#facc15 2px,#dc2626 2px,#dc2626 4px)"></span><span>+</span><span style="font-size:11px;line-height:1">🌐</span></span>`;
    }
    if (summary?.hasFecapa) {
      return `<span title="Source: FECAPA" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:#e8f2ff;border:1px solid #bfdbfe;border-radius:999px"><span style="width:12px;height:8px;display:inline-block;border-radius:2px;border:1px solid rgba(0,0,0,.12);background:repeating-linear-gradient(to bottom,#facc15 0,#facc15 2px,#dc2626 2px,#dc2626 4px)"></span></span>`;
    }
    if (summary?.hasJok) {
      return `<span title="Source: jok.cat" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:#eefcf3;border:1px solid #bbf7d0;border-radius:999px;font-size:11px;line-height:1">🌐</span>`;
    }
    return "";
  };

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
        const isMiniCat = ["Benjamí", "Prebenjamí", "Fem"].includes(meta.key);
        const isBenjami = meta.key === "Benjamí";
        const comps3 = filterComps(g3.comps || []);
        const level4 = (g3.groupsArr || []).map(([,g4]) => {
          const key4 = `l4:${meta.key}:${g2.key}:${g3.key}:${g4.key}`;
          const statsKey4 = `stats:${key4}`;
          const open4 = isNodeOpen(key4, false);
          const statsOpen4 = isNodeOpen(statsKey4, false);
          const fav4 = isLevelFav(key4);
          const comps4 = filterComps(g4.comps || []);
          const sourceIcon4 = renderGroupSourceIcon(summarizeNodeSources(g4));
          if (!comps4.length && !statsOpen4) return "";
          return `
            <div style="margin-top:7px;padding-left:14px;border-left:2px dashed ${color}33">
              <div style="display:flex;gap:4px;align-items:stretch;margin-bottom:6px">
                <button onclick="toggleCompsNode('${esc(key4)}')" style="flex:1;min-width:0;text-align:left;background:#fff;border:1px solid #e2e6ef;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:11px;font-weight:700;color:#475569;display:flex;align-items:center;justify-content:space-between;gap:6px">
                  <span style="display:flex;align-items:center;gap:6px;min-width:0">
                    <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g4.label} <span style="font-size:10px;color:#94a3b8">(${comps4.length})</span></span>
                    ${sourceIcon4}
                  </span>
                  <span style="color:#94a3b8;flex-shrink:0">${open4 ? '▾' : '▸'}</span>
                </button>
                <button onclick="toggleLevelFavNode('${esc(key4)}','${esc(meta.key)}','${esc(g2.key)}','${esc(g3.key)}','${esc(g4.key)}','${esc(g4.label)}','${esc(meta.label + ' › ' + g2.label + ' › ' + g3.label + ' › ' + g4.label)}','${esc(color)}','🏆')" style="background:${fav4?'#fef9c3':'#f0f4f8'};color:${fav4?'#a16207':'#6b7a99'};border:1.5px solid ${fav4?'#fcd34d':'#e2e6ef'};border-radius:8px;padding:6px 9px;cursor:pointer;font-size:13px;flex-shrink:0" title="Favorit de nivell">${fav4?'★':'☆'}</button>
                <button data-sk="${esc(statsKey4)}" data-nk="${esc(key4)}" onclick="toggleSubgroupStats(this.dataset.sk,this.dataset.nk)" style="background:${statsOpen4?color:'#f0f4f8'};color:${statsOpen4?'#fff':'#6b7a99'};border:1.5px solid ${statsOpen4?color:'#e2e6ef'};border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px;flex-shrink:0" title="Estadístiques del subgrup">📊</button>
              </div>
              ${open4 ? comps4.map(c=>renderCompCard(c, color, true)).join("") : ""}
              ${statsOpen4 ? renderClusterStats(g4, color) : ""}
              ${statsOpen4 ? renderConsolidatedClassif(g4, color) : ""}
            </div>`;
        }).join("");
        const fav3 = isLevelFav(key3);
        const sourceIcon3 = renderGroupSourceIcon(summarizeNodeSources(g3));
        const count3 = comps3.length + (g3.groupsArr||[]).reduce((a,[,x]) => a + filterComps(x.comps||[]).length, 0);
        if (!comps3.length && !level4 && !statsOpen3) return "";
        return `
          <div style="margin-top:8px;padding-left:18px;border-left:2px solid #e2e6ef">
            <div style="display:flex;gap:4px;align-items:stretch;margin-bottom:6px">
              <button onclick="toggleCompsNode('${esc(key3)}')" style="flex:1;min-width:0;text-align:left;background:#f8fafc;border:1px solid #e2e6ef;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:12px;font-weight:700;color:#475569;display:flex;align-items:center;justify-content:space-between;gap:6px">
                <span style="display:flex;align-items:center;gap:6px;min-width:0">
                  <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g3.label} <span style="font-size:10px;color:#94a3b8">(${count3})</span></span>
                  ${sourceIcon3}
                </span>
                <span style="color:#94a3b8;flex-shrink:0">${open3 ? '▾' : '▸'}</span>
              </button>
              <button onclick="toggleLevelFavNode('${esc(key3)}','${esc(meta.key)}','${esc(g2.key)}','${esc(g3.key)}','','${esc(g3.label)}','${esc(meta.label + ' › ' + g2.label + ' › ' + g3.label)}','${esc(color)}','🥉')" style="background:${fav3?'#fef9c3':'#f0f4f8'};color:${fav3?'#a16207':'#6b7a99'};border:1.5px solid ${fav3?'#fcd34d':'#e2e6ef'};border-radius:8px;padding:6px 9px;cursor:pointer;font-size:13px;flex-shrink:0" title="Favorit de nivell">${fav3?'★':'☆'}</button>
              ${isMiniCat && !isBenjami ? `<button data-sk="${esc(statsKey3)}" data-nk="${esc(key3)}" onclick="toggleSubgroupStats(this.dataset.sk,this.dataset.nk)" style="background:${statsOpen3?color:'#f0f4f8'};color:${statsOpen3?'#fff':'#6b7a99'};border:1.5px solid ${statsOpen3?color:'#e2e6ef'};border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px;flex-shrink:0" title="Estadístiques del subgrup">📊</button>` : ""}
            </div>
            ${open3 ? comps3.map(c=>renderCompCard(c, color, true)).join("") : ""}
            ${open3 ? level4 : ""}
            ${statsOpen3 && !isBenjami ? renderClusterStats(g3, color) : ""}
            ${statsOpen3 && !isBenjami ? renderConsolidatedClassif(g3, color) : ""}
          </div>`;
      }).join("");
      const isAgeCat = ["Júnior","Juvenil","Infantil","Aleví"].includes(meta.key);
      const isCatalonaCat = ["1ª Catalana","2ª Catalana"].includes(meta.key);
      const showStatsL2 = isAgeCat || isCatalonaCat;
      const fav2 = isLevelFav(key2);
      const statsKey2 = `stats:${key2}`;
      const statsOpen2 = isNodeOpen(statsKey2, false);
      const sourceIcon2 = renderGroupSourceIcon(summarizeNodeSources(g2));
      const l2Count = level2LeafComps.length + (g2.groupsArr||[]).reduce((a,[,x])=>a+filterComps(x.comps||[]).length + (x.groupsArr||[]).reduce((aa,[,y])=>aa+filterComps(y.comps||[]).length,0),0);
      if (!level2LeafComps.length && !level3 && !statsOpen2) return "";
      return `
        <div style="margin-top:10px;padding-left:12px;border-left:3px solid ${color}33">
          <div style="display:flex;gap:4px;align-items:stretch;margin-bottom:6px">
            <button onclick="toggleCompsNode('${esc(key2)}')" style="flex:1;min-width:0;text-align:left;background:${color}14;border:1px solid ${color}33;border-radius:8px;padding:7px 9px;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;color:${color};display:flex;align-items:center;justify-content:space-between;gap:6px">
              <span style="display:flex;align-items:center;gap:6px;min-width:0">
                <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g2.label} <span style="font-size:10px;color:#6b7a99;font-weight:600">(${l2Count})</span></span>
                ${sourceIcon2}
              </span>
              <span style="color:${color};flex-shrink:0">${open2 ? '▾' : '▸'}</span>
            </button>
            <button onclick="toggleLevelFavNode('${esc(key2)}','${esc(meta.key)}','${esc(g2.key)}','','','${esc(g2.label)}','${esc(meta.label + ' › ' + g2.label)}','${esc(color)}','🥈')" style="background:${fav2?'#fef9c3':'#f0f4f8'};color:${fav2?'#a16207':'#6b7a99'};border:1.5px solid ${fav2?'#fcd34d':'#e2e6ef'};border-radius:8px;padding:7px 9px;cursor:pointer;font-size:14px;flex-shrink:0" title="Favorit de nivell">${fav2?'★':'☆'}</button>
            ${showStatsL2 ? `<button data-sk="${esc(statsKey2)}" data-nk="${esc(key2)}" onclick="toggleSubgroupStats(this.dataset.sk,this.dataset.nk)" style="background:${statsOpen2?color:'#f0f4f8'};color:${statsOpen2?'#fff':'#6b7a99'};border:1.5px solid ${statsOpen2?color:'#e2e6ef'};border-radius:8px;padding:7px 10px;cursor:pointer;font-size:14px;flex-shrink:0" title="Rànquing del grup">📊</button>` : ""}
          </div>
          ${open2 ? level2LeafComps.map(c=>renderCompCard(c, color, true)).join("") : ""}
          ${open2 ? level3 : ""}
          ${statsOpen2 ? renderClusterStats(g2, color) : ""}
          ${statsOpen2 ? renderConsolidatedClassif(g2, color) : ""}
        </div>`;
    }).join("");

    const isAgeCatL1 = ["Júnior","Juvenil","Infantil","Aleví"].includes(meta.key);
    const isMiniCatL1 = ["Benjamí", "Prebenjamí"].includes(meta.key);
    const isCatalonaCatL1 = ["1ª Catalana","2ª Catalana"].includes(meta.key);
    const isFemL1 = meta.key === "Fem";
    const showL1Stats = !isAgeCatL1 && !isMiniCatL1 && !isCatalonaCatL1 && !isFemL1;
    const statsKey1 = `stats:${meta.key}`;
    const fav1 = isLevelFav(key1);
    const statsOpen1 = isNodeOpen(statsKey1, false);
    const sourceIcon1 = renderGroupSourceIcon(summarizeNodeSources(meta));
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
                ${sourceIcon1}
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
  pickerClubSearch="";
  currentPickerClub=null;
  currentPickerCat=null;
  currentPickerTeamKey=null;
  currentPickerTeamData=null;
  $("screen-home").style.display="none"; $("screen-detail").style.display="none";
  $("screen-picker").style.display="flex"; renderPicker();
}
window.openPicker=openPicker;

let pickerClubSearch = "";
let currentPickerClub = null;
let currentPickerCat = null;
let currentPickerTeamKey = null;
let currentPickerTeamData = null;

function renderPicker() {
  $("picker-content").innerHTML=`
    <div style="padding:20px 16px 32px">
      <h2 style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;color:#1a2035;margin-bottom:4px">Afegir equip favorit</h2>
      <p style="font-size:13px;color:#6b7a99;margin-bottom:16px">Cerca el club i selecciona l'equip</p>
      <label style="display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:#6b7a99;cursor:pointer;margin-bottom:16px">
        <input type="checkbox" id="picker-active" ${allOnlyActive?"checked":""} onchange="allOnlyActive=this.checked;renderPickerCatSection()" style="width:16px;height:16px;accent-color:#003da5"/>
        Mostrar només competicions en curs
      </label>
      <div style="margin-bottom:14px">
        <label style="display:block;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">1. Club</label>
        <div id="picker-club-section"></div>
      </div>
      <div id="pick-cat-wrap" style="display:none;margin-bottom:14px">
        <label style="display:block;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">2. Categoria</label>
        <div id="picker-cat-section"></div>
      </div>
      <div id="pick-team-wrap" style="display:none;margin-bottom:20px">
        <label style="display:block;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">3. Equip</label>
        <div id="picker-team-section"></div>
      </div>
      <div id="pick-add-wrap" style="display:none">
        <button onclick="addFavFromPicker()" style="width:100%;background:#e5001c;border:none;color:#fff;font-weight:700;font-size:15px;padding:13px;border-radius:12px;cursor:pointer">⭐ Afegir als favorits</button>
      </div>
    </div>`;
  renderPickerClubSection();
}

function renderPickerClubSection() {
  const section = $("picker-club-section");
  if (!section) return;
  if (currentPickerClub) {
    const clubMap = buildClubMap();
    const club = clubMap.get(currentPickerClub);
    section.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;background:#f0f4f8;border-radius:10px;padding:10px 14px">
        ${shieldImg(club?.clubId, 22)}
        <span style="font-size:14px;font-weight:600;color:#1a2035;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(club?.displayName||"")}</span>
        <button onclick="clearPickerClub()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:17px;padding:2px 4px;flex-shrink:0;line-height:1">✕</button>
      </div>`;
    renderPickerCatSection();
  } else {
    section.innerHTML = `
      <input id="picker-club-search" placeholder="🔍 Cerca club per nom..." value="${esc(pickerClubSearch)}"
        style="width:100%;box-sizing:border-box;background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:11px 14px;font-size:14px;color:#1a2035;outline:none"
        oninput="pickerClubInput(this.value)" autocomplete="off" autocorrect="off" spellcheck="false"/>
      <div id="picker-suggestions"></div>`;
    renderPickerSuggestions();
    setTimeout(() => { const el = document.getElementById("picker-club-search"); if (el) el.focus(); }, 30);
  }
}

window.pickerClubInput = function(val) {
  pickerClubSearch = val;
  renderPickerSuggestions();
};

function renderPickerSuggestions() {
  const sugg = $("picker-suggestions");
  if (!sugg) return;
  const q = (pickerClubSearch || "").toLowerCase().trim();
  if (!q) { sugg.innerHTML = ""; return; }
  const clubMap = buildClubMap();
  const filtered = [...clubMap.entries()]
    .filter(([,v]) => v.displayName.toLowerCase().includes(q))
    .sort((a,b) => a[1].displayName.localeCompare(b[1].displayName))
    .slice(0, 25);
  if (!filtered.length) {
    sugg.innerHTML = `<div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;padding:10px 14px;margin-top:4px;text-align:center;color:#94a3b8;font-size:13px">Cap club trobat</div>`;
    return;
  }
  sugg.innerHTML = `<div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:10px;max-height:200px;overflow-y:auto;margin-top:4px">
    ${filtered.map(([k,v]) => `<div onmousedown="selectPickerClub('${esc(k)}','${esc(v.displayName)}')" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #f0f2f8;cursor:pointer;font-size:14px;color:#1a2035" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
      ${shieldImg(v.clubId, 18)} ${esc(v.displayName)}
    </div>`).join("")}
  </div>`;
}

window.selectPickerClub = function(clubKey) {
  pickerClubSearch = "";
  currentPickerClub = clubKey;
  currentPickerCat = null;
  currentPickerTeamKey = null;
  currentPickerTeamData = null;
  renderPickerClubSection();
};

window.clearPickerClub = function() {
  currentPickerClub = null;
  currentPickerCat = null;
  currentPickerTeamKey = null;
  currentPickerTeamData = null;
  pickerClubSearch = "";
  $("pick-cat-wrap").style.display = "none";
  $("pick-team-wrap").style.display = "none";
  $("pick-add-wrap").style.display = "none";
  renderPickerClubSection();
};

function renderPickerCatSection() {
  const catWrap = $("pick-cat-wrap");
  const catSection = $("picker-cat-section");
  if (!catWrap || !catSection || !currentPickerClub) return;
  const clubMap = buildClubMap();
  const club = clubMap.get(currentPickerClub);
  if (!club) return;
  const catOrder = ["Prebenjamí","Benjamí","Aleví","Infantil","Juvenil","Júnior","1ª Catalana","2ª Catalana","3ª Catalana","Nacional Catalana","Veterans","Altres","Fem"];
  let cats = [...new Set(club.teams.map(t => t.category))];
  if (allOnlyActive) {
    cats = cats.filter(cat => {
      const t = club.teams.find(t2 => t2.category === cat);
      const comp = t ? findComp(t.compId) : null;
      return comp && isActive(comp);
    });
  }
  cats.sort((a,b) => { const ai=catOrder.indexOf(a),bi=catOrder.indexOf(b); return (ai<0?99:ai)-(bi<0?99:bi); });
  if (!cats.length) { catWrap.style.display = "none"; return; }
  catWrap.style.display = "block";
  catSection.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px">
    ${cats.map(c => { const sel=currentPickerCat===c; const col=CAT_COLOR[c]||"#1a2035"; return `<button onmousedown="selectPickerCat('${esc(c)}')" style="background:${sel?col:'#f0f4f8'};color:${sel?'#fff':'#334155'};border:1.5px solid ${sel?col:'#e2e6ef'};border-radius:20px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer">${CAT_EMOJI[c]||"🏒"} ${esc(c)}</button>`; }).join("")}
  </div>`;
  if (currentPickerCat && cats.includes(currentPickerCat)) renderPickerTeamSection();
  else { $("pick-team-wrap").style.display = "none"; $("pick-add-wrap").style.display = "none"; }
}
window.renderPickerCatSection = renderPickerCatSection;

window.selectPickerCat = function(cat) {
  currentPickerCat = cat;
  currentPickerTeamKey = null;
  currentPickerTeamData = null;
  $("pick-add-wrap").style.display = "none";
  renderPickerCatSection();
  renderPickerTeamSection();
};

function renderPickerTeamSection() {
  const teamWrap = $("pick-team-wrap");
  const teamSection = $("picker-team-section");
  if (!teamWrap || !teamSection || !currentPickerClub || !currentPickerCat) return;
  const clubMap = buildClubMap();
  const club = clubMap.get(currentPickerClub);
  if (!club) return;
  let teamsInCat = club.teams.filter(t => t.category === currentPickerCat);
  if (allOnlyActive) teamsInCat = teamsInCat.filter(t => { const comp = findComp(t.compId); return comp && isActive(comp); });
  // Deduplicate by teamName; prefer the comp with more calendar entries or active status
  const seen = new Map();
  for (const t of teamsInCat) {
    if (!seen.has(t.teamName)) { seen.set(t.teamName, t); continue; }
    const existing = seen.get(t.teamName);
    const existComp = findComp(existing.compId);
    const newComp = findComp(t.compId);
    const score = c => (c?.calendar?.length||0) + (isActive(c)?100:0);
    if (score(newComp) > score(existComp)) seen.set(t.teamName, t);
  }
  const teams = [...seen.values()].sort((a,b) => a.teamName.localeCompare(b.teamName));
  if (!teams.length) { teamWrap.style.display = "none"; return; }
  teamWrap.style.display = "block";
  const catColor = CAT_COLOR[currentPickerCat] || "#003da5";
  teamSection.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px">
    ${teams.map(t => {
      const key = `${t.compId}::${t.teamName}`;
      const sel = currentPickerTeamKey === key;
      const cid = getClubIdByTeamId(t.teamId) || getClubId(t.teamName);
      const shortName = shortTeamDisplayName(t.teamName);
      return `<button onmousedown="selectPickerTeam('${esc(t.compId)}','${esc(t.teamName)}','${esc(t.compName||"")}','${esc(currentPickerCat)}')" style="display:inline-flex;align-items:center;gap:6px;background:${sel?catColor:'#f0f4f8'};color:${sel?'#fff':'#334155'};border:1.5px solid ${sel?catColor:'#e2e6ef'};border-radius:20px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer">${shieldImg(cid,16)} ${esc(shortName)}</button>`;
    }).join("")}
  </div>`;
  $("pick-add-wrap").style.display = currentPickerTeamKey ? "block" : "none";
}

window.selectPickerTeam = function(compId, team, compName, cat) {
  currentPickerTeamKey = `${compId}::${team}`;
  currentPickerTeamData = { compId, team, compName, cat };
  renderPickerTeamSection();
};

window.addFavFromPicker = function() {
  const d = currentPickerTeamData;
  if (!d) return;
  const comp = findComp(d.compId);
  if (!isFav(d.compId, d.team)) {
    favs.push({ compId: d.compId, teamName: d.team, category: d.cat, compName: d.compName || comp?.name || "" });
    saveFavs();
  }
  $("screen-picker").style.display="none"; homeTab="favs"; renderHome();
};

// ── DETAIL ────────────────────────────────────────────────────
let detailComp=null, detailTeam=null, detailTeamId=null, detailTab="classif";
let teamProfile = null;
let teamProfileReturnScreen = "home";

function isFinalsPilotComp(comp) {
  const id = String(comp?.id || "").trim();
  if (!id) return false;
  if (comp?.hasPostSeasonPhases === true) return true;
  return normalizePostSeasonPhases(comp?.postSeasonPhases || []).length > 0;
}

function shouldHideClassificationUi(comp) {
  if (!comp) return false;
  const classifLen = (comp.classification || []).length;
  if (classifLen > 0) return false;
  return isFinalsPilotComp(comp);
}

function updateDetailTabsVisibility() {
  const hideClassif = shouldHideClassificationUi(detailComp);
  const classifTab = document.querySelector('.detail-tab[data-tab="classif"]');
  if (classifTab) classifTab.style.display = hideClassif ? "none" : "";
  if (hideClassif && detailTab === "classif") detailTab = "calendar";
}

function buildPilotMatchKey(m) {
  const home = normalizeCompKey(m?.home || "");
  const away = normalizeCompKey(m?.away || "");
  const date = String(m?.date || "").trim();
  const time = String(m?.time || "").trim();
  const hs = String(m?.homeScore ?? "");
  const as = String(m?.awayScore ?? "");
  const phase = normalizeCompKey(m?.phaseName || "");
  return [home, away, date, time, hs, as, phase].join("|");
}

function mergePilotCalendarMatches(baseMatches, extraMatches) {
  const out = [];
  const seen = new Set();
  for (const m of ([...(baseMatches || []), ...(extraMatches || [])])) {
    const home = normalizeJokClubDisplayName(m?.home || "");
    const away = normalizeJokClubDisplayName(m?.away || "");
    if (!home || !away) continue;
    const mergedMatch = {
      ...m,
      home,
      away,
      date: String(m?.date || ""),
      time: String(m?.time || ""),
      homeScore: m?.homeScore ?? null,
      awayScore: m?.awayScore ?? null,
      played: m?.played !== false && m?.homeScore != null && m?.awayScore != null,
      compId: String(m?.compId || ""),
      actaId: m?.actaId ? String(m.actaId) : null,
      actaUrl: m?.actaUrl ? String(m.actaUrl) : null,
    };
    const key = buildPilotMatchKey(mergedMatch);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mergedMatch);
  }
  return out;
}

async function ensurePilotFinalsDataForComp(comp) {
  if (!isFinalsPilotComp(comp)) return false;
  if (typeof fetch !== "function") return false;

  const compId = String(comp?.id || "");
  if (!compId) return false;

  const loaded = finalsPilotLoadState.get(compId);
  if (loaded?.status === "done") return false;
  if (loaded?.status === "loading" && loaded.promise) return loaded.promise;

  const run = (async () => {
    try {
      const slug = String(comp?.slug || "").trim();
      const mappedFecapaCompId = String(comp?.classificationPilot?.fecapaCompetitionId || "").trim();
      const qs = new URLSearchParams({ jokCompId: compId });
      if (slug) qs.set("slug", slug);
      if (mappedFecapaCompId) qs.set("fecapaCompId", mappedFecapaCompId);

      const res = await fetch(`${FINALS_PILOT_API_URL}?${qs.toString()}`);
      if (!res.ok) throw new Error(`pilot-http-${res.status}`);
      const payload = await res.json();
      const phases = normalizePostSeasonPhases(payload?.phases || []);
      if (!phases.length) {
        finalsPilotLoadState.set(compId, { status: "done", loadedAt: Date.now(), empty: true });
        return false;
      }

      const phaseMatches = phases.flatMap(p => (p?.matches || []).map(m => ({
        ...m,
        phaseName: p.phaseName,
        phaseType: p.phaseType,
        compId: String(compId),
      })));
      const mergedPhases = normalizePostSeasonPhases([...(comp.postSeasonPhases || []), ...phases]);
      const mergedCalendar = mergePilotCalendarMatches(comp.calendar || [], phaseMatches);

      comp.postSeasonPhases = mergedPhases;
      comp.hasPostSeasonPhases = mergedPhases.some(p => p?.isPostSeason === true);
      comp.calendar = mergedCalendar;
      const playable = mergedCalendar.filter(m => m?.placeholder !== true && !isDescansaTeamName(m?.home || "") && !isDescansaTeamName(m?.away || ""));
      const played = playable.filter(m => m?.homeScore != null && m?.awayScore != null).length;
      comp.pctPlayed = playable.length ? Math.round((played * 100) / playable.length) : 0;
      comp.pctPlayedEffective = comp.pctPlayed;
      comp.finalsPilotMeta = {
        loadedAt: new Date().toISOString(),
        source: "api/finals-pilot",
        payloadSources: payload?.sources || null,
        matchCount: phaseMatches.length,
      };

      finalsPilotLoadState.set(compId, { status: "done", loadedAt: Date.now(), empty: false });
      return true;
    } catch (err) {
      console.warn("[pilot-finals] load failed", compId, err?.message || err);
      finalsPilotLoadState.set(compId, { status: "done", loadedAt: Date.now(), error: err?.message || String(err) });
      return false;
    }
  })();

  finalsPilotLoadState.set(compId, { status: "loading", promise: run });
  return run;
}

function getJokCompetitionUrl(comp) {
  if (!comp?.id) return "https://jok.cat/";
  const slug = String(comp?.slug || "").trim();
  if (slug) return `https://jok.cat/competicio/${comp.id}/${slug}`;
  return `https://jok.cat/competicio/${comp.id}`;
}

function renderDetailHeaderMeta() {
  if (!detailComp) return;
  $("detail-comp-name").textContent=stripSeasonSuffix(detailComp.name || "");
  const sourceBadge = classifSourceBadgeHtml(detailComp);
  const playedPct = getCompPlayedPct(detailComp);

  const isPendingRelevant = m => {
    if (!m) return false;
    if (m?.homeScore != null && m?.awayScore != null) return false;
    if (isDescansaTeamName(m?.home) || isDescansaTeamName(m?.away)) return false;
    if (isPlaceholderTeamName(m?.home) || isPlaceholderTeamName(m?.away)) return false;
    const ts = parseCalendarDateToTimestamp(m?.date || "", detailComp?.name || "");
    if (ts != null && Number.isFinite(ts)) {
      const staleCutoffMs = 7 * 24 * 60 * 60 * 1000;
      if (ts < (Date.now() - staleCutoffMs)) return false;
    }
    return true;
  };

  const regularMatches = detailComp?.calendar || [];
  const phaseMatches = normalizePostSeasonPhases(detailComp?.postSeasonPhases || []).flatMap(p => p?.matches || []);
  const hasPendingRelevant = [...regularMatches, ...phaseMatches].some(isPendingRelevant);
  const playedMatchCount = [...regularMatches, ...phaseMatches].filter(m => m?.homeScore != null && m?.awayScore != null).length;
  const isFinished = playedPct >= 100 || (playedMatchCount > 0 && !hasPendingRelevant);
  const status = (playedPct == null || playedPct === 0) ? "No començada" : (isFinished ? "Finalitzada" : "En curs");
  const statusColor = isFinished ? "#6b7a99" : (playedPct === 0 ? "#94a3b8" : "#e5001c");

  const classifCount = (detailComp.classification||[]).length;
  const rosterTeams = [...new Set((detailComp.teams || [])
    .map(t => String(t?.teamName || t?.name || "").trim())
    .filter(Boolean)
    .filter(t => !isDescansaTeamName(t) && !isPlaceholderTeamName(t)))];
  const fallbackTeams = classifCount ? [] : [...new Set((detailComp.calendar || []).flatMap(m => [m?.home, m?.away]))]
    .filter(Boolean)
    .filter(t => !isDescansaTeamName(t) && !isPlaceholderTeamName(t))
    .filter(t => isLikelyCompetitionTeamName(t, detailComp));
  const eqLabel = classifCount || rosterTeams.length || fallbackTeams.length;
  const phaseCount = (detailComp.postSeasonPhases || []).filter(p => (p?.matches || []).length > 0).length;
  const phaseMatchCount = normalizePostSeasonPhases(detailComp.postSeasonPhases || []).reduce((acc, p) => acc + ((p?.matches || []).length), 0);
  const isAdmin = currentProfile?.role === "admin";
  const pilotCfg = getClassificationSourcePilots().find(p => String(p.jokCompId) === String(detailComp.id));
  const pilotMap = detailComp.classificationPilot || null;
  const mergeInfo = detailComp.detailMergeInfo || null;
  const pilotMeta = detailComp.finalsPilotMeta || null;
  const pilotSources = pilotMeta?.payloadSources || null;
  const pilotState = finalsPilotLoadState.get(String(detailComp.id || "")) || null;

  let pilotInfo = "";
  if (pilotMeta) {
    pilotInfo = `<div><span style="font-weight:700;color:#1a2035">Fases finals:</span> ${esc(String(pilotMeta.matchCount || 0))} partits · font API</div>`;
  } else if (pilotState?.status === "loading") {
    pilotInfo = `<div><span style="font-weight:700;color:#1a2035">Fases finals:</span> carregant dades live…</div>`;
  } else if (pilotState?.status === "done" && pilotState?.empty) {
    pilotInfo = `<div><span style="font-weight:700;color:#1a2035">Fases finals:</span> cap partit nou (fallback local)</div>`;
  } else if (pilotState?.status === "done" && pilotState?.error) {
    pilotInfo = `<div><span style="font-weight:700;color:#1a2035">Fases finals:</span> fallback local · ${esc(String(pilotState.error))}</div>`;
  }

  const pilotSourcesInfo = pilotSources ? `<div><span style="font-weight:700;color:#1a2035">Fonts fases finals:</span> jok ${esc(String(pilotSources?.jok?.matchCount ?? 0))} · fecapa ${esc(String(pilotSources?.fecapa?.matchCount ?? 0))}</div>` : "";
  const adminMeta = isAdmin ? `<div style="margin-top:6px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e6ef;border-radius:10px;font-size:11px;color:#475569;line-height:1.45">
    <div><span style="font-weight:700;color:#1a2035">jok.cat:</span> ${esc(String(detailComp.id || "?"))}</div>
    <div><span style="font-weight:700;color:#1a2035">FECAPA mapping:</span> ${pilotMap ? `comp ${esc(pilotMap.fecapaCompetitionId || "?")} · grup ${esc(pilotMap.fecapaGroupId || "?")} (${esc(pilotMap.fecapaGroupName || "-")})` : (pilotCfg ? `comp ${esc(pilotCfg.fecapaCompetitionId || "?")} · token ${esc(pilotCfg.preferredGroupToken || "-")}` : "sense mapping pilot")}</div>
    ${mergeInfo && mergeInfo.merged ? `<div><span style="font-weight:700;color:#1a2035">Vista fusionada:</span> classif de ${esc(mergeInfo.classificationFromCompId || "?")} · calendari de ${esc(mergeInfo.calendarFromCompId || "?")} · candidats: ${esc((mergeInfo.sameNameCompIds || []).join(", "))}</div>` : ""}
    ${pilotInfo}
    ${pilotSourcesInfo}
  </div>` : "";
  $("detail-meta").innerHTML=`<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <span>${eqLabel} equip${eqLabel!==1?"s":""}</span>
    <span style="color:${statusColor};font-weight:700">${status} · ${playedPct}%</span>
    ${phaseCount ? `<span style="display:inline-flex;align-items:center;font-weight:800;color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;padding:2px 8px">${phaseMatchCount} partit${phaseMatchCount!==1?"s":""} fase final</span>` : ""}
    ${sourceBadge ? `<span>${sourceBadge}</span>` : ""}
  </div>${adminMeta}`;
}

async function ensurePilotFinalsForCurrentDetail(rawComp) {
  if (!rawComp || !detailComp) return;
  if (String(rawComp.id || "") !== String(detailComp.id || "")) return;

  const loadPromise = ensurePilotFinalsDataForComp(rawComp);
  renderDetailHeaderMeta();
  const changed = await loadPromise;
  if (!changed) return;

  if (!detailComp || String(rawComp.id || "") !== String(detailComp.id || "")) return;
  const selected = resolveSelectedTeam(rawComp, detailTeam || null, detailTeamId || null);
  detailComp = buildDetailCompView(rawComp, selected.teamName, selected.teamId);
  const mergedSelected = resolveSelectedTeam(detailComp, selected.teamName, selected.teamId);
  detailTeam = mergedSelected.teamName || detailTeam;
  detailTeamId = mergedSelected.teamId || detailTeamId;

  updateDetailTabsVisibility();
  renderDetailHeaderMeta();
  renderDetailCalendar();
}

function openDetail(compId,teamName,tab,teamId=null){
  const rawComp = findComp(compId);
  const selected = resolveSelectedTeam(rawComp, teamName || null, teamId || null);
  detailComp = buildDetailCompView(rawComp, selected.teamName, selected.teamId);
  const mergedSelected = resolveSelectedTeam(detailComp, selected.teamName, selected.teamId);
  detailTeam = mergedSelected.teamName || null;
  detailTeamId = mergedSelected.teamId || null;
  detailTab=tab||"classif";
  if (!detailComp) return;
  updateDetailTabsVisibility();
  $("screen-home").style.display="none"; $("screen-picker").style.display="none"; $("screen-detail").style.display="flex";
  renderDetailHeaderMeta();
  document.querySelectorAll(".detail-tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===detailTab));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===`panel-${detailTab}`));
  renderDetailClassif().then(async () => {
    await hydrateCompetitionActaLinks(detailComp, activeSeasonKey);
    renderDetailCalendar();
    renderDetailJugadors();
  });
  void ensurePilotFinalsForCurrentDetail(rawComp);
  window.scrollTo(0,0);
}
window.openDetail=openDetail;

// ── Fitxa de jugador (bottom sheet) ──────────────────────────
async function openPlayerModal(jid, fallbackName) {
  await enrichPlayerOnDemand(jid);
  const player = getPlayerById(jid);
  const slug   = player?.slug ? decodeURIComponent(player.slug.replace(/\+/g," ")) : null;
  const name   = (slug ? formatPlayerDisplayName(slug) : null)
               || fallbackName
               || "Jugador";

  // Team i categoria del teamStats principal
  const sourceTeamStats = await buildPlayerTeamStatsFromSources(player, jid, { seasonData: DB, seasonKey: activeSeasonKey });
  const fixedTeamStats = sourceTeamStats.length
    ? sourceTeamStats
    : normalizePlayerTeamStatsForDisplay(player, DB);
  const firstTeam  = fixedTeamStats?.[0];
  const teamSuffix = firstTeam ? `, ${normalizeJokClubDisplayName(firstTeam.team)}` : "";
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
  const parseSeasonToken = raw => {
    const m = String(raw || "").match(/(20\d{2})\s*[-/]\s*(\d{2,4})/);
    if (!m) return "";
    return `${m[1]}-${String(m[2]).slice(-2)}`;
  };
  const cs = [...(player?.careerStats || [])]
    .sort((a, b) => String(b?.seasonName || "").localeCompare(String(a?.seasonName || "")))
    .map(s => ({ ...s, _seasonToken: parseSeasonToken(s?.seasonName) }));

  const selectedSeasonToken = parseSeasonToken(DB?.season || "");
  const selectedSeasonIdx = selectedSeasonToken
    ? cs.findIndex(s => s._seasonToken === selectedSeasonToken)
    : -1;
  const currentSeasonData = seasonDataCache.get("current") || null;
  const currentSeasonToken = parseSeasonToken(currentSeasonData?.season || "");
  const currentSeasonIdx = currentSeasonToken
    ? cs.findIndex(s => s._seasonToken === currentSeasonToken)
    : -1;
  const preferredSeasonIdx = selectedSeasonIdx >= 0
    ? selectedSeasonIdx
    : (currentSeasonIdx >= 0 ? currentSeasonIdx : 0);
  const selectedSeasonFallbackToCurrent = selectedSeasonToken && selectedSeasonIdx < 0 && currentSeasonIdx >= 0;
  const selectedSeasonFallbackToLatest = selectedSeasonToken && selectedSeasonIdx < 0 && currentSeasonIdx < 0;
  const current = cs[0];

  const statBox = (val, lbl, color) =>
    `<div class="pm-stat"><div class="pm-stat-val" style="color:${color}">${val ?? "–"}</div><div class="pm-stat-lbl">${lbl}</div></div>`;

  const buildSeasonDisplayRows = async seasonToken => {
    if (!seasonToken) return [];
    const seasonEntry = seasonCatalog.find(s =>
      parseSeasonToken(s.key) === seasonToken
      || parseSeasonToken(s.label) === seasonToken
      || String(s.key) === seasonToken
    ) || null;
    const seasonKey = seasonEntry?.key || null;
    const seasonData = seasonKey ? await getSeasonDataForKey(seasonKey) : null;
    if (!seasonData) return [];

    const seasonPlayer = seasonData?.jugadors?.[String(jid)] || null;
    if (!seasonPlayer) return [];

    const fromSources = await buildPlayerTeamStatsFromSources(seasonPlayer, jid, { seasonData, seasonKey: seasonKey || activeSeasonKey });
    const teamStats = fromSources.length
      ? fromSources
      : normalizePlayerTeamStatsForDisplay(seasonPlayer, seasonData);

    if (teamStats.length) {
      return teamStats.map(t => ({
        teamName: String(t.team || ""),
        label: esc(normalizeJokClubDisplayName(t.team)),
        sublabel: esc(CAT_LABELS[t.cat] || t.cat || ""),
        count: Number(t.count || 0),
        compId: String((t.compIds || [])[0] || ""),
        seasonKey: seasonKey || "",
      }));
    }

    const catCounts = getPlayerSourceCatCounts(seasonPlayer, seasonData);
    return Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, cnt]) => ({ teamName: "", label: esc(CAT_LABELS[cat] || cat), sublabel: "", count: Number(cnt || 0), compId: "", seasonKey: seasonKey || "" }));
  };

  const seasonRowsByToken = new Map();
  await Promise.all(cs.map(async s => {
    if (!s?._seasonToken) return;
    const rows = await buildSeasonDisplayRows(s._seasonToken);
    seasonRowsByToken.set(s._seasonToken, rows || []);
  }));

  const seasonsSections = cs.length ? `
    <div class="pm-section">
      <div class="pm-section-title">Temporades</div>
      ${cs.map((s, idx) => {
        const isLatest = idx === 0;
        const isPreferred = idx === preferredSeasonIdx;
        const shouldOpen = isLatest || isPreferred;
        const seasonRows = seasonRowsByToken.get(s._seasonToken) || [];
        const maxCount = Math.max(1, Number(seasonRows[0]?.count || 0));
        const breakdownSection = seasonRows.length ? `
          <div class="pm-section-title" style="margin-top:12px">Equips / Categories</div>
          ${seasonRows.map(r => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
              <div style="flex:1;min-width:0">
                ${r.teamName
                  ? `<button onclick="openPlayerTeamFromModal('${esc(r.teamName)}','${esc(r.seasonKey || "")}', '${esc(r.compId || "")}')" style="background:none;border:none;padding:0;margin:0;font-size:12px;font-weight:700;color:#003da5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;cursor:pointer;text-align:left">${r.label}</button>`
                  : `<div style="font-size:12px;font-weight:600;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.label}</div>`}
                ${r.sublabel ? `<div style="font-size:10px;color:#94a3b8">${r.sublabel}</div>` : ""}
              </div>
              <div style="width:60px;height:7px;background:#f0f4f8;border-radius:4px;overflow:hidden;flex-shrink:0">
                <div style="width:${Math.round((Number(r.count || 0)/maxCount)*100)}%;height:100%;background:#003da5;border-radius:4px"></div>
              </div>
              <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:#003da5;width:24px;text-align:right;flex-shrink:0">${Number(r.count || 0)}</div>
            </div>`).join("")}` : "";
        const highlight = isPreferred
          ? `<span style="display:inline-flex;align-items:center;gap:3px;background:#e8f2ff;color:#1d4ed8;border-radius:999px;padding:2px 7px;font-size:10px;font-weight:700">Temporada seleccionada</span>`
          : "";
        return `<details ${shouldOpen ? "open" : ""} style="background:#fff;border:1.5px solid ${isPreferred ? "#bfdbfe" : "#e2e6ef"};border-radius:12px;padding:10px 11px;margin-bottom:8px">
          <summary style="list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div style="display:flex;align-items:center;gap:8px;min-width:0">
              <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;color:#1a2035;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(String(s?.seasonName || "Temporada"))}</div>
              ${highlight}
            </div>
            <div style="display:flex;align-items:center;gap:10px;font-size:11px;color:#6b7a99;flex-shrink:0">
              <span><b style="color:#1a2035">${s?.match_count ?? "–"}</b> P</span>
              <span><b style="color:#e5001c">${s?.total_goals ?? "–"}</b> G</span>
            </div>
          </summary>
          <div style="display:flex;background:#f8fafc;border-radius:12px;margin-top:10px">
            ${statBox(s?.match_count, "Partits",   "#1a2035")}
            ${statBox(s?.total_goals, "Gols",      "#e5001c")}
            ${statBox((s?.total_blue ?? 0) || "·", "Blaves",    "#2563eb")}
            ${statBox((s?.total_red ?? 0) || "·",  "Vermelles", "#dc2626")}
          </div>
          ${breakdownSection}
        </details>`;
      }).join("")}
      ${selectedSeasonFallbackToCurrent ? `<div style="margin-top:4px;font-size:11px;color:#64748b">No hi ha registre del jugador a la temporada seleccionada; es mostra la temporada actual.</div>` : ""}
      ${selectedSeasonFallbackToLatest ? `<div style="margin-top:4px;font-size:11px;color:#64748b">No hi ha registre del jugador a la temporada seleccionada; es mostra prioritzada la més nova disponible.</div>` : ""}
    </div>` : "";

  const noDataHtml = !current ? `
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
    ${seasonsSections}
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

window.openPlayerTeamFromModal = async (teamName, seasonKey = "", compIdHint = "") => {
  const wantedTeam = String(teamName || "").trim();
  const wantedSeason = String(seasonKey || "").trim() || activeSeasonKey;
  if (!wantedTeam) return;

  const hasTeamInComp = comp => {
    if (!comp) return false;
    const inClassif = (comp.classification || []).some(r =>
      teamMatchesCalendarExact(r?.team || "", wantedTeam) || teamMatchesLoose(r?.team || "", wantedTeam)
    );
    if (inClassif) return true;
    return (comp.calendar || []).some(m =>
      teamMatchesCalendarExact(m?.home || "", wantedTeam)
      || teamMatchesCalendarExact(m?.away || "", wantedTeam)
      || teamMatchesLoose(m?.home || "", wantedTeam)
      || teamMatchesLoose(m?.away || "", wantedTeam)
    );
  };

  const resolveBestTeamComp = () => {
    const allComps = Object.values(DB?.categories || {}).flat();
    let bestComp = null;
    let bestTeamName = wantedTeam;
    let bestScore = -1;

    for (const comp of allComps) {
      if (!comp || is3x3Competition(comp)) continue;
      let score = 0;
      let candidateName = wantedTeam;

      const exactClassif = (comp.classification || []).find(r => teamMatchesCalendarExact(r?.team || "", wantedTeam));
      const looseClassif = exactClassif ? null : (comp.classification || []).find(r => teamMatchesLoose(r?.team || "", wantedTeam));
      if (exactClassif || looseClassif) {
        score = 1000;
        candidateName = (exactClassif || looseClassif)?.team || wantedTeam;
      } else {
        const exactCal = (comp.calendar || []).find(m => teamMatchesCalendarExact(m?.home || "", wantedTeam) || teamMatchesCalendarExact(m?.away || "", wantedTeam));
        const looseCal = exactCal ? null : (comp.calendar || []).find(m => teamMatchesLoose(m?.home || "", wantedTeam) || teamMatchesLoose(m?.away || "", wantedTeam));
        if (!exactCal && !looseCal) continue;
        score = exactCal ? 800 : 600;
        const m = exactCal || looseCal;
        candidateName = teamMatchesLoose(m?.home || "", wantedTeam) ? (m?.home || wantedTeam) : (m?.away || wantedTeam);
      }

      score += competitionPriority(comp);
      if (score > bestScore) {
        bestScore = score;
        bestComp = comp;
        bestTeamName = candidateName;
      }
    }

    return { comp: bestComp, teamName: bestTeamName };
  };

  try {
    if (wantedSeason !== activeSeasonKey) {
      await switchActiveSeason(wantedSeason, { showLoading: true });
    }

    let comp = compIdHint ? findComp(compIdHint) : null;
    let teamForDetail = wantedTeam;
    if (!comp || !hasTeamInComp(comp)) {
      const best = resolveBestTeamComp();
      comp = best.comp;
      teamForDetail = best.teamName || wantedTeam;
    }

    if (!comp) {
      alert("No s'ha trobat cap competició per aquest equip en aquesta temporada");
      return;
    }

    closePlayerModal();
    openDetail(comp.id, teamForDetail, "calendar");
  } catch (err) {
    console.error("player-modal team navigation error", err);
    alert(`No s'ha pogut obrir el detall de l'equip: ${err?.message || "error desconegut"}`);
  }
};

function setupListeners(){
  const bb=$("back-btn");
  if(bb) bb.addEventListener("click",()=>{ $("screen-detail").style.display="none"; renderHome(); });
  const tb=$("team-back-btn");
  if (tb) tb.addEventListener("click",()=>{
    $("screen-team").style.display="none";
    if (teamProfileReturnScreen === "detail" && detailComp) {
      $("screen-detail").style.display = "flex";
    } else {
      renderHome();
    }
    window.scrollTo(0,0);
  });
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

async function renderDetailClassif(){
  const cl=detailComp.classification||[];
  const sourceBadge = classifSourceBadgeHtml(detailComp);
  if (!cl.length){ $("panel-classif").innerHTML=`<div style="text-align:center;padding:32px;color:#94a3b8">Classificació no disponible.<br/><a href="${esc(getJokCompetitionUrl(detailComp))}" target="_blank">jok.cat →</a></div>`; return; }

  const resolveTeamName = name => resolveCanonicalClassifTeamName(cl, name);

  // Calculate highlights from matches and classification
  const matches = detailComp.calendar || [];
  const played = matches.filter(m => m.homeScore != null && m.awayScore != null);

  const stats = {};
  cl.forEach(r => {
    stats[r.team] = { gf: r.gf || 0, gc: r.gc || 0, shutouts: 0, blueCards: 0 };
  });

  // Calculate shutouts
  played.forEach(m => {
    const homeTeam = resolveTeamName(m.home);
    const awayTeam = resolveTeamName(m.away);
    if (m.awayScore === 0 && homeTeam && stats[homeTeam]) stats[homeTeam].shutouts++;
    if (m.homeScore === 0 && awayTeam && stats[awayTeam]) stats[awayTeam].shutouts++;
  });

  // Calculate cards (blaves/vermelles) from actes
  const catSlug = getCatSlugForComp(detailComp);
  if (catSlug) {
    const actes = await loadCatActes(catSlug);
    const compIdStr = String(detailComp.id);

    for (const acta of Object.values(actes)) {
      if (String(acta.compId) !== compIdStr) continue;
      const countBlueCards = players => {
        let count = 0;
        for (const p of (players || [])) {
          count += (p.b || 0);
        }
        return count;
      };

      const homeCards = countBlueCards(acta.playerStats?.homePlayers || []);
      const awayCards = countBlueCards(acta.playerStats?.awayPlayers || []);

      const homeTeam = resolveTeamName(acta.home);
      const awayTeam = resolveTeamName(acta.away);

      if (homeTeam && stats[homeTeam]) stats[homeTeam].blueCards += homeCards;
      if (awayTeam && stats[awayTeam]) stats[awayTeam].blueCards += awayCards;
    }
  }

  // Find highlight teams
  const topGoals = Object.entries(stats).sort((a,b) => b[1].gf - a[1].gf)[0];
  const fewestGoals = Object.entries(stats).sort((a,b) => a[1].gc - b[1].gc)[0];
  const mostCards = Object.entries(stats).sort((a,b) => b[1].blueCards - a[1].blueCards)[0];
  const mostShutouts = Object.entries(stats).sort((a,b) => b[1].shutouts - a[1].shutouts)[0];

  const highlightCard = (emoji, label, team, value) => {
    if (!team) return '';
    return `<div style="flex:1;min-width:150px;background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:20px;margin-bottom:4px">${emoji}</div>
      <div style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;margin-bottom:6px">${label}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:6px">
        ${shieldImg(rowClubId(findBestClassifRow(cl, team) || {}),20)}
        <div style="font-size:12px;font-weight:700;color:#1a2035;line-height:1.3">${esc(normalizeJokClubDisplayName(team))}</div>
      </div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:#e5001c">${value}</div>
    </div>`;
  };

  const highlightsHtml = `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
    ${highlightCard('⚽', 'Més Gols', topGoals?.[0], topGoals?.[1]?.gf || 0)}
    ${highlightCard('🛡️', 'Defensa (menys gols)', fewestGoals?.[0], fewestGoals?.[1]?.gc || 0)}
    ${highlightCard('🟦', 'Més Blaves', mostCards?.[0], mostCards?.[1]?.blueCards || 0)}
    ${highlightCard('🔒', 'Porteries a Zero', mostShutouts?.[0], mostShutouts?.[1]?.shutouts || 0)}
  </div>`;

  const setDetailTabView = tabKey => {
    detailTab = tabKey;
    document.querySelectorAll(".detail-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tabKey));
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${tabKey}`));
  };

  const setDetailSelection = (teamName, teamId = null) => {
    if (!teamName) {
      detailTeam = null;
      detailTeamId = null;
      return;
    }
    const next = resolveSelectedTeam(detailComp, teamName, teamId || detailTeamId || null);
    detailTeam = next.teamName || teamName;
    detailTeamId = next.teamId || null;
  };

  window.openJugadorsFromClassif = (teamName, teamId = null) => {
    setDetailSelection(teamName || detailTeam, teamId);
    setDetailTabView("jugadors");
    renderDetailClassif().then(() => {
      renderDetailCalendar();
      renderDetailJugadors();
    });
  };

  $("panel-classif").innerHTML=`
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">${sourceBadge}</div>
    ${highlightsHtml}
    <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,30,80,.07)">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f8fafc">
          ${["#","Equip","PJ","G","E","Pe","GF","GC","Avg","Pts"].map((h,i)=>`<th style="padding:8px ${i<2?6:4}px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:${i===3?"#16a34a":i===4?"#d97706":i===5?"#dc2626":i===8?"#64748b":i===9?"#e5001c":"#94a3b8"};text-transform:uppercase;text-align:${i===1?"left":"center"};border-bottom:1px solid #e2e6ef">${h}</th>`).join("")}
        </tr></thead>
        <tbody>${cl.map(r=>{
          const mine=detailTeamId ? String(r.teamId || "") === String(detailTeamId) : teamMatchesCalendarExact(r.team,detailTeam), cid=rowClubId(r), pc=posColor(r.pos);
          const avg = calcGoalAverage(r.gf, r.gc);
          const avgColor = goalAverageColor(avg);
          const pos=r.pos<=3?`<span style="font-size:28px">${["🥇","🥈","🥉"][r.pos-1]}</span>`:`<span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:${pc}">${r.pos}</span>`;
          return `<tr style="background:${mine?"#eff6ff":"transparent"};border-bottom:1px solid #f0f2f8">
            <td style="padding:9px 6px;text-align:center">${pos}</td>
            <td style="padding:9px 6px"><div style="display:flex;align-items:center;gap:6px"><button onclick="openClubFromClassif('${esc(r.team)}');event.stopPropagation();" style="background:none;border:none;padding:0;cursor:pointer;display:inline-flex;align-items:center" title="Veure club">${shieldImg(cid,22)}</button><button onclick="openTeamProfileFromClassif('${esc(r.team)}','${esc(String(r.teamId||""))}');event.stopPropagation();" style="background:none;border:none;padding:0;margin:0;font-size:13px;font-weight:${mine?800:500};color:${mine?"#003da5":"#334155"};cursor:pointer;text-align:left" title="Veure fitxa global de l'equip">${esc(normalizeJokClubDisplayName(r.team))}</button><button onclick="openTeamAdvancedStatsFromClassif('${esc(r.team)}');event.stopPropagation();" style="background:none;border:none;padding:0;margin:0;font-size:14px;cursor:pointer" title="Estadístiques avançades (competició actual)">🔍</button>${mine?`<span style="color:#e5001c;font-size:10px">◀</span>`:""}</div></td>
            <td style="padding:9px 4px;text-align:center;color:#94a3b8">${r.pj??"-"}</td>
            <td style="padding:9px 4px;text-align:center;color:#16a34a;font-weight:600">${r.pg??"-"}</td>
            <td style="padding:9px 4px;text-align:center;color:#d97706">${r.pe??"-"}</td>
            <td style="padding:9px 4px;text-align:center;color:#dc2626">${r.pp??"-"}</td>
            <td style="padding:9px 4px;text-align:center;color:#94a3b8">${r.gf??"-"}</td>
            <td style="padding:9px 4px;text-align:center;color:#94a3b8">${r.gc??"-"}</td>
            <td style="padding:9px 4px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:${avgColor}">${formatGoalAverage(avg)}</td>
            <td style="padding:9px 4px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;color:${mine?"#e5001c":"#1a2035"}">${r.pts??"-"}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>`;
}

function renderDetailCalendar(){
  const all = getDetailCalendarSourceMatches(detailComp)
    .filter(m => m?.placeholder === true || (isLikelyCompetitionTeamName(m?.home, detailComp) && isLikelyCompetitionTeamName(m?.away, detailComp)));
  console.log("renderDetailCalendar - detailComp.id:", detailComp.id);
  if (!all.length){ $("panel-calendar").innerHTML=`<div style="text-align:center;padding:32px;color:#94a3b8">Calendari no disponible.<br/><a href="${esc(getJokCompetitionUrl(detailComp))}" target="_blank">jok.cat →</a></div>`; return; }

  const names = getCalendarFilterableTeamNames(all, detailComp);

  const chips=`<div style="margin-bottom:10px">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Filtrar per equip</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      <button onclick="setCalTeam(null)" style="background:${!detailTeam?"#1a2035":"#f0f4f8"};border:1.5px solid ${!detailTeam?"#1a2035":"#e2e6ef"};border-radius:16px;padding:4px 11px;font-size:12px;font-weight:600;color:${!detailTeam?"#fff":"#334155"};cursor:pointer">Tots</button>
      ${names.map(t=>{const act=teamMatchesCalendarExact(t,detailTeam),cid=getClubId(t);return`<button onclick="setCalTeam('${esc(t)}')" style="display:inline-flex;align-items:center;gap:4px;background:${act?"#1a2035":"#f0f4f8"};border:1.5px solid ${act?"#1a2035":"#e2e6ef"};border-radius:16px;padding:4px 10px 4px 5px;font-size:12px;font-weight:600;color:${act?"#fff":"#334155"};cursor:pointer">${shieldImg(cid,16)} ${esc(shortTeamDisplayName(t))}</button>`;}).join("")}
    </div>
  </div>`;

  const matches=detailTeam
    ? all.filter(m =>
      m?.placeholder === true
      || teamMatchesCalendarExact(m.home,detailTeam)
      || teamMatchesCalendarExact(m.away,detailTeam)
    )
    : all;
  const eliminationCtxByMatch = buildTwoLegEliminationContext(matches, detailComp?.name || "");

  const byJ={};
  matches.forEach(m=>{
    const k = m.jornada
      ? `Jornada ${m.jornada}`
      : (m.date || m.phaseName || "?");
    (byJ[k]||(byJ[k]=[])).push(m);
  });
  const sortedJornades=Object.entries(byJ).sort((a,b)=>{
    const getNum=k=>{const m=k[0].match(/Jornada (\d+)/);return m?parseInt(m[1]):-1;};
    const numA=getNum(a), numB=getNum(b);
    return numA===-1||numB===-1?0:numB-numA;
  });

  const regularHtml = sortedJornades.length
    ? `${sortedJornades.map(([j,ms])=>`
      <div style="margin-bottom:10px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">${esc(j)}</div>
        ${ms.map(m=>matchCard(m,detailTeam,detailComp.id,{ eliminationCtx: eliminationCtxByMatch.get(m) || null })).join("")}
      </div>`).join("")}`
    : `<div style="text-align:center;padding:20px;color:#94a3b8">No hi ha partits per aquest filtre.</div>`;

  $("panel-calendar").innerHTML=chips+regularHtml;
}

function getTeamCompetitionCandidates(comp, teamName, teamId = null) {
  if (!comp || (!teamName && !teamId)) return [];
  const out = [];
  const seen = new Set();
  const pushUnique = n => {
    const name = String(n || "").trim();
    if (!name) return;
    const key = normalizeTeamNameStrict(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };

  const classRows = comp.classification || [];
  const wantedId = String(teamId || "").trim();
  const classifRow = wantedId
    ? classRows.find(r => String(r?.teamId || "") === wantedId)
    : findBestClassifRow(classRows, teamName);
  if (classifRow?.team) pushUnique(classifRow.team);

  if (wantedId) {
    for (const t of (comp.teams || [])) {
      const tid = String(t?.id || t?.teamId || "").trim();
      if (!tid || tid !== wantedId) continue;
      pushUnique(t?.name || t?.teamName || "");
    }
  }

  // Keep calendar matching anchored to the original team identity only.
  // Do not expand transitively via newly discovered rivals.
  const anchors = out.length ? [...out] : [String(teamName || "").trim()].filter(Boolean);
  for (const m of (comp.calendar || [])) {
    if (anchors.some(c => teamMatchesCalendarExact(m?.home, c))) pushUnique(m?.home);
    if (anchors.some(c => teamMatchesCalendarExact(m?.away, c))) pushUnique(m?.away);
  }

  if (!wantedId && !out.length && teamName) {
    for (const t of (comp.teams || [])) {
      const n = t?.name || t?.teamName || "";
      if (teamMatchesCalendarExact(n, teamName)) pushUnique(n);
    }

    for (const m of (comp.calendar || [])) {
      if (teamMatchesCalendarExact(m?.home, teamName)) pushUnique(m?.home);
      if (teamMatchesCalendarExact(m?.away, teamName)) pushUnique(m?.away);
    }
  }

  return out;
}

function buildUpcomingPhaseMatchesForTeam(comp, teamCandidates) {
  const candidates = (teamCandidates || []).filter(Boolean);
  if (!candidates.length) return [];

  const allPhaseMatches = normalizePostSeasonPhases(comp?.postSeasonPhases || [])
    .flatMap(p => (p.matches || []).map(m => ({ ...m, _phaseName: p.phaseName || "Fase" })));

  return allPhaseMatches
    .filter(m => candidates.some(c => teamMatchesCalendarExact(m?.home, c) || teamMatchesCalendarExact(m?.away, c)))
    .filter(m => m?.homeScore == null || m?.awayScore == null)
    .sort((a, b) => parseMatchTimestamp(a?.date || "", comp?.name || "") - parseMatchTimestamp(b?.date || "", comp?.name || ""));
}

window.setCalTeam=t=>{
  const next = resolveSelectedTeam(detailComp, t, null);
  detailTeam = next.teamName;
  detailTeamId = next.teamId;
  renderDetailClassif(); renderDetailCalendar(); renderDetailJugadors();
};

function getCatSlugForComp(comp) {
  const toSlug = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
  for (const [catName, comps] of Object.entries(DB.categories||{}))
    if (comps.some(c=>c.id===comp.id)) return toSlug(catName);
  return null;
}

async function renderDetailJugadors(){
  const catSlug = getCatSlugForComp(detailComp);
  // Source matches (used for acta IDs and visibleTeamSet) - no name filtering
  const calendarMatches = getDetailCalendarSourceMatches(detailComp);
  // Filtered matches used only to generate chip names (noise removed)
  const chipMatches = calendarMatches
    .filter(m => m?.placeholder === true || (isLikelyCompetitionTeamName(m?.home, detailComp) && isLikelyCompetitionTeamName(m?.away, detailComp)));

  // Noms d'equip del calendari per als filtres
  const calNames = getCalendarFilterableTeamNames(chipMatches, detailComp);

  const chips = calNames.length ? `<div style="margin-bottom:10px">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Filtrar per equip</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      <button onclick="setJugadorsTeam(null)" style="background:${!detailTeam?"#1a2035":"#f0f4f8"};border:1.5px solid ${!detailTeam?"#1a2035":"#e2e6ef"};border-radius:16px;padding:4px 11px;font-size:12px;font-weight:600;color:${!detailTeam?"#fff":"#334155"};cursor:pointer">Tots</button>
      ${calNames.map(t=>{const act=teamMatchesCalendarExact(t,detailTeam),cid=getClubId(t);return`<button onclick="setJugadorsTeam('${esc(t)}')" style="display:inline-flex;align-items:center;gap:4px;background:${act?"#1a2035":"#f0f4f8"};border:1.5px solid ${act?"#1a2035":"#e2e6ef"};border-radius:16px;padding:4px 10px 4px 5px;font-size:12px;font-weight:600;color:${act?"#fff":"#334155"};cursor:pointer">${shieldImg(cid,16)} ${esc(shortTeamDisplayName(t))}</button>`;}).join("")}
    </div>
  </div>` : "";

  $("panel-jugadors").innerHTML = chips + `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">Carregant jugadors...</div>`;

  const actes = await loadCatActes(catSlug);
  const compIdStr = String(detailComp.id);
  const calendarActaIds = new Set(
    calendarMatches.map(m => String(m?.actaId || "").trim()).filter(Boolean)
  );
  const extraActesBySlug = {};
  if (calendarActaIds.size && DB?.actesIndex) {
    const extraSlugs = [...new Set([...calendarActaIds].map(id => DB.actesIndex[id]).filter(Boolean).filter(s => s !== catSlug))];
    for (const slug of extraSlugs) {
      extraActesBySlug[slug] = await loadCatActes(slug);
    }
  }
  const allActesBuckets = [actes, ...Object.values(extraActesBySlug)];

  const fmtName = p => p.slug ? formatPlayerDisplayName(decodeURIComponent(p.slug.replace(/\+/g," "))) : "?";
  const calcAge = bd => {
    if (!bd) return null;
    const pts=bd.split(/[\/\-]/), dob=pts[0].length===4?new Date(`${pts[0]}-${pts[1]}-${pts[2]}`):new Date(`${pts[2]}-${pts[1]}-${pts[0]}`);
    if (isNaN(dob)) return null;
    const now=new Date(), y=now.getFullYear()-dob.getFullYear();
    return y-(now<new Date(now.getFullYear(),dob.getMonth(),dob.getDate())?1:0);
  };

  // Agrega estadístiques per jugador des de les actes d'aquesta competició
  const statsMap = {};
  for (const bucket of allActesBuckets) {
    for (const acta of Object.values(bucket || {})) {
      const actaIdStr = String(acta?.actaId || acta?.id || "").trim();
      const inComp = String(acta?.compId || "") === compIdStr;
      const inCalendar = !!(actaIdStr && calendarActaIds.has(actaIdStr));
      if (!inComp && !inCalendar) continue;
      if (!acta.playerStats) continue;
      const add = (player, team) => {
        if (!player.jugadorId) return;
        if (detailTeam && !teamMatchesCalendarExact(team, detailTeam)) return;
        const s = statsMap[player.jugadorId] ||= { name: player.name, team, g:0, b:0, v:0, partits:0 };
        s.g += player.g||0; s.b += player.b||0; s.v += player.v||0; s.partits++;
      };
      for (const p of acta.playerStats.homePlayers||[]) add(p, acta.home);
      for (const p of acta.playerStats.awayPlayers||[]) add(p, acta.away);
    }
  }

  const ids = Object.keys(statsMap).sort((a,b) => statsMap[b].g - statsMap[a].g);

  if (!ids.length) {
    if (!detailTeam) {
      $("panel-jugadors").innerHTML = chips + `<div style="text-align:center;padding:32px;color:#94a3b8">Selecciona un equip per veure jugadors.</div>`;
      return;
    }

    // Build the set of calendar team-name variants for the selected team only.
    // When detailTeam is set, only include the specific side (home/away) that matches
    // detailTeam so that opponent names don't contaminate the player lookup.
    const visibleTeamSet = new Set(
      calendarMatches
        .flatMap(m => {
          const home = m?.home, away = m?.away;
          if (!home && !away) return [];
          if (!detailTeam) {
            // No team filter: include all non-noise names
            return [home, away].filter(t => t && !isCalendarFilterNoiseName(t));
          }
          // Only include the side(s) that match detailTeam
          const names = [];
          if (home && teamMatchesCalendarExact(home, detailTeam)) names.push(home);
          if (away && teamMatchesCalendarExact(away, detailTeam)) names.push(away);
          return names;
        })
        .filter(Boolean)
    );

    const fallbackRows = [];
    for (const [jid, p] of Object.entries(DB?.jugadors || {})) {
      const playerTeams = new Set([
        String(p?.registeredTeam || "").trim(),
        ...((p?.teamStats || []).map(t => String(t?.team || "").trim())),
      ].filter(Boolean));

      const inVisibleTeams = [...playerTeams].some(pt =>
        [...visibleTeamSet].some(vt => teamMatchesLoose(pt, vt) || teamMatchesCalendarExact(pt, vt))
      );
      if (!inVisibleTeams) continue;
      fallbackRows.push({ jid, p });
    }

    if (!fallbackRows.length) {
      $("panel-jugadors").innerHTML = chips + `<div style="text-align:center;padding:32px;color:#94a3b8">Jugadors no disponibles.</div>`;
      return;
    }

    const list = fallbackRows.slice(0, 120).map(({ jid, p }) => {
      const name = p?.slug ? fmtName(p) : formatPlayerDisplayName(p?.name || "Jugador");
      const age  = calcAge(p?.birthDate);
      const team = normalizeJokClubDisplayName(String(p?.registeredTeam || p?.teamStats?.[0]?.team || "—"));
      const gk   = p?.isGK ? " 🥅" : "";
      return `<tr data-jid="${jid}" style="cursor:pointer;border-bottom:1px solid #f0f4f8">
        <td style="padding:7px 8px;font-size:13px;font-weight:600;color:#1a2035">${esc(name)}${gk}</td>
        <td style="padding:7px 8px;font-size:13px;color:#334155;text-align:center">${age??'—'}</td>
        <td style="padding:7px 8px;font-size:12px;color:#64748b;text-align:center">${esc(team || '—')}</td>
        <td style="padding:7px 8px;font-size:12px;color:#94a3b8;text-align:center">—</td>
        <td style="padding:7px 8px;font-size:12px;color:#94a3b8;text-align:center">—</td>
        <td style="padding:7px 8px;font-size:12px;color:#94a3b8;text-align:center">—</td>
      </tr>`;
    }).join("");

    $("panel-jugadors").innerHTML = chips + `<div style="overflow-x:auto">
      <div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Jugadors (fallback per equips)</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:2px solid #e2e6ef">
          <th style="padding:6px 8px;text-align:left;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Jugador</th>
          <th style="padding:6px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Edat</th>
          <th style="padding:6px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Equip</th>
          <th style="padding:6px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">⚽</th>
          <th style="padding:6px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">🟦</th>
          <th style="padding:6px 8px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Partits</th>
        </tr></thead>
        <tbody>${list}</tbody>
      </table>
    </div>`;
    return;
  }

  const tableRows = ids.map(jid => {
    const s = statsMap[jid];
    const p = DB.jugadors?.[jid];
    const name = p?.slug ? fmtName(p) : formatPlayerDisplayName(s.name || "?");
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
  const next = resolveSelectedTeam(detailComp, team, null);
  detailTeam = next.teamName;
  detailTeamId = next.teamId;
  renderDetailClassif().then(() => { renderDetailCalendar(); renderDetailJugadors(); });
}

// ── Init ──────────────────────────────────────────────────────
async function init(){
  try {
    $("loading-note").textContent="Carregant dades...";
    const res=await fetch(DATA_URL+"?t="+Date.now());
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
    DB=JSON.parse(await res.text());
    if (!DB.categories) throw new Error("data.json incomplet");

    seasonDataCache.set("current", DB);
    rebuildGlobalJugadorsIndex();
    await loadSeasonCatalog();

    if (activeSeasonKey !== "current") {
      try {
        await switchActiveSeason(activeSeasonKey, { showLoading: false });
      } catch {
        activeSeasonKey = "current";
      }
    }

    // Load FECAPA categories used for per-league classification source pilots.
    try {
      const fecapaRes = await fetch(FECAPA_CATEGORIES_URL + "?t=" + Date.now());
      if (fecapaRes.ok) fecapaCategoriesDB = await fecapaRes.json();
    } catch {
      fecapaCategoriesDB = null;
    }

    // Load optional pilot mapping config for classification source merge.
    try {
      const pilotsRes = await fetch(CLASSIFICATION_SOURCE_PILOTS_URL + "?t=" + Date.now());
      if (pilotsRes.ok) classificationSourcePilotsDB = await pilotsRes.json();
    } catch {
      classificationSourcePilotsDB = null;
    }

    try {
      const auditRes = await fetch("./classification-audit.json?t=" + Date.now());
      if (auditRes.ok) adminAuditCache = await auditRes.json();
    } catch {
      adminAuditCache = null;
    }

    // Load venues/coordinates
    try {
      const venuesRes = await fetch(VENUES_URL);
      if (venuesRes.ok) venuesDB = await venuesRes.json();
      console.log("✓ Venues loaded:", Object.keys(venuesDB?.venues||{}).length, "teams");
    } catch(e) {
      console.log("Venues file not available:", e.message);
    }

    applyClassificationSourceMerge();
    runIdentityRegressionChecks();

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

function normalizeTeamName(name) {
  if (!name) return "";
  return String(name)
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[''´`]/g, "")
    .replace(/[-–—]/g, "-")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function extractSeasonStartYear(compName) {
  const m = String(compName || "").match(/\((20\d{2})-(\d{2})\)/);
  if (m) return parseInt(m[1], 10);
  return new Date().getFullYear();
}

function parseMatchTimestamp(dateInput, compName = "") {
  if (!dateInput) return 0;
  if (typeof dateInput === "number") return dateInput;
  if (dateInput instanceof Date) return dateInput.getTime();

  const raw = String(dateInput).trim();
  if (!raw) return 0;

  const yyyyMmDd = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (yyyyMmDd) {
    const y = parseInt(yyyyMmDd[1], 10);
    const m = parseInt(yyyyMmDd[2], 10);
    const d = parseInt(yyyyMmDd[3], 10);
    return Date.UTC(y, m - 1, d);
  }

  const ddMmYyyy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (ddMmYyyy) {
    const d = parseInt(ddMmYyyy[1], 10);
    const m = parseInt(ddMmYyyy[2], 10);
    const y = parseInt(ddMmYyyy[3], 10);
    return Date.UTC(y, m - 1, d);
  }

  const ddMm = raw.match(/^(\d{1,2})[\/-](\d{1,2})$/);
  if (ddMm) {
    const d = parseInt(ddMm[1], 10);
    const m = parseInt(ddMm[2], 10);
    const seasonStart = extractSeasonStartYear(compName);
    const y = m >= 8 ? seasonStart : seasonStart + 1;
    return Date.UTC(y, m - 1, d);
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function competitionStrengthScore(compName) {
  const n = String(compName || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  const ageBase = /NACIONAL\s*CATALANA/.test(n) ? 90
    : /PRIMERA\s*CATALANA|\b1A?\s*CATALANA/.test(n) ? 85
    : /SEGONA\s*CATALANA|\b2A?\s*CATALANA/.test(n) ? 80
    : /TERCERA\s*CATALANA|\b3A?\s*CATALANA/.test(n) ? 75
    : /JUNIOR/.test(n) ? 60
    : /JUVENIL/.test(n) ? 50
    : /INFANTIL/.test(n) ? 40
    : /ALEVI/.test(n) ? 30
    : /BENJAMI/.test(n) ? 20
    : /PREBENJAMI/.test(n) ? 10
    : /VETERANS/.test(n) ? 45
    : 25;

  const tierBoost = /\bOR\b/.test(n) ? 4
    : /PLATA/.test(n) ? 3
    : /BRONZE|BRONCE/.test(n) ? 2
    : /INICIACIO|INICIACI[OÓ]/.test(n) ? 1
    : 0;

  return ageBase * 10 + tierBoost;
}

function buildEloRatingsFromCompetition(comp) {
  const matches = comp?.calendar || [];
  const ratings = new Map();
  const baseRating = 1500;
  const homeAdv = 55;
  const kFactor = 24;

  const ensure = (teamName) => {
    const key = normalizeTeamName(teamName);
    if (!key) return null;
    if (!ratings.has(key)) ratings.set(key, baseRating);
    return key;
  };

  const played = matches
    .filter(m => m.home && m.away && m.homeScore != null && m.awayScore != null)
    .sort((a, b) => parseMatchTimestamp(a.date, comp?.name || "") - parseMatchTimestamp(b.date, comp?.name || ""));

  for (const m of played) {
    const homeKey = ensure(m.home);
    const awayKey = ensure(m.away);
    if (!homeKey || !awayKey) continue;

    const homeRating = ratings.get(homeKey) || baseRating;
    const awayRating = ratings.get(awayKey) || baseRating;

    const expectedHome = 1 / (1 + Math.pow(10, -((homeRating + homeAdv - awayRating) / 400)));
    const actualHome = m.homeScore > m.awayScore ? 1 : (m.homeScore === m.awayScore ? 0.5 : 0);

    const delta = kFactor * (actualHome - expectedHome);
    ratings.set(homeKey, homeRating + delta);
    ratings.set(awayKey, awayRating - delta);
  }

  return { ratings, baseRating, homeAdv };
}

function poissonOutcomeProbabilities(lambdaA, lambdaB, maxGoals = 12) {
  const la = Math.max(0.05, Number(lambdaA) || 0.05);
  const lb = Math.max(0.05, Number(lambdaB) || 0.05);
  const pA = new Array(maxGoals + 1).fill(0);
  const pB = new Array(maxGoals + 1).fill(0);

  pA[0] = Math.exp(-la);
  pB[0] = Math.exp(-lb);
  for (let i = 1; i <= maxGoals; i++) {
    pA[i] = pA[i - 1] * la / i;
    pB[i] = pB[i - 1] * lb / i;
  }

  let win = 0;
  let draw = 0;
  let loss = 0;
  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = pA[i] * pB[j];
      if (i > j) win += p;
      else if (i === j) draw += p;
      else loss += p;
    }
  }

  const total = win + draw + loss;
  if (total <= 0) return { win: 0.33, draw: 0.34, loss: 0.33 };
  return { win: win / total, draw: draw / total, loss: loss / total };
}

// ── ANÁLISIS DE RIVAL (Admin) ─────────────────────────────────────────
function calculateRivalMetrics(teamName, comp, teamInClassif, actes, allActes, referenceTeamName = "") {
  if (!comp) return null;

  const matches = comp.calendar || [];
  const classif = comp.classification || [];
  const acteData = actes || {};
  const allActesData = allActes || {};

  // Get team row from classification
  let teamRow = teamInClassif;
  if (!teamRow) {
    teamRow = findBestClassifRow(classif, teamName);
  }
  if (!teamRow) return null;

  // Match team name from calendar - use stricter matching to avoid Ripollet B/C confusion
  const calCandidates = [...new Set([...matches.map(m => m.home), ...matches.map(m => m.away)].filter(Boolean))];
  const targetNormStrict = normalizeTeamNameStrict(teamName);
  const rowNormStrict = normalizeTeamNameStrict(teamRow?.team || "");
  
  let calTeamName = calCandidates.find(t => normalizeTeamNameStrict(t) === targetNormStrict)
    || calCandidates.find(t => normalizeTeamNameStrict(t) === rowNormStrict);
  
  if (!calTeamName) {
    const teamSuffix = extractTeamSuffix(teamName);
    const teamBase = getTeamBase(teamName);
    const candidates_withSuffix = calCandidates.filter(c => {
      const cBase = getTeamBase(c);
      const cSuffix = extractTeamSuffix(c);
      return normalizeTeamNameStrict(cBase) === normalizeTeamNameStrict(teamBase) && cSuffix === teamSuffix;
    });
    if (candidates_withSuffix.length === 1) {
      calTeamName = candidates_withSuffix[0];
    } else if (candidates_withSuffix.length > 0) {
      const refClubId = rowClubId(teamRow);
      calTeamName = candidates_withSuffix.find(c => rowClubId({ team: c }) === refClubId) || candidates_withSuffix[0];
    }
  }
  
  if (!calTeamName) {
    calTeamName = calCandidates.find(t => teamMatchesLoose(t, teamName))
      || calCandidates.find(t => teamMatchesLoose(t, teamRow?.team || ""))
      || teamName;
  }

  // Get matches for this team
  const teamMatches = matches.filter(m =>
    (m.homeScore != null && m.awayScore != null) &&
    (normalizeTeamName(m.home) === normalizeTeamName(calTeamName) || normalizeTeamName(m.away) === normalizeTeamName(calTeamName))
  ).sort((a, b) => parseMatchTimestamp(b.date, comp.name) - parseMatchTimestamp(a.date, comp.name));

  const fallbackMatches = [];
  const seenFallback = new Set();
  for (const categoryComps of Object.values(DB.categories || {})) {
    for (const otherComp of (categoryComps || [])) {
      if (!otherComp?.id || String(otherComp.id) === String(comp.id)) continue;
      for (const m of (otherComp.calendar || [])) {
        if (m.homeScore == null || m.awayScore == null) continue;
        const isMine = normalizeTeamName(m.home) === normalizeTeamName(calTeamName)
          || normalizeTeamName(m.away) === normalizeTeamName(calTeamName);
        if (!isMine) continue;
        const key = `${otherComp.id}|${m.home}|${m.away}|${m.date}|${m.homeScore}|${m.awayScore}`;
        if (seenFallback.has(key)) continue;
        seenFallback.add(key);
        fallbackMatches.push({ ...m, _compName: otherComp.name || "" });
      }
    }
  }
  fallbackMatches.sort((a, b) => parseMatchTimestamp(b.date, b._compName) - parseMatchTimestamp(a.date, a._compName));

  // 1. Trend últims 5 partits
  const last5 = teamMatches.slice(0, 5);
  if (last5.length < 5) {
    last5.push(...fallbackMatches.slice(0, 5 - last5.length));
  }
  let trend = { w: 0, d: 0, l: 0 };
  const recentForm = [];
  last5.forEach(m => {
    const isHome = normalizeTeamName(m.home) === normalizeTeamName(calTeamName);
    const myScore = isHome ? m.homeScore : m.awayScore;
    const theirScore = isHome ? m.awayScore : m.homeScore;
    if (myScore > theirScore) {
      trend.w++;
      recentForm.push("W");
    } else if (myScore === theirScore) {
      trend.d++;
      recentForm.push("D");
    } else {
      trend.l++;
      recentForm.push("L");
    }
  });

  // 2. Jugadores per partit (rotació) - from actes
  const playersByMatch = {};
  for (const acta of Object.values(acteData)) {
    if (String(acta.compId) !== String(comp.id)) continue;
    const isHome = normalizeTeamName(acta.home || "") === normalizeTeamName(calTeamName);
    const isAway = normalizeTeamName(acta.away || "") === normalizeTeamName(calTeamName);
    if (!isHome && !isAway) continue;
    const players = isHome ? (acta.playerStats?.homePlayers || []) : (acta.playerStats?.awayPlayers || []);
    playersByMatch[acta.matchDate || acta.date] = players.length;
  }
  const playerCounts = Object.values(playersByMatch);
  const avgPlayersPerMatch = playerCounts.length > 0 ? playerCounts.reduce((a,b) => a+b, 0) / playerCounts.length : 0;

  // 3. Gols promig
  const totalGoals = teamMatches.reduce((sum, m) => {
    const isHome = normalizeTeamName(m.home) === normalizeTeamName(calTeamName);
    return sum + (isHome ? m.homeScore : m.awayScore);
  }, 0);
  const avgGoals = teamMatches.length > 0 ? totalGoals / teamMatches.length : 0;

  // 4. Porteries a zero
  const shutouts = teamMatches.filter(m => {
    const isHome = normalizeTeamName(m.home) === normalizeTeamName(calTeamName);
    return isHome ? m.awayScore === 0 : m.homeScore === 0;
  }).length;

  // 5. Gols a favor y en contra
  const goalsFor = teamRow.gf || 0;
  const goalsAgainst = teamRow.gc || 0;

  // 6. Top golejador - from actes
  const playerStats = {};
  for (const acta of Object.values(acteData)) {
    if (String(acta.compId) !== String(comp.id)) continue;
    const isHome = normalizeTeamName(acta.home || "") === normalizeTeamName(calTeamName);
    const isAway = normalizeTeamName(acta.away || "") === normalizeTeamName(calTeamName);
    if (!isHome && !isAway) continue;
    const players = isHome ? (acta.playerStats?.homePlayers || []) : (acta.playerStats?.awayPlayers || []);
    for (const p of players) {
      if (!p.jugadorId) continue;
      if (!playerStats[p.jugadorId]) {
        playerStats[p.jugadorId] = { name: p.name, goals: 0, matches: 0 };
      }
      playerStats[p.jugadorId].goals += p.g || 0;
      playerStats[p.jugadorId].matches += 1;
    }
  }
  const topScorer = Object.values(playerStats).length > 0
    ? Object.values(playerStats).reduce((a, b) => a.goals > b.goals ? a : b)
    : { name: "—", goals: 0, matches: 0 };

  // 7. Mitjana d'edat - from DB.jugadors
  const agesInTeam = [];
  for (const pid of Object.keys(playerStats)) {
    const player = DB.jugadors?.[pid];
    if (player?.birthDate) {
      const bd = player.birthDate;
      const pts = bd.split(/[\/\-]/);
      const dob = pts[0].length === 4
        ? new Date(`${pts[0]}-${pts[1]}-${pts[2]}`)
        : new Date(`${pts[2]}-${pts[1]}-${pts[0]}`);
      if (!isNaN(dob)) {
        const now = new Date();
        const y = now.getFullYear() - dob.getFullYear();
        const age = y - (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
        if (age > 0 && age < 100) agesInTeam.push(age);
      }
    }
  }
  const avgAge = agesInTeam.length > 0 ? Math.round(agesInTeam.reduce((a,b) => a+b, 0) / agesInTeam.length) : "—";

  // 8. Sancionats, Blaves i Vermelles
  const suspended = [];
  let totalYellowCards = 0;
  let totalRedCards = 0;
  const playerCards = {};

  for (const acta of Object.values(acteData)) {
    if (String(acta.compId) !== String(comp.id)) continue;
    const isHome = normalizeTeamName(acta.home || "") === normalizeTeamName(calTeamName);
    const isAway = normalizeTeamName(acta.away || "") === normalizeTeamName(calTeamName);
    if (!isHome && !isAway) continue;
    const players = isHome ? (acta.playerStats?.homePlayers || []) : (acta.playerStats?.awayPlayers || []);

    let yellowThisMatch = 0, redThisMatch = 0;
    for (const p of players) {
      if (!p.jugadorId) continue;
      if (!playerCards[p.jugadorId]) {
        playerCards[p.jugadorId] = { name: p.name, blaves: 0, vermelles: 0 };
      }
      const yellowCount = p.b || 0;
      const redCount = p.v || 0;
      playerCards[p.jugadorId].blaves += yellowCount;
      playerCards[p.jugadorId].vermelles += redCount;
      totalYellowCards += yellowCount;
      totalRedCards += redCount;
      yellowThisMatch += yellowCount;
      redThisMatch += redCount;
    }
  }

  // Identify suspended players
  for (const [pid, cards] of Object.entries(playerCards)) {
    if (cards.blaves >= 5) {
      suspended.push(`${cards.name} (${cards.blaves} blaves)`);
    }
    if (cards.vermelles > 0) {
      suspended.push(`${cards.name} (vermella)`);
    }
  }

  const totalTeamPlayedMatches = Math.max(1, Number(teamRow.pj || teamMatches.length || 0));
  const avgYellowCards = (totalYellowCards / totalTeamPlayedMatches).toFixed(3);
  const avgRedCards = (totalRedCards / totalTeamPlayedMatches).toFixed(3);

  // 9. Porters
  let goalkeepers = 0;
  for (const pid of Object.keys(playerStats)) {
    const player = DB.jugadors?.[pid];
    if (player?.isGK) goalkeepers++;
  }
  if (goalkeepers === 0) goalkeepers = 1;

  // 10. Probabilitat de victòria (Elo + Poisson)
  let winProbability = last5.length > 0 ? Math.round((trend.w / last5.length) * 100) : 0;
  let probabilityModel = null;
  if (referenceTeamName) {
    const refNorm = normalizeTeamName(referenceTeamName);
    const refRow = classif.find(r => normalizeTeamName(r.team) === refNorm) || null;

    if (refRow) {
      const directUpcoming = matches
        .filter(m => {
          const h = normalizeTeamName(m.home);
          const a = normalizeTeamName(m.away);
          const t = normalizeTeamName(calTeamName);
          return (h === t && a === refNorm) || (a === t && h === refNorm);
        })
        .filter(m => m.homeScore == null || m.awayScore == null)
        .sort((a, b) => parseMatchTimestamp(a.date, comp.name) - parseMatchTimestamp(b.date, comp.name));

      const teamIsHome = directUpcoming.length > 0
        ? normalizeTeamName(directUpcoming[0].home) === normalizeTeamName(calTeamName)
        : null;

      const elo = buildEloRatingsFromCompetition(comp);
      const teamKey = normalizeTeamName(calTeamName);
      const refKey = normalizeTeamName(referenceTeamName);
      const teamRating = elo.ratings.get(teamKey) || elo.baseRating;
      const refRating = elo.ratings.get(refKey) || elo.baseRating;
      const eloDiff = teamRating - refRating + (teamIsHome === null ? 0 : (teamIsHome ? elo.homeAdv : -elo.homeAdv));
      const expectedNoDraw = 1 / (1 + Math.pow(10, -(eloDiff / 400)));
      const pDrawElo = Math.min(0.35, Math.max(0.12, 0.20 + 0.14 * Math.exp(-Math.abs(eloDiff) / 220)));
      const pWinElo = (1 - pDrawElo) * expectedNoDraw;
      const pLossElo = 1 - pWinElo - pDrawElo;

      const leagueRows = classif.filter(r => Number(r.pj || 0) > 0);
      const totalLeagueGf = leagueRows.reduce((acc, r) => acc + Number(r.gf || 0), 0);
      const totalLeaguePj = leagueRows.reduce((acc, r) => acc + Number(r.pj || 0), 0);
      const leagueAvgGoals = totalLeaguePj > 0 ? totalLeagueGf / totalLeaguePj : 1.5;

      const teamGfPg = Number(teamRow.gf || 0) / Math.max(1, Number(teamRow.pj || 1));
      const teamGcPg = Number(teamRow.gc || 0) / Math.max(1, Number(teamRow.pj || 1));
      const refGfPg = Number(refRow.gf || 0) / Math.max(1, Number(refRow.pj || 1));
      const refGcPg = Number(refRow.gc || 0) / Math.max(1, Number(refRow.pj || 1));

      const homeFactor = 1.08;
      const teamHomeAdj = teamIsHome === null ? 1 : (teamIsHome ? homeFactor : 1 / homeFactor);
      const refHomeAdj = teamIsHome === null ? 1 : (teamIsHome ? 1 / homeFactor : homeFactor);

      const atkTeam = Math.max(0.4, teamGfPg / Math.max(0.2, leagueAvgGoals));
      const defTeam = Math.max(0.4, teamGcPg / Math.max(0.2, leagueAvgGoals));
      const atkRef = Math.max(0.4, refGfPg / Math.max(0.2, leagueAvgGoals));
      const defRef = Math.max(0.4, refGcPg / Math.max(0.2, leagueAvgGoals));

      const lambdaTeam = Math.max(0.2, leagueAvgGoals * atkTeam * defRef * teamHomeAdj);
      const lambdaRef = Math.max(0.2, leagueAvgGoals * atkRef * defTeam * refHomeAdj);
      const pPoisson = poissonOutcomeProbabilities(lambdaTeam, lambdaRef, 12);

      const pWinBlend = 0.55 * pWinElo + 0.45 * pPoisson.win;
      const pDrawBlend = 0.55 * pDrawElo + 0.45 * pPoisson.draw;
      const pLossBlend = Math.max(0, 1 - pWinBlend - pDrawBlend);

      winProbability = Math.round(pWinBlend * 100);
      probabilityModel = {
        teamRating: Math.round(teamRating),
        opponentRating: Math.round(refRating),
        lambdaTeam: Number(lambdaTeam.toFixed(2)),
        lambdaOpponent: Number(lambdaRef.toFixed(2)),
        elo: {
          win: Math.round(pWinElo * 100),
          draw: Math.round(pDrawElo * 100),
          loss: Math.round(pLossElo * 100),
        },
        poisson: {
          win: Math.round(pPoisson.win * 100),
          draw: Math.round(pPoisson.draw * 100),
          loss: Math.round(pPoisson.loss * 100),
        },
        blended: {
          win: Math.round(pWinBlend * 100),
          draw: Math.round(pDrawBlend * 100),
          loss: Math.round(pLossBlend * 100),
        },
      };
    }
  }

  // 11. Jugadors que juguen a altres categories (refuerzos)
  const playerInOtherCat = new Set();
  const reinforceOthers = new Set();
  const reinforcedByLower = new Set();
  const alsoFemPlayers = new Set();
  const categoryStageFromCompName = (name) => {
    const n = String(name || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    if (/NACIONAL\s*CATALANA|PRIMERA\s*CATALANA|\b1A?\s*CATALANA|SEGONA\s*CATALANA|\b2A?\s*CATALANA|TERCERA\s*CATALANA|\b3A?\s*CATALANA/.test(n)) return 7;
    if (/JUNIOR/.test(n)) return 6;
    if (/JUVENIL/.test(n)) return 5;
    if (/INFANTIL/.test(n)) return 4;
    if (/ALEVI/.test(n)) return 3;
    if (/BENJAMI/.test(n)) return 2;
    if (/PREBENJAMI/.test(n)) return 1;
    return null;
  };

  const categoryStageFromCatSlug = (cat) => {
    const c = String(cat || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (c === "prebenjami") return 1;
    if (c === "benjami") return 2;
    if (c === "alevi") return 3;
    if (c === "infantil") return 4;
    if (c === "juvenil") return 5;
    if (c === "junior") return 6;
    if (["nacional-catalana", "1a-catalana", "2a-catalana", "3a-catalana", "altres", "veterans"].includes(c)) return 7;
    return null;
  };

  const currentCategoryStage = categoryStageFromCompName(comp?.name || "");

  reinforceOthers.clear();
  reinforcedByLower.clear();
  playerInOtherCat.clear();
  alsoFemPlayers.clear();

  for (const pid of Object.keys(playerStats)) {
    const player = DB?.jugadors?.[pid];
    if (!player) continue;

    let hasUp = false;
    let hasDown = false;
    let hasFem = false;

    for (const ts of (player.teamStats || [])) {
      const cat = String(ts?.cat || "");
      if (!cat) continue;
      const catNorm = cat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (catNorm === "fem") {
        hasFem = true;
        continue;
      }
      const stage = categoryStageFromCatSlug(catNorm);
      if (stage == null || currentCategoryStage == null) continue;
      if (stage > currentCategoryStage) hasUp = true;
      else if (stage < currentCategoryStage) hasDown = true;
    }

    if (hasUp || hasDown || hasFem) playerInOtherCat.add(pid);
    if (hasUp) reinforceOthers.add(pid);
    if (hasDown) reinforcedByLower.add(pid);
    if (hasFem) alsoFemPlayers.add(pid);
  }

  const totalKnownPlayers = Object.keys(playerStats).length;
  const reinforcementRatio = totalKnownPlayers > 0 ? (playerInOtherCat.size / totalKnownPlayers).toFixed(2) : "0.00";
  const reinforcements = playerInOtherCat.size > 0 ? `${playerInOtherCat.size}/${totalKnownPlayers} (${(reinforcementRatio * 100).toFixed(0)}%)` : [];
  const alsoFemNames = [...alsoFemPlayers]
    .map(pid => playerStats[pid]?.name)
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b), "ca"));

  // 12. Millorament vs 1ª ronda
  const improvement = "N/A";

  return {
    teamName: calTeamName,
    trend,
    recentForm,
    recentFormOldToNew: [...recentForm].reverse(),
    avgPlayersPerMatch: Math.round(avgPlayersPerMatch * 10) / 10,
    avgGoals: Math.round(avgGoals * 100) / 100,
    avgGoalsAgainst: teamMatches.length > 0 ? Math.round((goalsAgainst / teamRow.pj) * 100) / 100 : 0,
    shutouts,
    totalMatches: teamMatches.length,
    points: teamRow.pts || 0,
    position: teamRow.pos || "?",
    goalsFor,
    goalsAgainst,
    goalsDiff: goalsFor - goalsAgainst,
    winRate: last5.length > 0 ? Math.round((trend.w / last5.length) * 100) : 0,
    topScorer,
    suspended,
    goalkeepers,
    winProbability,
    reinforcements,
    reinforcesOthersCount: reinforceOthers.size,
    reinforcedByLowerCount: reinforcedByLower.size,
    alsoFemCount: alsoFemPlayers.size,
    alsoFemNames,
    probabilityModel,
    referenceTeamName,
    avgAge,
    improvement,
    totalYellowCards,
    avgYellowCards,
    totalRedCards,
    avgRedCards
  };
}

window.openRivalAnalysis = async function(teamName, compId, referenceTeamName = "") {
  console.log("openRivalAnalysis called with:", { teamName, compId, role: currentProfile?.role });

  const comp = findComp(compId);
  if (!comp) {
    console.error("Competició no trobada:", compId);
    console.log("Competicions disponibles:", Object.values(DB?.categories || {}).flat().map(c => ({ id: c.id, name: c.name })));
    alert("Competició no trobada");
    return;
  }

  if (!comp.classification || comp.classification.length === 0) {
    alert("Aquesta competició no té classificació");
    return;
  }

  let teamInClassif = findBestClassifRow(comp.classification || [], teamName);
  // Pilot safety: recover the best row from calendar aliases when source names differ.
  if (!teamInClassif) {
    const calCandidates = [...new Set([...(comp.calendar || []).map(m => m.home), ...(comp.calendar || []).map(m => m.away)].filter(Boolean))];
    const alias = calCandidates.find(t => normalizeTeamNameStrict(t) === normalizeTeamNameStrict(teamName))
      || calCandidates.find(t => teamMatchesLoose(t, teamName));
    if (alias) teamInClassif = findBestClassifRow(comp.classification || [], alias);
  }

  if (!teamInClassif) {
    console.error("Equip no trobat:", teamName);
    console.log("Equips disponibles:", (comp.classification || []).map(r => r.team));
    alert(`Equip "${teamName}" no trobat en la classificació`);
    return;
  }

  // Load actes for this competition
  const catSlug = getCatSlugForComp(comp);
  const actes = catSlug ? await loadCatActes(catSlug) : {};

  // Ensure reinforcement analysis sees categories where current squad players also appear.
  await preloadReinforcementActes(comp, teamName, teamInClassif, catSlug, actes);

  // Load actes from other categories for reinforcements analysis
  const allActes = { ...actesCache };

  const metrics = calculateRivalMetrics(teamName, comp, teamInClassif, actes, allActes, referenceTeamName);
  console.log("Metrics calculated for", teamName, ":", metrics ? "OK" : "FAILED");
  if (!metrics) {
    alert("No es pot calcular l'anàlisi d'aquest equip");
    return;
  }

  console.log("Showing modal...");
  showRivalModal(metrics, teamName, "Competició actual");
  console.log("Modal shown");
};

function showRivalModal(metrics, teamName, scopeLabel = "") {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  `;

  modal.innerHTML = `
    <div style="background: white; border-radius: 16px; padding: 24px; max-width: 900px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.3)">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px">
        <div>
          <h2 style="margin: 0; font-family: 'Barlow Condensed'; font-size: 24px; font-weight: 900">${teamName}</h2>
          ${scopeLabel ? `<div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:2px">${esc(scopeLabel)}</div>` : ""}
        </div>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 24px; cursor: pointer">&times;</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px">
        <div style="background: #f0f4f8; border-radius: 12px; padding: 16px; text-align: center">
          <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700">Posició</div>
          <div style="font-size: 32px; font-weight: 900; color: #e5001c">${metrics.position}º</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px">${metrics.points} pts</div>
        </div>

        <div style="background: #f0f4f8; border-radius: 12px; padding: 16px; text-align: center">
          <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700">Trend Últim 5</div>
          <div style="font-size: 24px; font-weight: 900; margin: 8px 0">
            <span style="color: #16a34a">${metrics.trend.w}V</span>
            <span style="color: #d97706"> ${metrics.trend.d}E</span>
            <span style="color: #dc2626"> ${metrics.trend.l}L</span>
          </div>
          <div style="display:flex;justify-content:center;gap:6px;margin:6px 0 2px">
            ${(metrics.recentFormOldToNew || metrics.recentForm || []).map(r => `<span title="${r === "W" ? "Victòria" : r === "D" ? "Empat" : "Derrota"}" style="width:10px;height:10px;border-radius:999px;display:inline-block;background:${r === "W" ? "#16a34a" : r === "D" ? "#d97706" : "#dc2626"}"></span>`).join("")}
          </div>
          <div style="font-size: 13px; font-weight: 700; color: ${metrics.winRate >= 60 ? '#e5001c' : metrics.winRate >= 40 ? '#d97706' : '#16a34a'}">${metrics.winRate}% victòries</div>
        </div>

        <div style="background: #f0f4f8; border-radius: 12px; padding: 16px; text-align: center" title="Suma de gols marcats ÷ total de partits jugats">
          <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700">Gols Promig</div>
          <div style="font-size: 32px; font-weight: 900; color: #003da5">${metrics.avgGoals}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px">per partit</div>
        </div>

        <div style="background: #f0f4f8; border-radius: 12px; padding: 16px; text-align: center" title="Gols en contra (GC) ÷ total de partits jugats">
          <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700">Gols Rebuts</div>
          <div style="font-size: 32px; font-weight: 900; color: #dc2626">${metrics.avgGoalsAgainst}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px">per partit</div>
        </div>

        <div style="background: #f0f4f8; border-radius: 12px; padding: 16px; text-align: center" title="Gols a favor − Gols en contra">
          <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700">Diferencial</div>
          <div style="font-size: 32px; font-weight: 900; color: ${metrics.goalsDiff > 0 ? '#16a34a' : '#dc2626'}">${metrics.goalsDiff > 0 ? '+' : ''}${metrics.goalsDiff}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px">${metrics.goalsFor} a favor, ${metrics.goalsAgainst} contra</div>
        </div>

        <div style="background: #f0f4f8; border-radius: 12px; padding: 16px; text-align: center">
          <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700">Porteries a 0</div>
          <div style="font-size: 32px; font-weight: 900; color: #1d4ed8">${metrics.shutouts}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px">últims ${metrics.totalMatches} partits</div>
        </div>

        <div style="background: #f0f4f8; border-radius: 12px; padding: 16px; text-align: center" title="Suma de jugadors en cada acta ÷ total de partits">
          <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700">Media jugadors convocats</div>
          <div style="font-size: 32px; font-weight: 900; color: #7c3aed">${metrics.avgPlayersPerMatch}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px">jugadors</div>
        </div>

        <div style="background: #fef3c7; border-radius: 12px; padding: 16px; text-align: center">
          <div style="font-size: 12px; color: #92400e; text-transform: uppercase; font-weight: 700">⚽ Màxim Golejador</div>
          <div style="font-size: 20px; font-weight: 900; color: #b45309">${metrics.topScorer.name}</div>
          <div style="font-size: 13px; color: #92400e; margin-top: 4px">${metrics.topScorer.goals} gols (${metrics.topScorer.matches} partits)</div>
        </div>

        <div style="background: #dbeafe; border-radius: 12px; padding: 16px; text-align: center">
          <div style="font-size: 12px; color: #0c4a6e; text-transform: uppercase; font-weight: 700">🧤 Porters</div>
          <div style="font-size: 32px; font-weight: 900; color: #0284c7">${metrics.goalkeepers}</div>
          <div style="font-size: 11px; color: #0c4a6e; margin-top: 4px">porteries</div>
        </div>

        <div style="background: #f3e8ff; border-radius: 12px; padding: 16px; text-align: center" title="Suma d'edats dels jugadors ÷ total de jugadors">
          <div style="font-size: 12px; color: #5b21b6; text-transform: uppercase; font-weight: 700">📊 Mitjana Edat</div>
          <div style="font-size: 32px; font-weight: 900; color: #a855f7">${metrics.avgAge}</div>
          <div style="font-size: 11px; color: #5b21b6; margin-top: 4px">anys</div>
        </div>

        <div style="background: #fecaca; border-radius: 12px; padding: 16px; text-align: center" title="Model híbrid: Elo (amb empat i avantatge camp) + Poisson de gols">
          <div style="font-size: 12px; color: #7f1d1d; text-transform: uppercase; font-weight: 700">📈 Probabilitat Victòria</div>
          <div style="font-size: 32px; font-weight: 900; color: #dc2626">${metrics.winProbability}%</div>
          <div style="font-size: 11px; color: #7f1d1d; margin-top: 4px">${metrics.probabilityModel ? `Híbrid W/D/L: ${metrics.probabilityModel.blended.win}% / ${metrics.probabilityModel.blended.draw}% / ${metrics.probabilityModel.blended.loss}%` : "Sense dades per model Elo+Poisson"}</div>
          ${metrics.probabilityModel ? `<div style="font-size:10px;color:#7f1d1d;margin-top:6px;line-height:1.35">Elo ${metrics.probabilityModel.elo.win}/${metrics.probabilityModel.elo.draw}/${metrics.probabilityModel.elo.loss} · Poisson ${metrics.probabilityModel.poisson.win}/${metrics.probabilityModel.poisson.draw}/${metrics.probabilityModel.poisson.loss}<br/>xG ${metrics.probabilityModel.lambdaTeam} - ${metrics.probabilityModel.lambdaOpponent} · Rating ${metrics.probabilityModel.teamRating} vs ${metrics.probabilityModel.opponentRating}</div>` : ""}
        </div>

        ${metrics.suspended && metrics.suspended.length > 0 ? `
        <div style="background: #fee2e2; border-radius: 12px; padding: 16px; grid-column: span 1" title="Blaves: suma de totes les blaves ÷ partits amb blaves. Vermelles: suma de totes les vermelles ÷ partits amb vermelles">
          <div style="font-size: 12px; color: #991b1b; text-transform: uppercase; font-weight: 700">⚠️ Targetes</div>
          <div style="font-size: 13px; color: #7f1d1d; margin-top: 8px; line-height: 1.4">
            ${metrics.suspended.map(p => `<div>• ${p}</div>`).join('')}
          </div>
          <div style="font-size: 10px; color: #991b1b; margin-top: 8px; padding-top: 8px; border-top: 1px solid #fca5a5">
            <div>🟦 Blaves: ${metrics.totalYellowCards} total (${metrics.avgYellowCards}/partit)</div>
            <div>🟥 Vermelles: ${metrics.totalRedCards} total (${metrics.avgRedCards}/partit)</div>
          </div>
        </div>
        ` : `
        <div style="background: #dcfce7; border-radius: 12px; padding: 16px; text-align: center" title="Blaves: suma de totes les blaves ÷ partits amb blaves. Vermelles: suma de totes les vermelles ÷ partits amb vermelles">
          <div style="font-size: 12px; color: #166534; text-transform: uppercase; font-weight: 700">✓ Targetes</div>
          <div style="font-size: 13px; font-weight: 700; color: #16a34a; margin-top: 8px">Controlades</div>
          <div style="font-size: 10px; color: #166534; margin-top: 8px; padding-top: 8px; border-top: 1px solid #bbf7d0">
            <div>🟦 Blaves: ${metrics.totalYellowCards} total (${metrics.avgYellowCards}/partit)</div>
            <div>🟥 Vermelles: ${metrics.totalRedCards} total (${metrics.avgRedCards}/partit)</div>
          </div>
        </div>
        `}

        ${(metrics.reinforcesOthersCount > 0 || metrics.reinforcedByLowerCount > 0 || (metrics.alsoFemCount || 0) > 0) ? `
        <div style="background: #e0e7ff; border-radius: 12px; padding: 16px; text-align: center" title="Jugadors que jugan en altres categories / total de jugadors * 100">
          <div style="font-size: 12px; color: #3730a3; text-transform: uppercase; font-weight: 700">🆙 Reforços</div>
          <div style="font-size: 20px; color: #3730a3; margin-top: 8px; line-height: 1.4; font-weight: 700">
            <div>Reforça altres: ${metrics.reinforcesOthersCount}</div>
            <div>És reforçat: ${metrics.reinforcedByLowerCount}</div>
            <div>També al FEM: ${metrics.alsoFemCount || 0}</div>
          </div>
          ${(metrics.alsoFemNames || []).length ? `<div style="font-size:11px;color:#3730a3;margin-top:6px;line-height:1.35">${(metrics.alsoFemNames || []).map(n => esc(n)).join(", ")}</div>` : ""}
          <div style="font-size: 10px; color: #3730a3; margin-top: 4px">moviments entre categories</div>
        </div>
        ` : `
        <div style="background: #f3f4f6; border-radius: 12px; padding: 16px; text-align: center" title="Jugadors que jugan en altres categories / total de jugadors * 100">
          <div style="font-size: 12px; color: #4b5563; text-transform: uppercase; font-weight: 700">🆙 Reforços</div>
          <div style="font-size: 13px; font-weight: 700; color: #6b7280; margin-top: 8px">Mateixa plantilla</div>
        </div>
        `}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

init();
