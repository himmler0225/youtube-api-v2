-- Add url column to shorts (NOT NULL with empty default for existing rows)
ALTER TABLE shorts ADD COLUMN IF NOT EXISTS url TEXT NOT NULL DEFAULT '';
