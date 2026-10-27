const test = require('node:test');
const assert = require('node:assert/strict');
const CC = require('../public/js/calendar-conflicts-core');
const { buildTeamRosters } = require('../jobs/build-team-rosters');

const CLUB = n => /ripollet/i.test(n);

const venues = {
  'Ch Ripollet A': { lat: 41.5015, lng: 2.1569 },
  'Martinelia Manlleu B': { lat: 42.0, lng: 2.28 },   // ~56 km
  'Cp Vilafranca Ako B': { lat: 41.35, lng: 1.70 },   // ~42 km
  'Mollet Hc A': { lat: 41.54, lng: 2.21 },           // ~6 km
};

function db(calendars) {
  return {
    season: '2026-27',
    categories: Object.fromEntries(Object.entries(calendars).map(([cat, comps]) => [cat, comps])),
  };
}

const DATA = db({
  'Prebenjamí': [{ id: '1', name: 'PREBE', calendar: [
    { jornada: 1, home: 'Cp Vilafranca Ako A A', away: 'Ch Ripollet A', date: '01-11-2026', time: '10:00', played: false, actaId: 'a1' },
    { jornada: 2, home: 'Ch Ripollet A', away: 'Mollet Hc A', date: '08-11-2026', time: '10:00', played: false },
  ] }],
  'Benjamí': [{ id: '2', name: 'BENJ', calendar: [
    { jornada: 1, home: 'Martinelia Manlleu B', away: 'Ch Ripollet C', date: '01-11-2026', time: '10:00', played: false, actaId: 'b1' },
    { jornada: 2, home: 'Ch Ripollet C', away: 'Mollet Hc A', date: '08-11-2026', time: '11:15', played: false },
  ] }],
  'Aleví': [{ id: '3', name: 'ALEVI', calendar: [
    { jornada: 2, home: 'Ch Ripollet B', away: 'Mollet Hc A', date: '08-11-2026', time: '11:45', played: false, actaId: 'c1' },
  ] }],
});

const ACTES = [{
  a1: { playerStats: { awayPlayers: [
    { jugadorId: '10', url: 'https://jok.cat/jugador/10/BERNAT+REVENTOS+PLAZA' },
    { jugadorId: '11', url: 'https://jok.cat/jugador/11/JON+SANCHEZ+POLO' },
  ] } },
  b1: { playerStats: { awayPlayers: [
    { jugadorId: '10', url: 'https://jok.cat/jugador/10/BERNAT+REVENTOS+PLAZA' },
  ] } },
  c1: { playerStats: { homePlayers: [
    { jugadorId: '20', url: 'https://jok.cat/jugador/20/GENIS+REVENTOS+PLAZA' },
  ] } },
}];

function setup(config = {}) {
  const rosters = buildTeamRosters(DATA, ACTES);
  const events = CC.buildClubEvents(DATA, CLUB);
  const links = CC.buildLinks(rosters, [...new Set(events.map(e => e.teamKey))], config);
  const resolve = CC.makeVenueResolver(venues);
  return { rosters, events, links, resolve };
}

test('rosters: compta aparicions per equip i nom des de la URL', () => {
  const { rosters } = setup();
  assert.equal(rosters.teams['1|Ch Ripollet A'].players['10'], 1);
  assert.equal(rosters.players['10'].name, 'BERNAT REVENTOS PLAZA');
});

test('jugador que dobla: dos partits fora a la mateixa hora és bloqueig', () => {
  const { events, links, resolve } = setup();
  const conflicts = CC.detectConflicts(events, links, resolve);
  const c = conflicts.find(x => x.type === 'jugador' && x.a.dayKey === '2026-11-01');
  assert.ok(c, 'hauria de detectar el conflicte del Bernat');
  assert.equal(c.severity, 'block');
  assert.deepEqual(c.players, ['BERNAT REVENTOS PLAZA']);
});

