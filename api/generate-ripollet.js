// generate-ripollet.js
// Generates public/ripollet.json from public/data.json
// Filters all competitions containing a "Club Hoquei Ripollet" team variant,
// deduplicates by teamId (keeps main comp over phase sub-comps), and exports
// a compact JSON (~5–10 KB) ready to be fetched by the club website.

const fs = require('fs');
const path = require('path');

const DATA_PATH     = path.join(__dirname, '../public/data.json');
const OUTPUT_PATH   = path.join(__dirname, '../public/ripollet.json');
const CLUB_KEYWORD  = 'ripollet';

const CAT_ORDER = [
  'Nacional Catalana','Femení','Veterans','Júnior',
  'Juvenil','Infantil','Aleví','Benjamí','Prebenjamí','Altres'
];

const CAT_NAMES = {
  'Nacional Catalana': 'Nacional Catalana',
  'Fem':               'Femení',
  'Prebenjamí':        'Prebenjamí',
  'Benjamí':           'Benjamí',
  'Aleví':             'Aleví',
  'Infantil':          'Infantil',
  'Juvenil':           'Juvenil',
  'Junior':            'Júnior',
  'Veterans':          'Veterans',
  'Altres':            'Altres',
};

function isPhaseComp(name) {
  return / P\d+ \(/.test(name);
}

function generate() {
  console.log('📂 Llegint data.json...');
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

  const seenTeam = {}; // teamId → entry

  for (const [cat, comps] of Object.entries(data.categories || {})) {
    for (const comp of comps) {
      const ripolletTeam = (comp.classification || []).find(
        t => t.team && t.team.toLowerCase().includes(CLUB_KEYWORD)
      );
      if (!ripolletTeam) continue;

      const tid = ripolletTeam.teamId;
      const isPhase = isPhaseComp(comp.name);

      // Prefer main comp over phase comp
      if (tid in seenTeam && !isPhase && isPhaseComp(seenTeam[tid].comp)) {
        delete seenTeam[tid]; // will be replaced below
      } else if (tid in seenTeam) {
        continue;
      }

      const cal = comp.calendar || [];
      const kw = CLUB_KEYWORD;

      const recent = cal
        .filter(m => m.played && m.home &&
          (m.home.toLowerCase().includes(kw) || (m.away || '').toLowerCase().includes(kw)))
        .slice(-3);

      const upcoming = cal
        .filter(m => !m.played && m.home &&
          (m.home.toLowerCase().includes(kw) || (m.away || '').toLowerCase().includes(kw)))
        .slice(0, 3);

      seenTeam[tid] = {
        category: CAT_NAMES[cat] || cat,
        comp:     comp.name,
        compId:   comp.id,
        team:     ripolletTeam.team,
        teamId:   tid,
        pos:      ripolletTeam.pos,
        pts:      ripolletTeam.pts,
        pj:       ripolletTeam.pj  || 0,
        pg:       ripolletTeam.pg  || 0,
        pe:       ripolletTeam.pe  || 0,
        pp:       ripolletTeam.pp  || 0,
        recent,
        upcoming,
      };
    }
  }

  const teams = Object.values(seenTeam).sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a.category);
    const ib = CAT_ORDER.indexOf(b.category);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.team.localeCompare(b.team);
  });

  const nextMatches = teams
    .flatMap(t => t.upcoming.map(m => ({
      ...m,
      teamName: t.team,
      category: t.category,
      comp:     t.comp,
    })))
    .sort((a, b) => (a.date || '99-99').localeCompare(b.date || '99-99'))
    .slice(0, 6);

  const output = {
    updatedAt:  data.updatedAt,
    season:     data.season,
    teams,
    nextMatches,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  const kb = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
  console.log(`✅ ripollet.json generat: ${kb} KB | ${teams.length} equips | ${nextMatches.length} propers partits`);
  teams.forEach(t =>
    console.log(`   ${t.category.padEnd(18)} | ${t.team.padEnd(30)} | pos:${t.pos} pts:${t.pts}`)
  );
}

generate();
