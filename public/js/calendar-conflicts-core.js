/**
 * Motor de conflictes de calendari per al panell de coordinador.
 *
 * Codi pur (sense DOM) perquè es pugui provar amb `node --test` i fer servir
 * des del job nocturn. Al navegador queda exposat com `window.CalendarConflicts`.
 *
 * Model:
 *  - Esdeveniments: partits dels equips del club (casa i fora), partits d'equips
 *    d'altres clubs on juga/entrena algú del club, i partits manuals (p. ex. OK Plata).
 *  - Persones: jugadors detectats a les actes + fitxa manual (entrenadors, delegats,
 *    reforços, equips d'altres clubs, família). Una persona pot jugar i entrenar.
 *  - Anotacions per partit: porter de la rotació, reforç convocat.
 *  - Pista: parrilla habitual (derivada dels partits programats) i bloquejos manuals.
 *
 * Regles:
 *  - Pista (bloqueig): dos partits a casa que es trepitgen, o partit a casa en franja bloquejada.
 *  - Persona (bloqueig si juga/entrena, avís si ajuda): no pot arribar a dos partits.
 *    Casa→casa només cal que no es solapin; si algun és fora, cal partit + trajecte + arribada.
 *  - Germans (avís): germans en equips diferents amb horaris incompatibles.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CalendarConflicts = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_CONFIG = Object.freeze({
    slotMinutes: 75,          // ocupació de pista per partit a casa
    busyMinutes: 75,          // temps que una persona està ocupada (escalfament + partit)
    preMatchMinutes: 30,      // arribada abans del segon partit quan hi ha desplaçament
    defaultTravelMinutes: 45, // si no coneixem la pista
    travelSpeedKmh: 50,
    roadFactor: 1.3,          // km per carretera ≈ km en línia recta × factor
    parkingMinutes: 10,
    tightMarginMinutes: 15,   // per sota d'aquest marge (amb desplaçament) → avís "molt just"
    minAppearances: 1,        // actes mínimes per considerar que un jugador juga en un equip
    gridMinCount: 2,          // vegades que ha d'aparèixer una hora per ser franja habitual
    travelOverrides: {},      // { equipLocalSenseSufix: minuts des de casa }
    grid: null,               // { ds: ["15:00", ...], dg: [...] } — null = derivada
  });

  const ROLES = Object.freeze({
    juga: { label: "Juga", severity: "block" },
    entrena: { label: "Entrena", severity: "block" },
    ajuda: { label: "Ajudant/delegat", severity: "warn" },
  });

  const WEEKDAYS = ["dg", "dl", "dt", "dc", "dj", "dv", "ds"];

  // ── Dates ────────────────────────────────────────────────────────────
  function parseDate(date) {
    const s = String(date || "").trim();
    let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) return { y: +m[3], mo: +m[2], d: +m[1] };
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return { y: +m[1], mo: +m[2], d: +m[3] };
    return null;
  }

  function parseTime(time) {
    const m = String(time || "").trim().match(/^(\d{1,2})[:.h,](\d{2})/);
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return { h, mi };
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  function dayKeyOf(date) {
    const p = parseDate(date);
    return p ? `${p.y}-${pad(p.mo)}-${pad(p.d)}` : "";
  }

  /** "2026-11-01" → "01-11-2026" (format de jok.cat) */
  function toJokDate(date) {
    const p = parseDate(date);
    return p ? `${pad(p.d)}-${pad(p.mo)}-${p.y}` : String(date || "");
  }

  function normTime(time) {
    const t = parseTime(time);
    return t ? `${pad(t.h)}:${pad(t.mi)}` : "";
  }

  /** Minuts des de l'època (hora local de paret, sense zona) — només per comparar. */
  function toMinutes(date, time) {
    const p = parseDate(date);
    const t = parseTime(time);
    if (!p || !t) return null;
    return Math.round(Date.UTC(p.y, p.mo - 1, p.d, t.h, t.mi) / 60000);
  }

  function minutesToClock(mins) {
    const m = ((mins % 1440) + 1440) % 1440;
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  }

  function clockToMinutes(time) {
    const t = parseTime(time);
    return t ? t.h * 60 + t.mi : null;
  }

  function weekdayOf(dayKey) {
    const p = parseDate(dayKey);
    if (!p) return "";
    return WEEKDAYS[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()];
  }

  function addDays(dayKey, n) {
    const p = parseDate(dayKey);
    if (!p) return "";
    const d = new Date(Date.UTC(p.y, p.mo - 1, p.d) + n * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  function weekendDays(dayKey) {
    const wd = weekdayOf(dayKey);
    if (!wd) return [];
    const idx = WEEKDAYS.indexOf(wd); // 0 dg … 6 ds
    const toSat = idx === 0 ? -1 : 6 - idx;
    const sat = addDays(dayKey, toSat);
    return [sat, addDays(sat, 1)];
  }

  // ── Noms ─────────────────────────────────────────────────────────────
  function norm(s) {
    return String(s || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }

  /** Treu sufixos d'equip ("a", "b b", "c") del final del nom. */
  function stripTeamSuffix(s) {
    let out = norm(s);
    while (/ [a-h]$/.test(out)) out = out.slice(0, -2);
    return out;
  }

  function nameTokens(name) {
    return norm(name).split(" ").filter(t => t.length > 1);
  }

  /** Dos cognoms finals → clau de família ("reventos plaza"). */
  function familyKey(name) {
    const t = nameTokens(name);
    if (t.length < 3) return "";
    return t.slice(-2).join(" ");
  }

  /** "Hugo Lachica" encaixa amb "HUGO LACHICA BOSCH" (tots els tokens del curt dins del llarg). */
  function nameMatches(shortName, longName) {
    const a = nameTokens(shortName);
    const b = new Set(nameTokens(longName));
    if (a.length < 2) return false;
    return a.every(t => b.has(t));
  }

  function matchKey(compId, m) {
    return `${compId}|${m.jornada ?? ""}|${m.home}|${m.away}`;
  }

  function pairKey(a, b) { return a < b ? `${a}||${b}` : `${b}||${a}`; }

  // ── Esdeveniments ────────────────────────────────────────────────────
  function makeEvent(comp, category, m, side, own, isClubTeam) {
    const team = String(m[side] || "").trim();
    return {
      key: "",
      matchKey: matchKey(comp.id, m),
      compId: String(comp.id),
      compName: comp.name || "",
      category,
      jornada: m.jornada ?? null,
      team,
      teamKey: `${comp.id}|${team}`,
      own,
      isHome: isClubTeam(m.home),          // es juga a la pista del club
      home: m.home,
      away: m.away,
      opponent: side === "home" ? m.away : m.home,
      venueTeam: m.home,
      date: m.date || "",
      time: m.time || "",
      dayKey: dayKeyOf(m.date),
      start: toMinutes(m.date, m.time),
      played: !!m.played,
      derby: false,
    };
  }

  /**
   * @param {object} db  data.json
   * @param {object} opts { isClubTeam(name)→bool, extraTeamKeys: Iterable<"compId|equip"> }
   */
  function buildEvents(db, opts = {}) {
    const isClubTeam = opts.isClubTeam || (() => false);
    const extra = new Set(opts.extraTeamKeys || []);
    const out = [];
    for (const [category, comps] of Object.entries(db?.categories || {})) {
      for (const comp of comps || []) {
        for (const m of comp?.calendar || []) {
          const sides = [];
          for (const side of ["home", "away"]) {
            const own = isClubTeam(m[side]);
            if (own || extra.has(`${comp.id}|${String(m[side] || "").trim()}`)) sides.push([side, own]);
          }
          if (!sides.length) continue;
          const ownSides = sides.filter(([, own]) => own).length;
          for (const [side, own] of sides) {
            const ev = makeEvent(comp, category, m, side, own, isClubTeam);
            ev.derby = ownSides > 1;
            ev.key = ev.matchKey + (sides.length > 1 ? `#${side}` : "");
            out.push(ev);
          }
        }
      }
    }
    out.sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity));
    return out;
  }

  /** Compatibilitat amb la versió anterior. */
  function buildClubEvents(db, isClubTeam) {
    return buildEvents(db, { isClubTeam });
  }

  /** Partits manuals d'una persona (competicions que no surten a jok.cat). */
  function manualEventToEvent(me, person) {
    const date = toJokDate(me.date);
    return {
      key: `manual:${me.id}`,
      matchKey: `manual:${me.id}`,
      compId: "manual",
      compName: me.competition || "Manual",
      category: me.competition || "Altres",
      jornada: null,
      team: me.title || "Partit manual",
      teamKey: `manual:${me.id}`,
      own: false,
      manual: true,
      personId: person?.id || null,
      isHome: false,
      home: me.place || me.title || "",
      away: "",
      opponent: me.title || "",
      venueTeam: me.place || "",
      date,
      time: normTime(me.time),
      dayKey: dayKeyOf(date),
      start: toMinutes(date, me.time),
      played: false,
      derby: false,
    };
  }

  // ── Pistes i desplaçaments ───────────────────────────────────────────
  function haversineKm(a, b) {
    const R = Math.PI / 180;
    const dLat = (b.lat - a.lat) * R;
    const dLng = (b.lng - a.lng) * R;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  // Paraules massa genèriques per decidir que dos noms són el mateix club.
  const VENUE_STOPWORDS = new Set(["club", "pati", "hoquei", "esports", "esportiva", "esportiu", "futbol",
    "union", "unio", "sant", "santa", "cpi", "chp", "ceh", "ueh", "cch", "the"]);

  /**
   * Resol el nom de l'equip local a coordenades fent servir venues.json
   * (claus = nom de l'equip). Prova nom exacte, normalitzat, sense sufix i semblança.
   */
  function makeVenueResolver(venues) {
    const entries = Object.entries(venues || {})
      .map(([name, v]) => {
        const lat = Number(v?.lat ?? v?.coordinates?.lat);
        const lng = Number(v?.lng ?? v?.coordinates?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { name, n: norm(name), base: stripTeamSuffix(name), lat, lng };
      })
      .filter(Boolean);
    const byNorm = new Map(entries.map(e => [e.n, e]));
    const byBase = new Map();
    for (const e of entries) if (!byBase.has(e.base)) byBase.set(e.base, e);
    const cache = new Map();

    function tokens(s) { return new Set(s.split(" ").filter(t => t.length > 2 && !VENUE_STOPWORDS.has(t))); }

    return function resolve(teamName) {
      const n = norm(teamName);
      if (!n) return null;
      if (cache.has(n)) return cache.get(n);
      const base = stripTeamSuffix(teamName);
      let hit = byNorm.get(n) || byBase.get(base) || null;
      if (!hit && base) {
        hit = entries.find(e => e.base && (e.base.startsWith(base + " ") || base.startsWith(e.base + " "))) || null;
      }
      if (!hit && base) {
        const tq = tokens(base);
        let best = null, bestScore = 0;
        for (const e of entries) {
          const te = tokens(e.base);
          if (!te.size || !tq.size) continue;
          let inter = 0;
          for (const t of tq) if (te.has(t)) inter++;
          const score = inter / Math.max(tq.size, te.size);
          if (score > bestScore) { bestScore = score; best = e; }
        }
        if (bestScore >= 0.6) hit = best;
      }
      const res = hit ? { lat: hit.lat, lng: hit.lng, name: hit.name } : null;
      cache.set(n, res);
      return res;
    };
  }

  function sameVenue(a, b, resolve) {
    if (a.isHome && b.isHome) return true;
    if (a.venueTeam && norm(a.venueTeam) === norm(b.venueTeam)) return true;
    const ca = resolve ? resolve(a.venueTeam) : null;
    const cb = resolve ? resolve(b.venueTeam) : null;
    return !!(ca && cb && haversineKm(ca, cb) < 0.3);
  }

  function travelBetween(a, b, resolve, cfg) {
    // Temps manuals des de la pista del club (el coordinador els pot corregir).
    const ov = cfg.travelOverrides || {};
    const oa = a.isHome ? 0 : ov[stripTeamSuffix(a.venueTeam)];
    const ob = b.isHome ? 0 : ov[stripTeamSuffix(b.venueTeam)];
    if ((a.isHome || b.isHome) && Number.isFinite(oa) && Number.isFinite(ob)) {
      return { minutes: Math.max(oa, ob), km: null, estimated: false, manual: true };
    }
    const ca = a.isHome && cfg.homeCoords ? cfg.homeCoords : resolve ? resolve(a.venueTeam) : null;
    const cb = b.isHome && cfg.homeCoords ? cfg.homeCoords : resolve ? resolve(b.venueTeam) : null;
    if (!ca || !cb) return { minutes: cfg.defaultTravelMinutes, km: null, estimated: true };
    const km = haversineKm(ca, cb) * cfg.roadFactor;
    const minutes = Math.round((km / cfg.travelSpeedKmh) * 60 + cfg.parkingMinutes);
    return { minutes, km: Math.round(km), estimated: false };
  }

  /** Comprova si una persona pot fer els dos partits. */
  function checkTiming(a, b, resolve, cfg) {
    const [first, second] = a.start <= b.start ? [a, b] : [b, a];
    const gap = second.start - first.start;
    const same = sameVenue(first, second, resolve);
    const travel = same ? { minutes: 0, km: 0, estimated: false } : travelBetween(first, second, resolve, cfg);
    const needed = same ? cfg.busyMinutes : cfg.busyMinutes + travel.minutes + cfg.preMatchMinutes;
    return { first, second, gap, needed, margin: gap - needed, same, travel, ok: gap >= needed };
  }

  function describeTiming(t, cfg) {
    if (t.same) {
      if (t.gap < cfg.busyMinutes) return t.gap === 0 ? "Mateixa hora" : `Es solapen (${t.gap} min entre inicis, calen ${cfg.busyMinutes})`;
      return `Molt just: ${t.margin} min de marge a la mateixa pista`;
    }
    const tr = `${t.travel.minutes} min de trajecte${t.travel.estimated ? " (estimat)" : t.travel.km != null ? ` (~${t.travel.km} km)` : ""}`;
    if (!t.ok) return `No dona temps: ${t.gap} min entre inicis, calen ${t.needed} (partit ${cfg.busyMinutes} + ${tr} + ${cfg.preMatchMinutes} d'arribada)`;
    return `Molt just: ${t.margin} min de marge amb ${tr}`;
  }

  // ── Persones ─────────────────────────────────────────────────────────
  /**
   * Fusiona jugadors detectats a les actes amb les fitxes manuals.
   *
   * @param {object} rosters   team-rosters.json
   * @param {string[]} clubTeamKeys
   * @param {Array<{id:string,data:object}>} records  fitxes de persona
   * @returns {{people: object[], byId: Map}}
   *
   * Fitxa: { name, teams:[{key, role}], excludeTeams:[key], family, porter, disabled,
   *          notes, jokIds:[id], manualEvents:[{id,title,date,time,place,competition}] }
   */
  function buildPeople(rosters, clubTeamKeys, records = [], config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const clubKeys = new Set(clubTeamKeys);
    const auto = new Map(); // jokId -> person

    for (const key of clubKeys) {
      const team = rosters?.teams?.[key];
      if (!team) continue;
      for (const [id, count] of Object.entries(team.players || {})) {
        if (count < cfg.minAppearances) continue;
        if (!auto.has(id)) {
          const meta = rosters?.players?.[id] || {};
          auto.set(id, {
            id: `jok:${id}`, jokIds: [id], name: meta.name || `Jugador ${id}`,
            teams: new Map(), family: "", porter: !!meta.gk, disabled: false,
            notes: "", manualEvents: [], source: "actes", record: null,
          });
        }
        auto.get(id).teams.set(key, { key, role: "juga", count, auto: true });
      }
    }

    const people = new Map([...auto.values()].map(p => [p.id, p]));
    const merged = new Set(); // ids automàtics absorbits per una fitxa

    for (const rec of records || []) {
      const data = rec?.data || {};
      const recId = String(rec?.id || "");
      if (!recId) continue;

      // Quins jugadors de les actes representa aquesta fitxa?
      let targets = [];
      if (recId.startsWith("jok:") && auto.has(recId.slice(4))) targets = [auto.get(recId.slice(4))];
      for (const jid of data.jokIds || []) {
        const p = auto.get(String(jid));
        if (p && !targets.includes(p)) targets.push(p);
      }
      if (!targets.length && data.name) {
        const cands = [...auto.values()].filter(p => !merged.has(p.id) && nameMatches(data.name, p.name));
        if (cands.length === 1) targets = cands;
      }

      const person = {
        id: recId, jokIds: [], name: data.name || "", teams: new Map(), family: data.family || "",
        porter: !!data.porter, disabled: !!data.disabled, notes: data.notes || "",
        manualEvents: Array.isArray(data.manualEvents) ? data.manualEvents.filter(e => e && e.id) : [],
        source: targets.length ? "fitxa+actes" : "fitxa", record: data,
      };
      const exclude = new Set(data.excludeTeams || []);
      for (const t of targets) {
        person.jokIds.push(...t.jokIds);
        if (!person.name) person.name = t.name;
        person.porter = person.porter || t.porter;
        for (const [k, v] of t.teams) if (!exclude.has(k)) person.teams.set(k, v);
        people.delete(t.id);
        merged.add(t.id);
      }
      person.linkedName = targets.map(t => t.name).join(", ");
      for (const t of data.teams || []) {
        if (!t?.key) continue;
        const prev = person.teams.get(t.key);
        person.teams.set(t.key, { key: t.key, role: ROLES[t.role] ? t.role : "juga", count: prev?.count || 0, auto: false });
      }
      // Una fitxa amb el mateix id que una altra (o un jugador ja absorbit) la substitueix.
      people.set(person.id, person);
    }

    const list = [...people.values()].map(p => ({
      ...p,
      teams: [...p.teams.values()],
      familyKey: p.family ? `f:${norm(p.family)}` : (familyKey(p.name) ? `s:${familyKey(p.name)}` : ""),
    }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    return { people: list, byId: new Map(list.map(p => [p.id, p])) };
  }

  /** Grups de germans (≥2 persones amb la mateixa família). */
  function buildFamilies(people, disabledFamilies = []) {
    const off = new Set(disabledFamilies);
    const fam = new Map();
    for (const p of people) {
      if (!p.familyKey || off.has(p.familyKey)) continue;
      if (!fam.has(p.familyKey)) fam.set(p.familyKey, []);
      fam.get(p.familyKey).push(p);
    }
    return [...fam.entries()].filter(([, m]) => m.length > 1).map(([key, members]) => ({
      key, label: key.slice(2), manual: key.startsWith("f:"), members,
    }));
  }

  // ── Model ────────────────────────────────────────────────────────────
  /**
   * Construeix tot el que cal per detectar conflictes.
   * @param {object} o { db, rosters, records:[{kind,item_id,data}], venues, isClubTeam, config }
   */
  function buildModel(o) {
    const recs = Array.isArray(o.records) ? o.records : [];
    const byKind = kind => recs.filter(r => r && r.kind === kind).map(r => ({ id: r.item_id, data: r.data || {} }));
    const configRec = byKind("config").find(r => r.id === "main");
    const cfg = { ...DEFAULT_CONFIG, ...(configRec?.data || {}), ...(o.config || {}) };
    cfg.travelOverrides = { ...(configRec?.data?.travelOverrides || {}), ...(o.config?.travelOverrides || {}) };

    const isClubTeam = o.isClubTeam || (() => false);
    const personRecs = byKind("person");

    // Equips d'altres clubs referenciats per alguna fitxa.
    const extraTeamKeys = new Set();
    for (const r of personRecs) for (const t of r.data.teams || []) if (t?.key) extraTeamKeys.add(t.key);

    const events = buildEvents(o.db, { isClubTeam, extraTeamKeys });
    const clubTeamKeys = [...new Set(events.filter(e => e.own).map(e => e.teamKey))];
    const { people, byId } = buildPeople(o.rosters, clubTeamKeys, personRecs, cfg);

    const manualEvents = [];
    for (const p of people) for (const me of p.manualEvents || []) manualEvents.push(manualEventToEvent(me, p));
    const allEvents = events.concat(manualEvents).sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity));

    const annotations = byKind("annotation").map(r => r.data).filter(a => a && a.eventKey);
    const blocks = byKind("block").map(r => ({ id: r.id, ...r.data })).filter(b => b.dayKey);
    const families = buildFamilies(people, cfg.disabledFamilies || []);
    const resolve = makeVenueResolver(o.venues || {});
    if (!cfg.homeCoords) {
      const homeName = events.find(e => e.isHome)?.home;
      const c = homeName ? resolve(homeName) : null;
      if (c) cfg.homeCoords = { lat: c.lat, lng: c.lng };
    }

    return {
      cfg, events: allEvents, clubTeamKeys, people, peopleById: byId, families,
      annotations, blocks, resolve,
      grid: cfg.grid || deriveGrid(events, cfg.gridMinCount, cfg.slotMinutes),
      teamNames: cfg.teamNames || {},
    };
  }

  /** Persona → compromisos: { teams: Map(teamKey→role), events: Map(eventKey→role) } */
  function commitmentsOf(person, annotations) {
    const teams = new Map(person.teams.map(t => [t.key, t.role]));
    const events = new Map();
    for (const me of person.manualEvents || []) events.set(`manual:${me.id}`, "juga");
    for (const a of annotations || []) {
      if ((a.personIds || []).includes(person.id)) events.set(a.eventKey, "juga");
    }
    return { teams, events };
  }

  function severityOf(roleA, roleB) {
    return ROLES[roleA]?.severity === "block" && ROLES[roleB]?.severity === "block" ? "block" : "warn";
  }

  // ── Detecció ─────────────────────────────────────────────────────────
  function conflictId(type, a, b) {
    return `${type}|${[a.key, b.key].sort().join("||")}`;
  }

  /**
   * @param {object[]} events   esdeveniments a revisar (normalment els propers)
   * @param {object} model      buildModel(...)
   */
  function detectConflicts(events, model) {
    const cfg = model.cfg;
    const resolve = model.resolve;
    const byDay = new Map();
    const byKey = new Map();
    const byTeam = new Map();
    for (const ev of events) {
      if (ev.start == null || !ev.dayKey) continue;
      byKey.set(ev.key, ev);
      if (!byDay.has(ev.dayKey)) byDay.set(ev.dayKey, []);
      byDay.get(ev.dayKey).push(ev);
      if (!byTeam.has(ev.teamKey)) byTeam.set(ev.teamKey, []);
      byTeam.get(ev.teamKey).push(ev);
    }
    const found = new Map();
    const push = c => {
      const prev = found.get(c.id);
      if (!prev) { found.set(c.id, c); return; }
      if (c.severity === "block") prev.severity = "block";
      for (const p of c.people || []) if (!prev.people.some(x => x.id === p.id)) prev.people.push(p);
    };

    // 1) Pista de casa
    for (const list of byDay.values()) {
      const home = list.filter(e => e.isHome && e.own);
      for (let i = 0; i < home.length; i++) {
        for (let j = i + 1; j < home.length; j++) {
          const a = home[i], b = home[j];
          if (a.matchKey === b.matchKey) continue; // derbi intern
          const [f, s] = a.start <= b.start ? [a, b] : [b, a];
          const gap = s.start - f.start;
          if (gap < cfg.slotMinutes) {
            push({
              id: conflictId("pista", a, b), type: "pista", severity: "block", a: f, b: s, people: [],
              gap, needed: cfg.slotMinutes, margin: gap - cfg.slotMinutes,
              message: gap === 0 ? "Dos partits a la pista a la mateixa hora" : `La pista està ocupada: només ${gap} min entre inicis (calen ${cfg.slotMinutes})`,
            });
          }
        }
      }
      for (const ev of home) {
        const bl = blockFor(model.blocks, ev.dayKey, clockToMinutes(ev.time), cfg.slotMinutes);
        if (bl) {
          push({
            id: `bloqueig|${ev.key}|${bl.id}`, type: "pista-bloquejada", severity: "block", a: ev, b: ev, people: [],
            message: `Pista no disponible ${bl.from}–${bl.to}${bl.reason ? `: ${bl.reason}` : ""}`,
          });
        }
      }
    }

    // 2) Persones
    const commitmentsById = new Map();
    for (const person of model.people) {
      if (person.disabled) continue;
      const c = commitmentsOf(person, model.annotations);
      commitmentsById.set(person.id, c);
      const mine = new Map(); // eventKey -> {ev, role}
      for (const [tk, role] of c.teams) for (const ev of byTeam.get(tk) || []) mine.set(ev.key, { ev, role });
      for (const [ek, role] of c.events) { const ev = byKey.get(ek); if (ev && !mine.has(ek)) mine.set(ek, { ev, role }); }
      if (mine.size < 2) continue;
      const days = new Map();
      for (const x of mine.values()) {
        if (!days.has(x.ev.dayKey)) days.set(x.ev.dayKey, []);
        days.get(x.ev.dayKey).push(x);
      }
      for (const list of days.values()) {
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const A = list[i], B = list[j];
            if (A.ev.matchKey === B.ev.matchKey) continue;
            const t = checkTiming(A.ev, B.ev, resolve, cfg);
            const tight = !t.same && t.margin < cfg.tightMarginMinutes;
            if (t.ok && !tight) continue;
            const [rf, rs] = t.first === A.ev ? [A.role, B.role] : [B.role, A.role];
            push({
              id: conflictId("persona", A.ev, B.ev), type: "persona",
              severity: t.ok ? "warn" : severityOf(rf, rs),
              a: t.first, b: t.second, gap: t.gap, needed: t.needed, margin: t.margin,
              travel: t.travel, sameVenue: t.same,
              people: [{ id: person.id, name: person.name, roles: [rf, rs], severity: t.ok ? "warn" : severityOf(rf, rs) }],
              message: describeTiming(t, cfg),
            });
          }
        }
      }
    }

    // 3) Germans (avís)
    for (const fam of model.families) {
      const members = fam.members.filter(p => !p.disabled && commitmentsById.has(p.id));
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const p1 = members[i], p2 = members[j];
          const c1 = commitmentsById.get(p1.id), c2 = commitmentsById.get(p2.id);
          const ev1 = eventsFor(c1, byTeam, byKey), ev2 = eventsFor(c2, byTeam, byKey);
          for (const a of ev1) {
            for (const b of ev2) {
              if (a.dayKey !== b.dayKey || a.matchKey === b.matchKey) continue;
              if (found.has(conflictId("persona", a, b))) continue;
              const t = checkTiming(a, b, resolve, cfg);
              if (t.ok) continue;
              const id = conflictId("germans", a, b);
              push({
                id, type: "germans", severity: "warn", a: t.first, b: t.second, gap: t.gap, needed: t.needed,
                margin: t.margin, travel: t.travel, sameVenue: t.same,
                people: [{ id: p1.id, name: p1.name, roles: [] }, { id: p2.id, name: p2.name, roles: [] }],
                family: fam.label, message: describeTiming(t, cfg),
              });
            }
          }
        }
      }
    }

    const out = [...found.values()];
    const sevRank = { block: 0, warn: 1 };
    out.sort((x, y) => (x.a.start - y.a.start) || (sevRank[x.severity] - sevRank[y.severity]));
    return out;
  }

  function eventsFor(c, byTeam, byKey) {
    const out = new Map();
    for (const tk of c.teams.keys()) for (const ev of byTeam.get(tk) || []) out.set(ev.key, ev);
    for (const ek of c.events.keys()) { const ev = byKey.get(ek); if (ev) out.set(ek, ev); }
    return [...out.values()];
  }

  function blockFor(blocks, dayKey, startMin, slotMinutes) {
    if (startMin == null) return null;
    for (const b of blocks || []) {
      if (b.dayKey !== dayKey) continue;
      const from = clockToMinutes(b.from), to = clockToMinutes(b.to);
      if (from == null || to == null) continue;
      if (startMin < to && startMin + slotMinutes > from) return b;
    }
    return null;
  }

  // ── Parrilla del pavelló ─────────────────────────────────────────────
  /** Franges habituals per dia de la setmana, a partir dels partits a casa programats. */
  function deriveGrid(events, minCount = 2, slotMinutes = DEFAULT_CONFIG.slotMinutes) {
    const count = new Map();
    for (const ev of events) {
      if (!ev.isHome || !ev.own || !ev.dayKey) continue;
      const t = normTime(ev.time);
      if (!t) continue;
      const k = `${weekdayOf(ev.dayKey)}|${t}`;
      count.set(k, (count.get(k) || 0) + 1);
    }
    // Per dia: hores més habituals primer, descartant les que es trepitgen amb una ja triada.
    const byDay = {};
    for (const [k, n] of count) {
      if (n < minCount) continue;
      const [wd, t] = k.split("|");
      (byDay[wd] = byDay[wd] || []).push({ t, n, m: clockToMinutes(t) });
    }
    const grid = {};
    for (const [wd, list] of Object.entries(byDay)) {
      list.sort((a, b) => (b.n - a.n) || (a.m - b.m));
      const chosen = [];
      for (const x of list) if (chosen.every(c => Math.abs(c.m - x.m) >= slotMinutes)) chosen.push(x);
      grid[wd] = chosen.map(c => c.t).sort();
    }
    return grid;
  }

  /** Estat de la pista un dia: franges (lliure/ocupada/bloquejada) + partits fora de franja. */
  function pistaDay(events, model, dayKey) {
    const cfg = model.cfg;
    const home = events.filter(e => e.isHome && e.own && e.dayKey === dayKey && e.start != null)
      .filter((e, i, arr) => arr.findIndex(x => x.matchKey === e.matchKey) === i)
      .sort((a, b) => a.start - b.start);
    const times = (model.grid?.[weekdayOf(dayKey)] || []).slice();
    const mins = times.map(clockToMinutes);
    // Partit a l'hora exacta → ocupa la franja. Partit fora de franja que la trepitja → "trepitjada".
    const slots = times.map((time, i) => {
      const s = mins[i];
      const evs = home.filter(e => clockToMinutes(e.time) === s);
      const overlapping = home.filter(e => {
        const m = clockToMinutes(e.time);
        return m != null && m !== s && Math.abs(m - s) < cfg.slotMinutes && !times.includes(normTime(e.time));
      });
      const block = blockFor(model.blocks, dayKey, s, cfg.slotMinutes);
      const status = evs.length > 1 || (evs.length && overlapping.length) ? "doble"
        : evs.length ? "ocupada" : overlapping.length ? "trepitjada" : block ? "bloquejada" : "lliure";
      return { time, events: status === "doble" ? evs.concat(overlapping) : evs, overlapping, block, status };
    });
    const offGrid = home.filter(e => !times.includes(normTime(e.time)));
    const blocks = (model.blocks || []).filter(b => b.dayKey === dayKey);
    return {
      dayKey, weekday: weekdayOf(dayKey), slots, offGrid, blocks, homeCount: home.length,
      free: slots.filter(s => s.status === "lliure").length,
    };
  }

  // ── Canvis entre dues versions de data.json ──────────────────────────
  /**
   * Partits del club que han canviat de data/hora, nous o desapareguts.
   */
  function diffMatches(prevDb, nextDb, isClubTeam) {
    const collect = db => {
      const map = new Map();
      for (const [category, comps] of Object.entries(db?.categories || {})) {
        for (const comp of comps || []) {
          for (const m of comp?.calendar || []) {
            if (!isClubTeam(m.home) && !isClubTeam(m.away)) continue;
            map.set(matchKey(comp.id, m), {
              matchKey: matchKey(comp.id, m), compId: String(comp.id), compName: comp.name || "", category,
              jornada: m.jornada ?? null, home: m.home, away: m.away,
              team: isClubTeam(m.home) ? m.home : m.away, isHome: isClubTeam(m.home),
              date: m.date || "", time: m.time || "", played: !!m.played,
            });
          }
        }
      }
      return map;
    };
    const before = collect(prevDb);
    const after = collect(nextDb);
    const out = [];
    for (const [k, m] of after) {
      const p = before.get(k);
      if (!p) { if (!m.played) out.push({ type: "nou", ...m, from: null, to: { date: m.date, time: m.time } }); continue; }
      if (p.date !== m.date || p.time !== m.time) {
        out.push({ type: "canvi", ...m, from: { date: p.date, time: p.time }, to: { date: m.date, time: m.time } });
      }
    }
    for (const [k, p] of before) {
      if (!after.has(k) && !p.played) out.push({ type: "eliminat", ...p, from: { date: p.date, time: p.time }, to: null });
    }
    return out;
  }

  // ── Propostes i simulació ────────────────────────────────────────────
  function moveEvent(ev, newDate, newTime) {
    const date = toJokDate(newDate);
    return {
      ...ev,
      date,
      time: normTime(newTime),
      dayKey: dayKeyOf(date),
      start: toMinutes(date, newTime),
      original: ev.original || { date: ev.date, time: ev.time },
    };
  }

  /**
   * Aplica propostes pendents. Si jok.cat ja mostra la data proposada, la proposta
   * es marca com a oficialitzada i no cal moure res.
   */
  function applyProposals(events, proposals = []) {
    const map = new Map();
    const status = {};
    for (const p of proposals) {
      if (!p || p.status === "rebutjada") continue;
      map.set(p.eventKey, p);
    }
    const out = events.map(ev => {
      const p = map.get(ev.key);
      if (!p) return ev;
      const moved = moveEvent(ev, p.newDate, p.newTime);
      if (moved.start != null && moved.start === ev.start) {
        status[p.id] = "oficial";
        return ev;
      }
      status[p.id] = "pendent";
      return { ...moved, proposalId: p.id };
    });
    for (const p of proposals) if (p && !status[p.id]) status[p.id] = p.status === "rebutjada" ? "rebutjada" : "sense-partit";
    return { events: out, status };
  }

  function conflictsFor(conflicts, key) {
    return conflicts.filter(c => c.a.key === key || c.b.key === key);
  }

  /** Mateix partit, mateix moviment, per a tots els equips (derbis interns). */
  function siblingsOf(events, ev) {
    return events.filter(e => e.matchKey === ev.matchKey);
  }

  function simulateChange(events, model, eventKey, newDate, newTime) {
    const target = events.find(e => e.key === eventKey);
    if (!target) return null;
    const moved = moveEvent(target, newDate, newTime);
    const nextEvents = events.map(e => (e.matchKey === target.matchKey ? moveEvent(e, newDate, newTime) : e));
    const days = new Set([target.dayKey, moved.dayKey]);
    const sameMatch = new Set(siblingsOf(events, target).map(e => e.key));
    const touches = c => sameMatch.has(c.a.key) || sameMatch.has(c.b.key);
    const before = detectConflicts(events.filter(e => days.has(e.dayKey)), model).filter(touches);
    const after = detectConflicts(nextEvents.filter(e => days.has(e.dayKey)), model).filter(touches);
    const beforeIds = new Set(before.map(c => c.id));
    const afterIds = new Set(after.map(c => c.id));
    const slot = target.isHome ? slotStatus(nextEvents, model, moved) : null;
    return {
      event: target,
      moved,
      before,
      after,
      introduced: after.filter(c => !beforeIds.has(c.id)),
      resolved: before.filter(c => !afterIds.has(c.id)),
      blocks: after.filter(c => c.severity === "block").length,
      warns: after.filter(c => c.severity === "warn").length,
      slot,
    };
  }

  /** Per a un partit a casa: és a una franja habitual? */
  function slotStatus(events, model, ev) {
    const times = model.grid?.[weekdayOf(ev.dayKey)] || [];
    return { inGrid: times.includes(normTime(ev.time)), gridTimes: times };
  }

  /**
   * Busca hores sense bloquejos per moure un partit. Per als partits a casa prova
   * primer les franges habituals de la parrilla.
   */
  function suggestSlots(events, model, eventKey, opts = {}) {
    const target = events.find(e => e.key === eventKey);
    if (!target) return [];
    const days = opts.dayKeys?.length ? opts.dayKeys : weekendDays(target.dayKey);
    const from = clockToMinutes(opts.from || "09:00");
    const to = clockToMinutes(opts.to || "21:00");
    const step = opts.stepMinutes || 15;
    const limit = opts.limit || 24;
    const out = [];
    for (const day of days) {
      const gridTimes = target.isHome ? (model.grid?.[weekdayOf(day)] || []) : [];
      const candidates = new Set(gridTimes);
      if (!opts.gridOnly || !target.isHome) for (let m = from; m <= to; m += step) candidates.add(minutesToClock(m));
      for (const time of candidates) {
        if (day === target.dayKey && time === normTime(target.time)) continue;
        const sim = simulateChange(events, model, eventKey, day, time);
        if (!sim || sim.blocks > 0) continue;
        const origin = target.start ?? sim.moved.start;
        out.push({ dayKey: day, time, warns: sim.warns, inGrid: gridTimes.includes(time), distance: Math.abs(sim.moved.start - origin) });
      }
    }
    out.sort((a, b) => (Number(b.inGrid) - Number(a.inGrid)) || (a.warns - b.warns) || (a.distance - b.distance));
    return out.slice(0, limit);
  }

  return {
    DEFAULT_CONFIG, ROLES, WEEKDAYS,
    parseDate, parseTime, dayKeyOf, toJokDate, normTime, toMinutes, minutesToClock, clockToMinutes,
    weekdayOf, addDays, weekendDays,
    norm, stripTeamSuffix, nameTokens, familyKey, nameMatches, pairKey, matchKey,
    buildEvents, buildClubEvents, manualEventToEvent, makeVenueResolver, haversineKm, travelBetween,
    checkTiming, describeTiming,
    buildPeople, buildFamilies, buildModel, commitmentsOf, detectConflicts,
    deriveGrid, pistaDay, diffMatches,
    moveEvent, applyProposals, simulateChange, suggestSlots,
  };
});
