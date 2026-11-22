/*
 * Ficha de jugador: pestañas Resumen (con gráficas) y Partidos.
 * El diseño depende del papel (jugador de campo o portero) y de la modalidad
 * (SIDGAD_API_CONFIG.idm). Un jugador puede jugar varias competiciones en la
 * temporada: cada header_tournament de /profile/ es una competición.
 * En HL /profile/ separa los partidos de portero en goalie_stats; si el jugador
 * tiene partidos en las dos listas se puede cambiar de papel, y sale primero
 * el que indica player.is_goalie.
 */

const SIDGAD_FICHA_CAMPO = {
  hl: [
    { clave: 'goals', corto: sidgadT('G'), largo: sidgadT('Goles'), ranking: 'goals' },
    { clave: 'asist', corto: sidgadT('A'), largo: sidgadT('Asistencias'), ranking: 'asist' },
    { clave: 'points', corto: sidgadT('PTS'), largo: sidgadT('Puntos'), ranking: 'points' },
    { clave: 'pim', corto: sidgadT('PIM'), largo: sidgadT('Min. sanción'), ranking: 'pim', tiempo: true },
  ],
  hp: [
    { clave: 'goals', corto: sidgadT('G'), largo: sidgadT('Goles'), ranking: 'goals' },
    { clave: 'asist', corto: sidgadT('As'), largo: sidgadT('Asistencias'), ranking: 'asist' },
    { clave: 'direct', corto: sidgadT('FD'), largo: sidgadT('Faltas directas'), fraccion: true },
    { clave: 'penals', corto: sidgadT('PE|penaltis'), largo: sidgadT('Penaltis'), fraccion: true },
    { clave: 'blue_card', corto: sidgadT('Az'), largo: sidgadT('Azules') },
    { clave: 'red_card', corto: sidgadT('Rj'), largo: sidgadT('Rojas') },
  ],
};

// Campos de goalie_stats en /profile/; `stats` es el campo equivalente en /stats/ (lista goalies).
const SIDGAD_FICHA_PORTERO = [
  { clave: 'goalie_time', corto: sidgadT('MIN'), largo: sidgadT('Minutos'), reloj: true },
  { clave: 'goalie_shoots', corto: sidgadT('TIR'), largo: sidgadT('Tiros recibidos'), stats: 'goalie_shoots' },
  { clave: 'goalie_saves', corto: sidgadT('PAR'), largo: sidgadT('Paradas') },
  { clave: 'goalie_goals', corto: sidgadT('GC'), largo: sidgadT('Goles en contra'), stats: 'goalie_goals' },
  { clave: 'goalie_porc', corto: sidgadT('SV%'), largo: sidgadT('% de paradas'), stats: 'goalie_porc', formato: 'porc', ranking: 'goalie_porc' },
  { clave: 'goalie_gaa', corto: sidgadT('GAA'), largo: sidgadT('Goles en contra/partido'), stats: 'goalie_goals_pp', decimales: 2, ranking: 'goalie_goals_pp', menorMejor: true, soloTotal: true },
  { clave: 'pim', corto: sidgadT('PIM'), largo: sidgadT('Min. sanción'), tiempo: true },
];

const sidgadFicha = {
  playerId: null,
  esPortero: false,
  rol: 'campo',
  roles: { campo: [], portero: [] }, // competiciones de cada papel
  orden: ['campo', 'portero'], // papel principal primero
  partidosRol: {},
  competiciones: [], // las del papel elegido
  filtro: 'todas',
  pestana: 'resumen',
  statsLiga: {}, // 'rol:idc' -> { lista, fila } de /stats/ (del jugador abierto)
};

/* ===== Datos ===== */

function sidgadFichaMetricas() {
  if (sidgadFicha.esPortero) return SIDGAD_FICHA_PORTERO;
  return SIDGAD_FICHA_CAMPO[SIDGAD_API_CONFIG.idm] || SIDGAD_FICHA_CAMPO.hl;
}

function sidgadFichaCompeticiones(stats = [], rol = 'campo', logoPropio = '') {
  const competiciones = [];
  let actual = null;
  let fase = null;

  stats.forEach(fila => {
    if (fila.description === 'header_tournament') {
      actual = {
        id: `${rol}-${competiciones.length}`,
        rol,
        idc: fila.tournament_idc ? String(fila.tournament_idc) : null,
        nombre: fila.tournament_name || sidgadT('Competición'),
        totales: fila,
        partidos: [],
      };
      competiciones.push(actual);
      fase = null;
    } else if (fila.description === 'header_phase') {
      fase = fila.phase_name || null;
    } else if (fila.description === 'game_line' && actual) {
      actual.partidos.push({ ...fila, fase });
    }
  });

  competiciones.forEach(c => { c.equipo = sidgadFichaEquipoPropio(c.partidos, logoPropio); });
  return competiciones.filter(sidgadFichaEnZona);
}

