# 📐 Arquitectura de sincronització JSON ↔ Supabase

## 1. Flux de dades

```
┌──────────────────────────┐
│  Verificador FECAPA      │
│  (temps compet., equips) │
└────────────┬─────────────┘
             │
             ├─→ fecapa-categories.json
             │
      ┌──────▼──────┐
      │ data.json   │
      │ (categories │
      │  + jugadors)│
      └──────┬──────┘
             │
         ┌───┴────────────────────────────────────────────┐
         │ api/sync-db-from-json.js (NOVA SINCRONITZACIÓ) │
         │ Executa: cron nocturn + manual endpoint       │
         └───┬───────────────────────────────────────────┘
             │
      ┌──────▼──────────────────────────────────────┐
      │  Extracció d'estructura                      │
      │  ├─ normalizeClubName()                      │
      │  ├─ normalizeTeamName()                      │
      │  ├─ extractCategoryFromCompName()            │
      │  └─ buildClubIdMap()                         │
      └──────┬────────────────────────────────────┘
             │
  ┌──────────┴──────────────┬─────────────────┐
  │                         │                 │
  ▼                         ▼                 ▼
┌─────────┐          ┌──────────┐        ┌──────────┐
│ clubs   │          │ teams    │        │ players  │
│ UPSERT  │          │ UPSERT   │        │ UPSERT   │
│ ON      │          │ ON       │        │ ON       │
│ CONFLICT│          │ CONFLICT │        │ CONFLICT │
└────┬────┘          └────┬─────┘        └────┬─────┘
     │                    │                    │
     └────────────────────┴────────────────────┘
                          │
                 ┌────────▼────────┐
                 │  Supabase       │
                 │  PostgreSQL     │
                 │                 │
                 │ ✅ clubs        │
                 │ ✅ teams        │
                 │ ✅ players      │
                 │ ✅ convocatorias│
                 │ ✅ shared_...   │
                 └─────────────────┘
```

## 2. Mapeig de taules

### 📋 clubs
```javascript
// Source: data.categories[*].classification[*].team
// Lògica: Extreu club de team name (normalitza eliminant suffixes)
{
  id: UUID,
  name: "Club Hoquei Ripollet",           // PK UNIQUE
  jok_key: "ripollet" || null,
  created_at: timestamp
}
```

### 🏒 teams
```javascript
// Source: data.categories[*].classification[*] per competició
// Lògica: Una fila per cada (club, team_name, category, season)
{
  id: UUID,
  club_id: FK → clubs.id,
  club_name: "Club Hoquei Ripollet",      // Denormalizat per queries
  team_name: "Club Hoquei Ripollet A",    // Team real (with suffix A/B/C)
  category: "Benjamí",                    // Extret de comp.name
  season: "2025-26",
  team_key: "clubhoqueirpollet a::benjami::2025-26",  // Composite key normalitzat
  created_at: timestamp,
  UNIQUE(club_id, team_name, category, season)
}
```

### 👥 players
```javascript
// Source: data.jugadors[*] + teamStats[0]
// Lògica: Una fila per jugador i temporada (PK composite)
{
  id: UUID,
  primary_team_id: FK → teams.id || null,  // Team principal
  name: "Nom del jugador",                  // PK part 1
  slug: "nom-del-jugador",                  // Per URLs
  dorsal: "12",                             // Número de samarreta
  position: "Defensa" || "Jugador",         // Rol
  is_goalkeeper: false,
  season: "2025-26",                        // PK part 2
  created_at: timestamp,
  UNIQUE(name, season)
}
```

### 📞 convocatorias
```javascript
// Source: App (coordinador guardar)
// Lògica: Convocació de partit = jugadors disponibles/dubte/no_disponible
{
  id: UUID,
  coordinator_id: FK → auth.users.id,      // Qui va crear
  team_id: FK → teams.id || null,
  club_name: "Club Hoquei Ripollet",
  team_name: "Club Hoquei Ripollet A",
  match_key: "base64(compId::date::time::home::away)",
  players: [
    { name: "Nom 1", status: "disponible", dorsal: "1", ... },
    { name: "Nom 2", status: "no_disponible", notes: "Lesió", ... }
  ],
  match_date: "2025-06-15",
  match_time: "19:30",
  created_at: timestamp,
  UNIQUE(coordinator_id, club_name, team_name, match_key)
}
```

