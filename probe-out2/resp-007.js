let sidgadLigaSeleccionada = null;

// label: en español; se traduce al pintar el botón.
const SIDGAD_LIGA_BUTTONS = {
  portada: { label: 'PORTADA', icon: 'fa-house', row: 'top' },
  calendar: { label: 'CALENDARIO Y RESULTADOS', icon: 'fa-calendar-days', row: 'top' },
  clasificaciones: { label: 'CLASIFICACIONES', icon: 'fa-list', row: 'top' },
  designaciones: { label: 'DESIGNACIONES ARBITRALES', icon: 'fa-clipboard-list', row: 'top' },
  estadisticas: { label: 'ESTADÍSTICAS', icon: 'fa-chart-simple', row: 'bottom' },
  goles: { label: 'GOLES', icon: 'fa-chart-simple', row: 'bottom' },
  // Disco en hockey línea y bola en hockey patines.
  asistencias: { label: 'ASISTENCIAS', icon: SIDGAD_API_CONFIG.idm === 'hp' ? 'sidgad-bola' : 'fa-hockey-puck', row: 'bottom' },
  puntos: { label: 'PUNTOS', icon: 'fa-trophy', row: 'bottom' },
  porteros: { label: 'PORTEROS', icon: 'fa-user-shield', row: 'bottom' },
  direct: { label: 'TARJETAS DIRECTAS', icon: 'fa-percentage', row: 'bottom' },
  penals: { label: 'PENALTIES', icon: 'fa-percentage', row: 'bottom' },
  blue_cards: { label: 'TARJETAS AZULES', icon: 'fa-square', row: 'bottom', iconColor: '#007bff' },
  plantillas: { label: 'PLANTILLAS', icon: 'fa-users', row: 'bottom' },
};

function normalizarBotonesLiga(botonesLiga) {
  if (typeof botonesLiga === 'string') {
    botonesLiga = 'portada,' + botonesLiga + ',plantillas';
    return [...new Set(botonesLiga
      .split(',')
      .map(boton => boton.trim().toLowerCase())
      .filter(Boolean))];
  }

  return [];
}

// Rankings que sustituye la tabla de estadísticas (siguen indicando qué columnas genera la liga).
const SIDGAD_BOTONES_RANKING = ['goles', 'asistencias', 'puntos', 'penals', 'direct', 'blue_cards'];

// Vistas que se pueden desactivar en config.php (el calendario siempre está).
const SIDGAD_VISTAS_AJUSTE = {
  portada: 'has_portada', clasificaciones: 'has_clasificaciones', designaciones: 'has_designaciones',
  estadisticas: 'has_estadisticas', porteros: 'has_porteros', plantillas: 'has_plantillas',
};

function botonesDeLiga(liga) {
  return botonesDeLigaTodos(liga).filter(key => !SIDGAD_VISTAS_AJUSTE[key] || SIDGAD_SETTINGS[SIDGAD_VISTAS_AJUSTE[key]] !== false);
}

function botonesDeLigaTodos(liga) {
  let botones = normalizarBotonesLiga(liga?.botones_liga);
  // Un único botón "Estadísticas" en el sitio del primer ranking.
  const primero = botones.findIndex(key => SIDGAD_BOTONES_RANKING.includes(key));
  if (primero >= 0) {
    botones = botones.filter(key => !SIDGAD_BOTONES_RANKING.includes(key));
    botones.splice(primero, 0, 'estadisticas');
  }
  return botones;
}

function seleccionarBotonLiga(key) {
  const botones = document.querySelectorAll('.sidgad-liga-header-btn');

  botones.forEach(boton => {
    const esActivo = boton.dataset.ligaButton === key;
    boton.classList.toggle('sidgad-activo', esActivo);
    boton.setAttribute('aria-pressed', esActivo ? 'true' : 'false');
  });

  document.dispatchEvent(new CustomEvent('sidgad:liga-header-tab-change', {
    detail: {
      liga: sidgadLigaSeleccionada,
      button: key,
    },
  }));

  const mainContent = document.getElementById('sidgad-liga-main-content');
  if (mainContent) mainContent.dataset.vista = key;

  switch (key) {
    case 'portada':
      cargarPortada();
      break;
    case 'calendar':
      cargarCalendario();
      break;
    case 'clasificaciones':
      cargarClasificaciones();
      break;
    case 'estadisticas':
      cargarEstadisticas('jugadores');
      break;
    case 'porteros':
      cargarEstadisticas('porteros');
      break;
    case 'plantillas':
      cargarPlantillas();
      break;
    case 'designaciones':
      cargarDesignaciones();
      break;
    default:
      console.warn(`Botón de liga desconocido: ${key}`);
  }
}

