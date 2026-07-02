# 📊 Sincronització JSON ↔ Supabase: Guia d'ús ràpida

## 🎯 Objectiu
Preparar sincronització de dades (clubs, equips, jugadors) del JSON cap a Supabase **sense afectar el funcionament actual de l'app**.

---

## ✅ Què s'ha creat

### Fitxers de codi
1. **`api/sync-db-from-json.js`** — Motor de sincronització
   - Funcions d'extracció de clubs, teams, players
   - UPSERT segur (idempotent)
   - Suporta temporades múltiples

2. **`api/sync-database.js`** — Endpoint REST
   - Manual testing: `GET /api/sync-database?season=all`
   - Suporta seasons específiques: `season=2024-25`

3. **`jobs/test-sync-json-extraction.js`** — Test sense BD
   - Valida que l'extracció funciona
   - No necessita Supabase
   - Mostra estadístiques: clubs/teams/players per temporada

4. **`api/cron.js`** — Integrat al pipeline nocturn
   - Cron ja executa sincronització al final
   - Sense trencar les scraping tasks existents

### Documentació
1. **`SYNC_DATABASE_MIGRATION.md`** — Guia complet de migració
   - Fases (Fase 1 en progres, Fase 2/3 futures)
   - Com cridar endpoints
   - Testejo local

2. **`ARCHITECTURE_SYNC.md`** — Diagrames d'arquitectura
   - Flux de dades
   - Mapeig taules (clubs, teams, players, etc.)
   - Garanties de consistència

3. **`scripts/sync-database.sh`** — Helper bash per local

---

## 🚀 Com usar-ho

### ✅ Test local (sense Supabase)
```bash
# Validar que l'extracció funciona
node jobs/test-sync-json-extraction.js
```

Output esperado:
```
🧪 Testing season: current (2025-26)
   File: ./public/data.json

🏢 Clubs extracted: 45
   Examples:
     1. Club Hoquei Ripollet
     2. ...

🏒 Teams extracted: 180
👥 Players extracted: 2500
...
```

### 🔄 Sincronització manual (amb Supabase)

**Mode recomanat (actiu: actual + futures):**
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
   https://app.vercel.app/api/sync-database?season=active
```

**Totes les temporades:**
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://app.vercel.app/api/sync-database?season=all
```

Nota: `season=all` queda com a mode de manteniment/backfill puntual, no per al dia a dia.

**Temporada actual:**
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://app.vercel.app/api/sync-database?season=current
```

**Temporada específica (e.g. 2024-25):**
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://app.vercel.app/api/sync-database?season=2024-25
```

### 🤖 Automàtic
- Ja integrat al cron nocturn (02:00 UTC)
- S'executa automaticament després de scraper.js
- El cron diari només sincronitza temporada activa (i futures quan n'hi hagi), no històric.

## 🔁 End-to-End Diari (sense manual)

Cada execució del cron fa aquest flux complet:

1. Scraping categories (`jobs/scraper-fecapa-categories.js`)
2. Scraping dades principals (`jobs/scraper.js`)
3. Rebuild mapping (`jobs/build-entity-mapping.js`)
4. Rebuild audit (`jobs/build-classification-audit.js`)
5. Sync JSON → Supabase de temporada activa/futures (`api/sync-db-from-json.js`)
6. Reconciliació automàtica de jugadors sense equip:
    - pass safe per `jok_id` unívoc
    - pass fallback per temporada més propera (`jok_id`)
    - pass safe per `player_master_id` unívoc

Això vol dir que clubs, equips i jugadors nous queden poblats diàriament a la BBDD sense executar SQL manual.

### Camps de resposta clau del sync

La resposta de `GET /api/sync-database?season=all` (i dels logs del cron) inclou `result.reconcile`:

```json
{
   "ok": true,
   "result": {
      "current": { "ok": true },
      "2024-25": { "ok": true },
      "reconcile": {
         "ok": true,
         "before_missing": 3020,
         "after_missing": 3004,
         "filled": 16,
         "passes": {
            "safe_jok_id": 8,
            "fallback_jok_id": 6,
            "safe_master_id": 2
         }
      }
   }
}
```

---

## 📋 Estructura de dades

### Clubs
```javascript
{ name: "Club Hoquei Ripollet", jok_key: "ripollet" }
```

### Teams (equips)
```javascript
{
  club_id: UUID,
  club_name: "Club Hoquei Ripollet",
  team_name: "Club Hoquei Ripollet A",
  category: "Benjamí",
  season: "2025-26"
}
```

### Players (jugadors)
```javascript
{
  primary_team_id: UUID,
  name: "Nom jugador",
  dorsal: "12",
  position: "Defensa",
  is_goalkeeper: false,
  season: "2025-26"
}
```

---

## 🔒 Seguretat

- **API Authorization**: Requereix Bearer token (`CRON_SECRET`)
- **Supabase Credentials**: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (env vars)
- **RLS Policies**: Lectura pública, escriptura només amb auth

---

## ✨ Característiques clau

✅ **No-breaking**: L'app continua llegint memory DB — sense canvis al consum  
✅ **Idempotent**: Pots cridar múltiples vegades sense problemes  
✅ **Temporades múltiples**: Sincronitza 2021-22, 2022-23, 2023-24, 2024-25 + actual  
✅ **Deduplicació**: UNIQUE constraints prevenen duplicats  
✅ **Error handling**: Logs detallats si alguna cosa falla  

---

## 🔮 Futures phases

**Fase 1 (ACTUAL)**: Sincronitzar dades sense afectar consum  
**Fase 2**: Lectura híbrida (app llegeix Supabase amb fallback a memory)  
**Fase 3**: Lectura pura Supabase (migració completa)

---

## 📞 Preguntes?

- Revisa `SYNC_DATABASE_MIGRATION.md` per a guia detallada
- Revisa `ARCHITECTURE_SYNC.md` per a arquitectura tècnica
- Executa `node jobs/test-sync-json-extraction.js` per validar setup
