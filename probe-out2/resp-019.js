/*
 * Previa de un partido de En directo que aún no ha empezado (capa ?previa=game_id).
 * El marcador da la liga (league_id) y los dos equipos; con la clasificación, el
 * calendario y las estadísticas de esa liga se arma el cara a cara.
 */

const sidgadPrevia = { id: null, peticion: 0 };

// Mismo marco que el acta (modal centrado, barra negra, cabecera gris con el marcador).
function sidgadPreviaOverlay() {
  let overlay = document.getElementById('sidgad-previa-overlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'sidgad-previa-overlay';
  overlay.innerHTML = `
    <div class="sidgad-match-modal" role="dialog" aria-modal="true" aria-label="${sidgadT('Previa del partido')}">
      <div class="sidgad-match-modal-top">
        <h2>${sidgadT('Previa del partido')}</h2>
        <button type="button" class="sidgad-close-modal-btn" aria-label="${sidgadT('Cerrar')}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      <div class="sidgad-match-modal-header-gris" id="sidgad-previa-cabecera"></div>
      <div class="sidgad-match-modal-body" id="sidgad-previa-cuerpo"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.sidgad-close-modal-btn').addEventListener('click', () => sidgadCerrarPrevia());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) sidgadCerrarPrevia(); });
  return overlay;
}

// Datos de un equipo en esa liga: fila de clasificación, partidos jugados y jugadores.
function sidgadPreviaEquipo(teamId, { bloques, partidos, jugadores }) {
  const id = String(teamId);
  const suyos = partidos.filter(p => String(p.home_id) === id || String(p.away_id) === id);
  return {
    id,
    clasif: sidgadFilaClasificacion(bloques, id),
    jugados: suyos.filter(sidgadPartidoJugado),
    jugadores: jugadores.filter(f => String(f.team_id) === id),
  };
}

function sidgadPreviaComparativa(local, visitante) {
  const porPartido = (eq, campo) => {
    const pj = sidgadNum(eq.clasif?.fila?.played);
    const v = sidgadNum(eq.clasif?.fila?.[campo]);
    return pj && v !== null ? (v / pj).toLocaleString(SIDGAD_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  };
  const forma = eq => eq.jugados.slice(-5).map(p => {
    const r = sidgadResultadoEquipo(p, eq.id);
    return `<span class="sidgad-equipo-forma-${r || 'x'}" title="${escaparHtml(`${p.result} · ${String(p.dia_partido).slice(0, 5)}`)}">${r ? sidgadT(`${r}|forma`) : '·'}</span>`;
  }).join('') || '—';
  const racha = eq => {
    const r = sidgadEquipoRacha(eq.jugados, eq.id);
    return r ? `<span class="sidgad-equipo-res-${r.tipo}">${r.texto}</span>` : '—';
  };
  const f = eq => eq.clasif?.fila;
  const filas = [
    ['Puesto', eq => (eq.clasif ? sidgadT('{n}º', { n: eq.clasif.posicion }) : '—')],
    ['Puntos', eq => escaparHtml(f(eq)?.points ?? '—')],
    ['Balance (G-E-P)', eq => (f(eq) ? `${escaparHtml(f(eq).win)}-${escaparHtml(f(eq).tie)}-${escaparHtml(f(eq).lost)}` : '—')],
    ['Goles a favor / partido', eq => porPartido(eq, 'gf')],
    ['Goles en contra / partido', eq => porPartido(eq, 'ga')],
    ...(f(local)?.pp_goals !== undefined || f(visitante)?.pp_goals !== undefined ? [
      ['Goles en power play', eq => escaparHtml(f(eq)?.pp_goals ?? '—')],
      ['Goles en inferioridad', eq => escaparHtml(f(eq)?.sh_goals ?? '—')],
    ] : []),
    ['Racha', racha],
    ['Últimos 5', eq => `<span class="sidgad-equipo-forma">${forma(eq)}</span>`],
  ];
  return `
    <table class="sidgad-equipo-cf sidgad-previa-cara">
      <tbody>
        ${filas.map(([titulo, valor]) => `<tr><td>${valor(local)}</td><th>${sidgadT(titulo)}</th><td>${valor(visitante)}</td></tr>`).join('')}
      </tbody>
    </table>`;
}

function sidgadPreviaLideres(eq, liga) {
  return sidgadStatsColumnas('jugadores', liga).filter(col => col.rapido && col.clave !== 'pim').map(col => {
    const top = sidgadPortadaTop(eq.jugadores, col)[0];
    if (!top) return '';
    return `
      <article class="sidgad-equipo-lider">
        <img class="sidgad-equipo-lider-foto" data-lider-foto="${escaparHtml(top.fila.player_id)}" src="${SIDGAD_DEFAULT_LOGO}" alt="">
        <div class="sidgad-equipo-lider-datos">
          <span class="sidgad-equipo-lider-titulo">${col.rapido}</span>
          ${sidgadEnlaceJugador(top.fila.player_id, liga.id_temp, sidgadPortadaNombreLider(top.fila.player_name))}
        </div>
        <div class="sidgad-equipo-lider-valor"><strong>${sidgadStatsFormato(col, top.fila)}</strong><span>${escaparHtml(col.titulo)}</span></div>
      </article>`;
  }).join('');
}

/* Alineaciones: si la revisión prepartido ya generó el acta (/report/ con estado 0), se muestran
 * las convocatorias con las mismas tablas que el acta (sólo las columnas que tienen sentido antes
 * del partido). HP: porteros en la plantilla (player_role "P"), capitán y cinco inicial (5i);
 * HL: porteros en home_goalies / away_goalies. */
function sidgadPreviaNombreActa(nombre) {
  const [apellidos, pila = ''] = String(nombre || '').split(',').map(t => t.trim());
  return `<span class="sidgad-player-last">${escaparHtml(apellidos)}</span><span class="sidgad-player-first">${escaparHtml(pila)}</span>`;
}

function sidgadPreviaBandera(codigo) {
  const c = String(codigo || '').toLowerCase().trim();
  return c ? `<img src="https://flagcdn.com/w20/${escaparHtml(c)}.png" class="sidgad-player-flag" alt="">` : '';
}

function sidgadPreviaConvocatoria(acta, lado, nombreEquipo) {
  const temporada = acta.season_id;
  const hp = SIDGAD_API_CONFIG.idm === 'hp';
  const jugadores = acta[`${lado}_roster`] || [];
  const porteros = acta[`${lado}_goalies`] || [];
  const staff = acta[`${lado}_staff`] || [];
  if (!jugadores.length && !porteros.length) return '';
  const columnas = hp ? 4 : 3;
  const nombre = j => `
    <td class="sidgad-col-name">
      ${sidgadEnlaceJugador(j.player_id, temporada, `${sidgadPreviaBandera(j.player_flag)}${sidgadPreviaNombreActa(j.player_name)}`)}
      ${j.is_captain ? '<span class="sidgad-captain-badge">C</span>' : ''}
    </td>`;
  const fila = (j, rol) => hp ? `
    <tr>
      <td>${escaparHtml(j.player_number ?? '')}</td>
      <td>${j.player_role ? `<span class="sidgad-captain-badge">${escaparHtml(j.player_role)}</span>` : ''}</td>
      <td>${j['5i'] ? '<span class="sidgad-5i-badge"></span>' : ''}</td>
      ${nombre(j)}
    </tr>` : `
    <tr>
      <td>${escaparHtml(j.player_number ?? '')}</td>
      <td>${escaparHtml(rol ?? j.player_role ?? '')}</td>
      ${nombre(j)}
    </tr>`;
  const filaStaff = m => `
    <tr>
      <td></td>
      <td>${m.staff_role ? `<span class="sidgad-captain-badge">${escaparHtml(m.staff_role)}</span>` : ''}</td>
      <td class="sidgad-col-name" colspan="${columnas - 2}">${sidgadPreviaBandera(m.staff_flag)}<span class="sidgad-tecnico-name">${escaparHtml(String(m.staff_name || '').replace(',', ', '))}</span></td>
    </tr>`;
  return `
    <div class="sidgad-table-responsive">
      <table class="sidgad-roster-table">
        <thead>
          <tr><th class="sidgad-team-roster-header" colspan="${columnas}">${escaparHtml(nombreEquipo)}</th></tr>
          <tr>
            <th width="30">${sidgadT('Nº')}</th>
            ${hp ? '<th width="30">P</th><th width="30">5i</th>' : `<th width="30">${sidgadT('Pos.')}</th>`}
            <th class="sidgad-col-name"></th>
          </tr>
        </thead>
        <tbody>
          ${jugadores.map(j => fila(j)).join('')}
          ${porteros.length ? `<tr class="sidgad-roster-subheader"><th colspan="${columnas}">${sidgadT('Porteros')}</th></tr>${porteros.map(j => fila(j, 'P')).join('')}` : ''}
          ${staff.length ? `<tr class="sidgad-roster-subheader"><th colspan="${columnas}">${sidgadT('Cuerpo técnico')}</th></tr>${staff.map(filaStaff).join('')}` : ''}
        </tbody>
      </table>
    </div>`;
}

// Bloque con el título en banda gris, como las secciones del acta ("INCIDENCIAS").
function sidgadPreviaBloque(icono, titulo, contenido, clase = '') {
  return `
    <div class="sidgad-previa-bloque ${clase}">
      <div class="sidgad-team-roster-header"><i class="fa-solid ${icono}" aria-hidden="true"></i> ${escaparHtml(titulo)}</div>
      <div class="sidgad-previa-bloque-cuerpo">${contenido}</div>
    </div>`;
}

// El partido con los campos del marcador, a partir del calendario de la liga abierta.
async function sidgadPreviaDesdeCalendario(gameId) {
  const idc = sidgadLeerEstado().liga;
  if (!idc) return null;
  const calendario = await sidgadFetch('calendar', { id: idc }, { cache: true }).catch(() => null);
  const fila = sidgadPartidosCalendario(calendario?.games).find(x => String(x.idp) === String(gameId));
  if (!fila) return null;
  const liga = (typeof sidgadNavLigas !== 'undefined' ? sidgadNavLigas : []).find(l => String(l.idc) === String(idc));
  const corto = id => (liga?.teams || []).find(t => String(t.teamId) === String(id))?.name_short;
  const hora = fila.hora_partido && fila.hora_partido !== '_' ? fila.hora_partido : '';
  return {
    game_id: String(gameId),
    league_id: idc,
    league_name: liga?.nombre_idc || '',
    game_description: fila.jornada || fila.fase || '',
    game_date: fila.dia_partido,
    game_time: hora,
    home_team_id: fila.home_id,
    away_team_id: fila.away_id,
    home_team: corto(fila.home_id) || String(fila.home_name || '').trim(),
    away_team: corto(fila.away_id) || String(fila.away_name || '').trim(),
    home_team_long: String(fila.home_name || '').trim(),
    away_team_long: String(fila.away_name || '').trim(),
    home_logo: fila.home_logo,
    away_logo: fila.away_logo,
  };
}

async function abrirPrevia(gameId) {
  const overlay = sidgadPreviaOverlay();
  const peticion = ++sidgadPrevia.peticion;
  sidgadPrevia.id = String(gameId);
  const cuerpo = document.getElementById('sidgad-previa-cuerpo');
  const cabecera = document.getElementById('sidgad-previa-cabecera');
  cabecera.innerHTML = '';
  cuerpo.innerHTML = `<p class="sidgad-ficha-vacio">${sidgadT('Cargando...')}</p>`;
  overlay.classList.add('sidgad-activo');
  document.body.style.overflow = 'hidden';

  // El partido sale del marcador (En directo): ahí vienen la liga y los dos equipos. Si no está
  // (previa abierta desde el calendario o desde un acta prepartido), del calendario de la liga.
  const marcador = await sidgadFetch('scorer').catch(() => []);
  if (peticion !== sidgadPrevia.peticion) return;
  const p = (Array.isArray(marcador) ? marcador : []).find(x => String(x.game_id) === String(gameId))
    || await sidgadPreviaDesdeCalendario(gameId);
  if (peticion !== sidgadPrevia.peticion) return;
  if (!p) {
    cuerpo.innerHTML = `<p class="sidgad-ficha-vacio">${sidgadT('Este partido ya no está en la jornada en curso.')}</p>`;
    return;
  }
  const liga = (typeof sidgadNavLigas !== 'undefined' ? sidgadNavLigas : []).find(l => String(l.idc) === String(p.league_id))
    || { idc: p.league_id, nombre_idc: p.league_name, teams: [] };

  const [standing, calendario, stats, report] = await Promise.all([
    sidgadFetch('standing', { id: liga.idc }, { cache: true }).catch(() => null),
    sidgadFetch('calendar', { id: liga.idc }, { cache: true }).catch(() => null),
    sidgadFetch('stats', { id: liga.idc }, { cache: true }).catch(() => null),
    sidgadFetch('report', { id: gameId }).catch(() => null), // existe tras la revisión prepartido
  ]);
  if (peticion !== sidgadPrevia.peticion) return;

  const datos = {
    bloques: sidgadAgruparClasificaciones(standing?.standings?.standing || []),
    partidos: sidgadPartidosCalendario(calendario?.games).sort((a, b) => a.fecha - b.fecha),
    jugadores: stats?.stats?.rosters || [],
  };
  const local = sidgadPreviaEquipo(p.home_team_id, datos);
  const visitante = sidgadPreviaEquipo(p.away_team_id, datos);
  const filaCalendario = datos.partidos.find(x => String(x.idp) === String(gameId));
  const previos = datos.partidos
    .filter(x => sidgadPartidoJugado(x) && [String(x.home_id), String(x.away_id)].sort().join() === [local.id, visitante.id].sort().join())
    .reverse();

  // Equipo del marcador, como en el acta; debajo del nombre, su puesto en la liga.
  const lado = (nombre, logo, eq, clase) => {
    const img = `<img src="${escaparHtml(logo || SIDGAD_DEFAULT_LOGO)}" alt="" onerror="this.src='${SIDGAD_DEFAULT_LOGO}'">`;
    const texto = `
      <div class="sidgad-modal-team-name">
        ${sidgadEnlaceEquipo(eq.id, escaparHtml(nombre), liga.idc)}
        ${eq.clasif ? `<small class="sidgad-previa-puesto">${sidgadT('{n}º', { n: eq.clasif.posicion })} · ${sidgadT('{n} pts', { n: escaparHtml(eq.clasif.fila.points) })}</small>` : ''}
      </div>`;
    return `<div class="sidgad-modal-team ${clase}">${clase === 'sidgad-local' ? texto + img : img + texto}</div>`;
  };
  const acta = report?.game_data;
  const alineaciones = acta ? [
    sidgadPreviaConvocatoria(acta, 'home', acta.home_team_name || p.home_team_long || p.home_team),
    sidgadPreviaConvocatoria(acta, 'away', acta.away_team_name || p.away_team_long || p.away_team),
  ].filter(Boolean) : [];
  const lideresLocal = sidgadPreviaLideres(local, liga);
  const lideresVisitante = sidgadPreviaLideres(visitante, liga);

  const arbitros = [acta?.ref_name1, acta?.ref_name2].map(sidgadNombrePersona).filter(Boolean);
  cabecera.innerHTML = `
    <div class="sidgad-match-info-bar">
      <div class="sidgad-info-left">
        <span>${escaparHtml(p.league_name || liga.nombre_idc || '')}${p.game_description ? ` - ${escaparHtml(sidgadTApi(p.game_description))}` : ''}</span>
        <span>${escaparHtml([p.game_date, p.game_time].filter(Boolean).join(' - '))}</span>
      </div>
      <div class="sidgad-info-center"><span>${sidgadEnlacePista(acta?.venue_info || filaCalendario?.pista, escaparHtml(acta?.venue_info || filaCalendario?.pista || ''))}</span></div>
      <div class="sidgad-info-right">
        ${arbitros.length ? `<span style="color:#777;">${sidgadT('ÁRBITRAJE')}</span><span>${arbitros.map(r => `<p>${escaparHtml(r)}</p>`).join('')}</span>` : ''}
      </div>
    </div>
    <div class="sidgad-modal-scoreboard">
      ${lado(p.home_team_long || p.home_team, p.home_logo, local, 'sidgad-local')}
      <div class="sidgad-modal-score-center">
        <div class="sidgad-modal-score">${escaparHtml(p.game_time || sidgadT('VS'))}</div>
        <div class="sidgad-modal-status">${sidgadT('Previa')}</div>
      </div>
      ${lado(p.away_team_long || p.away_team, p.away_logo, visitante, 'sidgad-visit')}
    </div>`;

  const lideres = lideresLocal || lideresVisitante ? `
    <div class="sidgad-previa-lideres">
      <div><h4>${escaparHtml(p.home_team)}</h4>${lideresLocal || `<p class="sidgad-ficha-vacio">${sidgadT('Sin datos')}</p>`}</div>
      <div><h4>${escaparHtml(p.away_team)}</h4>${lideresVisitante || `<p class="sidgad-ficha-vacio">${sidgadT('Sin datos')}</p>`}</div>
    </div>` : '';
  const previosHtml = previos.length
    ? `<ul class="sidgad-portada-partidos">${previos.map(x => sidgadPortadaFilaPartido(x, true)).join('')}</ul>`
    : `<p class="sidgad-ficha-vacio">${sidgadT('No se han enfrentado en esta competición.')}</p>`;

  const caraACara = sidgadPreviaBloque('fa-scale-balanced', sidgadT('Cara a cara'), sidgadPreviaComparativa(local, visitante));
  const bloqueLideres = lideres ? sidgadPreviaBloque('fa-trophy', sidgadT('Líderes'), lideres) : '';
  const bloquePrevios = sidgadPreviaBloque('fa-clock-rotate-left', sidgadT('Enfrentamientos previos'), previosHtml, 'sidgad-previa-bloque-previos');

  // Con alineaciones, como el acta: el cara a cara y ellas a la izquierda, y el resto a la derecha.
  // Sin ellas (antes de la revisión prepartido) no se muestra nada de alineaciones y el resto se
  // reparte en dos columnas.
  cuerpo.innerHTML = alineaciones.length ? `
    <div class="sidgad-modal-content-grid sidgad-previa-grid">
      <div class="sidgad-previa-col">
        ${caraACara}
        ${alineaciones.join('')}
        <p class="sidgad-previa-aviso">${sidgadT('Alineaciones del acta prepartido: pueden cambiar hasta el inicio.')}</p>
      </div>
      <div class="sidgad-previa-col">${bloqueLideres}${bloquePrevios}</div>
    </div>` : `
    <div class="sidgad-modal-content-grid sidgad-previa-grid sidgad-previa-grid-par">
      <div class="sidgad-previa-col">${caraACara}${bloqueLideres ? bloquePrevios : ''}</div>
      <div class="sidgad-previa-col">${bloqueLideres || bloquePrevios}</div>
    </div>`;
  sidgadPortadaFotos(cuerpo, liga.id_temp);
}

function cerrarPrevia() {
  sidgadPrevia.peticion++;
  document.getElementById('sidgad-previa-overlay')?.classList.remove('sidgad-activo');
  sidgadActualizarScroll();
}

// Cuando el partido de la previa empieza (estado > 0) o termina, se pasa a su acta. Los datos
// llegan con cada refresco del marcador de En directo (cada 30 s mientras la pestaña está visible).
document.addEventListener('sidgad:marcador', (event) => {
  if (!sidgadPrevia.id || !document.getElementById('sidgad-previa-overlay')?.classList.contains('sidgad-activo')) return;
  const p = (event.detail?.partidos || []).find(x => String(x.game_id) === sidgadPrevia.id);
  if (!p) return;
  const empezado = (sidgadNum(p.game_status) ?? 0) > 0 || p.game_completed === 'true';
  if (!empezado || !SIDGAD_SETTINGS.has_acta_digital) return;
  // Sólo si el acta ya existe; si no (aún no se ha generado), se sigue en la previa hasta el próximo refresco.
  const id = sidgadPrevia.id;
  sidgadFetch('report', { id }).then(data => {
    if (!data?.game_data || sidgadPrevia.id !== id || !document.getElementById('sidgad-previa-overlay')?.classList.contains('sidgad-activo')) return;
    // Hasta que el acta no tenga el partido empezado, se sigue en la previa (el acta volvería aquí).
    const acta = data.game_data;
    if (String(acta.period ?? '0') === '0' && acta.game_completed !== 'true') return;
    sidgadNavegar({ previa: null, partido: id, jugador: null, temporada: null }, { reemplazar: true });
  }).catch(() => {});
});

window.sidgadPrevia = { abrir: abrirPrevia, cerrar: cerrarPrevia };
