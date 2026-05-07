// ============================================================
// FECAPA Details Modal System v1
// Detalls interactius d'equips i partits
// ============================================================

// ── Modal DOM Management ──────────────────────────────────
function createModal(id, title, content, width = "90%", maxWidth = "600px") {
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = id;
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease;
  `;

  const modal = document.createElement("div");
  modal.style.cssText = `
    background: #fff;
    border-radius: 16px;
    width: ${width};
    max-width: ${maxWidth};
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 20, 60, 0.3);
    animation: slideUp 0.3s ease;
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    background: linear-gradient(135deg, #003da5 0%, #001f6e 100%);
    color: #fff;
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 16px 16px 0 0;
    position: sticky;
    top: 0;
  `;

  const titleEl = document.createElement("h2");
  titleEl.textContent = title;
  titleEl.style.cssText = `
    margin: 0;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 20px;
    font-weight: 800;
  `;

  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "✕";
  closeBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: #fff;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => overlay.remove();

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.innerHTML = content;
  body.style.padding = "16px";

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };

  document.body.appendChild(overlay);

  return overlay;
}

// ── Add CSS Animations ────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);

// ── Team Details Modal ────────────────────────────────────
function openTeamDetails(teamName, compId, teamId) {
  if (!DB) return;
  
  const comp = findComp(compId);
  if (!comp) return;

  const cl = comp.classification || [];
  const cal = comp.calendar || [];
  
  // Find team row
  const teamRow = cl.find(r => teamIn(r.team, teamName));
  if (!teamRow) return;

  // Get matches for this team
  const teamMatches = cal.filter(m => teamIn(m.home, teamName) || teamIn(m.away, teamName));
  const played = teamMatches.filter(m => m.played !== false && m.homeScore != null);
  const pending = teamMatches.filter(m => m.played === false || m.homeScore == null);

  const cid = rowClubId(teamRow);
  const catColor = CAT_COLOR[getCatForComp(comp)] || "#e5001c";

  let content = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
      ${shieldImg(cid, 48)}
      <div>
        <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 900;">
          ${esc(teamName)}
        </div>
        <div style="font-size: 12px; color: #94a3b8;">
          ${esc(comp.name.replace(/\s*\(2025-26\)/, ""))}
        </div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px;">
      <div style="background: #f0f4f8; padding: 12px; border-radius: 10px; text-align: center;">
        <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 900; color: #003da5;">
          ${teamRow.pos}º
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Posició</div>
      </div>
      <div style="background: #f0f4f8; padding: 12px; border-radius: 10px; text-align: center;">
        <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 900; color: #e5001c;">
          ${teamRow.pts ?? "-"}
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Punts</div>
      </div>
      <div style="background: #f0f4f8; padding: 12px; border-radius: 10px; text-align: center;">
        <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 900; color: #16a34a;">
          ${teamRow.pg ?? "-"}
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Victòries</div>
      </div>
      <div style="background: #f0f4f8; padding: 12px; border-radius: 10px; text-align: center;">
        <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 900; color: #d97706;">
          ${teamRow.pe ?? "-"}
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Empats</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px;">
      <div style="background: #fee2e2; padding: 12px; border-radius: 10px; text-align: center;">
        <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 900; color: #dc2626;">
          ${teamRow.pp ?? "-"}
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Derrotes</div>
      </div>
      <div style="background: #f0f4f8; padding: 12px; border-radius: 10px; text-align: center;">
        <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 900; color: #1a2035;">
          ${teamRow.pj ?? "-"}
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Partits jugats</div>
      </div>
      <div style="background: #f0f4f8; padding: 12px; border-radius: 10px; text-align: center;">
        <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 900; color: #003da5;">
          ${teamRow.gf ?? "-"}
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Gols a favor</div>
      </div>
      <div style="background: #f0f4f8; padding: 12px; border-radius: 10px; text-align: center;">
        <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 900; color: #dc2626;">
          ${teamRow.gc ?? "-"}
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Gols en contra</div>
      </div>
    </div>

    ${played.length > 0 ? `
      <div style="margin-top: 20px;">
        <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 800; color: #1a2035; margin-bottom: 8px;">
          ⚽ Últims resultats (${played.length})
        </div>
        ${played.slice(-3).reverse().map(m => matchCard(m, teamName)).join("")}
      </div>
    ` : ""}

    ${pending.length > 0 ? `
      <div style="margin-top: 16px;">
        <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 800; color: #1a2035; margin-bottom: 8px;">
          🗓️ Pròxims partits (${pending.length})
        </div>
        ${pending.slice(0, 3).map(m => matchCard(m, teamName)).join("")}
      </div>
    ` : ""}

    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e2e6ef;">
      <a href="https://jok.cat/equip/${teamId}/${teamName.replace(/ /g, '+')}" 
         target="_blank" rel="noopener noreferrer"
         style="display: inline-block; background: #003da5; color: #fff; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600;">
        📊 Veure a jok.cat
      </a>
    </div>
  `;

  createModal("team-modal", `📍 ${esc(teamName)}`, content);
}

