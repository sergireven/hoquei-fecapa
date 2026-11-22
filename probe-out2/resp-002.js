/*
 * Cuadros eliminatorios del calendario. Tras la fila FASE puede venir una de estas filas:
 *
 *   MODEL_COPA: partido único. home_name = equipos del cuadro (8 o 4); away_name = los idp en orden.
 *     8 → cuartos (2 izquierda, 2 derecha), semifinal izquierda, semifinal derecha, final
 *     4 → semifinal izquierda, semifinal derecha, final
 *   MODEL_PLAYOFF: eliminatorias. away_name = "0_|1_|…|13_17255-17259-17260_0-2|…|16_": huecos numerados
 *     y, en cada uno, los idp de esa eliminatoria (ida, vuelta, desempates… hasta 5) y, opcional, los
 *     partidos ganados por cada equipo contando penaltis (primero, el local del primer partido).
 *     1–4 octavos izquierda, 5–8 octavos derecha, 9–10 cuartos izquierda, 11–12 cuartos derecha,
 *     13 semifinal izquierda, 14 semifinal derecha, 15 final, 16 tercer y cuarto puesto (0 no se usa).
 *   En los dos, result dice qué partidos se decidieron en la prórroga o en los penaltis y quién los
 *   ganó (sidgadCalendarioDesempates): llega a cada partido como p.desempate.
 *
 * Los dos comparten el cuadro (simétrico en escritorio, rondas deslizables en móvil, líneas que se
 * colorean con el camino de cada ganador y el campeón encima). Cambia la tarjeta: en copa, el
 * partido con sus goles; en playoff, la eliminatoria con sus partidos ganados. Los partidos, con
 * el acta, siguen en la lista de debajo.
 */

/* ===== Común ===== */

// "3:2", "2:2 (4:3 pen)"... → goles de cada lado y lo que venga detrás (penaltis). El ganador de
// un partido decidido en la prórroga o en los penaltis sale de p.desempate (result de MODEL_*);
// si no, un empate se decide con home_penals / away_penals o "(x:y)" en el resultado.
function sidgadCopaMarcador(p) {
  if (!p || !sidgadPartidoJugado(p)) return null;
  const m = String(p.result).match(/^\s*(\d+)\s*[:\-]\s*(\d+)\s*(.*)$/);
  if (!m) return null;
  const home = Number(m[1]);
  const away = Number(m[2]);
  let extra = m[3].trim();
  let gana = home > away ? 'home' : away > home ? 'away' : null;
  const d = p.desempate;
  const ladoDesempate = d && (String(p.home_id) === d.ganador ? 'home' : String(p.away_id) === d.ganador ? 'away' : null);
  if (ladoDesempate) {
    gana = ladoDesempate;
    return { home, away, extra, gana, desempate: d.tipo };
  }
  if (!gana) {
    const penHome = sidgadNum(p.home_penals);
    const penAway = sidgadNum(p.away_penals);
    const pen = extra.match(/(\d+)\s*[:\-]\s*(\d+)/);
    const [a, b] = penHome !== null && penAway !== null ? [penHome, penAway] : pen ? [Number(pen[1]), Number(pen[2])] : [null, null];
    if (a !== null && a !== b) {
      gana = a > b ? 'home' : 'away';
      if (!extra) extra = sidgadT('({a}-{b} pen.)', { a, b });
    }
  }
  return { home, away, extra, gana };
}

function sidgadCuadroCorto(id) {
  return (sidgadLigaSeleccionada?.teams || []).find(t => String(t.teamId) === String(id))?.name_short || '';
}

function sidgadCuadroFecha(p) {
  return String(p?.dia_partido || '').slice(0, 5);
}

const SIDGAD_CUADRO_VACIO = `<article class="sidgad-copa-partido sidgad-copa-vacio"><span>${sidgadT('Por disputar')}</span></article>`;

// Logo y nombre de un equipo dentro de una tarjeta (abreviatura y, debajo, el nombre largo).
function sidgadCuadroNombre(id, nombre, logo) {
  const corto = sidgadCuadroCorto(id);
  return `
    <img src="${escaparHtml(logo || SIDGAD_DEFAULT_LOGO)}" alt="" loading="lazy" onerror="this.src='${SIDGAD_DEFAULT_LOGO}'">
    <span class="sidgad-copa-nombre">
      ${nombre ? sidgadEnlaceEquipo(id, `<strong>${escaparHtml(corto || nombre)}</strong>`) : `<strong>${sidgadT('Por determinar')}</strong>`}
      ${corto && nombre ? `<small>${escaparHtml(nombre)}</small>` : ''}
    </span>`;
}

