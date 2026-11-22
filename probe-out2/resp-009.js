/*
 * Clasificaciones de una liga (/standing/).
 * La API devuelve una lista plana en la que las filas con team_id = 0 son cabeceras:
 *   - equipos antes de cualquier cabecera  -> clasificación general
 *   - team_short "GENERAL" (o "-" en el formato antiguo) -> clasificación de una fase
 *   - team_short "GRUPO" (o "-" con nombre "GRUPO ..." tras una fase vacía) -> grupo de esa fase
 * En las ligas agrupadas, además, cada clasificación se pinta en el calendario después de los
 * partidos de su fase (por nombre o, si no coincide, por sus equipos). La pestaña Clasificaciones
 * sale si la competición la tiene en botones_liga, sea agrupada o no.
 */

function sidgadEsCabeceraClasif(fila) {
  return String(fila.team_id) === '0';
}

function sidgadNombreCabecera(fila) {
  const nombre = fila.team_name;
  return nombre === 0 || nombre === '0' || !String(nombre ?? '').trim() ? null : String(nombre).trim();
}

function sidgadClaveFase(nombre) {
  return String(nombre ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

// Lista plana -> [{ titulo, grupos: [{ titulo, equipos }] }]
function sidgadAgruparClasificaciones(filas = []) {
  const bloques = [];
  let bloque = null;
  let contenedor = false; // la fase actual tiene grupos debajo

  filas.forEach((fila, i) => {
    if (sidgadEsCabeceraClasif(fila)) {
      const nombre = sidgadNombreCabecera(fila);
      const tipo = String(fila.team_short || '-').toUpperCase();
      const siguiente = filas[i + 1];
      const esGrupo = tipo === 'GRUPO' || (tipo === '-' && contenedor && /^GRUPO/i.test(nombre || ''));

      if (esGrupo && bloque) {
        bloque.grupos.push({ titulo: nombre, equipos: [] });
        return;
      }
      bloque = { titulo: nombre, grupos: [] };
      bloques.push(bloque);
      // Una fase seguida directamente de otra cabecera contiene grupos.
      contenedor = !!siguiente && sidgadEsCabeceraClasif(siguiente);
      if (!contenedor) bloque.grupos.push({ titulo: null, equipos: [] });
      return;
    }

    if (!bloque) {
      bloque = { titulo: null, general: true, grupos: [{ titulo: null, equipos: [] }] };
      bloques.push(bloque);
      contenedor = false;
    }
    if (!bloque.grupos.length) bloque.grupos.push({ titulo: null, equipos: [] });
    bloque.grupos[bloque.grupos.length - 1].equipos.push(fila);
  });

  return bloques
    .map(b => ({ ...b, grupos: b.grupos.filter(g => g.equipos.length) }))
    .filter(b => b.grupos.length);
}

function sidgadColumnasClasif(bloques) {
  const equipos = bloques.flatMap(b => b.grupos.flatMap(g => g.equipos));
  const conValor = campo => equipos.some(e => (sidgadNum(e[campo]) ?? 0) !== 0);
  return [
    { campo: 'points', titulo: sidgadT('PTS'), largo: sidgadT('Puntos'), destacada: true },
    conValor('bonus') && { campo: 'bonus', titulo: sidgadT('BON'), largo: sidgadT('Puntos de bonus') },
    { campo: 'played', titulo: sidgadT('PJ'), largo: sidgadT('Partidos jugados') },
    { campo: 'win', titulo: sidgadT('PG'), largo: sidgadT('Partidos ganados') },
    equipos.some(e => e.pgpp !== null && e.pgpp !== undefined && e.pgpp !== '-') && { campo: 'pgpp', titulo: sidgadT('PGP'), largo: sidgadT('Ganados en prórroga o penaltis') },
    { campo: 'tie', titulo: sidgadT('PE|empatados'), largo: sidgadT('Partidos empatados') },
    equipos.some(e => e.pppp !== null && e.pppp !== undefined && e.pppp !== '-') && { campo: 'pppp', titulo: sidgadT('PPP'), largo: sidgadT('Perdidos en prórroga o penaltis') },
    { campo: 'lost', titulo: sidgadT('PP'), largo: sidgadT('Partidos perdidos') },
    { campo: 'gf', titulo: sidgadT('GF'), largo: sidgadT('Goles a favor') },
    { campo: 'ga', titulo: sidgadT('GC'), largo: sidgadT('Goles en contra') },
    { campo: 'gavg', titulo: sidgadT('DIF'), largo: sidgadT('Diferencia de goles') },
    conValor('penalti') && { campo: 'penalti', titulo: sidgadT('SAN'), largo: sidgadT('Puntos de sanción') },
  ].filter(Boolean);
}

// Vista "Power play": sólo si la clasificación trae esos campos (hockey línea). Los goles salen de
// situacion en los eventos; las ocasiones no llegan en /standing/.
function sidgadClasifTienePowerPlay(bloques) {
  return bloques.some(b => b.grupos.some(g => g.equipos.some(e => e.pp_goals !== undefined)));
}

function sidgadColumnasPowerPlay() {
  return [
    { campo: 'played', titulo: sidgadT('PJ'), largo: sidgadT('Partidos jugados') },
    { campo: 'pp_goals', titulo: sidgadT('GPP'), largo: sidgadT('Goles en power play'), destacada: true },
    { campo: 'pp_goals_against', titulo: sidgadT('GCI'), largo: sidgadT('Goles encajados en inferioridad') },
    { campo: 'sh_goals', titulo: sidgadT('GI'), largo: sidgadT('Goles en inferioridad') },
    { campo: 'sh_goals_against', titulo: sidgadT('GCP'), largo: sidgadT('Goles encajados en power play') },
  ];
}

function sidgadTablaClasifHtml(grupo, columnas) {
  const filas = grupo.equipos.map((e, i) => {
    const posicion = sidgadNum(e.order) ?? i + 1;
    return `
      <tr data-team-id="${escaparHtml(e.team_id)}">
        <td class="sidgad-clasif-pos">${posicion}</td>
        <td class="sidgad-clasif-equipo">
          <img src="${escaparHtml(e.team_logo || SIDGAD_DEFAULT_LOGO)}" alt="" loading="lazy" onerror="this.src='${SIDGAD_DEFAULT_LOGO}'">
          ${sidgadEnlaceEquipo(e.team_id, `<span class="sidgad-clasif-nombre">${escaparHtml(String(e.team_name ?? '').trim())}</span>
          <span class="sidgad-clasif-corto">${escaparHtml(e.team_short || '')}</span>`)}
        </td>
        ${columnas.map(c => `<td class="${c.destacada ? 'sidgad-clasif-pts' : ''}">${escaparHtml(e[c.campo] ?? '')}</td>`).join('')}
      </tr>`;
  }).join('');

  return `
    <div class="sidgad-clasif-wrap">
      <table class="sidgad-clasif-tabla">
        <thead>
          <tr>
            <th class="sidgad-clasif-grupo" colspan="2">${grupo.titulo ? escaparHtml(grupo.titulo) : ''}</th>
            ${columnas.map(c => `<th class="${c.destacada ? 'sidgad-clasif-pts' : ''}" title="${c.largo}">${c.titulo}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// En el calendario se antepone "Clasificación ·" para no confundir la tabla con la banda de su fase.
function sidgadBloqueClasifHtml(bloque, columnas, { prefijo = false } = {}) {
  const nombre = bloque.titulo || sidgadT('Clasificación general');
  const titulo = prefijo && bloque.titulo ? sidgadT('Clasificación · {nombre}', { nombre }) : nombre;
  return `
    <section class="sidgad-clasif-bloque">
      <h2 class="sidgad-calendario-fase sidgad-clasif-titulo">${escaparHtml(titulo)}</h2>
      ${bloque.grupos.map(g => sidgadTablaClasifHtml(g, columnas)).join('')}
    </section>`;
}

async function sidgadCargarClasificaciones(idc) {
  try {
    const data = await sidgadFetch('standing', { id: idc });
    return sidgadCopiarFechaApi(data, sidgadAgruparClasificaciones(data?.standings?.standing || []));
  } catch (err) {
    return [];
  }
}

// Vista "Clasificaciones" de la liga.
async function cargarClasificaciones() {
  const mainContent = document.getElementById('sidgad-liga-main-content');
  const liga = sidgadLigaSeleccionada;
  if (!mainContent || !liga?.idc) return;

  showLeagueLoading();
  const bloques = await sidgadCargarClasificaciones(liga.idc);
  if (sidgadLigaSeleccionada !== liga) return; // se cambió de liga mientras cargaba
  sidgadPieDatosLiga({ standing: bloques });

  if (!bloques.length) {
    mainContent.replaceChildren(crearNodo('p', { class: 'sidgad-empty-state', text: sidgadT('Clasificación aún no disponible.') }));
    return;
  }
  const general = sidgadColumnasClasif(bloques);
  const tablas = columnas => bloques.map(b => sidgadBloqueClasifHtml(b, columnas)).join('');
  if (!sidgadClasifTienePowerPlay(bloques)) {
    mainContent.innerHTML = tablas(general);
    sidgadMarcarEquipoClasif();
    return;
  }

  const vistas = [['general', sidgadT('General|clasificacion'), general], ['power-play', sidgadT('Power play'), sidgadColumnasPowerPlay()]];
  mainContent.innerHTML = `
    <div class="sidgad-ficha-tabs" role="tablist">
      ${vistas.map(([id, texto], i) => `<button type="button" role="tab" data-clasif-vista="${id}" aria-selected="${i === 0}" class="${i === 0 ? 'sidgad-activo' : ''}">${texto}</button>`).join('')}
    </div>
    <div data-clasif-tablas>${tablas(general)}</div>`;
  mainContent.querySelector('[role="tablist"]').addEventListener('click', (event) => {
    const boton = event.target.closest('[data-clasif-vista]');
    if (!boton) return;
    mainContent.querySelectorAll('[data-clasif-vista]').forEach(b => {
      b.classList.toggle('sidgad-activo', b === boton);
      b.setAttribute('aria-selected', String(b === boton));
    });
    mainContent.querySelector('[data-clasif-tablas]').innerHTML = tablas(vistas.find(([id]) => id === boton.dataset.clasifVista)[2]);
    sidgadMarcarEquipoClasif();
  });
  sidgadMarcarEquipoClasif();
}

/*
 * Ligas agrupadas: a qué fase del calendario va cada clasificación. fases = [{ nombre, equipos }]
 * en el orden del calendario (equipos = Set de team_id de sus partidos). Primero por nombre; las
 * que no coinciden (sin nombre, "0", nombres distintos) van a la fase con más equipos en común
 * respecto al total de los dos (así una fase final con algunos de esos equipos no se la queda).
 * Las que no encajan en ninguna fase salen al final.
 */
function sidgadClasifPorFase(bloques, fases = []) {
  const columnas = sidgadColumnasClasif(bloques);
  const porIndice = new Map();
  const asignados = new Set();
  const asignar = (bloque, i) => {
    if (!porIndice.has(i)) porIndice.set(i, []);
    porIndice.get(i).push(bloque);
    asignados.add(bloque);
  };

  bloques.forEach(b => {
    if (!b.titulo) return;
    const i = fases.findIndex((f, n) => sidgadClaveFase(f.nombre) === sidgadClaveFase(b.titulo) && !porIndice.has(n));
    if (i >= 0) asignar(b, i);
  });

  bloques.filter(b => !asignados.has(b)).forEach(b => {
    const equipos = new Set(b.grupos.flatMap(g => g.equipos.map(e => String(e.team_id))));
    let mejor = -1;
    let parecido = 0;
    fases.forEach((f, i) => {
      const comunes = [...equipos].filter(id => f.equipos.has(id)).length;
      const total = new Set([...equipos, ...f.equipos]).size;
      const valor = total ? comunes / total : 0;
      if (comunes && valor > parecido) { mejor = i; parecido = valor; }
    });
    if (mejor >= 0) asignar(b, mejor);
  });

  const html = lista => lista.map(b => sidgadBloqueClasifHtml(b, columnas, { prefijo: true })).join('');
  return {
    columnas,
    // Una clasificación sin nombre toma el de su fase.
    tras(indiceFase) {
      const lista = porIndice.get(indiceFase);
      if (!lista) return '';
      porIndice.delete(indiceFase);
      const nombreFase = sidgadNombreFase(fases[indiceFase]?.nombre);
      return html(lista.map(b => (b.titulo || !nombreFase ? b : { ...b, titulo: nombreFase })));
    },
    restantes() {
      const pendientes = [...porIndice.values()].flat();
      return html([...bloques.filter(b => !asignados.has(b)), ...pendientes]);
    },
  };
}

// Nombre de fase que se puede mostrar (algunas competiciones antiguas tienen fases "0").
function sidgadNombreFase(nombre) {
  const texto = String(nombre ?? '').trim();
  return texto && texto !== '0' ? texto : null;
}

// Fases del calendario en orden, con los equipos de sus partidos (para sidgadClasifPorFase).
function sidgadFasesCalendario(games = []) {
  const fases = [];
  games.forEach(g => {
    if (String(g.idp) === '0') {
      if (g.dia_partido === 'FASE') fases.push({ nombre: g.home_name, equipos: new Set() });
      return;
    }
    if (!fases.length) fases.push({ nombre: null, equipos: new Set() });
    const fase = fases[fases.length - 1];
    [g.home_id, g.away_id].forEach(id => { if (id && String(id) !== '0') fase.equipos.add(String(id)); });
  });
  return fases;
}

// Resalta en las clasificaciones el equipo elegido en el selector de la cabecera y oculta los
// grupos y fases en los que no está.
function sidgadMarcarEquipoClasif() {
  const raiz = document.getElementById('sidgad-liga-main-content');
  if (!raiz) return;
  const equipo = sidgadEquipoLigaActivo();
  const tiene = el => !!el.querySelector(`tr[data-team-id="${CSS.escape(String(equipo))}"]`);
  raiz.querySelectorAll('.sidgad-clasif-tabla tr[data-team-id]').forEach(tr => {
    tr.classList.toggle('sidgad-destacado', !!equipo && tr.dataset.teamId === String(equipo));
  });
  raiz.querySelectorAll('.sidgad-clasif-wrap').forEach(w => w.classList.toggle('sidgad-hide', !!equipo && !tiene(w)));
  raiz.querySelectorAll('.sidgad-clasif-bloque').forEach(b => b.classList.toggle('sidgad-hide', !!equipo && !tiene(b)));
}

document.addEventListener('sidgad:liga-team-select', () => {
  // En el calendario lo hace sidgadFiltrarCalendario, que además oculta las fases.
  if (document.getElementById('sidgad-liga-main-content')?.dataset.vista !== 'calendar') sidgadMarcarEquipoClasif();
});
