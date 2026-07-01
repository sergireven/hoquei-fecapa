-- ═══════════════════════════════════════════════════════════════════════════
-- Create URL decoding function for PostgreSQL
-- Decodes UTF-8 encoded URLs like %C3%91 → Ñ
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.url_decode(encoded TEXT)
RETURNS TEXT AS $$
DECLARE
  decoded TEXT := encoded;
  hex_byte TEXT;
  byte_val BYTEA;
  i INT;
BEGIN
  -- Replace + with space
  decoded := REPLACE(decoded, '+', ' ');
  
  -- Replace %XX with actual bytes using bytea conversion
  -- PostgreSQL can interpret E'\\x' hex format
  i := 1;
  WHILE i < LENGTH(decoded) LOOP
    IF SUBSTRING(decoded, i, 1) = '%' AND i + 2 <= LENGTH(decoded) THEN
      hex_byte := SUBSTRING(decoded, i + 1, 2);
      -- Verify it's valid hex
      IF hex_byte ~ '^[0-9A-Fa-f]{2}$' THEN
        -- Replace %XX with the actual byte
        byte_val := E'\\x' || hex_byte;
        -- This is a simplified approach; for full UTF-8 support, use convert_from
        decoded := SUBSTRING(decoded, 1, i - 1) || 
                   convert_from(byte_val, 'UTF8') ||
                   SUBSTRING(decoded, i + 3);
        i := i + 1;
      ELSE
        i := i + 1;
      END IF;
    ELSE
      i := i + 1;
    END IF;
  END LOOP;
  
  RETURN decoded;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Simplified: just handle common UTF-8 sequences
CREATE OR REPLACE FUNCTION public.url_decode_simple(encoded TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      encoded,
      '%C3%91', 'Ñ'),   -- Ñ
      '%C3%B1', 'ñ'),   -- ñ
      '%C3%81', 'Á'),   -- Á
      '%C3%A1', 'á'),   -- á
      '%C3%89', 'É'),   -- É
      '%C3%A9', 'é'),   -- é
      '%C3%8D', 'Í'),   -- Í
      '%C3%AD', 'í'),   -- í
      '%C3%93', 'Ó'),   -- Ó
      '%C3%B3', 'ó'),   -- ó
      '%C3%9A', 'Ú'),   -- Ú
      '%C3%BA', 'ú'),   -- ú
      '+', ' ');        -- + to space
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Test the function:
SELECT public.url_decode_simple('%C3%91ANDO');  -- Should return ÑANDO

-- ═══════════════════════════════════════════════════════════════════════════
-- Now update players with the decoded names
-- ═══════════════════════════════════════════════════════════════════════════

-- Update names with URL encoding
UPDATE public.players
SET
  name = TRIM(public.url_decode_simple(name)),
  slug = TRIM(public.url_decode_simple(slug))
WHERE name LIKE '%\%%' OR slug LIKE '%\%%' OR name LIKE '%+%' OR slug LIKE '%+%';

-- Verify:
SELECT COUNT(*) as still_encoded FROM public.players WHERE name LIKE '%\%%';
SELECT COUNT(*) as still_plus FROM public.players WHERE name LIKE '%+%';
SELECT COUNT(*) as still_plus_slug FROM public.players WHERE slug LIKE '%+%';

-- Sample of fixed data:
SELECT id, name, slug FROM public.players WHERE name LIKE 'Ñ%' OR name LIKE '%Ñ%' LIMIT 5;
