-- Coordinator Favorites Table
-- Stores the favorite club/team for each coordinator user

CREATE TABLE IF NOT EXISTS coordinator_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_name TEXT NOT NULL,
  club_id TEXT,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE coordinator_favorites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view/edit their own favorites
CREATE POLICY "coordinator_favorites_user_access" ON coordinator_favorites
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_coordinator_favorites_user_id ON coordinator_favorites(user_id);

-- Comments
COMMENT ON TABLE coordinator_favorites IS 'Stores favorite club selection for coordinators (FASE 1 MVP)';
COMMENT ON COLUMN coordinator_favorites.club_name IS 'Display name of the favorite club';
COMMENT ON COLUMN coordinator_favorites.club_id IS 'Optional internal club ID for future use';