test('casa→casa seguits no genera cap conflicte de jugador', () => {
  const { events, links, resolve } = setup();
  const conflicts = CC.detectConflicts(events, links, resolve);
  assert.equal(conflicts.filter(x => x.type === 'jugador' && x.a.dayKey === '2026-11-08').length, 0);
});

test('pista: partits a casa que es trepitgen són bloqueig', () => {
  const { events, links, resolve } = setup();
  const conflicts = CC.detectConflicts(events, links, resolve);
  const pista = conflicts.filter(x => x.type === 'pista');
  // 11:15 i 11:45 → només 30 min; 10:00 i 11:15 → 75 min, correcte
  assert.equal(pista.length, 1);
  assert.equal(pista[0].a.time, '11:15');
  assert.equal(pista[0].b.time, '11:45');
});

test('germans: només avís, mai bloqueig', () => {
  const { events, links, resolve } = setup();
  assert.ok(links.families.some(f => f.family === 'reventos plaza'));
  const conflicts = CC.detectConflicts(events, links, resolve);
  for (const c of conflicts.filter(x => x.type === 'germans')) assert.equal(c.severity, 'warn');
});

test('desplaçament: cal partit + trajecte + arribada', () => {
  const { events, resolve } = setup();
  const prebe = events.find(e => e.dayKey === '2026-11-01' && e.team === 'Ch Ripollet A');
  const benj = events.find(e => e.dayKey === '2026-11-01' && e.team === 'Ch Ripollet C');
  const later = CC.moveEvent(benj, '2026-11-01', '15:00');
  const t = CC.checkTiming(prebe, later, resolve, CC.DEFAULT_CONFIG);
  assert.equal(t.same, false);
  assert.equal(t.needed, 75 + t.travel.minutes + 30);
  assert.equal(t.ok, true);
});

test('simulador: moure el Benjamí C a la tarda resol el conflicte', () => {
  const { events, links, resolve } = setup();
  const benj = events.find(e => e.dayKey === '2026-11-01' && e.team === 'Ch Ripollet C');
  const sim = CC.simulateChange(events, links, resolve, {}, benj.key, '2026-11-01', '17:00');
  assert.equal(sim.blocks, 0);
  assert.ok(sim.resolved.some(c => c.type === 'jugador'));
});

test('suggeriments: cap franja proposada té bloquejos', () => {
  const { events, links, resolve } = setup();
  const benj = events.find(e => e.dayKey === '2026-11-08' && e.team === 'Ch Ripollet C');
  const slots = CC.suggestSlots(events, links, resolve, {}, benj.key, { dayKeys: ['2026-11-08'] });
  assert.ok(slots.length > 0);
  for (const s of slots) {
    const sim = CC.simulateChange(events, links, resolve, {}, benj.key, s.dayKey, s.time);
    assert.equal(sim.blocks, 0);
  }
});

test('propostes: pendent fins que jok.cat mostra la nova hora', () => {
  const { events } = setup();
  const ev = events[0];
  const p = { id: 'p1', eventKey: ev.key, newDate: '2026-11-01', newTime: '18:00' };
  const r1 = CC.applyProposals(events, [p]);
  assert.equal(r1.status.p1, 'pendent');
  const official = events.map(e => (e.key === ev.key ? { ...e, time: '18:00', start: CC.toMinutes(e.date, '18:00') } : e));
  assert.equal(CC.applyProposals(official, [p]).status.p1, 'oficial');
});

test('canvis: detecta partits moguts respecte a la darrera revisió', () => {
  const { events } = setup();
  const snap = CC.snapshotOf(events);
  const moved = events.map((e, i) => (i === 0 ? { ...e, time: '12:00' } : e));
  const diff = CC.diffSnapshot(snap, moved);
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.changed[0].to.endsWith('12:00'), true);
});

test('resolutor de pistes: no confon clubs per paraules genèriques', () => {
  const resolve = CC.makeVenueResolver({ 'Club Pati Tordera': { lat: 41.7, lng: 2.7 } });
  assert.equal(resolve('Club Patí Roda A'), null);
  assert.ok(resolve('Club Pati Tordera A'));
});
