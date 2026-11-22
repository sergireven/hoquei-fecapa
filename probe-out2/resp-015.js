/*
 * Estadísticas de la liga (/stats/): tabla de jugadores (stats.rosters) y de
 * porteros (stats.goalies), ordenables por cualquier columna.
 * Las columnas dependen de la modalidad y de lo que genera la liga (botones_liga).
 */

const sidgadPorPartido = clave => fila => {
  const pj = sidgadNum(fila.played);
  const v = sidgadNum(fila[clave]);
  return pj && v !== null ? v / pj : null;
};

const SIDGAD_STATS_COLUMNAS = {
  hl: [
    { clave: 'played', titulo: sidgadT('PJ'), largo: sidgadT('Partidos jugados') },
    { clave: 'goals', titulo: sidgadT('G'), largo: sidgadT('Goles'), requiere: 'goles', rapido: sidgadT('Goleadores'), posRapido: 2 },
    { clave: 'goals_pj', titulo: sidgadT('G/PJ'), largo: sidgadT('Goles por partido'), requiere: 'goles', valor: sidgadPorPartido('goals'), decimales: 2 },
    { clave: 'asist', titulo: sidgadT('A'), largo: sidgadT('Asistencias'), requiere: 'asistencias', rapido: sidgadT('Asistentes'), posRapido: 3 },
    { clave: 'asist_pj', titulo: sidgadT('A/PJ'), largo: sidgadT('Asistencias por partido'), requiere: 'asistencias', valor: sidgadPorPartido('asist'), decimales: 2 },
    { clave: 'points', titulo: sidgadT('PTS'), largo: sidgadT('Puntos'), requiere: 'puntos', destacada: true, rapido: sidgadT('Puntos'), posRapido: 1 },
    { clave: 'points_pj', titulo: sidgadT('PTS/PJ'), largo: sidgadT('Puntos por partido'), requiere: 'puntos', valor: sidgadPorPartido('points'), decimales: 2 },
    { clave: 'pim', titulo: sidgadT('PIM'), largo: sidgadT('Minutos de sanción'), valor: f => sidgadPimSegundos(f.pim), texto: f => sidgadPimTexto(sidgadPimSegundos(f.pim)), rapido: sidgadT('Más sancionados'), posRapido: 4 },
  ],
  hp: [
    { clave: 'played', titulo: sidgadT('PJ'), largo: sidgadT('Partidos jugados') },
    { clave: 'goals', titulo: sidgadT('G'), largo: sidgadT('Goles'), requiere: 'goles', destacada: true, rapido: sidgadT('Goleadores') },
    { clave: 'goals_pj', titulo: sidgadT('G/PJ'), largo: sidgadT('Goles por partido'), requiere: 'goles', valor: sidgadPorPartido('goals'), decimales: 2 },
    { clave: 'asist', titulo: sidgadT('As'), largo: sidgadT('Asistencias'), requiere: 'asistencias', rapido: sidgadT('Asistentes') },
    { clave: 'direct', titulo: sidgadT('FD'), largo: sidgadT('Faltas directas (marcadas/lanzadas)'), requiere: 'direct', valor: f => sidgadNum(String(f.direct ?? '').split('/')[0]), texto: f => f.direct || '', rapido: sidgadT('Faltas directas') },
    { clave: 'direct_porc', titulo: sidgadT('FD%'), largo: sidgadT('% de acierto en faltas directas'), requiere: 'direct', decimales: 1 },
    { clave: 'penals', titulo: sidgadT('PE|penaltis'), largo: sidgadT('Penaltis (marcados/lanzados)'), requiere: 'penals', valor: f => sidgadNum(String(f.penals ?? '').split('/')[0]), texto: f => f.penals || '', rapido: sidgadT('Penaltis') },
    { clave: 'penals_porc', titulo: sidgadT('PE%|penaltis'), largo: sidgadT('% de acierto en penaltis'), requiere: 'penals', decimales: 1 },
    { clave: 'blue_cards', titulo: sidgadT('Az'), largo: sidgadT('Tarjetas azules'), requiere: 'blue_cards', rapido: sidgadT('Tarjetas azules') },
    { clave: 'red_cards', titulo: sidgadT('Rj'), largo: sidgadT('Tarjetas rojas'), requiere: 'blue_cards' },
  ],
};

// Tiempo en pista de un portero ("mm:ss", los minutos pueden pasar de 60) → segundos, para ordenar.
function sidgadStatsTiempo(valor) {
  const partes = String(valor ?? '').trim().split(':');
  if (partes.length < 2 || partes.some(p => !/^\d+$/.test(p))) return null;
  return partes.reduce((total, p) => total * 60 + Number(p), 0);
}

