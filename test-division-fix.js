// Test per verificar que la divisió es compara correctament
const matchScore = (sidgadKeywords, jokKeywords) => {
  // Hard exclusions
  if (sidgadKeywords.category !== jokKeywords.category) return -1;
  if (sidgadKeywords.region && jokKeywords.region && sidgadKeywords.region !== jokKeywords.region) return -1;
  // Nou: Si la divisió és diferent en absolut (inclús si una és null), és un mismatch
  if (sidgadKeywords.division !== jokKeywords.division) return -1;
  if (sidgadKeywords.is3x3 !== jokKeywords.is3x3) return -1;
  if (sidgadKeywords.isPreferent !== jokKeywords.isPreferent) return -1;

  let score = 0;

  // Resta del scoring...
  if (jokKeywords.copaQualifier && sidgadKeywords.copaQualifier) {
    if (jokKeywords.copaQualifier === sidgadKeywords.copaQualifier) score += 5;
    else score -= 5;
  }

  // General Copa alignment
  if (jokKeywords.isCopa && sidgadKeywords.isCopa)   score += 3;
  if (jokKeywords.isCopa && !sidgadKeywords.isCopa)  score -= 2;

  // Token overlap (excluding short tokens)
  const sidgadSig = sidgadKeywords.tokens.filter(t => t.length > 2);
  const jokSig    = jokKeywords.tokens.filter(t => t.length > 2);
  const overlap   = sidgadSig.filter(t => jokSig.includes(t)).length;
  score += overlap;

  return overlap >= 1 ? score : -1;
};

const sidgadNoDivision = {
  category: "BENJAMIN",
  region: "BARCELONA",
  division: null,
  isCopa: true,
  is3x3: false,
  isPreferent: false,
  tokens: ["BENJAMI", "COPA", "BARCELONA", "FASE"],
  copaQualifier: null,
};

const jokOR = {
  category: "BENJAMIN",
  region: "BARCELONA",
  division: "OR",
  isCopa: true,
  is3x3: false,
  isPreferent: false,
  tokens: ["BCN", "BENJAMI", "OR", "COPA", "BCN", "1"],
  copaQualifier: null,
};

const jokPLATA = {
  category: "BENJAMIN",
  region: "BARCELONA",
  division: "PLATA",
  isCopa: true,
  is3x3: false,
  isPreferent: false,
  tokens: ["BCN", "BENJAMI", "PLATA", "COPA", "BCN", "4"],
  copaQualifier: null,
};

console.log("Sidgad (no division) vs Jok OR:", matchScore(sidgadNoDivision, jokOR));
console.log("Sidgad (no division) vs Jok PLATA:", matchScore(sidgadNoDivision, jokPLATA));
console.log("\n✅ Ambos debería ser -1 (incompatible)");

// Caso correcto: sidgad con división que coincida
const sidgadWithPlata = {
  ...sidgadNoDivision,
  division: "PLATA",
};

console.log("\n\nSidgad (PLATA) vs Jok PLATA:", matchScore(sidgadWithPlata, jokPLATA));
console.log("✅ Debería ser ≥ 0 (compatible)");
