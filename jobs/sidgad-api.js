// ─────────────────────────────────────────────────────────────
// Accés a l'API JSON de sidgad (api.sidgad.com/fecapa/v1/hp/...)
//
// El novembre de 2026 la FECAPA va estrenar un portal nou a
// https://www.hoqueipatins.fecapa.cat/ que ja no té el llistat antic
// (.listado_competiciones_fila, .select_temporada, #temp_activa) ni els
// handlers jQuery que carregaven calendaris, classificacions i actes.
// Ara el portal demana les dades a una API JSON protegida amb un token de
// sessió (sg_token.php). La manera més robusta de fer-la servir és des de
// dins de la mateixa pàgina, amb la funció global `sidgadFetch(recurs, params)`
// del portal, que ja gestiona el token.
//
// Recursos coneguts: seasons, leagues, calendar{id}, standing{id},
// report{id}, profile{id,s}, stats{id}, scorer, pistas, designaciones{id}.
// ─────────────────────────────────────────────────────────────

const PORTAL_URL = "https://www.hoqueipatins.fecapa.cat/";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

class SidgadNoFileError extends Error {
  constructor(resource, params) {
    super(`SIDGAD API: NO FILE (${resource} ${JSON.stringify(params || {})})`);
    this.name = "SidgadNoFileError";
  }
}

// Obre el portal i espera que la funció global sidgadFetch estigui disponible.
async function openSidgadApiPage(browser, { timeoutMs = 60000 } = {}) {
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForFunction(() => typeof window.sidgadFetch === "function", { timeout: 30000 });
  return page;
}

