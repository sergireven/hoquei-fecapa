/*
 * Vista "Plantillas" de la liga. Muestra sólo la plantilla del equipo elegido en el
 * selector de la cabecera; sin equipo elegido, una rejilla de equipos para escoger
 * (pulsar uno lo marca en el selector, así el resto de vistas se filtran igual).
 * Desde la ficha de equipo se llega con ese equipo ya elegido.
 * Debajo de jugadores y porteros va el cuerpo técnico (stats.staff).
 */

const sidgadPlantillas = {
  liga: null,
  equipo: null,   // team_id elegido en el selector
  equipos: [],    // [{ id, nombre, logo, jugadores, porteros, staff }]
  orden: { jugadores: null, porteros: null }, // { clave, desc }; se mantiene al cambiar de equipo
};

async function cargarPlantillas() {
  const mainContent = document.getElementById('sidgad-liga-main-content');
  const liga = sidgadLigaSeleccionada;
  if (!mainContent || !liga?.idc) return;

  sidgadPlantillas.liga = liga;
  sidgadPlantillas.equipo = sidgadEquipoLigaActivo();
  showLeagueLoading();
  const data = await sidgadFetch('stats', { id: liga.idc }, { cache: true }).catch(() => null);
  if (sidgadLigaSeleccionada !== liga) return;
  sidgadPieDatosLiga({ stats: data });

  const porteros = data?.stats?.goalies || [];
  const jugadores = sidgadJugadoresSinPorteros(data?.stats?.rosters || [], porteros);
  const staff = data?.stats?.staff || [];

  // Orden de equipos: el de la liga; luego cualquiera que sólo aparezca en las estadísticas.
  const orden = (liga.teams || []).map(t => String(t.teamId));
  [...jugadores, ...porteros, ...staff].forEach(f => { if (!orden.includes(String(f.team_id))) orden.push(String(f.team_id)); });

  sidgadPlantillas.equipos = orden.map(id => {
    const propios = jugadores.filter(f => String(f.team_id) === id);
    const suyos = porteros.filter(f => String(f.team_id) === id);
    const tecnicos = staff.filter(f => String(f.team_id) === id).sort(sidgadPlantillasOrdenStaff);
    if (!propios.length && !suyos.length && !tecnicos.length) return null;
    const equipo = (liga.teams || []).find(t => String(t.teamId) === id);
    const muestra = propios[0] || suyos[0] || tecnicos[0];
    return { id, nombre: equipo?.name || muestra.team_name, logo: equipo?.team_logo || muestra.team_logo, jugadores: propios, porteros: suyos, staff: tecnicos };
  }).filter(Boolean);

  sidgadPlantillasAplicarFoco();
  sidgadPlantillasPintar();
}

// Desde la ficha de un equipo: se marca ese equipo en el selector (dispara el filtro y
// vuelve a pintar). Se llama al cargar la vista y también si ya se estaba en ella.
function sidgadPlantillasAplicarFoco() {
  const foco = window.sidgadPlantillaFoco;
  window.sidgadPlantillaFoco = null;
  if (!foco || String(foco) === String(sidgadPlantillas.equipo)) return;
  const boton = document.querySelector(`#sidgad-liga-team-selector [data-team-id="${CSS.escape(String(foco))}"]`);
  if (boton) boton.click();
  else {
    sidgadPlantillas.equipo = String(foco);
    sidgadPlantillasPintar();
  }
}

// Cuerpo técnico por cargo: entrenadores (de nacional a nivel 1), auxiliares, delegados y el resto;
// dentro de cada cargo, por nombre. Cargos de la RFEP ("ENTRENADOR NIVEL 2") y de la FISR
// ("ALLENATORE DI 3°", "DIRIGENTE").
function sidgadPlantillasPesoStaff(rol) {
  const texto = String(rol || '').toUpperCase();
  if (/ENTRENADOR|ALLENATORE/.test(texto)) {
    if (texto.includes('NACIONAL')) return 0;
    const nivel = Number(texto.match(/(?:NIVEL|DI)\s*(\d)/)?.[1]);
    return Number.isFinite(nivel) ? 4 - Math.min(nivel, 3) : 4;
  }
  if (texto.includes('AUXILIAR')) return 5;
  if (/DELEGADO|DIRIGENTE/.test(texto)) return 6;
  return 7;
}

function sidgadPlantillasOrdenStaff(a, b) {
  return sidgadPlantillasPesoStaff(a.role) - sidgadPlantillasPesoStaff(b.role)
    || String(a.staff_name || '').localeCompare(String(b.staff_name || ''), 'es');
}

