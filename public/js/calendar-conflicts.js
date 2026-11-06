/* ══════════════════════════════════════════════════════════════════════
 * Panell coordinador · Calendari i conflictes
 *
 *  Setmana     · partits del club de la setmana, amb conflictes i detall de partit
 *  Conflictes  · tots els conflictes dels propers partits
 *  Pista       · parrilla del pavelló per cap de setmana (lliure / ocupada / bloquejada)
 *  Persones    · base de dades de persones (jugadors, entrenadors, delegats) + agenda
 *  Simulador   · impacte d'un canvi, franges lliures i propostes pendents
 *  Canvis      · avisos de canvis detectats a jok.cat pel job nocturn
 *  Configuració· regles, equips (nom curt, rotació de porters), parrilla, trajectes, germans
 *
 * Lògica a calendar-conflicts-core.js (window.CalendarConflicts).
 * Dades compartides a Supabase (taula club_calendar_data); si no existeix, localStorage.
 * ══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const CC = window.CalendarConflicts;
  const ROSTERS_URL = "./team-rosters.json";
  const CHANGES_URL = "./club-changes.json";
  const FEP_URL = "./fep-data.json";
  const TABLE = "club_calendar_data";
  const LOCAL_PREFIX = "hoquei_cc_v2::";
  const LEGACY_PREFIX = "hoquei_cc_v1::";
  const SEEN_KEY = "hoquei_cc_changes_seen_v1";

  const ui = {
    view: "setmana",
    weekOffset: 0,
    pistaOffset: 0,
    openEvent: "",
    severityFilter: "all",
    showProposals: true,
    personQuery: "",
    personFilter: "tots",
    personId: "",
    draft: null,
    extQuery: "",
    importPreview: null,
    blockForm: null,
    simEventKey: "",
    simDate: "",
    simTime: "",
    simSource: "telefon",
    simNote: "",
    simResult: null,
    simSlots: null,
    rosters: null,
    rostersState: "idle",
    changes: null,
    changesState: "idle",
    fep: null,
    fepState: "idle",
    toast: "",
  };

  const store = { club: "", mode: "idle", rows: new Map(), error: "", loading: null };

  // ── Utilitats ─────────────────────────────────────────────────────
  const h = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const enc = s => encodeURIComponent(String(s ?? "")).replace(/'/g, "%27");
  const dec = s => decodeURIComponent(String(s ?? ""));
  const DOW = { dl: "Dilluns", dt: "Dimarts", dc: "Dimecres", dj: "Dijous", dv: "Divendres", ds: "Dissabte", dg: "Diumenge" };
  const ROLE_ICON = { juga: "🏒", entrena: "📋", ajuda: "🤝" };
  const ROLE_LABEL = { juga: "Juga", entrena: "Entrena", ajuda: "Ajudant/delegat" };
  const CAT_ORDER = ["Prebenjamí", "Benjamí", "Aleví", "Infantil", "Juvenil", "Júnior", "Fem", "3ª Catalana", "2ª Catalana", "1ª Catalana", "Nacional Catalana", "Veterans", "Altres"];

  function dayLabel(dayKey, short = false) {
    const p = CC.parseDate(dayKey);
    if (!p) return dayKey;
    const wd = CC.weekdayOf(dayKey);
    return short ? `${wd} ${p.d}/${p.mo}` : `${DOW[wd]} ${p.d}/${p.mo}`;
  }

  function todayKey() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }

  function weekRange(offset) {
    const t = todayKey();
    const wd = CC.weekdayOf(t);
    const idx = CC.WEEKDAYS.indexOf(wd);
    const monday = CC.addDays(t, (idx === 0 ? -6 : 1 - idx) + offset * 7);
    return [0, 1, 2, 3, 4, 5, 6].map(i => CC.addDays(monday, i));
  }

  function title(name) {
    return String(name || "").toLowerCase().replace(/(^|[\s'-])\S/g, c => c.toUpperCase());
  }

  function slug(s) { return CC.norm(s).replace(/ /g, "-"); }

  function club() { return (typeof loadCoordinatorFavorite === "function" ? loadCoordinatorFavorite()?.clubName : "") || ""; }
  function rerender() { if (typeof renderCoordinatorPanel === "function") renderCoordinatorPanel(); }

  function toast(msg) {
    ui.toast = msg;
    rerender();
    setTimeout(() => { if (ui.toast === msg) { ui.toast = ""; rerender(); } }, 3500);
  }

  // ── Emmagatzematge (Supabase amb fallback local) ──────────────────
  function rowsList() {
    const out = [];
    for (const [kind, m] of store.rows) for (const [item_id, data] of m) out.push({ kind, item_id, data });
    return out;
  }

  function rowsOf(kind) { return store.rows.get(kind) || new Map(); }
  function getRow(kind, id) { return rowsOf(kind).get(id) || null; }

  function setLocal(kind, id, data) {
    store.rev = (store.rev || 0) + 1;
    if (!store.rows.has(kind)) store.rows.set(kind, new Map());
    if (data == null) store.rows.get(kind).delete(id); else store.rows.get(kind).set(id, data);
  }

  function saveLocalAll() {
    try { localStorage.setItem(LOCAL_PREFIX + store.club, JSON.stringify(rowsList())); } catch { /* sense espai o privat */ }
  }

  function loadLocalAll(clubName) {
    try {
      const raw = localStorage.getItem(LOCAL_PREFIX + clubName);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  /** Dades de la versió anterior (només localStorage): propostes i configuració. */
  function legacyRows(clubName) {
    try {
      const raw = localStorage.getItem(LEGACY_PREFIX + clubName);
      if (!raw) return [];
      const s = JSON.parse(raw);
      const out = [];
      const cfg = { ...(s.config || {}) };
      if (s.overrides?.disabledFamilies?.length) cfg.disabledFamilies = s.overrides.disabledFamilies.map(f => `s:${f}`);
      if (Object.keys(cfg).length) out.push({ kind: "config", item_id: "main", data: cfg });
      for (const p of s.proposals || []) if (p?.id) out.push({ kind: "proposal", item_id: p.id, data: p });
      for (const [i, l] of (s.overrides?.extraLinks || []).entries()) {
        out.push({ kind: "person", item_id: `p_legacy${i}`, data: { name: l.name, teams: (l.teams || []).map(key => ({ key, role: "juga" })) } });
      }
      return out;
    } catch { return []; }
  }

  function ensureStore(clubName) {
    if (store.club === clubName && store.mode !== "idle") return;
    store.club = clubName;
    store.mode = "loading";
    store.rows = new Map();
    store.error = "";
    for (const r of loadLocalAll(clubName)) setLocal(r.kind, r.item_id, r.data);
    store.loading = (async () => {
      const sb = typeof _csb === "function" ? _csb() : null;
      if (!sb) { store.mode = "local"; store.error = "Sense sessió de Supabase"; return; }
      const { data, error } = await sb.from(TABLE).select("kind,item_id,data").eq("club_name", clubName);
      if (error) {
        store.mode = "local";
        store.error = /does not exist|relation|schema cache|PGRST205|42P01/i.test(`${error.code} ${error.message}`)
          ? "missing-table" : (error.message || "error");
        if (!store.rows.size) for (const r of legacyRows(clubName)) setLocal(r.kind, r.item_id, r.data);
        return;
      }
      store.mode = "remote";
      store.rows = new Map();
      store.rev = (store.rev || 0) + 1;
      for (const r of data || []) setLocal(r.kind, r.item_id, r.data);
      // Primera vegada: puja el que hi hagi en local (versió anterior o mode local).
      if (!(data || []).length) {
        const pending = loadLocalAll(clubName).concat(legacyRows(clubName));
        if (pending.length) {
          const payload = pending.map(r => ({ club_name: clubName, kind: r.kind, item_id: r.item_id, data: r.data }));
          const up = await sb.from(TABLE).upsert(payload, { onConflict: "club_name,kind,item_id" });
          if (!up.error) for (const r of pending) setLocal(r.kind, r.item_id, r.data);
        }
      }
    })().catch(err => { store.mode = "local"; store.error = err?.message || "error"; })
      .finally(() => { store.loading = null; saveLocalAll(); rerender(); });
  }

  async function putRows(items) {
    for (const { kind, id, data } of items) setLocal(kind, id, data);
    saveLocalAll();
    rerender();
    if (store.mode !== "remote") return true;
    const sb = _csb();
    const ups = items.filter(i => i.data != null).map(i => ({ club_name: store.club, kind: i.kind, item_id: i.id, data: i.data }));
    const dels = items.filter(i => i.data == null);
    let err = null;
    if (ups.length) {
      const r = await sb.from(TABLE).upsert(ups, { onConflict: "club_name,kind,item_id" });
      err = r.error || err;
    }
    for (const d of dels) {
      const r = await sb.from(TABLE).delete().eq("club_name", store.club).eq("kind", d.kind).eq("item_id", d.id);
      err = r.error || err;
    }
    if (err) toast(`⚠️ No s'ha pogut desar a Supabase: ${err.message}`);
    return !err;
  }

  const putRow = (kind, id, data) => putRows([{ kind, id, data }]);
  const delRow = (kind, id) => putRows([{ kind, id, data: null }]);

  function config() { return getRow("config", "main") || {}; }
  function saveConfig(patch) { return putRow("config", "main", { ...config(), ...patch }); }

  // ── Dades estàtiques ──────────────────────────────────────────────
  function ensureRosters() {
    if (ui.rostersState !== "idle") return;
    ui.rostersState = "loading";
    fetch(ROSTERS_URL + "?t=" + Date.now())
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then(json => { ui.rosters = json; ui.rostersState = "ok"; })
      .catch(() => { ui.rosters = { teams: {}, players: {} }; ui.rostersState = "error"; })
      .finally(rerender);
  }

  function ensureChanges() {
    if (ui.changesState !== "idle") return;
    ui.changesState = "loading";
    fetch(CHANGES_URL + "?t=" + Date.now())
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then(json => { ui.changes = json; ui.changesState = "ok"; })
      .catch(() => { ui.changes = { entries: [] }; ui.changesState = "error"; })
      .finally(rerender);
  }

  function ensureFep() {
    if (ui.fepState !== "idle") return;
    ui.fepState = "loading";
    fetch(FEP_URL + "?t=" + Date.now())
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then(json => { ui.fep = json; ui.fepState = "ok"; })
      .catch(() => { ui.fep = null; ui.fepState = "error"; })
      .finally(rerender);
  }

  /** data.json + competicions de la RFEP (OK Liga) en un sol objecte. */
  let dbAllCache = { db: null, fep: null, value: null };
  function dbAll() {
    if (!ui.fep?.categories) return DB;
    if (dbAllCache.db === DB && dbAllCache.fep === ui.fep) return dbAllCache.value;
    const value = { ...DB, categories: { ...(DB?.categories || {}), ...ui.fep.categories } };
    dbAllCache = { db: DB, fep: ui.fep, value };
    return value;
  }

  function clubMatcher(clubName) {
    const teams = typeof getCoordinatorClubTeams === "function" ? getCoordinatorClubTeams(clubName) : [];
    const strict = new Set(teams.map(t => normalizeTeamNameStrict(t?.teamName || "")).filter(Boolean));
    const exact = new Set(teams.map(t => CC.norm(t?.teamName || "")).filter(Boolean));
    return name => exact.has(CC.norm(name)) || strict.has(normalizeTeamNameStrict(name || ""));
  }

  // ── Model ─────────────────────────────────────────────────────────
  let modelCache = { sig: "", value: null };

  function compute(clubName) {
    const sig = [clubName, DB?.updatedAt, ui.rostersState, ui.fepState, store.mode, ui.showProposals, todayKey(), store.rev || 0].join("|");
    if (modelCache.sig === sig) return modelCache.value;
    const model = CC.buildModel({
      db: dbAll(), rosters: ui.rosters || { teams: {}, players: {} }, records: rowsList(),
      venues: venuesDB?.venues || {}, isClubTeam: clubMatcher(clubName),
    });
    const today = todayKey();
    const proposals = [...rowsOf("proposal").values()];
    const upcomingRaw = model.events.filter(e => e.dayKey >= today);
    const applied = CC.applyProposals(upcomingRaw, proposals);
    const upcoming = ui.showProposals ? applied.events : upcomingRaw;
    const conflicts = CC.detectConflicts(upcoming, model);
    const clubTeams = model.clubTeamKeys.map(key => {
      const ev = model.events.find(e => e.teamKey === key);
      return { key, ev, label: teamLabelFor(key, model, ev) };
    }).sort((a, b) => (CAT_ORDER.indexOf(a.ev.category) - CAT_ORDER.indexOf(b.ev.category)) || a.label.localeCompare(b.label));
    const value = { model, upcoming, upcomingRaw, conflicts, proposals, proposalStatus: applied.status, clubTeams };
    modelCache = { sig, value };
    return value;
  }

  function invalidate() { store.rev = (store.rev || 0) + 1; }

  function defaultTeamLabel(ev) {
    if (!ev) return "";
    if (ev.manual) return ev.team;
    if (!ev.own) return `${ev.team} · ${ev.compName.replace(/\s*\(\d{4}-\d{2}\)\s*$/, "")}`;
    const letter = (String(ev.team).match(/\s([A-H])$/) || [])[1];
    const level = /INICIACI/i.test(ev.compName) ? " Iniciació" : "";
    const cat = ev.category === "Fem" ? "Femení" : ev.category;
    return `${cat}${letter ? " " + letter : ""}${level}`;
  }

  function teamLabelFor(key, model, ev) {
    const alias = model.teamNames?.[key];
    if (alias) return alias;
    return defaultTeamLabel(ev || model.events.find(e => e.teamKey === key)) || String(key).split("|").slice(1).join("|");
  }

  function evLabel(ev, ctx) { return teamLabelFor(ev.teamKey, ctx.model, ev); }

  function coachesOf(teamKey, model) {
    return model.people.filter(p => !p.disabled && p.teams.some(t => t.key === teamKey && t.role === "entrena"));
  }

  // ── Render principal ──────────────────────────────────────────────
  window.renderCoordinatorCalendarTab = function (currentFav) {
    if (!CC) return `<div style="padding:14px;color:#b91c1c">No s'ha carregat el motor de conflictes.</div>`;
    if (!currentFav?.clubName) {
      return `<div style="background:#fff;border:1.5px dashed #cbd5e1;border-radius:14px;padding:18px;color:#64748b;font-size:14px">Tria primer el club a <b>Gestió club</b>.</div>`;
    }
    ensureStore(currentFav.clubName);
    ensureRosters();
    ensureChanges();
    ensureFep();
    const ctx = compute(currentFav.clubName);

    const unseen = unseenChanges(ctx);
    const nav = [
      ["setmana", "Setmana"],
      ["conflictes", `Conflictes${badge(ctx.conflicts.filter(c => c.severity === "block").length, "#dc2626")}`],
      ["pista", "Pista"],
      ["persones", "Persones"],
      ["simulador", "Simulador"],
      ["canvis", `Canvis${badge(unseen, "#f59e0b")}`],
      ["config", "Configuració"],
    ];
    const pills = `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px;-webkit-overflow-scrolling:touch">${nav.map(([k, label]) => {
      const on = ui.view === k;
      return `<button onclick="ccSetView('${k}')" style="flex:0 0 auto;background:${on ? "#7c3aed" : "#fff"};border:1.5px solid ${on ? "#7c3aed" : "#dbe3f0"};color:${on ? "#fff" : "#334155"};font-weight:700;font-size:13px;padding:8px 12px;border-radius:999px;cursor:pointer;white-space:nowrap">${label}</button>`;
    }).join("")}</div>`;

    let banner = "";
    if (store.mode === "loading") banner = note("Carregant dades del club…", "#64748b", "#f8fafc", "#e2e6ef");
    else if (store.mode === "local" && store.error === "missing-table") banner = note("Falta la taula a Supabase: executa <b>supabase/20261027_club_calendar_data.sql</b> a l'editor SQL. Mentrestant, el que desis queda només en aquest dispositiu.", "#9a3412", "#fff7ed", "#fdba74");
    else if (store.mode === "local") banner = note(`Mode local (${h(store.error)}): el que desis queda només en aquest dispositiu.`, "#9a3412", "#fff7ed", "#fdba74");
    if (ui.rostersState === "error") banner += note("No s'ha trobat <b>team-rosters.json</b>: només es veuen les persones amb fitxa fins al pròxim scraper.", "#9a3412", "#fff7ed", "#fdba74");
    const toastHtml = ui.toast ? `<div style="position:sticky;top:8px;z-index:5;background:#1a2035;color:#fff;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:10px">${h(ui.toast)}</div>` : "";

    let body;
    try {
      body = ({
        conflictes: renderConflictsView, pista: renderPistaView, persones: renderPeopleView,
        simulador: renderSimulatorView, canvis: renderChangesView, config: renderConfigView,
      }[ui.view] || renderWeekView)(ctx);
    } catch (err) {
      console.error("[calendari]", err);
      body = note(`Error mostrant aquesta vista: ${h(err.message)}`, "#b91c1c", "#fef2f2", "#fecaca");
    }
    return `${toastHtml}${pills}${banner}${body}`;
  };

  function badge(n, color) {
    return n ? ` <span style="background:${color};color:#fff;border-radius:999px;padding:1px 7px;font-size:11px;margin-left:4px">${n}</span>` : "";
  }

  function note(html, color, bg, border) {
    return `<div style="background:${bg};border:1px solid ${border};color:${color};border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.45;margin-bottom:12px">${html}</div>`;
  }

  function card(inner, extra = "") {
    return `<div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:14px;padding:14px;margin-bottom:12px;${extra}">${inner}</div>`;
  }

  function sectionTitle(text, right = "") {
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap"><div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;color:#1a2035;letter-spacing:.05em">${text}</div>${right}</div>`;
  }

  function btn(primary = false) {
    return primary
      ? "background:#7c3aed;border:none;color:#fff;font-weight:700;font-size:12.5px;padding:7px 11px;border-radius:8px;cursor:pointer"
      : "background:#fff;border:1px solid #cbd5e1;color:#334155;font-weight:600;font-size:12.5px;padding:7px 11px;border-radius:8px;cursor:pointer";
  }

  const INPUT = "width:100%;padding:9px 11px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:15px;background:#fff;font-family:inherit";

  function navBtn() {
    return "background:#fff;border:1.5px solid #dbe3f0;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer;font-size:14px";
  }

  function stat(value, label, color) {
    return `<div style="background:#fff;border:1.5px solid #e2e6ef;border-radius:12px;padding:10px;text-align:center"><div style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:${color};line-height:1">${value}</div><div style="font-size:11px;color:#64748b;margin-top:3px">${label}</div></div>`;
  }

  function chip(text, color = "#475569", bg = "#f1f5f9") {
    return `<span style="display:inline-block;background:${bg};color:${color};border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700;white-space:nowrap">${text}</span>`;
  }

  // ── Setmana ───────────────────────────────────────────────────────
  function renderWeekView(ctx) {
    const days = weekRange(ui.weekOffset);
    const past = ui.weekOffset < 0;
    const source = past ? ctx.model.events : ctx.upcoming;
    const inWeek = source.filter(e => e.own && days.includes(e.dayKey));
    const conflicts = past
      ? CC.detectConflicts(ctx.model.events.filter(e => days.includes(e.dayKey)), ctx.model)
      : ctx.conflicts.filter(c => days.includes(c.a.dayKey));
    const sev = severityMap(conflicts);
    const blocks = conflicts.filter(c => c.severity === "block").length;
    const warns = conflicts.length - blocks;
    const homeCount = new Set(inWeek.filter(e => e.isHome).map(e => e.matchKey)).size;

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
        ${stat(blocks || (warns ? 0 : "✓"), blocks ? "bloquejos" : warns ? `bloquejos · ${warns} avisos` : "sense conflictes", blocks ? "#dc2626" : "#16a34a")}
      </div>`;

    const pending = ctx.proposals.filter(p => ctx.proposalStatus[p.id] === "pendent").length;
    const toggle = pending
      ? `<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#334155;margin-bottom:10px"><input type="checkbox" ${ui.showProposals ? "checked" : ""} onchange="ccToggleProposals(this.checked)"/> Mostrar propostes pendents (${pending})</label>`
      : "";

    if (!inWeek.length) return header + toggle + card(`<div style="color:#64748b;font-size:14px">Cap partit aquesta setmana.</div>`);

    const byDay = days.map(d => [d, inWeek.filter(e => e.dayKey === d).sort((a, b) => (a.start ?? 0) - (b.start ?? 0))]).filter(([, l]) => l.length);
    return header + toggle + byDay.map(([d, list]) => {
      const dayConf = conflicts.filter(c => c.a.dayKey === d);
      const shownConf = dayConf.filter(c => !(ui.openEvent && (c.a.key === ui.openEvent || c.b.key === ui.openEvent)));
      return card(`
        ${sectionTitle(dayLabel(d), `<span style="font-size:12px;color:#64748b">${list.filter(e => e.isHome).length} a casa · ${list.filter(e => !e.isHome).length} fora</span>`)}
        ${list.map(ev => eventRow(ev, sev.get(ev.key), ctx) + (ui.openEvent === ev.key ? eventDetail(ev, ctx, conflicts) : "")).join("")}
        ${shownConf.length ? `<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">${shownConf.map(c => conflictLine(c, ctx, false, true)).join("")}</div><div style="font-size:11px;color:#94a3b8;margin-top:6px">Toca un partit per veure'n el detall, assignar porter o simular un canvi.</div>` : ""}
      `);
    }).join("");
  }

  function severityMap(conflicts) {
    const sev = new Map();
    for (const c of conflicts) for (const k of [c.a.key, c.b.key]) if (c.severity === "block" || !sev.has(k)) sev.set(k, c.severity);
    return sev;
  }

  function travelFromHome(ev, ctx) {
    if (ev.isHome) return null;
    return CC.travelBetween({ isHome: true, venueTeam: "" }, ev, ctx.model.resolve, ctx.model.cfg);
  }

  function eventRow(ev, severity, ctx) {
    const open = ui.openEvent === ev.key;
    const border = severity === "block" ? "#dc2626" : severity === "warn" ? "#f59e0b" : open ? "#7c3aed" : "#e2e6ef";
    const bg = severity === "block" ? "#fef2f2" : severity === "warn" ? "#fffbeb" : "#fff";
    const where = ev.isHome ? chip("CASA", "#1d4ed8", "#dbeafe") : chip("FORA");
    const pending = ev.proposalId ? `<div style="font-size:11px;color:#7c3aed;font-weight:700;margin-top:2px">⏳ Proposta: abans ${h(ev.original?.date)} ${h(ev.original?.time)}</div>` : "";
    const tr = travelFromHome(ev, ctx);
    const coaches = coachesOf(ev.teamKey, ctx.model).map(p => title(p.name.split(" ").slice(0, 2).join(" ")));
    const porter = annotationFor(ev.key, "porter");
    const extra = [
      coaches.length ? `📋 ${h(coaches.join(", "))}` : "",
      porter?.personIds?.length ? `🧤 ${h(porter.personIds.map(id => personName(id, ctx)).join(", "))}` : "",
    ].filter(Boolean).join(" · ");
    return `<button onclick="ccToggleEvent('${enc(ev.key)}')" style="width:100%;text-align:left;display:flex;gap:10px;align-items:flex-start;background:${bg};border:1.5px solid ${border};border-radius:10px;padding:9px 10px;margin-bottom:6px;cursor:pointer">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:800;min-width:46px;color:#1a2035">${h(ev.time || "--:--")}</div>
      <div style="min-width:0;flex:1">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span style="font-weight:700;font-size:14px;color:#1a2035">${h(evLabel(ev, ctx))}</span>${where}</div>
        <div style="font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">vs ${h(ev.opponent)}${ev.isHome ? "" : ` · a ${h(ev.venueTeam)}${tr ? ` · ${tr.minutes} min${tr.estimated ? "?" : ""}` : ""}`}</div>
        ${extra ? `<div style="font-size:12px;color:#334155;margin-top:2px">${extra}</div>` : ""}
        ${pending}
      </div>
    </button>`;
  }

  function personName(id, ctx) {
    const p = ctx.model.peopleById.get(id);
    return p ? title(p.name.split(" ").slice(0, 2).join(" ")) : id;
  }

  function annotationFor(eventKey, type) { return getRow("annotation", `${eventKey}::${type}`); }

  function eventDetail(ev, ctx, conflicts) {
    const mine = conflicts.filter(c => c.a.key === ev.key || c.b.key === ev.key);
    const rotation = !!config().rotation?.[ev.teamKey];
    const members = ctx.model.people.filter(p => p.teams.some(t => t.key === ev.teamKey && t.role === "juga"));
    const porters = members.filter(p => p.porter);
    const porterPool = (porters.length ? porters : members).sort((a, b) => a.name.localeCompare(b.name));
    const porter = annotationFor(ev.key, "porter");
    const reforc = annotationFor(ev.key, "reforc");
    const others = ctx.model.people.filter(p => !p.disabled && !p.teams.some(t => t.key === ev.teamKey)).sort((a, b) => a.name.localeCompare(b.name));

    const porterUi = rotation ? `
      <div style="margin-top:10px">
        <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:4px">🧤 Porter d'aquest partit</div>
        <select onchange="ccSetPorter('${enc(ev.key)}', this.value)" style="${INPUT}">
          <option value="">— Sense assignar —</option>
          ${porterPool.map(p => `<option value="${h(p.id)}" ${porter?.personIds?.[0] === p.id ? "selected" : ""}>${h(title(p.name))} (${rotationCount(ev.teamKey, p.id, ctx)})</option>`).join("")}
        </select>
        <div style="font-size:11px;color:#94a3b8;margin-top:3px">Entre parèntesis, partits que ja té assignats aquesta temporada.</div>
      </div>` : "";

    const reforcIds = reforc?.personIds || [];
    const reforcUi = `
      <div style="margin-top:10px">
        <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:4px">➕ Reforços convocats</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${reforcIds.map(id => `<span style="display:inline-flex;gap:6px;align-items:center;background:#ede9fe;color:#5b21b6;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700">${h(personName(id, ctx))}<button onclick="ccRemoveReforc('${enc(ev.key)}','${enc(id)}')" style="border:none;background:none;color:#5b21b6;cursor:pointer;font-weight:900">×</button></span>`).join("") || `<span style="font-size:12px;color:#94a3b8">Cap</span>`}</div>
        <select onchange="ccAddReforc('${enc(ev.key)}', this.value)" style="${INPUT}">
          <option value="">Afegir reforç…</option>
          ${others.map(p => `<option value="${h(p.id)}">${h(title(p.name))}${p.teams.length ? ` · ${h(p.teams.map(t => teamLabelFor(t.key, ctx.model)).join(", "))}` : ""}</option>`).join("")}
        </select>
      </div>`;

    return `<div style="border:1.5px solid #7c3aed;border-top:none;border-radius:0 0 10px 10px;margin:-8px 0 8px;padding:12px 10px 10px;background:#faf5ff">
      <div style="font-size:12px;color:#64748b">${h(ev.compName)} · J${h(ev.jornada ?? "-")} · ${h(ev.home)} – ${h(ev.away)}</div>
      ${mine.length ? `<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">${mine.map(c => conflictLine(c, ctx, false, true)).join("")}</div>` : `<div style="font-size:13px;color:#16a34a;font-weight:700;margin-top:8px">✓ Sense conflictes</div>`}
      ${porterUi}
      ${reforcUi}
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button onclick="ccOpenSim('${enc(ev.key)}')" style="${btn(true)}">Simular canvi d'hora</button>
        ${!rotation && ev.own ? `<button onclick="ccSetRotation('${enc(ev.teamKey)}', true)" style="${btn()}">Activar rotació de porters</button>` : ""}
      </div>
    </div>`;
  }

  function rotationCount(teamKey, personId, ctx) {
    let n = 0;
    for (const [id, a] of rowsOf("annotation")) {
      if (!id.endsWith("::porter") || !(a.personIds || []).includes(personId)) continue;
      if (ctx.model.events.some(e => e.key === a.eventKey && e.teamKey === teamKey)) n++;
    }
    return n;
  }

  function roleText(roles) {
    return roles?.length === 2 ? `${ROLE_LABEL[roles[0]] || roles[0]} ↔ ${ROLE_LABEL[roles[1]] || roles[1]}`.toLowerCase() : "";
  }

  function conflictLine(c, ctx, withDate, compact = false) {
    const icon = c.severity === "block" ? "⛔" : "⚠️";
    const color = c.severity === "block" ? "#b91c1c" : "#92400e";
    const bg = c.severity === "block" ? "#fef2f2" : "#fffbeb";
    const kind = { pista: "Pista", "pista-bloquejada": "Pista bloquejada", persona: hasCoach(c) ? "Entrenador" : "Jugadors", germans: "Germans" }[c.type] || c.type;
    const who = c.people?.length
      ? `<div style="font-size:12px;color:#334155;margin-top:3px">👤 ${c.people.map(p => `${h(title(p.name))}${p.roles?.length ? ` <span style="color:#64748b">(${h(roleText(p.roles))})</span>` : ""}`).join(", ")}</div>`
      : "";
    const date = withDate ? `${dayLabel(c.a.dayKey, true)} · ` : "";
    const lbl = ev => `${h(ev.time)} ${h(evLabel(ev, ctx))} ${ev.manual ? "" : ev.isHome ? "(casa)" : "(fora)"}`;
    const pair = c.a.key === c.b.key ? lbl(c.a) : `${lbl(c.a)} ↔ ${lbl(c.b)}`;
    const simBtns = compact ? "" : `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
        ${[c.b, c.a].filter((e, i, arr) => e.own && arr.findIndex(x => x.key === e.key) === i).map(e => `<button onclick="ccOpenSim('${enc(e.key)}')" style="${btn()}">Simular moure ${h(evLabel(e, ctx))}</button>`).join("")}
      </div>`;
    return `<div style="background:${bg};border-radius:10px;padding:8px 10px;font-size:13px;color:${color}">
      <div><b>${icon} ${kind}</b> · ${date}${pair}</div>
      <div style="font-size:12px;margin-top:2px">${h(c.message)}</div>
      ${who}
      ${simBtns}
    </div>`;
  }

  function hasCoach(c) { return (c.people || []).some(p => (p.roles || []).includes("entrena")); }

  // ── Conflictes ────────────────────────────────────────────────────
  function renderConflictsView(ctx) {
    const list = ctx.conflicts.filter(c => ui.severityFilter === "all" || c.severity === ui.severityFilter || (ui.severityFilter === "entrenador" && hasCoach(c)));
    const filters = [["all", "Tots"], ["block", "Bloquejos"], ["warn", "Avisos"], ["entrenador", "Entrenadors"]].map(([k, l]) =>
      `<button onclick="ccSeverity('${k}')" style="${btn(ui.severityFilter === k)}">${l}</button>`).join("");
    const head = card(sectionTitle(`Conflictes (${list.length})`, `<div style="display:flex;gap:6px;flex-wrap:wrap">${filters}</div>`)
      + `<div style="font-size:12px;color:#64748b">Bloqueig = no es pot jugar així. Avís = germans, ajudants o marge molt just.</div>`);
    if (!list.length) return head + card(`<div style="color:#16a34a;font-weight:700">✓ Cap conflicte als propers partits.</div>`);
    const byDay = new Map();
    for (const c of list) {
      if (!byDay.has(c.a.dayKey)) byDay.set(c.a.dayKey, []);
      byDay.get(c.a.dayKey).push(c);
    }
    return head + [...byDay.entries()].map(([d, cs]) => card(sectionTitle(dayLabel(d)) + `<div style="display:flex;flex-direction:column;gap:6px">${cs.map(c => conflictLine(c, ctx, false)).join("")}</div>`)).join("");
  }

  // ── Pista ─────────────────────────────────────────────────────────
  function renderPistaView(ctx) {
    const days = weekRange(ui.pistaOffset);
    const weekend = days.slice(5); // ds, dg
    const events = ctx.upcoming.concat(ctx.model.events.filter(e => e.dayKey < todayKey()));
    const header = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        <button onclick="ccPistaWeek(-1)" style="${navBtn()}">←</button>
        <div style="flex:1;text-align:center;font-weight:700;font-size:14px">Cap de setmana ${dayLabel(weekend[0], true)} – ${dayLabel(weekend[1], true)}</div>
        <button onclick="ccPistaWeek(1)" style="${navBtn()}">→</button>
        ${ui.pistaOffset ? `<button onclick="ccPistaWeek(0)" style="${navBtn()}">Avui</button>` : ""}
      </div>`;
    const dayCards = weekend.map(d => {
      const pd = CC.pistaDay(events, ctx.model, d);
      const total = pd.slots.length;
      const sum = total ? `${total - pd.free}/${total} franges ocupades` : "Sense franges habituals";
      return card(sectionTitle(dayLabel(d), `<span style="font-size:12px;color:${pd.free ? "#16a34a" : "#b91c1c"};font-weight:700">${sum}</span>`)
        + pd.slots.map(s => slotRow(s, d, ctx)).join("")
        + (pd.offGrid.length ? `<div style="font-size:12px;font-weight:700;color:#64748b;margin:10px 0 6px;text-transform:uppercase;letter-spacing:.04em">Fora de franja habitual</div>${pd.offGrid.map(ev => slotEventRow(ev, ctx, "#f59e0b")).join("")}` : "")
        + pd.blocks.filter(b => !pd.slots.some(s => s.block?.id === b.id)).map(b => blockRow(b)).join("")
        + blockFormHtml(d));
    }).join("");
    return header + dayCards + renderWeekendSummary(ctx);
  }

  function slotRow(s, dayKey, ctx) {
    const color = { lliure: "#16a34a", ocupada: "#1d4ed8", doble: "#dc2626", bloquejada: "#64748b", trepitjada: "#b45309" }[s.status];
    const bg = { lliure: "#f0fdf4", ocupada: "#eff6ff", doble: "#fef2f2", bloquejada: "#f1f5f9", trepitjada: "#fffbeb" }[s.status];
    const label = { lliure: "Lliure", ocupada: "", doble: "Solapament", bloquejada: "Bloquejada", trepitjada: "No aprofitable" }[s.status];
    const content = s.events.length
      ? s.events.map(ev => `<div style="font-size:13px"><b>${h(evLabel(ev, ctx))}</b> <span style="color:#64748b">${ev.time !== s.time ? `(${h(ev.time)}) ` : ""}vs ${h(ev.opponent)}</span></div>`).join("")
      : s.status === "trepitjada" ? `<div style="font-size:12px;color:#92400e">La trepitja ${s.overlapping.map(ev => `${h(evLabel(ev, ctx))} (${h(ev.time)})`).join(", ")}</div>`
      : s.block ? `<div style="font-size:13px;color:#475569">${h(s.block.reason || "Bloquejada")} <span style="color:#94a3b8">${h(s.block.from)}–${h(s.block.to)}</span></div>` : "";
    const action = s.status === "lliure"
      ? `<button onclick="ccBlockForm('${dayKey}','${s.time}')" style="${btn()}">Bloquejar</button>`
      : s.status === "bloquejada" ? `<button onclick="ccUnblock('${enc(s.block.id)}')" style="${btn()}">Desbloquejar</button>` : "";
    return `<div style="display:flex;gap:10px;align-items:center;background:${bg};border-radius:10px;padding:8px 10px;margin-bottom:6px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:800;min-width:46px;color:#1a2035">${h(s.time)}</div>
      <div style="flex:1;min-width:0">${label ? `<div style="font-size:12px;font-weight:800;color:${color};text-transform:uppercase">${label}</div>` : ""}${content}</div>
      ${action}
    </div>`;
  }

  function slotEventRow(ev, ctx, color) {
    return `<div style="display:flex;gap:10px;align-items:center;background:#fffbeb;border-radius:10px;padding:8px 10px;margin-bottom:6px;border-left:3px solid ${color}">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:800;min-width:46px">${h(ev.time)}</div>
      <div style="font-size:13px;flex:1"><b>${h(evLabel(ev, ctx))}</b> <span style="color:#64748b">vs ${h(ev.opponent)}</span></div>
    </div>`;
  }

  function blockRow(b) {
    return `<div style="display:flex;gap:10px;align-items:center;background:#f1f5f9;border-radius:10px;padding:8px 10px;margin-bottom:6px">
      <div style="font-size:13px;flex:1">🚫 <b>${h(b.from)}–${h(b.to)}</b> ${h(b.reason || "")}</div>
      <button onclick="ccUnblock('${enc(b.id)}')" style="${btn()}">Treure</button>
    </div>`;
  }

  function blockFormHtml(dayKey) {
    const f = ui.blockForm;
    if (!f || f.dayKey !== dayKey) {
      return `<button onclick="ccBlockForm('${dayKey}','')" style="${btn()};margin-top:4px">+ Bloquejar una altra franja</button>`;
    }
    return `<div style="border:1.5px dashed #cbd5e1;border-radius:10px;padding:10px;margin-top:6px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <input type="time" value="${h(f.from)}" oninput="ccBlockField('from',this.value)" style="${INPUT}"/>
        <input type="time" value="${h(f.to)}" oninput="ccBlockField('to',this.value)" style="${INPUT}"/>
      </div>
      <input value="${h(f.reason)}" oninput="ccBlockField('reason',this.value)" placeholder="Motiu (escola, cessió, torneig…)" style="${INPUT};margin-top:6px"/>
      <div style="display:flex;gap:6px;margin-top:6px"><button onclick="ccSaveBlock()" style="${btn(true)}">Bloquejar</button><button onclick="ccBlockForm('','')" style="${btn()}">Cancel·lar</button></div>
    </div>`;
  }

  function renderWeekendSummary(ctx) {
    const weekends = new Map();
    for (const ev of ctx.upcoming) {
      if (!ev.isHome || !ev.own) continue;
      const sat = CC.weekendDays(ev.dayKey)[0];
      if (!weekends.has(sat)) weekends.set(sat, new Set());
      weekends.get(sat).add(ev.matchKey);
    }
    const rows = [...weekends.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 12).map(([sat, set]) => {
      const sun = CC.addDays(sat, 1);
      const free = [sat, sun].reduce((n, d) => n + CC.pistaDay(ctx.upcoming, ctx.model, d).free, 0);
      const offset = weekOffsetOf(sat);
      return `<button onclick="ccPistaWeek(${offset},true)" style="width:100%;display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #e2e6ef;border-radius:10px;padding:8px 10px;margin-bottom:5px;cursor:pointer;font-size:13px">
        <span><b>${dayLabel(sat, true)} – ${dayLabel(sun, true)}</b></span>
        <span>${set.size} a casa · <b style="color:${free ? "#16a34a" : "#b91c1c"}">${free} lliures</b></span>
      </button>`;
    }).join("");
    const grid = ctx.model.grid;
    const gridTxt = Object.entries(grid).sort((a, b) => CC.WEEKDAYS.indexOf(a[0]) - CC.WEEKDAYS.indexOf(b[0]))
      .map(([wd, ts]) => `<b>${DOW[wd]}:</b> ${ts.join(" · ")}`).join("<br>");
    return card(sectionTitle("Propers caps de setmana") + (rows || `<div style="font-size:13px;color:#64748b">No hi ha partits a casa programats.</div>`))
      + card(sectionTitle("Parrilla habitual", `<button onclick="ccSetView('config')" style="${btn()}">Editar</button>`)
        + `<div style="font-size:13px;line-height:1.7;color:#334155">${gridTxt || "Encara no hi ha prou partits per deduir-la."}</div>`
        + `<div style="font-size:11px;color:#94a3b8;margin-top:6px">${config().grid ? "Editada a mà." : "Deduïda dels partits a casa programats (hores que es repeteixen)."}</div>`);
  }

  function weekOffsetOf(dayKey) {
    const mon0 = weekRange(0)[0];
    const p0 = CC.parseDate(mon0), p1 = CC.parseDate(dayKey);
    const diff = Math.round((Date.UTC(p1.y, p1.mo - 1, p1.d) - Date.UTC(p0.y, p0.mo - 1, p0.d)) / 86400000);
    return Math.floor(diff / 7);
  }

  // ── Persones ──────────────────────────────────────────────────────
  function renderPeopleView(ctx) {
    if (ui.personId) return renderPersonDetail(ctx);
    if (ui.importPreview) return renderImportPreview(ctx);
    const q = CC.norm(ui.personQuery);
    const conflictPeople = new Map();
    for (const c of ctx.conflicts) for (const p of c.people || []) conflictPeople.set(p.id, (conflictPeople.get(p.id) || 0) + (c.severity === "block" ? 1 : 0));
    const filters = {
      tots: () => true,
      entrenadors: p => p.teams.some(t => t.role !== "juga"),
      doblen: p => p.teams.filter(t => t.role === "juga").length > 1,
      altres: p => p.teams.some(t => !ctx.model.clubTeamKeys.includes(t.key)) || (p.manualEvents || []).length,
      conflictes: p => conflictPeople.get(p.id) > 0,
    };
    const list = ctx.model.people.filter(filters[ui.personFilter] || filters.tots)
      .filter(p => !q || CC.norm(p.name).includes(q) || p.teams.some(t => CC.norm(teamLabelFor(t.key, ctx.model)).includes(q)));
    const fbtn = (k, l) => `<button onclick="ccPersonFilter('${k}')" style="${btn(ui.personFilter === k)}">${l}</button>`;
    const head = card(`
      ${sectionTitle(`Persones (${ctx.model.people.length})`, `<button onclick="ccNewPerson()" style="${btn(true)}">+ Nova</button>`)}
      <input value="${h(ui.personQuery)}" oninput="ccPersonQuery(this.value)" id="cc-person-q" placeholder="Cerca per nom o equip…" style="${INPUT};margin-bottom:8px"/>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${fbtn("tots", "Tots")}${fbtn("entrenadors", "Entrenadors")}${fbtn("doblen", "Doblen equip")}${fbtn("altres", "Altres clubs")}${fbtn("conflictes", "Amb bloquejos")}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9">
        <label style="${btn()};display:inline-block">📥 Importar Excel<input type="file" accept=".xlsx,.xls,.csv" onchange="ccImportFile(this)" style="display:none"/></label>
        <button onclick="ccExportPeople()" style="${btn()}">📤 Descarregar Excel</button>
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-top:6px">Els jugadors surten de les actes de jok.cat. Afegeix entrenadors, delegats i equips d'altres clubs amb una fitxa o important l'Excel.</div>
    `);
    const rows = list.slice(0, 200).map(p => {
      const nConf = conflictPeople.get(p.id) || 0;
      const teams = p.teams.map(t => `${ROLE_ICON[t.role] || ""} ${h(teamLabelFor(t.key, ctx.model))}`).join(" · ");
      const extra = [
        p.porter ? "🧤" : "",
        (p.manualEvents || []).length ? `🗓️ ${p.manualEvents.length}` : "",
        p.source !== "actes" ? chip("FITXA", "#5b21b6", "#ede9fe") : "",
        p.disabled ? chip("IGNORAT") : "",
        nConf ? chip(`⛔ ${nConf}`, "#b91c1c", "#fee2e2") : "",
      ].filter(Boolean).join(" ");
      return `<button onclick="ccOpenPerson('${enc(p.id)}')" style="width:100%;text-align:left;background:#fff;border:1px solid #e2e6ef;border-radius:10px;padding:9px 10px;margin-bottom:5px;cursor:pointer">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b style="font-size:14px;color:#1a2035">${h(title(p.name))}</b><span>${extra}</span></div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">${teams || "Sense equip"}</div>
      </button>`;
    }).join("");
    return head + card(rows || `<div style="font-size:13px;color:#64748b">Cap persona amb aquest filtre.</div>`) + (list.length > 200 ? `<div style="font-size:12px;color:#64748b">Mostrant 200 de ${list.length}.</div>` : "");
  }

  function draftFromPerson(p) {
    return {
      id: p.id,
      name: p.name,
      teams: p.teams.map(t => ({ key: t.key, role: t.role })),
      autoTeams: p.teams.filter(t => t.auto).map(t => t.key),
      family: p.family || "",
      familyAuto: p.familyKey?.startsWith("s:") ? p.familyKey.slice(2) : "",
      porter: !!p.porter,
      disabled: !!p.disabled,
      notes: p.notes || "",
      jokIds: p.jokIds || [],
      manualEvents: (p.manualEvents || []).map(e => ({ ...e })),
      hasRecord: !!getRow("person", p.id),
      linkedName: p.linkedName || "",
    };
  }

  function renderPersonDetail(ctx) {
    const d = ui.draft;
    if (!d) { ui.personId = ""; return renderPeopleView(ctx); }
    const p = ctx.model.peopleById.get(d.id);
    const teamOpts = sel => ctx.clubTeams.map(t => `<option value="${h(t.key)}" ${t.key === sel ? "selected" : ""}>${h(t.label)}</option>`).join("");
    const teamRows = d.teams.map((t, i) => {
      const isClub = ctx.model.clubTeamKeys.includes(t.key);
      return `<div style="display:grid;grid-template-columns:1fr 130px 34px;gap:6px;margin-bottom:6px;align-items:center">
        ${isClub ? `<select onchange="ccDraftTeam(${i},'key',this.value)" style="${INPUT}">${teamOpts(t.key)}</select>`
          : `<div style="font-size:13px;padding:8px 10px;border:1.5px solid #e2e6ef;border-radius:10px;background:#f8fafc">${h(teamLabelFor(t.key, ctx.model))}</div>`}
        <select onchange="ccDraftTeam(${i},'role',this.value)" style="${INPUT}">${Object.entries(ROLE_LABEL).map(([k, l]) => `<option value="${k}" ${t.role === k ? "selected" : ""}>${l}</option>`).join("")}</select>
        <button onclick="ccDraftRemoveTeam(${i})" style="${btn()};padding:7px 0">×</button>
      </div>`;
    }).join("");

    const extResults = ui.extQuery.trim().length >= 3 ? searchExternalTeams(ui.extQuery, ctx).slice(0, 8) : [];
    const manualRows = d.manualEvents.map((e, i) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;padding:8px;border:1px solid #e2e6ef;border-radius:10px">
        <input value="${h(e.title)}" oninput="ccDraftManual(${i},'title',this.value)" placeholder="Partit (p. ex. Cerdanyola – Alcobendas)" style="${INPUT};grid-column:1/3"/>
        <input type="date" value="${h(e.date)}" onchange="ccDraftManual(${i},'date',this.value)" style="${INPUT}"/>
        <input type="time" value="${h(e.time)}" onchange="ccDraftManual(${i},'time',this.value)" style="${INPUT}"/>
        <input value="${h(e.place)}" oninput="ccDraftManual(${i},'place',this.value)" placeholder="Pista (equip local)" style="${INPUT}"/>
        <button onclick="ccDraftRemoveManual(${i})" style="${btn()}">Treure</button>
      </div>`).join("");

    const form = card(`
      ${sectionTitle(d.hasRecord || p ? "Fitxa" : "Nova persona", `<button onclick="ccClosePerson()" style="${btn()}">← Tornar</button>`)}
      <label style="font-size:12px;color:#64748b;font-weight:600">Nom</label>
      <input value="${h(d.name)}" oninput="ccDraftField('name',this.value,true)" style="${INPUT};margin:4px 0 4px"/>
      ${d.linkedName ? `<div style="font-size:11px;color:#16a34a;margin-bottom:8px">✓ Vinculat a les actes: ${h(title(d.linkedName))}</div>` : `<div style="font-size:11px;color:#94a3b8;margin-bottom:8px">Si juga en algun equip del club, escriu nom i cognoms: es vincularà sol a les actes.</div>`}
      <div style="font-size:12px;color:#64748b;font-weight:600;margin:8px 0 6px">Equips</div>
      ${teamRows || `<div style="font-size:13px;color:#94a3b8;margin-bottom:6px">Cap equip.</div>`}
      <button onclick="ccDraftAddTeam()" style="${btn()}">+ Equip del club</button>
      <div style="margin-top:10px">
        <input value="${h(ui.extQuery)}" oninput="ccExtQuery(this.value)" id="cc-ext-q" placeholder="+ Equip d'un altre club (cerca: sant cugat fem 19…)" style="${INPUT}"/>
        ${extResults.map(r => `<button onclick="ccDraftAddExternal('${enc(r.key)}')" style="width:100%;text-align:left;background:#f8fafc;border:1px solid #e2e6ef;border-radius:8px;padding:7px 9px;margin-top:4px;cursor:pointer;font-size:13px"><b>${h(r.team)}</b> <span style="color:#64748b">${h(r.compName)}</span></button>`).join("")}
      </div>
      <div style="display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:12px;align-items:end">
        <div><label style="font-size:12px;color:#64748b;font-weight:600">Família (germans)</label><input value="${h(d.family)}" oninput="ccDraftField('family',this.value,true)" placeholder="${h(d.familyAuto ? `${title(d.familyAuto)} (pels cognoms)` : "Cognoms o nom de la família")}" style="${INPUT};margin-top:4px"/></div>
        <label style="display:flex;gap:6px;align-items:center;font-size:13px;padding-bottom:10px"><input type="checkbox" ${d.porter ? "checked" : ""} onchange="ccDraftField('porter',this.checked)"/> 🧤 Porter</label>
      </div>
      <div style="font-size:12px;color:#64748b;font-weight:600;margin:12px 0 6px">Partits que no surten a jok.cat (OK Plata, tornejos…)</div>
      ${manualRows}
      <button onclick="ccDraftAddManual()" style="${btn()}">+ Afegir partit</button>
      <label style="font-size:12px;color:#64748b;font-weight:600;display:block;margin-top:12px">Notes</label>
      <input value="${h(d.notes)}" oninput="ccDraftField('notes',this.value,true)" style="${INPUT};margin-top:4px"/>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-top:10px"><input type="checkbox" ${d.disabled ? "checked" : ""} onchange="ccDraftField('disabled',this.checked)"/> No tenir-la en compte per als conflictes</label>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <button onclick="ccSavePerson()" style="background:#1a2035;border:none;color:#fff;font-weight:800;font-size:14px;padding:11px 16px;border-radius:10px;cursor:pointer;flex:1">Desar</button>
        ${d.hasRecord ? `<button onclick="ccDeletePerson()" style="${btn()}">${d.jokIds.length ? "Tornar a les dades de les actes" : "Esborrar fitxa"}</button>` : ""}
      </div>
    `);
    return form + (p ? renderAgenda(p, ctx) : "");
  }

  function searchExternalTeams(query, ctx) {
    const q = CC.nameTokens(query);
    const out = [];
    const seen = new Set();
    for (const [, comps] of Object.entries(dbAll()?.categories || {})) {
      for (const comp of comps || []) {
        const teams = new Set();
        for (const m of comp.calendar || []) { teams.add(m.home); teams.add(m.away); }
        for (const team of teams) {
          const key = `${comp.id}|${team}`;
          if (seen.has(key) || ctx.model.clubTeamKeys.includes(key)) continue;
          const hay = CC.norm(`${team} ${comp.name}`);
          if (q.every(t => hay.includes(t))) { seen.add(key); out.push({ key, team, compName: comp.name }); }
        }
      }
    }
    return out;
  }

  function personEvents(p, ctx, fromDay) {
    const c = CC.commitmentsOf(p, ctx.model.annotations);
    const evs = ctx.model.events.filter(e => e.dayKey >= fromDay && (c.teams.has(e.teamKey) || c.events.has(e.key)));
    return { evs, roles: c };
  }

  function renderAgenda(p, ctx) {
    const { evs, roles } = personEvents(p, ctx, todayKey());
    const conf = ctx.conflicts.filter(c => (c.people || []).some(x => x.id === p.id));
    const sev = severityMap(conf);
    const byWeekend = new Map();
    for (const ev of evs.slice(0, 60)) {
      const sat = CC.weekendDays(ev.dayKey)[0] || ev.dayKey;
      if (!byWeekend.has(sat)) byWeekend.set(sat, []);
      byWeekend.get(sat).push(ev);
    }
    const blocks = [...byWeekend.entries()].slice(0, 8).map(([sat, list]) => `
      <div style="font-size:12px;font-weight:800;color:#64748b;margin:10px 0 5px;text-transform:uppercase">${dayLabel(sat, true)} – ${dayLabel(CC.addDays(sat, 1), true)}</div>
      ${list.map(ev => {
        const s = sev.get(ev.key);
        const role = roles.events.get(ev.key) || roles.teams.get(ev.teamKey);
        return `<div style="display:flex;gap:8px;align-items:center;padding:7px 9px;border-radius:9px;margin-bottom:4px;background:${s === "block" ? "#fef2f2" : s === "warn" ? "#fffbeb" : "#f8fafc"};border-left:3px solid ${s === "block" ? "#dc2626" : s === "warn" ? "#f59e0b" : "#e2e6ef"}">
          <div style="font-size:12px;min-width:70px"><b>${h(CC.weekdayOf(ev.dayKey))} ${h(ev.time)}</b></div>
          <div style="font-size:13px;flex:1;min-width:0">${ROLE_ICON[role] || ""} <b>${h(evLabel(ev, ctx))}</b> <span style="color:#64748b">${ev.manual ? "" : ev.isHome ? "a casa" : `a ${h(ev.venueTeam)}`}</span>${s ? `<div style="font-size:11.5px;color:${s === "block" ? "#b91c1c" : "#92400e"}">${conf.filter(c => c.a.key === ev.key || c.b.key === ev.key).map(c => { const o = c.a.key === ev.key ? c.b : c.a; return `${s === "block" ? "⛔" : "⚠️"} amb ${h(evLabel(o, ctx))} (${h(o.time)}): ${h(c.message)}`; }).join("<br>")}</div>` : ""}</div>
        </div>`;
      }).join("")}`).join("");
    const nBlock = conf.filter(c => c.severity === "block").length;
    const summary = conf.length
      ? `<div style="font-size:13px;font-weight:700;color:${nBlock ? "#b91c1c" : "#92400e"}">${nBlock ? `⛔ ${nBlock} bloqueig${nBlock > 1 ? "s" : ""}` : ""}${nBlock && conf.length > nBlock ? " · " : ""}${conf.length > nBlock ? `⚠️ ${conf.length - nBlock} avís${conf.length - nBlock > 1 ? "os" : ""}` : ""} als propers partits</div>`
      : `<div style="font-size:13px;color:#16a34a;font-weight:700">✓ Sense conflictes als propers partits</div>`;
    return card(sectionTitle(`Agenda de ${h(title(p.name.split(" ")[0]))}`, `<button onclick="ccExportIcs('${enc(p.id)}')" style="${btn()}">📅 Afegir al calendari</button>`)
      + summary + (blocks || `<div style="font-size:13px;color:#64748b;margin-top:8px">Cap partit programat.</div>`));
  }

  // ── Importació / exportació de persones ───────────────────────────
  const COLS = { nom: "Nom", juga: "Juga a", entrena: "Entrena", ajuda: "Ajudant/delegat a", altres: "Altres equips (club | competició)", familia: "Família", porter: "Porter", notes: "Notes", jok: "ID jok" };

  function canonCategory(text) {
    const n = CC.norm(text);
    if (/prebe|pre benj/.test(n)) return "Prebenjamí";
    if (/benja/.test(n)) return "Benjamí";
    if (/alev/.test(n)) return "Aleví";
    if (/infan/.test(n)) return "Infantil";
    if (/juven/.test(n)) return "Juvenil";
    if (/junio/.test(n)) return "Júnior";
    if (/(^|\s)(1|1a|1o|primera)\s*(a\s*)?cat/.test(n)) return "1ª Catalana";
    if (/(^|\s)(2|2a|2o|segona)\s*(a\s*)?cat/.test(n)) return "2ª Catalana";
    if (/(^|\s)(3|3a|3o|tercera)\s*(a\s*)?cat/.test(n)) return "3ª Catalana";
    if (/nacional/.test(n)) return "Nacional Catalana";
    if (/fem/.test(n)) return "Fem";
    if (/veter/.test(n)) return "Veterans";
    return "";
  }

  function makeTeamResolver(ctx) {
    const byAlias = new Map();
    const canon = [];
    for (const t of ctx.clubTeams) {
      for (const name of [t.label, defaultTeamLabel(t.ev), ctx.model.teamNames?.[t.key]].filter(Boolean)) byAlias.set(CC.norm(name), t.key);
      const letter = (String(t.ev.team).match(/\s([A-H])$/) || [])[1] || "";
      canon.push({ key: t.key, cat: t.ev.category, letter, inic: /INICIACI/i.test(t.ev.compName), level: /PLATA/i.test(t.ev.compName) ? "plata" : /\bOR\b/i.test(t.ev.compName) ? "or" : "" });
    }
    return text => {
      const n = CC.norm(text);
      if (!n) return null;
      if (byAlias.has(n)) return byAlias.get(n);
      const cat = canonCategory(text);
      if (!cat) return null;
      const letter = (String(text).toUpperCase().match(/(?:^|\s)([A-D])(?:\s|$)/) || [])[1] || "";
      const inic = /iniciaci/.test(n);
      let c = canon.filter(x => x.cat === cat);
      if (inic) c = c.filter(x => x.inic);
      else if (letter) { const byLetter = c.filter(x => x.letter === letter); if (byLetter.length) c = byLetter; }
      if (c.length > 1 && /plata|oro|\bor\b/.test(n)) {
        const lvl = /plata/.test(n) ? "plata" : "or";
        const f = c.filter(x => x.level === lvl);
        if (f.length) c = f;
      }
      return c.length === 1 ? c[0].key : null;
    };
  }

  function resolveExternal(text, ctx) {
    const parts = String(text).split("|").map(s => s.trim());
    if (parts.length === 2) {
      const r = searchExternalTeams(`${parts[0]} ${parts[1]}`, ctx);
      const exact = r.find(x => CC.norm(x.team) === CC.norm(parts[0]) && CC.norm(x.compName).startsWith(CC.norm(parts[1])));
      if (exact) return exact.key;
      if (r.length === 1) return r[0].key;
    }
    const r = searchExternalTeams(text, ctx);
    return r.length === 1 ? r[0].key : null;
  }

  function splitList(v) { return String(v ?? "").split(/[,;\n]+/).map(s => s.trim()).filter(Boolean); }

  function readCell(row, col) {
    const want = CC.norm(col);
    for (const [k, v] of Object.entries(row)) if (CC.norm(k) === want || CC.norm(k).startsWith(want.split(" ")[0] + " ") && want.startsWith(CC.norm(k))) return v;
    for (const [k, v] of Object.entries(row)) if (CC.norm(k).startsWith(want.split(" (")[0])) return v;
    return "";
  }

  function buildImportPreview(rows, ctx) {
    const resolveTeam = makeTeamResolver(ctx);
    const items = [];
    for (const row of rows) {
      const name = String(readCell(row, COLS.nom) || "").trim();
      if (!name) continue;
      const teams = [];
      const unknown = [];
      for (const [col, role] of [[COLS.juga, "juga"], [COLS.entrena, "entrena"], [COLS.ajuda, "ajuda"]]) {
        for (const t of splitList(readCell(row, col))) {
          const key = resolveTeam(t);
          if (key) teams.push({ key, role }); else unknown.push(t);
        }
      }
      for (const t of String(readCell(row, COLS.altres) || "").split(/[;\n]+/).map(s => s.trim()).filter(Boolean)) {
        const key = resolveExternal(t, ctx);
        if (key) teams.push({ key, role: "juga" }); else unknown.push(t);
      }
      const jok = String(readCell(row, COLS.jok) || "").trim();
      const existing = (jok && ctx.model.peopleById.get(`jok:${jok}`))
        || ctx.model.people.find(p => p.source !== "actes" && CC.norm(p.name) === CC.norm(name))
        || ctx.model.people.find(p => CC.norm(p.name) === CC.norm(name))
        || ctx.model.people.filter(p => CC.nameMatches(name, p.name)).find((_, i, arr) => arr.length === 1);
      const porterRaw = CC.norm(readCell(row, COLS.porter));
      items.push({
        name, teams, unknown, existing: existing ? { id: existing.id, name: existing.name } : null,
        family: String(readCell(row, COLS.familia) || "").trim(),
        porter: /^(si|s|x|yes|1|true)$/.test(porterRaw),
        notes: String(readCell(row, COLS.notes) || "").trim(),
        jokIds: jok ? [jok] : existing?.jokIds || [],
      });
    }
    return items;
  }

  function renderImportPreview(ctx) {
    const items = ui.importPreview || [];
    const unknown = items.filter(i => i.unknown.length);
    return card(`
      ${sectionTitle(`Importar ${items.length} persones`, `<button onclick="ccCancelImport()" style="${btn()}">Cancel·lar</button>`)}
      <div style="font-size:13px;color:#334155;margin-bottom:8px">${items.filter(i => i.existing).length} ja existeixen (s'actualitzaran) · ${items.filter(i => !i.existing).length} noves${unknown.length ? ` · <b style="color:#b91c1c">${unknown.length} amb equips no reconeguts</b>` : ""}</div>
      ${items.map(i => `<div style="border:1px solid ${i.unknown.length ? "#fecaca" : "#e2e6ef"};border-radius:9px;padding:7px 9px;margin-bottom:5px;font-size:13px">
        <b>${h(i.name)}</b> ${i.existing ? chip("ACTUALITZA", "#1d4ed8", "#dbeafe") : chip("NOVA", "#15803d", "#dcfce7")} ${i.porter ? "🧤" : ""}
        <div style="color:#64748b;font-size:12px">${i.teams.map(t => `${ROLE_ICON[t.role]} ${h(teamLabelFor(t.key, ctx.model))}`).join(" · ") || "Sense equips"}</div>
        ${i.unknown.length ? `<div style="color:#b91c1c;font-size:12px">No reconegut: ${h(i.unknown.join(", "))}</div>` : ""}
      </div>`).join("")}
      ${unknown.length ? `<div style="font-size:12px;color:#64748b;margin:6px 0">Per als equips del club fes servir el nom que surt a Configuració → Equips (pots posar-hi el teu nom curt, p. ex. "Prebe C"). Per a altres clubs: <i>Equip | Competició</i>.</div>` : ""}
      <button onclick="ccApplyImport()" style="background:#1a2035;border:none;color:#fff;font-weight:800;font-size:14px;padding:11px;border-radius:10px;cursor:pointer;width:100%;margin-top:6px">Importar</button>
    `);
  }

  function exportRows(ctx) {
    return ctx.model.people.map(p => {
      const by = role => p.teams.filter(t => t.role === role && ctx.model.clubTeamKeys.includes(t.key)).map(t => teamLabelFor(t.key, ctx.model)).join(", ");
      const ext = p.teams.filter(t => !ctx.model.clubTeamKeys.includes(t.key)).map(t => {
        const ev = ctx.model.events.find(e => e.teamKey === t.key);
        return ev ? `${ev.team} | ${ev.compName.replace(/\s*\(\d{4}-\d{2}\)\s*$/, "")}` : t.key;
      }).join("; ");
      return {
        [COLS.nom]: title(p.name), [COLS.juga]: by("juga"), [COLS.entrena]: by("entrena"), [COLS.ajuda]: by("ajuda"),
        [COLS.altres]: ext, [COLS.familia]: p.family || "", [COLS.porter]: p.porter ? "Sí" : "",
        [COLS.notes]: p.notes || "", [COLS.jok]: (p.jokIds || []).join(","),
      };
    });
  }

  // ── Simulador ─────────────────────────────────────────────────────
  function renderSimulatorView(ctx) {
    const events = ctx.upcomingRaw.filter(e => e.own);
    const opts = events.map(ev => `<option value="${h(ev.key)}" ${ev.key === ui.simEventKey ? "selected" : ""}>${h(dayLabel(ev.dayKey, true))} ${h(ev.time)} · ${h(evLabel(ev, ctx))} ${ev.isHome ? "vs" : "@"} ${h(ev.opponent)}</option>`).join("");
    const ev = events.find(e => e.key === ui.simEventKey);

    const form = card(`
      ${sectionTitle("Petició de canvi")}
      <div style="font-size:12.5px;color:#64748b;margin-bottom:10px">Un club truca o escriu per moure un partit: tria'l, posa la nova hora i mira què passa.</div>
      <label style="font-size:12px;color:#64748b;font-weight:600">Partit</label>
      <select onchange="ccSimPick(this.value)" style="${INPUT};margin:4px 0 10px">${ev ? "" : `<option value="">Tria un partit…</option>`}${opts}</select>
      ${ev ? `
        <div style="font-size:12px;color:#64748b;margin-bottom:10px">Ara: <b>${h(dayLabel(ev.dayKey))} ${h(ev.time)}</b> · ${ev.isHome ? "a casa" : "fora, a " + h(ev.venueTeam)}</div>
        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:8px">
          <div><label style="font-size:12px;color:#64748b;font-weight:600">Nova data</label><input type="date" value="${h(ui.simDate)}" onchange="ccSimField('simDate',this.value)" style="${INPUT};margin-top:4px"/></div>
          <div><label style="font-size:12px;color:#64748b;font-weight:600">Nova hora</label><input type="time" step="300" value="${h(ui.simTime)}" onchange="ccSimField('simTime',this.value)" style="${INPUT};margin-top:4px"/></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <button onclick="ccSimRun()" style="background:#7c3aed;border:none;color:#fff;font-weight:800;font-size:14px;padding:11px 14px;border-radius:10px;cursor:pointer;flex:1">Analitzar impacte</button>
          <button onclick="ccSimSuggest()" style="background:#fff;border:1.5px solid #7c3aed;color:#7c3aed;font-weight:800;font-size:14px;padding:11px 14px;border-radius:10px;cursor:pointer;flex:1">Buscar alternatives</button>
        </div>` : `<div style="font-size:13px;color:#64748b">També pots obrir un partit a la vista Setmana i prémer "Simular canvi d'hora".</div>`}
    `);

    let result = "";
    if (ev && ui.simResult && ui.simResult.event.key === ev.key) result = renderSimResult(ui.simResult, ctx);
    let slots = "";
    if (ev && ui.simSlots && ui.simSlots.key === ev.key) slots = renderSlots(ui.simSlots, ctx);
    return form + result + slots + renderProposals(ctx);
  }

  function renderSimResult(sim, ctx) {
    const ok = sim.blocks === 0;
    const head = ok
      ? `<div style="font-size:16px;font-weight:800;color:#16a34a">✓ Es pot acceptar${sim.warns ? ` (amb ${sim.warns} avís${sim.warns > 1 ? "os" : ""})` : ""}</div>`
      : `<div style="font-size:16px;font-weight:800;color:#dc2626">⛔ Genera ${sim.blocks} bloqueig${sim.blocks > 1 ? "s" : ""}</div>`;
    let pista = "";
    if (sim.event.isHome) {
      const pd = CC.pistaDay(ctx.upcoming.map(e => (e.matchKey === sim.event.matchKey ? CC.moveEvent(e, ui.simDate, ui.simTime) : e)), ctx.model, sim.moved.dayKey);
      const inGrid = sim.slot?.inGrid;
      pista = `<div style="font-size:13px;margin-top:8px;color:#334155">🏟️ ${inGrid ? "Franja habitual de la parrilla" : `<b style="color:#b45309">Fora de la parrilla habitual</b> (${h((sim.slot?.gridTimes || []).join(" · ") || "sense franges aquest dia")})`} · ${pd.free} franges lliures aquell dia</div>`;
    }
    const affected = new Map();
    for (const c of sim.after) for (const p of c.people || []) affected.set(p.id, p);
    const people = affected.size ? `<div style="font-size:13px;margin-top:6px;color:#334155">👤 Afecta: ${[...affected.values()].map(p => h(title(p.name))).join(", ")}</div>` : "";
    const list = (arr, label) => arr.length ? `<div style="font-size:12px;font-weight:700;color:#64748b;margin:10px 0 6px;text-transform:uppercase;letter-spacing:.04em">${label}</div><div style="display:flex;flex-direction:column;gap:6px">${arr.map(c => conflictLine(c, ctx, true, true)).join("")}</div>` : "";
    const resolved = sim.resolved.length ? `<div style="font-size:12px;font-weight:700;color:#16a34a;margin:10px 0 4px">✓ Resol ${sim.resolved.length} conflicte${sim.resolved.length > 1 ? "s" : ""} que hi havia</div>` : "";
    const save = `
      <div style="border-top:1px solid #e2e6ef;margin-top:12px;padding-top:12px">
        <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:8px">
          <select onchange="ccSimField('simSource',this.value,true)" style="padding:9px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px;background:#fff">
            ${[["telefon", "Telèfon"], ["email", "Email"], ["rival", "Club rival"], ["federacio", "Federació"], ["intern", "Intern"]].map(([k, l]) => `<option value="${k}" ${ui.simSource === k ? "selected" : ""}>${l}</option>`).join("")}
          </select>
          <input value="${h(ui.simNote)}" oninput="ccSimField('simNote',this.value,true)" placeholder="Qui ho demana, contacte…" style="padding:9px 10px;border:1.5px solid #e2e6ef;border-radius:10px;font-size:14px"/>
        </div>
        <button onclick="ccSaveProposal()" style="margin-top:8px;width:100%;background:#1a2035;border:none;color:#fff;font-weight:800;font-size:14px;padding:11px;border-radius:10px;cursor:pointer">Desar com a proposta pendent</button>
      </div>`;
    return card(`${sectionTitle(`${h(evLabel(sim.event, ctx))} → ${h(dayLabel(sim.moved.dayKey, true))} ${h(sim.moved.time)}`)}${head}${pista}${people}${resolved}${list(sim.after, "Conflictes amb la nova hora")}${save}`);
  }

  function renderSlots(s, ctx) {
    if (!s.slots.length) return card(sectionTitle("Alternatives") + `<div style="font-size:14px;color:#b91c1c">No hi ha cap hora sense bloquejos aquest cap de setmana.</div>`);
    const grid = s.slots.filter(x => x.inGrid);
    const other = s.slots.filter(x => !x.inGrid).sort((a, b) => a.distance - b.distance).slice(0, 10);
    const groups = (list) => {
      const byDay = new Map();
      for (const sl of list) { if (!byDay.has(sl.dayKey)) byDay.set(sl.dayKey, []); byDay.get(sl.dayKey).push(sl); }
      return [...byDay.entries()].map(([d, l]) => `<div style="margin-bottom:8px"><div style="font-weight:700;font-size:13px;margin-bottom:4px">${h(dayLabel(d))}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${l.sort((a, b) => a.time.localeCompare(b.time)).map(sl => `<button onclick="ccUseSlot('${sl.dayKey}','${sl.time}')" style="${sl.warns ? "background:#fffbeb;border:1px solid #f59e0b" : "background:#f0fdf4;border:1px solid #86efac"};color:#1a2035;font-weight:700;font-size:13px;padding:7px 10px;border-radius:8px;cursor:pointer">${sl.time}${sl.warns ? " ⚠️" : ""}</button>`).join("")}</div></div>`).join("");
    };
    return card(sectionTitle("Alternatives sense bloquejos")
      + (s.event.isHome ? `<div style="font-size:12px;font-weight:800;color:#15803d;margin-bottom:6px">🏟️ Franges lliures de la parrilla</div>${grid.length ? groups(grid) : `<div style="font-size:13px;color:#64748b;margin-bottom:8px">Cap franja habitual lliure.</div>`}` : "")
      + (other.length ? `<div style="font-size:12px;font-weight:800;color:#64748b;margin:6px 0">${s.event.isHome ? "Altres hores possibles" : "Hores possibles (la pista del rival l'ha de confirmar ell)"}</div>${groups(other)}` : ""));
  }

  function renderProposals(ctx) {
    const list = ctx.proposals.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!list.length) return "";
    const byKey = new Map(ctx.model.events.map(e => [e.key, e]));
    const statusTag = st => ({
      pendent: chip("PENDENT FEDERACIÓ", "#6d28d9", "#ede9fe"),
      oficial: chip("JA A JOK.CAT", "#15803d", "#dcfce7"),
      "sense-partit": chip("JUGAT / NO TROBAT"),
    }[st] || "");
    return card(sectionTitle(`Propostes (${list.length})`) + list.map(p => {
      const ev = byKey.get(p.eventKey);
      const st = ctx.proposalStatus[p.id] || "sense-partit";
      return `<div style="border:1.5px solid #e2e6ef;border-radius:10px;padding:9px 10px;margin-bottom:6px;font-size:13px">
        <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;flex-wrap:wrap"><b>${h(ev ? evLabel(ev, ctx) : p.label || "Partit")}</b>${statusTag(st)}</div>
        <div style="color:#334155">${h(p.fromDate)} ${h(p.fromTime)} → <b>${h(CC.toJokDate(p.newDate))} ${h(p.newTime)}</b>${p.blocks ? ` · <span style="color:#b91c1c">${p.blocks} bloqueig${p.blocks > 1 ? "s" : ""}</span>` : ""}</div>
        <div style="color:#64748b;font-size:12px">${h(p.source)}${p.note ? " · " + h(p.note) : ""}</div>
        <div style="display:flex;gap:6px;margin-top:6px">${st === "pendent" ? `<button onclick="ccOpenSim('${enc(p.eventKey)}','${h(p.newDate)}','${h(p.newTime)}')" style="${btn()}">Tornar a analitzar</button>` : ""}<button onclick="ccDeleteProposal('${enc(p.id)}')" style="${btn()}">${st === "pendent" ? "Descartar" : "Treure"}</button></div>
      </div>`;
    }).join(""));
  }

  // ── Canvis (avisos del job nocturn) ───────────────────────────────
  function loadSeen() { try { return localStorage.getItem(SEEN_KEY) || ""; } catch { return ""; } }

  function unseenChanges(ctx) {
    const entries = ui.changes?.entries || [];
    const seen = loadSeen();
    return entries.filter(e => e.at > seen).reduce((n, e) => n + (e.changes || []).length, 0);
  }

  function renderChangesView(ctx) {
    if (ui.changesState === "loading") return card(`<div style="font-size:14px;color:#64748b">Carregant canvis…</div>`);
    const entries = (ui.changes?.entries || []).slice().sort((a, b) => b.at.localeCompare(a.at));
    const seen = loadSeen();
    const head = card(sectionTitle("Canvis a jok.cat", entries.length ? `<button onclick="ccMarkSeen()" style="${btn(true)}">Marcar com a vist</button>` : "")
      + `<div style="font-size:12.5px;color:#64748b">Cada cop que s'actualitzen les dades es comparen els partits del club. Si n'hi ha cap de mogut, nou o eliminat, surt aquí i reps un avís de GitHub (correu o app). Es revisen els conflictes amb les persones actuals.</div>`);
    if (!entries.length) return head + card(`<div style="font-size:14px;color:#64748b">Encara no s'ha detectat cap canvi des que funciona l'avís.</div>`);
    const byKey = new Map(ctx.upcoming.map(e => [e.matchKey, e]));
    const conflictKeys = new Map();
    for (const c of ctx.conflicts) for (const k of [c.a.matchKey, c.b.matchKey]) if (c.severity === "block" || !conflictKeys.has(k)) conflictKeys.set(k, c.severity);
    return head + entries.slice(0, 30).map(entry => {
      const isNew = entry.at > seen;
      const when = new Date(entry.at).toLocaleString("ca-ES", { dateStyle: "short", timeStyle: "short" });
      return card(sectionTitle(`${isNew ? "🆕 " : ""}${h(when)}`, `<span style="font-size:12px;color:#64748b">${entry.changes.length} canvi${entry.changes.length > 1 ? "s" : ""}</span>`)
        + entry.changes.map(ch => {
          const ev = byKey.get(ch.matchKey);
          const sev = conflictKeys.get(ch.matchKey);
          const label = ev ? evLabel(ev, ctx) : `${ch.category} ${ch.team.match(/\s([A-H])$/)?.[1] || ""}`;
          const what = ch.type === "canvi" ? `🔁 ${h(ch.from.date)} ${h(ch.from.time)} → <b>${h(ch.to.date)} ${h(ch.to.time)}</b>`
            : ch.type === "nou" ? `🆕 Nou: <b>${h(ch.to.date)} ${h(ch.to.time)}</b>` : `🗑️ Ja no surt (era ${h(ch.from.date)} ${h(ch.from.time)})`;
          return `<div style="border:1.5px solid ${sev === "block" ? "#dc2626" : sev === "warn" ? "#f59e0b" : "#e2e6ef"};border-radius:10px;padding:9px 10px;margin-bottom:6px;font-size:13px">
            <div style="font-weight:700">${h(label)} <span style="font-weight:500;color:#64748b">${h(ch.home)} – ${h(ch.away)}</span></div>
            <div style="color:#334155">${what}</div>
            ${sev ? `<div style="color:${sev === "block" ? "#b91c1c" : "#92400e"};font-size:12px;font-weight:700;margin-top:2px">${sev === "block" ? "⛔ Ara té bloquejos" : "⚠️ Ara té avisos"}</div>` : ev ? `<div style="color:#16a34a;font-size:12px;font-weight:700;margin-top:2px">✓ Sense conflictes</div>` : ""}
            ${ev ? `<div style="display:flex;gap:6px;margin-top:6px"><button onclick="ccGoToEvent('${enc(ev.key)}')" style="${btn()}">Veure a la setmana</button><button onclick="ccOpenSim('${enc(ev.key)}')" style="${btn()}">Simular</button></div>` : ""}
          </div>`;
        }).join(""));
    }).join("");
  }

  // ── Configuració ──────────────────────────────────────────────────
  function renderConfigView(ctx) {
    const cfg = ctx.model.cfg;
    const num = (key, label, hint) => `<label style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9">
        <span style="font-size:13px;color:#334155">${label}${hint ? `<br><span style="font-size:11px;color:#94a3b8">${hint}</span>` : ""}</span>
        <input type="number" min="0" value="${h(cfg[key])}" onchange="ccSetConfig('${key}',this.value)" style="width:76px;padding:8px;border:1.5px solid #e2e6ef;border-radius:8px;font-size:15px;text-align:right"/>
      </label>`;
    const rules = card(sectionTitle("Regles")
      + num("slotMinutes", "Ocupació de pista per partit (min)", "Entre inicis de dos partits a casa")
      + num("busyMinutes", "Temps de partit (min)", "Escalfament + partit")
      + num("preMatchMinutes", "Arribada abans del 2n partit (min)", "Només quan hi ha desplaçament")
      + num("defaultTravelMinutes", "Trajecte si no coneixem la pista (min)")
      + num("tightMarginMinutes", "Avisar si el marge és menor de (min)")
      + num("minAppearances", "Actes mínimes per comptar que juga en un equip", "Puja-ho a 2 si surten massa casos puntuals"));

    const rotation = config().rotation || {};
    const teams = card(sectionTitle("Equips")
      + `<div style="font-size:12px;color:#64748b;margin-bottom:8px">Nom curt (el que fas servir tu, p. ex. "Prebe C") i rotació de porters.</div>`
      + ctx.clubTeams.map(t => {
        const coaches = coachesOf(t.key, ctx.model).map(p => title(p.name.split(" ").slice(0, 2).join(" ")));
        return `<div style="padding:8px 0;border-bottom:1px solid #f1f5f9">
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center">
            <input value="${h(ctx.model.teamNames?.[t.key] || "")}" placeholder="${h(defaultTeamLabel(t.ev))}" onchange="ccSetTeamName('${enc(t.key)}',this.value)" style="${INPUT}"/>
            <label style="display:flex;gap:6px;align-items:center;font-size:12px;white-space:nowrap"><input type="checkbox" ${rotation[t.key] ? "checked" : ""} onchange="ccSetRotation('${enc(t.key)}',this.checked)"/> 🧤 Rotació</label>
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:3px">${h(t.ev.compName)}${coaches.length ? ` · 📋 ${h(coaches.join(", "))}` : " · sense entrenador a les fitxes"}</div>
        </div>`;
      }).join(""));

    const derived = CC.deriveGrid(ctx.model.events, cfg.gridMinCount, cfg.slotMinutes);
    const gridCfg = config().grid || null;
    const gridDays = ["ds", "dg", "dv", "dl"].filter(wd => derived[wd] || gridCfg?.[wd] || ["ds", "dg"].includes(wd));
    const grid = card(sectionTitle("Parrilla del pavelló", gridCfg ? `<button onclick="ccResetGrid()" style="${btn()}">Tornar a la deduïda</button>` : "")
      + `<div style="font-size:12px;color:#64748b;margin-bottom:8px">Hores d'inici habituals, separades per comes. ${gridCfg ? "Editada a mà." : "Ara és la deduïda dels partits programats."}</div>`
      + gridDays.map(wd => `<label style="display:grid;grid-template-columns:90px 1fr;gap:8px;align-items:center;margin-bottom:6px"><span style="font-size:13px;font-weight:700">${DOW[wd]}</span>
          <input value="${h((ctx.model.grid[wd] || []).join(", "))}" onchange="ccSetGrid('${wd}',this.value)" placeholder="${h((derived[wd] || []).join(", "))}" style="${INPUT}"/></label>`).join(""));

    const allFamilies = CC.buildFamilies(ctx.model.people, []);
    const off = new Set(cfg.disabledFamilies || []);
    const fams = card(sectionTitle(`Germans (${allFamilies.length})`)
      + `<div style="font-size:12px;color:#64748b;margin-bottom:8px">Pels dos cognoms o pel camp Família de la fitxa. Només generen avís.</div>`
      + allFamilies.map(f => `<label style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid #f1f5f9">
          <input type="checkbox" ${off.has(f.key) ? "" : "checked"} onchange="ccToggleFamily('${enc(f.key)}',this.checked)" style="margin-top:3px"/>
          <span style="font-size:13px"><b>${h(title(f.label))}</b><br><span style="color:#64748b;font-size:12px">${f.members.map(m => `${h(title(m.name.split(" ")[0]))} (${h(m.teams.map(t => teamLabelFor(t.key, ctx.model)).join(", ") || "—")})`).join(" · ")}</span></span>
        </label>`).join(""));

    return rules + teams + grid + fams + renderTravelTable(ctx)
      + `<div style="font-size:11px;color:#94a3b8;margin:4px 2px 16px">${store.mode === "remote" ? "Les dades es guarden a Supabase i les veuen tots els coordinadors." : "Les dades es guarden en aquest dispositiu."}</div>`;
  }

  function renderTravelTable(ctx) {
    const cfg = ctx.model.cfg;
    const ov = cfg.travelOverrides || {};
    const venues = new Map();
    for (const ev of ctx.upcomingRaw) {
      if (ev.isHome || ev.manual) continue;
      const base = CC.stripTeamSuffix(ev.venueTeam);
      if (!venues.has(base)) venues.set(base, ev);
    }
    const home = { isHome: true, venueTeam: "" };
    const rows = [...venues.entries()].map(([base, ev]) => {
      const auto = CC.travelBetween(home, ev, ctx.model.resolve, { ...cfg, travelOverrides: {} });
      return { base, name: ev.venueTeam, auto, manual: ov[base] };
    }).sort((a, b) => (a.auto.estimated === b.auto.estimated ? 0 : a.auto.estimated ? -1 : 1) || a.name.localeCompare(b.name));
    return card(sectionTitle("Trajectes des de casa")
      + `<div style="font-size:12px;color:#64748b;margin-bottom:8px">Calculats amb les coordenades de venues.json. Si alguna no quadra, escriu els minuts reals. Les marcades amb ? no tenen ubicació.</div>`
      + rows.map(r => `<label style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9">
          <span style="font-size:13px;min-width:0">${h(r.name)}<br><span style="font-size:11px;color:${r.auto.estimated ? "#b45309" : "#94a3b8"}">auto: ${r.auto.minutes} min${r.auto.estimated ? " ?" : r.auto.km != null ? ` · ~${r.auto.km} km` : ""}</span></span>
          <input type="number" min="0" placeholder="${r.auto.minutes}" value="${Number.isFinite(r.manual) ? r.manual : ""}" onchange="ccSetTravel('${enc(r.base)}',this.value)" style="width:76px;padding:8px;border:1.5px solid ${Number.isFinite(r.manual) ? "#7c3aed" : "#e2e6ef"};border-radius:8px;font-size:15px;text-align:right"/>
        </label>`).join(""));
  }

  // ── Accions: navegació ────────────────────────────────────────────
  window.ccSetView = v => { ui.view = v; rerender(); };
  window.ccWeek = d => { ui.weekOffset = d === 0 ? 0 : ui.weekOffset + d; ui.openEvent = ""; rerender(); };
  window.ccPistaWeek = (d, absolute) => { ui.pistaOffset = absolute ? d : d === 0 ? 0 : ui.pistaOffset + d; ui.blockForm = null; rerender(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  window.ccSeverity = s => { ui.severityFilter = s; rerender(); };
  window.ccToggleProposals = on => { ui.showProposals = !!on; rerender(); };
  window.ccToggleEvent = k => { const key = dec(k); ui.openEvent = ui.openEvent === key ? "" : key; rerender(); };

  window.ccGoToEvent = k => {
    const key = dec(k);
    const ev = compute(club()).model.events.find(e => e.key === key);
    if (!ev) return;
    ui.view = "setmana";
    ui.weekOffset = weekOffsetOf(ev.dayKey);
    ui.openEvent = key;
    rerender();
  };

  // ── Accions: anotacions ───────────────────────────────────────────
  window.ccSetRotation = (k, on) => {
    const key = dec(k);
    const rot = { ...(config().rotation || {}) };
    if (on) rot[key] = true; else delete rot[key];
    saveConfig({ rotation: rot });
  };

  window.ccSetPorter = (k, personId) => {
    const eventKey = dec(k);
    const id = `${eventKey}::porter`;
    if (!personId) delRow("annotation", id);
    else putRow("annotation", id, { eventKey, type: "porter", personIds: [personId] });
  };

  window.ccAddReforc = (k, personId) => {
    if (!personId) return;
    const eventKey = dec(k);
    const id = `${eventKey}::reforc`;
    const cur = getRow("annotation", id)?.personIds || [];
    if (cur.includes(personId)) return;
    putRow("annotation", id, { eventKey, type: "reforc", personIds: [...cur, personId] });
  };

  window.ccRemoveReforc = (k, p) => {
    const eventKey = dec(k);
    const personId = dec(p);
    const id = `${eventKey}::reforc`;
    const next = (getRow("annotation", id)?.personIds || []).filter(x => x !== personId);
    if (next.length) putRow("annotation", id, { eventKey, type: "reforc", personIds: next });
    else delRow("annotation", id);
  };

  // ── Accions: pista ────────────────────────────────────────────────
  window.ccBlockForm = (dayKey, time) => {
    if (!dayKey) { ui.blockForm = null; rerender(); return; }
    const cfg = compute(club()).model.cfg;
    const from = time || "10:00";
    ui.blockForm = { dayKey, from, to: CC.minutesToClock(CC.clockToMinutes(from) + cfg.slotMinutes), reason: "" };
    rerender();
  };
  window.ccBlockField = (f, v) => { if (ui.blockForm) ui.blockForm[f] = v; };
  window.ccSaveBlock = () => {
    const f = ui.blockForm;
    if (!f || !f.from || !f.to || CC.clockToMinutes(f.to) <= CC.clockToMinutes(f.from)) { alert("Revisa les hores."); return; }
    ui.blockForm = null;
    putRow("block", "b_" + Date.now().toString(36), { dayKey: f.dayKey, from: f.from, to: f.to, reason: f.reason.trim() });
  };
  window.ccUnblock = id => delRow("block", dec(id));

  // ── Accions: persones ─────────────────────────────────────────────
  window.ccPersonQuery = v => {
    ui.personQuery = v;
    rerender();
    const el = document.getElementById("cc-person-q");
    if (el) { el.focus(); el.setSelectionRange(v.length, v.length); }
  };
  window.ccPersonFilter = f => { ui.personFilter = f; rerender(); };

  window.ccOpenPerson = k => {
    const id = dec(k);
    const p = compute(club()).model.peopleById.get(id);
    if (!p) return;
    ui.personId = id;
    ui.draft = draftFromPerson(p);
    ui.extQuery = "";
    ui.view = "persones";
    rerender();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.ccNewPerson = () => {
    ui.personId = "p_" + Date.now().toString(36);
    ui.draft = { id: ui.personId, name: "", teams: [], autoTeams: [], family: "", familyAuto: "", porter: false, disabled: false, notes: "", jokIds: [], manualEvents: [], hasRecord: false, linkedName: "" };
    ui.extQuery = "";
    rerender();
  };

  window.ccClosePerson = () => { ui.personId = ""; ui.draft = null; rerender(); };
  window.ccDraftField = (f, v, silent) => { if (ui.draft) ui.draft[f] = v; if (!silent) rerender(); };
  window.ccDraftTeam = (i, f, v) => { if (ui.draft?.teams[i]) ui.draft.teams[i][f] = v; rerender(); };
  window.ccDraftRemoveTeam = i => { ui.draft.teams.splice(i, 1); rerender(); };
  window.ccDraftAddTeam = () => {
    const ctx = compute(club());
    const used = new Set(ui.draft.teams.map(t => t.key));
    const first = ctx.clubTeams.find(t => !used.has(t.key));
    if (first) ui.draft.teams.push({ key: first.key, role: "entrena" });
    rerender();
  };
  window.ccExtQuery = v => {
    ui.extQuery = v;
    rerender();
    const el = document.getElementById("cc-ext-q");
    if (el) { el.focus(); el.setSelectionRange(v.length, v.length); }
  };
  window.ccDraftAddExternal = k => {
    const key = dec(k);
    if (!ui.draft.teams.some(t => t.key === key)) ui.draft.teams.push({ key, role: "juga" });
    ui.extQuery = "";
    rerender();
  };
  window.ccDraftAddManual = () => {
    ui.draft.manualEvents.push({ id: "m_" + Date.now().toString(36), title: "", date: "", time: "", place: "" });
    rerender();
  };
  window.ccDraftManual = (i, f, v) => { if (ui.draft?.manualEvents[i]) ui.draft.manualEvents[i][f] = v; };
  window.ccDraftRemoveManual = i => { ui.draft.manualEvents.splice(i, 1); rerender(); };

  function draftToRecord(d) {
    const keys = new Set(d.teams.map(t => t.key));
    return {
      name: d.name.trim(),
      teams: d.teams.filter((t, i, arr) => arr.findIndex(x => x.key === t.key) === i),
      excludeTeams: (d.autoTeams || []).filter(k => !keys.has(k)),
      family: d.family.trim(),
      porter: !!d.porter,
      disabled: !!d.disabled,
      notes: d.notes.trim(),
      jokIds: d.jokIds || [],
      manualEvents: d.manualEvents.filter(e => e.date && e.time).map(e => ({ ...e, title: e.title.trim() || "Partit", place: e.place.trim() })),
    };
  }

  window.ccSavePerson = async () => {
    const d = ui.draft;
    if (!d || !d.name.trim()) { alert("Posa un nom."); return; }
    const rec = draftToRecord(d);
    invalidate();
    await putRow("person", d.id, rec);
    toast("Fitxa desada");
    const p = compute(club()).model.peopleById.get(d.id);
    if (p) ui.draft = draftFromPerson(p);
    rerender();
  };

  window.ccDeletePerson = async () => {
    const d = ui.draft;
    if (!d || !confirm(d.jokIds.length ? "Treure la fitxa i quedar-se només amb el que diuen les actes?" : "Esborrar aquesta persona?")) return;
    invalidate();
    await delRow("person", d.id);
    ui.personId = "";
    ui.draft = null;
    rerender();
  };

  window.ccImportFile = input => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let rows;
        if (/\.csv$/i.test(file.name)) {
          const wb = window.XLSX.read(reader.result, { type: "string" });
          rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        } else {
          const wb = window.XLSX.read(new Uint8Array(reader.result), { type: "array" });
          const sheet = wb.SheetNames.find(n => CC.norm(n).startsWith("persones")) || wb.SheetNames[0];
          rows = window.XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: "" });
        }
        ui.importPreview = buildImportPreview(rows, compute(club()));
        if (!ui.importPreview.length) { ui.importPreview = null; alert("No he trobat cap fila amb la columna \"Nom\"."); }
        rerender();
      } catch (err) {
        alert("No s'ha pogut llegir el fitxer: " + err.message);
      }
    };
    if (/\.csv$/i.test(file.name)) reader.readAsText(file); else reader.readAsArrayBuffer(file);
    input.value = "";
  };

  window.ccCancelImport = () => { ui.importPreview = null; rerender(); };

  window.ccApplyImport = async () => {
    const items = ui.importPreview || [];
    const ctx = compute(club());
    const writes = items.map((it, i) => {
      const id = it.existing?.id || `p_imp${Date.now().toString(36)}${i}`;
      const prev = getRow("person", id) || {};
      const p = it.existing ? ctx.model.peopleById.get(it.existing.id) : null;
      const auto = p ? p.teams.filter(t => t.auto).map(t => ({ key: t.key, role: "juga" })) : [];
      const teams = [...it.teams];
      for (const a of auto) if (!teams.some(t => t.key === a.key)) teams.push(a);
      return {
        kind: "person", id,
        data: {
          ...prev,
          name: it.name,
          teams,
          family: it.family || prev.family || "",
          porter: it.porter || !!prev.porter,
          notes: it.notes || prev.notes || "",
          jokIds: it.jokIds?.length ? it.jokIds : prev.jokIds || p?.jokIds || [],
          manualEvents: prev.manualEvents || [],
        },
      };
    });
    invalidate();
    await putRows(writes);
    ui.importPreview = null;
    toast(`${writes.length} persones importades`);
  };

  window.ccExportPeople = () => {
    if (!window.XLSX) { alert("No s'ha carregat la llibreria d'Excel."); return; }
    const ctx = compute(club());
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.json_to_sheet(exportRows(ctx), { header: Object.values(COLS) });
    ws["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 24 }, { wch: 18 }, { wch: 40 }, { wch: 16 }, { wch: 7 }, { wch: 24 }, { wch: 10 }];
    window.XLSX.utils.book_append_sheet(wb, ws, "Persones");
    const help = window.XLSX.utils.aoa_to_sheet([
      ["Com omplir-ho"],
      ["Una fila per persona. Els equips del club, separats per comes, amb el nom curt de Configuració → Equips."],
      ["Equips del club disponibles:"],
      ...ctx.clubTeams.map(t => [t.label]),
      [""],
      ["Altres equips: Equip | Competició, separats per punt i coma. Ex.: Vicio Phc Sant Cugat | FEM 19"],
      ["Porter: Sí. ID jok: no el toquis (vincula amb les actes)."],
    ]);
    window.XLSX.utils.book_append_sheet(wb, help, "Ajuda");
    window.XLSX.writeFile(wb, `persones_${slug(club())}.xlsx`);
  };

  window.ccExportIcs = k => {
    const id = dec(k);
    const ctx = compute(club());
    const p = ctx.model.peopleById.get(id);
    if (!p) return;
    const { evs } = personEvents(p, ctx, todayKey());
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const dt = (dayKey, mins) => {
      const [y, m, d] = dayKey.split("-");
      return `${y}${m}${d}T${CC.minutesToClock(mins).replace(":", "")}00`;
    };
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//hoquei-fecapa//calendari//CA", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${title(p.name)} · hoquei`];
    for (const ev of evs) {
      const s = CC.clockToMinutes(ev.time);
      if (s == null) continue;
      lines.push("BEGIN:VEVENT", `UID:${slug(ev.key)}-${slug(p.id)}@hoquei-fecapa`, `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Europe/Madrid:${dt(ev.dayKey, s)}`, `DTEND;TZID=Europe/Madrid:${dt(ev.dayKey, s + ctx.model.cfg.busyMinutes)}`,
        `SUMMARY:${evLabel(ev, ctx).replace(/[,;]/g, " ")} ${ev.manual ? "" : ev.isHome ? "vs" : "@"} ${String(ev.opponent || "").replace(/[,;]/g, " ")}`,
        `LOCATION:${String(ev.venueTeam || "").replace(/[,;]/g, " ")}`, "END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `agenda_${slug(p.name)}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // ── Accions: simulador ────────────────────────────────────────────
  window.ccOpenSim = (encodedKey, date, time) => {
    const key = dec(encodedKey);
    const ev = compute(club()).upcomingRaw.find(e => e.key === key);
    ui.view = "simulador";
    ui.simEventKey = key;
    ui.simDate = date || ev?.dayKey || "";
    ui.simTime = time || ev?.time || "";
    ui.simResult = null;
    ui.simSlots = null;
    if (date && time) setTimeout(() => window.ccSimRun(), 0);
    rerender();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.ccSimPick = key => window.ccOpenSim(enc(key));
  window.ccSimField = (field, value, silent) => { ui[field] = value; if (!silent) rerender(); };

  function simBase(ctx) {
    const others = ctx.proposals.filter(p => p.eventKey !== ui.simEventKey);
    return CC.applyProposals(ctx.upcomingRaw, others).events;
  }

  window.ccSimRun = () => {
    if (!ui.simEventKey || !ui.simDate || !ui.simTime) { alert("Indica data i hora."); return; }
    const ctx = compute(club());
    ui.simResult = CC.simulateChange(simBase(ctx), ctx.model, ui.simEventKey, ui.simDate, ui.simTime);
    rerender();
  };

  window.ccSimSuggest = () => {
    if (!ui.simEventKey) return;
    const ctx = compute(club());
    const base = simBase(ctx);
    const ev = base.find(e => e.key === ui.simEventKey);
    const days = CC.weekendDays(ui.simDate || ev.dayKey);
    if (ui.simDate && !days.includes(ui.simDate)) days.unshift(ui.simDate);
    const slots = CC.suggestSlots(base, ctx.model, ui.simEventKey, { dayKeys: days, from: "09:00", to: "20:30", stepMinutes: 15, limit: 40 });
    ui.simSlots = { key: ui.simEventKey, event: ev, slots };
    rerender();
  };

  window.ccUseSlot = (dayKey, time) => { ui.simDate = dayKey; ui.simTime = time; window.ccSimRun(); };

  window.ccSaveProposal = async () => {
    const sim = ui.simResult;
    if (!sim) return;
    const ctx = compute(club());
    const old = ctx.proposals.filter(p => p.eventKey === sim.event.key);
    const id = "p" + Date.now().toString(36);
    await putRows([
      ...old.map(p => ({ kind: "proposal", id: p.id, data: null })),
      { kind: "proposal", id, data: {
        id, eventKey: sim.event.key, label: evLabel(sim.event, ctx), fromDate: sim.event.date, fromTime: sim.event.time,
        newDate: ui.simDate, newTime: ui.simTime, source: ui.simSource, note: ui.simNote, blocks: sim.blocks,
        createdAt: new Date().toISOString(),
      } },
    ]);
    ui.simNote = "";
    toast("Proposta desada");
  };

  window.ccDeleteProposal = id => delRow("proposal", dec(id));

  // ── Accions: canvis i configuració ────────────────────────────────
  window.ccMarkSeen = () => {
    const last = (ui.changes?.entries || []).reduce((m, e) => (e.at > m ? e.at : m), "");
    try { localStorage.setItem(SEEN_KEY, last); } catch { /* ignore */ }
    rerender();
  };

  window.ccSetConfig = (key, value) => {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) saveConfig({ [key]: n });
  };

  window.ccSetTeamName = (k, value) => {
    const names = { ...(config().teamNames || {}) };
    const v = String(value || "").trim();
    if (v) names[dec(k)] = v; else delete names[dec(k)];
    saveConfig({ teamNames: names });
  };

  window.ccSetGrid = (wd, value) => {
    const cur = { ...compute(club()).model.grid, ...(config().grid || {}) };
    cur[wd] = String(value || "").split(/[,;\s]+/).map(CC.normTime).filter(Boolean).sort();
    saveConfig({ grid: cur });
  };

  window.ccResetGrid = () => saveConfig({ grid: null });

  window.ccSetTravel = (encodedBase, value) => {
    const base = dec(encodedBase);
    const ov = { ...(config().travelOverrides || {}) };
    const n = Number(value);
    if (value === "" || !Number.isFinite(n)) delete ov[base]; else ov[base] = n;
    saveConfig({ travelOverrides: ov });
  };

  window.ccToggleFamily = (k, on) => {
    const fam = dec(k);
    const set = new Set(config().disabledFamilies || []);
    if (on) set.delete(fam); else set.add(fam);
    saveConfig({ disabledFamilies: [...set] });
  };

  // Exposat per a proves.
  window.__ccDebug = { ui, store, compute: () => compute(club()) };
})();
