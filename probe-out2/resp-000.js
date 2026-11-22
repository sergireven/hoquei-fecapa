// Script normal (no módulo): las funciones comunes vienen de sidgad-acta-common.js, que se carga antes.
(function () {
'use strict';
const { initSidgadMatchActa, splitSidgadName, renderSidgadStatRow, renderSidgadActaOficial } = window.SidgadActaComun;

// Hoja oficial del acta de la RFEP para esta modalidad.
const SIDGAD_ACTA_HP = { formato: "hp" };

// Columna de categoría en la ficha resumen: sólo en los portales que la activan.
const conCategoria = SIDGAD_SETTINGS.has_acta_categoria === true;
const columnasRoster = conCategoria ? 14 : 13;

initSidgadMatchActa({
  variantName: "SIDGAD HP Acta",
  buildModalHtml: () => `
    <div class="sidgad-match-modal" onclick="event.stopPropagation()">
      <div id="sidgad-loading-overlay">
        <div class="sidgad-spinner"></div>
        <div class="sidgad-loading-texto">${sidgadT('CARGANDO')}</div>
      </div>
      <div class="sidgad-match-modal-top">
        <h2>${sidgadT('Ficha Detalle Partido')}</h2>
        <button class="sidgad-close-modal-btn" onclick="closeSidgadMatchModal()"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="sidgad-match-modal-header-gris">
        <div class="sidgad-match-info-bar">
          <div class="sidgad-info-left">
            <span id="sidgad-modal-league-name"></span>
            <span id="sidgad-modal-date"></span>
          </div>
          <div class="sidgad-info-center">
            <span id="sidgad-modal-venue"></span>
          </div>
          <div class="sidgad-info-right">
            <span style="color:#777;">${sidgadT('ÁRBITRAJE')}</span>
            <span id="sidgad-modal-refs"></span>
          </div>
        </div>
        <div class="sidgad-modal-scoreboard">
          <div class="sidgad-modal-team sidgad-local">
            <div class="sidgad-modal-team-name" id="sidgad-modal-home-name"></div>
            <img id="sidgad-modal-home-logo" src="" alt="lLogo">
          </div>
          <div class="sidgad-modal-hp-faults" id="sidgad-hp-home-faults"></div>
          <div class="sidgad-modal-score-center">
            <div class="sidgad-modal-score" id="sidgad-modal-score-text">-</div>
            <div class="sidgad-modal-status" id="sidgad-modal-status-text"></div>
          </div>
          <div class="sidgad-modal-hp-faults" id="sidgad-hp-away-faults"></div>
          <div class="sidgad-modal-team sidgad-visit">
            <img id="sidgad-modal-away-logo" src="" alt="vLogo">
            <div class="sidgad-modal-team-name" id="sidgad-modal-away-name"></div>
          </div>
        </div>
      </div>
      <div class="sidgad-modal-tabs">
        <button class="sidgad-modal-tab-btn sidgad-activo btn-web btn-mobile" data-target="sidgad-ficha-alineaciones"><i class="fa-solid fa-users"></i> ${sidgadT('Ficha Resumen')}</button>
        <button class="sidgad-modal-tab-btn btn-mobile" data-target="sidgad-ficha-incidencias"><i class="fa-solid fa-stopwatch"></i> ${sidgadT('Incidencias')}</button>
        <button class="sidgad-modal-tab-btn btn-web btn-mobile" data-target="sidgad-ficha-acta"><i class="fa-solid fa-file-alt"></i> ${sidgadT('Acta Partido')}</button>
      </div>
      <div class="sidgad-match-modal-body">
        <div id="sidgad-shootout-desktop" class="sidgad-shootout-desktop-wrapper"></div>
        <div class="sidgad-modal-content-grid">
          <div id="sidgad-ficha-alineaciones" class="sidgad-modal-seccion sidgad-activo">
            <div id="sidgad-match-stats-container" style="display: none; margin-bottom: 20px;"></div>
            <div class="sidgad-table-responsive">
              <table class="sidgad-roster-table">
                <thead>
                  <tr>
                    <th class="sidgad-team-roster-header" id="sidgad-roster-home-name" colspan="${columnasRoster}"></th>
                  </tr>
                  <tr>
                    <th width="30">${sidgadT('Nº')}</th>
                    <th width="30">P</th>
                    <th width="30">5i</th>
                    <th class="sidgad-col-name"></th>
                    ${conCategoria ? `<th width="45">${sidgadT('Cat')}</th>` : ""}
                    <th width="35">G</th>
                    <th width="35">${sidgadT('As')}</th>
                    <th width="35">${sidgadT('PE|penaltis')}</th>
                    <th width="35">${sidgadT('FD')}</th>
                    <th width="35">F-></th>
                    <th width="35">F<- </th>
                    <th width="35"><span class="acta-hp-card card-yellow"></span></th>
                    <th width="35"><span class="acta-hp-card card-blue"></span></th>
                    <th width="35"><span class="acta-hp-card card-red"></span></th>
                  </tr>
                </thead>
                <tbody id="sidgad-roster-home-body"></tbody>
              </table>
            </div>
            <div class="sidgad-table-responsive">
              <table class="sidgad-roster-table">
                <thead>
                  <tr>
                    <th class="sidgad-team-roster-header" id="sidgad-roster-away-name" colspan="${columnasRoster}"></th>
                  </tr>
                  <tr>
                    <th width="30">${sidgadT('Nº')}</th>
                    <th width="30">P</th>
                    <th width="30">5i</th>
                    <th class="sidgad-col-name"></th>
                    ${conCategoria ? `<th width="45">${sidgadT('Cat')}</th>` : ""}
                    <th width="35">G</th>
                    <th width="35">${sidgadT('As')}</th>
                    <th width="35">${sidgadT('PE|penaltis')}</th>
                    <th width="35">${sidgadT('FD')}</th>
                    <th width="35">F-></th>
                    <th width="35">F<- </th>
                    <th width="35"><span class="acta-hp-card card-yellow"></span></th>
                    <th width="35"><span class="acta-hp-card card-blue"></span></th>
                    <th width="35"><span class="acta-hp-card card-red"></span></th>
                  </tr>
                </thead>
                <tbody id="sidgad-roster-away-body"></tbody>
              </table>
            </div>
          </div>
          <div id="sidgad-ficha-incidencias" class="sidgad-modal-seccion">
            <div id="sidgad-shootout-mobile" class="sidgad-shootout-mobile-wrapper"></div>
            <div class="sidgad-team-roster-header"><i class="fa-solid fa-list-ul"></i> ${sidgadT('INCIDENCIAS')}</div>
            <div class="sidgad-incidents-container" id="sidgad-incidents-list"></div>
          </div>
        </div>
        <div id="sidgad-ficha-acta" class="sidgad-modal-acta">
          <div id="sidgad-acta-content" class="sidgad-acta-content"></div>
        </div>
      </div>
    </div>
  `,
  renderRoster(matchData) {
    const fillRosterBody = (containerId, playerRoster, staffRoster, teamInfo) => {
      const rosterBody = document.getElementById(containerId);
      rosterBody.replaceChildren();

      const formatName = (fullName, extraClass = "") => {
        if (!fullName) return "";
        const parts = splitSidgadName(fullName);
        return `<span class="sidgad-player-last ${extraClass}">${parts.last}</span><span class="sidgad-player-first">${parts.first}</span>`;
      };

      // Las cifras llegan unas veces como número (0) y otras como cadena ("0"): 0 y vacío no se pintan.
      const cifra = (valor) => { const n = sidgadNum(valor); return n ? String(n) : ""; };

      const formatStaffName = (fullName) => {
        if (!fullName) return "";
        return `<span class="sidgad-tecnico-name">${escaparHtml(fullName.replace(",", ", "))}</span>`;
      };

      const escapeSidgadAttr = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      if (playerRoster && playerRoster.length > 0) {
        playerRoster.forEach(player => {
          rosterBody.insertAdjacentHTML("beforeend", `
            <tr>
              <td>${escaparHtml(player.player_number || "")}</td>
              <td><span class=${escaparHtml(player.player_role ? 'sidgad-captain-badge' : "")}>${escaparHtml(player.player_role || "")}</span></td>
              <td>${player['5i'] ? '<span class="sidgad-5i-badge"></span>' : ''}</td>
              <td class="sidgad-col-name">
                ${sidgadEnlaceJugador(player.player_id, matchData.season_id, `
                  <img src="https://flagcdn.com/w20/${escaparHtml(player.player_flag?.toLowerCase().trim())}.png" class="sidgad-player-flag" alt="">
                  ${formatName(player.player_name)}`)} ${player.is_captain ? '<span class="sidgad-captain-badge">C</span>' : ''}
              </td>
              ${conCategoria ? `<td>${escaparHtml(player.player_categ || "")}</td>` : ""}
              <td>${cifra(player.goals)}</td>
              <td>${cifra(player.asist)}</td>
              <td>${escaparHtml(player.penals ?? "")}</td>
              <td>${escaparHtml(player.direct ?? "")}</td>
              <td>${cifra(player.fault_com)}</td>
              <td>${cifra(player.fault_rec)}</td>
              <td>${cifra(player.yellow_card)}</td>
              <td>${cifra(player.blue_card)}</td>
              <td>${cifra(player.red_card)}</td>
            </tr>
          `);
        });
      }

      if (staffRoster && staffRoster.length > 0) {
        rosterBody.insertAdjacentHTML("beforeend", `<tr class="sidgad-roster-subheader"><th colspan="${columnasRoster}">${sidgadT('Cuerpo Técnico')}</th></tr>`);
        staffRoster.forEach(staff => {
          rosterBody.insertAdjacentHTML("beforeend", `
            <tr>
              <td></td>
              <td><span class="sidgad-captain-badge">${escaparHtml(staff.staff_role || "")}</span></td>
              <td class="sidgad-col-name" colspan="${columnasRoster - 5}"><img src="https://flagcdn.com/w20/${escaparHtml(staff.staff_flag?.toLowerCase().trim())}.png" class="sidgad-player-flag" alt="ES">${formatStaffName(staff.staff_name)}</td>
              <td>${cifra(staff.staff_yellow)}</td>
              <td>${cifra(staff.staff_blue)}</td>
              <td>${cifra(staff.staff_red)}</td>
            </tr>
          `);
        });
      }
    };

    fillRosterBody("sidgad-roster-home-body", matchData.home_roster, matchData.home_staff, { name: matchData.home_team_name, logo: matchData.home_logo || SIDGAD_DEFAULT_LOGO });
    fillRosterBody("sidgad-roster-away-body", matchData.away_roster, matchData.away_staff, { name: matchData.away_team_name, logo: matchData.away_logo || SIDGAD_DEFAULT_LOGO });
  },
  renderIncidents(matchData, teams) {
    const incidentsContainer = document.getElementById("sidgad-incidents-list");
    incidentsContainer.replaceChildren();

    if (!matchData.events || matchData.events.length === 0) return;

    let currentPeriod = null;
    const parseName = (fullName) => splitSidgadName(fullName);

    // Tarjetas: al staff le llegan con dorsal 0 (amarilla) o null (roja), y se identifica por su rol.
    const claveNombre = (nombre) => String(nombre ?? "").replace(/\s+/g, "").toUpperCase();
    const rolStaff = new Map([...(matchData.home_staff || []), ...(matchData.away_staff || [])]
      .map(s => [claveNombre(s.staff_name), s.staff_role]));
    const sancionadoHtml = (event) => {
      const p = parseName(event.player_name);
      const esStaff = !(sidgadNum(event.player_number) > 0);
      if (!esStaff) return `#${escaparHtml(event.player_number)} ${sidgadEnlaceJugador(event.player_id, matchData.season_id, `<span class="sidgad-mob-bold">${p.last},</span> ${p.first}`)}`;
      const rol = rolStaff.get(claveNombre(event.player_name));
      return `${rol ? `<span class="sidgad-captain-badge">${escaparHtml(rol)}</span> ` : ""}<span class="sidgad-mob-bold">${p.last},</span> ${p.first}`;
    };

    // Número de cada falta de equipo en el partido (los eventos llegan del más reciente al más
    // antiguo; event_id crece con el tiempo). La 10.ª y cada 5 más dan falta directa.
    const numeroFalta = new Map();
    const faltasEquipo = {};
    [...matchData.events].filter(ev => ev.event_type === "fault")
      .sort((a, b) => (sidgadNum(a.event_id) ?? 0) - (sidgadNum(b.event_id) ?? 0))
      .forEach(ev => {
        faltasEquipo[ev.team_id] = (faltasEquipo[ev.team_id] || 0) + 1;
        numeroFalta.set(ev.event_id, faltasEquipo[ev.team_id]);
      });

    matchData.events.forEach(event => {
      if (event.period !== currentPeriod) {
        currentPeriod = event.period;
        incidentsContainer.insertAdjacentHTML("beforeend", `<div class="sidgad-mob-period-header"><span>${sidgadT('PERIODO {n}', { n: currentPeriod })}</span></div>`);
      }

      let iconColHtml = "";
      let detailsColHtml = "";
      const teamNameUpper = (event.team_large || sidgadT("EQUIPO")).toUpperCase();
      // En la falta directa team_id es el equipo que comete la falta (team_large ya es el que
      // lanza): el logo va con el que lanza, o sea, el otro.
      let logoTeamId = event.team_id;
      if (event.event_type === "direct_fault") {
        const ids = [matchData.home_team_id, matchData.away_team_id].map(String);
        if (ids.includes(String(event.team_id))) logoTeamId = ids.find(id => id !== String(event.team_id));
      }

      switch (event.event_type) {
        case "goal": {
          const pGoal = parseName(event.player_name);
          // Hockey patines se juega con bola, no con disco.
          iconColHtml = `<span class="sidgad-bola sidgad-mob-action-icon" aria-hidden="true"></span><span class="sidgad-mob-score-pill">${escaparHtml(event.event_home_score)} - ${escaparHtml(event.event_away_score)}</span>`;
          detailsColHtml = `
            <div class="sidgad-mob-title-goal">${sidgadT('GOL {equipo}', { equipo: teamNameUpper })}</div>
            <div class="sidgad-mob-player">#${escaparHtml(event.player_number)} ${sidgadEnlaceJugador(event.player_id, matchData.season_id, `<span class="sidgad-mob-bold">${pGoal.last},</span> ${pGoal.first}`)}</div>
            ${event.empty_net ? `<div class="sidgad-mob-badge-en">${sidgadT('Portería vacía')}</div>` : ''}
            ${event.aisist_number ? `<div class="sidgad-mob-assist"><span class="sidgad-mob-bold">${sidgadT('Asist:')}</span> #${escaparHtml(event.aisist_number)} ${sidgadEnlaceJugador(event.asist_id, matchData.season_id, escaparHtml(event.asist_name ?? ""))}</div>` : ''}
          `;
          break;
        }
        case "timeout":
          iconColHtml = `<i class="fa-solid fa-pause sidgad-mob-action-icon sidgad-mob-icon-timeout"></i>`;
          detailsColHtml = `<div class="sidgad-mob-title-goal sidgad-mob-title-timeout">${sidgadT('TIEMPO MUERTO')}<br>${teamNameUpper}</div>`;
          break;
        case "direct_fault": {
          const sDfault = parseName(event.shooter_name);
          iconColHtml = `<i class="fa-solid fa-circle-dot sidgad-mob-action-icon sidgad-mob-icon-direct-fault"></i>`;
          detailsColHtml = `<div class="sidgad-mob-title-goal sidgad-mob-title-foul">${sidgadT('FALTA DIRECTA PARA {equipo}', { equipo: teamNameUpper })}</div>
          <div class="sidgad-mob-shooter">${sidgadT('Al lanzamiento...')}</div>
          <div class="sidgad-mob-player">#${escaparHtml(event.shooter_num)} ${sidgadEnlaceJugador(event.shooter_id, matchData.season_id, `<span class="sidgad-mob-bold">${sDfault.last},</span> ${sDfault.first}`)}</div>
          <div class="sidgad-mob-result">${escaparHtml(sidgadT(event.shoot_score ? "GOL" : "NO HAY GOL"))}</div>
          `;
          break;
        }
        case "penalty_shoot": {
          const sPShoot = parseName(event.shooter_name);
          iconColHtml = `<i class="fa-solid fa-crosshairs sidgad-mob-action-icon sidgad-mob-icon-penalty-shoot"></i>`;
          detailsColHtml = `<div class="sidgad-mob-title-goal sidgad-mob-title-foul">${sidgadT('PENALTI PARA {equipo}', { equipo: teamNameUpper })}</div>
          <div class="sidgad-mob-shooter">${sidgadT('Al lanzamiento...')}</div>
          <div class="sidgad-mob-player">#${escaparHtml(event.shooter_num)} ${sidgadEnlaceJugador(event.shooter_id, matchData.season_id, `<span class="sidgad-mob-bold">${sPShoot.last},</span> ${sPShoot.first}`)}</div>
          <div class="sidgad-mob-result">${escaparHtml(sidgadT(event.shoot_score ? "GOL" : "NO HAY GOL"))}</div>
          `;
          break;
        }
        case "fault": {
          const sFault = parseName(event.player_name);
          const n = numeroFalta.get(event.event_id);
          const directa = n >= 10 && n % 5 === 0;
          iconColHtml = `<i class="fa-solid fa-hand sidgad-mob-action-icon sidgad-mob-icon-fault"></i>${n ? `<span class="sidgad-mob-falta-num${directa ? " sidgad-mob-falta-directa" : ""}" title="${escaparHtml(sidgadT('Falta de equipo n.º {n}', { n }))}">${n}</span>` : ""}`;
          detailsColHtml = `<div class="sidgad-mob-title-goal sidgad-mob-title-foul">${sidgadT('FALTA {equipo}', { equipo: teamNameUpper })}</div>
          ${event.player_number ? `<div class="sidgad-mob-player">#${escaparHtml(event.player_number)} ${sidgadEnlaceJugador(event.player_id, matchData.season_id, `<span class="sidgad-mob-bold">${sFault.last},</span> ${sFault.first}`)}</div>` : ""}
          `;
          break;
        }
        case "blue_card":
          iconColHtml = `<i class="fa-solid fa-note-sticky sidgad-mob-action-icon sidgad-mob-icon-blue-card"></i>`;
          detailsColHtml = `<div class="sidgad-mob-title-goal sidgad-mob-title-foul">${sidgadT('TARJETA AZUL {equipo}', { equipo: teamNameUpper })}</div>
          <div class="sidgad-mob-player">${sancionadoHtml(event)}</div>
          `;
          break;
        case "red_card":
          iconColHtml = `<i class="fa-solid fa-note-sticky sidgad-mob-action-icon sidgad-mob-icon-red-card"></i>`;
          detailsColHtml = `<div class="sidgad-mob-title-goal sidgad-mob-title-foul">${sidgadT('TARJETA ROJA {equipo}', { equipo: teamNameUpper })}</div>
          <div class="sidgad-mob-player">${sancionadoHtml(event)}</div>
          `;
          break;
        case "yellow_card":
          iconColHtml = `<i class="fa-solid fa-note-sticky sidgad-mob-action-icon sidgad-mob-icon-yellow-card"></i>`;
          detailsColHtml = `<div class="sidgad-mob-title-goal sidgad-mob-title-foul">${sidgadT('TARJETA AMARILLA {equipo}', { equipo: teamNameUpper })}</div>
          <div class="sidgad-mob-player">${sancionadoHtml(event)}</div>
          `;
          break;
      }

      if (iconColHtml !== "") {
        incidentsContainer.insertAdjacentHTML("beforeend", `
          <div class="sidgad-mob-incident-row">
            <div class="sidgad-mob-col-time"><span class="sidgad-mob-period">P${escaparHtml(event.period)}</span><span class="sidgad-mob-clock">${escaparHtml(event.time_period)}</span></div>
            <div class="sidgad-mob-col-icon">${iconColHtml}</div>
            <div class="sidgad-mob-col-logo"><img src="${escaparHtml(teams[logoTeamId]?.logo || SIDGAD_DEFAULT_LOGO)}" class="sidgad-mob-team-logo" onerror="this.src='${SIDGAD_DEFAULT_LOGO}'"></div>
            <div class="sidgad-mob-col-details">${detailsColHtml}</div>
          </div>
        `);
      }
    });
  },
  renderActa: matchData => renderSidgadActaOficial(matchData, SIDGAD_ACTA_HP),
  renderStats(matchData) {
    const statsContainer = document.getElementById("sidgad-match-stats-container");
    const homeGoals = matchData.home_team_score || 0;
    const awayGoals = matchData.away_team_score || 0;
    const homeFouls = matchData.home_team_penals || 0;
    const awayFouls = matchData.away_team_penals || 0;
    const calcBlueCards = (roster) => (roster || []).reduce((total, p) => total + (sidgadNum(p.blue_card) || 0), 0);
    // direct llega como "marcadas/lanzadas" ("0/1") o vacío: se suman las marcadas, como hasta ahora.
    const calcDirect = (roster) => (roster || []).reduce((total, p) => total + (parseInt(String(p.direct ?? ""), 10) || 0), 0);

    if (homeGoals !== undefined) {
      statsContainer.innerHTML = `
        <div class="sidgad-match-stats-wrapper">
          <div class="sidgad-team-roster-header"><i class="fa-solid fa-chart-simple"></i> ${sidgadT('ESTADÍSTICAS DEL PARTIDO')}</div>
          <div class="sidgad-match-stats-table-like">
            ${renderSidgadStatRow("Goles", homeGoals, awayGoals)}
            ${renderSidgadStatRow("Faltas", homeFouls, awayFouls)}
            ${renderSidgadStatRow("Tarjetas azules", calcBlueCards(matchData.home_roster), calcBlueCards(matchData.away_roster))}
            ${renderSidgadStatRow("Faltas directas", calcDirect(matchData.home_roster), calcDirect(matchData.away_roster))}
          </div>
        </div>
      `;
      statsContainer.style.display = "block";
    } else {
      statsContainer.style.display = "none";
    }
  },
});
})();
