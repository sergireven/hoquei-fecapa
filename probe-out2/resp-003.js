/*
 * Portada de la liga: últimos resultados, próximos partidos y tarjetas de líderes.
 * Los partidos salen de /calendar/ (ordenados por fecha: el calendario no viene en
 * orden cronológico) y los líderes de /stats/ con las mismas columnas y el mismo
 * orden que la tabla de Estadísticas.
 */

const SIDGAD_PORTADA_PARTIDOS = 8;
const SIDGAD_PORTADA_LIDERES = 10;

function sidgadFechaPartido(p) {
  const [d, m, a] = String(p.dia_partido || '').split('/').map(Number);
  if (!d || !m || !a) return null;
  const [h, min] = String(p.hora_partido || '').split(':').map(Number);
  return new Date(a, m - 1, d, h || 0, min || 0).getTime();
}

function sidgadPartidoJugado(p) {
  return !!p.result && !['-', '–', '--', '_'].includes(String(p.result).trim());
}

/*
 * Partidos de copa y playoff decididos en la prórroga o en los penaltis. Vienen en el result de
 * las filas MODEL_COPA / MODEL_PLAYOFF: "idp:ot_win:pe_win|…" (equipo que ganó en la prórroga y
 * en la tanda; 0 si no) o "--". → Map idp → { ganador: team_id, tipo: 'prorroga' | 'penaltis' }.
 */
function sidgadCalendarioDesempates(games = []) {
  const desempates = new Map();
  games.forEach(g => {
    if (String(g.idp) !== '0' || !['MODEL_COPA', 'MODEL_PLAYOFF'].includes(g.dia_partido)) return;
    String(g.result || '').split('|').forEach(bloque => {
      const [idp, prorroga, penaltis] = bloque.split(':').map(s => String(s || '').trim());
      if (!/^\d+$/.test(idp || '')) return;
      if (penaltis && penaltis !== '0') desempates.set(idp, { ganador: penaltis, tipo: 'penaltis' });
      else if (prorroga && prorroga !== '0') desempates.set(idp, { ganador: prorroga, tipo: 'prorroga' });
    });
  });
  return desempates;
}

// Marca bajo el resultado de un partido decidido en la prórroga o en los penaltis.
function sidgadDesempateHtml(p) {
  const d = p?.desempate;
  if (!d) return '';
  const lado = String(p.home_id) === d.ganador ? 'home' : String(p.away_id) === d.ganador ? 'away' : null;
  const nombre = lado ? String(p[`${lado}_name`] || '').trim() : '';
  const penaltis = d.tipo === 'penaltis';
  const titulo = nombre
    ? sidgadT(penaltis ? 'Gana {equipo} en los penaltis' : 'Gana {equipo} en la prórroga', { equipo: nombre })
    : sidgadT(penaltis ? 'Decidido en los penaltis' : 'Decidido en la prórroga');
  return `<small class="sidgad-desempate" title="${escaparHtml(titulo)}">${sidgadT(penaltis ? 'Penaltis' : 'Prórroga')}</small>`;
}

// Partidos con su jornada y fase (vienen en filas separadoras previas) y, si lo hubo, su desempate.
function sidgadPartidosCalendario(games = []) {
  const desempates = sidgadCalendarioDesempates(games);
  let jornada = '';
  let fase = '';
  const partidos = [];
  games.forEach(g => {
    if (String(g.idp) === '0') {
      if (g.dia_partido === 'JORNADA') jornada = g.home_name;
      if (g.dia_partido === 'FASE') { fase = g.home_name; jornada = ''; }
      return;
    }
    const fecha = sidgadFechaPartido(g);
    if (fecha !== null) partidos.push({ ...g, fecha, jornada, fase, desempate: desempates.get(String(g.idp)) || null });
  });
  return partidos;
}

