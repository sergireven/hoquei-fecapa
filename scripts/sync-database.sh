#!/bin/bash
# scripts/sync-database.sh — Helper local per testejar sincronització

# ⚠️ Requeix:
#   - .env.local amb SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY
#   - Node.js 16+

set -e

# Carrega variables d'entorn
source .env.local 2>/dev/null || {
  echo "❌ .env.local not found. Create it with:"
  echo "   SUPABASE_URL=your-url"
  echo "   SUPABASE_SERVICE_ROLE_KEY=your-key"
  exit 1
}

SEASON="${1:-all}"  # Default: totes les temporades

echo "🔄 Sincronitzant temporada: $SEASON"
echo "   DB: $SUPABASE_URL"
echo ""

# Node.js script inline per evitar dependències adicionals
node << 'EOF'
const { syncAllSeasonsToDatabase, syncSeasonToDatabase } = require('./api/sync-db-from-json');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const publicDir = path.join(__dirname, 'public');
const season = process.env.SEASON;

(async () => {
  const start = Date.now();
  try {
    let result;
    if (season === 'all') {
      console.log('📊 Loading ALL seasons from ./public/season-archive/');
      result = await syncAllSeasonsToDatabase(sb, publicDir);
    } else if (season === 'current') {
      console.log('📊 Loading CURRENT season from ./public/data.json');
      const dataPath = path.join(publicDir, 'data.json');
      result = await syncSeasonToDatabase(sb, 'current', dataPath, '2025-26');
    } else {
      console.log(`📊 Loading season ${season} from ./public/season-archive/data-${season}.json`);
      const dataPath = path.join(publicDir, 'season-archive', `data-${season}.json`);
      result = await syncSeasonToDatabase(sb, season, dataPath, season);
    }
    
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log('\n✅ Sync completed in ' + elapsed + 's');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
})();
EOF
