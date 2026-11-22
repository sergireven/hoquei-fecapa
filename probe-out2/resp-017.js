let sidgadPlayerPeticion = 0;

// Llamadas antiguas (onclick) pasan por el router para que la ficha tenga URL.
window.openSidgadPlayerOverlayWithLoading = (playerId, seasonId) => sidgadAbrirJugador(playerId, seasonId);

function abrirFichaJugadorConCarga(playerId, seasonId) {
  try {
    const overlay = window.initSidgadPlayerOverlay ? initSidgadPlayerOverlay() : null;
    if (overlay) {
      overlay.classList.add('sidgad-activo');
      document.body.style.overflow = 'hidden';

      const nameEl = document.getElementById('sidgad-player-name');
      const compactEl = document.getElementById('sidgad-player-name-compact');
      const avatarEl = document.getElementById('sidgad-player-avatar');
      const summaryEl = document.getElementById('sidgad-player-summary');

      if (nameEl) nameEl.innerText = sidgadT('Cargando...');
      if (compactEl) compactEl.innerText = '';
      if (avatarEl) avatarEl.src = SIDGAD_DEFAULT_LOGO;
      if (summaryEl) summaryEl.innerHTML = `<div class="sidgad-player-loading-banner">${sidgadT('Cargando...')}</div>`;
      sidgadFichaReiniciar();
    }
  } catch (err) {
    console.warn('openSidgadPlayerOverlayWithLoading init error', err);
  }

  openSidgadPlayerOverlay(playerId, seasonId);
}

function initSidgadPlayerOverlay() {
  let modal = document.getElementById("sidgad-player-overlay");
  if (modal) return modal;

  if (!SIDGAD_SETTINGS.has_player_overlay) return null;

  modal = document.createElement("div");
  modal.id = "sidgad-player-overlay";
  modal.innerHTML = `
      <div class="sidgad-player-overlay-shell" onclick="event.stopPropagation()">
        <div class="sidgad-player-overlay-top">
          <div class="sidgad-player-overlay-titleblock">
            <div class="sidgad-player-overlay-kicker">${sidgadT('Perfil del jugador')}</div>
            <h2 id="sidgad-player-name">${sidgadT('Jugador')}</h2>
          </div>
          <button id="sidgad-player-close-btn" aria-label="${sidgadT('Cerrar')}"><i class="fas fa-times"></i></button>
        </div>
        <div class="sidgad-player-overlay-body">
          <section class="sidgad-player-hero-card">
            <img class="sidgad-player-marca" id="sidgad-player-marca" src="" alt="" aria-hidden="true">
            <img class="sidgad-player-avatar" id="sidgad-player-avatar" src="" alt="${sidgadT('Foto del jugador')}">
            <div class="sidgad-player-hero-copy">
              <div class="sidgad-player-identity-row">
                <img id="sidgad-player-flag" class="sidgad-player-flag-badge" src="" alt="${sidgadT('Bandera')}">
                <span id="sidgad-player-nationality">-</span>
              </div>
              <div class="sidgad-player-name-compact" id="sidgad-player-name-compact">${sidgadT('Jugador')}</div>
              <div class="sidgad-player-team-row">
                <img id="sidgad-player-team-logo" src="" alt="" class="sidgad-player-team-logo">
                <div>
                  <div class="sidgad-player-team-name" id="sidgad-player-team-name">${sidgadT('Equipo')}</div>
                  <div class="sidgad-player-team-sub" id="sidgad-player-team-sub"></div>
                </div>
              </div>
              <div class="sidgad-player-meta-grid">
                <div class="sidgad-player-meta-item"><span>${sidgadT('Nacimiento')}</span><strong id="sidgad-player-birth">-</strong></div>
                <div class="sidgad-player-meta-item"><span>${sidgadT('Edad')}</span><strong id="sidgad-player-age">-</strong></div>
              </div>
              <div class="sidgad-player-tag-list" id="sidgad-player-tags"></div>
            </div>
          </section>
          <section class="sidgad-ficha" id="sidgad-player-ficha"></section>
        </div>
      </div>
    `;
  document.body.appendChild(modal);

  document.getElementById("sidgad-player-close-btn").addEventListener("click", () => sidgadCerrarJugador());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) sidgadCerrarJugador();
  });

  return modal;
}

document.addEventListener("DOMContentLoaded", () => {
  if (SIDGAD_SETTINGS.has_player_overlay) {
    initSidgadPlayerOverlay();
  }
});

function normalizeSidgadPlayerValue(value) {
  if (value === null || value === undefined || value === "") return "0";
  return String(value);
}

