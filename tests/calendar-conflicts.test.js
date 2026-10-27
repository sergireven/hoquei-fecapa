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
  'Vicio Phc Sant Cugat': { lat: 41.47, lng: 2.08 },  // ~8 km
};

const DATA = {
  season: '2026-27',
  categories: {
    'Prebenjamí': [{ id: '1', name: 'PREBE', calendar: [
      { jornada: 1, home: 'Cp Vilafranca Ako A A', away: 'Ch Ripollet A', date: '01-11-2026', time: '10:00', played: false, actaId: 'a1' },
      { jornada: 2, home: 'Ch Ripollet A', away: 'Mollet Hc A', date: '08-11-2026', time: '10:00', played: false },
      { jornada: 3, home: 'Ch Ripollet A', away: 'Mollet Hc A', date: '15-11-2026', time: '10:00', played: false },
    ] }],
    'Benjamí': [{ id: '2', name: 'BENJ', calendar: [
      { jornada: 1, home: 'Martinelia Manlleu B', away: 'Ch Ripollet C', date: '01-11-2026', time: '10:00', played: false, actaId: 'b1' },
      { jornada: 2, home: 'Ch Ripollet C', away: 'Mollet Hc A', date: '08-11-2026', time: '11:15', played: false },
      { jornada: 3, home: 'Ch Ripollet C', away: 'Mollet Hc A', date: '15-11-2026', time: '11:15', played: false },
    ] }],
    'Aleví': [{ id: '3', name: 'ALEVI', calendar: [
      { jornada: 2, home: 'Ch Ripollet B', away: 'Mollet Hc A', date: '08-11-2026', time: '11:45', played: false, actaId: 'c1' },
    ] }],
    '3ª Catalana': [{ id: '4', name: '3A CATALANA', calendar: [
      { jornada: 2, home: 'Mollet Hc A', away: 'Ch Ripollet', date: '08-11-2026', time: '12:00', played: false, actaId: 'd1' },
    ] }],
    'Fem': [{ id: '9', name: 'FEM 19', calendar: [
      { jornada: 2, home: 'Vicio Phc Sant Cugat', away: 'Cp Congres', date: '15-11-2026', time: '10:30', played: false },
    ] }],
  },
};

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
  d1: { playerStats: { awayPlayers: [
    { jugadorId: '30', url: 'https://jok.cat/jugador/30/HUGO+LACHICA+BOSCH' },
  ] } },
}];

function model(records = []) {
  const rosters = buildTeamRosters(DATA, ACTES);
  return CC.buildModel({ db: DATA, rosters, records, venues, isClubTeam: CLUB });
}

const find = (m, day, team) => m.events.find(e => e.dayKey === day && e.team === team);

test('rosters: compta aparicions per equip i nom des de la URL', () => {
  const rosters = buildTeamRosters(DATA, ACTES);
  assert.equal(rosters.teams['1|Ch Ripollet A'].players['10'], 1);
  assert.equal(rosters.players['10'].name, 'BERNAT REVENTOS PLAZA');
});

test('jugador que dobla: dos partits fora a la mateixa hora és bloqueig', () => {
  const m = model();
  const c = CC.detectConflicts(m.events, m).find(x => x.type === 'persona' && x.a.dayKey === '2026-11-01');
  assert.ok(c);
  assert.equal(c.severity, 'block');
  assert.deepEqual(c.people.map(p => p.name), ['BERNAT REVENTOS PLAZA']);
});

test('casa→casa seguits no genera conflicte de persona', () => {
  const m = model([{ kind: 'person', item_id: 'p1', data: { name: 'Test', teams: [{ key: '1|Ch Ripollet A', role: 'juga' }, { key: '2|Ch Ripollet C', role: 'juga' }] } }]);
  const cs = CC.detectConflicts(m.events, m).filter(x => x.type === 'persona' && x.a.dayKey === '2026-11-08');
  assert.equal(cs.length, 0);
});

