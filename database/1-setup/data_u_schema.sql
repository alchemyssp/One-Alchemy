-- ============================================================
-- Data Universe — Full Schema Migration
-- Run in Supabase SQL Editor → New query → Run
-- Safe to run multiple times (IF NOT EXISTS)
-- ============================================================

-- ── Outlet Information columns ───────────────────────────────
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

-- ── Address ──────────────────────────────────────────────────
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Region"    text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Province"  text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Soi"       text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Road"      text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "District"  text;

-- ── Contact ──────────────────────────────────────────────────
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Contact Person Name"         text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Contact Person Position"     text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Contact Person Phone Number" text;
ALTER TABLE "Data Universe" ADD COLUMN IF NOT EXISTS "Wholseller Supply"           text;

-- ── Outlet Type / Segmentation ───────────────────────────────
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

-- ── SKU Selling columns ──────────────────────────────────────
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

-- ── Verify: list all columns after migration ─────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Data Universe'
ORDER BY ordinal_position;
