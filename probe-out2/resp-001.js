/*
 * Navegación con URL. El estado vive en la query string para que funcione en
 * cualquier servidor sin reglas de reescritura:
 *   ?liga=3168&vista=calendar&filtro=3171&equipo=3171&partido=17874&jugador=19591&s=41
 * filtro es el equipo marcado en el selector de la cabecera de la liga (filtra todas sus vistas);
 * equipo es la ficha de equipo abierta encima.
 * La liga es la página; encima van, por orden, la ficha de equipo, el acta (partido)
 * y la ficha de jugador.
 * Para pasar a rutas bonitas (/league/3168...) basta con cambiar sidgadUrl y
 * sidgadLeerEstado.
 */

const SIDGAD_NAV_PARAMS = { liga: 'liga', vista: 'vista', filtro: 'filtro', orden: 'orden', min: 'min', equipo: 'equipo', previa: 'previa', partido: 'partido', pista: 'pista', jugador: 'jugador', temporada: 's' };
const SIDGAD_NAV_VACIO = { liga: null, vista: null, filtro: null, orden: null, min: null, equipo: null, previa: null, partido: null, pista: null, jugador: null, temporada: null };

let sidgadNavEstado = { ...SIDGAD_NAV_VACIO }; // lo que está pintado ahora mismo
let sidgadNavLigas = [];

function sidgadLeerEstado(search = location.search) {
  const query = new URLSearchParams(search);
  const entero = (param) => (/^\d+$/.test(query.get(param) || '') ? query.get(param) : null);
  const vista = query.get(SIDGAD_NAV_PARAMS.vista) || '';
  const orden = query.get(SIDGAD_NAV_PARAMS.orden) || '';

  const estado = {
    liga: entero(SIDGAD_NAV_PARAMS.liga),
    vista: /^[a-z_]+$/.test(vista) ? vista : null,
    filtro: entero(SIDGAD_NAV_PARAMS.filtro),
    orden: /^-?[a-z_]+$/.test(orden) ? orden : null,
    min: entero(SIDGAD_NAV_PARAMS.min),
    equipo: entero(SIDGAD_NAV_PARAMS.equipo),
    previa: entero(SIDGAD_NAV_PARAMS.previa),
    partido: entero(SIDGAD_NAV_PARAMS.partido),
    // Pista: por su nombre (es lo que une el calendario con /pistas/).
    pista: (query.get(SIDGAD_NAV_PARAMS.pista) || '').trim().slice(0, 150) || null,
    jugador: entero(SIDGAD_NAV_PARAMS.jugador),
    temporada: entero(SIDGAD_NAV_PARAMS.temporada),
  };
  // Funciones desactivadas en config.php: su parámetro se ignora (no se abre nada).
  const S = SIDGAD_SETTINGS;
  if (!S.has_league_page) estado.liga = null;
  if (!S.has_acta_digital) estado.partido = null;
  if (!S.has_previa) estado.previa = null;
  if (!S.has_team_page) estado.equipo = null;
  if (!S.has_player_overlay) estado.jugador = null;
  if (S.has_pistas === false) estado.pista = null;
  // La ficha de equipo es de una liga concreta.
  if (!estado.liga) estado.equipo = estado.filtro = null;
  // La ficha de jugador necesita la temporada (/profile/?id=&s=).
  if (!estado.jugador || !estado.temporada) estado.jugador = estado.temporada = null;
  return estado;
}

function sidgadUrl(estado) {
  const query = new URLSearchParams();
  for (const [clave, param] of Object.entries(SIDGAD_NAV_PARAMS)) {
    if (estado[clave]) query.set(param, estado[clave]);
  }
  // Modalidad forzada para pruebas en local (index_test.php sólo la acepta en localhost).
  const idm = new URLSearchParams(location.search).get('idm');
  if (idm) query.set('idm', idm);
  const texto = query.toString();
  return location.pathname + (texto ? `?${texto}` : '');
}