### 🏋️ shared_trainings
```javascript
// Source: App (coordinador + entrenador)
// Lògica: Entrenaments compartits (planificació + seguiment)
{
  id: UUID,
  club_name: "Club Hoquei Ripollet",
  team_id: FK → teams.id || null,
  team_name: "Club Hoquei Ripollet A",
  team_category: "Benjamí",
  training_date: "2025-06-20",
  training_time: "17:00",
  location: "Pabelló Municipal",
  locker_room: "B1",
  duration_minutes: 60,
  pillars: ["Tàctica", "Physic"],           // Énfasi de l'entrenament
  coach_notes: "Focus en passades...",      // Anotacions de l'entrenador
  created_by: FK → auth.users.id,           // Coordinador
  enriched_by: FK → auth.users.id,          // Entrenador (actualitzador)
  created_at: timestamp
}
```

## 3. Procés d'UPSERT

### Pas 1: Clubs
```sql
INSERT INTO clubs (name, jok_key)
VALUES (?, ?)
ON CONFLICT (name) 
DO UPDATE SET jok_key = EXCLUDED.jok_key
RETURNING id;
```

**Resultat:** Mapa `clubs.name → clubs.id` per als equips

### Pas 2: Teams
```sql
INSERT INTO teams (club_id, club_name, team_name, category, season, team_key)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT (club_id, team_name, category, season)
DO UPDATE SET team_key = EXCLUDED.team_key
RETURNING id;
```

**Resultat:** Mapa `"teamname::category::season" → teams.id` per als jugadors

### Pas 3: Players
```sql
INSERT INTO players (primary_team_id, name, slug, dorsal, position, is_goalkeeper, season)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (name, season)
DO UPDATE SET 
  position = EXCLUDED.position,
  dorsal = EXCLUDED.dorsal,
  primary_team_id = EXCLUDED.primary_team_id
RETURNING id;
```

---

## 4. Punts d'extensió futura

### Fase 2: Lectura híbrida

```javascript
// Nou helper per app.js
async function getTeam(clubName, teamName, category, season = "2025-26") {
  // Intenta Supabase first
  const { data } = await sb.from("teams")
    .select("*")
    .eq("club_name", clubName)
    .eq("team_name", teamName)
    .eq("category", category)
    .eq("season", season)
    .single();
    
  if (data) return data;  // ✅ Supabase
  
  // Fallback: memory DB
  return DB.categories[...]?.find(t => t.team === teamName);
}
```

### Fase 3: API consolidada

```javascript
// Tots els lectores usen Supabase instead of memory DB

// Before (memory):
const team = DB.categories[cat][comp].classification[i].team;

// After (BD):
const team = await sb.from("teams")
  .select("team_name, category")
  .eq("club_name", club)
  .eq("season", "2025-26")
  .limit(1);
```

---

## 5. Scripts d'administració

### Test extracció sense BD
```bash
node jobs/test-sync-json-extraction.js
```

### Test complet amb BD (local)
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node -e "
    const { syncAllSeasonsToDatabase } = require('./api/sync-db-from-json');
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    syncAllSeasonsToDatabase(sb, './public')
      .then(r => console.log(JSON.stringify(r, null, 2)))
      .catch(e => console.error(e));
  "
```

### Crida API (manual)
```bash
# Totes les temporades
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://app.vercel.app/api/sync-database?season=all

# Temporada actual
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://app.vercel.app/api/sync-database?season=current
```

---

## 6. Garanties de consistència

| Escenari | Garant |
|----------|--------|
| **Club duplicat en múltiples seasons** | `UNIQUE(clubs.name)` → merge automàtic |
| **Team duplicat** | `UNIQUE(club_id, team_name, category, season)` → skip |
| **Player duplicat** | `UNIQUE(name, season)` → update position/dorsal |
| **Calls múltiples a API** | Tots els UPSERTs és idempotents |
| **Dades corruptes en JSON** | Validació + logging, fallback a memòria |
| **Supabase unavailable** | Cron continua, app segueix llegint memory DB |

---

## 7. Logs i debugging

Cada operació registra:
```
[sync] Starting sync for season: 2024-25 (2024-25)
[sync] Extracted: 12 clubs, 45 teams, 320 players
[sync] Error upserting players: Duplicate key...
[sync] Sync completed for season: 2024-25
```

Accés via Supabase → **Logs** table (futura) o console de Vercel.