function sidgadCuadroTitulo(texto, final) {
  return `<h3 class="sidgad-copa-titulo">${final ? '<i class="fas fa-trophy" aria-hidden="true"></i>' : ''}${escaparHtml(texto || '')}</h3>`;
}

/*
 * Cuadro: rondas de fuera hacia dentro ({ titulo, izq: [celda], der: [celda] }), la final y,
 * opcionales, el tercer puesto y el campeón. Celda = { html, ganador } (ganador = team_id o null).
 * Cada partido va en una celda de alto igual dentro de su ronda: así cada cruce queda a media
 * altura de los dos que lo alimentan. La línea que sale de una celda se colorea si ya hay ganador.
 */
function sidgadCuadroHtml({ clase, rondas, final, tercero, campeon }) {
  const celdas = (lista, llegan) => lista.map(c => `
    <div class="sidgad-copa-celda${c.ganador ? ' sidgad-cuadro-avanza' : ''}${llegan && c.completo ? ' sidgad-cuadro-llega' : ''}">${c.html}</div>`).join('');

  // Escritorio: simétrico, de fuera hacia la final y de vuelta hacia fuera.
  const columna = (ronda, lado, i) => `
    <div class="sidgad-cuadro-col sidgad-cuadro-${lado}${i === 0 ? ' sidgad-cuadro-primera' : ''}${ronda[lado].length === 1 ? ' sidgad-cuadro-semi' : ''}">
      ${sidgadCuadroTitulo(ronda.titulo)}
      <div class="sidgad-cuadro-cuerpo">${celdas(ronda[lado], i > 0)}</div>
    </div>`;
  const colFinal = `
    <div class="sidgad-cuadro-col sidgad-copa-final">
      ${sidgadCuadroTitulo(final.titulo, true)}
      <div class="sidgad-cuadro-cuerpo">${celdas([final.celda], rondas.length > 0)}</div>
    </div>`;
  const columnas = [
    ...rondas.map((r, i) => columna(r, 'izq', i)),
    colFinal,
    ...rondas.map((r, i) => columna(r, 'der', i)).reverse(),
  ];

  // Móvil: una columna por ronda, en orden (izquierda y luego derecha), para deslizar.
  const movil = [
    ...rondas.map((r, i) => `
      <div class="sidgad-copa-ronda">
        ${sidgadCuadroTitulo(r.titulo)}
        <div class="sidgad-copa-ronda-cuerpo">${celdas([...r.izq, ...r.der], i > 0)}</div>
      </div>`),
    `<div class="sidgad-copa-ronda sidgad-copa-final">
      ${sidgadCuadroTitulo(final.titulo, true)}
      <div class="sidgad-copa-ronda-cuerpo">${celdas([final.celda], rondas.length > 0)}</div>
    </div>`,
  ].join('');

  const banda = campeon ? `
    <div class="sidgad-cuadro-campeon">
      <i class="fas fa-trophy" aria-hidden="true"></i>
      <span>${escaparHtml(campeon.etiqueta || sidgadT('Campeón'))}</span>
      <img src="${escaparHtml(campeon.logo || SIDGAD_DEFAULT_LOGO)}" alt="" onerror="this.src='${SIDGAD_DEFAULT_LOGO}'">
      ${sidgadEnlaceEquipo(campeon.id, `<strong>${escaparHtml(campeon.nombre)}</strong>`)}
    </div>` : '';

  const terceroHtml = tercero ? `
    <div class="sidgad-cuadro-tercero">
      ${sidgadCuadroTitulo(tercero.titulo)}
      ${tercero.celda.html}
    </div>` : '';

  return `
    <div class="sidgad-copa ${clase} sidgad-cuadro-cols-${columnas.length}">
      ${banda}
      <div class="sidgad-cuadro" style="--sidgad-cuadro-cols: ${columnas.length}">${columnas.join('')}</div>
      <div class="sidgad-copa-movil">${movil}</div>
      ${terceroHtml}
    </div>`;
}

/* ===== Copa: partido único ===== */

function sidgadCopaEquipo(p, lado, marcador) {
  const estado = !marcador?.gana ? '' : marcador.gana === lado ? ' sidgad-copa-gana' : ' sidgad-copa-pierde';
  return `
    <div class="sidgad-copa-equipo team-${escaparHtml(p[`${lado}_id`])}${estado}">
      ${sidgadCuadroNombre(p[`${lado}_id`], String(p[`${lado}_name`] || '').trim(), p[`${lado}_logo`])}
      <span class="sidgad-copa-goles">${marcador ? marcador[lado] : ''}</span>
    </div>`;
}

