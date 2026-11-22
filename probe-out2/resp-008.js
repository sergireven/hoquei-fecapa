/*
 * Común a las actas de HL y HP. Se carga como script normal (no módulo): los módulos desde otro
 * dominio (la carpeta compartida de server2) necesitan cabeceras CORS que el servidor no envía.
 * Todo va en su propio ámbito y se publica en window.SidgadActaComun lo que usan las actas.
 */
(function () {
'use strict';


// Apellidos y nombre de "APELLIDOS,NOMBRE", ya escapados: todos sus usos van a HTML.
function splitSidgadName(fullName = "") {
  const parts = String(fullName ?? "").split(",");
  return {
    last: escaparHtml((parts[0] || "").trim()),
    first: escaparHtml((parts[1] || "").trim()),
  };
}

function renderSidgadShootout(matchData) {
  if (!matchData.shootout || matchData.shootout.length === 0) {
    return "";
  }

  const rounds = {};
  matchData.shootout.forEach(shot => {
    if (!rounds[shot.round]) rounds[shot.round] = { home: null, away: null };
    if (shot.team_id === matchData.home_team_id) rounds[shot.round].home = shot;
    else rounds[shot.round].away = shot;
  });

  let soHtml = `
    <div class="sidgad-team-roster-header">${sidgadT('LANZAMIENTOS DE PENALTIES')}</div>
    <table class="sidgad-shootout-table">
      <thead>
        <tr>
          <th colspan="3" class="sidgad-left">${escaparHtml(String(matchData.home_team_name || "").toUpperCase())}</th>
          <th colspan="3" class="sidgad-right">${escaparHtml(String(matchData.away_team_name || "").toUpperCase())}</th>
        </tr>
      </thead>
      <tbody>
  `;

  Object.keys(rounds).sort((a, b) => a - b).forEach(roundNum => {
    const homeShot = rounds[roundNum].home;
    const awayShot = rounds[roundNum].away;

    let hNum = "", hName = "", hStatus = "";
    if (homeShot) {
      const parts = splitSidgadName(homeShot.player_name || "");
      const statusClass = homeShot.goal === "true" ? "sidgad-so-true" : (homeShot.goal === "false" ? "sidgad-so-false" : "sidgad-so-waiting");
      hNum = `<span class="sidgad-so-num">${homeShot.player_number}</span>`;
      hName = `<div class="sidgad-so-player"><span class="sidgad-so-last">${parts.last}</span><span class="sidgad-so-first">${parts.first}</span></div>`;
      hStatus = `<div class="sidgad-so-status ${statusClass}"></div>`;
    }

    let aNum = "", aName = "", aStatus = "";
    if (awayShot) {
      const parts = splitSidgadName(awayShot.player_name || "");
      const statusClass = awayShot.goal === "true" ? "sidgad-so-true" : (awayShot.goal === "false" ? "sidgad-so-false" : "sidgad-so-waiting");
      aStatus = `<div class="sidgad-so-status ${statusClass}"></div>`;
      aName = `<div class="sidgad-so-player"><span class="sidgad-so-last">${parts.last}</span><span class="sidgad-so-first">${parts.first}</span></div>`;
      aNum = `<span class="sidgad-so-num">${awayShot.player_number}</span>`;
    }

    soHtml += `
      <tr>
        <td class="sidgad-td-num-left">${hNum}</td>
        <td class="sidgad-td-name-left">${hName}</td>
        <td class="sidgad-td-status-left">${hStatus}</td>
        <td class="sidgad-td-status-right">${aStatus}</td>
        <td class="sidgad-td-name-right">${aName}</td>
        <td class="sidgad-td-num-right">${aNum}</td>
      </tr>
    `;
  });

  return `${soHtml}</tbody></table>`;
}

function renderSidgadStatRow(label, homeVal, awayVal, suffix = "", formato = null) {
  const h = parseFloat(homeVal) || 0;
  const a = parseFloat(awayVal) || 0;
  const total = h + a;
  const hPct = total === 0 ? 0 : (h / total) * 100;
  const aPct = total === 0 ? 0 : (a / total) * 100;
  const bgColor = total === 0 ? "#e4e4e4" : "#ffffff";
  const displayStyle = total === 0 ? "display: none;" : "";

  return `
    <div class="sidgad-stat-row">
      <div class="sidgad-stat-labels"><span class="sidgad-stat-val">${formato ? formato(homeVal) : homeVal}${suffix}</span><span class="sidgad-stat-name">${sidgadT(label)}</span><span class="sidgad-stat-val sidgad-right">${formato ? formato(awayVal) : awayVal}${suffix}</span></div>
      <div class="sidgad-stat-bar-bg" style="background-color: ${bgColor};">
        <div class="sidgad-stat-bar-home" style="--target-width: ${hPct}%; ${displayStyle}"></div>
        <div class="sidgad-stat-bar-away" style="--target-width: ${aPct}%; ${displayStyle}"></div>
      </div>
    </div>
  `;
}

function setSidgadShootoutContent(matchData) {
  const soDesktop = document.getElementById("sidgad-shootout-desktop");
  const soMobile = document.getElementById("sidgad-shootout-mobile");
  const soHtml = renderSidgadShootout(matchData);

  if (soHtml) {
    soDesktop.innerHTML = soHtml;
    soMobile.innerHTML = soHtml;
    soDesktop.classList.add("sidgad-has-data");
    soMobile.classList.add("sidgad-has-data");
    return;
  }

  soDesktop.innerHTML = "";
  soMobile.innerHTML = "";
  soDesktop.classList.remove("sidgad-has-data");
  soMobile.classList.remove("sidgad-has-data");
}

// Acta de un partido que aún no ha empezado (tras la revisión prepartido): period 0 y sin marcador.
function sidgadActaSinEmpezar(matchData) {
  return String(matchData.period ?? "0") === "0" && matchData.game_completed !== "true";
}

// Bonus del partido ({ home, away }) o null. /report/ no trae la liga: se busca en la URL, en la
// liga de alguno de los dos equipos y, si no, en el marcador.
async function sidgadActaBonus(matchData) {
  const id = String(matchData.game_id);
  const equipos = [matchData.home_team_id, matchData.away_team_id].map(String);
  const ligas = [sidgadLeerEstado().liga,
    ...(typeof sidgadNavLigas !== "undefined" ? sidgadNavLigas : [])
      .filter(l => String(l.ids_teams || "").split(",").some(t => equipos.includes(t)))
      .map(l => l.idc)].filter(Boolean);
  for (const liga of [...new Set(ligas.map(String))]) {
    const bonus = (await sidgadBonusLiga(liga)).get(id);
    if (bonus) return bonus;
  }
  try {
    const p = (await sidgadFetch("scorer", {}, { cache: true }) || []).find(x => String(x.game_id) === id);
    if (p) return { home: p.home_bonus === "true", away: p.away_bonus === "true" };
  } catch {}
  return null;
}

function setSidgadCommonHeader(matchData) {
  const sinEmpezar = sidgadActaSinEmpezar(matchData);
  document.getElementById("sidgad-modal-league-name").innerText = `${matchData.tournament_name} - ${sidgadTApi(matchData.game_info)}`;
  document.getElementById("sidgad-modal-date").innerText = `${matchData.game_date} - ${matchData.game_hour}`;
  document.getElementById("sidgad-modal-venue").innerHTML = sidgadEnlacePista(matchData.venue_info, escaparHtml(matchData.venue_info || ""));

  // Nombre y escudo de cada equipo llevan a su ficha. Fuera de una liga (acta abierta desde En
  // directo), la liga del partido sale del marcador.
  const pintarEquipos = ligaId => [["home", matchData.home_team_id, matchData.home_team_name, matchData.home_logo],
   ["away", matchData.away_team_id, matchData.away_team_name, matchData.away_logo]].forEach(([lado, id, nombre, logo]) => {
    const texto = escaparHtml(nombre || "");
    const enlace = sidgadEnlaceEquipo(id, texto, ligaId);
    const logoEl = document.getElementById(`sidgad-modal-${lado}-logo`);
    logoEl.src = logo || SIDGAD_DEFAULT_LOGO;
    logoEl.classList.toggle("sidgad-modal-logo-enlace", enlace !== texto);
    logoEl.onclick = enlace !== texto ? () => sidgadAbrirEquipo(id, ligaId) : null;
    document.getElementById(`sidgad-modal-${lado}-name`).innerHTML = enlace;
  });
  pintarEquipos(null);
  if (!sidgadLeerEstado().liga && SIDGAD_SETTINGS.has_team_page !== false) {
    sidgadFetch("scorer", {}, { cache: true }).then(marcador => {
      const p = (Array.isArray(marcador) ? marcador : []).find(x => String(x.game_id) === String(matchData.game_id));
      if (p?.league_id && sidgadLeerEstado().partido === String(matchData.game_id)) pintarEquipos(p.league_id);
    }).catch(() => {});
  }
  const marcadorEl = document.getElementById("sidgad-modal-score-text");
  const pintarMarcador = (bonus = {}) => {
    const b = lado => bonus[lado] ? `<span class="sidgad-modal-bonus sidgad-modal-bonus-${lado}" title="${sidgadT("Puntos de bonus")}">B</span>` : "";
    marcadorEl.innerHTML = sinEmpezar
      ? escaparHtml(sidgadT("VS"))
      : `${b("home")}${escaparHtml(matchData.home_team_score ?? 0)} - ${escaparHtml(matchData.away_team_score ?? 0)}${b("away")}`;
  };
  pintarMarcador();
  if (matchData.game_completed === "true") {
    sidgadActaBonus(matchData).then(bonus => {
      if (bonus && sidgadLeerEstado().partido === String(matchData.game_id)) pintarMarcador(bonus);
    });
  }
  document.getElementById("sidgad-modal-refs").innerHTML = [matchData.ref_name1, matchData.ref_name2].map(sidgadNombrePersona).filter(Boolean).map(r => `<p>${escaparHtml(r)}</p>`).join("");

  const homeFaultsEl = document.getElementById("sidgad-hp-home-faults");
  const awayFaultsEl = document.getElementById("sidgad-hp-away-faults");
  if (homeFaultsEl) homeFaultsEl.innerText = matchData.home_team_penals || 0;
  if (awayFaultsEl) awayFaultsEl.innerText = matchData.away_team_penals || 0;

  // Pestaña Vídeo: sólo si el partido tiene vídeo (y está activa en config.php). El reproductor se
  // carga al abrirla.
  const video = document.getElementById("sidgad-ficha-video");
  const botonVideo = document.querySelector('.sidgad-modal-tab-btn[data-target="sidgad-ficha-video"]');
  if (video && botonVideo) {
    const url = SIDGAD_SETTINGS.has_acta_video === false ? "" : String(matchData.url_video || "").trim();
    botonVideo.classList.toggle("sidgad-tab-oculta", !url);
    const enlace = url && sidgadVideoUrl(url, matchData.tipo_video, { embed: true }) === sidgadVideoUrl(url, matchData.tipo_video);
    botonVideo.querySelector("i")?.setAttribute("class", enlace ? "fa-solid fa-up-right-from-square" : "fa-solid fa-play");
    if (video.dataset.url !== url || video.dataset.tipo !== String(matchData.tipo_video || "")) {
      video.dataset.url = url;
      video.dataset.tipo = String(matchData.tipo_video || "");
      video.innerHTML = "";
      if (!url && document.querySelector(".sidgad-match-modal-body")?.classList.contains("sidgad-ver-video")) {
        document.querySelector('.sidgad-modal-tab-btn[data-target="sidgad-ficha-alineaciones"]')?.click();
      }
    }
  }

  const statusEl = document.getElementById("sidgad-modal-status-text");
  statusEl.innerText = matchData.period_name ? sidgadTApi(matchData.period_name) : (sinEmpezar ? sidgadT("Sin comenzar") : "");
  statusEl.style.backgroundColor = matchData.period > "0" && matchData.game_completed !== "true" ? "#cc0000" : "#000";

  // Reloj en directo (game_time) mientras se juega un periodo o una prórroga; se actualiza con
  // cada refresco del acta.
  let relojEl = document.getElementById("sidgad-modal-clock");
  if (!relojEl) {
    relojEl = document.createElement("div");
    relojEl.id = "sidgad-modal-clock";
    relojEl.className = "sidgad-modal-clock";
    statusEl.insertAdjacentElement("afterend", relojEl);
  }
  const reloj = String(matchData.game_time || "").trim();
  const enJuego = matchData.game_completed !== "true" && ["1", "2", "3", "4"].includes(String(matchData.period ?? "").trim());
  relojEl.hidden = !(enJuego && reloj);
  relojEl.innerHTML = relojEl.hidden ? "" : `<i class="fa-regular fa-clock" aria-hidden="true"></i> ${escaparHtml(reloj)}`;
  relojEl.title = sidgadT("Tiempo de juego");

  document.getElementById("sidgad-roster-home-name").innerText = matchData.home_team_name;
  document.getElementById("sidgad-roster-away-name").innerText = matchData.away_team_name;
}

// Pestañas del acta. "Acta Partido" sustituye a todo el contenido (en escritorio, alineaciones e
// incidencias se ven a la vez y no tienen pestaña propia); el resto alterna secciones en móvil.
// Vídeo del partido: se incrusta si su web lo permite (YouTube, Vimeo, Dailymotion).
function sidgadActaVideoIncrustable(seccion) {
  const { url, tipo } = seccion?.dataset || {};
  return !!url && sidgadVideoUrl(url, tipo, { embed: true }) !== sidgadVideoUrl(url, tipo);
}

function sidgadActaPintarVideo(seccion) {
  if (!seccion || seccion.firstElementChild) return;
  const { url, tipo } = seccion.dataset;
  seccion.innerHTML = `<div class="sidgad-acta-video-marco"><iframe src="${escaparHtml(sidgadVideoUrl(url, tipo, { embed: true }))}" title="${escaparHtml(sidgadT('Vídeo del partido'))}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
}

function initSidgadTabs() {
  // Pestaña y sección del vídeo, comunes a HL y HP; se muestran si el partido tiene vídeo.
  const pestanas = document.querySelector(".sidgad-modal-tabs");
  const cuerpo = document.querySelector(".sidgad-match-modal-body");
  if (pestanas && cuerpo && !document.getElementById("sidgad-ficha-video")) {
    pestanas.insertAdjacentHTML("beforeend", `<button class="sidgad-modal-tab-btn btn-web btn-mobile sidgad-tab-oculta" data-target="sidgad-ficha-video"><i class="fa-solid fa-play"></i> ${sidgadT('Vídeo')}</button>`);
    cuerpo.insertAdjacentHTML("beforeend", '<div id="sidgad-ficha-video" class="sidgad-modal-video"></div>');
  }

  const tabButtons = document.querySelectorAll(".sidgad-modal-tab-btn");
  const sections = document.querySelectorAll(".sidgad-modal-seccion");
  sidgadMarcarPestanas(pestanas, tabButtons);

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      // Un vídeo que no se puede incrustar (enlace a otra web) se abre directamente en otra pestaña.
      const seccionVideo = document.getElementById("sidgad-ficha-video");
      if (btn.dataset.target === "sidgad-ficha-video" && !sidgadActaVideoIncrustable(seccionVideo)) {
        if (seccionVideo?.dataset.url) window.open(sidgadVideoUrl(seccionVideo.dataset.url, seccionVideo.dataset.tipo), "_blank", "noopener");
        return;
      }
      tabButtons.forEach(button => { button.classList.remove("sidgad-activo"); button.setAttribute("aria-selected", "false"); });
      btn.classList.add("sidgad-activo");
      btn.setAttribute("aria-selected", "true");
      const verActa = btn.dataset.target === "sidgad-ficha-acta";
      const verVideo = btn.dataset.target === "sidgad-ficha-video";
      cuerpo?.classList.toggle("sidgad-ver-acta", verActa);
      cuerpo?.classList.toggle("sidgad-ver-video", verVideo);
      // El vídeo sólo suena en su pestaña: al salir se quita el reproductor.
      if (verVideo) sidgadActaPintarVideo(seccionVideo);
      else if (seccionVideo) seccionVideo.innerHTML = "";
      if (verActa || verVideo) return;
      sections.forEach(section => section.classList.remove("sidgad-activo"));
      document.getElementById(btn.dataset.target)?.classList.add("sidgad-activo");
    });
  });
}

/* ===== Acta oficial (pestaña "Acta Partido") =====
 * Reproduce la hoja oficial de la federación (RFEP por defecto) de cada modalidad, en blanco y negro. Lo que la API no
 * envía (licencias, categoría, power plays...) queda como celda vacía en
 * su sitio, igual que en el formulario. No se incluyen protestos, observaciones ni firmas.
 */

// Federación de la hoja ('acta' en config.php); sin configurar, la RFEP.
const SIDGAD_ACTA_FEDERACION = {
  nombre: "REAL FEDERACIÓN ESPAÑOLA DE PATINAJE",
  siglas: "RFEP",
  logo: "https://fep.es/img/logo-rfep.png",
  ...(typeof SIDGAD_ACTA_CONFIG === "object" && SIDGAD_ACTA_CONFIG ? SIDGAD_ACTA_CONFIG : {}),
};

const e = v => escaparHtml(v ?? "");
// La hoja oficial va en el idioma oficial del acta (idioma_acta en config.php), no en el de la web.
const ta = (texto, vars = null) => sidgadTEn(SIDGAD_LENGUA_ACTA, texto, vars);
const vacio = (n, clase = "") => Array.from({ length: n }, () => `<td class="${clase}"></td>`).join("");
const celda = v => (v === null || v === undefined || v === "" || v === 0 || v === "0" || v === false ? "" : e(v));

function sidgadActaLogo() {
  const { logo, siglas } = SIDGAD_ACTA_FEDERACION;
  return logo ? `<img src="${e(logo)}" alt="${e(siglas)}">` : `<span class="sidgad-acta-logo-texto">${e(siglas)}</span>`;
}

// Temporada (nombre) a partir del season_id, con las ligas cargadas por el router.
function sidgadActaTemporada(seasonId) {
  const ligas = typeof sidgadNavLigas !== "undefined" ? sidgadNavLigas : [];
  return ligas.find(l => String(l.id_temp) === String(seasonId))?.nombre_temp || "";
}

// "POLIDEPORTIVO FRANCESC CALVO - RUBÍ" -> localidad "RUBÍ"
function sidgadActaLocalidad(lugar) {
  const partes = String(lugar || "").split(" - ");
  return partes.length > 1 ? partes[partes.length - 1].trim() : "";
}

function sidgadActaTiempos(matchData, teamId) {
  return (matchData.events || [])
    .filter(ev => ev.event_type === "timeout" && String(ev.team_id) === String(teamId))
    .sort((a, b) => (sidgadNum(a.period) ?? 0) - (sidgadNum(b.period) ?? 0) || String(a.time_period).localeCompare(String(b.time_period)));
}

/* ----- Hockey patines (modelo: acta oficial en PDF de la RFEP) ----- */

// Huecos fijos del cuerpo técnico en la hoja; cada técnico ocupa el de su rol.
const SIDGAD_HUECOS_STAFF_HP = [["E1", "Entrenador"], ["E2", "2º Entrenador"], ["D", "Delegado"], ["A", "Auxiliar"], ["A", "Auxiliar"], ["A", "Auxiliar"], ["A", "Auxiliar"], ["A", "Auxiliar"]];

// Marcador y faltas de equipo por periodo, a partir de los eventos.
function sidgadActaPorPeriodo(matchData, tipo, periodo) {
  const cuenta = teamId => (matchData.events || []).filter(ev => ev.event_type === tipo && String(ev.team_id) === String(teamId) && (periodo === null || String(ev.period) === String(periodo))).length;
  return { local: cuenta(matchData.home_team_id), visitante: cuenta(matchData.away_team_id) };
}

function sidgadActaEquipoHp(matchData, lado) {
  const local = lado === "home";
  const teamId = local ? matchData.home_team_id : matchData.away_team_id;
  const tiempos = sidgadActaTiempos(matchData, teamId);
  const tiempoPeriodo = periodo => tiempos.filter(t => String(t.period) === String(periodo)).map(t => e(t.time_period)).join(" | ");
  const roster = matchData[`${lado}_roster`] || [];
  const libres = [...(matchData[`${lado}_staff`] || [])];
  const staff = SIDGAD_HUECOS_STAFF_HP.map(([rol, etiqueta]) => {
    const i = libres.findIndex(m => m.staff_role === rol);
    return { etiqueta, persona: i >= 0 ? libres.splice(i, 1)[0] : null };
  });

  return `
    <tr class="sidgad-acta-fila-equipo">
      <td>${ta(local ? "Local" : "Visitante")}</td>
      <td colspan="5" class="sidgad-acta-equipo-nombre">${e(local ? matchData.home_team_name : matchData.away_team_name)}</td>
      <td colspan="2" class="sidgad-acta-goles-equipo">${e(local ? matchData.home_team_score : matchData.away_team_score)}</td>
      <td colspan="3">${ta('Tpos Muertos Periodo 1')}</td><td colspan="3">${tiempoPeriodo(1)}</td>
      <td colspan="3">${ta('Tpos Muertos Periodo 2')}</td><td colspan="2">${tiempoPeriodo(2)}</td>
    </tr>
    <tr class="sidgad-acta-cabecera-tabla">
      <th rowspan="2">${ta('Nº Licencia')}</th><th rowspan="2">${ta('Nº')}</th><th rowspan="2">5</th><th rowspan="2">P</th><th rowspan="2">C</th>
      <th rowspan="2" class="sidgad-acta-izq">${ta('Apellidos, Nombre')}</th><th rowspan="2">G</th><th rowspan="2">A</th>
      <th colspan="3">${ta('Tarjetas')}</th><th colspan="6">Power Play 2 Min</th><th colspan="2">PP 4 Min</th>
    </tr>
    <tr class="sidgad-acta-cabecera-tabla">
      <th>${ta('Am')}</th><th>${ta('Azules')}</th><th>${ta('R|roja')}</th>
      <th>${ta('Inicio')}</th><th>${ta('Fin')}</th><th>${ta('Inicio')}</th><th>${ta('Fin')}</th><th>${ta('Inicio')}</th><th>${ta('Fin')}</th><th>${ta('Inicio')}</th><th>${ta('Fin')}</th>
    </tr>
    ${roster.map(p => `
      <tr>
        <td></td><td>${e(String(p.player_number ?? "").padStart(2, "0"))}</td><td>${p["5i"] ? "5" : ""}</td><td>${p.player_role === "P" ? "P" : ""}</td><td>${p.is_captain ? "C" : ""}</td>
        <td class="sidgad-acta-izq">${e(p.player_name)}</td>
        <td>${celda(p.goals)}</td><td>${celda(p.asist)}</td>
        <td>${celda(p.yellow_card)}</td><td>${celda(p.blue_card)}</td><td>${celda(p.red_card)}</td>
        ${vacio(8)}
      </tr>`).join("")}
    <tr class="sidgad-acta-separador">${vacio(19)}</tr>
    ${staff.map(({ etiqueta, persona }) => `
      <tr class="sidgad-acta-staff">
        <td></td><td colspan="4" class="sidgad-acta-izq">${ta(etiqueta)}</td>
        <td class="sidgad-acta-izq">${persona ? e(String(persona.staff_name || "").replace(",", ", ")) : ""}</td>
        <td colspan="2" class="sidgad-acta-gris"></td>
        <td>${celda(persona?.staff_yellow)}</td><td>${celda(persona?.staff_blue)}</td><td>${celda(persona?.staff_red)}</td>
        ${vacio(8)}
      </tr>`).join("")}`;
}

function sidgadActaResumenHp(matchData) {
  const filas = [["1", 1], ["2", 2], ["3", 3], ["4", 4], [ta("Penaltis"), null]].map(([titulo, periodo]) => {
    if (periodo === null) {
      const hay = matchData.shootout && (matchData.home_team_penals || matchData.away_team_penals);
      return `<tr><td>${titulo}</td><td>${hay ? `${e(matchData.home_team_penals)}-${e(matchData.away_team_penals)}` : ""}</td><td></td></tr>`;
    }
    const goles = sidgadActaPorPeriodo(matchData, "goal", periodo);
    const faltas = sidgadActaPorPeriodo(matchData, "fault", periodo);
    const jugado = (matchData.events || []).some(ev => String(ev.period) === String(periodo));
    return `<tr><td>${titulo}</td><td>${jugado ? `${goles.local}-${goles.visitante}` : ""}</td><td>${jugado ? `${faltas.local}-${faltas.visitante}` : ""}</td></tr>`;
  }).join("");
  const faltasTotal = sidgadActaPorPeriodo(matchData, "fault", null);
  return `
    <table class="sidgad-acta-grid sidgad-acta-resumen sidgad-acta-resumen-hp">
      <tr><th colspan="3">${ta('RESUMEN PARTIDO')}</th></tr>
      <tr class="sidgad-acta-cabecera-tabla"><th>${ta('Periodo')}</th><th>${ta('Marcador')}</th><th>${ta('Faltas')}</th></tr>
      ${filas}
      <tr class="sidgad-acta-total"><th>${ta('TOTAL')}</th><th>${e(matchData.home_team_score)}-${e(matchData.away_team_score)}</th><th>${faltasTotal.local}-${faltasTotal.visitante}</th></tr>
    </table>`;
}

function sidgadActaHp(matchData) {
  const lugar = matchData.venue_info || "";
  return `
    <div class="sidgad-acta-hoja sidgad-acta-hp">
      <table class="sidgad-acta-grid">
        <tr>
          <td rowspan="8" class="sidgad-acta-logo">${sidgadActaLogo()}</td>
          <th colspan="8" class="sidgad-acta-titulo">${ta('ACTA OFICIAL DE PARTIDO HOCKEY PATINES')} - ${e(SIDGAD_ACTA_FEDERACION.nombre)}</th>
        </tr>
        <tr><td class="sidgad-acta-etq">${ta('COMPETICIÓN')}</td><td colspan="4">${e(matchData.tournament_name)}</td><td class="sidgad-acta-etq">${ta('TEMPORADA')}</td><td colspan="2">${e(sidgadActaTemporada(matchData.season_id))}</td></tr>
        <tr><td class="sidgad-acta-etq">${ta('INSTALACIÓN')}</td><td colspan="4">${e(lugar)}</td><td class="sidgad-acta-etq">${ta('LOCALIDAD')}</td><td colspan="2">${e(sidgadActaLocalidad(lugar))}</td></tr>
        <tr><td class="sidgad-acta-etq">${ta('FECHA - HORA')}</td><td colspan="4">${e([matchData.game_date, matchData.game_hour].filter(Boolean).join(" - "))}</td><td class="sidgad-acta-etq">${ta('JORNADA')}</td><td colspan="2">${e(sidgadTApi(matchData.game_info, SIDGAD_LENGUA_ACTA))}</td></tr>
        <tr><td class="sidgad-acta-etq">${ta('ÁRBITRO 1')}</td><td colspan="2">${e(sidgadNombrePersona(matchData.ref_name1))}</td><td class="sidgad-acta-etq">${ta('ÁRBITRO 2')}</td><td colspan="4">${e(sidgadNombrePersona(matchData.ref_name2))}</td></tr>
        <tr><td class="sidgad-acta-etq">${ta('ÁRBITRO AUXILIAR')}</td><td colspan="2">${e(sidgadNombrePersona(matchData.ref_aux))}</td><td class="sidgad-acta-etq">${ta('CRONOMETRADOR')}</td><td colspan="4">${e(sidgadNombrePersona(matchData.cronometrador))}</td></tr>
        <tr><td class="sidgad-acta-etq">${ta('DELEGADO PISTA')}</td><td colspan="2">${e(sidgadNombrePersona(matchData.del_pista))}</td><td class="sidgad-acta-etq">${ta('DELEGADO {federacion}', { federacion: e(SIDGAD_ACTA_FEDERACION.siglas) })}</td><td colspan="4">${e(sidgadNombrePersona(matchData.del_fede))}</td></tr>
        <tr><td class="sidgad-acta-etq">${ta('DELEGADO ACTA')}</td><td colspan="2"></td><td class="sidgad-acta-etq">${ta('HORA INICIO')}</td><td></td><td class="sidgad-acta-etq">${ta('Policía / Seguridad')}</td><td class="sidgad-acta-etq">${ta('Servicio Médico')}</td><td></td></tr>
      </table>
      <table class="sidgad-acta-grid sidgad-acta-equipos">
        ${sidgadActaEquipoHp(matchData, "home")}
        ${sidgadActaEquipoHp(matchData, "away")}
      </table>
      ${sidgadActaResumenHp(matchData)}
      ${sidgadActaPie(matchData)}
    </div>`;
}

/* ----- Hockey línea ----- */

// Restar un tiempo (segundos) a un reloj "mm:ss" que cuenta hacia atrás: 09:01 - 1'30" = 07:31
function sidgadActaRestarReloj(reloj, segundos) {
  const [m, s] = String(reloj || "").split(":").map(Number);
  if (!Number.isFinite(m) || !Number.isFinite(s) || segundos === null) return "";
  const total = Math.max(0, m * 60 + s - segundos);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function sidgadActaEquipoHl(matchData, lado) {
  const local = lado === "home";
  const teamId = String(local ? matchData.home_team_id : matchData.away_team_id);
  // Porteros con Pos P0 (el que empieza) y P1; el resto de la plantilla con su rol (C/A).
  const porteros = (matchData[`${lado}_goalies`] || []).map((p, i) => ({ ...p, pos: `P${i}` }));
  const idsPorteros = new Set(porteros.map(p => String(p.player_id)));
  const jugadores = [
    ...(matchData[`${lado}_roster`] || []).filter(p => !idsPorteros.has(String(p.player_id))).map(p => ({ ...p, pos: ["C", "A"].includes(p.player_role) ? p.player_role : "" })),
    ...porteros,
  ].sort((a, b) => (sidgadNum(a.player_number) ?? 999) - (sidgadNum(b.player_number) ?? 999));
  const staff = matchData[`${lado}_staff`] || [];
  // Orden de la hoja: por periodo y, dentro de cada uno, de más a menos reloj (cuenta hacia atrás).
  const reloj = t => { const [m, sg] = String(t || "").split(":").map(Number); return (m || 0) * 60 + (sg || 0); };
  const eventos = (matchData.events || [])
    .filter(ev => String(ev.team_id) === teamId)
    .sort((a, b) => (sidgadNum(a.period) ?? 0) - (sidgadNum(b.period) ?? 0) || reloj(b.time_period) - reloj(a.time_period));
  const goles = eventos.filter(ev => ev.event_type === "goal");
  const faltas = eventos.filter(ev => ev.event_type === "foul");

  // Filas: jugadores (+2 en blanco), cabecera de cuerpo técnico, técnicos (+2 en blanco).
  const filasIzq = [
    ...jugadores.map(p => `<td></td><td class="sidgad-acta-izq">${e(p.player_name)}</td><td>${e(String(p.player_number ?? "").padStart(2, "0"))}</td><td>${e(p.pos)}</td><td></td>`),
    `${vacio(5)}`, `${vacio(5)}`,
    `<td colspan="5" class="sidgad-acta-izq sidgad-acta-subtitulo">${ta('Cuerpo técnico')}</td>`,
    ...staff.map(m => `<td></td><td class="sidgad-acta-izq">${e(m.staff_name)}</td><td colspan="3">${e(m.staff_role)}</td>`),
    `${vacio(5)}`, `${vacio(5)}`,
  ];
  const filas = Math.max(filasIzq.length, goles.length, faltas.length);
  const cuerpo = Array.from({ length: filas }, (_, i) => {
    const g = goles[i];
    const f = faltas[i];
    const minutos = f ? sidgadPimSegundos(f.foul_min) : null;
    const izq = filasIzq[i] ?? vacio(5);
    const centro = g
      ? `<td>${i + 1}</td><td>${e(g.period)}</td><td>${e(g.time_period)}</td><td>${e(g.player_number)}</td><td>${e(g.aisist_number)}</td><td>${e(g.situacion || (g.empty_net ? "EN" : ""))}</td>`
      : vacio(6);
    const derecha = f
      ? `<td>${e(f.time_period)}</td><td>${e(f.period)}</td><td>${e(f.player_number)}</td><td>${e(f.foul_code)}</td><td>${e(sidgadPimTexto(minutos))}</td><td>${e(f.time_period)}</td><td>${e(sidgadActaRestarReloj(f.time_period, minutos))}</td><td></td>`
      : vacio(8);
    return `<tr>${izq}${centro}${derecha}</tr>`;
  }).join("");

  return `
    <tr class="sidgad-acta-fila-equipo">
      <td>${ta(local ? "Local (A)" : "Visitante (B)")}</td>
      <td class="sidgad-acta-equipo-nombre">${e(local ? matchData.home_team_name : matchData.away_team_name)}</td>
      <td colspan="3" class="sidgad-acta-goles-equipo">${e(local ? matchData.home_team_score : matchData.away_team_score)}</td>
      <th colspan="6">${ta('GOLES Y ASISTENCIAS')}</th>
      <th colspan="8">${ta('PENALIZACIONES')}</th>
    </tr>
    <tr class="sidgad-acta-cabecera-tabla">
      <th>${ta('Nº Licencia')}</th><th class="sidgad-acta-izq">${ta('Apellidos, Nombre')}</th><th>#</th><th>${ta('Pos')}</th><th>${ta('Cat')}</th>
      <th></th><th>P</th><th>${ta('Tiempo')}</th><th>G</th><th>A</th><th>S/I</th>
      <th>${ta('Tiempo')}</th><th>P</th><th>#</th><th>${ta('Código')}</th><th>${ta('Min')}</th><th>${ta('Inicio')}</th><th>${ta('Fin')}</th><th>Off</th>
    </tr>
    ${cuerpo}`;
}

function sidgadActaResumenHl(matchData) {
  const periodos = ["1", "2", "3", "PR", "SO"];
  const cuenta = (teamId, tipo, periodo) => (matchData.events || []).filter(ev => ev.event_type === tipo && String(ev.team_id) === String(teamId) && String(ev.period) === periodo).length || "";
  const fila = (titulo, teamId, tipo) => `<tr><td class="sidgad-acta-izq">${ta(titulo)}</td>${periodos.map(p => `<td>${cuenta(teamId, tipo, p)}</td>`).join("")}<td>${(matchData.events || []).filter(ev => ev.event_type === tipo && String(ev.team_id) === String(teamId)).length || ""}</td></tr>`;
  return `
    <table class="sidgad-acta-grid sidgad-acta-resumen">
      <tr><th colspan="7">${ta('Resumen del partido')}</th></tr>
      <tr class="sidgad-acta-cabecera-tabla"><th class="sidgad-acta-izq">${ta('Periodo')}</th>${periodos.map(p => `<th>${p}</th>`).join("")}<th>${ta('Total')}</th></tr>
      ${fila("Goles (A)", matchData.home_team_id, "goal")}
      ${fila("Goles (B)", matchData.away_team_id, "goal")}
      ${fila("Tiempos muertos (A)", matchData.home_team_id, "timeout")}
      ${fila("Tiempos muertos (B)", matchData.away_team_id, "timeout")}
    </table>
`;
}

function sidgadActaHl(matchData) {
  const lugar = matchData.venue_info || "";
  return `
    <div class="sidgad-acta-hoja sidgad-acta-hl">
      <table class="sidgad-acta-grid">
        <tr>
          <td rowspan="6" class="sidgad-acta-logo">${sidgadActaLogo()}</td>
          <th colspan="8" class="sidgad-acta-titulo">${ta('ACTA OFICIAL DE PARTIDO HOCKEY LÍNEA')} - ${e(SIDGAD_ACTA_FEDERACION.siglas)}</th>
        </tr>
        <tr><td class="sidgad-acta-etq">${ta('COMPETICIÓN')}</td><td colspan="5">${e(matchData.tournament_name)}</td><td class="sidgad-acta-etq">${ta('TEMPORADA')}</td><td>${e(sidgadActaTemporada(matchData.season_id))}</td></tr>
        <tr><td class="sidgad-acta-etq">${ta('INSTALACIÓN')}</td><td colspan="5">${e(lugar)}</td><td class="sidgad-acta-etq">${ta('LOCALIDAD')}</td><td>${e(sidgadActaLocalidad(lugar))}</td></tr>
        <tr><td class="sidgad-acta-etq">${ta('FECHA')}</td><td>${e(matchData.game_date)}</td><td class="sidgad-acta-etq">${ta('HORA')}</td><td colspan="3">${e(matchData.game_hour)}</td><td class="sidgad-acta-etq">${ta('Jornada')}</td><td>${e(String(matchData.game_info || "").replace(/^JORNADA\s*/i, ""))}</td></tr>
        <tr><td class="sidgad-acta-etq">${ta('ÁRBITRO PRINCIPAL')}</td><td colspan="3">${e(sidgadNombrePersona(matchData.ref_name1))}</td><td class="sidgad-acta-etq">${ta('ÁRBITRO AUXILIAR')}</td><td colspan="3">${e(sidgadNombrePersona(matchData.ref_name2))}</td></tr>
        <tr><td class="sidgad-acta-etq">${ta('ANOTADOR')}</td><td colspan="3">${e(sidgadNombrePersona(matchData.ref_aux))}</td><td class="sidgad-acta-etq">${ta('CRONOMETRADOR')}</td><td colspan="3">${e(sidgadNombrePersona(matchData.cronometrador))}</td></tr>
      </table>
      <table class="sidgad-acta-grid sidgad-acta-equipos">
        ${sidgadActaEquipoHl(matchData, "home")}
        ${sidgadActaEquipoHl(matchData, "away")}
      </table>
      ${sidgadActaResumenHl(matchData)}
      ${sidgadActaPie(matchData)}
    </div>`;
}

// Last-Modified del report que se está pintando: en el pie, para depurar (como en los portales anteriores).
let sidgadActaGenerada = null;

function sidgadActaPie() {
  const fecha = sidgadFechaGmt(sidgadActaGenerada);
  const generada = fecha ? e(ta("Informe generado el {fecha}", { fecha })) : "";
  return `<div class="sidgad-acta-pie"><span>${generada}</span><span>Powered by SIDGAD SOFTWARE</span></div>`;
}

function renderSidgadActaOficial(matchData, config) {
  const hoja = config.formato === "hl" ? sidgadActaHl(matchData) : sidgadActaHp(matchData);
  const fecha = String(matchData.game_date || "").replace(/\//g, "-");
  const titulo = `${ta("Acta")} ${matchData.home_team_name} - ${matchData.away_team_name} ${fecha}`.replace(/\s+/g, " ").trim();
  return `
    <div class="sidgad-acta-barra"><button type="button" class="sidgad-acta-imprimir" data-acta-titulo="${e(titulo)}"><i class="fas fa-print" aria-hidden="true"></i> ${sidgadT('Imprimir acta')}</button></div>
    <div class="sidgad-acta-scroll">${hoja}</div>`;
}

// Imprimir desde la misma página, con un marco oculto que sólo contiene la hoja: así no la recorta
// el modal y se ajusta al ancho de un A4 vertical. El título del partido da nombre al PDF.
function sidgadImprimirActa(boton) {
  const hoja = document.querySelector("#sidgad-acta-content .sidgad-acta-hoja");
  if (!hoja) return;
  const estilos = [...document.querySelectorAll('link[rel="stylesheet"]')].find(l => /\/acta\//.test(l.href))?.href || "";
  // El propio documento imprime al terminar de cargar (estilos y logo incluidos).
  const html = `<!doctype html><html lang="${SIDGAD_LENGUA_ACTA}"><head><meta charset="utf-8">
    <title>${e(boton.dataset.actaTitulo || ta("Acta de partido"))}</title>
    ${estilos ? `<link rel="stylesheet" href="${e(estilos)}">` : ""}
    <style>
      @page { size: A4 portrait; margin: 7mm; }
      html, body { margin: 0; background: #fff; }
      .sidgad-acta-hoja { min-width: 0; width: 100%; padding: 0; font-size: 7.6px; }
      .sidgad-acta-grid th, .sidgad-acta-grid td { padding: 1px 2px; font-size: 7.4px !important; white-space: normal; }
      .sidgad-acta-grid td.sidgad-acta-izq { word-break: break-word; }
      .sidgad-acta-titulo { font-size: 10px; }
      .sidgad-acta-equipo-nombre { font-size: 10px; }
      .sidgad-acta-goles-equipo { font-size: 12px; }
      .sidgad-acta-logo { width: 80px; }
      .sidgad-acta-logo img { max-width: 70px; max-height: 58px; }
      .sidgad-acta-hoja th, .sidgad-acta-hoja td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sidgad-acta-hoja tr { break-inside: avoid; }
    </style>
    </head><body>${hoja.outerHTML}</body></html>`;

  document.getElementById("sidgad-acta-impresion")?.remove();
  const marco = document.createElement("iframe");
  marco.id = "sidgad-acta-impresion";
  marco.setAttribute("aria-hidden", "true");
  marco.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(marco);
  marco.addEventListener("load", () => {
    // Algunos navegadores nombran el PDF con el título de la página principal: se cambia mientras dura la impresión.
    const tituloPagina = document.title;
    document.title = boton.dataset.actaTitulo || tituloPagina;
    const restaurar = () => { document.title = tituloPagina; };
    marco.contentWindow.addEventListener("afterprint", restaurar, { once: true });
    setTimeout(() => {
      marco.contentWindow.focus();
      marco.contentWindow.print();
      setTimeout(restaurar, 1000);
    }, 150);
  }, { once: true });
  marco.srcdoc = html;
}

document.addEventListener("click", (event) => {
  const boton = event.target.closest(".sidgad-acta-imprimir");
  if (boton) sidgadImprimirActa(boton);
}, true);

function initSidgadMatchActa(options) {
  const {
    variantName,
    buildModalHtml,
    renderRoster,
    renderIncidents,
    renderStats,
    renderActa,
  } = options;

  let sidgadMatchRefreshTimer = null;
  let sidgadLastMatchDataString = "";
  let sidgadIsMatchModalOpen = false;
  let sidgadMatchGameId = null;
  let sidgadMatchResetTimer = null;

  document.addEventListener("DOMContentLoaded", () => {
    if (!SIDGAD_SETTINGS.has_acta_digital) return;

    const modal = document.getElementById("sidgad-match-overlay");
    modal.innerHTML = typeof buildModalHtml === "function" ? buildModalHtml() : buildModalHtml;
    initSidgadTabs();
  });

  async function openSidgadMatchDetails(gameId, isRefresh = false) {
    if (!isRefresh) {
      clearTimeout(sidgadMatchResetTimer);
      document.getElementById("sidgad-match-overlay").classList.add("sidgad-activo");
      showSidgadLoading();
      document.body.style.overflow = "hidden";
      sidgadIsMatchModalOpen = true;
      sidgadMatchGameId = gameId;
      sidgadLastMatchDataString = "";
    }
    if (isRefresh && !sidgadIsMatchModalOpen) return;

    let data;
    try {
      data = await sidgadFetch("report", { id: gameId });
    } catch (error) {
      console.error("Error datos partido:", error);
      if (isRefresh) {
        scheduleSidgadNextRefresh(gameId, "false");
        return;
      }
    }

    if (!data?.game_data) {
      if (!isRefresh) {
        hideSidgadLoading();
        sidgadCerrarPartido();
      }
      return;
    }

    // Se cerró (o se abrió otro) mientras llegaba la respuesta.
    if (!sidgadIsMatchModalOpen || String(gameId) !== String(sidgadMatchGameId)) return;

    const matchData = data.game_data;
    const newDataString = JSON.stringify(matchData);

    // Partido sin empezar (acta prepartido): en su lugar, la previa (si el portal la tiene). Sin
    // previa, el acta se muestra como partido sin empezar.
    if (!isRefresh && sidgadActaSinEmpezar(matchData) && SIDGAD_SETTINGS.has_previa !== false && window.sidgadPrevia) {
      hideSidgadLoading();
      sidgadNavegar({ partido: null, previa: String(gameId), jugador: null, temporada: null }, { reemplazar: true });
      return;
    }

    if (isRefresh && sidgadLastMatchDataString === newDataString) {
      scheduleSidgadNextRefresh(gameId, matchData.game_completed);
      return;
    }

    sidgadLastMatchDataString = newDataString;
    const modalBody = document.querySelector(".sidgad-match-modal-body");
    const currentScrollTop = modalBody ? modalBody.scrollTop : 0;

    setSidgadCommonHeader(matchData);
    setSidgadShootoutContent(matchData);

    renderRoster(matchData);

    const teams = {
      [matchData.home_team_id]: { name: matchData.home_team_name, logo: matchData.home_logo || SIDGAD_DEFAULT_LOGO },
      [matchData.away_team_id]: { name: matchData.away_team_name, logo: matchData.away_logo || SIDGAD_DEFAULT_LOGO },
    };

    renderIncidents(matchData, teams);
    renderStats(matchData);
    // Sin empezar: fuera las estadísticas (todo a cero) y, sin incidencias, un aviso.
    if (sidgadActaSinEmpezar(matchData)) {
      const stats = document.getElementById("sidgad-match-stats-container");
      if (stats) stats.style.display = "none";
      const incidencias = document.getElementById("sidgad-incidents-list");
      if (incidencias && !(matchData.events || []).length) incidencias.innerHTML = `<p class="sidgad-acta-vacio">${sidgadT('El partido aún no ha empezado.')}</p>`;
      ["sidgad-roster-home-body", "sidgad-roster-away-body"].forEach(id => {
        const cuerpoTabla = document.getElementById(id);
        if (!cuerpoTabla || cuerpoTabla.rows.length) return;
        const columnas = cuerpoTabla.closest("table")?.querySelector("thead tr:last-child")?.children.length || 1;
        cuerpoTabla.innerHTML = `<tr><td colspan="${columnas}" class="sidgad-acta-vacio">${sidgadT('Alineación aún no disponible.')}</td></tr>`;
      });
    }
    // El acta oficial sólo existe con el partido terminado (y si está activa en config.php):
    // si no, no se muestra la pestaña.
    const actaContenido = document.getElementById("sidgad-acta-content");
    const terminado = matchData.game_completed === "true" && SIDGAD_SETTINGS.has_acta_oficial !== false;
    const botonActa = document.querySelector('.sidgad-modal-tab-btn[data-target="sidgad-ficha-acta"]');
    botonActa?.classList.toggle("sidgad-tab-oculta", !terminado);
    if (!terminado && document.querySelector(".sidgad-match-modal-body")?.classList.contains("sidgad-ver-acta")) {
      document.querySelector('.sidgad-modal-tab-btn[data-target="sidgad-ficha-alineaciones"]')?.click();
    }
    sidgadActaGenerada = sidgadFechaApi(data);
    if (actaContenido && typeof renderActa === "function") actaContenido.innerHTML = terminado ? renderActa(matchData) : "";

    if (!isRefresh) hideSidgadLoading();
    else if (modalBody) modalBody.scrollTop = currentScrollTop;
    scheduleSidgadNextRefresh(gameId, matchData.game_completed);
  }

  function scheduleSidgadNextRefresh(gameId, isCompleted) {
    clearTimeout(sidgadMatchRefreshTimer);
    if (isCompleted !== "true") {
      sidgadMatchRefreshTimer = setTimeout(() => openSidgadMatchDetails(gameId, true), 15000);
    }
  }

  function closeSidgadMatchModal() {
    clearTimeout(sidgadMatchRefreshTimer);
    sidgadMatchRefreshTimer = null;
    sidgadIsMatchModalOpen = false;
    sidgadMatchGameId = null;
    sidgadLastMatchDataString = "";
    hideSidgadLoading();
    document.getElementById("sidgad-match-overlay").classList.remove("sidgad-activo");
    sidgadActualizarScroll();
    clearTimeout(sidgadMatchResetTimer);
    sidgadMatchResetTimer = setTimeout(() => {
      const modal = document.getElementById("sidgad-match-overlay");
      modal.innerHTML = typeof buildModalHtml === "function" ? buildModalHtml() : buildModalHtml;
      initSidgadTabs();
    }, 300);
  }

  // Funciones que pinta el router; el resto del portal abre y cierra el acta navegando.
  window.sidgadActa = {
    abrir: (gameId) => openSidgadMatchDetails(gameId),
    cerrar: closeSidgadMatchModal,
  };
  window.openSidgadMatchDetails = (gameId) => sidgadAbrirPartido(gameId);
  window.closeSidgadMatchModal = () => sidgadCerrarPartido();
}

window.SidgadActaComun = { initSidgadMatchActa, splitSidgadName, renderSidgadShootout, renderSidgadStatRow, renderSidgadActaOficial };
})();
