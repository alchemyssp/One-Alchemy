-- ============================================================
-- Data Universe — Complete Setup
-- Run in Supabase SQL Editor → New query → Paste all → Run
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- STEP 1 — Add all columns
-- ════════════════════════════════════════════════════════════

-- Outlet Information
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "New Or Current"   text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Outlet Name"      text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Company Name"     text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Outlet Code"      text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Group Name"       text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Group Code"       text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Team"             text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "BDE"              text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Area"             text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Contracts"        text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Primary Contract" text;

-- Address
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Region"    text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Province"  text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Soi"       text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Road"      text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "District"  text;

-- Contact
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Contact Person Name"         text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Contact Person Position"     text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Contact Person Phone Number" text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Wholseller Supply"           text;

-- Outlet Type / Segmentation
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "AlchemyOutlet Type"               text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "AlchemySub Type"                  text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Alchemy Image"                    text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Alchemy Volum"                    text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Alchemy Sehmentation"             text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "CAMPARI OUTLET SEGMENTATION(NEW)" text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "CAMPARI OUTLET SEGMENTATION(OLD)" text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "TEG OUTLET SEGMENTATION"          text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "TEG GRADING"                      text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "RC SUB TYPE"                      text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "RC IMAGE"                         text;

-- SKU Selling
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "SKU Code"      text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Principle"     text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Category"      text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Brand"         text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "SKU"           text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Product"       text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Size"          text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Pack"          text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "SKU Status"    text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Date_Register" date;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Update_Date"   date;


-- ════════════════════════════════════════════════════════════
-- STEP 2 — Row Level Security
-- ════════════════════════════════════════════════════════════

ALTER TABLE "Data Universe" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read Data Universe"   ON "Data Universe";
DROP POLICY IF EXISTS "Users can insert Data Universe" ON "Data Universe";
DROP POLICY IF EXISTS "Users can update Data Universe" ON "Data Universe";
DROP POLICY IF EXISTS "Users can delete Data Universe" ON "Data Universe";

CREATE POLICY "Users can read Data Universe"
  ON "Data Universe" FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert Data Universe"
  ON "Data Universe" FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update Data Universe"
  ON "Data Universe" FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete Data Universe"
  ON "Data Universe" FOR DELETE USING (auth.uid() IS NOT NULL);


-- ════════════════════════════════════════════════════════════
-- STEP 3 — Stats function (bypasses RLS — shows totals always)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION data_u_stats()
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'total',   COUNT(DISTINCT "Outlet Name"),
    'new',     COUNT(DISTINCT CASE WHEN UPPER(TRIM("New Or Current")) = 'NEW'     THEN "Outlet Name" END),
    'current', COUNT(DISTINCT CASE WHEN UPPER(TRIM("New Or Current")) = 'CURRENT' THEN "Outlet Name" END)
  )
  FROM "Data Universe"
  WHERE "Outlet Name" IS NOT NULL AND "Outlet Name" <> '';
$$;


-- ════════════════════════════════════════════════════════════
-- STEP 4 — Change log table (Log History + Restore)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS outlet_change_log (
  id         bigserial    PRIMARY KEY,
  action     text         NOT NULL,
  record_id  text,
  old_data   jsonb,
  new_data   jsonb,
  changed_by text,
  changed_at timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE outlet_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read log"   ON outlet_change_log;
DROP POLICY IF EXISTS "Users can insert log" ON outlet_change_log;

CREATE POLICY "Users can read log"
  ON outlet_change_log FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert log"
  ON outlet_change_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ════════════════════════════════════════════════════════════
-- VERIFY — list all columns (should show 43+ columns)
-- ════════════════════════════════════════════════════════════

SELECT column_name, data_type, ordinal_position
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'Data Universe'
ORDER  BY ordinal_position;
