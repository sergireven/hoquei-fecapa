/*
 * Vista "Designaciones arbitrales" de la liga (/designaciones/?id=idc). Llegan las mismas filas
 * que el calendario (JORNADA, FASE, ANOTACION y partidos) con arbitro_principal,
 * arbitro_secundario y anotador. No traen home_id/away_id: se cruzan con el calendario por idp
 * para los enlaces a los equipos, el filtro de la cabecera y el acta.
 */

// Qué es cada campo en cada modalidad (en HP los dos primeros son la pareja arbitral y el
// "anotador" es el árbitro auxiliar).
const SIDGAD_DESIG_ROLES = {
  hl: [['arbitro_principal', sidgadT('Árbitro principal')], ['arbitro_secundario', sidgadT('Árbitro auxiliar')], ['anotador', sidgadT('Anotador')]],
  hp: [['arbitro_principal', sidgadT('Árbitro')], ['arbitro_secundario', sidgadT('Árbitro')], ['anotador', sidgadT('Árbitro auxiliar')]],
};

const sidgadDesig = { equipo: null };

function sidgadDesigArbitros(fila) {
  const roles = SIDGAD_DESIG_ROLES[SIDGAD_API_CONFIG.idm] || SIDGAD_DESIG_ROLES.hl;
  return roles
    .map(([campo, rol]) => ({ rol, nombre: String(fila[campo] ?? '').trim() }))
    .filter(a => a.nombre);
}

// "APELLIDOS, NOMBRE" → apellidos en negrita y el nombre detrás.
function sidgadDesigNombre(nombre) {
  const [apellidos, pila = ''] = nombre.split(',').map(s => s.trim());
  return `<strong>${escaparHtml(apellidos)}</strong>${pila ? ` ${escaparHtml(pila)}` : ''}`;
}

function sidgadDesigPartido(fila, cal) {
  const resultado = String(fila.result || '').trim();
  const goles = resultado.match(/^(\d+)\s*-\s*(\d+)$/);
  const ids = [cal?.home_id, cal?.away_id].filter(Boolean).map(id => `team-${escaparHtml(id)}`).join(' ');
  const arbitros = sidgadDesigArbitros(fila);
  const equipo = (lado, gol) => {
    const id = cal?.[`${lado}_id`];
    const nombre = escaparHtml(String(fila[`${lado}_name`] || '').trim());
    return `
      <div class="sidgad-desig-equipo">
        <img src="${escaparHtml(fila[`${lado}_logo`] || SIDGAD_DEFAULT_LOGO)}" alt="" loading="lazy" onerror="this.src='${SIDGAD_DEFAULT_LOGO}'">
        <span>${id ? sidgadEnlaceEquipo(id, nombre) : nombre}</span>
        <b>${goles ? gol : ''}</b>
      </div>`;
  };
  const acta = goles && SIDGAD_SETTINGS.has_acta_digital
    ? `<a class="sidgad-nav sidgad-copa-acta" href="${escaparHtml(sidgadUrl({ ...sidgadLeerEstado(), partido: fila.idp, jugador: null, temporada: null }))}" title="${sidgadT('Ver acta')}" aria-label="${sidgadT('Ver acta')}"><i class="fas fa-search" aria-hidden="true"></i></a>`
    : '';
  return `
    <li class="sidgad-desig-partido ${ids}${goles ? '' : ' sidgad-desig-proximo'}">
      <div class="sidgad-desig-fecha">
        <strong>${escaparHtml(String(fila.dia_partido || '').slice(0, 5))}</strong>
        <span>${escaparHtml(fila.hora_partido || '')}</span>
      </div>
      <div class="sidgad-desig-encuentro">
        ${equipo('home', goles?.[1])}
        ${equipo('away', goles?.[2])}
      </div>
      <ul class="sidgad-desig-arbitros">
        ${arbitros.length
          ? arbitros.map(a => `<li><span class="sidgad-desig-rol">${escaparHtml(a.rol)}</span><span class="sidgad-desig-nombre">${sidgadDesigNombre(a.nombre)}</span></li>`).join('')
          : `<li class="sidgad-desig-pendiente">${sidgadT('Pendiente de designación')}</li>`}
      </ul>
      <div class="sidgad-desig-acciones">${acta}</div>
    </li>`;
}