const SIDGAD_STATS_PORTEROS = [
  { clave: 'played', titulo: sidgadT('PJ'), largo: sidgadT('Partidos jugados') },
  // Minutos jugados (HL): se ven tal cual llegan y se ordenan por el tiempo.
  { clave: 'goalie_time', titulo: sidgadT('MIN'), largo: sidgadT('Minutos jugados'), valor: f => sidgadStatsTiempo(f.goalie_time), texto: f => (sidgadStatsTiempo(f.goalie_time) === null ? '' : String(f.goalie_time).trim()) },
  { clave: 'goalie_porc', titulo: sidgadT('SV%'), largo: sidgadT('% de paradas'), destacada: true, rapido: sidgadT('% de paradas'), valor: f => { const v = sidgadNum(f.goalie_porc); return v === null ? null : (v > 1 ? v / 100 : v); }, formato: 'porc' },
  { clave: 'goalie_goals_pp', titulo: sidgadT('GAA'), largo: sidgadT('Goles en contra por partido'), decimales: 2, menorMejor: true, rapido: sidgadT('Menos goles encajados') },
  { clave: 'goalie_shoots', titulo: sidgadT('TIR'), largo: sidgadT('Tiros recibidos'), rapido: sidgadT('Más tiros recibidos') },
  { clave: 'goalie_goals', titulo: sidgadT('GC'), largo: sidgadT('Goles en contra'), menorMejor: true },
  { clave: 'goalie_shoots_pp', titulo: sidgadT('TIR/PJ'), largo: sidgadT('Tiros recibidos por partido'), decimales: 1 },
];

const sidgadStats = {
  tipo: 'jugadores',
  liga: null,
  lista: [],
  columnas: [],
  orden: null, // { clave, desc }
  minPj: 0,
  equipo: null,
};

function sidgadStatsColumnas(tipo, liga) {
  if (tipo === 'porteros') return SIDGAD_STATS_PORTEROS;
  const botones = normalizarBotonesLiga(liga?.botones_liga);
  const columnas = SIDGAD_STATS_COLUMNAS[SIDGAD_API_CONFIG.idm] || SIDGAD_STATS_COLUMNAS.hl;
  return columnas.filter(c => !c.oculta && (!c.requiere || botones.includes(c.requiere)));
}

function sidgadStatsValor(columna, fila) {
  return columna.valor ? columna.valor(fila) : sidgadNum(fila[columna.clave]);
}

