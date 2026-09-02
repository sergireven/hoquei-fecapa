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
