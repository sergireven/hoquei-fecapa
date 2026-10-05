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