test('entrenador que també juga: fitxa "Hugo Lachica" es fusiona amb l\'acta i bloqueja', () => {
  const m = model([{ kind: 'person', item_id: 'p_hugo', data: { name: 'Hugo Lachica', teams: [{ key: '2|Ch Ripollet C', role: 'entrena' }] } }]);
  const hugo = m.people.find(p => p.id === 'p_hugo');
  assert.equal(hugo.jokIds[0], '30');
  assert.ok(!m.people.some(p => p.id === 'jok:30'), 'no ha de quedar duplicat');
  // Entrena Benjamí C a casa 11:15 i juga 3a a Mollet a les 12:00 → no dona temps
  const c = CC.detectConflicts(m.events, m).find(x => x.type === 'persona' && x.people.some(p => p.id === 'p_hugo'));
  assert.ok(c);
  assert.equal(c.severity, 'block');
  assert.deepEqual(c.people[0].roles, ['entrena', 'juga']);
});

test('ajudant/delegat només genera avís', () => {
  const m = model([{ kind: 'person', item_id: 'p_d', data: { name: 'Delegat X', teams: [{ key: '1|Ch Ripollet A', role: 'ajuda' }, { key: '2|Ch Ripollet C', role: 'juga' }] } }]);
  const c = CC.detectConflicts(m.events, m).find(x => x.people.some(p => p.id === 'p_d') && x.a.dayKey === '2026-11-01');
  assert.equal(c.people.find(p => p.id === 'p_d').severity, 'warn');
  assert.equal(c.severity, 'block'); // el Bernat sí que juga als dos
});

test('equip d\'un altre club (Fem 19 Sant Cugat) entra al calendari de la persona', () => {
  const m = model([{ kind: 'person', item_id: 'p_alba', data: { name: 'Alba X', teams: [{ key: '2|Ch Ripollet C', role: 'entrena' }, { key: '9|Vicio Phc Sant Cugat', role: 'juga' }] } }]);
  const ext = m.events.find(e => e.teamKey === '9|Vicio Phc Sant Cugat');
  assert.ok(ext && !ext.own && !ext.isHome);
  const c = CC.detectConflicts(m.events, m).find(x => x.people.some(p => p.id === 'p_alba'));
  assert.ok(c, 'Sant Cugat 10:30 + Ripollet 11:15 → no dona temps');
});

test('partit manual (OK Plata) compta com a compromís', () => {
  const m = model([{ kind: 'person', item_id: 'p_m', data: { name: 'Miras', teams: [{ key: '1|Ch Ripollet A', role: 'entrena' }],
    manualEvents: [{ id: 'ok1', title: 'OK Plata Cerdanyola', date: '2026-11-15', time: '10:30', place: 'Cerdanyola' }] } }]);
  const c = CC.detectConflicts(m.events, m).find(x => x.people.some(p => p.id === 'p_m'));
  assert.ok(c);
});

test('porter de la rotació: l\'anotació el compromet a aquell partit', () => {
  const m = model([
    { kind: 'person', item_id: 'p_k', data: { name: 'Kael', teams: [{ key: '2|Ch Ripollet C', role: 'juga' }] } },
    { kind: 'annotation', item_id: 'x', data: { eventKey: '1|1|Cp Vilafranca Ako A A|Ch Ripollet A', type: 'porter', personIds: ['p_k'] } },
  ]);
  const c = CC.detectConflicts(m.events, m).find(x => x.people.some(p => p.id === 'p_k'));
  assert.ok(c);
  assert.equal(c.a.dayKey, '2026-11-01');
});

test('pista: partits a casa que es trepitgen són bloqueig', () => {
  const m = model();
  const pista = CC.detectConflicts(m.events, m).filter(x => x.type === 'pista');
  assert.equal(pista.length, 1);
  assert.equal(pista[0].a.time, '11:15');
  assert.equal(pista[0].b.time, '11:45');
});

