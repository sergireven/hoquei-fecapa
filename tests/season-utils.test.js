const test = require('node:test');
const assert = require('node:assert/strict');
const { inferSeasonLabel, getCurrentSeasonLabelFromEnvOrDate, isSeasonLabelMatchingCurrentSeason } = require('../jobs/season-utils');

test('inferSeasonLabel uses the academic year for dates before August', () => {
  assert.equal(inferSeasonLabel(new Date('2025-07-01T00:00:00Z')), '2024-25');
});

test('inferSeasonLabel uses the next academic year from August onward', () => {
  assert.equal(inferSeasonLabel(new Date('2026-08-01T00:00:00Z')), '2026-27');
});

test('getCurrentSeasonLabelFromEnvOrDate prefers an explicit env season', () => {
  assert.equal(getCurrentSeasonLabelFromEnvOrDate({ JOK_SEASON: '2026-27' }), '2026-27');
});

test('isSeasonLabelMatchingCurrentSeason compares against the resolved current season', () => {
  assert.equal(isSeasonLabelMatchingCurrentSeason('2026-27', { JOK_SEASON: '2026-27' }), true);
  assert.equal(isSeasonLabelMatchingCurrentSeason('2025-26', { JOK_SEASON: '2026-27' }), false);
});