async function cargarDesignaciones() {
  const mainContent = document.getElementById('sidgad-liga-main-content');
  const liga = sidgadLigaSeleccionada;
  if (!mainContent || !liga?.idc) return;
  showLeagueLoading();

  const [filas, calendario] = await Promise.all([
    sidgadFetch('designaciones', { id: liga.idc }, { cache: true }).catch(() => null),
    sidgadFetch('calendar', { id: liga.idc }, { cache: true }).catch(() => null),
  ]);
  if (sidgadLigaSeleccionada !== liga || mainContent.dataset.vista !== 'designaciones') return;
  sidgadPieDatosLiga({ designaciones: filas, calendar: calendario });

  const lista = Array.isArray(filas) ? filas : [];
  if (!lista.some(f => String(f.idp) !== '0')) {
    mainContent.replaceChildren(crearNodo('p', { class: 'sidgad-empty-state', text: sidgadT('Designaciones aún no disponibles.') }));
    return;
  }

  const cal = new Map((calendario?.games || []).filter(g => String(g.idp) !== '0').map(g => [String(g.idp), g]));
  const html = [];
  let abierta = false;
  const cerrar = () => { if (abierta) html.push('</ul></section>'); abierta = false; };

  lista.forEach(fila => {
    if (String(fila.idp) === '0') {
      if (fila.dia_partido === 'FASE') {
        cerrar();
        html.push(`<h2 class="sidgad-calendario-fase">${escaparHtml(fila.home_name)}</h2>`);
      } else if (fila.dia_partido === 'JORNADA') {
        cerrar();
        html.push(`<section class="sidgad-desig-jornada"><h3>${escaparHtml(sidgadTApi(fila.home_name))}</h3><ul class="sidgad-desig-lista">`);
        abierta = true;
      } else if (fila.dia_partido === 'ANOTACION' && abierta) {
        html.push(`<li class="sidgad-desig-nota">${escaparHtml(fila.home_name)}</li>`);
      }
      return;
    }
    if (!abierta) {
      html.push('<section class="sidgad-desig-jornada"><ul class="sidgad-desig-lista">');
      abierta = true;
    }
    html.push(sidgadDesigPartido(fila, cal.get(String(fila.idp))));
  });
  cerrar();

  mainContent.innerHTML = `
    <div class="sidgad-desig">
      ${html.join('')}
      <p class="sidgad-empty-state sidgad-desig-sin" hidden>${sidgadT('Este equipo no tiene partidos en las designaciones.')}</p>
    </div>`;

  sidgadDesig.equipo = document.querySelector('#sidgad-liga-team-selector .sidgad-team-selector-item.sidgad-activo')?.dataset.teamId || null;
  sidgadDesigFiltrar();
}

// Equipo elegido en la cabecera; las jornadas sin partidos visibles se ocultan.
function sidgadDesigFiltrar() {
  const raiz = document.querySelector('#sidgad-liga-main-content .sidgad-desig');
  if (!raiz) return;
  let visibles = 0;
  raiz.querySelectorAll('.sidgad-desig-partido').forEach(p => {
    const ok = !sidgadDesig.equipo || p.classList.contains(`team-${sidgadDesig.equipo}`);
    p.hidden = !ok;
    if (ok) visibles++;
  });
  raiz.querySelectorAll('.sidgad-desig-jornada').forEach(j => {
    j.hidden = !j.querySelector('.sidgad-desig-partido:not([hidden])');
  });
  raiz.querySelector('.sidgad-desig-sin').hidden = visibles > 0;
}

document.addEventListener('sidgad:liga-team-select', (event) => {
  const { teamId, mode } = event.detail || {};
  sidgadDesig.equipo = mode === 'select' ? String(teamId) : null;
  sidgadDesigFiltrar();
});