function sidgadPortadaFilaPartido(p, jugado) {
  const dia = String(p.dia_partido).slice(0, 5);
  const detalle = [p.hora_partido && p.hora_partido !== '_' ? p.hora_partido : '', sidgadTApi(p.jornada)].filter(Boolean).join(' · ');
  const acta = jugado && SIDGAD_SETTINGS.has_acta_digital
    ? `<a class="sidgad-nav sidgad-portada-accion" href="${escaparHtml(sidgadUrl({ ...sidgadLeerEstado(), partido: p.idp, jugador: null, temporada: null }))}" title="${sidgadT('Ver acta')}" aria-label="${sidgadT('Ver acta')}"><i class="fas fa-search" aria-hidden="true"></i></a>`
    : '';
  const video = p.url_video
    ? `<button type="button" class="sidgad-portada-accion" data-calendar-action="video" data-video-type="${escaparHtml(p.tipo_video || '')}" data-video-url="${escaparHtml(p.url_video)}" title="${sidgadT('Ver vídeo')}" aria-label="${sidgadT('Ver vídeo')}"><i class="fas fa-video" aria-hidden="true"></i></button>`
    : '';
  const marcador = jugado
    ? `<span class="sidgad-portada-marcador">${escaparHtml(p.result)}${sidgadDesempateHtml(p)}</span>`
    : `<span class="sidgad-portada-marcador sidgad-portada-vs">${sidgadT('vs')}</span>`;
  // En móvil se ve la abreviatura del equipo (sale de la lista de equipos de la liga).
  const corto = id => (sidgadLigaSeleccionada?.teams || []).find(t => String(t.teamId) === String(id))?.name_short;
  const equipo = (nombre, logo, id, lado) => `
    <span class="sidgad-portada-equipo sidgad-portada-${lado}" title="${escaparHtml(nombre)}">
      <img src="${escaparHtml(logo || SIDGAD_DEFAULT_LOGO)}" alt="" loading="lazy" onerror="this.src='${SIDGAD_DEFAULT_LOGO}'">
      ${sidgadEnlaceEquipo(id, `<span class="sidgad-portada-largo">${escaparHtml(nombre)}</span><span class="sidgad-portada-corto">${escaparHtml(corto(id) || nombre)}</span>`)}
    </span>`;

  return `
    <li class="sidgad-portada-partido">
      <span class="sidgad-portada-fecha" title="${escaparHtml(detalle)}">${escaparHtml(dia)}<small>${escaparHtml(detalle)}</small></span>
      ${equipo(p.home_name, p.home_logo, p.home_id, 'local')}
      ${marcador}
      ${equipo(p.away_name, p.away_logo, p.away_id, 'visitante')}
      <span class="sidgad-portada-acciones">${acta}${video}</span>
    </li>`;
}

function sidgadPortadaPartidosHtml(partidos) {
  const jugados = partidos.filter(sidgadPartidoJugado).sort((a, b) => b.fecha - a.fecha).slice(0, SIDGAD_PORTADA_PARTIDOS);
  // Sólo partidos con fecha futura: los no jugados del pasado (p. ej. "en caso de empate") no son próximos.
  const hoy = new Date().setHours(0, 0, 0, 0);
  const proximos = partidos.filter(p => !sidgadPartidoJugado(p) && p.fecha >= hoy).sort((a, b) => a.fecha - b.fecha).slice(0, SIDGAD_PORTADA_PARTIDOS);
  const bloque = (titulo, lista, jugado) => (lista.length ? `
    <section class="sidgad-portada-bloque">
      <h2 class="sidgad-portada-titulo">${titulo}</h2>
      <ul class="sidgad-portada-partidos">${lista.map(p => sidgadPortadaFilaPartido(p, jugado)).join('')}</ul>
    </section>` : '');
  const html = bloque(sidgadT('Últimos resultados'), jugados, true) + bloque(sidgadT('Próximos partidos'), proximos, false);
  return html ? `<div class="sidgad-portada-fila ${jugados.length && proximos.length ? 'sidgad-portada-dos' : ''}">${html}</div>` : '';
}