function crearBotonLiga(key, selected = false) {
  const config = SIDGAD_LIGA_BUTTONS[key];
  const boton = document.createElement('button');

  boton.type = 'button';
  boton.className = `sidgad-liga-header-btn${selected ? ' sidgad-activo' : ''}`;
  boton.dataset.ligaButton = key;
  boton.setAttribute('aria-pressed', selected ? 'true' : 'false');
  boton.setAttribute('title', sidgadT(config.label));
  boton.setAttribute('aria-label', config.label);
  boton.innerHTML = `<i class="fa-solid ${config.icon}" style="color: ${config.iconColor || 'inherit'};"  aria-hidden="true"></i><span>${sidgadT(config.label)}</span>`;

  boton.addEventListener('click', () => sidgadAbrirVista(key));

  return boton;
}

// Pinta la liga; la navegación (URL) la gestiona sidgad-router.js.
function cargarLiga(liga, vista = null) {
  showSidgadLoading();
  sidgadLigaSeleccionada = liga;
  sincronizarTemporadaLiga(liga);
  createLigaHeader(liga, vista);
  mostrarVistaLiga();
  hideSidgadLoading();
}

// Al volver a competiciones se ve la temporada de la liga que se estaba mirando.
function sincronizarTemporadaLiga(liga) {
  const selector = document.getElementById('sidgad-season-selector');
  if (!liga?.id_temp || !selector || ![...selector.options].some(o => o.value === liga.id_temp)) return;
  selector.value = liga.id_temp;
  sidgadCurrentSeasonId = liga.id_temp;
  toggleSeasonVisibilty();
}

// Vista pedida si la liga la tiene; si no, la de por defecto; si no, la primera.
function botonInicialLiga(liga, preferido = null) {
  const permitidos = botonesDeLiga(liga).filter(key => SIDGAD_LIGA_BUTTONS[key]);
  const porDefecto = String(liga?.default_btn || '').trim().toLowerCase();
  if (preferido && permitidos.includes(preferido)) return preferido;
  if (porDefecto && permitidos.includes(porDefecto)) return porDefecto;
  return permitidos[0] || '';
}