// Pie de la tarjeta: "Gana en los penaltis" / "Gana en la prórroga" (o la tanda del resultado).
function sidgadCopaDesempateTexto(marcador) {
  if (marcador?.desempate === 'penaltis') return sidgadT('En los penaltis');
  if (marcador?.desempate === 'prorroga') return sidgadT('En la prórroga');
  return marcador?.extra || '';
}

function sidgadCopaCelda(p) {
  if (!p) return { html: SIDGAD_CUADRO_VACIO, ganador: null, completo: false };
  const marcador = sidgadCopaMarcador(p);
  const fecha = [sidgadCuadroFecha(p), p.hora_partido && p.hora_partido !== '_' ? p.hora_partido : ''].filter(Boolean).join(' · ');
  const acta = marcador && SIDGAD_SETTINGS.has_acta_digital
    ? `<a class="sidgad-nav sidgad-copa-acta" href="${escaparHtml(sidgadUrl({ ...sidgadLeerEstado(), partido: p.idp, jugador: null, temporada: null }))}" title="${sidgadT('Ver acta')}" aria-label="${sidgadT('Ver acta')}"><i class="fas fa-search" aria-hidden="true"></i></a>`
    : '';
  const ganador = marcador?.gana ? String(p[`${marcador.gana}_id`]) : null;
  return {
    ganador,
    completo: !!(p.home_id && p.away_id),
    equipo: ganador ? { id: ganador, nombre: String(p[`${marcador.gana}_name`] || '').trim(), logo: p[`${marcador.gana}_logo`] } : null,
    html: `
      <article class="sidgad-copa-partido${marcador ? '' : ' sidgad-copa-pendiente'}">
        ${sidgadCopaEquipo(p, 'home', marcador)}
        ${sidgadCopaEquipo(p, 'away', marcador)}
        <footer class="sidgad-copa-pie">
          <span>${escaparHtml(fecha)}${sidgadCopaDesempateTexto(marcador) ? ` · <strong class="sidgad-copa-desempate">${escaparHtml(sidgadCopaDesempateTexto(marcador))}</strong>` : ''}</span>
          ${acta}
        </footer>
      </article>`,
  };
}

// Título de una ronda: la jornada del calendario de su primer partido ("CUARTOS DE FINAL"...).
function sidgadCopaTituloRonda(ids, partidos) {
  return ids.map(id => partidos.get(id)?.jornada).find(Boolean) || '';
}

// rondas: { izq, der } con posiciones en la lista de idp; final: su posición.
const SIDGAD_COPA_MODELOS = {
  8: { rondas: [{ izq: [0, 1], der: [2, 3] }, { izq: [4], der: [5] }], final: 6, clase: 'sidgad-copa-8' },
  4: { rondas: [{ izq: [0], der: [1] }], final: 2, clase: 'sidgad-copa-4' },
};

// En una fase por puestos ("5º AL 8º", "PLAY OFF 9 Y 10") quien gana la final no es campeón. Hace
// falta un rango de puestos: un número suelto es parte del nombre ("COPPA ITALIA A1", "U17").
function sidgadCuadroEtiqueta(fase, tituloFinal) {
  const porPuestos = /(^|[^a-z\d])\d+\s*[º°ª]?\s*(al|a|y|e|-|–|\/)\s*\d+/i.test(String(fase || ''));
  return porPuestos ? (tituloFinal || sidgadT('Ganador')) : sidgadT('Campeón');
}

// fila = la fila MODEL_COPA; partidos = Map idp → partido (con su jornada); fase = nombre de la fase.
function sidgadCopaCuadro(fila, partidos, fase = '') {
  const modelo = SIDGAD_COPA_MODELOS[Number(fila.home_name)];
  const ids = String(fila.away_name || '').split(',').map(s => s.trim());
  if (!modelo || !ids.some(Boolean)) return '';
  const celda = n => sidgadCopaCelda(partidos.get(ids[n]));
  const rondas = modelo.rondas.map(r => ({
    titulo: sidgadCopaTituloRonda([...r.izq, ...r.der].map(n => ids[n]), partidos),
    izq: r.izq.map(celda),
    der: r.der.map(celda),
  }));
  const final = celda(modelo.final);
  const tituloFinal = sidgadCopaTituloRonda([ids[modelo.final]], partidos) || sidgadT('Final');
  return sidgadCuadroHtml({
    clase: `sidgad-cuadro-copa ${modelo.clase}`,
    rondas,
    final: { titulo: tituloFinal, celda: final },
    campeon: final.equipo && { ...final.equipo, etiqueta: sidgadCuadroEtiqueta(fase, tituloFinal) },
  });
}

