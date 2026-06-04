-- ═══════════════════════════════════════════════════════════════════════════
-- Coordinador Training Management Table
-- Purpose: Store training sessions created by coordinadors for their club
-- ═══════════════════════════════════════════════════════════════════════════

-- Create trainings table
CREATE TABLE coordinator_trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id TEXT NOT NULL,
  training_date DATE NOT NULL,
  training_time TIME NOT NULL,
  location TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_coordinator_trainings_user_id ON coordinator_trainings(user_id);
CREATE INDEX idx_coordinator_trainings_club_id ON coordinator_trainings(club_id);
CREATE INDEX idx_coordinator_trainings_date ON coordinator_trainings(training_date);
CREATE INDEX idx_coordinator_trainings_user_club ON coordinator_trainings(user_id, club_id);

-- Enable Row Level Security
ALTER TABLE coordinator_trainings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own trainings (for their clubs)
CREATE POLICY "Users can view own trainings" ON coordinator_trainings
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own trainings
CREATE POLICY "Users can create trainings" ON coordinator_trainings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own trainings
CREATE POLICY "Users can update own trainings" ON coordinator_trainings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own trainings
CREATE POLICY "Users can delete own trainings" ON coordinator_trainings
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE coordinator_trainings IS 'Training sessions created by coordinadors for their clubs';
COMMENT ON COLUMN coordinator_trainings.club_id IS 'Club name string (matches DB.categories[].classification[].team)';
COMMENT ON COLUMN coordinator_trainings.duration_minutes IS 'Training duration in minutes (e.g., 90, 120)';