// Top N de una columna con el mismo criterio que la tabla (desempate por goles y menos partidos).
function sidgadPortadaTop(lista, columna, minPj = 0) {
  const goles = { clave: 'goals' };
  return lista
    .filter(f => (sidgadNum(f.played) ?? 0) >= minPj)
    .map(f => ({ fila: f, valor: sidgadStatsValor(columna, f) }))
    .filter(x => x.valor !== null && (columna.menorMejor || x.valor > 0))
    .sort((a, b) => {
      if (a.valor !== b.valor) return columna.menorMejor ? a.valor - b.valor : b.valor - a.valor;
      const dg = (sidgadStatsValor(goles, b.fila) ?? 0) - (sidgadStatsValor(goles, a.fila) ?? 0);
      return dg || (sidgadNum(a.fila.played) ?? 0) - (sidgadNum(b.fila.played) ?? 0);
    })
    .slice(0, SIDGAD_PORTADA_LIDERES);
}

// Líder destacado: nombre de pila pequeño arriba y apellidos grandes debajo (con … si no caben).
function sidgadPortadaNombreLider(nombreCompleto) {
  const [apellidos, nombrePila] = String(nombreCompleto || '').split(',').map(t => t.trim());
  return `<span class="sidgad-lider-pila">${escaparHtml(nombrePila || '')}</span><span class="sidgad-lider-apellidos">${escaparHtml(apellidos)}</span>`;
}

function sidgadPortadaTarjeta({ titulo, columna, top, vista, liga }) {
  if (!top.length) return '';
  const [primero, ...resto] = top;
  const verTodos = sidgadUrl({ ...sidgadLeerEstado(), vista, orden: `${columna.menorMejor ? '-' : ''}${columna.clave}`, partido: null, jugador: null, temporada: null });
  const nombre = f => sidgadStatsNombre(f.player_name);
  // Barra proporcional al líder de la tarjeta (también en % de paradas).
  const conBarra = !columna.menorMejor && primero.valor > 0;
  const barra = x => (conBarra
    ? `<span class="sidgad-lider-barra"><span style="width:${((x.valor / primero.valor) * 100).toFixed(1)}%"></span></span>`
    : '');

  return `
    <article class="sidgad-lider">
      <header class="sidgad-lider-cabecera">
        <h3>${titulo}</h3>
        ${botonesDeLiga(liga).includes(vista) ? `<a class="sidgad-nav sidgad-lider-ver" href="${escaparHtml(verTodos)}">${sidgadT('Ver todos')}</a>` : ''}
      </header>
      <div class="sidgad-lider-primero">
        <img class="sidgad-lider-marca" src="${escaparHtml(primero.fila.team_logo || '')}" alt="" aria-hidden="true" loading="lazy" onerror="this.remove()">
        <span class="sidgad-lider-foto-wrap">
          <img class="sidgad-lider-foto" data-lider-foto="${escaparHtml(primero.fila.player_id)}" src="${SIDGAD_DEFAULT_LOGO}" alt="">
          <span class="sidgad-lider-pos" aria-label="${sidgadT('Primero')}">1</span>
        </span>
        <div class="sidgad-lider-datos">
          <div class="sidgad-lider-nombre">${sidgadEnlaceJugador(primero.fila.player_id, liga.id_temp, sidgadPortadaNombreLider(primero.fila.player_name))}</div>
          <div class="sidgad-lider-equipo"><img src="${escaparHtml(primero.fila.team_logo || SIDGAD_DEFAULT_LOGO)}" alt="" loading="lazy">${escaparHtml(primero.fila.team_name || '')}</div>
        </div>
        <div class="sidgad-lider-valor">
          <strong>${sidgadStatsFormato(columna, primero.fila)}</strong>
          <span>${escaparHtml(columna.titulo)}</span>
        </div>
      </div>
      <ol class="sidgad-lider-lista" start="2">
        ${resto.map((x, i) => `
          <li>
            <span class="sidgad-lider-num">${i + 2}</span>
            <span class="sidgad-lider-nombre">${sidgadEnlaceJugador(x.fila.player_id, liga.id_temp, nombre(x.fila))}</span>
            <span class="sidgad-lider-eq">${escaparHtml(x.fila.team_name || '')}</span>
            <b>${sidgadStatsFormato(columna, x.fila)}</b>
            ${barra(x)}
          </li>`).join('')}
      </ol>
    </article>`;
}