// Crida un recurs de l'API des de dins de la pàgina.
// Retorna el JSON; llença SidgadNoFileError si l'API respon "NO FILE".
async function sidgadApi(page, resource, params = {}, { retries = 2 } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await page.evaluate(async (r, p) => {
      try {
        return { ok: true, data: await window.sidgadFetch(r, p) };
      } catch (e) {
        return { ok: false, error: String((e && e.message) || e), status: String((e && e.status) || "") };
      }
    }, resource, params);

    if (res.ok) return res.data;
    if (/NO FILE/i.test(res.error) || /NO FILE/i.test(res.status)) {
      throw new SidgadNoFileError(resource, params);
    }
    lastErr = new Error(`sidgad API ${resource} ${JSON.stringify(params)}: ${res.error}`);
    // INVALID TOKEN o errors de xarxa: força un token nou i torna-ho a provar.
    await page.evaluate(() => {
      try { sessionStorage.removeItem("sg_tok"); } catch (e) {}
      try { if (typeof window.sidgadPedirPermiso === "function") return window.sidgadPedirPermiso(); } catch (e) {}
      return null;
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw lastErr;
}

// Com sidgadApi, però retorna null quan el recurs no existeix (NO FILE).
async function sidgadApiOrNull(page, resource, params = {}) {
  try {
    return await sidgadApi(page, resource, params);
  } catch (err) {
    if (err instanceof SidgadNoFileError) return null;
    throw err;
  }
}

function seasonStartYear(label) {
  const m = String(label || "").match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

// "2026-27" → id de temporada del portal (p.ex. "41").
async function resolveSeasonId(page, seasonLabel) {
  const data = await sidgadApi(page, "seasons", {});
  const temps = Array.isArray(data?.temps) ? data.temps : [];
  const wanted = seasonStartYear(seasonLabel);
  const hit = temps.find(t => seasonStartYear(t?.nombre_temp) === wanted);
  if (!hit) {
    const available = temps.map(t => t?.nombre_temp).filter(Boolean).join(", ") || "cap";
    throw new Error(`FECAPA API has no season ${seasonLabel} (available: ${available})`);
  }
  return String(hit.id_temp);
}

// Llista de competicions (idcs) d'una temporada.
async function listLeagues(page, seasonId) {
  const data = await sidgadApi(page, "leagues", {});
  const idcs = Array.isArray(data?.idcs) ? data.idcs : [];
  return idcs
    .filter(l => String(l?.id_temp || "") === String(seasonId))
    .map(l => ({
      id: String(l.idc),
      name: cleanText(l.nombre_idc),
      zoneId: l.id_zone != null ? String(l.id_zone) : null,
      zoneName: cleanText(l.zone_name),
      categoryName: cleanText(l.nombre_categoria),
      sexName: cleanText(l.nombre_sexo),
      grouped: l.agrupada === true || l.agrupada === "true" || l.agrupada === 1,
      buttons: String(l.botones_liga || "").split(",").map(s => s.trim()).filter(Boolean),
      teamIds: String(l.ids_teams || "").split(",").map(s => s.trim()).filter(Boolean),
      raw: l,
    }));
}

function cleanText(s) {
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim();
}

function toIntOrNull(v) {
  const s = String(v == null ? "" : v).trim();
  return /^-?\d+$/.test(s) ? parseInt(s, 10) : null;
}

function isPlaceholder(v) {
  const s = cleanText(v);
  return !s || s === "--" || s === "_";
}

// Converteix la resposta de `calendar` en fases amb partits.
// Files especials: dia_partido === "FASE" (hora_partido = idc del subgrup,
// home_name = nom de la fase) i dia_partido === "JORNADA" (home_name = "JORNADA N").
function parseCalendarGames(data, competitionId) {
  const games = Array.isArray(data?.games) ? data.games : [];
  const phases = [];
  let current = null;
  let jornada = null;

  const ensurePhase = () => {
    if (!current) {
      current = { idc: String(competitionId), name: null, matches: [] };
      phases.push(current);
    }
    return current;
  };

  for (const g of games) {
    const day = cleanText(g?.dia_partido).toUpperCase();
    if (day === "FASE") {
      current = {
        idc: isPlaceholder(g.hora_partido) ? String(competitionId) : cleanText(g.hora_partido),
        name: cleanText(g.home_name) || null,
        matches: [],
      };
      phases.push(current);
      jornada = null;
      continue;
    }
    if (day === "JORNADA") {
      const m = cleanText(g.home_name).match(/(\d{1,3})/);
      jornada = m ? parseInt(m[1], 10) : null;
      continue;
    }

    const idp = cleanText(g?.idp);
    const home = cleanText(g?.home_name);
    const away = cleanText(g?.away_name);
    if (!home || !away || isPlaceholder(home) || isPlaceholder(away)) continue;

    const dateM = cleanText(g.dia_partido).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const timeM = cleanText(g.hora_partido).match(/^(\d{1,2}):(\d{2})$/);
    const scoreM = cleanText(g.result).match(/^(\d{1,3})\s*[:\-]\s*(\d{1,3})$/);

    ensurePhase().matches.push({
      idp: idp && idp !== "0" ? idp : null,
      jornada,
      home,
      homeId: isPlaceholder(g.home_id) ? null : cleanText(g.home_id),
      homeClubId: isPlaceholder(g.home_club_id) ? null : cleanText(g.home_club_id),
      away,
      awayId: isPlaceholder(g.away_id) ? null : cleanText(g.away_id),
      awayClubId: isPlaceholder(g.away_club_id) ? null : cleanText(g.away_club_id),
      day: dateM ? dateM[1].padStart(2, "0") : null,
      month: dateM ? dateM[2].padStart(2, "0") : null,
      year: dateM ? dateM[3] : null,
      time: timeM ? `${timeM[1].padStart(2, "0")}:${timeM[2]}` : null,
      homeScore: scoreM ? parseInt(scoreM[1], 10) : null,
      awayScore: scoreM ? parseInt(scoreM[2], 10) : null,
      played: !!scoreM,
      venue: isPlaceholder(g.pista) ? null : cleanText(g.pista),
    });
  }

  return phases.filter(p => p.matches.length > 0 || p.name);
}

// Converteix la resposta de `standing` en grups amb files.
// En competicions agrupades hi ha files separadores amb team_short === "GENERAL"
// (team_name = nom del grup, team_logo = idc del subgrup).
function parseStanding(data, competitionId) {
  const rows = Array.isArray(data?.standings?.standing) ? data.standings.standing : [];
  const groups = [];
  let current = null;

  for (const r of rows) {
    const isSeparator = String(r?.team_id || "") === "0"
      && cleanText(r?.team_short).toUpperCase() === "GENERAL";
    if (isSeparator) {
      const logo = cleanText(r.team_logo);
      current = {
        idc: /^\d+$/.test(logo) ? logo : String(competitionId),
        name: cleanText(r.team_name) || null,
        rows: [],
      };
      groups.push(current);
      continue;
    }
    if (!cleanText(r?.team_name)) continue;
    if (!current) {
      current = { idc: String(competitionId), name: null, rows: [] };
      groups.push(current);
    }
    const gf = toIntOrNull(r.gf);
    const ga = toIntOrNull(r.ga);
    current.rows.push({
      position: toIntOrNull(r.order) ?? current.rows.length + 1,
      teamId: isPlaceholder(r.team_id) ? null : cleanText(r.team_id),
      clubId: isPlaceholder(r.club_id) ? null : cleanText(r.club_id),
      teamName: cleanText(r.team_name),
      teamShort: cleanText(r.team_short) || null,
      logoSrc: /^https?:\/\//.test(cleanText(r.team_logo)) ? cleanText(r.team_logo) : null,
      points: toIntOrNull(r.points),
      played: toIntOrNull(r.played),
      won: toIntOrNull(r.win),
      drawn: toIntOrNull(r.tie),
      lost: toIntOrNull(r.lost),
      goalsFor: gf,
      goalsAgainst: ga,
      goalDiff: toIntOrNull(r.gavg) ?? (gf != null && ga != null ? gf - ga : null),
      penalties: toIntOrNull(r.penalti),
    });
  }

  return groups.filter(g => g.rows.length > 0);
}

// Jugadors d'una acta (`report`).
function parseReportPlayers(data) {
  const gd = data?.game_data || {};
  const out = [];
  const add = (roster, teamName, teamShort) => {
    for (const p of Array.isArray(roster) ? roster : []) {
      const id = cleanText(p?.player_id);
      if (!/^\d+$/.test(id) || id === "0") continue;
      out.push({
        id_player: id,
        // L'API retorna "COGNOMS,NOM"; el format antic era "COGNOMS NOM".
        player_name: cleanText(String(p.player_name || "").replace(/,/g, " ")),
        isGK: cleanText(p.player_role).toUpperCase() === "P",
        registeredTeam: cleanText(p.player_categ) || null,
        teamName: cleanText(teamName) || null,
        teamShort: cleanText(teamShort) || null,
      });
    }
  };
  add(gd.home_roster, gd.home_team_name, gd.home_team_shortName);
  add(gd.away_roster, gd.away_team_name, gd.away_team_shortName);
  return out;
}

module.exports = {
  PORTAL_URL,
  SidgadNoFileError,
  openSidgadApiPage,
  sidgadApi,
  sidgadApiOrNull,
  resolveSeasonId,
  listLeagues,
  parseCalendarGames,
  parseStanding,
  parseReportPlayers,
  cleanText,
};