function sidgadStatsFormato(columna, fila) {
  if (columna.texto) return escaparHtml(columna.texto(fila));
  const v = sidgadStatsValor(columna, fila);
  if (v === null) return '';
  if (columna.formato === 'porc') return `${(v * 100).toLocaleString(SIDGAD_LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  if (columna.decimales) return v.toLocaleString(SIDGAD_LOCALE, { minimumFractionDigits: columna.decimales, maximumFractionDigits: columna.decimales });
  return v.toLocaleString(SIDGAD_LOCALE);
}

// Orden por defecto: la columna destacada; desempate por goles y luego por menos partidos.
function sidgadStatsOrdenInicial(columnas) {
  const destacada = columnas.find(c => c.destacada) || columnas[1] || columnas[0];
  return { clave: destacada.clave, desc: !destacada.menorMejor };
}

// Columnas sin ningún dato (null o 0 para todos) no se muestran; PJ y la destacada, siempre.
function sidgadStatsConDatos(columnas, lista) {
  return columnas.filter(c => c.clave === 'played' || c.destacada
    || lista.some(f => (c.texto ? String(c.texto(f) || '').trim() !== '' : !!sidgadStatsValor(c, f))));
}

// URL: ?orden=points (desc) o ?orden=-points (asc)
function sidgadStatsOrdenDeUrl(columnas) {
  const texto = sidgadNavEstado?.orden;
  if (!texto) return null;
  const clave = texto.replace(/^-/, '');
  return columnas.some(c => c.clave === clave) ? { clave, desc: !texto.startsWith('-') } : null;
}

async function cargarEstadisticas(tipo = 'jugadores') {
  const mainContent = document.getElementById('sidgad-liga-main-content');
  const liga = sidgadLigaSeleccionada;
  if (!mainContent || !liga?.idc) return;

  showLeagueLoading();
  let data;
  try {
    data = await sidgadFetch('stats', { id: liga.idc }, { cache: true });
  } catch (err) {
    data = null;
  }
  if (sidgadLigaSeleccionada !== liga) return;
  sidgadPieDatosLiga({ stats: data });

  const lista = (tipo === 'porteros' ? data?.stats?.goalies : data?.stats?.rosters) || [];
  if (!lista.length) {
    mainContent.replaceChildren(crearNodo('p', { class: 'sidgad-empty-state', text: sidgadT('Estadísticas aún no disponibles.') }));
    return;
  }

  sidgadStats.equipo = sidgadEquipoLigaActivo();
  const columnas = sidgadStatsConDatos(sidgadStatsColumnas(tipo, liga), lista);
  const maxPj = Math.max(0, ...lista.map(f => sidgadNum(f.played) ?? 0));
  // Mínimo de partidos: el de la URL (?min=) o el de por defecto (porteros: el 25% de los partidos).
  const minUrl = sidgadNum(sidgadNavEstado?.min);
  const minDefecto = tipo === 'porteros' ? Math.ceil(maxPj * 0.25) : 0;
  Object.assign(sidgadStats, {
    tipo,
    liga,
    lista,
    columnas,
    maxPj,
    orden: sidgadStatsOrdenDeUrl(columnas) || sidgadStatsOrdenInicial(columnas),
    minDefecto,
    minPj: minUrl !== null ? Math.min(minUrl, maxPj) : minDefecto,
  });
  sidgadStatsPintar();
}

function sidgadStatsFilas() {
  const { lista, columnas, orden, minPj, equipo } = sidgadStats;
  const col = columnas.find(c => c.clave === orden.clave) || columnas[0];
  const goles = columnas.find(c => c.clave === 'goals');
  const pj = columnas.find(c => c.clave === 'played');
  const signo = orden.desc ? -1 : 1;

  const filas = lista
    .filter(f => (sidgadNum(f.played) ?? 0) >= minPj)
    .filter(f => !equipo || String(f.team_id) === String(equipo))
    .map(f => ({ fila: f, valor: sidgadStatsValor(col, f) }));

  filas.sort((a, b) => {
    if (a.valor === null && b.valor !== null) return 1; // sin dato, siempre al final
    if (b.valor === null && a.valor !== null) return -1;
    if (a.valor !== b.valor) return signo * (a.valor - b.valor);
    if (goles) {
      const dg = (sidgadStatsValor(goles, b.fila) ?? 0) - (sidgadStatsValor(goles, a.fila) ?? 0);
      if (dg) return dg;
    }
    return pj ? (sidgadStatsValor(pj, a.fila) ?? 0) - (sidgadStatsValor(pj, b.fila) ?? 0) : 0;
  });

  // Los empatados en la columna ordenada comparten puesto (1, 2, 2, 4...).
  filas.forEach((f, i) => {
    f.rk = i > 0 && f.valor === filas[i - 1].valor ? filas[i - 1].rk : i + 1;
  });
  return filas;
}

function sidgadStatsNombre(nombre) {
  const [apellidos, nombrePila] = String(nombre || '').split(',').map(t => t.trim());
  return nombrePila ? `<b>${escaparHtml(apellidos)}</b> ${escaparHtml(nombrePila)}` : `<b>${escaparHtml(apellidos)}</b>`;
}

function sidgadStatsPintar() {
  const mainContent = document.getElementById('sidgad-liga-main-content');
  if (!mainContent) return;
  const { columnas, orden, minPj, maxPj, liga, tipo } = sidgadStats;
  const filas = sidgadStatsFilas();

  const opcionesMin = [...new Set([0, Math.ceil(maxPj * 0.25), Math.ceil(maxPj * 0.5), Math.ceil(maxPj * 0.75), minPj])].sort((a, b) => a - b)
    .filter(v => v <= maxPj)
    .map(v => `<option value="${v}" ${v === minPj ? 'selected' : ''}>${v ? sidgadT('{n} o más', { n: v }) : sidgadT('Todos')}</option>`).join('');

  // Filtros rápidos: sustituyen a los antiguos botones de cada ranking.
  const rapidos = columnas.filter(c => c.rapido).sort((a, b) => (a.posRapido ?? 9) - (b.posRapido ?? 9));
  const filtrosRapidos = rapidos.length ? `
    <div class="sidgad-stats-rapidos" role="group" aria-label="${sidgadT('Ordenar por')}">
      ${rapidos.map(c => {
        const activo = orden.clave === c.clave && orden.desc === !c.menorMejor;
        return `<button type="button" data-stats-rapido="${c.clave}" aria-pressed="${activo}" class="${activo ? 'sidgad-activo' : ''}">${c.rapido}</button>`;
      }).join('')}
    </div>` : '';

  const cabeceras = columnas.map(c => {
    const activa = c.clave === orden.clave;
    const flecha = activa ? (orden.desc ? '↓' : '↑') : '';
    return `<th class="${activa ? 'sidgad-stats-activa' : ''} ${c.destacada ? 'sidgad-stats-destacada' : ''}" aria-sort="${activa ? (orden.desc ? 'descending' : 'ascending') : 'none'}">
      <button type="button" data-stats-orden="${c.clave}" title="${c.largo}">${c.titulo}<span>${flecha}</span></button>
    </th>`;
  }).join('');

  const cuerpo = filas.map(({ fila, rk }) => `
    <tr>
      <td class="sidgad-stats-rk">${rk}</td>
      <td class="sidgad-stats-jugador">
        <img class="sidgad-stats-bandera" src="${escaparHtml(fila.player_flag || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
        ${sidgadEnlaceJugador(fila.player_id, liga.id_temp, sidgadStatsNombre(fila.player_name))}
      </td>
      <td class="sidgad-stats-equipo">${sidgadEnlaceEquipo(fila.team_id, `<img src="${escaparHtml(fila.team_logo || SIDGAD_DEFAULT_LOGO)}" alt="" loading="lazy" onerror="this.src='${SIDGAD_DEFAULT_LOGO}'"><span>${escaparHtml(fila.team_name || '')}</span>`)}</td>
      ${columnas.map(c => `<td class="${c.clave === orden.clave ? 'sidgad-stats-activa' : ''}">${sidgadStatsFormato(c, fila)}</td>`).join('')}
    </tr>`).join('');

  mainContent.innerHTML = `
    <div class="sidgad-stats">
      <div class="sidgad-stats-barra">
        <h2 class="sidgad-stats-titulo">${sidgadT(tipo === 'porteros' ? 'Porteros' : 'Estadísticas de jugadores')}</h2>
        <label class="sidgad-stats-min">
          <span>${sidgadT('Mín. partidos')}</span>
          <select data-stats-min>${opcionesMin}</select>
        </label>
      </div>
      ${filtrosRapidos}
      <div class="sidgad-stats-wrap">
        <table class="sidgad-stats-tabla">
          <thead><tr><th class="sidgad-stats-rk">${sidgadT('RK')}</th><th class="sidgad-stats-jugador">${sidgadT(tipo === 'porteros' ? 'Portero' : 'Jugador')}</th><th class="sidgad-stats-equipo">${sidgadT('Equipo')}</th>${cabeceras}</tr></thead>
          <tbody>${cuerpo || `<tr><td colspan="${columnas.length + 3}" class="sidgad-stats-vacio">${sidgadT('Ningún jugador cumple los filtros.')}</td></tr>`}</tbody>
        </table>
      </div>
      <p class="sidgad-stats-nota">${tipo === 'porteros' ? sidgadTn('{n} portero', '{n} porteros', filas.length) : sidgadTn('{n} jugador', '{n} jugadores', filas.length)} · ${sidgadT('Pulsa una columna para ordenar')}</p>
    </div>`;
}

function sidgadStatsActiva() {
  return !!document.querySelector('#sidgad-liga-main-content .sidgad-stats');
}

document.addEventListener('click', (event) => {
  const boton = event.target.closest('[data-stats-orden], [data-stats-rapido]');
  if (!boton || !sidgadStatsActiva()) return;
  const rapido = boton.dataset.statsRapido;
  const clave = rapido || boton.dataset.statsOrden;
  const columna = sidgadStats.columnas.find(c => c.clave === clave);
  const { orden } = sidgadStats;
  // El filtro rápido siempre aplica el orden natural; la cabecera alterna.
  sidgadStats.orden = !rapido && orden.clave === clave ? { clave, desc: !orden.desc } : { clave, desc: !columna?.menorMejor };
  sidgadNavegar({ orden: `${sidgadStats.orden.desc ? '' : '-'}${clave}` }, { reemplazar: true });
  sidgadStatsPintar();
});

document.addEventListener('change', (event) => {
  const select = event.target.closest?.('[data-stats-min]');
  if (!select || !sidgadStatsActiva()) return;
  sidgadStats.minPj = Number(select.value) || 0;
  sidgadNavegar({ min: sidgadStats.minPj === sidgadStats.minDefecto ? null : String(sidgadStats.minPj) }, { reemplazar: true });
  sidgadStatsPintar();
});

// El selector de equipos de la cabecera de la liga también filtra la tabla.
document.addEventListener('sidgad:liga-team-select', (event) => {
  const { teamId, mode } = event.detail || {};
  sidgadStats.equipo = mode === 'select' ? teamId : null;
  if (sidgadStatsActiva()) sidgadStatsPintar();
});
