# CSV Import Checklist (Core Tables)

This checklist is for manual CSV upload in Supabase Studio when JSON->DB sync is unavailable.

## 1) Generate CSV files

Run from repository root:

```bash
npm run export:db-csv
```

Expected output directory:

- `public/db-csv/clubs.csv`
- `public/db-csv/teams.csv`
- `public/db-csv/competitions.csv`
- `public/db-csv/players.csv`
- `public/db-csv/competition_teams.csv`
- `public/db-csv/matches_historical.csv`
- `public/db-csv/report.json`

## 2) If starting fresh (no existing data)

Upload/import in this order to preserve foreign keys:

1. `clubs.csv`
2. `teams.csv`
3. `competitions.csv`
4. `players.csv`
5. `competition_teams.csv`
6. `matches_historical.csv`

## 2b) If reimporting due to FK violations

**First**, diagnose the issue:

Open SQL Editor and run:
```
supabase/20260617_diagnose_fk_mismatch.sql
```

This will show:
- How many orphaned records exist
- Which UUIDs are mismatched
- Whether tables need complete reset

**Then**, execute the safe reimport script:

```
supabase/20260617_safe_reimport.sql
```

This script:
1. Temporarily disables FK constraints
2. Truncates all tables (reverse order)
3. Provides instructions for re-uploading CSVs
4. Re-enables constraints
5. Runs quick validation

**After reimport**, follow section 3 below.

## 3) Run post-import validation

Open SQL Editor in Supabase and execute:

```
supabase/20260617_post_import_validation.sql
```

This validates:

- row counts
- duplicates by natural keys
- missing required values
- broken relationships
- season coverage
- `competitions.total_teams` consistency

All validation queries should return **empty result sets** (no violations).

## 4) Expected counts (if successful)

After all imports complete, you should have:

```
clubs: 480
teams: 6552
players: 39899
competitions: 2147
competition_teams: 11866
matches_historical: (depèn de les temporades disponibles a `public/actes` i `public/season-archive/actes`)
```

## 5) Scripts reference

| Script | Purpose |
|--------|---------|
| `20260617_diagnose_fk_mismatch.sql` | Identify orphaned records and UUID mismatches |
| `20260617_safe_reimport.sql` | Clean reset + safe reimport instructions |
| `20260617_post_import_validation.sql` | Full validation after import (no errors = success) |
