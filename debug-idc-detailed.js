const fs = require('fs');
const sidgadComps = JSON.parse(fs.readFileSync('./public/competicions-sidgad.json', 'utf8'));

// Debug detallat
const copa4452 = sidgadComps['4452'];
const idcMatches = {};

if (copa4452.matches) {
  for (const match of copa4452.matches) {
    const idc = match.idc || '4452';
    if (!idcMatches[idc]) idcMatches[idc] = { count: 0, hasData: false };
    idcMatches[idc].count++;
    if (match.home && match.away) idcMatches[idc].hasData = true;
  }
}

console.log('Copa 4452 (BARCELONA):');
console.log('  classificationByGroup exists?', !!copa4452.classificationByGroup);
console.log('  classificationByGroup keys:', Object.keys(copa4452.classificationByGroup || {}));
console.log('  idcMatches found:', Object.keys(idcMatches));
console.log('  idcMatches detail:', idcMatches);
console.log('  Object.keys(idcMatches).length > 0?', Object.keys(idcMatches).length > 0);

const copa4459 = sidgadComps['4459'];
const idcMatches2 = {};

if (copa4459.matches) {
  for (const match of copa4459.matches) {
    const idc = match.idc || '4459';
    if (!idcMatches2[idc]) idcMatches2[idc] = { count: 0, hasData: false };
    idcMatches2[idc].count++;
    if (match.home && match.away) idcMatches2[idc].hasData = true;
  }
}

console.log('\nCopa 4459 (FEDERACIÓ):');
console.log('  classificationByGroup exists?', !!copa4459.classificationByGroup);
console.log('  classificationByGroup keys:', Object.keys(copa4459.classificationByGroup || {}));
console.log('  idcMatches found:', Object.keys(idcMatches2));
console.log('  idcMatches detail:', idcMatches2);
console.log('  Object.keys(idcMatches).length > 0?', Object.keys(idcMatches2).length > 0);