test('pista bloquejada: partit a casa dins del bloqueig és bloqueig', () => {
  const m = model([{ kind: 'block', item_id: 'b1', data: { dayKey: '2026-11-15', from: '09:00', to: '10:30', reason: 'Escola' } }]);
  const c = CC.detectConflicts(m.events, m).find(x => x.type === 'pista-bloquejada');
  assert.ok(c);
  assert.match(c.message, /Escola/);
});

test('germans: només avís, mai bloqueig', () => {
  const m = model();
  assert.ok(m.families.some(f => f.label === 'reventos plaza'));
  for (const c of CC.detectConflicts(m.events, m).filter(x => x.type === 'germans')) assert.equal(c.severity, 'warn');
});

test('parrilla: franges habituals derivades dels partits a casa', () => {
  const m = model();
  assert.deepEqual(m.grid.dg, ['10:00', '11:15']); // 2 vegades cadascuna
  const day = CC.pistaDay(m.events, m, '2026-11-08');
  assert.equal(day.slots.length, 2);
  assert.equal(day.slots[1].status, 'doble'); // 11:15 i 11:45
  assert.equal(day.offGrid.length, 1);        // 11:45 fora de franja
});

test('simulador: moure el Benjamí C a la tarda resol el conflicte', () => {
  const m = model();
  const benj = find(m, '2026-11-01', 'Ch Ripollet C');
  const sim = CC.simulateChange(m.events, m, benj.key, '2026-11-01', '17:00');
  assert.equal(sim.blocks, 0);
  assert.ok(sim.resolved.some(c => c.type === 'persona'));
});

test('suggeriments: primer la parrilla, i cap franja amb bloquejos', () => {
  const m = model();
  const al = find(m, '2026-11-08', 'Ch Ripollet B');
  const slots = CC.suggestSlots(m.events, m, al.key, { dayKeys: ['2026-11-01', '2026-11-08'] });
  assert.ok(slots.length > 0);
  assert.equal(slots[0].inGrid, true);
  const firstOff = slots.findIndex(s => !s.inGrid);
  assert.ok(firstOff === -1 || slots.slice(firstOff).every(s => !s.inGrid));
  // 8/11 a les 10:00 i 11:15 la pista ja està ocupada
  assert.ok(!slots.some(s => s.dayKey === '2026-11-08' && s.inGrid));
  for (const s of slots) assert.equal(CC.simulateChange(m.events, m, al.key, s.dayKey, s.time).blocks, 0);
});

test('propostes: pendent fins que jok.cat mostra la nova hora', () => {
  const m = model();
  const ev = m.events[0];
  const p = { id: 'p1', eventKey: ev.key, newDate: '2026-11-01', newTime: '18:00' };
  assert.equal(CC.applyProposals(m.events, [p]).status.p1, 'pendent');
  const official = m.events.map(e => (e.key === ev.key ? { ...e, time: '18:00', start: CC.toMinutes(e.date, '18:00') } : e));
  assert.equal(CC.applyProposals(official, [p]).status.p1, 'oficial');
});

test('canvis: només partits del club, amb data anterior i nova', () => {
  const next = JSON.parse(JSON.stringify(DATA));
  next.categories['Benjamí'][0].calendar[1].time = '12:30';
  next.categories['Fem'][0].calendar[0].time = '18:00'; // no és del club
  const diff = CC.diffMatches(DATA, next, CLUB);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].type, 'canvi');
  assert.equal(diff[0].from.time, '11:15');
  assert.equal(diff[0].to.time, '12:30');
});

test('resolutor de pistes: no confon clubs per paraules genèriques', () => {
  const resolve = CC.makeVenueResolver({ 'Club Pati Tordera': { lat: 41.7, lng: 2.7 } });
  assert.equal(resolve('Club Patí Roda A'), null);
  assert.ok(resolve('Club Pati Tordera A'));
});