function createLigaHeader(liga, vista = null) {
  const tituloLiga = document.getElementById('sidgad-liga-title');
  const logoLiga = document.getElementById('sidgad-liga-header-logo');
  const selectorEquipos = document.getElementById('sidgad-liga-team-selector');
  const botonesTop = document.querySelector('.sidgad-liga-header-btns-top');
  const botonesBottom = document.querySelector('.sidgad-liga-header-btns-bottom');
  const botonVolver = document.getElementById('sidgad-liga-volver');

  if (tituloLiga) tituloLiga.innerHTML = `${escaparHtml(liga?.nombre_idc ?? '')} <span>| ${escaparHtml(liga?.nombre_temp ?? '')}</span>`;

  if (logoLiga) {
    logoLiga.onerror = () => sidgadLogoCompeticionFallo(logoLiga);
    logoLiga.src = sidgadLogoCompeticion(liga);
    logoLiga.alt = liga?.nombre_idc ? sidgadT('Logo de {nombre}', { nombre: liga.nombre_idc }) : sidgadT('Logo de la liga');
    logoLiga.hidden = false;
  }

  const botonesPermitidos = botonesDeLiga(liga);
  const botonActivo = botonInicialLiga(liga, vista);

  if (botonesTop) botonesTop.replaceChildren();
  if (botonesBottom) botonesBottom.replaceChildren();

  botonesPermitidos.forEach(key => {
    const config = SIDGAD_LIGA_BUTTONS[key];
    if (!config) return;

    const boton = crearBotonLiga(key, false);
    if (config.row === 'bottom') botonesBottom?.appendChild(boton);
    else botonesTop?.appendChild(boton);
  });

  if (botonesTop) botonesTop.hidden = !botonesTop.childElementCount;
  if (botonesBottom) botonesBottom.hidden = !botonesBottom.childElementCount;

  // El selector va antes que la vista, para que ésta se pinte ya con el equipo de la URL (?filtro=).
  if (selectorEquipos) {
    const filtro = sidgadNavEstado?.filtro || null;
    selectorEquipos.replaceChildren();
    const frag = document.createDocumentFragment();
    (liga?.teams || []).forEach(team => {
      const marcado = !!filtro && String(team.teamId) === filtro;
      const btn = crearNodo('button', { type: 'button', class: `sidgad-team-selector-item${marcado ? ' sidgad-activo' : ''}`, title: team.name || '', 'aria-label': sidgadT('Ver equipo {nombre}', { nombre: team.name || '' }), 'aria-pressed': String(marcado), 'data-team-id': team.teamId || '', 'data-team-name': team.name || '' },
        crearNodo('img', { src: team.team_logo || SIDGAD_DEFAULT_LOGO, alt: team.name || sidgadT('Equipo'), class: 'sidgad-team-selector-logo', loading: 'lazy', onerror: `this.src='${SIDGAD_DEFAULT_LOGO}'` }),
        crearNodo('span', { class: 'sidgad-team-selector-name', text: team.name_short || '' })
      );

      // Pulsar el marcado lo quita. Cambiar de equipo no añade entradas al historial.
      btn.addEventListener('click', () => {
        const yaMarcado = btn.classList.contains('sidgad-activo');
        sidgadNavegar({ filtro: yaMarcado ? null : String(team.teamId) }, { reemplazar: true });
      });

      frag.appendChild(btn);
    });
    selectorEquipos.appendChild(frag);
    selectorEquipos.querySelector('.sidgad-activo')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  if (botonActivo) seleccionarBotonLiga(botonActivo);

  if (botonVolver) botonVolver.onclick = sidgadVolverACompeticiones;
}

// Marca en el selector el equipo del filtro (o ninguno) y avisa a las vistas.
function sidgadAplicarFiltroEquipo(teamId) {
  const selector = document.getElementById('sidgad-liga-team-selector');
  if (!selector) return;
  let elegido = null;
  selector.querySelectorAll('.sidgad-team-selector-item').forEach(boton => {
    const marcado = !!teamId && boton.dataset.teamId === String(teamId);
    boton.classList.toggle('sidgad-activo', marcado);
    boton.setAttribute('aria-pressed', String(marcado));
    if (marcado) elegido = boton;
  });
  document.dispatchEvent(new CustomEvent('sidgad:liga-team-select', {
    detail: { mode: elegido ? 'select' : 'deselect', teamId: elegido?.dataset.teamId ?? null },
  }));
}

function mostrarVistaLiga() {
  const vistaPrincipal = document.getElementById('sidgad-vista-principal');
  const vistaLiga = document.getElementById('sidgad-vista-liga');

  if (vistaPrincipal) vistaPrincipal.hidden = true;
  if (vistaLiga) {
    vistaLiga.classList.remove('sidgad-liga-hidden', 'sidgad-liga-hiding');
    vistaLiga.classList.add('sidgad-liga-showing');
  }
}

function volverACompeticiones() {
  const vistaPrincipal = document.getElementById('sidgad-vista-principal');
  const vistaLiga = document.getElementById('sidgad-vista-liga');

  if (vistaPrincipal) vistaPrincipal.hidden = false;

  if (vistaLiga) {
    vistaLiga.classList.remove('sidgad-liga-showing');
    vistaLiga.classList.add('sidgad-liga-hiding');
    setTimeout(() => {
      vistaLiga.classList.add('sidgad-liga-hidden');
      vistaLiga.classList.remove('sidgad-liga-hiding');
    }, 300);
  }
}

// Botones de acta y vídeo de las filas de partidos: se escuchan en todo el documento, porque
// también salen en capas fuera de la liga (ficha de equipo).
let sidgadAccionesCalendarioInstaladas = false;
function instalarAccionesCalendario() {
  if (sidgadAccionesCalendarioInstaladas) return;
  sidgadAccionesCalendarioInstaladas = true;

  document.addEventListener('click', (event) => {
    const boton = event.target.closest('button[data-calendar-action]');
    if (!boton) return;

    const accion = boton.dataset.calendarAction;

    if (accion === 'details') {
      const matchId = Number(boton.dataset.matchId);
      if (Number.isFinite(matchId)) sidgadAbrirPartido(matchId);
      return;
    }

    if (accion === 'video') sidgadAbrirVideo(boton.dataset.videoUrl || '', boton.dataset.videoType || '');

  });
}

async function cargarCalendario() {
  const mainContent = document.getElementById('sidgad-liga-main-content');
  showLeagueLoading();
  const ligaId = sidgadLigaSeleccionada?.idc;
  const hasPista = sidgadLigaSeleccionada?.mostrar_pistas ?? false;

  if (!mainContent || !ligaId) {
    console.warn('No se puede cargar el calendario: faltan datos de la liga o el contenedor principal.');
    return;
  }

  try {
    const liga = sidgadLigaSeleccionada;
    const agrupada = liga?.agrupada === true;
    let data;
    let clasif = null;
    try {
      const [calendario, bloques] = await Promise.all([
        sidgadFetch('calendar', { id: ligaId }),
        agrupada ? sidgadCargarClasificaciones(ligaId) : Promise.resolve([]),
      ]);
      data = calendario;
      if (sidgadLigaSeleccionada === liga) sidgadPieDatosLiga(agrupada ? { calendar: calendario, standing: bloques } : { calendar: calendario });
      if (bloques.length) clasif = sidgadClasifPorFase(bloques, sidgadFasesCalendario(calendario?.games));
    } catch (error) {
      console.error('Error al cargar calendario', error);
      mainContent.replaceChildren(crearNodo('p', { class: 'sidgad-empty-state', text: sidgadT('No se ha podido cargar el calendario.') }));
      return;
    }

    if (!data?.games?.length) {
      mainContent.replaceChildren(crearNodo('p', { class: 'sidgad-empty-state', text: sidgadT('No hay partidos disponibles para mostrar.') }));
      return;
    }

    mainContent.replaceChildren();
    instalarAccionesCalendario();
    let lastType = null;
    const innerHtml = [];

    const abrirTablaSiHaceFalta = () => {
      if (!lastType || lastType === 'fase') {
        innerHtml.push('<div class="sidgad-calendario-scroll"><table class="sidgad-calendario-table"><colgroup><col class="sidgad-col-dia"><col class="sidgad-col-hora">');
        if (hasPista) innerHtml.push('<col class="sidgad-col-pista">');
        innerHtml.push('<col class="sidgad-col-logo"><col class="sidgad-col-equipo"><col class="sidgad-col-logo"><col class="sidgad-col-equipo"><col class="sidgad-col-bonus"><col class="sidgad-col-resultado"><col class="sidgad-col-bonus"><col class="sidgad-col-accion"><col class="sidgad-col-accion"></colgroup><tbody>')
      }
    };

    const cerrarTablaSiEstaAbierta = () => {
      if (lastType && lastType !== 'fase') innerHtml.push('</tbody></table></div>');
    };

    const colsPan = hasPista ? 12 : 11;

    // Ligas agrupadas: al terminar los partidos de una fase va su clasificación. Las fases se
    // cuentan como en sidgadFasesCalendario (partidos antes de la primera FASE = fase 0 sin nombre).
    let faseActual = null;
    let faseIndice = -1;
    const cerrarFase = () => {
      cerrarTablaSiEstaAbierta();
      lastType = 'fase';
      if (clasif && faseIndice >= 0) innerHtml.push(clasif.tras(faseIndice));
    };

    // Cuadros de copa y playoff: los partidos se buscan por idp (con su ronda, que es la jornada).
    const partidosCopa = new Map(sidgadPartidosCalendario(data.games).map(p => [String(p.idp), p]));
    const desempates = sidgadCalendarioDesempates(data.games);

    data.games.forEach(row => {
      if (String(row.idp) === '0') {
        if ((row.dia_partido === 'MODEL_COPA' || row.dia_partido === 'MODEL_PLAYOFF') && SIDGAD_SETTINGS.has_cuadros !== false) {
          cerrarTablaSiEstaAbierta();
          innerHtml.push(row.dia_partido === 'MODEL_COPA' ? sidgadCopaCuadro(row, partidosCopa, faseActual) : sidgadPlayoffCuadro(row, partidosCopa, faseActual));
          lastType = 'fase';
        } else if (row.dia_partido === 'FASE') {
          if (clasif) cerrarFase();
          cerrarTablaSiEstaAbierta();
          faseActual = row.home_name;
          faseIndice++;
          if (sidgadNombreFase(row.home_name)) innerHtml.push(`<h2 class="sidgad-calendario-fase">${escaparHtml(row.home_name)}</h2>`);
          lastType = 'fase';
        } else if (row.dia_partido === 'JORNADA') {
          abrirTablaSiHaceFalta();
          innerHtml.push(`<tr class="sidgad-calendario-jornada"><td colspan="${colsPan}">${escaparHtml(sidgadTApi(row.home_name))}</td></tr>`);
          lastType = 'jornada';
        } else if (row.dia_partido === 'ANOTACION') {
          abrirTablaSiHaceFalta();
          innerHtml.push(`<tr class="sidgad-calendario-anotacion"><td colspan="${colsPan}">${escaparHtml(row.home_name)}</td></tr>`);
          lastType = 'anotacion';
        }
      } else {
        if (faseIndice < 0) faseIndice = 0;
        abrirTablaSiHaceFalta();
        innerHtml.push(`<tr class="sidgad-calendario-partido team-${escaparHtml(row.home_id)} team-${escaparHtml(row.away_id)}">
          <td class="sidgad-col-dia">${escaparHtml(row.dia_partido)}</td>
          <td class="sidgad-col-hora">${escaparHtml(row.hora_partido)}</td>
          ${hasPista ? `<td class="sidgad-col-pista">${sidgadEnlacePista(row.pista, escaparHtml(row.pista || ''))}</td>` : ''}
          <td class="sidgad-col-logo sidgad-col-logo-home"><img src="${escaparHtml(row.home_logo)}" onerror="this.style.display='none'" alt="${escaparHtml(row.home_name)}" class="sidgad-calendario-logo"></td>
          <td class="sidgad-col-equipo sidgad-col-equipo-home">${sidgadEnlaceEquipo(row.home_id, escaparHtml(row.home_name))}</td>
          <td class="sidgad-col-logo sidgad-col-logo-away"><img src="${escaparHtml(row.away_logo)}" onerror="this.style.display='none'" alt="${escaparHtml(row.away_name)}" class="sidgad-calendario-logo"></td>
          <td class="sidgad-col-equipo sidgad-col-equipo-away">${sidgadEnlaceEquipo(row.away_id, escaparHtml(row.away_name))}</td>
          <td class="sidgad-col-bonus sidgad-col-bonus-home">${row.home_bonus === 'true' ? '<span class="sidgad-bonus-badge">B</span>' : ''}</td>
          <td class="sidgad-col-resultado">${row.result ? `<span class="sidgad-resultado-badge">${escaparHtml(row.result || '')}</span>${sidgadDesempateHtml({ ...row, desempate: desempates.get(String(row.idp)) })}` : ''}</td>
          <td class="sidgad-col-bonus sidgad-col-bonus-away">${row.away_bonus === 'true' ? '<span class="sidgad-bonus-badge">B</span>' : ''}</td>
          <td class="sidgad-col-accion sidgad-col-accion-details">${SIDGAD_SETTINGS.has_acta_digital && sidgadPartidoJugado(row) ? `<button type="button" class="sidgad-calendario-action-btn sidgad-calendario-action-details" data-calendar-action="details" data-match-id="${escaparHtml(row.idp)}" aria-label="${sidgadT('Ver detalles del partido')}"><i class="fas fa-search" aria-hidden="true"></i></button>` : ''}</td>
          <td class="sidgad-col-accion sidgad-col-accion-video">${row.url_video ? `<button type="button" class="sidgad-calendario-action-btn sidgad-calendario-action-video" data-calendar-action="video" data-video-type="${escaparHtml(row.tipo_video || '')}" data-video-url="${escaparHtml(row.url_video)}" aria-label="${sidgadT('Ver vídeo del partido')}"><i class="fas fa-video" aria-hidden="true"></i></button>` : ''}</td>
        </tr>`);
        lastType = 'partido';
      }
    });

    if (clasif) {
      cerrarFase();
      innerHtml.push(clasif.restantes());
    } else {
      cerrarTablaSiEstaAbierta();
    }
    if (sidgadLigaSeleccionada !== liga) return; // se cambió de liga mientras cargaba
    mainContent.innerHTML = innerHtml.join('');
    sidgadFiltrarCalendario();
  } finally {
    hideSidgadLoading();
  }
}

// Equipo marcado en el selector de la cabecera: es lo que manda en todas las vistas de la liga,
// así al cambiar de pestaña cada una se pinta ya filtrada.
function sidgadEquipoLigaActivo() {
  return document.querySelector('#sidgad-liga-team-selector .sidgad-team-selector-item.sidgad-activo')?.dataset.teamId || null;
}

// Con un equipo elegido sólo quedan sus partidos, y se ocultan las jornadas, clasificaciones,
// cuadros y fases en los que no aparece. Sin equipo se vuelve a ver todo.
function sidgadFiltrarCalendario() {
  const raiz = document.getElementById('sidgad-liga-main-content');
  if (!raiz || raiz.dataset.vista !== 'calendar') return;
  const equipo = sidgadEquipoLigaActivo();
  const ocultar = (el, siNo) => el.classList.toggle('sidgad-hide', !!equipo && siNo);
  const visible = el => !el.classList.contains('sidgad-hide');

  raiz.querySelectorAll('.sidgad-calendario-partido').forEach(p => ocultar(p, !p.classList.contains(`team-${equipo}`)));

  // Una jornada son las filas desde su cabecera hasta la siguiente (con sus anotaciones).
  raiz.querySelectorAll('.sidgad-calendario-table tbody').forEach(tbody => {
    let grupo = [];
    const cerrar = () => {
      const partidos = grupo.filter(tr => tr.classList.contains('sidgad-calendario-partido'));
      const sinPartidos = !partidos.some(visible);
      grupo.filter(tr => !partidos.includes(tr)).forEach(tr => ocultar(tr, sinPartidos));
      grupo = [];
    };
    [...tbody.rows].forEach(tr => {
      if (tr.classList.contains('sidgad-calendario-jornada')) cerrar();
      grupo.push(tr);
    });
    cerrar();
    const scroll = tbody.closest('.sidgad-calendario-scroll');
    if (scroll) ocultar(scroll, ![...tbody.rows].some(tr => tr.classList.contains('sidgad-calendario-partido') && visible(tr)));
  });

  sidgadMarcarEquipoClasif();
  sidgadCopaFiltrar();
  raiz.querySelectorAll(':scope > .sidgad-copa').forEach(c => ocultar(c, !c.querySelector(`.team-${CSS.escape(String(equipo))}`)));

  // Fases: la banda se oculta si no queda nada visible hasta la siguiente.
  let banda = null;
  let contenido = [];
  let primera = true;
  const cerrarFase = () => {
    if (banda) {
      ocultar(banda, !contenido.some(visible));
      banda.classList.toggle('sidgad-primera-visible', primera && visible(banda));
      if (visible(banda)) primera = false;
    } else if (contenido.some(visible)) {
      primera = false;
    }
    contenido = [];
  };
  [...raiz.children].forEach(el => {
    if (el.matches('h2.sidgad-calendario-fase')) {
      cerrarFase();
      banda = el;
    } else {
      contenido.push(el);
    }
  });
  cerrarFase();
}

document.addEventListener('sidgad:liga-team-select', sidgadFiltrarCalendario);

function showLeagueLoading() {
  const mainContent = document.getElementById('sidgad-liga-main-content');
  sidgadPieDatosLiga();
  if (mainContent) {
    mainContent.replaceChildren();
    mainContent.innerHTML = `<div id="sidgad-loading-overlay" class="sidgad-activo">
      <div class="sidgad-spinner"></div>
      <div class="sidgad-loading-texto">${sidgadT('CARGANDO')}</div>
    </div>`;
  }
}