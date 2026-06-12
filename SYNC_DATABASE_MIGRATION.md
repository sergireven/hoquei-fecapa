# Sincronització JSON ↔ Supabase: Arquitectura de migració

## 📋 Resumen

Procés de **migració gradual** que prepara la BD per rellac del JSON, sense trencar la funcionalitat actual:

```
┌─────────────────────────────────────────────────────────────────┐
│ Fase 1: Sincronització de dades (EN PROGRES)                   │
├─────────────────────────────────────────────────────────────────┤
│ JSON (data.json + season-archive)                               │
│     ↓ sync-db-from-json.js                                       │
│ Supabase (clubs, teams, players, shared_trainings)              │
│                                                                   │
│ App continua llegint DB en memòria (NO canvis al consum)        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Fase 2: Lectura híbrida (FUTURA)                                │
├─────────────────────────────────────────────────────────────────┤
│ App llegeix clubs/teams/players de Supabase quan es necessita   │
│ Fallback a memory DB si Supabase no disponible                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Fase 3: Lectura pura Supabase (MÉS ENDAVANT)                   │
├─────────────────────────────────────────────────────────────────┤
│ Tots els panells (coordinador, entrenador, usuari) llegeixen    │
│ de Supabase com a font única de veritat                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flux de sincronització

### 1. **Disparagor: Cron nocturn + manual**

**Automàtic (cada nit 02:00 UTC):**
```
Vercel Cron → api/cron.js → 
  1. scraper-fecapa-categories.js (categories.json)
  2. scraper.js (data.json)
  3. build-entity-mapping.json
  4. build-classification-audit.json
  5. generate-ripollet.json
  6. sync-db-from-json.js (NOVA)
```

**Manual (developer/testing):**
```bash
# Sincronitzar tots les temporades
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://app.vercel.app/api/sync-database?season=all

# Sincronitzar temporada actual
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://app.vercel.app/api/sync-database?season=current

# Sincronitzar temporada específica (e.g. 2024-25)
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://app.vercel.app/api/sync-database?season=2024-25
```

---

### 2. **Extracció de dades (sync-db-from-json.js)**

#### Clubs
```javascript
data.categories[*].classification[*].team
  ↓ normalitzar (eliminar " A/B/C" del final)
Clubs (taula: clubs)
```

#### Teams (equips per categoria)
```javascript
{
  club_id: FK → clubs.id,
  club_name: "Club Hoquei Ripollet",
  team_name: "Club Hoquei Ripollet A",
  category: "Benjamí",  // extret de comp.name
  season: "2025-26",
  team_key: "clubhoqueirpollet a::benjami::2025-26"
}
```

#### Jugadors
```javascript
data.jugadors[*] 
  + data.jugadors[*].teamStats[0]  (primary team)
  ↓
{
  primary_team_id: FK → teams.id,
  name: "Nom jugador",
  slug: "nom-jugador",
  dorsal: "12",
  position: "Jugador",
  is_goalkeeper: false,
  season: "2025-26"
}
```

---

### 3. **UPSERT segur (idempotent)**

Cada taula usa UNIQUE constraints per evitar duplicats:

```sql
-- clubs
UNIQUE (name)

-- teams
UNIQUE (club_id, team_name, category, season)

-- players
UNIQUE (name, season)

-- shared_trainings
Actualment upsert per (coordinator_id, club_name, team_name, match_key)
```

Si es crida múltiples vegades, els UPSERTs só idempotents — no creen duplicats.

---

## 📊 Estat actual (Fase 1)

| Taula | Estat | Font |
|-------|-------|------|
| `clubs` | ✅ Esquema creat | JSON + sync-db-from-json.js |
| `teams` | ✅ Esquema creat | JSON + sync-db-from-json.js |
| `players` | ✅ Esquema creat | JSON + sync-db-from-json.js |
| `shared_trainings` | ✅ Esquema creat | App (coordinador/entrenador) |
| `convocatorias` | ✅ Esquema creat | App (coordinador) |
| App consum | ✅ Sin canvios | Segueix llegint `DB` en memory |

---

## 🚀 Pròxims passos per a Fase 2

1. **Afegir selectores híbrids** a l'app:
   - `getTeam(clubName, teamName, category)` → llegir de Supabase o memory
   - `getPlayer(name, season)` → llegir de Supabase o memory

2. **Migrax gradualment:**
   - Coordinador → llegir teams/players de Supabase (per a convocatòries)
   - Entrenador → llegir trainings compartits (ja funciona)
   - Usuari → llegir convocatòries (ja funciona)

3. **Caché local (Service Worker):**
   - Sincronitzar data al client si offline
   - Actualitzar per push notifications

---

## ✅ Seguretat

- **Credencials:** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` a variables d'entorn (Vercel)
- **Authentificació cron:** Bearer token (`CRON_SECRET`)
- **RLS a Supabase:** Totes les taules permeten lectura pública, escriptura només amb auth

---

## 🔧 Testtejo local

```bash
# Carregar variables d'entorn
source .env.local

# Executar sincronització (Node.js)
node -e "
const { syncAllSeasonsToDatabase } = require('./api/sync-db-from-json');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
syncAllSeasonsToDatabase(sb, './public').then(r => console.log(JSON.stringify(r, null, 2)));
"
```

---

## 📝 Notes

- **L'app NO està canviat**: continua llegint `DB` en memòria (inicialitzat amb fetch `/data.json`)
- **Les BD taules NO s'usen per ara**: estan buides, però preparades per a migració futura
- **Idempotent**: cridades múltiples a la sincronització no causen problemes
- **No-breaking**: si Supabase cau, la lectura de JSON segueix funcionant