/* ===== Playoff: eliminatorias ===== */

const SIDGAD_PLAYOFF_RONDAS = [
  { titulo: sidgadT('Octavos de final'), izq: [1, 2, 3, 4], der: [5, 6, 7, 8] },
  { titulo: sidgadT('Cuartos de final'), izq: [9, 10], der: [11, 12] },
  { titulo: sidgadT('Semifinales'), izq: [13], der: [14] },
];
const SIDGAD_PLAYOFF_FINAL = 15;
const SIDGAD_PLAYOFF_TERCERO = 16;

// Hueco → { ids, ganados }; ganados = [local del primer partido, visitante] si la API los manda.
function sidgadPlayoffHuecos(fila) {
  const huecos = new Map();
  String(fila.away_name || '').split('|').forEach(trozo => {
    const [num, ids = '', resultado = ''] = trozo.split('_');
    const lista = ids.split('-').map(s => s.trim()).filter(Boolean);
    const m = resultado.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (lista.length) huecos.set(Number(num), { ids: lista, ganados: m ? [Number(m[1]), Number(m[2])] : null });
  });
  return huecos;
}

/*
 * Eliminatoria: los dos equipos (del primer partido), partidos ganados y si ya está decidida.
 * Con 2 partidos es ida y vuelta (decide la suma de goles); con 3 o 5, al mejor de 3 o de 5
 * (gana quien llega a 2 o a 3). Un partido sin resultado cuya fecha ya pasó no se jugó: era un
 * desempate que no hizo falta.
 */
function sidgadPlayoffSerie(hueco, partidos) {
  const ids = hueco?.ids || [];
  const juegos = ids.map(id => partidos.get(String(id))).filter(Boolean);
  if (!juegos.length) return null;
  const primero = juegos[0];
  const equipos = ['home', 'away'].map(lado => ({
    id: String(primero[`${lado}_id`]),
    nombre: String(primero[`${lado}_name`] || '').trim(),
    logo: primero[`${lado}_logo`],
    ganados: 0,
    goles: 0,
  }));
  const hoy = new Date().setHours(0, 0, 0, 0);
  const idaVuelta = ids.length === 2;
  const necesarios = idaVuelta ? null : Math.floor(ids.length / 2) + 1;
  let jugados = 0;
  let proximo = null;
  juegos.forEach(p => {
    const marcador = sidgadCopaMarcador(p);
    if (!marcador) {
      if (p.fecha >= hoy && (!proximo || p.fecha < proximo.fecha)) proximo = p;
      return;
    }
    jugados++;
    equipos.forEach(eq => { eq.goles += String(p.home_id) === eq.id ? marcador.home : marcador.away; });
    const ganador = marcador.gana ? String(p[`${marcador.gana}_id`]) : null;
    const eq = equipos.find(e => e.id === ganador);
    if (eq) eq.ganados++;
  });
  // Partidos ganados que manda la API (cuentan los desempates a penaltis): mandan sobre los calculados.
  if (hueco.ganados) equipos.forEach((eq, i) => { eq.ganados = hueco.ganados[i]; });
  const [a, b] = equipos;
  let ganador = null;
  if (idaVuelta) {
    if (jugados === 2 && a.goles !== b.goles) ganador = a.goles > b.goles ? a.id : b.id;
  } else {
    ganador = equipos.find(eq => eq.ganados >= necesarios)?.id || null;
  }
  return { equipos, ganador, idaVuelta, necesarios, jugados, proximo };
}

function sidgadPlayoffEquipo(serie, eq) {
  const estado = !serie.ganador ? '' : serie.ganador === eq.id ? ' sidgad-copa-gana' : ' sidgad-copa-pierde';
  // Al mejor de N: una marca por partido que hace falta ganar, rellena por cada victoria.
  const marcas = serie.idaVuelta ? '' : `
    <span class="sidgad-po-marcas" aria-hidden="true">${Array.from({ length: serie.necesarios }, (_, i) => `<i class="${i < eq.ganados ? 'sidgad-po-marca-si' : ''}"></i>`).join('')}</span>`;
  const valor = serie.idaVuelta ? eq.goles : eq.ganados;
  const titulo = sidgadT(serie.idaVuelta ? 'Goles en la eliminatoria' : 'Partidos ganados');
  return `
    <div class="sidgad-copa-equipo sidgad-po-equipo team-${escaparHtml(eq.id)}${estado}">
      ${sidgadCuadroNombre(eq.id, eq.nombre, eq.logo)}
      ${marcas}
      <span class="sidgad-po-valor" title="${titulo}">${valor}</span>
    </div>`;
}

