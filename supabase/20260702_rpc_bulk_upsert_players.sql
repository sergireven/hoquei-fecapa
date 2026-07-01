-- ═══════════════════════════════════════════════════════════════════════════
-- RPC Function: Bulk upsert players efficiently
-- Uses native SQL for single bulk operation (faster than Supabase client loops)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.upsert_players_and_rebuild_masters(
  players_data JSONB
)
RETURNS TABLE (
  upserted_count INT,
  master_count INT,
  error_message TEXT
) AS $$
DECLARE
  v_upserted INT := 0;
  v_master_count INT := 0;
  v_error_msg TEXT := NULL;
BEGIN
  BEGIN
    -- 1. UPSERT players using native SQL (single bulk operation, not per-row)
    -- This is much faster than the Supabase client sending individual inserts
    INSERT INTO public.players (
      id, primary_team_id, jok_id, name, slug, team_key, dorsal, position, 
      is_goalkeeper, birth_date, season
    )
    SELECT 
      (player->>'id')::UUID,
      (player->>'primary_team_id')::UUID,
      player->>'jok_id',
      player->>'name',
      player->>'slug',
      player->>'team_key',
      player->>'dorsal',
      player->>'position',
      (player->>'is_goalkeeper')::BOOLEAN,
      (player->>'birth_date')::DATE,
      player->>'season'
    FROM jsonb_array_elements(players_data) AS player
    ON CONFLICT (slug, team_key, season) DO UPDATE SET
      primary_team_id = EXCLUDED.primary_team_id,
      jok_id = EXCLUDED.jok_id,
      name = EXCLUDED.name,
      dorsal = EXCLUDED.dorsal,
      position = EXCLUDED.position,
      is_goalkeeper = EXCLUDED.is_goalkeeper,
      birth_date = EXCLUDED.birth_date;
    
    GET DIAGNOSTICS v_upserted = ROW_COUNT;
    
    -- 2. Get current master count
    SELECT COUNT(*)::INT INTO v_master_count FROM public.player_masters;
    
    -- Return success stats
    RETURN QUERY SELECT v_upserted, v_master_count, NULL::TEXT;
  
  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    RETURN QUERY SELECT 0::INT, 0::INT, v_error_msg;
  END;
END;
$$ LANGUAGE plpgsql;
