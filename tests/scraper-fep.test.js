const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseFepCalendar } = require('../jobs/scraper-fep');

test('FEP: llegeix jornada, data, hora, equips i resultat del calendari sidgad', () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures/fep-calendar.html'), 'utf8');
  const rows = parseFepCalendar(html);
  assert.equal(rows.length, 12);
  assert.deepEqual(rows[0], {
    jornada: 1, home: 'Chp Sant Feliu', away: 'Club Esports Vendrell', date: '19-10-2024', time: '19:30',
    homeScore: 3, awayScore: 4, played: true, fepId: '31483',
  });
  assert.equal(rows[rows.length - 1].jornada, 2);
});

test('FEP: partit sense resultat queda com a pendent', () => {
  const html = `<table><thead class="head_jornada"><tr><th>JORNADA 5</th></tr></thead><tbody>
    <tr class="team_1 team_2 team_class" gamedate="20261107"><td></td><td><div>07/11/2026</div></td><td>20:00</td>
    <td><div class="no_mobile nombre_junto_logo">CERDANYOLA CLUB D&#039;HOQUEI</div></td>
    <td><div class="no_mobile nombre_junto_logo">CP ALCOI</div></td><td class="web_link_td"> - </td></tr></tbody></table>`;
  const [m] = parseFepCalendar(html);
  assert.equal(m.home, "Cerdanyola Club D'Hoquei");
  assert.equal(m.played, false);
  assert.equal(m.jornada, 5);
  assert.equal(m.date, '07-11-2026');
});