// Zona en modo 'limit': sólo las competiciones de la zona. header_tournament traerá id_zone; mientras
// no llegue, cuenta que la competición (tournament_idc) esté entre las ligas de la zona.
function sidgadFichaEnZona(c) {
  if (typeof SIDGAD_ZONAS === 'undefined' || SIDGAD_ZONAS.modo !== 'limit' || !SIDGAD_ZONAS.limitador) return true;
  if (sidgadZonaId(c.totales)) return sidgadZonaVisible(c.totales);
  if (!c.idc) return true;
  return (typeof sidgadNavLigas !== 'undefined' ? sidgadNavLigas : []).some(l => String(l.idc) === c.idc);
}

// El equipo del jugador es el del escudo de player.team_logo; si no, el que aparece en todos sus partidos.
function sidgadFichaEquipoPropio(partidos, logoPropio = '') {
  const archivo = url => String(url || '').split('/').pop().toLowerCase();
  const logo = archivo(logoPropio);
  if (logo) {
    const conLogo = partidos.find(p => archivo(p.home_logo) === logo || archivo(p.away_logo) === logo);
    if (conLogo) return archivo(conLogo.home_logo) === logo ? conLogo.home_name : conLogo.away_name;
  }
  const cuenta = {};
  partidos.forEach(p => [p.home_name, p.away_name].forEach(n => { cuenta[n] = (cuenta[n] || 0) + 1; }));
  return Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function sidgadFichaRival(partido, equipo) {
  return partido.home_name === equipo ? partido.away_name : partido.home_name;
}

// "7/13" -> { hechos: 7, intentos: 13 }
function sidgadFichaFraccion(valor) {
  const [hechos, intentos] = String(valor ?? '').split('/').map(v => sidgadNum(v));
  return hechos === null || intentos === null ? null : { hechos, intentos };
}

// "MM:SS" -> segundos (los minutos pueden pasar de 60 en los totales).
function sidgadFichaRelojSegundos(valor) {
  const partes = String(valor ?? '').trim().split(':');
  if (partes.length !== 2 || partes.some(p => !/^\d+$/.test(p))) return null;
  return Number(partes[0]) * 60 + Number(partes[1]);
}

function sidgadFichaRelojTexto(segundos) {
  return `${Math.floor(segundos / 60)}:${String(Math.round(segundos % 60)).padStart(2, '0')}`;
}

function sidgadFichaValor(fila, metrica) {
  if (!fila) return null;
  if (metrica.reloj) return sidgadFichaRelojSegundos(fila[metrica.clave]);
  if (metrica.tiempo) return sidgadPimSegundos(fila[metrica.clave]);
  return metrica.fraccion ? sidgadFichaFraccion(fila[metrica.clave]) : sidgadNum(fila[metrica.clave]);
}

function sidgadFichaJugados(competicion) {
  return sidgadNum(competicion.totales.played) ?? competicion.partidos.length;
}

// Totales de una competición; para porteros, lo que falte en /profile/ se completa con /stats/.
function sidgadFichaLiga(competicion) {
  return competicion.idc ? sidgadFicha.statsLiga[`${competicion.rol}:${competicion.idc}`] : null;
}

function sidgadFichaTotales(competicion) {
  const filaLiga = sidgadFichaLiga(competicion)?.fila;
  const totales = { jugados: sidgadFichaJugados(competicion) };
  sidgadFichaMetricas().forEach(m => {
    let valor = sidgadFichaValor(competicion.totales, m);
    if (valor === null && m.stats && filaLiga) valor = sidgadNum(filaLiga[m.stats]);
    totales[m.clave] = valor;
  });
  return totales;
}

// Suma de varias competiciones; los porcentajes y medias se recalculan.
function sidgadFichaSumar(listaTotales) {
  const suma = { jugados: listaTotales.reduce((t, x) => t + (x.jugados || 0), 0) };
  sidgadFichaMetricas().forEach(m => {
    const valores = listaTotales.map(x => x[m.clave]).filter(v => v !== null && v !== undefined);
    if (!valores.length) { suma[m.clave] = null; return; }
    if (m.fraccion) suma[m.clave] = valores.reduce((t, v) => ({ hechos: t.hechos + v.hechos, intentos: t.intentos + v.intentos }), { hechos: 0, intentos: 0 });
    else if (m.formato === 'porc' || m.decimales) suma[m.clave] = null;
    else suma[m.clave] = valores.reduce((t, v) => t + v, 0);
  });
  if (sidgadFicha.esPortero) {
    if (suma.goalie_shoots && suma.goalie_goals !== null) suma.goalie_porc = (suma.goalie_shoots - suma.goalie_goals) / suma.goalie_shoots;
    if (suma.jugados && suma.goalie_goals !== null) suma.goalie_gaa = suma.goalie_goals / suma.jugados;
  }
  return suma;
}

function sidgadFichaFormato(metrica, valor) {
  if (valor === null || valor === undefined) return '—';
  if (metrica.fraccion) return `${valor.hechos}/${valor.intentos}`;
  if (metrica.reloj) return sidgadFichaRelojTexto(valor);
  if (metrica.tiempo) return sidgadPimTexto(valor);
  if (metrica.formato === 'porc') return `${(valor <= 1 ? valor * 100 : valor).toLocaleString(SIDGAD_LOCALE, { maximumFractionDigits: 1 })}%`;
  if (metrica.decimales) return valor.toLocaleString(SIDGAD_LOCALE, { minimumFractionDigits: metrica.decimales, maximumFractionDigits: metrica.decimales });
  return valor.toLocaleString(SIDGAD_LOCALE);
}

function sidgadFichaSeleccionadas() {
  if (sidgadFicha.filtro === 'todas') return sidgadFicha.competiciones;
  return sidgadFicha.competiciones.filter(c => c.id === sidgadFicha.filtro);
}

// Puesto del jugador en la liga (necesita tournament_idc en /profile/).
async function sidgadFichaCargarLiga(competicion) {
  const idc = competicion.idc;
  const clave = `${competicion.rol}:${idc}`;
  if (!idc || sidgadFicha.statsLiga[clave]) return;
  sidgadFicha.statsLiga[clave] = { cargando: true };
  try {
    const data = await sidgadFetch('stats', { id: idc }, { cache: true });
    const lista = (competicion.rol === 'portero' ? data?.stats?.goalies : data?.stats?.rosters) || [];
    const fila = lista.find(f => String(f.player_id) === String(sidgadFicha.playerId)) || null;
    sidgadFicha.statsLiga[clave] = { lista, fila };
  } catch (err) {
    sidgadFicha.statsLiga[clave] = { lista: [], fila: null };
  }
  sidgadFichaPintar();
}

// Bonus de los partidos de la competición (game_line no lo trae): se lee del calendario de la liga.
async function sidgadFichaCargarBonus(competicion) {
  if (!competicion.idc) return;
  const bonus = await sidgadBonusLiga(competicion.idc);
  competicion.bonus = bonus;
  const sigueAbierta = sidgadFicha.roles[competicion.rol]?.includes(competicion);
  if (sigueAbierta && competicion.partidos.some(p => bonus.has(String(p.game_id)))) sidgadFichaPintar();
}

function sidgadFichaPuesto(competicion, metrica) {
  const liga = sidgadFichaLiga(competicion);
  if (!metrica.ranking || !liga?.fila) return '';
  const leer = v => (metrica.tiempo ? sidgadPimSegundos(v) : sidgadNum(v));
  const mio = leer(liga.fila[metrica.ranking]);
  if (mio === null) return '';
  const valores = liga.lista.map(f => leer(f[metrica.ranking])).filter(v => v !== null);
  const mejores = valores.filter(v => (metrica.menorMejor ? v < mio : v > mio)).length;
  return sidgadT('{n}º de {total}', { n: mejores + 1, total: valores.length });
}

/* ===== Pintar ===== */

// Entrada: se llama al abrir la ficha con la respuesta de /profile/.
function sidgadFichaIniciar(playerId, data) {
  const player = data?.player || {};
  const portero = player.is_goalie === true;
  sidgadFicha.playerId = playerId;
  sidgadFicha.perfil = data; // para el pie con su Last-Modified
  sidgadFicha.pestana = 'resumen';
  sidgadFicha.statsLiga = {}; // /stats/ va cacheado en sidgadFetch

  if (Array.isArray(data?.goalie_stats)) {
    sidgadFicha.roles = {
      campo: sidgadFichaCompeticiones(data.stats, 'campo', player.team_logo),
      portero: sidgadFichaCompeticiones(data.goalie_stats, 'portero', player.team_logo),
    };
  } else {
    // Sin goalie_stats (HP o API anterior), stats es la lista del papel de is_goalie.
    const rol = portero ? 'portero' : 'campo';
    sidgadFicha.roles = { campo: [], portero: [], [rol]: sidgadFichaCompeticiones(data?.stats, rol, player.team_logo) };
  }
  sidgadFicha.orden = portero ? ['portero', 'campo'] : ['campo', 'portero'];
  const partidos = rol => sidgadFicha.roles[rol].reduce((t, c) => t + c.partidos.length, 0);
  sidgadFicha.partidosRol = {
    campo: sidgadNum(player.skater_games) ?? partidos('campo'),
    portero: sidgadNum(player.goalie_games) ?? partidos('portero'),
  };

  const rol = sidgadFicha.orden.find(r => sidgadFicha.roles[r].length) || sidgadFicha.orden[0];
  [...sidgadFicha.roles.campo, ...sidgadFicha.roles.portero].forEach(c => {
    sidgadFichaCargarLiga(c);
    sidgadFichaCargarBonus(c);
  });
  // Si se llega desde una liga, esa competición sale seleccionada.
  sidgadFichaElegirRol(rol, sidgadNavEstado?.liga);
}

// Cambia de papel conservando, si existe en el otro, la competición elegida.
function sidgadFichaElegirRol(rol, idc = null) {
  sidgadFicha.rol = rol;
  sidgadFicha.esPortero = rol === 'portero';
  sidgadFicha.competiciones = sidgadFicha.roles[rol];

  const elegida = idc ? sidgadFicha.competiciones.find(c => c.idc && c.idc === String(idc)) : null;
  sidgadFicha.filtro = elegida ? elegida.id
    : sidgadFicha.competiciones.length === 1 ? sidgadFicha.competiciones[0].id
      : 'todas';
  sidgadFichaPintar();
}

function sidgadFichaRolesHtml() {
  const roles = sidgadFicha.orden.filter(r => sidgadFicha.roles[r].length);
  if (roles.length < 2) return '';
  const nombres = { campo: sidgadT('Jugador'), portero: sidgadT('Portero') };
  return `
    <div class="sidgad-ficha-rol" role="group" aria-label="${sidgadT('Papel en la temporada')}">
      ${roles.map(r => {
        const pj = sidgadFicha.partidosRol[r];
        return `<button type="button" data-ficha-rol="${r}" aria-pressed="${r === sidgadFicha.rol}" class="${r === sidgadFicha.rol ? 'sidgad-activo' : ''}">${nombres[r]}${pj ? ` <small>${pj} ${sidgadT('PJ')}</small>` : ''}</button>`;
      }).join('')}
    </div>`;
}

function sidgadFichaReiniciar(mensaje = sidgadT('Cargando...')) {
  const cont = document.getElementById('sidgad-player-ficha');
  if (cont) cont.innerHTML = `<p class="sidgad-ficha-vacio">${escaparHtml(mensaje)}</p>`;
}

function sidgadFichaPintar() {
  const cont = document.getElementById('sidgad-player-ficha');
  if (!cont) return;

  if (!sidgadFicha.competiciones.length) {
    cont.innerHTML = `<p class="sidgad-ficha-vacio">${sidgadT('Sin estadísticas esta temporada.')}</p>${sidgadPieDatosHtml({ profile: sidgadFicha.perfil })}`;
    return;
  }

  const pestanas = [['resumen', sidgadT('Resumen')], ['partidos', sidgadT('Partidos')]];
  const filtros = sidgadFicha.competiciones.length > 1
    ? [['todas', sidgadT('Todas las competiciones')], ...sidgadFicha.competiciones.map(c => [c.id, c.nombre])]
    : [];

  const panel = sidgadFicha.pestana === 'partidos' ? sidgadFichaPartidosHtml() : sidgadFichaResumenHtml();

  cont.innerHTML = `
    ${sidgadFichaRolesHtml()}
    <div class="sidgad-ficha-tabs" role="tablist">
      ${pestanas.map(([id, texto]) => `<button type="button" role="tab" data-ficha-tab="${id}" aria-selected="${id === sidgadFicha.pestana}" class="${id === sidgadFicha.pestana ? 'sidgad-activo' : ''}">${texto}</button>`).join('')}
    </div>
    ${filtros.length ? `<label class="sidgad-ficha-filtro">
      <span>${sidgadT('Competición')}</span>
      <select data-ficha-select>
        ${filtros.map(([id, texto]) => `<option value="${id}" ${id === sidgadFicha.filtro ? 'selected' : ''}>${escaparHtml(texto)}</option>`).join('')}
      </select>
    </label>` : ''}
    <div class="sidgad-ficha-panel">${panel}</div>
    ${sidgadPieDatosHtml({ profile: sidgadFicha.perfil })}
    <div class="sidgad-ficha-tooltip" hidden></div>
  `;
}

function sidgadFichaResumenHtml() {
  const metricas = sidgadFichaMetricas();
  const seleccion = sidgadFichaSeleccionadas();
  const totalesPorComp = seleccion.map(c => ({ c, t: sidgadFichaTotales(c) }));
  const totales = seleccion.length === 1 ? totalesPorComp[0].t : sidgadFichaSumar(totalesPorComp.map(x => x.t));
  const unica = seleccion.length === 1 ? seleccion[0] : null;

  // Con muchas tarjetas (porteros) se usan las etiquetas cortas y van en dos filas de cuatro.
  const cortas = metricas.length + 1 > 6;
  const tarjeta = (largo, valor, puesto = '', corto = largo) => `
    <article class="sidgad-ficha-card" title="${largo}">
      <span>${cortas ? corto : largo}</span>
      <strong>${valor}</strong>
      ${puesto ? `<small>${puesto}</small>` : ''}
    </article>`;

  const tarjetas = [
    tarjeta(sidgadT('Partidos'), totales.jugados ?? '—', '', sidgadT('PJ')),
    ...metricas.map(m => tarjeta(m.largo, sidgadFichaFormato(m, totales[m.clave]), unica ? sidgadFichaPuesto(unica, m) : '', m.corto)),
  ].join('');

  const avisoPortero = sidgadFicha.esPortero && metricas.every(m => totales[m.clave] === null)
    ? `<p class="sidgad-ficha-nota">${sidgadT('La API todavía no envía las estadísticas de portero.')}</p>` : '';

  const porCompeticion = seleccion.length > 1 ? `
    <h3 class="sidgad-ficha-subtitulo">${sidgadT('Por competición')}</h3>
    <div class="sidgad-ficha-tabla-wrap">
      <table class="sidgad-ficha-tabla">
        <thead><tr><th class="sidgad-ficha-col-texto">${sidgadT('Competición')}</th><th>${sidgadT('PJ')}</th>${metricas.map(m => `<th title="${m.largo}">${m.corto}</th>`).join('')}</tr></thead>
        <tbody>
          ${totalesPorComp.map(({ c, t }) => `
            <tr>
              <td class="sidgad-ficha-col-texto"><button type="button" class="sidgad-ficha-enlace" data-ficha-filtro="${c.id}">${escaparHtml(c.nombre)}</button></td>
              <td>${t.jugados ?? '—'}</td>
              ${metricas.map(m => `<td>${sidgadFichaFormato(m, t[m.clave])}</td>`).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '';

  return `<div class="sidgad-ficha-cards${cortas ? ' sidgad-ficha-cards-4' : ''}">${tarjetas}</div>${avisoPortero}${porCompeticion}${sidgadFichaGraficasHtml()}`;
}

function sidgadFichaUrlPartido(gameId) {
  return escaparHtml(sidgadUrl({ ...sidgadLeerEstado(), partido: gameId, jugador: null, temporada: null }));
}

function sidgadFichaPartidosHtml() {
  const metricas = sidgadFichaMetricas().filter(m => !m.soloTotal);
  const seleccion = sidgadFichaSeleccionadas().filter(c => c.partidos.length);
  if (!seleccion.length) return `<p class="sidgad-ficha-vacio">${sidgadT('Sin partidos.')}</p>`;

  const cuerpo = seleccion.map(c => {
    // Cabecera de la competición con sus estadísticas sumadas, en las mismas columnas.
    const totales = sidgadFichaTotales(c);
    const cabecera = `
      <tr class="sidgad-ficha-comp">
        <td class="sidgad-ficha-col-texto">${escaparHtml(c.nombre)}<small>${c.partidos.length} partidos</small></td>
        ${metricas.map(m => `<td>${sidgadFichaFormato(m, totales[m.clave])}</td>`).join('')}
      </tr>`;

    let faseActual;
    const filas = c.partidos.map(p => {
      const bonus = c.bonus?.get(String(p.game_id)) || {};
      const b = lado => bonus[lado] ? `<small class="sidgad-ficha-bonus sidgad-ficha-bonus-${lado}" title="${sidgadT('Puntos de bonus')}">B</small>` : '';
      let fase = '';
      if (p.fase && p.fase !== faseActual) {
        faseActual = p.fase;
        fase = `<tr class="sidgad-ficha-fase"><td colspan="${metricas.length + 1}">${escaparHtml(p.fase)}</td></tr>`;
      }
      return `${fase}
        <tr>
          <td class="sidgad-ficha-col-texto">
            ${SIDGAD_SETTINGS.has_acta_digital !== false && p.game_id
              ? `<a class="sidgad-nav sidgad-ficha-partido" href="${sidgadFichaUrlPartido(p.game_id)}" title="${sidgadT('Ver acta')}">`
              : '<span class="sidgad-ficha-partido">'}
              <span class="sidgad-ficha-eq">${escaparHtml(p.home_name)}</span>
              <img src="${escaparHtml(p.home_logo || SIDGAD_DEFAULT_LOGO)}" alt="" loading="lazy">
              <b>${b('home')}${escaparHtml(p.score || '-')}${b('away')}</b>
              <img src="${escaparHtml(p.away_logo || SIDGAD_DEFAULT_LOGO)}" alt="" loading="lazy">
              <span class="sidgad-ficha-eq">${escaparHtml(p.away_name)}</span>
            ${SIDGAD_SETTINGS.has_acta_digital !== false && p.game_id ? '</a>' : '</span>'}
          </td>
          ${metricas.map(m => {
            const v = sidgadFichaValor(p, m);
            return `<td>${v === null || v === 0 ? '' : sidgadFichaFormato(m, v)}</td>`;
          }).join('')}
        </tr>`;
    }).join('');

    return cabecera + filas;
  }).join('');

  return `
    <div class="sidgad-ficha-tabla-wrap">
      <table class="sidgad-ficha-tabla">
        <thead><tr><th class="sidgad-ficha-col-texto">${sidgadT('Partido')}</th>${metricas.map(m => `<th title="${m.largo}">${m.corto}</th>`).join('')}</tr></thead>
        <tbody>${cuerpo}</tbody>
      </table>
    </div>`;
}

/* ===== Evolución: tarjetas de rachas + barras con números (SVG a mano) ===== */

const SIDGAD_FICHA_LEYENDA = { a: '<i class="sidgad-ley-1"></i>', b: '<i class="sidgad-ley-2"></i>' };
const SIDGAD_GRAF = { ancho: 460, alto: 190, izq: 8, der: 8, arriba: 18, abajo: 26 };

// Datos por partido, en el orden de /profile/ (dentro de una competición es cronológico).
function sidgadFichaSerie(c) {
  return c.partidos.map(p => {
    const base = { rival: sidgadFichaRival(p, c.equipo), score: p.score };
    if (!sidgadFicha.esPortero) {
      const g = sidgadNum(p.goals) ?? 0;
      const a = sidgadNum(p.asist) ?? 0;
      return { ...base, g, a, pts: g + a };
    }
    const tiros = sidgadNum(p.goalie_shoots);
    const gc = sidgadNum(p.goalie_goals);
    let sv = sidgadNum(p.goalie_porc);
    if (sv === null && tiros && gc !== null) sv = (tiros - gc) / tiros;
    if (sv !== null && sv > 1) sv /= 100;
    const paradas = sidgadNum(p.goalie_saves) ?? (tiros !== null && gc !== null ? tiros - gc : null);
    return { ...base, tiros, gc, sv, paradas };
  });
}

function sidgadFichaGraficasHtml() {
  const seleccion = sidgadFichaSeleccionadas().filter(c => c.partidos.length);
  if (!seleccion.length) return '';
  const ordenFiable = seleccion.length === 1; // sin fechas no se pueden mezclar competiciones en orden
  const serieTotal = seleccion.flatMap(sidgadFichaSerie);

  const rachas = sidgadFicha.esPortero
    ? sidgadFichaRachasPortero(serieTotal, ordenFiable)
    : sidgadFichaRachasCampo(serieTotal, ordenFiable);

  const graficas = seleccion.map(c => {
    const titulo = seleccion.length > 1 ? `<h4 class="sidgad-ficha-graf-comp">${escaparHtml(c.nombre)}</h4>` : '';
    return titulo + sidgadFichaGraficaBarras(sidgadFichaSerie(c));
  }).join('');

  return `
    <h3 class="sidgad-ficha-subtitulo">${sidgadT('Evolución')}</h3>
    ${rachas}
    ${graficas}`;
}

function sidgadFichaTarjetasRacha(items) {
  const visibles = items.filter(Boolean);
  if (!visibles.length) return '';
  return `<div class="sidgad-ficha-rachas">${visibles.map(([titulo, valor, detalle]) => `
    <div class="sidgad-ficha-racha">
      <span>${titulo}</span>
      <strong>${valor}</strong>
      ${detalle ? `<small>${detalle}</small>` : ''}
    </div>`).join('')}</div>`;
}

function sidgadFichaMedia(lista, campo) {
  const valores = lista.map(d => d[campo]).filter(v => v !== null && v !== undefined);
  return valores.length ? valores.reduce((t, v) => t + v, 0) / valores.length : null;
}

const sidgadFmt1 = v => v.toLocaleString(SIDGAD_LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const sidgadFmtPorc = v => `${(v * 100).toLocaleString(SIDGAD_LOCALE, { maximumFractionDigits: 1 })}%`;

function sidgadFichaRachasCampo(serie, ordenFiable) {
  const mejor = serie.reduce((m, d) => (d.pts > (m?.pts ?? -1) ? d : m), null);
  const conGol = serie.filter(d => d.g > 0).length;

  let racha = 0;
  for (let i = serie.length - 1; i >= 0 && serie[i].pts > 0; i--) racha++;

  const ultimos = serie.slice(-5);
  const mediaTemp = sidgadFichaMedia(serie, 'pts');
  const mediaUlt = sidgadFichaMedia(ultimos, 'pts');

  return sidgadFichaTarjetasRacha([
    mejor && mejor.pts > 0 && [sidgadT('Mejor partido'), sidgadT('{n} pts', { n: mejor.pts }), `${sidgadT('vs')} ${escaparHtml(mejor.rival)} (${escaparHtml(mejor.score || '')}) · ${mejor.g} ${sidgadT('G')} · ${mejor.a} ${sidgadT('A')}`],
    ordenFiable && [sidgadT('Racha actual'), sidgadTn('{n} partido', '{n} partidos', racha), sidgadT('seguidos sumando puntos')],
    [sidgadT('Partidos con gol'), sidgadT('{n} de {total}', { n: conGol, total: serie.length }), serie.length ? `${Math.round((conGol / serie.length) * 100)}%` : ''],
    ordenFiable && serie.length > 5 && mediaUlt !== null && [sidgadT('Últimos 5'), sidgadT('{n} pts/partido', { n: sidgadFmt1(mediaUlt) }), sidgadT('Temporada: {n} pts/partido', { n: sidgadFmt1(mediaTemp) })],
  ]);
}

function sidgadFichaRachasPortero(serie, ordenFiable) {
  const conDatos = serie.filter(d => d.sv !== null);
  if (!conDatos.length) return `<p class="sidgad-ficha-nota">${sidgadT('Las rachas y gráficas de portero aparecerán cuando la API envíe tiros y goles en contra por partido.')}</p>`;

  const mejor = conDatos.filter(d => (d.tiros || 0) >= 10).reduce((m, d) => (d.sv > (m?.sv ?? -1) ? d : m), null);
  const ceros = serie.filter(d => d.gc === 0 && d.tiros).length;
  const sobre90 = conDatos.filter(d => d.sv >= 0.9).length;
  const svDe = lista => {
    const tiros = lista.reduce((t, d) => t + (d.tiros || 0), 0);
    const gc = lista.reduce((t, d) => t + (d.gc || 0), 0);
    return tiros ? (tiros - gc) / tiros : null;
  };
  const svUlt = svDe(conDatos.slice(-5));
  const svTemp = svDe(conDatos);

  return sidgadFichaTarjetasRacha([
    mejor && [sidgadT('Mejor partido'), sidgadFmtPorc(mejor.sv), `${sidgadT('vs')} ${escaparHtml(mejor.rival)} (${escaparHtml(mejor.score || '')}) · ${sidgadT('{n} paradas de {total}', { n: mejor.paradas ?? mejor.tiros - mejor.gc, total: mejor.tiros })}`],
    [sidgadT('Porterías a cero'), `${ceros}`, sidgadTn('en {n} partido', 'en {n} partidos', serie.length)],
    [sidgadT('Partidos ≥ 90% paradas'), sidgadT('{n} de {total}', { n: sobre90, total: conDatos.length }), ''],
    ordenFiable && conDatos.length > 5 && svUlt !== null && [sidgadT('Últimos 5'), sidgadFmtPorc(svUlt), sidgadT('Temporada: {n}', { n: sidgadFmtPorc(svTemp) })],
  ]);
}

// Barra con las esquinas de arriba redondeadas (4px) y la base plana sobre el eje.
function sidgadRutaBarra(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

// Una barra por partido, apilada en dos series, con el total escrito encima y el rival debajo.
function sidgadFichaGraficaBarras(serie) {
  const portero = sidgadFicha.esPortero;
  const datos = serie.map(d => portero
    ? { ...d, s1: d.paradas ?? 0, s2: d.gc ?? 0, etiqueta: d.sv !== null ? `${Math.round(d.sv * 100)}%` : '' }
    : { ...d, s1: d.g, s2: d.a, etiqueta: d.pts ? String(d.pts) : '' });
  if (portero && datos.every(d => d.s1 + d.s2 === 0)) return '';

  const titulo = sidgadT(portero ? 'Tiros recibidos por partido' : 'Puntos por partido');
  const explicacion = portero
    ? sidgadT('Cada barra es un partido: {a}paradas y {b}goles encajados. Encima, el % de paradas.', SIDGAD_FICHA_LEYENDA)
    : sidgadT('Cada barra es un partido: {a}goles y {b}asistencias. Encima, los puntos.', SIDGAD_FICHA_LEYENDA);

  const { ancho, alto, izq, der, arriba, abajo } = SIDGAD_GRAF;
  const banda = (ancho - izq - der) / datos.length;
  const anchoBarra = Math.max(6, Math.min(24, banda * 0.62));
  const maximo = Math.max(1, ...datos.map(d => d.s1 + d.s2));
  const base = alto - abajo;
  const yDe = v => base - (v / maximo) * (base - arriba);
  const girar = banda < 26;

  const barras = datos.map((d, i) => {
    const centro = izq + i * banda + banda / 2;
    const x = centro - anchoBarra / 2;
    const h1 = base - yDe(d.s1);
    const h2 = base - yDe(d.s2);
    const y1 = base - h1;
    const hueco = d.s1 && d.s2 ? 2 : 0;
    const seg1 = d.s1 ? (d.s2
      ? `<rect class="sidgad-graf-s1" x="${x}" y="${y1}" width="${anchoBarra}" height="${h1}"></rect>`
      : `<path class="sidgad-graf-s1" d="${sidgadRutaBarra(x, y1, anchoBarra, h1)}"></path>`) : '';
    const seg2 = d.s2 ? `<path class="sidgad-graf-s2" d="${sidgadRutaBarra(x, y1 - h2, anchoBarra, h2 - hueco)}"></path>` : '';
    const cima = y1 - h2;
    const valor = d.etiqueta ? `<text class="sidgad-graf-valor" x="${centro}" y="${cima - 5}" text-anchor="middle">${d.etiqueta}</text>` : '';
    const rival = girar
      ? `<text class="sidgad-graf-x" transform="translate(${centro},${base + 10}) rotate(-45)" text-anchor="end">${escaparHtml(d.rival || '')}</text>`
      : `<text class="sidgad-graf-x" x="${centro}" y="${base + 15}" text-anchor="middle">${escaparHtml(d.rival || '')}</text>`;
    const tip = portero
      ? `<b>${sidgadT('vs')} ${escaparHtml(d.rival)}</b> ${escaparHtml(d.score || '')}<br>${sidgadT('Tiros: {tiros} · Paradas: {paradas} · Goles: {goles}', { tiros: d.tiros ?? '—', paradas: d.s1, goles: d.gc ?? '—' })}${d.sv !== null ? ` · ${sidgadFmtPorc(d.sv)}` : ''}`
      : `<b>${sidgadT('vs')} ${escaparHtml(d.rival)}</b> ${escaparHtml(d.score || '')}<br>${sidgadT('Goles: {goles} · Asistencias: {asist} · Puntos: {puntos}', { goles: d.g, asist: d.a, puntos: d.pts })}`;
    return `${seg1}${seg2}${valor}${rival}<rect class="sidgad-graf-hit" x="${izq + i * banda}" y="0" width="${banda}" height="${base}" data-tip="${escaparHtml(tip)}"></rect>`;
  }).join('');

  const altoTotal = alto + (girar ? 16 : 0);
  return `
    <figure class="sidgad-ficha-grafica">
      <figcaption>${titulo}</figcaption>
      <p class="sidgad-ficha-graf-ayuda">${explicacion}</p>
      <svg class="sidgad-graf" viewBox="0 0 ${ancho} ${altoTotal}" role="img" aria-label="${titulo}">
        <line class="sidgad-graf-base" x1="${izq}" x2="${ancho - der}" y1="${base}" y2="${base}"></line>
        ${barras}
      </svg>
    </figure>`;
}

/* ===== Eventos (delegados; en captura porque el panel corta la propagación) ===== */

document.addEventListener('click', (event) => {
  const cont = document.getElementById('sidgad-player-ficha');
  if (!cont || !cont.contains(event.target)) return;

  const rol = event.target.closest('[data-ficha-rol]');
  if (rol) {
    const actual = sidgadFicha.competiciones.find(c => c.id === sidgadFicha.filtro);
    sidgadFichaElegirRol(rol.dataset.fichaRol, actual?.idc);
    return;
  }
  const tab = event.target.closest('[data-ficha-tab]');
  if (tab) {
    sidgadFicha.pestana = tab.dataset.fichaTab;
    sidgadFichaPintar();
    return;
  }
  const filtro = event.target.closest('button[data-ficha-filtro]');
  if (filtro) {
    sidgadFicha.filtro = filtro.dataset.fichaFiltro;
    sidgadFichaPintar();
    return;
  }
  const hit = event.target.closest('.sidgad-graf-hit');
  if (hit) sidgadFichaTooltip(hit, cont);
}, true);

document.addEventListener('mouseover', (event) => {
  const cont = document.getElementById('sidgad-player-ficha');
  const hit = event.target.closest?.('.sidgad-graf-hit');
  if (cont && hit && cont.contains(hit)) sidgadFichaTooltip(hit, cont);
}, true);

document.addEventListener('mouseout', (event) => {
  const hit = event.target.closest?.('.sidgad-graf-hit');
  if (!hit || hit.contains(event.relatedTarget)) return;
  const tooltip = document.querySelector('#sidgad-player-ficha .sidgad-ficha-tooltip');
  if (tooltip) tooltip.hidden = true;
  hit.classList.remove('sidgad-activo');
}, true);

function sidgadFichaTooltip(hit, cont) {
  const tooltip = cont.querySelector('.sidgad-ficha-tooltip');
  if (!tooltip) return;
  cont.querySelectorAll('.sidgad-graf-hit.sidgad-activo').forEach(h => h.classList.remove('sidgad-activo'));
  hit.classList.add('sidgad-activo');
  tooltip.innerHTML = hit.dataset.tip;
  tooltip.hidden = false;

  const caja = hit.getBoundingClientRect();
  const base = cont.getBoundingClientRect();
  const izquierda = Math.min(Math.max(caja.left - base.left + caja.width / 2 - tooltip.offsetWidth / 2, 0), base.width - tooltip.offsetWidth);
  tooltip.style.left = `${izquierda}px`;
  tooltip.style.top = `${caja.top - base.top - tooltip.offsetHeight - 6}px`;
}

document.addEventListener('change', (event) => {
  const select = event.target.closest?.('[data-ficha-select]');
  if (!select) return;
  sidgadFicha.filtro = select.value;
  sidgadFichaPintar();
}, true);