// En HL no se muestra el cargo (sólo ordena la lista).
function sidgadPlantillasStaffHtml(staff) {
  if (!staff?.length) return '';
  const conCargo = SIDGAD_API_CONFIG.idm !== 'hl';
  return `
    <h3 class="sidgad-ficha-subtitulo">${sidgadT('Cuerpo técnico')}</h3>
    <div class="sidgad-stats-wrap">
      <table class="sidgad-stats-tabla sidgad-equipo-tabla sidgad-plantilla-staff${conCargo ? ' sidgad-plantilla-staff-cargo' : ''}">
        <thead><tr><th class="sidgad-stats-jugador">${sidgadT('Nombre')}</th>${conCargo ? `<th class="sidgad-plantilla-cargo">${sidgadT('Cargo')}</th>` : ''}</tr></thead>
        <tbody>
          ${staff.map(m => `
            <tr>
              <td class="sidgad-stats-jugador">
                <img class="sidgad-stats-bandera" src="${escaparHtml(m.staff_flag || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
                ${sidgadStatsNombre(m.staff_name)}
              </td>
              ${conCargo ? `<td class="sidgad-plantilla-cargo">${escaparHtml(m.role || '')}</td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function sidgadPlantillasPintar() {
  const mainContent = document.getElementById('sidgad-liga-main-content');
  if (!mainContent || mainContent.dataset.vista !== 'plantillas') return;
  const { equipos, equipo, liga } = sidgadPlantillas;

  if (!equipos.length) {
    mainContent.replaceChildren(crearNodo('p', { class: 'sidgad-empty-state', text: sidgadT('Plantillas aún no disponibles.') }));
    return;
  }

  const elegido = equipo && equipos.find(e => e.id === String(equipo));
  if (!elegido) {
    mainContent.innerHTML = `
      <div class="sidgad-plantillas">
        <h2 class="sidgad-portada-titulo">${sidgadT('Elige un equipo')}</h2>
        <div class="sidgad-plantillas-rejilla">
          ${equipos.map(e => `
            <button type="button" class="sidgad-plantillas-equipo" data-plantilla-elegir="${escaparHtml(e.id)}">
              <img src="${escaparHtml(e.logo || SIDGAD_DEFAULT_LOGO)}" alt="" loading="lazy" onerror="this.src='${SIDGAD_DEFAULT_LOGO}'">
              <strong>${escaparHtml(e.nombre)}</strong>
              <span>${sidgadTn('{n} jugador', '{n} jugadores', e.jugadores.length)}${e.porteros.length ? ` · ${sidgadTn('{n} portero', '{n} porteros', e.porteros.length)}` : ''}</span>
            </button>`).join('')}
        </div>
      </div>`;
    return;
  }

  const columnas = sidgadColumnasPlantilla(liga);
  mainContent.innerHTML = `
    <div class="sidgad-plantillas">
      <section class="sidgad-plantilla">
        <h2 class="sidgad-calendario-fase sidgad-plantilla-titulo">
          <img src="${escaparHtml(elegido.logo || SIDGAD_DEFAULT_LOGO)}" alt="" loading="lazy" onerror="this.src='${SIDGAD_DEFAULT_LOGO}'">
          ${sidgadEnlaceEquipo(elegido.id, escaparHtml(elegido.nombre))}
          <small>${sidgadTn('{n} jugador', '{n} jugadores', elegido.jugadores.length)}${elegido.porteros.length ? ` · ${sidgadTn('{n} portero', '{n} porteros', elegido.porteros.length)}` : ''}</small>
        </h2>
        ${sidgadEquipoTablaHtml(elegido.jugadores, columnas.jugadores, 'Jugadores', liga, { tipo: 'jugadores', orden: sidgadPlantillas.orden.jugadores })}
        ${sidgadEquipoTablaHtml(elegido.porteros, sidgadStatsConDatos(columnas.porteros, elegido.porteros), 'Porteros', liga, { tipo: 'porteros', orden: sidgadPlantillas.orden.porteros })}
        ${sidgadPlantillasStaffHtml(elegido.staff)}
      </section>
    </div>`;
}

// Ordenar: clic en la cabecera (desc; GAA y GC asc), segundo clic invierte.
document.addEventListener('click', (event) => {
  const boton = event.target.closest('[data-plantilla-orden]');
  if (!boton) return;
  const [tipo, clave] = boton.dataset.plantillaOrden.split(':');
  const columnas = sidgadColumnasPlantilla(sidgadPlantillas.liga)[tipo] || [];
  const columna = columnas.find(c => c.clave === clave);
  const destacada = columnas.find(c => c.destacada) || columnas[0];
  const actual = sidgadPlantillas.orden[tipo] || { clave: destacada?.clave, desc: !destacada?.menorMejor };
  sidgadPlantillas.orden[tipo] = actual.clave === clave ? { clave, desc: !actual.desc } : { clave, desc: !columna?.menorMejor };
  sidgadPlantillasPintar();
});

// Elegir un equipo de la rejilla = marcarlo en el selector de la cabecera.
document.addEventListener('click', (event) => {
  const tarjeta = event.target.closest('[data-plantilla-elegir]');
  if (!tarjeta) return;
  const id = tarjeta.dataset.plantillaElegir;
  const boton = document.querySelector(`#sidgad-liga-team-selector [data-team-id="${CSS.escape(id)}"]`);
  if (boton) boton.click();
  else {
    sidgadPlantillas.equipo = id;
    sidgadPlantillasPintar();
  }
});

document.addEventListener('sidgad:liga-team-select', (event) => {
  const { teamId, mode } = event.detail || {};
  sidgadPlantillas.equipo = mode === 'select' ? String(teamId) : null;
  sidgadPlantillasPintar();
});
