const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildFallbackNameKeys,
  extractPlayerStatsRaw,
  parseCalendar,
  parsePlayerStats,
} = require('../jobs/scraper');

test('FECAPA lookup keys ignore the JOK season suffix', () => {
  assert.deepEqual(buildFallbackNameKeys('JÚNIOR OR 1 (2026-27)'), ['JUNIOR OR 1']);
});

test('JOK parser extracts calendar cards without Jornada markers', () => {
  const html = `
    <div class="match-card">
      <a href="/equip/1/home">Home Team</a>
      <span>10-10-2026 12:30</span><span>4 - 2</span>
      <a href="/equip/2/away">Away Team</a>
    </div>
    <div class="match-card">
      <a href="/equip/3/home-two">Home Two</a>
      <span>11-10-2026</span><span>-</span>
      <a href="/equip/4/away-two">Away Two</a>
    </div>`;

  const matches = parseCalendar(html);

  assert.equal(matches.length, 2);
  assert.deepEqual(matches[0], {
    jornada: null,
    home: 'Home Team',
    away: 'Away Team',
    date: '10-10-2026',
    time: '12:30',
    homeScore: 4,
    awayScore: 2,
    played: true,
  });
  assert.equal(matches[1].home, 'Home Two');
  assert.equal(matches[1].away, 'Away Two');
  assert.equal(matches[1].played, false);
});

test('JOK parser extracts upcoming and played unified match cards', () => {
  const html = `
    <!-- UNIFIED APPLE SPORTS MATCH CARD (Played & Upcoming) -->
    <a href="/equip/12115/CH+RIPOLLET">Ch Ripollet</a>
    <span class="score"> - </span>
    <a href="/equip/11110/ANDBANK">Andbank Andorra HC</a>
    <span>30/05/2027 — 12:30</span>
    <!-- UNIFIED APPLE SPORTS MATCH CARD (Played & Upcoming) -->
    <a href="/equip/11844/TORRELAVIT">CE Torrelavit</a>
    <span class="score">4 - 5</span>
    <a href="/equip/11556/VENDRELL">Club Esports Vendrell</a>
    <span>04/10/2026 — 19:00</span>`;

  const matches = parseCalendar(html);

  assert.equal(matches.length, 2);
  assert.deepEqual(matches[0], {
    jornada: null,
    home: 'Ch Ripollet',
    away: 'Andbank Andorra HC',
    date: '30-05-2027',
    time: '12:30',
    homeScore: undefined,
    awayScore: undefined,
    played: false,
  });
  assert.equal(matches[1].homeScore, 4);
  assert.equal(matches[1].awayScore, 5);
  assert.equal(matches[1].played, true);
});

test('JOK acta parser keeps local and visitor player tables separate', () => {
  const html = `
    <!-- Local Team Players Table -->
    <div class="w-full">
      <div>Jugador (Local) G B V FD Pe</div>
      <div class="player-row">
        <span>100</span>
        <a href="/jugador/11346/MARTINENC">Home Player</a>
        <div class="w-1/12">2</div><div class="w-1/12">1</div><div class="w-1/12">0</div><div class="w-1/12">3</div><div class="w-1/12">1</div>
      </div>
      <div class="player-row">
        <span>37</span>
        <a href="/jugador/11347/MARTINENC-TWO">Home Two</a>
        <div class="w-1/12">0</div><div class="w-1/12">0</div><div class="w-1/12">1</div><div class="w-1/12"></div><div class="w-1/12"></div>
      </div>
    </div>
    <!-- Visitor Team Players Table -->
    <div class="w-full">
      <div>Jugador (Visitant) G B V FD Pe</div>
      <div class="player-row">
        <span>88</span>
        <a href="/jugador/80200/RIPOLLET">Martí Aparicio Casas</a>
        <div class="w-1/12">0</div><div class="w-1/12">0</div><div class="w-1/12">0</div><div class="w-1/12"></div><div class="w-1/12"></div>
      </div>
    </div>`;

  const raw = extractPlayerStatsRaw('', html);
  const stats = parsePlayerStats(raw, []);

  assert.deepEqual(stats.homePlayers.map(player => player.jugadorId), ['11346', '11347']);
  assert.deepEqual(stats.awayPlayers.map(player => player.jugadorId), ['80200']);
  assert.equal(stats.awayPlayers[0].name, 'Martí Aparicio Casas');
  assert.deepEqual(
    [stats.homePlayers[0].g, stats.homePlayers[0].b, stats.homePlayers[0].v, stats.homePlayers[0].fd, stats.homePlayers[0].pe],
    [2, 1, 0, 3, 1]
  );
  assert.deepEqual(
    [stats.homePlayers[1].g, stats.homePlayers[1].b, stats.homePlayers[1].v, stats.homePlayers[1].fd, stats.homePlayers[1].pe],
    [0, 0, 1, null, null]
  );
});

test('JOK acta parser does not put all player links under home when blocks are empty', () => {
  const stats = parsePlayerStats({ homeBlock: '', awayBlock: '' }, [
    { jugadorId: '80200', url: 'https://jok.cat/jugador/80200/RIPOLLET' },
  ]);

  assert.deepEqual(stats.homePlayers, []);
  assert.deepEqual(stats.awayPlayers, []);
});