// ── Match Details Modal ───────────────────────────────────
function openMatchDetails(match, compId) {
  if (!DB || !match) return;

  const comp = findComp(compId);
  if (!comp) return;

  const played = match.played !== false && match.homeScore != null;
  const cidH = getClubId(match.home);
  const cidA = getClubId(match.away);

  let resultBadge = "";
  if (played) {
    const draw = match.homeScore === match.awayScore;
    if (draw) {
      resultBadge = `<span style="background: #fef3c7; color: #b45309; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 6px;">⚖️ Empat</span>`;
    } else if (match.homeScore > match.awayScore) {
      resultBadge = `<span style="background: #dcfce7; color: #16a34a; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 6px;">🏆 ${esc(match.home)} guanya</span>`;
    } else {
      resultBadge = `<span style="background: #dcfce7; color: #16a34a; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 6px;">🏆 ${esc(match.away)} guanya</span>`;
    }
  }

  let content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="flex: 1; text-align: right;">
          ${shieldImg(cidH, 40)}
          <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; margin-top: 6px;">
            ${esc(match.home)}
          </div>
        </div>
        <div style="flex: 0 0 auto; padding: 0 16px;">
          ${played ? `
            <div style="background: #e5001c; color: #fff; border-radius: 8px; padding: 12px 16px; font-family: 'Barlow Condensed', sans-serif; font-size: 36px; font-weight: 900; line-height: 1;">
              ${match.homeScore}-${match.awayScore}
            </div>
          ` : `
            <div style="background: #1a5dc7; color: #fff; border-radius: 8px; padding: 12px 16px; font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 700;">
              VS
            </div>
          `}
        </div>
        <div style="flex: 1; text-align: left;">
          ${shieldImg(cidA, 40)}
          <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; margin-top: 6px;">
            ${esc(match.away)}
          </div>
        </div>
      </div>
      ${resultBadge}
    </div>

    <div style="background: #f8fafc; padding: 16px; border-radius: 10px; margin-bottom: 16px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px;">
        <div>
          <div style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Data</div>
          <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800;">
            ${esc(match.date || "?")}
          </div>
        </div>
        <div>
          <div style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Hora</div>
          <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800;">
            ${esc(match.time || "–")}
          </div>
        </div>
      </div>
      ${match.jornada ? `
        <div>
          <div style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Jornada</div>
          <div style="font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800;">
            Jornada ${match.jornada}
          </div>
        </div>
      ` : ""}
    </div>

    <div style="background: #eff6ff; padding: 12px; border-radius: 10px; margin-bottom: 16px; text-align: center;">
      <div style="font-size: 12px; color: #003da5; font-weight: 600;">
        ${played ? "✅ Partit jugat" : "⏳ Pendent de jugar"}
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
      <a href="https://jok.cat/competicio/${compId}" target="_blank" rel="noopener noreferrer"
         style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #003da5; color: #fff; padding: 10px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600;">
        📊 Competició
      </a>
      <a href="https://jok.cat/equip/${getClubId(match.home)}" target="_blank" rel="noopener noreferrer"
         style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #1a5dc7; color: #fff; padding: 10px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600;">
        📋 Acta
      </a>
    </div>
  `;

  createModal("match-modal", `🏒 ${esc(match.home)} vs ${esc(match.away)}`, content);
}

// Make functions global
window.openTeamDetails = openTeamDetails;
window.openMatchDetails = openMatchDetails;