// Mezcla los cambios con la URL actual, la guarda en el historial y pinta el resultado.
function sidgadNavegar(cambios, { reemplazar = false } = {}) {
  const nuevo = { ...sidgadLeerEstado(), ...cambios };
  const profundidadActual = history.state?.sidgadProfundidad || 0;
  const estadoHistorial = { sidgadProfundidad: reemplazar ? profundidadActual : profundidadActual + 1 };

  if (reemplazar) history.replaceState(estadoHistorial, '', sidgadUrl(nuevo));
  else history.pushState(estadoHistorial, '', sidgadUrl(nuevo));

  sidgadAplicarEstado(sidgadLeerEstado());
}

// Cerrar una capa abierta desde el portal = volver atrás; si se entró por URL, se limpia la URL.
function sidgadCerrarCapa(cambios) {
  if ((history.state?.sidgadProfundidad || 0) > 0) history.back();
  else sidgadNavegar(cambios, { reemplazar: true });
}

/* ===== Acciones públicas ===== */

function sidgadAbrirLiga(idc) {
  sidgadNavegar({ ...SIDGAD_NAV_VACIO, liga: String(idc) });
}

function sidgadVolverACompeticiones() {
  sidgadNavegar({ ...SIDGAD_NAV_VACIO });
}

function sidgadAbrirVista(vista) {
  sidgadNavegar({ vista, orden: null, min: null });
}

// ligaId: la del partido, cuando se abre desde fuera de una liga (En directo).
function sidgadAbrirEquipo(teamId, ligaId = null) {
  sidgadNavegar({ ...(ligaId ? { liga: String(ligaId) } : {}), equipo: String(teamId), partido: null, previa: null, jugador: null, temporada: null });
}

function sidgadCerrarEquipo() {
  sidgadCerrarCapa({ equipo: null, partido: null, jugador: null, temporada: null });
}

function sidgadUrlEquipo(teamId, ligaId = null) {
  const estado = sidgadLeerEstado();
  return sidgadUrl({ ...estado, liga: ligaId ? String(ligaId) : estado.liga, equipo: teamId, partido: null, previa: null, jugador: null, temporada: null });
}

// Envuelve el nombre de un equipo en un enlace a su ficha. La ficha va dentro de una liga: la de
// la URL o, fuera de ella (En directo), la del partido (ligaId).
function sidgadEnlaceEquipo(teamId, contenidoHtml, ligaId = null) {
  if (SIDGAD_SETTINGS.has_team_page === false || SIDGAD_SETTINGS.has_league_page === false) return contenidoHtml;
  if (!teamId || String(teamId) === '0' || !(ligaId || sidgadLeerEstado().liga)) return contenidoHtml;
  return `<a class="sidgad-team-link sidgad-nav" href="${escaparHtml(sidgadUrlEquipo(teamId, ligaId))}">${contenidoHtml}</a>`;
}

// Ficha de pista (por su nombre, el del calendario). Se abre encima de lo que haya.
// Desde el acta, ésta se cierra: la ficha de pista queda por debajo del acta.
function sidgadUrlPista(nombre) {
  return sidgadUrl({ ...sidgadLeerEstado(), pista: String(nombre).trim(), partido: null, jugador: null, temporada: null });
}

function sidgadEnlacePista(nombre, contenidoHtml) {
  const texto = String(nombre || '').trim();
  if (!texto || SIDGAD_SETTINGS.has_pistas === false) return contenidoHtml;
  return `<a class="sidgad-pista-link sidgad-nav" href="${escaparHtml(sidgadUrlPista(texto))}">${contenidoHtml}</a>`;
}

function sidgadCerrarPista() {
  sidgadCerrarCapa({ pista: null, jugador: null, temporada: null });
}

// Previa: sólo para partidos de En directo que aún no han empezado.
function sidgadAbrirPrevia(gameId) {
  sidgadNavegar({ previa: String(gameId), partido: null, jugador: null, temporada: null });
}

function sidgadCerrarPrevia() {
  sidgadCerrarCapa({ previa: null, partido: null, jugador: null, temporada: null });
}

function sidgadAbrirPartido(gameId) {
  sidgadNavegar({ partido: String(gameId), jugador: null, temporada: null });
}

function sidgadCerrarPartido() {
  sidgadCerrarCapa({ partido: null, jugador: null, temporada: null });
}

function sidgadAbrirJugador(playerId, seasonId) {
  sidgadNavegar({ jugador: String(playerId), temporada: String(seasonId) });
}

