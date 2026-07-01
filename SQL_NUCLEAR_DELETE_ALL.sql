-- ═══════════════════════════════════════════════════════════════════════════
-- NUCLEAR OPTION: Delete all players and player_masters to start fresh
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Delete all players (this cascades due to ON DELETE SET NULL on player_master_id FK)
DELETE FROM public.players;

-- Step 2: Delete all player_masters (now no references exist)
DELETE FROM public.player_masters;

-- Step 3: Verify everything is gone
SELECT COUNT(*) as players_count FROM public.players;
SELECT COUNT(*) as masters_count FROM public.player_masters;

-- Step 4: Reset any sequences if needed (optional)
-- ALTER SEQUENCE public.players_id_seq RESTART WITH 1;
-- ALTER SEQUENCE public.player_masters_id_seq RESTART WITH 1;

-- ═══════════════════════════════════════════════════════════════════════════
-- After running this, execute the sync with improved code:
-- GitHub Actions → Manual Sync Trigger → Run workflow (mode: github_direct_db_sync, season: all)
-- ═══════════════════════════════════════════════════════════════════════════
