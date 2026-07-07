-- Add BDE column to "Data U" table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

ALTER TABLE "Data U" ADD COLUMN IF NOT EXISTS bde text DEFAULT NULL;

-- Optional: if you want to place it after "team" column visually in Supabase Studio
-- (column order in Supabase Studio is cosmetic only; the JS already reorders display)

-- Verify the column was added:
SELECT column_name, data_type, ordinal_position
FROM information_schema.columns
WHERE table_name = 'Data U'
ORDER BY ordinal_position;
