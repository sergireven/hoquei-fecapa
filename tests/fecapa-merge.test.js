const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeFecapaCompetitionsIntoCategories } = require('../jobs/fecapa-merge');

test('mergeFecapaCompetitionsIntoCategories adds missing FECAPA competitions', () => {
  const categories = {
    Fem: [
      {
        id: '111',
        name: 'FEM 17 OR 1',
        classification: [],
        classificationSource: 'jok',
      },
    ],
  };

  const merged = mergeFecapaCompetitionsIntoCategories({
    categories,
    fecapaCategories: {
      categories: {
        fem: [
          {
            competitionId: '222',
            competitionName: 'PRIMERA CATALANA FEMENINA',
            groups: [
              {
                groupName: 'GRUP A',
                teams: [
                  { teamName: 'Club A', points: 9 },
                  { teamName: 'Club B', points: 6 },
                ],
              },
            ],
          },
          {
            competitionId: '111',
            competitionName: 'FEM 17 OR 1',
            groups: [
              {
                groupName: 'GRUP A',
                teams: [
                  { teamName: 'Club C', points: 9 },
                  { teamName: 'Club D', points: 6 },
                ],
              },
            ],
          },
        ],
      },
    },
  });

  assert.equal(merged.Fem.length, 1);
  assert.equal(merged.Fem[0].id, '111');
  assert.equal(merged.Fem[0].classificationSource, 'fecapa');
  assert.equal(merged.Fem[0].classification[0].team, 'Club C');
  assert.equal(merged['1ª Catalana'][0].classification.length, 2);
  assert.equal(merged['1ª Catalana'][0].name, 'PRIMERA CATALANA FEMENINA');
});

test('mergeFecapaCompetitionsIntoCategories promotes the calendar-bearing match across categories', () => {
  const calendar = [{ home: 'Ch Ripollet', away: 'Farners', date: '09-10-2026', played: false }];
  const merged = mergeFecapaCompetitionsIntoCategories({
    categories: {
      '1ª Catalana': [{ id: '4776-GRUP-A', name: '1ª CATALANA GRUP A', calendar: [] }],
      Altres: [{ id: '4866', name: '1ª CATALANA GRUP A (2026-27)', calendar }],
    },
    fecapaCategories: {
      categories: {
        primera_catalana: [{
          competitionId: '4776',
          competitionName: 'PRIMERA CATALANA MASCULINA',
          groups: [{
            groupName: '1ª CATALANA GRUP A',
            teams: [{ teamName: 'CH RIPOLLET', points: 6 }],
          }],
        }],
      },
    },
  });

  assert.equal(merged.Altres.length, 0);
  assert.equal(merged['1ª Catalana'].length, 1);
  assert.equal(merged['1ª Catalana'][0].id, '4866');
  assert.deepEqual(merged['1ª Catalana'][0].calendar, calendar);
  assert.equal(merged['1ª Catalana'][0].classification[0].team, 'CH RIPOLLET');
});

test('mergeFecapaCompetitionsIntoCategories keeps prebenjamí competitions in their category', () => {
  const merged = mergeFecapaCompetitionsIntoCategories({
    fecapaCategories: {
      categories: {
        prebenjami: [{
          competitionId: '4813',
          competitionName: 'BCN PREBENJAMI OR 3',
          groups: [{ groupName: 'BCN PREBENJAMI OR 3', teams: [] }],
        }],
      },
    },
  });

  assert.equal(merged['Prebenjamí'][0].name, 'BCN PREBENJAMI OR 3');
  assert.equal(merged.Benjamí, undefined);
});
