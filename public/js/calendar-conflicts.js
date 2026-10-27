/* ══════════════════════════════════════════════════════════════════════
 * Panell coordinador · Calendari i conflictes
 *
 * - Vista setmanal de tots els partits del club (casa i fora)
 * - Conflictes: pista, jugadors que doblen equip (bloqueig), germans (avís)
 * - Canvis detectats a jok.cat des de la darrera revisió
 * - Simulador de canvis + franges alternatives + propostes pendents
 *
 * Lògica a calendar-conflicts-core.js (window.CalendarConflicts).
 * Estat del coordinador (configuració, propostes, revisió) a localStorage per club.
 * ══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const CC = window.CalendarConflicts;
  const ROSTERS_URL = "./team-rosters.json";
  const STORE_PREFIX = "hoquei_cc_v1::";

  const ui = {
    view: "setmana",       // setmana | conflictes | canvis | simulador | config
    weekOffset: 0,
    simEventKey: "",
    simDate: "",
    simTime: "",
    simSource: "email",
    simNote: "",
    simResult: null,
    simSlots: null,
    showProposals: true,
    severityFilter: "all",
    rosters: null,
    rostersState: "idle",  // idle | loading | ok | error
  };

  // ── Utilitats ─────────────────────────────────────────────────────
  const h = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const enc = s => encodeURIComponent(String(s ?? ""));
  const dec = s => decodeURIComponent(String(s ?? ""));
  const DOW = ["Diumenge", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"];
  const DOW_SHORT = ["dg", "dl", "dt", "dc", "dj", "dv", "ds"];

  function dayLabel(dayKey, short = false) {
    const [y, m, d] = dayKey.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return short ? `${DOW_SHORT[dt.getUTCDay()]} ${d}/${m}` : `${DOW[dt.getUTCDay()]} ${d}/${m}`;
  }

  function todayKey() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }

  function weekRange(offset) {
    const n = new Date();
    const base = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
    const dow = base.getUTCDay();
    const monday = new Date(base.getTime() + ((dow === 0 ? -6 : 1 - dow) + offset * 7) * 86400000);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getTime() + i * 86400000);
      days.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`);
    }
    return days;
  }

  function teamLabel(ev) {
    const letter = (String(ev.team).match(/\s([A-H])$/) || [])[1];
    const level = /INICIACI/i.test(ev.compName) ? " Iniciació" : "";
    return `${ev.category}${letter ? " " + letter : ""}${level}`;
  }

  function teamLabelByKey(key, events) {
    const ev = events.find(e => e.teamKey === key);
    if (ev) return teamLabel(ev);
    return String(key).split("|").slice(1).join("|");
  }

  function title(name) {
    return String(name || "").toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
  }

  // ── Estat persistent per club ─────────────────────────────────────
  function storeKey(club) { return STORE_PREFIX + String(club || "").trim(); }

  function loadStore(club) {
    try {
      const raw = localStorage.getItem(storeKey(club));
      const s = raw ? JSON.parse(raw) : {};
      return {
        config: s.config || {},
        overrides: { disabledPlayers: [], extraLinks: [], disabledFamilies: [], extraSiblings: [], ...(s.overrides || {}) },
        proposals: Array.isArray(s.proposals) ? s.proposals : [],
        snapshot: s.snapshot || null,
        snapshotAt: s.snapshotAt || null,
      };
    } catch {
      return { config: {}, overrides: { disabledPlayers: [], extraLinks: [], disabledFamilies: [], extraSiblings: [] }, proposals: [], snapshot: null, snapshotAt: null };
    }
  }

  function saveStore(club, store) {
    try { localStorage.setItem(storeKey(club), JSON.stringify(store)); } catch (err) { console.warn("[calendari] no s'ha pogut desar", err); }
  }

  // ── Dades ─────────────────────────────────────────────────────────
  function ensureRosters() {
    if (ui.rostersState === "ok" || ui.rostersState === "loading") return;
    ui.rostersState = "loading";
    fetch(ROSTERS_URL + "?t=" + Date.now())
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then(json => { ui.rosters = json; ui.rostersState = "ok"; })
      .catch(err => { console.warn("[calendari] plantilles no disponibles", err); ui.rosters = { teams: {}, players: {} }; ui.rostersState = "error"; })
      .finally(() => { if (typeof coordinatorPanelTab !== "undefined" && coordinatorPanelTab === "calendari") renderCoordinatorPanel(); });
  }

  function clubMatcher(clubName) {
    const teams = typeof getCoordinatorClubTeams === "function" ? getCoordinatorClubTeams(clubName) : [];
    const strict = new Set(teams.map(t => normalizeTeamNameStrict(t?.teamName || "")).filter(Boolean));
    const exact = new Set(teams.map(t => CC.norm(t?.teamName || "")).filter(Boolean));
    return name => exact.has(CC.norm(name)) || strict.has(normalizeTeamNameStrict(name || ""));
  }

  /** Calcula tot el que necessita la pestanya (en memòria, és ràpid). */
  function compute(clubName) {
    const store = loadStore(clubName);
    const cfg = { ...CC.DEFAULT_CONFIG, ...store.config };
    const all = CC.buildClubEvents(DB, clubMatcher(clubName));
    const teamKeys = [...new Set(all.map(e => e.teamKey))];
    const links = CC.buildLinks(ui.rosters || { teams: {}, players: {} }, teamKeys, cfg, store.overrides);
    const resolve = CC.makeVenueResolver(venuesDB?.venues || {});
    const today = todayKey();
    const upcomingRaw = all.filter(e => e.dayKey >= today);
    const applied = CC.applyProposals(upcomingRaw, store.proposals);
    const upcoming = ui.showProposals ? applied.events : upcomingRaw;
    const conflicts = CC.detectConflicts(upcoming, links, resolve, cfg);
    return { store, cfg, all, upcoming, upcomingRaw, links, resolve, conflicts, proposalStatus: applied.status, teamKeys };
  }

  // ── Render principal ──────────────────────────────────────────────
  window.renderCoordinatorCalendarTab = function (currentFav) {
    if (!CC) return `<div style="padding:14px;color:#b91c1c">No s'ha carregat el motor de conflictes.</div>`;
    if (!currentFav?.clubName) {
      return `<div style="background:#fff;border:1.5px dashed #cbd5e1;border-radius:14px;padding:18px;color:#64748b;font-size:14px">Tria primer el club a <b>Gestió club</b>.</div>`;
    }
    ensureRosters();
    const ctx = compute(currentFav.clubName);
    const nav = [
      ["setmana", "Setmana"],
      ["conflictes", `Conflictes${countBadge(ctx.conflicts)}`],
      ["canvis", `Canvis${changesBadge(ctx)}`],
      ["simulador", "Simulador"],
      ["config", "Configuració"],
    ];
    const pills = `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px;-webkit-overflow-scrolling:touch">${nav.map(([k, label]) => {
      const on = ui.view === k;
      return `<button onclick="ccSetView('${k}')" style="flex:0 0 auto;background:${on ? "#7c3aed" : "#fff"};border:1.5px solid ${on ? "#7c3aed" : "#dbe3f0"};color:${on ? "#fff" : "#334155"};font-weight:700;font-size:13px;padding:8px 12px;border-radius:999px;cursor:pointer;white-space:nowrap">${label}</button>`;
    }).join("")}</div>`;

    const rostersNote = ui.rostersState === "loading"
      ? note("Carregant plantilles dels equips…", "#64748b", "#f8fafc", "#e2e6ef")
      : ui.rostersState === "error"
        ? note("No s'ha trobat <b>team-rosters.json</b>: només es detecten solapes de pista i enllaços manuals fins al pròxim scraper.", "#9a3412", "#fff7ed", "#fdba74")
        : "";

    let body = "";
    if (ui.view === "conflictes") body = renderConflictsView(ctx);
    else if (ui.view === "canvis") body = renderChangesView(ctx, currentFav.clubName);
    else if (ui.view === "simulador") body = renderSimulatorView(ctx);
    else if (ui.view === "config") body = renderConfigView(ctx);
    else body = renderWeekView(ctx);

    return `${pills}${rostersNote}${body}`;
  };

  function countBadge(conflicts) {
    const b = conflicts.filter(c => c.severity === "block").length;
    return b ? ` <span style="background:#dc2626;color:#fff;border-radius:999px;padding:1px 7px;font-size:11px;margin-left:4px">${b}</span>` : "";
  }

  function changesBadge(ctx) {
    const d = CC.diffSnapshot(ctx.store.snapshot, ctx.all);
    const n = d.baseline ? 0 : d.changed.length + d.added.length + d.removed.length;
    return n ? ` <span style="background:#f59e0b;color:#fff;border-radius:999px;padding:1px 7px;font-size:11px;margin-left:4px">${n}</span>` : "";
  }

  function note(html, color, bg, border) {
    return `<div style="background:${bg};border:1px solid ${border};color:${color};border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.45;margin-bottom:12px">${html}</div>`;
  }

  function card(inner, extra = "") {
    return `<div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:14px;padding:14px;margin-bottom:12px;${extra}">${inner}</div>`;
  }

  function sectionTitle(text, right = "") {
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px"><div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.05em">${text}</div>${right}</div>`;
  }

  // ── Vista setmanal ────────────────────────────────────────────────
  function renderWeekView(ctx) {
    const days = weekRange(ui.weekOffset);
    const inWeek = ctx.upcoming.concat(ctx.all.filter(e => e.dayKey < todayKey()))
      .filter(e => days.includes(e.dayKey));
    const conflicts = ui.weekOffset < 0
      ? CC.detectConflicts(inWeek, ctx.links, ctx.resolve, ctx.cfg)
      : ctx.conflicts.filter(c => days.includes(c.a.dayKey));
    const sev = new Map();
    for (const c of conflicts) {
      for (const k of [c.a.key, c.b.key]) {
        if (c.severity === "block" || !sev.has(k)) sev.set(k, c.severity);
      }
    }
    const blocks = conflicts.filter(c => c.severity === "block").length;
    const warns = conflicts.length - blocks;
    const homeCount = inWeek.filter(e => e.isHome).length;

    const header = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        <button onclick="ccWeek(-1)" style="${navBtn()}">←</button>
        <div style="flex:1;text-align:center;font-weight:700;font-size:14px">${dayLabel(days[0], true)} – ${dayLabel(days[6], true)}</div>
        <button onclick="ccWeek(1)" style="${navBtn()}">→</button>
        ${ui.weekOffset ? `<button onclick="ccWeek(0)" style="${navBtn()}">Avui</button>` : ""}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
        ${stat(inWeek.length, "partits", "#1a2035")}
        ${stat(homeCount, "a casa", "#2563eb")}
        ${stat(blocks ? `${blocks}` : warns ? `0` : "✓", blocks ? "bloquejos" : warns ? `bloquejos · ${warns} avisos` : "sense conflictes", blocks ? "#dc2626" : "#16a34a")}
      </div>`;

    if (!inWeek.length) return header + card(`<div style="color:#64748b;font-size:14px">Cap partit aquesta setmana.</div>`);

    const byDay = days.map(d => [d, inWeek.filter(e => e.dayKey === d).sort((a, b) => (a.start ?? 0) - (b.start ?? 0))]).filter(([, l]) => l.length);
    const dayBlocks = byDay.map(([d, list]) => {
      const dayConf = conflicts.filter(c => c.a.dayKey === d);
      return card(`
        ${sectionTitle(dayLabel(d), `<span style="font-size:12px;color:#64748b">${list.filter(e => e.isHome).length} a casa · ${list.filter(e => !e.isHome).length} fora</span>`)}
        ${list.map(ev => eventRow(ev, sev.get(ev.key), ctx)).join("")}
        ${dayConf.length ? `<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">${dayConf.map(c => conflictLine(c, false)).join("")}</div>` : ""}
      `);
    }).join("");

    const pendingToggle = ctx.store.proposals.length
      ? `<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#334155;margin-bottom:10px"><input type="checkbox" ${ui.showProposals ? "checked" : ""} onchange="ccToggleProposals(this.checked)"/> Mostrar propostes pendents (${ctx.store.proposals.filter(p => ctx.proposalStatus[p.id] === "pendent").length})</label>`
      : "";

    return header + pendingToggle + dayBlocks;
  }

  function navBtn() {
    return "background:#fff;border:1.5px solid #dbe3f0;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer;font-size:14px";
  }

  function stat(value, label, color) {
    return `<div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px;text-align:center"><div style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:${color};line-height:1">${value}</div><div style="font-size:11px;color:#64748b;margin-top:3px">${label}</div></div>`;
  }

  function eventRow(ev, severity, ctx) {
    const border = severity === "block" ? "#dc2626" : severity === "warn" ? "#f59e0b" : "#e2e6ef";
    const bg = severity === "block" ? "#fef2f2" : severity === "warn" ? "#fffbeb" : "#fff";
    const where = ev.isHome ? `<span style="background:#dbeafe;color:#1d4ed8;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700">CASA</span>` : `<span style="background:#f1f5f9;color:#475569;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700">FORA</span>`;
    const pending = ev.proposalId ? `<div style="font-size:11px;color:#7c3aed;font-weight:700;margin-top:2px">⏳ Proposta: abans ${h(ev.original?.date)} ${h(ev.original?.time)}</div>` : "";
    let travel = "";
    if (!ev.isHome) {
      const home = { isHome: true, venueTeam: "" };
      const t = CC.travelBetween(home, ev, ctx.resolve, ctx.cfg);
      travel = ` · ${t.minutes} min${t.estimated ? "?" : ""}`;
    }
    return `<button onclick="ccOpenSim('${enc(ev.key)}')" style="width:100%;text-align:left;display:flex;gap:10px;align-items:flex-start;background:${bg};border:1.5px solid ${border};border-radius:10px;padding:9px 10px;margin-bottom:6px;cursor:pointer">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:800;min-width:46px;color:#1a2035">${h(ev.time || "--:--")}</div>
      <div style="min-width:0;flex:1">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span style="font-weight:700;font-size:14px;color:#1a2035">${h(teamLabel(ev))}</span>${where}</div>
        <div style="font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">vs ${h(ev.opponent)}${ev.isHome ? "" : ` · a ${h(ev.venueTeam)}${travel}`}</div>
        ${pending}
      </div>
    </button>`;
  }

  function conflictLine(c, withDate) {
    const icon = c.severity === "block" ? "⛔" : "⚠️";
    const color = c.severity === "block" ? "#b91c1c" : "#92400e";
    const bg = c.severity === "block" ? "#fef2f2" : "#fffbeb";
    const kind = c.type === "pista" ? "Pista" : c.type === "jugador" ? "Jugadors" : "Germans";
    const who = c.players?.length ? `<div style="font-size:12px;color:#334155;margin-top:3px">👤 ${c.players.map(title).map(h).join(", ")}</div>` : "";
    const date = withDate ? `${dayLabel(c.a.dayKey, true)} · ` : "";
    return `<div style="background:${bg};border-radius:10px;padding:8px 10px;font-size:13px;color:${color}">
      <div><b>${icon} ${kind}</b> · ${date}${h(c.a.time)} ${h(teamLabel(c.a))} ${c.a.isHome ? "(casa)" : "(fora)"} ↔ ${h(c.b.time)} ${h(teamLabel(c.b))} ${c.b.isHome ? "(casa)" : "(fora)"}</div>
      <div style="font-size:12px;margin-top:2px">${h(c.message)}</div>
      ${who}
      <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
        <button onclick="ccOpenSim('${enc(c.b.key)}')" style="${miniBtn()}">Simular moure ${h(teamLabel(c.b))}</button>
        <button onclick="ccOpenSim('${enc(c.a.key)}')" style="${miniBtn()}">Simular moure ${h(teamLabel(c.a))}</button>
      </div>
    </div>`;
  }

  function miniBtn(primary = false) {
    return primary
      ? "background:#7c3aed;border:none;color:#fff;font-weight:700;font-size:12px;padding:6px 10px;border-radius:8px;cursor:pointer"
      : "background:#fff;border:1px solid #cbd5e1;color:#334155;font-weight:600;font-size:12px;padding:6px 10px;border-radius:8px;cursor:pointer";
  }

  // ── Conflictes ────────────────────────────────────────────────────
  function renderConflictsView(ctx) {
    const list = ctx.conflicts.filter(c => ui.severityFilter === "all" || c.severity === ui.severityFilter);
    const filters = [["all", "Tots"], ["block", "Bloquejos"], ["warn", "Avisos"]].map(([k, l]) =>
      `<button onclick="ccSeverity('${k}')" style="${ui.severityFilter === k ? miniBtn(true) : miniBtn()}">${l}</button>`).join("");
    if (!list.length) return card(`${sectionTitle("Conflictes", `<div style="display:flex;gap:6px">${filters}</div>`)}<div style="color:#16a34a;font-weight:700">✓ Cap conflicte als propers partits.</div>`);
    const byDay = new Map();
    for (const c of list) {
      if (!byDay.has(c.a.dayKey)) byDay.set(c.a.dayKey, []);
      byDay.get(c.a.dayKey).push(c);
    }
    return card(sectionTitle(`Conflictes (${list.length})`, `<div style="display:flex;gap:6px">${filters}</div>`)
      + `<div style="font-size:12px;color:#64748b">Bloqueig = no es pot jugar així. Avís = germans o marge molt just; revisa-ho amb les famílies.</div>`)
      + [...byDay.entries()].map(([d, cs]) => card(sectionTitle(dayLabel(d)) + `<div style="display:flex;flex-direction:column;gap:6px">${cs.map(c => conflictLine(c, false)).join("")}</div>`)).join("");
  }

  // ── Canvis ────────────────────────────────────────────────────────
  function renderChangesView(ctx, clubName) {
    const store = ctx.store;
    if (!store.snapshot) {
      store.snapshot = CC.snapshotOf(ctx.all);
      store.snapshotAt = new Date().toISOString();
      saveStore(clubName, store);
      return card(sectionTitle("Canvis a jok.cat") + `<div style="font-size:14px;color:#334155">He desat el calendari actual com a punt de partida. A partir d'ara aquí veuràs els partits que jok.cat mogui, afegeixi o tregui.</div>`);
    }
    const d = CC.diffSnapshot(store.snapshot, ctx.all);
    const when = store.snapshotAt ? new Date(store.snapshotAt).toLocaleString("ca-ES", { dateStyle: "short", timeStyle: "short" }) : "";
    const total = d.changed.length + d.added.length + d.removed.length;
    const conflictKeys = new Set(ctx.conflicts.flatMap(c => [c.a.key, c.b.key]));
    const row = (ev, text) => `<div style="border:1.5px solid ${conflictKeys.has(ev.key) ? "#dc2626" : "#e2e6ef"};border-radius:10px;padding:9px 10px;margin-bottom:6px;font-size:13px">
        <div style="font-weight:700">${h(teamLabel(ev))} <span style="font-weight:500;color:#64748b">${ev.isHome ? "vs" : "a"} ${h(ev.opponent)}</span></div>
        <div style="color:#334155">${text}</div>
        ${conflictKeys.has(ev.key) ? `<div style="color:#b91c1c;font-size:12px;font-weight:700;margin-top:2px">⛔ Ara té conflictes</div>` : ""}
      </div>`;
    return card(
      sectionTitle(`Canvis des del ${h(when)}`, `<button onclick="ccMarkReviewed()" style="${miniBtn(true)}">Marcar revisat</button>`)
      + (total ? "" : `<div style="color:#16a34a;font-weight:700;font-size:14px">✓ Cap canvi a jok.cat.</div>`)
      + d.changed.map(c => row(c.event, `🔁 ${h(c.from)} → <b>${h(c.to)}</b>`)).join("")
      + d.added.map(ev => row(ev, `🆕 Nou: <b>${h(ev.date)} ${h(ev.time)}</b>`)).join("")
      + d.removed.map(r => `<div style="border:1.5px solid #e2e6ef;border-radius:10px;padding:9px 10px;margin-bottom:6px;font-size:13px">🗑️ Ja no surt: ${h(r.key.split("|").slice(2).join(" - "))} (${h(r.from)})</div>`).join("")
    );
  }

  // ── Simulador ─────────────────────────────────────────────────────
  function renderSimulatorView(ctx) {
    const events = ctx.upcomingRaw;
    const opts = events.map(ev => `<option value="${h(ev.key)}" ${ev.key === ui.simEventKey ? "selected" : ""}>${h(dayLabel(ev.dayKey, true))} ${h(ev.time)} · ${h(teamLabel(ev))} ${ev.isHome ? "vs" : "@"} ${h(ev.opponent)}</option>`).join("");
    const ev = events.find(e => e.key === ui.simEventKey);
    const input = "width:100%;padding:10px 12px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:15px;background:#fff";

    const form = card(`
      ${sectionTitle("Simular un canvi")}
      <label style="font-size:12px;color:#64748b;font-weight:600">Partit</label>
      <select onchange="ccSimPick(this.value)" style="${input};margin:4px 0 10px">${ev ? "" : `<option value="">Tria un partit…</option>`}${opts}</select>
      ${ev ? `
        <div style="font-size:12px;color:#64748b;margin-bottom:10px">Ara: <b>${h(dayLabel(ev.dayKey))} ${h(ev.time)}</b> · ${ev.isHome ? "a casa" : "fora, a " + h(ev.venueTeam)}</div>
        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:8px">
          <div><label style="font-size:12px;color:#64748b;font-weight:600">Nova data</label><input type="date" value="${h(ui.simDate)}" onchange="ccSimField('simDate',this.value)" style="${input};margin-top:4px"/></div>
          <div><label style="font-size:12px;color:#64748b;font-weight:600">Nova hora</label><input type="time" step="300" value="${h(ui.simTime)}" onchange="ccSimField('simTime',this.value)" style="${input};margin-top:4px"/></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <button onclick="ccSimRun()" style="background:#7c3aed;border:none;color:#fff;font-weight:800;font-size:14px;padding:11px 14px;border-radius:10px;cursor:pointer;flex:1">Analitzar impacte</button>
          <button onclick="ccSimSuggest()" style="background:#fff;border:1.5px solid #7c3aed;color:#7c3aed;font-weight:800;font-size:14px;padding:11px 14px;border-radius:10px;cursor:pointer;flex:1">Buscar franges lliures</button>
        </div>` : `<div style="font-size:13px;color:#64748b">També pots tocar qualsevol partit a la vista Setmana.</div>`}
    `);

    let result = "";
    if (ev && ui.simResult && ui.simResult.event.key === ev.key) result = renderSimResult(ui.simResult);
    let slots = "";
    if (ev && ui.simSlots && ui.simSlots.key === ev.key) slots = renderSlots(ui.simSlots);

    return form + result + slots + renderProposals(ctx);
  }

  function renderSimResult(sim) {
    const ok = sim.blocks === 0;
    const head = ok
      ? `<div style="font-size:16px;font-weight:800;color:#16a34a">✓ Es pot acceptar${sim.warns ? ` (amb ${sim.warns} avís${sim.warns > 1 ? "os" : ""})` : ""}</div>`
      : `<div style="font-size:16px;font-weight:800;color:#dc2626">⛔ Genera ${sim.blocks} bloqueig${sim.blocks > 1 ? "s" : ""}</div>`;
    const list = (arr, label) => arr.length ? `<div style="font-size:12px;font-weight:700;color:#64748b;margin:10px 0 6px;text-transform:uppercase;letter-spacing:.04em">${label}</div><div style="display:flex;flex-direction:column;gap:6px">${arr.map(c => conflictLine(c, true)).join("")}</div>` : "";
    const resolved = sim.resolved.length ? `<div style="font-size:12px;font-weight:700;color:#16a34a;margin:10px 0 4px">✓ Resol ${sim.resolved.length} conflicte${sim.resolved.length > 1 ? "s" : ""} que hi havia</div>` : "";
    const save = `
      <div style="border-top:1px solid #e2e6ef;margin-top:12px;padding-top:12px">
        <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:8px">
          <select onchange="ccSimField('simSource',this.value)" style="padding:9px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;background:#fff">
            ${[["email", "Email"], ["telefon", "Telèfon"], ["rival", "Club rival"], ["federacio", "Federació"], ["intern", "Intern"]].map(([k, l]) => `<option value="${k}" ${ui.simSource === k ? "selected" : ""}>${l}</option>`).join("")}
          </select>
          <input value="${h(ui.simNote)}" oninput="ccSimField('simNote',this.value,true)" placeholder="Nota (qui ho demana…)" style="padding:9px 10px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px"/>
        </div>
        <button onclick="ccSaveProposal()" style="margin-top:8px;width:100%;background:#1a2035;border:none;color:#fff;font-weight:800;font-size:14px;padding:11px;border-radius:10px;cursor:pointer">Desar com a proposta pendent</button>
      </div>`;
    return card(`${sectionTitle(`${h(teamLabel(sim.event))} → ${h(dayLabel(sim.moved.dayKey, true))} ${h(sim.moved.time)}`)}${head}${resolved}${list(sim.after, "Conflictes amb la nova hora")}${save}`);
  }

  function renderSlots(s) {
    if (!s.slots.length) return card(sectionTitle("Franges lliures") + `<div style="font-size:14px;color:#b91c1c">No he trobat cap franja sense bloquejos aquest cap de setmana entre les ${h(s.from)} i les ${h(s.to)}.</div>`);
    const ev = s.event;
    const byDay = new Map();
    for (const sl of s.slots) {
      if (!byDay.has(sl.dayKey)) byDay.set(sl.dayKey, []);
      byDay.get(sl.dayKey).push(sl);
    }
    return card(sectionTitle("Franges lliures")
      + `<div style="font-size:12px;color:#64748b;margin-bottom:8px">Sense bloquejos per al club${ev.isHome ? " (pista lliure i jugadors disponibles)" : " (jugadors disponibles; la pista del rival l'ha de confirmar ell)"}. Ordenades per proximitat a l'hora actual.</div>`
      + [...byDay.entries()].map(([d, list]) => `<div style="margin-bottom:8px"><div style="font-weight:700;font-size:13px;margin-bottom:4px">${h(dayLabel(d))}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${list.sort((a, b) => a.time.localeCompare(b.time)).map(sl => `<button onclick="ccUseSlot('${sl.dayKey}','${sl.time}')" style="${sl.warns ? "background:#fffbeb;border:1px solid #f59e0b" : "background:#f0fdf4;border:1px solid #86efac"};color:#1a2035;font-weight:700;font-size:13px;padding:7px 10px;border-radius:8px;cursor:pointer">${sl.time}${sl.warns ? " ⚠️" : ""}</button>`).join("")}</div></div>`).join(""));
  }

  function renderProposals(ctx) {
    const list = ctx.store.proposals;
    if (!list.length) return "";
    const byKey = new Map(ctx.all.map(e => [e.key, e]));
    const statusTag = st => ({
      pendent: `<span style="background:#ede9fe;color:#6d28d9;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700">PENDENT FEDERACIÓ</span>`,
      oficial: `<span style="background:#dcfce7;color:#15803d;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700">JA A JOK.CAT</span>`,
      "sense-partit": `<span style="background:#f1f5f9;color:#475569;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700">PARTIT JA JUGAT / NO TROBAT</span>`,
    }[st] || "");
    return card(sectionTitle(`Propostes (${list.length})`) + list.slice().reverse().map(p => {
      const ev = byKey.get(p.eventKey);
      const st = ctx.proposalStatus[p.id] || "sense-partit";
      const newDate = p.newDate.split("-").reverse().join("/");
      return `<div style="border:1.5px solid #e2e6ef;border-radius:10px;padding:9px 10px;margin-bottom:6px;font-size:13px">
        <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;flex-wrap:wrap"><b>${h(ev ? teamLabel(ev) : p.label || "Partit")}</b>${statusTag(st)}</div>
        <div style="color:#334155">${h(p.fromDate)} ${h(p.fromTime)} → <b>${h(newDate)} ${h(p.newTime)}</b></div>
        <div style="color:#64748b;font-size:12px">${h(p.source)}${p.note ? " · " + h(p.note) : ""}</div>
        <div style="display:flex;gap:6px;margin-top:6px">${st === "pendent" ? `<button onclick="ccOpenSim('${enc(p.eventKey)}','${p.newDate}','${p.newTime}')" style="${miniBtn()}">Tornar a analitzar</button>` : ""}<button onclick="ccDeleteProposal('${h(p.id)}')" style="${miniBtn()}">${st === "pendent" ? "Descartar" : "Treure"}</button></div>
      </div>`;
    }).join(""));
  }

  // ── Configuració ──────────────────────────────────────────────────
  function renderConfigView(ctx) {
    const cfg = ctx.cfg;
    const num = (key, label, hint) => `<label style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9">
        <span style="font-size:13px;color:#334155">${label}${hint ? `<br><span style="font-size:11px;color:#94a3b8">${hint}</span>` : ""}</span>
        <input type="number" min="0" value="${h(cfg[key])}" onchange="ccSetConfig('${key}',this.value)" style="width:76px;padding:8px;border:1.5px solid #e2e6ef;border-radius:8px;font-size:15px;text-align:right"/>
      </label>`;
    const rules = card(sectionTitle("Regles")
      + num("slotMinutes", "Ocupació de pista per partit (min)", "Entre inicis de dos partits a casa")
      + num("busyMinutes", "Temps de partit del jugador (min)", "Escalfament + partit")
      + num("preMatchMinutes", "Arribada abans del 2n partit (min)", "Només quan hi ha desplaçament")
      + num("defaultTravelMinutes", "Trajecte si no coneixem la pista (min)")
      + num("tightMarginMinutes", "Avisar si el marge és menor de (min)")
      + num("minAppearances", "Actes mínimes per comptar que juga en un equip", "Puja-ho a 2 si surten massa casos puntuals"));

    // Jugadors que doblen
    const disabled = new Set(ctx.store.overrides.disabledPlayers || []);
    const multi = [...ctx.links.playerTeams.entries()].filter(([, teams]) => teams.size > 1)
      .map(([id, teams]) => ({ id, name: ui.rosters?.players?.[id]?.name || id, teams: [...teams.entries()].sort((a, b) => b[1] - a[1]) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const players = card(sectionTitle(`Jugadors que doblen (${multi.length})`)
      + `<div style="font-size:12px;color:#64748b;margin-bottom:8px">Detectats a les actes de jok.cat. Desmarca qui no ha de bloquejar (p. ex. va pujar un sol dia).</div>`
      + (multi.length ? multi.map(p => `<label style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid #f1f5f9">
          <input type="checkbox" ${disabled.has(p.id) ? "" : "checked"} onchange="ccTogglePlayer('${h(p.id)}',this.checked)" style="margin-top:3px"/>
          <span style="font-size:13px"><b>${h(title(p.name))}</b><br><span style="color:#64748b;font-size:12px">${p.teams.map(([k, n]) => `${h(teamLabelByKey(k, ctx.all))} (${n})`).join(" · ")}</span></span>
        </label>`).join("") : `<div style="font-size:13px;color:#64748b">Encara no n'hi ha cap a les actes.</div>`)
      + renderManualLinks(ctx));

    // Germans
    const offFam = new Set(ctx.store.overrides.disabledFamilies || []);
    const allFamilies = familiesIncludingDisabled(ctx);
    const siblings = card(sectionTitle(`Germans (${allFamilies.length})`)
      + `<div style="font-size:12px;color:#64748b;margin-bottom:8px">Detectats pels dos cognoms. Només generen avís. Desmarca els falsos positius (cognoms comuns).</div>`
      + allFamilies.map(f => `<label style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid #f1f5f9">
          <input type="checkbox" ${offFam.has(f.family) ? "" : "checked"} onchange="ccToggleFamily('${h(f.family)}',this.checked)" style="margin-top:3px"/>
          <span style="font-size:13px"><b>${h(title(f.family))}</b><br><span style="color:#64748b;font-size:12px">${f.members.map(m => `${h(title(m.name.split(" ")[0]))} (${h(teamLabelByKey(m.teamKey, ctx.all))})`).join(" · ")}</span></span>
        </label>`).join(""));

    return rules + players + siblings + renderTravelTable(ctx)
      + `<div style="font-size:11px;color:#94a3b8;margin:4px 2px 16px">La configuració i les propostes es guarden en aquest dispositiu.</div>`;
  }

  function familiesIncludingDisabled(ctx) {
    // Recalcula sense desactivar per poder tornar a activar-les.
    const store = ctx.store;
    const links = CC.buildLinks(ui.rosters || { teams: {}, players: {} }, ctx.teamKeys, ctx.cfg, { ...store.overrides, disabledFamilies: [] });
    return links.families.filter(f => !f.manual);
  }

  function renderManualLinks(ctx) {
    const teamOpts = ctx.teamKeys.map(k => `<option value="${h(k)}">${h(teamLabelByKey(k, ctx.all))}</option>`).join("");
    const list = ctx.store.overrides.extraLinks || [];
    return `<div style="margin-top:12px;padding-top:10px;border-top:1px solid #e2e6ef">
      <div style="font-weight:700;font-size:13px;margin-bottom:6px">Reforç manual</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:8px">Per a jugadors que reforçaran un equip però encara no surten a cap acta.</div>
      ${list.map((l, i) => `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:13px;padding:5px 0"><span><b>${h(l.name)}</b> · ${l.teams.map(k => h(teamLabelByKey(k, ctx.all))).join(" + ")}</span><button onclick="ccRemoveLink(${i})" style="${miniBtn()}">Treure</button></div>`).join("")}
      <input id="cc-link-name" placeholder="Nom del jugador" style="width:100%;padding:9px 10px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;margin-bottom:6px"/>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <select id="cc-link-a" style="padding:9px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;background:#fff">${teamOpts}</select>
        <select id="cc-link-b" style="padding:9px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;background:#fff">${teamOpts}</select>
      </div>
      <button onclick="ccAddLink()" style="margin-top:6px;${miniBtn(true)}">Afegir</button>
    </div>`;
  }

  function renderTravelTable(ctx) {
    const ov = ctx.cfg.travelOverrides || {};
    const venues = new Map();
    for (const ev of ctx.upcomingRaw) {
      if (ev.isHome) continue;
      const base = CC.stripTeamSuffix(ev.venueTeam);
      if (!venues.has(base)) venues.set(base, ev);
    }
    const home = { isHome: true, venueTeam: "" };
    const rows = [...venues.entries()].map(([base, ev]) => {
      const auto = CC.travelBetween(home, ev, ctx.resolve, { ...ctx.cfg, travelOverrides: {} });
      return { base, name: ev.venueTeam, auto, manual: ov[base] };
    }).sort((a, b) => (a.auto.estimated === b.auto.estimated ? 0 : a.auto.estimated ? -1 : 1) || a.name.localeCompare(b.name));
    return card(sectionTitle("Trajectes des de casa")
      + `<div style="font-size:12px;color:#64748b;margin-bottom:8px">Calculats amb les coordenades de venues.json. Algunes coordenades no són fiables: escriu els minuts reals per corregir-les. Les marcades amb ? no tenen ubicació.</div>`
      + rows.map(r => `<label style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9">
          <span style="font-size:13px;min-width:0">${h(r.name)}<br><span style="font-size:11px;color:${r.auto.estimated ? "#b45309" : "#94a3b8"}">auto: ${r.auto.minutes} min${r.auto.estimated ? " ?" : r.auto.km != null ? ` · ~${r.auto.km} km` : ""}</span></span>
          <input type="number" min="0" placeholder="${r.auto.minutes}" value="${Number.isFinite(r.manual) ? r.manual : ""}" onchange="ccSetTravel('${enc(r.base)}',this.value)" style="width:76px;padding:8px;border:1.5px solid ${Number.isFinite(r.manual) ? "#7c3aed" : "#e2e6ef"};border-radius:8px;font-size:15px;text-align:right"/>
        </label>`).join(""));
  }

  // ── Accions ───────────────────────────────────────────────────────
  function club() { return loadCoordinatorFavorite()?.clubName || ""; }
  function rerender() { renderCoordinatorPanel(); }
  function mutate(fn) { const c = club(); const s = loadStore(c); fn(s); saveStore(c, s); rerender(); }

  window.ccSetView = v => { ui.view = v; rerender(); };
  window.ccWeek = d => { ui.weekOffset = d === 0 ? 0 : ui.weekOffset + d; rerender(); };
  window.ccSeverity = s => { ui.severityFilter = s; rerender(); };
  window.ccToggleProposals = on => { ui.showProposals = !!on; rerender(); };

  window.ccOpenSim = (encodedKey, date, time) => {
    const key = dec(encodedKey);
    const ev = compute(club()).upcomingRaw.find(e => e.key === key);
    ui.view = "simulador";
    ui.simEventKey = key;
    ui.simDate = date || ev?.dayKey || "";
    ui.simTime = time || ev?.time || "";
    ui.simResult = null;
    ui.simSlots = null;
    rerender();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.ccSimPick = key => window.ccOpenSim(enc(key));

  window.ccSimField = (field, value, silent) => {
    ui[field] = value;
    if (!silent) rerender();
  };

  window.ccSimRun = () => {
    if (!ui.simEventKey || !ui.simDate || !ui.simTime) { alert("Indica data i hora."); return; }
    const ctx = compute(club());
    // Simula sobre el calendari oficial + altres propostes pendents (sense la d'aquest partit).
    const others = ctx.store.proposals.filter(p => p.eventKey !== ui.simEventKey);
    const base = CC.applyProposals(ctx.upcomingRaw, others).events;
    ui.simResult = CC.simulateChange(base, ctx.links, ctx.resolve, ctx.cfg, ui.simEventKey, ui.simDate, ui.simTime);
    rerender();
  };

  window.ccSimSuggest = () => {
    if (!ui.simEventKey) return;
    const ctx = compute(club());
    const others = ctx.store.proposals.filter(p => p.eventKey !== ui.simEventKey);
    const base = CC.applyProposals(ctx.upcomingRaw, others).events;
    const ev = base.find(e => e.key === ui.simEventKey);
    const days = CC.weekendDays(ui.simDate || ev.dayKey);
    if (ui.simDate && !days.includes(ui.simDate)) days.unshift(ui.simDate);
    const from = "09:00", to = "20:30";
    const slots = CC.suggestSlots(base, ctx.links, ctx.resolve, ctx.cfg, ui.simEventKey, { dayKeys: days, from, to, stepMinutes: 15, limit: 24 });
    ui.simSlots = { key: ui.simEventKey, event: ev, slots, from, to };
    rerender();
  };

  window.ccUseSlot = (dayKey, time) => {
    ui.simDate = dayKey;
    ui.simTime = time;
    window.ccSimRun();
  };

  window.ccSaveProposal = () => {
    const sim = ui.simResult;
    if (!sim) return;
    mutate(s => {
      s.proposals = s.proposals.filter(p => p.eventKey !== sim.event.key);
      s.proposals.push({
        id: "p" + Date.now().toString(36),
        eventKey: sim.event.key,
        label: teamLabel(sim.event),
        fromDate: sim.event.date,
        fromTime: sim.event.time,
        newDate: ui.simDate,
        newTime: ui.simTime,
        source: ui.simSource,
        note: ui.simNote,
        blocks: sim.blocks,
        createdAt: new Date().toISOString(),
      });
    });
    ui.simNote = "";
  };

  window.ccDeleteProposal = id => mutate(s => { s.proposals = s.proposals.filter(p => p.id !== id); });

  window.ccMarkReviewed = () => {
    const c = club();
    const ctx = compute(c);
    const s = loadStore(c);
    s.snapshot = CC.snapshotOf(ctx.all);
    s.snapshotAt = new Date().toISOString();
    saveStore(c, s);
    rerender();
  };

  window.ccSetConfig = (key, value) => mutate(s => {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) s.config[key] = n;
  });

  window.ccSetTravel = (encodedBase, value) => mutate(s => {
    const base = dec(encodedBase);
    const ov = { ...(s.config.travelOverrides || {}) };
    const n = Number(value);
    if (value === "" || !Number.isFinite(n)) delete ov[base]; else ov[base] = n;
    s.config.travelOverrides = ov;
  });

  window.ccTogglePlayer = (id, on) => mutate(s => {
    const set = new Set(s.overrides.disabledPlayers || []);
    if (on) set.delete(id); else set.add(id);
    s.overrides.disabledPlayers = [...set];
  });

  window.ccToggleFamily = (fam, on) => mutate(s => {
    const set = new Set(s.overrides.disabledFamilies || []);
    if (on) set.delete(fam); else set.add(fam);
    s.overrides.disabledFamilies = [...set];
  });

  window.ccAddLink = () => {
    const name = document.getElementById("cc-link-name")?.value.trim();
    const a = document.getElementById("cc-link-a")?.value;
    const b = document.getElementById("cc-link-b")?.value;
    if (!name || !a || !b || a === b) { alert("Posa el nom i dos equips diferents."); return; }
    mutate(s => { s.overrides.extraLinks = [...(s.overrides.extraLinks || []), { name, teams: [a, b] }]; });
  };

  window.ccRemoveLink = i => mutate(s => { s.overrides.extraLinks = (s.overrides.extraLinks || []).filter((_, j) => j !== i); });
})();