function sidgadPlayoffCelda(serie) {
  if (!serie) return { html: SIDGAD_CUADRO_VACIO, ganador: null, completo: false };
  const [a, b] = serie.equipos;
  const marcador = (x, y) => `${x}-${y}`;
  const formato = serie.idaVuelta ? sidgadT('Ida y vuelta') : sidgadT('Al mejor de {n}', { n: serie.necesarios * 2 - 1 });
  let estado;
  if (serie.ganador) {
    const g = serie.equipos.find(eq => eq.id === serie.ganador);
    const otro = serie.equipos.find(eq => eq.id !== serie.ganador);
    const cifras = serie.idaVuelta ? marcador(g.goles, otro.goles) : marcador(g.ganados, otro.ganados);
    estado = `<span class="sidgad-po-estado-fin">${sidgadT('Gana {equipo} {resultado}', { equipo: escaparHtml(sidgadCuadroCorto(g.id) || g.nombre), resultado: cifras })}</span>`;
  } else if (serie.proximo) {
    estado = `${sidgadT(serie.jugados ? 'En juego' : 'Por empezar')} · ${sidgadT('próximo {fecha}', { fecha: escaparHtml(sidgadCuadroFecha(serie.proximo)) })}`;
  } else if (serie.jugados) {
    estado = sidgadT('Empate {resultado}', { resultado: serie.idaVuelta ? marcador(a.goles, b.goles) : marcador(a.ganados, b.ganados) });
  } else {
    estado = sidgadT('Por disputar');
  }
  const ganadorEq = serie.equipos.find(eq => eq.id === serie.ganador) || null;
  return {
    ganador: serie.ganador,
    completo: true,
    equipo: ganadorEq,
    html: `
      <article class="sidgad-copa-partido sidgad-po-serie${serie.ganador ? ' sidgad-po-decidida' : ''}">
        <header class="sidgad-po-formato">${formato}</header>
        ${serie.equipos.map(eq => sidgadPlayoffEquipo(serie, eq)).join('')}
        <footer class="sidgad-po-estado">${estado}</footer>
      </article>`,
  };
}

function sidgadPlayoffCuadro(fila, partidos, fase = '') {
  const huecos = sidgadPlayoffHuecos(fila);
  const celda = n => sidgadPlayoffCelda(sidgadPlayoffSerie(huecos.get(n), partidos));
  const primera = SIDGAD_PLAYOFF_RONDAS.findIndex(r => [...r.izq, ...r.der].some(n => huecos.has(n)));
  if (primera === -1 && !huecos.has(SIDGAD_PLAYOFF_FINAL)) return '';
  const rondas = (primera === -1 ? [] : SIDGAD_PLAYOFF_RONDAS.slice(primera)).map(r => ({
    titulo: r.titulo,
    izq: r.izq.map(celda),
    der: r.der.map(celda),
  }));
  const final = celda(SIDGAD_PLAYOFF_FINAL);
  return sidgadCuadroHtml({
    clase: 'sidgad-cuadro-playoff',
    rondas,
    final: { titulo: sidgadT('Final'), celda: final },
    tercero: huecos.has(SIDGAD_PLAYOFF_TERCERO) ? { titulo: sidgadT('3.er y 4.º puesto'), celda: celda(SIDGAD_PLAYOFF_TERCERO) } : null,
    campeon: final.equipo && { ...final.equipo, etiqueta: sidgadCuadroEtiqueta(fase, sidgadT('Ganador')) },
  });
}

// Al elegir un equipo en la cabecera se resalta su camino en el cuadro.
// Lo llama sidgadFiltrarCalendario (al pintar el calendario y al cambiar de equipo).
function sidgadCopaFiltrar() {
  const teamId = sidgadEquipoLigaActivo();
  document.querySelectorAll('.sidgad-copa').forEach(cuadro => {
    cuadro.classList.toggle('sidgad-copa-filtrado', !!teamId);
    cuadro.querySelectorAll('.sidgad-copa-equipo').forEach(eq => {
      eq.classList.toggle('sidgad-copa-elegido', !!teamId && eq.classList.contains(`team-${teamId}`));
    });
    cuadro.querySelectorAll('.sidgad-copa-partido').forEach(p => {
      p.classList.toggle('sidgad-copa-elegido', !!teamId && !!p.querySelector(`.team-${CSS.escape(String(teamId))}`));
    });
  });
}
