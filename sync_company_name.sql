-- ============================================================
-- Sync "Company Name" from Outlet Master → Data U
-- Outlet Master uses "Company Name EN" / "Company Name TH"
-- Data U uses "Company Name"
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: แก้ column type จาก integer → text (ถ้า column ยังเป็น integer อยู่)
ALTER TABLE "Data U"
ALTER COLUMN "Company Name" TYPE text USING "Company Name"::text;

-- Step 2: sync ข้อมูลจาก Outlet Master
UPDATE "Data U" du
SET "Company Name" = NULLIF(TRIM(om."COMPANY NAME"), '')
FROM "Outlet Master" om
WHERE du."Outlet Code" = om."Outlet Code"
  AND (du."Company Name" IS NULL OR du."Company Name" = '')
  AND NULLIF(TRIM(om."COMPANY NAME"), '') IS NOT NULL;

-- Verify result
SELECT COUNT(*) AS filled_rows
FROM "Data U"
WHERE "Company Name" IS NOT NULL AND "Company Name" <> '';
