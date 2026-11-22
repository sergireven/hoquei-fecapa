const SIDGAD_SCORER_INTERVALO = 30000;
let sidgadScorerTimer = null;

// Sondeo sólo mientras haya partidos sin terminar y la pestaña esté visible.
async function initScorer() {
  const partidos = await fetchAndRenderMatches();
  programarScorer(partidos);

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    clearTimeout(sidgadScorerTimer);
    programarScorer(await fetchAndRenderMatches());
  });
}

function programarScorer(partidos) {
  clearTimeout(sidgadScorerTimer);
  const hayPendientes = !partidos || partidos.some(p => p.game_completed !== "true");
  if (!hayPendientes) return;
  sidgadScorerTimer = setTimeout(async () => {
    if (document.visibilityState !== 'visible') return;
    programarScorer(await fetchAndRenderMatches());
  }, SIDGAD_SCORER_INTERVALO);
}

function marcadorHtml(p) {
  return `<span class="sidgad-bonus local-bonus">${p.home_bonus === "true" ? "B" : ""}</span>${escaparHtml(p.home_score)} - ${escaparHtml(p.away_score)}<span class="sidgad-bonus away-bonus">${p.away_bonus === "true" ? "B" : ""}</span>`;
}

async function fetchAndRenderMatches() {
  const contPartidos = document.getElementById('sidgad-contenedor-partidos');
  if (!contPartidos) return null;
  try {
    const data = await sidgadFetch('scorer');
    if (!Array.isArray(data)) return null;
    // Para quien siga un partido concreto (la previa pasa al acta cuando empieza).
    document.dispatchEvent(new CustomEvent('sidgad:marcador', { detail: { partidos: data } }));

    // Zona (config.php): en 'limit' sólo su zona; en 'filter', la elegida en el selector. Y el sexo
    // elegido (show_sexo_filter), por la competición del partido.
    const visibles = data.filter(p => sidgadZonaVisible(p) && sidgadSexoVisible(p));
    const partidosPorLiga = visibles.reduce((acc, p) => {
      if (!acc[p.league_name]) acc[p.league_name] = [];
      acc[p.league_name].push(p);
      return acc;
    }, {});

    const fragmentoTemporal = document.createElement('div');

    for (const liga in partidosPorLiga) {
      const cabeceraLiga = crearNodo('div', { class: 'sidgad-liga-header-separador', text: liga });
      const zona = sidgadZonaEtiqueta(partidosPorLiga[liga][0], 'sidgad-zona sidgad-zona-marcador');
      if (zona) cabeceraLiga.insertAdjacentHTML('beforeend', zona);
      const grupoLiga = crearNodo('div', { class: 'sidgad-liga-grupo' }, cabeceraLiga);

      partidosPorLiga[liga].forEach(p => {
        const isDirecto = (sidgadNum(p.game_status) ?? 0) > 0;
        const isFinalizado = p.game_completed === "true";
        const isButton = (isDirecto || isFinalizado) && SIDGAD_SETTINGS.has_acta_digital;
        // Sin empezar (estado 0): se abre la previa, aunque la revisión prepartido ya haya generado el
        // acta y llegue marcador (0-0). Los suspendidos (-1) no.
        const isPrevia = SIDGAD_SETTINGS.has_previa !== false && !isDirecto && !isFinalizado && sidgadNum(p.game_status) === 0;
        const tagFila = isButton || isPrevia ? 'button' : 'div';
        const claseEstado = (isDirecto && !isFinalizado) ? 'sidgad-partido-directo' : isFinalizado ? 'sidgad-partido-finalizado' : '';

        const resultadoBox = crearNodo('div', { class: 'sidgad-resultado-box' });
        if (isDirecto && !isFinalizado) {
          resultadoBox.appendChild(crearNodo('span', { class: 'sidgad-resultado-texto', html: marcadorHtml(p) }));
          resultadoBox.appendChild(crearNodo('span', { class: 'sidgad-estado-directo', text: sidgadTApi(p.game_status_text) }));
        } else if (p.home_score !== null && !isPrevia) {
          resultadoBox.appendChild(crearNodo('span', { class: 'sidgad-resultado-texto', html: marcadorHtml(p) }));
          resultadoBox.appendChild(crearNodo('span', { class: 'sidgad-status-tag', text: sidgadTApi(p.game_status_text) }));
        } else {
          resultadoBox.appendChild(crearNodo('span', { class: 'sidgad-resultado-texto', text: sidgadT('VS') }));
          const estado = p.game_status_text || 'SIN COMENZAR';
          const etiqueta = isPrevia && estado.toUpperCase() === 'SIN COMENZAR' ? 'Previa' : estado;
          resultadoBox.appendChild(crearNodo('span', { class: 'sidgad-status-tag', text: sidgadTApi(etiqueta) }));
        }

        const filaPartido = crearNodo(tagFila, { class: `sidgad-partido-fila ${claseEstado}` },
          crearNodo('div', { class: 'sidgad-partido-fila-content' },
            crearNodo('div', { class: 'sidgad-equipo-box sidgad-local' },
              crearNodo('img', { src: p.home_logo, class: 'sidgad-equipo-logo-mini', alt: p.home_team, onerror: `this.src='${SIDGAD_DEFAULT_LOGO}'` }),
              crearNodo('div', { class: 'sidgad-equipo-info' }, crearNodo('span', { class: 'sidgad-equipo-nombre', text: p.home_team }), crearNodo('span', { class: 'sidgad-equipo-sub', text: `${p.game_date || ""} ${p.game_time || ""}` }))
            ),
            resultadoBox,
            crearNodo('div', { class: 'sidgad-equipo-box sidgad-visitante' },
              crearNodo('div', { class: 'sidgad-equipo-info' }, crearNodo('span', { class: 'sidgad-equipo-nombre', text: p.away_team }), crearNodo('span', { class: 'sidgad-equipo-sub', text: sidgadTApi(p.game_description) })),
              crearNodo('img', { src: p.away_logo, class: 'sidgad-equipo-logo-mini', alt: p.away_team, onerror: `this.src='${SIDGAD_DEFAULT_LOGO}'` })
            )
          )
        );

        if (isButton) filaPartido.onclick = () => sidgadAbrirPartido(p.game_id);
        else if (isPrevia) {
          filaPartido.classList.add('sidgad-partido-previa');
          filaPartido.title = sidgadT('Ver previa del partido');
          filaPartido.onclick = () => sidgadAbrirPrevia(p.game_id);
        }
        grupoLiga.appendChild(filaPartido);
      });
      fragmentoTemporal.appendChild(grupoLiga);
    }
    if (!visibles.length) fragmentoTemporal.appendChild(crearNodo('p', { class: 'sidgad-empty-state', text: sidgadT('No hay partidos que mostrar') }));
    if (contPartidos.innerHTML !== fragmentoTemporal.innerHTML) contPartidos.replaceChildren(...fragmentoTemporal.childNodes);
    return data;
  } catch (err) {
    console.error("Error partidos:", err);
    if (!contPartidos.hasChildNodes()) contPartidos.replaceChildren(crearNodo('p', { class: 'sidgad-empty-state', text: sidgadT('No se han podido cargar los partidos.') }));
    return null;
  }
}