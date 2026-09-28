const test = require('node:test');
const assert = require('node:assert/strict');
const { extractPlayersFromDb } = require('../api/sync-db-from-json');

test('extractPlayersFromDb excludes players without current-season team stats', () => {
  const players = extractPlayersFromDb({
    jugadors: {
      '100': { jugadorId: '100', slug: 'HISTORIC+PLAYER', teamStats: [] },
      '200': {
        jugadorId: '200',
        slug: 'CURRENT+PLAYER',
        teamStats: [{ team: 'Club Actual A', cat: 'alevi', count: 1 }],
      },
    },
  }, '2026-27');

  assert.equal(players.length, 1);
  assert.equal(players[0].jok_id, '200');
  assert.equal(players[0].season, '2026-27');
});