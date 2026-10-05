const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFallbackNameKeys, parseCalendar } = require('../jobs/scraper');

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
