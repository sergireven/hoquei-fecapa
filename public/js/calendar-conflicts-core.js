/**
 * Motor de conflictes de calendari per al panell de coordinador.
 *
 * Codi pur (sense DOM) perquè es pugui provar amb `node --test`.
 * Al navegador queda exposat com `window.CalendarConflicts`.
 *
 * Regles:
 *  - Pista (bloqueig): dos partits a casa del club que es trepitgen a la pista.
 *  - Jugador (bloqueig): dos equips que comparteixen jugadors (segons les actes o
 *    enllaços manuals). Casa→casa només cal que no es solapin; si algun és fora,
 *    cal temps de partit + desplaçament + arribada prèvia.
 *  - Germans (avís): germans en equips diferents amb horaris incompatibles.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CalendarConflicts = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_CONFIG = Object.freeze({
    slotMinutes: 75,          // ocupació de pista per partit a casa
    busyMinutes: 75,          // temps que el jugador està ocupat (escalfament + partit)
    preMatchMinutes: 30,      // arribada abans del segon partit quan hi ha desplaçament
    defaultTravelMinutes: 45, // si no coneixem la pista
    travelSpeedKmh: 50,
    roadFactor: 1.3,          // km per carretera ≈ km en línia recta × factor
    parkingMinutes: 10,
    tightMarginMinutes: 15,   // per sota d'aquest marge → avís "molt just"
    minAppearances: 1,        // actes mínimes per considerar que un jugador juga en un equip
  });

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
    const m = String(time || "").trim().match(/^(\d{1,2})[:.h](\d{2})/);
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

  function weekendDays(dayKey) {
    const p = parseDate(dayKey);
    if (!p) return [];
    const d = new Date(Date.UTC(p.y, p.mo - 1, p.d));
    const dow = d.getUTCDay(); // 0 diumenge … 6 dissabte
    const toSat = dow === 0 ? -1 : 6 - dow;
    const sat = new Date(d.getTime() + toSat * 86400000);
    const sun = new Date(sat.getTime() + 86400000);
    const k = x => `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
    return [k(sat), k(sun)];
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

  function matchKey(compId, m) {
    return `${compId}|${m.jornada ?? ""}|${m.home}|${m.away}`;
  }

  // ── Esdeveniments del club ───────────────────────────────────────────
  /**
   * @param {object} db  data.json
   * @param {(teamName:string)=>boolean} isClubTeam
   * @returns {Array} partits on juga algun equip del club
   */
  function buildClubEvents(db, isClubTeam) {
    const out = [];
    for (const [category, comps] of Object.entries(db?.categories || {})) {
      for (const comp of comps || []) {
        for (const m of comp?.calendar || []) {
          const homeIsClub = isClubTeam(m.home);
          const awayIsClub = isClubTeam(m.away);
          if (!homeIsClub && !awayIsClub) continue;
          // Derbi intern: dos esdeveniments (un per equip) però mateixa pista.
          const sides = [];
          if (homeIsClub) sides.push("home");
          if (awayIsClub) sides.push("away");
          for (const side of sides) {
            const team = String(m[side] || "").trim();
            const ev = {
              key: matchKey(comp.id, m) + (sides.length > 1 ? `#${side}` : ""),
              matchKey: matchKey(comp.id, m),
              compId: String(comp.id),
              compName: comp.name || "",
              category,
              jornada: m.jornada ?? null,
              team,
              teamKey: `${comp.id}|${team}`,
              isHome: side === "home",
              home: m.home,
              away: m.away,
              opponent: side === "home" ? m.away : m.home,
              venueTeam: m.home,
              date: m.date || "",
              time: m.time || "",
              dayKey: dayKeyOf(m.date),
              start: toMinutes(m.date, m.time),
              played: !!m.played,
              derby: sides.length > 1,
            };
            out.push(ev);
          }
        }
      }
    }
    out.sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity));
    return out;
  }

  // ── Pistes i desplaçaments ───────────────────────────────────────────
  function haversineKm(a, b) {
    const R = Math.PI / 180;
    const dLat = (b.lat - a.lat) * R;
    const dLng = (b.lng - a.lng) * R;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

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

  // Paraules massa genèriques per decidir que dos noms són el mateix club.
  const VENUE_STOPWORDS = new Set(["club", "pati", "hoquei", "esports", "esportiva", "esportiu", "futbol",
    "union", "unio", "sant", "santa", "cpi", "chp", "ceh", "ueh", "cch", "the"]);

  function sameVenue(a, b, resolve) {
    if (a.isHome && b.isHome) return true;
    if (norm(a.venueTeam) === norm(b.venueTeam)) return true;
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
    const ca = resolve ? resolve(a.venueTeam) : null;
    const cb = resolve ? resolve(b.venueTeam) : null;
    if (!ca || !cb) return { minutes: cfg.defaultTravelMinutes, km: null, estimated: true };
    const km = haversineKm(ca, cb) * cfg.roadFactor;
    const minutes = Math.round((km / cfg.travelSpeedKmh) * 60 + cfg.parkingMinutes);
    return { minutes, km: Math.round(km), estimated: false };
  }

  // ── Enllaços entre equips (jugadors compartits i germans) ────────────
  function pairKey(a, b) { return a < b ? `${a}||${b}` : `${b}||${a}`; }

  function familyKey(name) {
    const t = norm(name).split(" ").filter(Boolean);
    if (t.length < 3) return "";
    return t.slice(-2).join(" ");
  }

  /**
   * @param {object} rosters team-rosters.json
   * @param {string[]} clubTeamKeys  claus "compId|equip" del club
   * @param {object} overrides { disabledPlayers:[id], extraLinks:[{name, teams:[k]}],
   *                             disabledFamilies:[familyKey], extraSiblings:[{names:[..], teams:[k]}] }
   */
  function buildLinks(rosters, clubTeamKeys, config = {}, overrides = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const clubKeys = new Set(clubTeamKeys);
    const disabled = new Set((overrides.disabledPlayers || []).map(String));
    const disabledFamilies = new Set(overrides.disabledFamilies || []);
    const playerTeams = new Map(); // id -> Map(teamKey -> count)

    for (const key of clubKeys) {
      const team = rosters?.teams?.[key];
      if (!team) continue;
      for (const [id, count] of Object.entries(team.players || {})) {
        if (count < cfg.minAppearances) continue;
        if (!playerTeams.has(id)) playerTeams.set(id, new Map());
        playerTeams.get(id).set(key, count);
      }
    }

    const nameOf = id => rosters?.players?.[id]?.name || `Jugador ${id}`;
    const players = new Map(); // pairKey -> [{id,name,counts}]
    const addPlayerLink = (k1, k2, p) => {
      if (k1 === k2) return;
      const pk = pairKey(k1, k2);
      if (!players.has(pk)) players.set(pk, []);
      const list = players.get(pk);
      if (!list.some(x => x.id === p.id)) list.push(p);
    };

    for (const [id, teams] of playerTeams) {
      if (disabled.has(id) || teams.size < 2) continue;
      const keys = [...teams.keys()];
      const p = { id, name: nameOf(id), counts: Object.fromEntries(teams), manual: false };
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) addPlayerLink(keys[i], keys[j], p);
      }
    }
    for (const [idx, link] of (overrides.extraLinks || []).entries()) {
      const keys = (link.teams || []).filter(k => clubKeys.has(k));
      const p = { id: `manual-${idx}`, name: link.name || "Reforç manual", counts: {}, manual: true };
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) addPlayerLink(keys[i], keys[j], p);
      }
    }

    // Germans: mateixos dos cognoms, ids diferents. Fem servir l'equip principal de cadascun.
    const families = new Map(); // familyKey -> [{id,name,primary}]
    for (const [id, teams] of playerTeams) {
      const fk = familyKey(nameOf(id));
      if (!fk || disabledFamilies.has(fk)) continue;
      const primary = [...teams.entries()].sort((a, b) => b[1] - a[1])[0][0];
      if (!families.has(fk)) families.set(fk, []);
      families.get(fk).push({ id, name: nameOf(id), primary });
    }
    const siblings = new Map(); // pairKey -> [{family, names}]
    const familyList = [];
    const addSibling = (k1, k2, family, names) => {
      if (k1 === k2) return;
      const pk = pairKey(k1, k2);
      if (!siblings.has(pk)) siblings.set(pk, []);
      siblings.get(pk).push({ family, names });
    };
    for (const [fk, members] of families) {
      if (members.length < 2) continue;
      familyList.push({ family: fk, members: members.map(m => ({ name: m.name, teamKey: m.primary })) });
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          addSibling(members[i].primary, members[j].primary, fk, [members[i].name, members[j].name]);
        }
      }
    }
    for (const g of overrides.extraSiblings || []) {
      const keys = (g.teams || []).filter(k => clubKeys.has(k));
      familyList.push({ family: (g.names || []).join(" / "), manual: true, members: keys.map((k, i) => ({ name: g.names?.[i] || "", teamKey: k })) });
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) addSibling(keys[i], keys[j], "manual", g.names || []);
      }
    }

    return { players, siblings, families: familyList, playerTeams };
  }

  // ── Detecció ─────────────────────────────────────────────────────────
  function conflictId(type, a, b) {
    return `${type}|${[a.key, b.key].sort().join("||")}`;
  }

  /** Comprova si un jugador pot fer els dos partits. */
  function checkTiming(a, b, resolve, cfg) {
    const [first, second] = a.start <= b.start ? [a, b] : [b, a];
    const gap = second.start - first.start;
    const same = sameVenue(first, second, resolve);
    const travel = same ? { minutes: 0, km: 0, estimated: false } : travelBetween(first, second, resolve, cfg);
    const needed = same ? cfg.busyMinutes : cfg.busyMinutes + travel.minutes + cfg.preMatchMinutes;
    return { first, second, gap, needed, margin: gap - needed, same, travel, ok: gap >= needed };
  }

  function detectConflicts(events, links, resolve, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const out = [];
    const byDay = new Map();
    for (const ev of events) {
      if (ev.start == null || !ev.dayKey) continue;
      if (!byDay.has(ev.dayKey)) byDay.set(ev.dayKey, []);
      byDay.get(ev.dayKey).push(ev);
    }

    for (const list of byDay.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i], b = list[j];
          if (a.matchKey === b.matchKey) continue; // derbi intern: un sol partit

          // 1) Pista de casa
          if (a.isHome && b.isHome) {
            const [f, s] = a.start <= b.start ? [a, b] : [b, a];
            const gap = s.start - f.start;
            if (gap < cfg.slotMinutes) {
              out.push({
                id: conflictId("pista", a, b), type: "pista", severity: "block", a: f, b: s,
                gap, needed: cfg.slotMinutes, margin: gap - cfg.slotMinutes,
                message: gap === 0 ? "Dos partits a la pista a la mateixa hora" : `La pista està ocupada: només ${gap} min entre inicis (calen ${cfg.slotMinutes})`,
              });
            }
          }

          if (a.teamKey === b.teamKey) continue;
          const pk = pairKey(a.teamKey, b.teamKey);

          // 2) Jugadors compartits
          const shared = links?.players?.get(pk);
          if (shared?.length) {
            const t = checkTiming(a, b, resolve, cfg);
            // Casa→casa seguits no és problema; el "molt just" només té sentit amb desplaçament.
            if (!t.ok || (!t.same && t.margin < cfg.tightMarginMinutes)) {
              out.push({
                id: conflictId("jugador", a, b), type: "jugador", severity: t.ok ? "warn" : "block",
                a: t.first, b: t.second, gap: t.gap, needed: t.needed, margin: t.margin,
                travel: t.travel, sameVenue: t.same, players: shared.map(p => p.name),
                message: describeTiming(t, cfg),
              });
            }
          }

          // 3) Germans (avís)
          const sib = links?.siblings?.get(pk);
          if (sib?.length && !shared?.length) {
            const t = checkTiming(a, b, resolve, cfg);
            if (!t.ok) {
              out.push({
                id: conflictId("germans", a, b), type: "germans", severity: "warn",
                a: t.first, b: t.second, gap: t.gap, needed: t.needed, margin: t.margin,
                travel: t.travel, sameVenue: t.same, players: [...new Set(sib.flatMap(s => s.names))],
                message: describeTiming(t, cfg),
              });
            }
          }
        }
      }
    }

    const sevRank = { block: 0, warn: 1 };
    out.sort((x, y) => (x.a.start - y.a.start) || (sevRank[x.severity] - sevRank[y.severity]));
    return out;
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

  // ── Canvis respecte a la darrera revisió ─────────────────────────────
  function snapshotOf(events) {
    const snap = {};
    for (const ev of events) snap[ev.key] = `${ev.date} ${ev.time}`.trim();
    return snap;
  }

  function diffSnapshot(prev, events) {
    const changed = [], added = [], removed = [];
    if (!prev || typeof prev !== "object") return { changed, added, removed, baseline: true };
    const now = new Map(events.map(ev => [ev.key, ev]));
    for (const ev of events) {
      const cur = `${ev.date} ${ev.time}`.trim();
      if (!(ev.key in prev)) added.push(ev);
      else if (prev[ev.key] !== cur) changed.push({ event: ev, from: prev[ev.key], to: cur });
    }
    for (const key of Object.keys(prev)) if (!now.has(key)) removed.push({ key, from: prev[key] });
    return { changed, added, removed, baseline: false };
  }

  // ── Propostes i simulació ────────────────────────────────────────────
  function moveEvent(ev, newDate, newTime) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(newDate) ? newDate.split("-").reverse().join("-") : newDate;
    return {
      ...ev,
      date,
      time: newTime,
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

  function simulateChange(events, links, resolve, config, eventKey, newDate, newTime) {
    const target = events.find(e => e.key === eventKey);
    if (!target) return null;
    const moved = moveEvent(target, newDate, newTime);
    const nextEvents = events.map(e => (e.key === eventKey ? moved : e));
    // Només cal recalcular el dia d'origen i el de destí.
    const days = new Set([target.dayKey, moved.dayKey]);
    const before = conflictsFor(detectConflicts(events.filter(e => days.has(e.dayKey)), links, resolve, config), eventKey);
    const after = conflictsFor(detectConflicts(nextEvents.filter(e => days.has(e.dayKey)), links, resolve, config), eventKey);
    const beforeIds = new Set(before.map(c => c.id));
    const afterIds = new Set(after.map(c => c.id));
    return {
      event: target,
      moved,
      before,
      after,
      introduced: after.filter(c => !beforeIds.has(c.id)),
      resolved: before.filter(c => !afterIds.has(c.id)),
      blocks: after.filter(c => c.severity === "block").length,
      warns: after.filter(c => c.severity === "warn").length,
    };
  }

  /**
   * Busca franges lliures (sense bloquejos) per moure un partit.
   * @param {string[]} dayKeys  dies YYYY-MM-DD a provar (per defecte, el cap de setmana del partit)
   */
  function suggestSlots(events, links, resolve, config, eventKey, opts = {}) {
    const target = events.find(e => e.key === eventKey);
    if (!target) return [];
    const days = opts.dayKeys?.length ? opts.dayKeys : weekendDays(target.dayKey);
    const from = parseTime(opts.from || "09:00");
    const to = parseTime(opts.to || "21:00");
    const step = opts.stepMinutes || 15;
    const limit = opts.limit || 12;
    const out = [];
    for (const day of days) {
      for (let m = from.h * 60 + from.mi; m <= to.h * 60 + to.mi; m += step) {
        const time = minutesToClock(m);
        if (day === target.dayKey && time === target.time) continue;
        const sim = simulateChange(events, links, resolve, config, eventKey, day, time);
        if (!sim || sim.blocks > 0) continue;
        const origin = target.start ?? sim.moved.start;
        out.push({ dayKey: day, time, warns: sim.warns, distance: Math.abs(sim.moved.start - origin) });
      }
    }
    out.sort((a, b) => (a.warns - b.warns) || (a.distance - b.distance));
    return out.slice(0, limit);
  }

  return {
    DEFAULT_CONFIG,
    parseDate, parseTime, dayKeyOf, toMinutes, minutesToClock, weekendDays,
    norm, stripTeamSuffix, familyKey, pairKey,
    buildClubEvents, makeVenueResolver, haversineKm, travelBetween,
    buildLinks, detectConflicts, checkTiming,
    snapshotOf, diffSnapshot,
    moveEvent, applyProposals, simulateChange, suggestSlots,
  };
});
