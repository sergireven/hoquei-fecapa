-- ═══════════════════════════════════════════════════════════════════════════
-- RPC Function: Bulk upsert players and rebuild masters efficiently
-- Disables trigger during bulk insert, then rebuilds masters in batch
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
  v_error_msg TEXT := NULL;
BEGIN
  BEGIN
    -- 1. Disable trigger temporarily to speed up bulk insert
    ALTER TABLE public.players DISABLE TRIGGER ensure_player_master_id;
    
    -- 2. UPSERT players (direct SQL bulk insert, much faster than individual Supabase calls)
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
    
    -- 3. Re-enable trigger
    ALTER TABLE public.players ENABLE TRIGGER ensure_player_master_id;
    
    -- 4. Rebuild player_masters in batch (more efficient than trigger per-row)
    DELETE FROM public.player_masters pm
    WHERE NOT EXISTS (
      SELECT 1 FROM public.players p WHERE p.player_master_id = pm.id
    );
    
    INSERT INTO public.player_masters (id, master_key, canonical_slug, canonical_name, canonical_birth_date)
    SELECT 
      gen_random_uuid(),
      CONCAT(
        LOWER(REGEXP_REPLACE(unaccent(slug), '[^a-z0-9]+', '', 'g')),
        '::',
        COALESCE(TO_CHAR(birth_date, 'YYYYMMDD'), 'unknown')
      ),
      slug,
      UPPER(name),
      birth_date
    FROM (
      SELECT DISTINCT ON (
        LOWER(REGEXP_REPLACE(unaccent(slug), '[^a-z0-9]+', '', 'g')),
        COALESCE(birth_date, '1900-01-01'::date)
      )
        slug,
        name,
        birth_date
      FROM public.players
      WHERE player_master_id IS NULL
      ORDER BY 
        LOWER(REGEXP_REPLACE(unaccent(slug), '[^a-z0-9]+', '', 'g')),
        COALESCE(birth_date, '1900-01-01'::date)
    ) AS new_masters
    ON CONFLICT (master_key) DO NOTHING;
    
    -- 5. Link players to masters
    UPDATE public.players p
    SET player_master_id = pm.id
    FROM public.player_masters pm
    WHERE p.player_master_id IS NULL
      AND pm.master_key = CONCAT(
        LOWER(REGEXP_REPLACE(unaccent(p.slug), '[^a-z0-9]+', '', 'g')),
        '::',
        COALESCE(TO_CHAR(p.birth_date, 'YYYYMMDD'), 'unknown')
      );
    
    -- Return success stats
    RETURN QUERY SELECT 
      (SELECT COUNT(*)::INT FROM public.players),
      (SELECT COUNT(*)::INT FROM public.player_masters),
      NULL::TEXT;
  
  EXCEPTION WHEN OTHERS THEN
    -- Re-enable trigger even on error
    ALTER TABLE public.players ENABLE TRIGGER ensure_player_master_id;
    
    v_error_msg := SQLERRM;
    RETURN QUERY SELECT 0::INT, 0::INT, v_error_msg;
  END;
END;
$$ LANGUAGE plpgsql;