function sidgadPortadaLideresHtml(stats, liga) {
  const tarjetas = [];
  const rosters = stats?.rosters || [];
  sidgadStatsColumnas('jugadores', liga)
    .filter(c => c.rapido)
    .sort((a, b) => (a.posRapido ?? 9) - (b.posRapido ?? 9))
    .forEach(c => tarjetas.push(sidgadPortadaTarjeta({ titulo: c.rapido, columna: c, top: sidgadPortadaTop(rosters, c), vista: 'estadisticas', liga })));

  const porteros = stats?.goalies || [];
  if (porteros.length && botonesDeLiga(liga).includes('porteros')) {
    const sv = SIDGAD_STATS_PORTEROS.find(c => c.clave === 'goalie_porc');
    const maxPj = Math.max(0, ...porteros.map(f => sidgadNum(f.played) ?? 0));
    tarjetas.splice(1, 0, sidgadPortadaTarjeta({ titulo: sidgadT('Porteros (% paradas)'), columna: sv, top: sidgadPortadaTop(porteros, sv, Math.ceil(maxPj * 0.25)), vista: 'porteros', liga }));
  }
  const html = tarjetas.filter(Boolean).join('');
  return html ? `<section class="sidgad-portada-bloque"><h2 class="sidgad-portada-titulo">${sidgadT('Líderes')}</h2><div class="sidgad-lideres">${html}</div></section>` : '';
}

// La foto del líder de cada tarjeta sale de su ficha (/profile/).
async function sidgadPortadaFotos(contenedor, seasonId) {
  const imgs = [...contenedor.querySelectorAll('[data-lider-foto]')];
  const ids = [...new Set(imgs.map(i => i.dataset.liderFoto))];
  await Promise.all(ids.map(async id => {
    try {
      const data = await sidgadFetch('profile', { id, s: seasonId }, { cache: true });
      const foto = data?.player?.image;
      if (!foto) return;
      imgs.filter(i => i.dataset.liderFoto === id).forEach(img => {
        img.onerror = () => { img.onerror = null; img.src = SIDGAD_DEFAULT_LOGO; };
        img.src = foto;
      });
    } catch (err) { /* sin ficha: se queda el logo por defecto */ }
  }));
}

async function cargarPortada() {
  const mainContent = document.getElementById('sidgad-liga-main-content');
  const liga = sidgadLigaSeleccionada;
  if (!mainContent || !liga?.idc) return;

  showLeagueLoading();
  const [calendario, stats] = await Promise.all([
    sidgadFetch('calendar', { id: liga.idc }).catch(() => null),
    sidgadFetch('stats', { id: liga.idc }, { cache: true }).catch(() => null),
  ]);
  if (sidgadLigaSeleccionada !== liga) return;
  sidgadPieDatosLiga({ calendar: calendario, stats });

  const html = sidgadPortadaPartidosHtml(sidgadPartidosCalendario(calendario?.games)) + sidgadPortadaLideresHtml(stats?.stats, liga);
  if (!html) {
    mainContent.replaceChildren(crearNodo('p', { class: 'sidgad-empty-state', text: sidgadT('Todavía no hay datos de esta competición.') }));
    return;
  }
  mainContent.innerHTML = `<div class="sidgad-portada">${html}</div>`;
  instalarAccionesCalendario();
  sidgadPortadaFotos(mainContent, liga.id_temp);
}
