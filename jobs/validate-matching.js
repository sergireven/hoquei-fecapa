// Validate matching with real data
const fs = require('fs');
const path = require('path');

const normCompName = name => (name || "").toUpperCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^A-Z0-9]/g, " ").replace(/\s+/g, " ").trim()
  .replace(/\b(2025|2026|25|26|TEMP|SEASON|SAISON)\b/g, "").replace(/\s+/g, " ").trim();

const extractKeywords = name => {
  const norm = normCompName(name);
  return {
    full: norm,
    tokens: norm.split(/\s+/),
    hasCategory: /BENJAMI|PREBENJAMI|PREJUN|JUNIOR|JUVENIL|ALEVI|INFANTIL|FEM|VETERANS/.test(norm),
    category: /\bBENJAMI/.test(norm) ? "BENJAMIN"
           : /PREBENJAMI/.test(norm) ? "PREBENJAMI"
           : /JUNIOR/.test(norm) ? "JUNIOR"
           : /JUVENIL/.test(norm) ? "JUVENIL"
           : /ALEVI/.test(norm) ? "ALEVI"
           : /INFANTIL/.test(norm) ? "INFANTIL"
           : null,
    region: /BARCELONA|BCN/.test(norm) ? "BARCELONA"
          : /TARRAGONA/.test(norm) ? "TARRAGONA"
          : /GIRONA/.test(norm) ? "GIRONA"
          : /LLEIDA/.test(norm) ? "LLEIDA"
          : null,
    division: /\bOR\b/.test(norm) ? "OR"
            : /PLATA/.test(norm) ? "PLATA"
            : /BRONZE/.test(norm) ? "BRONZE"
            : /INICIACIO/.test(norm) ? "INICIACIO"
            : null,
    isCopa: /COPA/.test(norm),
  };
};

const matches = (sidgadKeywords, jokKeywords) => {
  if (sidgadKeywords.category !== jokKeywords.category) return false;
  if (sidgadKeywords.region && jokKeywords.region && sidgadKeywords.region !== jokKeywords.region) return false;
  if (sidgadKeywords.division && jokKeywords.division && sidgadKeywords.division !== jokKeywords.division) return false;

  const sidgadSig = sidgadKeywords.tokens.filter(t => t.length > 2);
  const jokSig = jokKeywords.tokens.filter(t => t.length > 2);
  const overlap = sidgadSig.filter(t => jokSig.includes(t)).length;

  return overlap >= 1;
};

// Load data
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data.json'), 'utf8'));
const sidgadComps = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/competicions-sidgad.json'), 'utf8'));

// Collect jok.cat competitions
const jokComps = [];
for (const comps of Object.values(data.categories || {})) {
  for (const comp of comps) {
    jokComps.push({ comp, keywords: extractKeywords(comp.name || "") });
  }
}

console.log(`📊 Validating matching with real data:\n`);
console.log(`   Jok.cat competitions: ${jokComps.length}`);
console.log(`   Sidgad competitions: ${Object.keys(sidgadComps).length}\n`);

// Find Benjamí-related competitions
const benjaminSidgad = Object.values(sidgadComps)
  .filter(sc => /BENJAMIN|BENJAMI/.test(normCompName(sc.name)))
  .slice(0, 5);

const benjaminJok = jokComps
  .filter(jc => /BENJAMIN|BENJAMI/.test(jc.keywords.full))
  .slice(0, 10);

console.log(`🔍 Benjamin-related competitions:\n`);

if (benjaminSidgad.length > 0) {
  console.log(`Sidgad (${benjaminSidgad.length} samples):`);
  for (const sc of benjaminSidgad) {
    const scKw = extractKeywords(sc.name);
    const found = jokComps.find(jc => matches(scKw, jc.keywords));
    const match = found ? found.comp.name : "❌ NO MATCH";
    console.log(`  "${sc.name}"`);
    console.log(`    ↓ ${match}\n`);
  }
}

if (benjaminJok.length > 0) {
  console.log(`\nJok.cat (${benjaminJok.length} samples):`);
  for (const jc of benjaminJok) {
    const found = Object.values(sidgadComps).find(sc =>
      matches(extractKeywords(sc.name), jc.keywords)
    );
    const match = found ? found.name : "❌ NO SIDGAD";
    console.log(`  "${jc.comp.name}"`);
    console.log(`    ↓ ${match}\n`);
  }
}
