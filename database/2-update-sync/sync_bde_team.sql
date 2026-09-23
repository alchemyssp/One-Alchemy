-- ============================================================
-- Add BDE + TEAM to Data U and sync from Outlet Master
-- Run in Supabase SQL Editor
-- ============================================================

-- Step 1: Add columns if not exist
ALTER TABLE "Data U" ADD COLUMN IF NOT EXISTS "BDE"  text;
ALTER TABLE "Data U" ADD COLUMN IF NOT EXISTS "TEAM" text;

-- Step 2: Sync BDE from Outlet Master
UPDATE "Data U" du
SET "BDE" = om."BDE"
FROM "Outlet Master" om
WHERE du."Outlet Code" = om."Outlet Code"
  AND (du."BDE" IS NULL OR du."BDE" = '')
  AND om."BDE" IS NOT NULL AND om."BDE" <> '';

-- Step 3: Sync TEAM from Outlet Master
UPDATE "Data U" du
SET "TEAM" = om."Team"
FROM "Outlet Master" om
WHERE du."Outlet Code" = om."Outlet Code"
  AND (du."TEAM" IS NULL OR du."TEAM" = '')
  AND om."Team" IS NOT NULL AND om."Team" <> '';

-- Verify
SELECT
  COUNT(*) AS total_rows,
  COUNT("BDE")  FILTER (WHERE "BDE"  IS NOT NULL AND "BDE"  <> '') AS bde_filled,
  COUNT("TEAM") FILTER (WHERE "TEAM" IS NOT NULL AND "TEAM" <> '') AS team_filled
FROM "Data U";
