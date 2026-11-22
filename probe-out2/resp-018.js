/*
 * Ficha de equipo (capa sobre la liga): Resumen, Plantilla y Partidos.
 * Los team_id son por competición y coinciden en /leagues/, /standing/, /stats/ y
 * /calendar/, así que la ficha cruza los tres por team_id dentro de la liga abierta.
 */

const sidgadEquipo = {
  id: null,
  liga: null,
  pestana: 'resumen',
  datos: null,
  peticion: 0,
};

function sidgadEquipoOverlay() {
  let overlay = document.getElementById('sidgad-equipo-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'sidgad-equipo-overlay';
  overlay.innerHTML = `
    <div class="sidgad-equipo-panel" role="dialog" aria-modal="true" aria-labelledby="sidgad-equipo-nombre">
      <div class="sidgad-equipo-top">
        <span class="sidgad-equipo-kicker">${sidgadT('Ficha de equipo')}</span>
        <button type="button" class="sidgad-equipo-cerrar" aria-label="${sidgadT('Cerrar')}"><i class="fas fa-times" aria-hidden="true"></i></button>
      </div>
      <div class="sidgad-equipo-cuerpo" id="sidgad-equipo-cuerpo"></div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('.sidgad-equipo-cerrar').addEventListener('click', () => sidgadCerrarEquipo());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) sidgadCerrarEquipo(); });
  return overlay;
}

/* ===== Datos ===== */

// G / E / P. Un partido de copa o playoff decidido en la prórroga o en los penaltis lo gana quien
// pasa (partido.desempate), aunque el marcador sea un empate.
function sidgadResultadoEquipo(partido, teamId) {
  const [local, visitante] = String(partido.result || '').split(':').map(v => sidgadNum(v));
  if (local === null || visitante === null) return null;
  if (partido.desempate) return partido.desempate.ganador === String(teamId) ? 'G' : 'P';
  const esLocal = String(partido.home_id) === String(teamId);
  const propios = esLocal ? local : visitante;
  const rival = esLocal ? visitante : local;
  return propios > rival ? 'G' : propios < rival ? 'P' : 'E';
}

// Fila del equipo en la clasificación: la general si existe, si no la primera en la que salga.
function sidgadFilaClasificacion(bloques, teamId) {
  for (const bloque of [...bloques.filter(b => b.general), ...bloques.filter(b => !b.general)]) {
    for (const grupo of bloque.grupos) {
      const indice = grupo.equipos.findIndex(e => String(e.team_id) === String(teamId));
      if (indice >= 0) {
        const fila = grupo.equipos[indice];
        return { fila, posicion: sidgadNum(fila.order) ?? indice + 1, total: grupo.equipos.length, titulo: grupo.titulo || bloque.titulo };
      }
    }
  }
  return null;
}

async function sidgadCargarEquipo(liga, teamId) {
  const [standing, calendario, stats] = await Promise.all([
    sidgadFetch('standing', { id: liga.idc }, { cache: true }).catch(() => null),
    sidgadFetch('calendar', { id: liga.idc }, { cache: true }).catch(() => null),
    sidgadFetch('stats', { id: liga.idc }, { cache: true }).catch(() => null),
  ]);
  const id = String(teamId);
  const todos = sidgadPartidosCalendario(calendario?.games).sort((a, b) => a.fecha - b.fecha);
  const partidos = todos.filter(p => String(p.home_id) === id || String(p.away_id) === id);
  const bloques = sidgadAgruparClasificaciones(standing?.standings?.standing || []);
  const equipoLiga = (liga.teams || []).find(t => String(t.teamId) === id);
  const clasif = sidgadFilaClasificacion(bloques, id);
  const unPartido = partidos[0];

  return {
    nombre: equipoLiga?.name || clasif?.fila?.team_name
      || (unPartido ? (String(unPartido.home_id) === id ? unPartido.home_name : unPartido.away_name) : sidgadT('Equipo')),
    corto: equipoLiga?.name_short || clasif?.fila?.team_short || '',
    logo: equipoLiga?.team_logo || clasif?.fila?.team_logo
      || (unPartido ? (String(unPartido.home_id) === id ? unPartido.home_logo : unPartido.away_logo) : SIDGAD_DEFAULT_LOGO),
    clasif,
    partidos,
    todos,
    bloques,
    jugadores: sidgadJugadoresSinPorteros(stats?.stats?.rosters || [], stats?.stats?.goalies || []).filter(f => String(f.team_id) === id),
    porteros: (stats?.stats?.goalies || []).filter(f => String(f.team_id) === id),
    fuentes: { standing, calendar: calendario, stats }, // para el pie con su Last-Modified
  };
}

/* ===== Pintar ===== */

function sidgadEquipoRival(p, teamId) {
  const local = String(p.home_id) === String(teamId);
  return {
    local,
    id: local ? p.away_id : p.home_id,
    nombre: local ? p.away_name : p.home_name,
    logo: local ? p.away_logo : p.home_logo,
  };
}

// Racha actual: resultados iguales seguidos desde el último partido.
function sidgadEquipoRacha(jugados, teamId) {
  const resultados = jugados.map(p => sidgadResultadoEquipo(p, teamId)).filter(Boolean);
  if (!resultados.length) return null;
  const ultimo = resultados[resultados.length - 1];
  let n = 0;
  for (let i = resultados.length - 1; i >= 0 && resultados[i] === ultimo; i--) n++;
  const texto = { G: ['{n} ganado', '{n} ganados'], E: ['{n} empatado', '{n} empatados'], P: ['{n} perdido', '{n} perdidos'] }[ultimo];
  return { tipo: ultimo, texto: sidgadTn(texto[0], texto[1], n) };
}

function sidgadEquipoPintar() {
  const cuerpo = document.getElementById('sidgad-equipo-cuerpo');
  const { datos, liga, pestana, id } = sidgadEquipo;
  if (!cuerpo || !datos) return;

  const c = datos.clasif;
  const fila = c?.fila;
  const balance = fila ? ` (${escaparHtml(fila.win)}-${escaparHtml(fila.tie)}-${escaparHtml(fila.lost)})` : '';
  const puesto = c ? `${sidgadT('{n}º puesto', { n: c.posicion })}${balance}${c.titulo ? ` · ${escaparHtml(c.titulo)}` : ''}` : '';
  const urlPlantilla = escaparHtml(sidgadUrl({ ...sidgadLeerEstado(), vista: 'plantillas', orden: null, equipo: null, partido: null, jugador: null, temporada: null }));
  const pestanas = [['resumen', sidgadT('Resumen')], ['partidos', sidgadT('Partidos')]];

  // Misma cabecera que la ficha de jugador: banda en degradado con el escudo de marca de agua.
  cuerpo.innerHTML = `
    <header class="sidgad-equipo-cabecera">
      <img class="sidgad-equipo-marca" src="${escaparHtml(datos.logo || '')}" alt="" aria-hidden="true" onerror="this.remove()">
      <img class="sidgad-equipo-escudo" src="${escaparHtml(datos.logo || SIDGAD_DEFAULT_LOGO)}" alt="" onerror="this.src='${SIDGAD_DEFAULT_LOGO}'">
      <div class="sidgad-equipo-identidad">
        <div class="sidgad-equipo-liga">${escaparHtml(liga.nombre_idc || '')}${liga.nombre_temp ? ` · ${escaparHtml(liga.nombre_temp)}` : ''}</div>
        <h2 id="sidgad-equipo-nombre">${escaparHtml(datos.nombre)}</h2>
        ${puesto ? `<div class="sidgad-equipo-puesto">${puesto}</div>` : ''}
      </div>
    </header>
    <section class="sidgad-ficha sidgad-equipo-ficha">
      <div class="sidgad-ficha-tabs" role="tablist">
        ${pestanas.map(([pid, texto]) => `<button type="button" role="tab" data-equipo-tab="${pid}" aria-selected="${pid === pestana}" class="${pid === pestana ? 'sidgad-activo' : ''}">${texto}</button>`).join('')}
        ${liga && botonesDeLiga(liga).includes('plantillas') ? `<a class="sidgad-nav sidgad-equipo-tab-enlace" href="${urlPlantilla}" data-equipo-plantilla="${escaparHtml(id)}">${sidgadT('Plantilla')}</a>` : ''}
      </div>
      <div class="sidgad-ficha-panel">
        ${pestana === 'partidos' ? sidgadEquipoPartidosHtml() : sidgadEquipoResumenHtml()}
      </div>
      ${sidgadPieDatosHtml(datos.fuentes)}
    </section>`;
  sidgadPortadaFotos(cuerpo, liga.id_temp);
}

// Goles por partido: a favor hacia arriba, en contra hacia abajo, con el rival y el resultado debajo.
// Mismo tamaño que la gráfica de la ficha de jugador; con pocos partidos las barras no se estiran.
function sidgadEquipoGraficaGoles(jugados) {
  const { id, liga } = sidgadEquipo;
  const datos = jugados.slice(-30).map(p => {
    const [local, visitante] = String(p.result).split(':').map(v => sidgadNum(v) ?? 0);
    const esLocal = String(p.home_id) === String(id);
    const rivalId = esLocal ? p.away_id : p.home_id;
    const rivalNombre = esLocal ? p.away_name : p.home_name;
    const corto = (liga.teams || []).find(t => String(t.teamId) === String(rivalId))?.name_short || rivalNombre.slice(0, 4);
    return { gf: esLocal ? local : visitante, gc: esLocal ? visitante : local, r: sidgadResultadoEquipo(p, id), corto, rivalNombre, p, esLocal };
  });
  if (!datos.length) return '';

  const ancho = 460;
  const izq = 6;
  const arriba = 18;
  const zona = 144;
  const bandaPrevia = Math.min(40, (ancho - izq * 2) / datos.length);
  const girarPrevio = bandaPrevia < 24;
  // Debajo de las barras: fila de resultados (G/E/P) y, más abajo, los rivales (inclinados si no caben).
  const abajo = girarPrevio ? 58 : 38;
  const alto = arriba + zona + abajo;
  const maximo = Math.max(1, ...datos.map(d => Math.max(d.gf, d.gc)));
  const centro = arriba + zona / 2;
  const escala = v => (v / maximo) * (zona / 2 - 4);
  const banda = Math.min(40, (ancho - izq * 2) / datos.length);
  // Con pocos partidos el grupo de barras va centrado.
  const inicio = (ancho - banda * datos.length) / 2;
  const anchoBarra = Math.max(5, Math.min(18, banda * 0.6));
  const girar = banda < 24;

  const barras = datos.map((d, i) => {
    const cx = inicio + i * banda + banda / 2;
    const x = cx - anchoBarra / 2;
    const hF = escala(d.gf);
    const hC = escala(d.gc);
    const titulo = `${d.esLocal ? sidgadT('vs') : '@'} ${d.rivalNombre} · ${d.p.result} · ${String(d.p.dia_partido).slice(0, 5)}`;
    const base = arriba + zona;
    const rival = girar
      ? `<text class="sidgad-graf-x" transform="translate(${cx + 3},${base + 26}) rotate(-45)" text-anchor="end">${escaparHtml(d.corto)}</text>`
      : `<text class="sidgad-graf-x" x="${cx}" y="${base + 30}" text-anchor="middle">${escaparHtml(d.corto)}</text>`;
    return `
      <g>
        <title>${escaparHtml(titulo)}</title>
        ${hF ? `<path class="sidgad-graf-s1" d="${sidgadRutaBarra(x, centro - hF - 1, anchoBarra, hF)}"></path>` : ''}
        ${hC ? `<path class="sidgad-graf-s2" d="${sidgadRutaBarra(x, centro + 1, anchoBarra, hC)}" transform="rotate(180 ${cx} ${centro + 1 + hC / 2})"></path>` : ''}
        ${d.gf ? `<text class="sidgad-graf-valor" x="${cx}" y="${centro - hF - 5}" text-anchor="middle">${d.gf}</text>` : ''}
        ${d.gc ? `<text class="sidgad-graf-valor" x="${cx}" y="${centro + hC + 13}" text-anchor="middle">${d.gc}</text>` : ''}
        ${rival}
        <text class="sidgad-graf-res sidgad-graf-res-${d.r || 'x'}" x="${cx}" y="${base + 13}" text-anchor="middle">${d.r ? sidgadT(`${d.r}|forma`) : ''}</text>
        <rect x="${inicio + i * banda}" y="0" width="${banda}" height="${alto}" fill="transparent"></rect>
      </g>`;
  }).join('');

  return `
    <figure class="sidgad-ficha-grafica">
      <figcaption>${sidgadT('Goles por partido')}</figcaption>
      <p class="sidgad-ficha-graf-ayuda">${sidgadT('Cada barra es un partido: {a}a favor arriba y {b}en contra abajo. Debajo, rival y resultado.', { a: '<i class="sidgad-ley-1"></i>', b: '<i class="sidgad-ley-2"></i>' })}</p>
      <svg class="sidgad-graf" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Goles a favor y en contra por partido">
        <line class="sidgad-graf-base" x1="${izq}" x2="${ancho - izq}" y1="${centro}" y2="${centro}"></line>
        ${barras}
      </svg>
    </figure>`;
}

// Quién marca: goleadores del equipo en barras horizontales, con su % de los goles del equipo.
function sidgadEquipoGraficaGoleadores() {
  const { datos, liga } = sidgadEquipo;
  const conGoles = datos.jugadores
    .map(f => ({ f, g: sidgadNum(f.goals) ?? 0 }))
    .filter(x => x.g > 0)
    .sort((a, b) => b.g - a.g);
  if (conGoles.length < 2) return '';
  const total = sidgadNum(datos.clasif?.fila?.gf) || conGoles.reduce((t, x) => t + x.g, 0);
  const top = conGoles.slice(0, 8);
  const maximo = top[0].g;

  return `
    <figure class="sidgad-ficha-grafica">
      <figcaption>${sidgadT('Quién marca')}</figcaption>
      <p class="sidgad-ficha-graf-ayuda">${sidgadT('Goles de cada jugador y qué parte suponen de los {n} goles del equipo.', { n: total })}</p>
      <ol class="sidgad-equipo-goleadores">
        ${top.map(x => `
          <li>
            <span class="sidgad-equipo-goleador-nombre">${sidgadEnlaceJugador(x.f.player_id, liga.id_temp, sidgadStatsNombre(x.f.player_name))}</span>
            <span class="sidgad-equipo-goleador-barra"><span style="width:${((x.g / maximo) * 100).toFixed(1)}%"></span></span>
            <b>${x.g}</b>
            <small>${total ? Math.round((x.g / total) * 100) : 0}%</small>
          </li>`).join('')}
      </ol>
    </figure>`;
}

// Puntos acumulados partido a partido (3 por victoria, 1 por empate; sin bonus).
function sidgadPuntosAcumulados(partidos, teamId) {
  let total = 0;
  return partidos.filter(sidgadPartidoJugado).map(p => {
    const r = sidgadResultadoEquipo(p, teamId);
    total += r === 'G' ? 3 : r === 'E' ? 1 : 0;
    return total;
  });
}

// Carrera por los puntos: todos los equipos de su clasificación en gris y el de la ficha
// resaltado. Sólo los partidos que cuenta esa clasificación (los PJ primeros): fuera playoffs.
function sidgadEquipoGraficaCarrera() {
  const { datos, id, liga } = sidgadEquipo;
  const grupo = datos.bloques.flatMap(b => b.grupos).find(g => g.equipos.some(e => String(e.team_id) === String(id)));
  if (!grupo || grupo.equipos.length < 2) return '';

  const series = grupo.equipos.map((fila, indice) => {
    const teamId = String(fila.team_id);
    const suyos = datos.todos.filter(p => String(p.home_id) === teamId || String(p.away_id) === teamId);
    const serie = sidgadPuntosAcumulados(suyos, teamId).slice(0, sidgadNum(fila.played) ?? undefined);
    const corto = (liga.teams || []).find(t => String(t.teamId) === teamId)?.name_short || fila.team_short || '';
    return { teamId, fila, serie, corto, posicion: sidgadNum(fila.order) ?? indice + 1 };
  }).filter(x => x.serie.length);
  const propio = series.find(x => x.teamId === String(id));
  const n = Math.max(0, ...series.map(x => x.serie.length));
  if (!propio || n < 2) return '';
  const lider = series[0];

  const ancho = 460;
  const alto = 240;
  const izq = 28;
  const der = 76;
  const arriba = 12;
  const abajo = 24;
  const maximo = Math.max(3, ...series.flatMap(x => x.serie));
  const paso = maximo <= 15 ? 3 : maximo <= 30 ? 6 : maximo <= 60 ? 12 : 20;
  const tope = Math.ceil(maximo / paso) * paso;
  const xDe = i => izq + (i / (n - 1)) * (ancho - izq - der);
  const yDe = v => alto - abajo - (v / tope) * (alto - arriba - abajo);
  const ruta = serie => serie.map((v, i) => `${i ? 'L' : 'M'}${xDe(i).toFixed(1)},${yDe(v).toFixed(1)}`).join('');
  const marcas = [];
  for (let v = 0; v <= tope; v += paso) marcas.push(v);

  const ultimo = x => x.serie[x.serie.length - 1];
  // Etiqueta al final de cada línea (puesto y abreviatura). Se colocan de arriba abajo con una
  // separación mínima para que no se pisen; una guía fina une cada etiqueta con su línea.
  const separacion = 12;
  const etiquetas = series
    .map(x => ({ x, yLinea: yDe(ultimo(x)), y: yDe(ultimo(x)) + 4 }))
    .sort((a, b) => a.y - b.y);
  // La etiqueta del propio equipo es más grande: necesita algo más de hueco.
  const hueco = (a, b) => separacion + (a.x === propio || b.x === propio ? 3 : 0);
  etiquetas.forEach((e, i) => { if (i && e.y - etiquetas[i - 1].y < hueco(e, etiquetas[i - 1])) e.y = etiquetas[i - 1].y + hueco(e, etiquetas[i - 1]); });
  const desborde = etiquetas.length ? etiquetas[etiquetas.length - 1].y - (alto - abajo + 4) : 0;
  if (desborde > 0) etiquetas.forEach(e => { e.y -= desborde; });

  const lineasGris = series.filter(x => x !== propio).map(x => `
    <path class="sidgad-graf-linea-gris" d="${ruta(x.serie)}"><title>${escaparHtml(`${x.posicion}º ${String(x.fila.team_name).trim()} · ${ultimo(x)} pts`)}</title></path>`).join('');

  return `
    <figure class="sidgad-ficha-grafica">
      <figcaption>${sidgadT('Carrera por los puntos')}</figcaption>
      <p class="sidgad-ficha-graf-ayuda"><i class="sidgad-ley-1"></i>${escaparHtml(datos.nombre)} frente al resto de la clasificación (en gris). Puntos acumulados por partido, sin bonus.</p>
      <svg class="sidgad-graf" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Puntos acumulados de todos los equipos, con ${escaparHtml(datos.nombre)} resaltado">
        ${marcas.map(v => `<line class="sidgad-graf-rejilla" x1="${izq}" x2="${ancho - der}" y1="${yDe(v)}" y2="${yDe(v)}"></line><text class="sidgad-graf-y" x="${izq - 6}" y="${yDe(v) + 3}" text-anchor="end">${v}</text>`).join('')}
        <text class="sidgad-graf-x" x="${izq}" y="${alto - 6}">${sidgadT('Partido 1')}</text>
        <text class="sidgad-graf-x" x="${ancho - der}" y="${alto - 6}" text-anchor="end">Partido ${n}</text>
        ${lineasGris}
        <path class="sidgad-graf-linea" d="${ruta(propio.serie)}"></path>
        <circle class="sidgad-graf-punto" cx="${xDe(propio.serie.length - 1)}" cy="${yDe(ultimo(propio))}" r="4"></circle>
        ${etiquetas.map(({ x, y, yLinea }) => {
          const xFin = xDe(x.serie.length - 1);
          return `<line class="sidgad-graf-guia" x1="${xFin + 2}" y1="${yLinea}" x2="${xFin + 7}" y2="${y - 4}"></line>
            <text class="sidgad-graf-etiqueta ${x === propio ? 'sidgad-graf-etiqueta-propia' : 'sidgad-graf-etiqueta-gris'}" x="${xFin + 9}" y="${y}">${sidgadT('{n}º', { n: x.posicion })} ${escaparHtml(x.corto)} ${ultimo(x)}</text>`;
        }).join('')}
      </svg>
    </figure>`;
}

// En casa / fuera: balance, goles y puntos según dónde se jugó.
function sidgadEquipoCasaFuera() {
  const { datos, id } = sidgadEquipo;
  const jugados = datos.partidos.filter(sidgadPartidoJugado);
  if (jugados.length < 2) return '';
  const resumen = local => {
    const lista = jugados.filter(p => (String(p.home_id) === String(id)) === local);
    const r = { pj: lista.length, g: 0, e: 0, p: 0, gf: 0, gc: 0 };
    lista.forEach(p => {
      const [l, v] = String(p.result).split(':').map(x => sidgadNum(x) ?? 0);
      r.gf += local ? l : v;
      r.gc += local ? v : l;
      const res = sidgadResultadoEquipo(p, id);
      if (res === 'G') r.g++; else if (res === 'E') r.e++; else if (res === 'P') r.p++;
    });
    r.pts = r.g * 3 + r.e;
    r.porc = r.pj ? r.pts / (r.pj * 3) : 0;
    return r;
  };
  const casa = resumen(true);
  const fuera = resumen(false);
  const fila = (titulo, a, b) => `<tr><th>${sidgadT(titulo)}</th><td>${a}</td><td>${b}</td></tr>`;
  const barra = r => `<span class="sidgad-equipo-cf-barra"><span style="width:${(r.porc * 100).toFixed(1)}%"></span></span><b>${Math.round(r.porc * 100)}%</b>`;

  return `
    <figure class="sidgad-ficha-grafica">
      <figcaption>${sidgadT('En casa / Fuera')}</figcaption>
      <table class="sidgad-equipo-cf">
        <thead><tr><th></th><th>${sidgadT('En casa')}</th><th>${sidgadT('Fuera')}</th></tr></thead>
        <tbody>
          ${fila('Partidos', casa.pj, fuera.pj)}
          ${fila('Balance (G-E-P)', `${casa.g}-${casa.e}-${casa.p}`, `${fuera.g}-${fuera.e}-${fuera.p}`)}
          ${fila('Goles a favor', casa.gf, fuera.gf)}
          ${fila('Goles en contra', casa.gc, fuera.gc)}
          ${fila('Puntos', casa.pts, fuera.pts)}
          <tr class="sidgad-equipo-cf-porc"><th>${sidgadT('% de puntos')}</th><td>${barra(casa)}</td><td>${barra(fuera)}</td></tr>
        </tbody>
      </table>
    </figure>`;
}

// Resumen con el mismo formato que el de la ficha de jugador: tira de totales,
// tarjetas de momento y de líderes (borde lateral) y la gráfica.
function sidgadEquipoResumenHtml() {
  const { datos, liga, id } = sidgadEquipo;
  const fila = datos.clasif?.fila;
  const hoy = new Date().setHours(0, 0, 0, 0);
  const jugados = datos.partidos.filter(sidgadPartidoJugado);
  const proximos = datos.partidos.filter(p => !sidgadPartidoJugado(p) && p.fecha >= hoy);

  const tarjeta = (largo, corto, valor) => `<article class="sidgad-ficha-card" title="${sidgadT(largo)}"><span>${sidgadT(corto)}</span><strong>${escaparHtml(valor ?? '—')}</strong></article>`;
  const totales = fila ? `<div class="sidgad-ficha-cards">
    ${tarjeta('Puntos', 'PTS', fila.points)}${tarjeta('Partidos jugados', 'PJ', fila.played)}${tarjeta('Ganados', 'G|forma', fila.win)}${tarjeta('Empatados', 'E|forma', fila.tie)}
    ${tarjeta('Perdidos', 'P|forma', fila.lost)}${tarjeta('Goles a favor', 'GF', fila.gf)}${tarjeta('Goles en contra', 'GC', fila.ga)}${tarjeta('Diferencia', 'DIF', fila.gavg)}
    ${fila.pp_goals !== undefined ? `${tarjeta('Goles en power play', 'GPP', fila.pp_goals)}${tarjeta('Goles encajados en inferioridad', 'GCI', fila.pp_goals_against)}${tarjeta('Goles en inferioridad', 'GI', fila.sh_goals)}${tarjeta('Goles encajados en power play', 'GCP', fila.sh_goals_against)}` : ''}
  </div>` : '';

  const racha = (titulo, valor, detalle) => `<div class="sidgad-ficha-racha"><span>${titulo}</span><strong>${valor}</strong>${detalle ? `<small>${detalle}</small>` : ''}</div>`;
  const rivalTexto = p => {
    const local = String(p.home_id) === String(id);
    const rivalId = local ? p.away_id : p.home_id;
    return `${local ? sidgadT('vs') : '@'} ${sidgadEnlaceEquipo(rivalId, escaparHtml(local ? p.away_name : p.home_name))}`;
  };
  const ultimo = jugados[jugados.length - 1];
  const proximo = proximos[0];
  const rachaActual = sidgadEquipoRacha(jugados, id);
  const forma = jugados.slice(-5).map(p => {
    const r = sidgadResultadoEquipo(p, id);
    return `<span class="sidgad-equipo-forma-${r || 'x'}" title="${escaparHtml(`${p.result} · ${String(p.dia_partido).slice(0, 5)}`)}">${r ? sidgadT(`${r}|forma`) : '·'}</span>`;
  }).join('');

  const momento = [
    ultimo && racha(sidgadT('Último partido'), `<span class="sidgad-equipo-res-${sidgadResultadoEquipo(ultimo, id)}">${sidgadT(`${sidgadResultadoEquipo(ultimo, id)}|forma`)} ${escaparHtml(ultimo.result.replace(':', '-'))}</span>`, `${rivalTexto(ultimo)} · ${escaparHtml(String(ultimo.dia_partido).slice(0, 5))}`),
    proximo && racha(sidgadT('Próximo partido'), `${escaparHtml(String(proximo.dia_partido).slice(0, 5))} · ${escaparHtml(proximo.hora_partido && proximo.hora_partido !== '_' ? proximo.hora_partido : '')}`, rivalTexto(proximo)),
    rachaActual && racha(sidgadT('Racha'), `<span class="sidgad-equipo-res-${rachaActual.tipo}">${rachaActual.texto}</span>`, sidgadT('seguidos')),
    forma && racha(sidgadT('Últimos 5'), `<span class="sidgad-equipo-forma">${forma}</span>`, ''),
  ].filter(Boolean).join('');

  // Líderes: versión compacta de la tarjeta de líderes de la Portada (foto, nombre, valor).
  const lideres = sidgadStatsColumnas('jugadores', liga).filter(col => col.rapido).map(col => {
    const top = sidgadPortadaTop(datos.jugadores, col)[0];
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

  return `
    ${totales}
    ${momento ? `<h3 class="sidgad-ficha-subtitulo">${sidgadT('Momento')}</h3><div class="sidgad-ficha-rachas">${momento}</div>` : ''}
    ${lideres ? `<h3 class="sidgad-ficha-subtitulo">${sidgadT('Líderes')}</h3><div class="sidgad-equipo-lideres">${lideres}</div>` : ''}
    ${jugados.length ? `<h3 class="sidgad-ficha-subtitulo">${sidgadT('Evolución')}</h3>${sidgadEquipoGraficaGoles(jugados)}${sidgadEquipoGraficaCarrera()}${sidgadEquipoCasaFuera()}${sidgadEquipoGraficaGoleadores()}` : ''}
  ` || `<p class="sidgad-ficha-vacio">${sidgadT('Sin datos de este equipo.')}</p>`;
}

// Tabla de plantilla. Con `tipo` (jugadores/porteros) las cabeceras ordenan, como en Estadísticas.
function sidgadEquipoTablaHtml(lista, columnas, titulo, liga, { tipo = null, orden = null } = {}) {
  if (!lista.length) return '';
  const destacada = columnas.find(c => c.destacada) || columnas[0];
  const ordenActual = orden && columnas.some(c => c.clave === orden.clave) ? orden : { clave: destacada.clave, desc: !destacada.menorMejor };
  const col = columnas.find(c => c.clave === ordenActual.clave);
  const signo = ordenActual.desc ? -1 : 1;
  const filas = lista
    .map(f => ({ fila: f, valor: sidgadStatsValor(col, f) }))
    .sort((a, b) => {
      if (a.valor === null && b.valor !== null) return 1; // sin dato, al final
      if (b.valor === null && a.valor !== null) return -1;
      if (a.valor !== b.valor) return signo * (a.valor - b.valor);
      return (sidgadNum(b.fila.played) ?? 0) - (sidgadNum(a.fila.played) ?? 0);
    });

  const cabecera = c => {
    const activa = c.clave === ordenActual.clave;
    if (!tipo) return `<th title="${c.largo}" class="${activa ? 'sidgad-stats-activa' : ''}">${c.titulo}</th>`;
    const flecha = activa ? (ordenActual.desc ? '↓' : '↑') : '';
    return `<th class="${activa ? 'sidgad-stats-activa' : ''}" aria-sort="${activa ? (ordenActual.desc ? 'descending' : 'ascending') : 'none'}">
      <button type="button" data-plantilla-orden="${tipo}:${c.clave}" title="${c.largo}">${c.titulo}<span>${flecha}</span></button>
    </th>`;
  };

  return `
    <h3 class="sidgad-ficha-subtitulo">${sidgadT(titulo)}</h3>
    <div class="sidgad-stats-wrap">
      <table class="sidgad-stats-tabla sidgad-equipo-tabla">
        <thead><tr><th class="sidgad-stats-jugador">${sidgadT(titulo === 'Porteros' ? 'Portero' : 'Jugador')}</th>${columnas.map(cabecera).join('')}</tr></thead>
        <tbody>
          ${filas.map(({ fila }) => `
            <tr>
              <td class="sidgad-stats-jugador">
                <img class="sidgad-stats-bandera" src="${escaparHtml(fila.player_flag || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
                ${sidgadEnlaceJugador(fila.player_id, liga.id_temp, sidgadStatsNombre(fila.player_name))}
              </td>
              ${columnas.map(c => `<td class="${c.clave === ordenActual.clave ? 'sidgad-stats-activa' : ''}">${sidgadStatsFormato(c, fila)}</td>`).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// stats.rosters también trae a los porteros: en las plantillas sólo sigue entre los
// jugadores quien tenga más partidos que como portero (jugó también de campo).
function sidgadJugadoresSinPorteros(jugadores, porteros) {
  const comoPortero = new Map(porteros.map(f => [String(f.player_id), sidgadNum(f.played) ?? 0]));
  return jugadores.filter(f => {
    const id = String(f.player_id);
    return !comoPortero.has(id) || (sidgadNum(f.played) ?? 0) > comoPortero.get(id);
  });
}

// Columnas de plantilla: totales sin las medias por partido.
function sidgadColumnasPlantilla(liga) {
  return {
    jugadores: sidgadStatsColumnas('jugadores', liga).filter(c => !/_pj$/.test(c.clave)),
    porteros: SIDGAD_STATS_PORTEROS.filter(c => ['played', 'goalie_time', 'goalie_porc', 'goalie_goals_pp', 'goalie_shoots', 'goalie_goals'].includes(c.clave)),
  };
}

function sidgadEquipoPartidosHtml() {
  const { datos, id } = sidgadEquipo;
  if (!datos.partidos.length) return `<p class="sidgad-ficha-vacio">${sidgadT('Sin partidos.')}</p>`;
  let faseActual;
  const filas = datos.partidos.map(p => {
    let fase = '';
    if (p.fase && p.fase !== faseActual) {
      faseActual = p.fase;
      fase = `<li class="sidgad-equipo-fase">${escaparHtml(p.fase)}</li>`;
    }
    const r = sidgadPartidoJugado(p) ? sidgadResultadoEquipo(p, id) : null;
    return fase + sidgadPortadaFilaPartido(p, sidgadPartidoJugado(p))
      .replace('<li class="sidgad-portada-partido">', `<li class="sidgad-portada-partido sidgad-equipo-partido-${r || 'pendiente'}">`);
  }).join('');
  return `<ul class="sidgad-portada-partidos sidgad-equipo-partidos">${filas}</ul>`;
}

/* ===== Abrir / cerrar (los llama el router) ===== */

async function abrirFichaEquipo(teamId) {
  const liga = sidgadLigaSeleccionada;
  if (!liga) return;
  const overlay = sidgadEquipoOverlay();
  const peticion = ++sidgadEquipo.peticion;
  Object.assign(sidgadEquipo, { id: String(teamId), liga, pestana: 'resumen', datos: null });

  document.getElementById('sidgad-equipo-cuerpo').innerHTML = `<p class="sidgad-ficha-vacio">${sidgadT('Cargando...')}</p>`;
  overlay.classList.add('sidgad-activo');
  document.body.style.overflow = 'hidden';

  const datos = await sidgadCargarEquipo(liga, teamId);
  if (peticion !== sidgadEquipo.peticion) return; // se cerró o se abrió otro mientras cargaba
  sidgadEquipo.datos = datos;
  sidgadEquipoPintar();
}

function cerrarFichaEquipo() {
  sidgadEquipo.peticion++;
  const overlay = document.getElementById('sidgad-equipo-overlay');
  if (overlay) overlay.classList.remove('sidgad-activo');
  sidgadActualizarScroll();
}

window.sidgadEquipo = { abrir: abrirFichaEquipo, cerrar: cerrarFichaEquipo };

document.addEventListener('click', (event) => {
  // "Plantilla" lleva a la pestaña Plantillas de la liga, centrada en este equipo.
  const plantilla = event.target.closest('[data-equipo-plantilla]');
  if (plantilla) {
    window.sidgadPlantillaFoco = plantilla.dataset.equipoPlantilla;
    // Si ya se estaba en Plantillas la vista no se recarga: se aplica el equipo al navegar.
    setTimeout(() => {
      if (document.getElementById('sidgad-liga-main-content')?.dataset.vista === 'plantillas') sidgadPlantillasAplicarFoco();
    }, 0);
  }

  const tab = event.target.closest('[data-equipo-tab]');
  if (!tab) return;
  sidgadEquipo.pestana = tab.dataset.equipoTab;
  sidgadEquipoPintar();
}, true);