function getSidgadPlayerInitials(playerName) {
  const parts = String(playerName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "J";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// La API da la nacionalidad en español ("ITALIANA"); en otro idioma se muestra el país de la
// bandera (".../IT.png") con su nombre en ese idioma.
function sidgadJugadorNacionalidad(nacionalidad, bandera) {
  const codigo = String(bandera || '').split('.')[0].toUpperCase();
  if (SIDGAD_LENGUA !== 'es' && /^[A-Z]{2}$/.test(codigo) && typeof Intl.DisplayNames === 'function') {
    try {
      const pais = new Intl.DisplayNames([SIDGAD_LOCALE], { type: 'region' }).of(codigo);
      if (pais && pais !== codigo) return pais.toUpperCase();
    } catch (err) { /* código no válido: se usa el de la API */ }
  }
  return nacionalidad ? String(nacionalidad).toUpperCase() : '-';
}

function getSidgadPlayerAgeText(birthDate) {
  if (!birthDate) return "-";
  const parts = birthDate.split("/").reverse();
  if (parts.length !== 3) return "-";
  const birth = new Date(parts.join("-"));
  if (isNaN(birth.getTime())) return "-";

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return String(age);
}

function buildSidgadPlayerSummaryCards(data) {
  const goals = parseInt(data.playerGoals || "0", 10) || 0;
  const assists = parseInt(data.playerAsist || "0", 10) || 0;
  const points = parseInt(data.playerPoints || String(goals + assists), 10) || goals + assists;

  const cards = [
    ["Puntos", points],
    ["Goles", goals],
    ["Asistencias", assists],
    ["PIM", normalizeSidgadPlayerValue(data.playerPim)],
    ["F. directas", normalizeSidgadPlayerValue(data.playerDirect)],
    ["F. recibidas", normalizeSidgadPlayerValue(data.playerFaultRec)],
    ["Amarillas", normalizeSidgadPlayerValue(data.playerYellow)],
    ["Azules", normalizeSidgadPlayerValue(data.playerBlue)],
    ["Rojas", normalizeSidgadPlayerValue(data.playerRed)],
  ];

  return cards.map(([label, value]) => `
    <article class="sidgad-player-summary-card">
      <span>${sidgadT(label)}</span>
      <strong>${value}</strong>
    </article>
  `).join("");
}

async function openSidgadPlayerOverlay(playerId, seasonId) {
  const overlay = initSidgadPlayerOverlay();
  if (!overlay) return;

  const peticion = ++sidgadPlayerPeticion;

  try {
    let data;
    try {
      data = await sidgadFetch("profile", { id: playerId, s: seasonId }, { cache: true });
    } catch (error) {
      if (peticion !== sidgadPlayerPeticion) return;
      sidgadFichaReiniciar("");
      mostrarFichaJugadorNoDisponible(error?.status === "NO FILE"
        ? sidgadT("Este jugador no tiene ficha en esta temporada.")
        : sidgadT("No se ha podido cargar la ficha del jugador."));
      return;
    }
    // Se cerró la ficha (o se abrió otra) mientras llegaba la respuesta.
    if (peticion !== sidgadPlayerPeticion) return;
    if (!data?.player) {
      mostrarFichaJugadorNoDisponible(sidgadT("No se ha podido cargar la ficha del jugador."));
      return;
    }
    const player = data.player;

    const playerName = `${player.name} ${player.surname}`;
    const playerFlag = player.flag ? player.flag.split("/").pop().toLowerCase() : "";
    const playerTeamName = player.team_name || "";
    const playerTeamLogo = player.team_logo || "";
    const playerBirth = player.date_born || "-";
    const playerAge = getSidgadPlayerAgeText(player.date_born);
    const nationalityText = sidgadJugadorNacionalidad(player.nationality, playerFlag);
    const playerImage = player.image || "";

    const playerNameEl = document.getElementById("sidgad-player-name");
    const playerNameCompactEl = document.getElementById("sidgad-player-name-compact");
    const playerAvatarEl = document.getElementById("sidgad-player-avatar");
    const playerBirthEl = document.getElementById("sidgad-player-birth");
    const playerAgeEl = document.getElementById("sidgad-player-age");
    const playerTeamNameEl = document.getElementById("sidgad-player-team-name");
    const playerTeamSubEl = document.getElementById("sidgad-player-team-sub");
    const playerTeamLogoEl = document.getElementById("sidgad-player-team-logo");
    const playerNationalityEl = document.getElementById("sidgad-player-nationality");
    const playerTagsEl = document.getElementById("sidgad-player-tags");
    const flagEl = document.getElementById("sidgad-player-flag");

    const tags = [];

    if (!playerNameEl || !playerAvatarEl || !playerTeamNameEl) {
      console.error("SIDGAD Player Overlay: Elementos del overlay no encontrados");
      return;
    }

    playerNameEl.innerText = playerName;
    // Nombre de pila pequeño y apellidos grandes, como el líder de la Portada.
    if (playerNameCompactEl) playerNameCompactEl.innerHTML = `<span class="sidgad-player-pila">${escaparHtml(player.name || "")}</span><span class="sidgad-player-apellidos">${escaparHtml(player.surname || "")}</span>`;
    playerAvatarEl.src = playerImage || SIDGAD_DEFAULT_LOGO;
    playerAvatarEl.alt = playerName;
    playerAvatarEl.onerror = () => {
      playerAvatarEl.onerror = null;
      playerAvatarEl.src = SIDGAD_DEFAULT_LOGO;
    };
    if (playerBirthEl) playerBirthEl.innerText = playerBirth;
    if (playerAgeEl) playerAgeEl.innerText = playerAge;
    playerTeamNameEl.innerText = playerTeamName;
    const marcaEl = document.getElementById("sidgad-player-marca");
    if (marcaEl) {
      marcaEl.hidden = !playerTeamLogo;
      if (playerTeamLogo) marcaEl.src = playerTeamLogo;
    }
    sidgadJugadorEnlazarEquipo(playerId, playerTeamName, peticion);
    playerTeamLogoEl.src = playerTeamLogo;
    playerTeamLogoEl.alt = playerTeamName;
    playerNationalityEl.innerText = nationalityText;
    playerTagsEl.innerHTML = tags.map(tag => `<span class="sidgad-player-tag">${tag}</span>`).join("");
    if (playerFlag) {
      flagEl.src = `https://flagcdn.com/w20/${playerFlag}`;
      flagEl.alt = playerFlag.toUpperCase();
      flagEl.style.display = "inline-block";
    } else {
      flagEl.removeAttribute("src");
      flagEl.alt = "";
      flagEl.style.display = "none";
    }

    sidgadFichaIniciar(playerId, data);

    overlay.classList.add("sidgad-activo");
    document.body.style.overflow = "hidden";
  } catch (error) {
    console.error("Error al obtener datos del jugador:", error);
    return;
  }
}

// El equipo de la cabecera abre su ficha. /profile/ no trae team_id: se busca en las
// estadísticas de la liga abierta (ya cacheadas) o, si no, por nombre en sus equipos.
async function sidgadJugadorEnlazarEquipo(playerId, nombreEquipo, peticion) {
  const liga = sidgadLigaSeleccionada;
  const nombreEl = document.getElementById("sidgad-player-team-name");
  if (!liga || !nombreEl) return;
  let teamId = null;
  try {
    const data = await sidgadFetch("stats", { id: liga.idc }, { cache: true });
    const fila = [...(data?.stats?.rosters || []), ...(data?.stats?.goalies || [])].find(f => String(f.player_id) === String(playerId));
    teamId = fila?.team_id || null;
  } catch (err) { /* sin estadísticas: se intenta por nombre */ }
  if (!teamId) {
    const normalizar = t => String(t || "").trim().toUpperCase();
    teamId = (liga.teams || []).find(t => normalizar(t.name) === normalizar(nombreEquipo))?.teamId || null;
  }
  if (peticion !== sidgadPlayerPeticion || !teamId) return;
  nombreEl.innerHTML = sidgadEnlaceEquipo(teamId, escaparHtml(nombreEquipo));
}

function mostrarFichaJugadorNoDisponible(mensaje) {
  const nameEl = document.getElementById("sidgad-player-name");
  const compactEl = document.getElementById("sidgad-player-name-compact");
  const avatarEl = document.getElementById("sidgad-player-avatar");
  if (nameEl) nameEl.innerText = mensaje;
  if (compactEl) compactEl.innerText = "";
  if (avatarEl) avatarEl.src = SIDGAD_DEFAULT_LOGO;
  ["sidgad-player-birth", "sidgad-player-age", "sidgad-player-team-name", "sidgad-player-nationality"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerText = "-";
  });
}

function closeSidgadPlayerOverlay() {
  sidgadPlayerPeticion++;
  const overlay = document.getElementById("sidgad-player-overlay");
  if (overlay) {
    overlay.classList.remove("sidgad-activo");
    sidgadActualizarScroll();
  }
}
// Funciones que pinta el router.
window.sidgadJugador = {
  abrir: abrirFichaJugadorConCarga,
  cerrar: closeSidgadPlayerOverlay,
};