function sidgadCerrarJugador() {
  sidgadCerrarCapa({ jugador: null, temporada: null });
}

function sidgadUrlJugador(playerId, seasonId) {
  return sidgadUrl({ ...sidgadLeerEstado(), jugador: playerId, temporada: seasonId });
}

// Envuelve el nombre de un jugador en un enlace a su ficha (si el portal tiene fichas).
function sidgadEnlaceJugador(playerId, seasonId, contenidoHtml) {
  if (!SIDGAD_SETTINGS.has_player_overlay || !playerId || String(playerId) === '0' || !seasonId) return contenidoHtml;
  const href = escaparHtml(sidgadUrlJugador(playerId, seasonId));
  return `<a class="sidgad-player-link sidgad-nav" href="${href}">${contenidoHtml}</a>`;
}

/* ===== Pintar el estado ===== */

function sidgadAplicarEstado(estado) {
  const previo = sidgadNavEstado;
  sidgadNavEstado = estado;

  if (estado.liga !== previo.liga) {
    const liga = sidgadNavLigas.find(l => String(l.idc) === estado.liga);
    if (liga) cargarLiga(liga, estado.vista);
    else if (previo.liga) volverACompeticiones();
  } else if (estado.liga && estado.vista !== previo.vista && sidgadLigaSeleccionada) {
    seleccionarBotonLiga(botonInicialLiga(sidgadLigaSeleccionada, estado.vista));
  }

  // Al cargar una liga el filtro lo marca createLigaHeader; aquí, si cambia dentro de la misma.
  if (estado.liga && estado.liga === previo.liga && estado.filtro !== previo.filtro) sidgadAplicarFiltroEquipo(estado.filtro);

  if (estado.equipo !== previo.equipo || (estado.equipo && estado.liga !== previo.liga)) {
    if (estado.equipo) window.sidgadEquipo?.abrir(estado.equipo);
    else if (previo.equipo) window.sidgadEquipo?.cerrar();
  }

  if (estado.previa !== previo.previa) {
    if (estado.previa) window.sidgadPrevia?.abrir(estado.previa);
    else if (previo.previa) window.sidgadPrevia?.cerrar();
  }

  if (estado.partido !== previo.partido) {
    if (estado.partido) window.sidgadActa?.abrir(estado.partido);
    else if (previo.partido) window.sidgadActa?.cerrar();
  }

  if (estado.pista !== previo.pista) {
    if (estado.pista) window.sidgadPista?.abrir(estado.pista);
    else if (previo.pista) window.sidgadPista?.cerrar();
  }

  const jugadorCambia = estado.jugador !== previo.jugador || estado.temporada !== previo.temporada;
  if (jugadorCambia) {
    if (estado.jugador) window.sidgadJugador?.abrir(estado.jugador, estado.temporada);
    else if (previo.jugador) window.sidgadJugador?.cerrar();
  }
}

// Se llama cuando ya están cargadas las ligas, para poder abrir la de la URL.
function sidgadIniciarNavegacion(ligas) {
  sidgadNavLigas = ligas || [];
  history.replaceState({ sidgadProfundidad: 0 }, '', location.href);
  sidgadAplicarEstado(sidgadLeerEstado());

  window.addEventListener('popstate', () => sidgadAplicarEstado(sidgadLeerEstado()));

  // Enlaces internos: clic normal navega sin recargar; Ctrl/Cmd+clic abre pestaña nueva.
  // En captura, porque los modales cortan la propagación de los clics.
  document.addEventListener('click', (event) => {
    const enlace = event.target.closest('a.sidgad-nav');
    if (!enlace || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    sidgadNavegar({ ...SIDGAD_NAV_VACIO, ...sidgadLeerEstado(new URL(enlace.href).search) });
  }, true);

  // Escape cierra la capa de arriba.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (sidgadNavEstado.jugador) sidgadCerrarJugador();
    else if (sidgadNavEstado.pista) sidgadCerrarPista();
    else if (sidgadNavEstado.partido) sidgadCerrarPartido();
    else if (sidgadNavEstado.previa) sidgadCerrarPrevia();
    else if (sidgadNavEstado.equipo) sidgadCerrarEquipo();
  });
}
