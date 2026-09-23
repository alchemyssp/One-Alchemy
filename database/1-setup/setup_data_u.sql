-- ============================================================
-- Setup SQL for "Data U" table — run this in Supabase SQL Editor
-- https://supabase.com → Project → SQL Editor → New query
-- ============================================================

-- Step 1: Enable Row Level Security (safe to run even if already enabled)
ALTER TABLE "Data U" ENABLE ROW LEVEL SECURITY;

-- Step 2: Remove old policies if any (prevent duplicates)
DROP POLICY IF EXISTS "Users can read Data U"   ON "Data U";
DROP POLICY IF EXISTS "Users can insert Data U"  ON "Data U";
DROP POLICY IF EXISTS "Users can update Data U"  ON "Data U";
DROP POLICY IF EXISTS "Users can delete Data U"  ON "Data U";

-- Step 3: Create policies for authenticated users
CREATE POLICY "Users can read Data U"
  ON "Data U" FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert Data U"
  ON "Data U" FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update Data U"
  ON "Data U" FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete Data U"
  ON "Data U" FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Verify: should return 4 policies after running
-- ============================================================
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'Data U';
