-- ============================================================
-- Sync Company Name, Group Name, Group Code
-- from Outlet Master → Data Universe
-- Match by: Outlet Name (case-insensitive)
--
-- Run in Supabase SQL Editor — safe to run multiple times
-- ============================================================


-- ── STEP 1: Preview rows that will be updated ────────────────
-- Run this SELECT first to see what will change before committing
SELECT
  du."Outlet Name",
  du."Company Name"  AS du_company,  om."Company Name"  AS om_company,
  du."Group Name"    AS du_group,    om."Group Name"    AS om_group,
  du."Group Code"    AS du_code,     om."Group Code"    AS om_code
FROM "Data Universe" du
JOIN "Outlet Master" om
  ON LOWER(TRIM(du."Outlet Name")) = LOWER(TRIM(om."Outlet Name"))
WHERE du."Outlet Name" IS NOT NULL AND du."Outlet Name" <> ''
ORDER BY du."Outlet Name"
LIMIT 100;


-- ── STEP 2: Run the actual UPDATE ────────────────────────────
-- Updates Company Name, Group Name, Group Code for ALL matching rows
-- Outlet Master value always wins (overwrites existing DU value)
UPDATE "Data Universe" du
SET
  "Company Name" = COALESCE(
    NULLIF(TRIM(om."Company Name"),    ''),
    NULLIF(TRIM(om."Company Name EN"), ''),
    NULLIF(TRIM(om."Company Name TH"), ''),
    NULLIF(TRIM(du."Company Name"),    '')
  ),
  "Group Name" = COALESCE(
    NULLIF(TRIM(om."Group Name"), ''),
    NULLIF(TRIM(du."Group Name"), '')
  ),
  "Group Code" = COALESCE(
    NULLIF(TRIM(om."Group Code"), ''),
    NULLIF(TRIM(du."Group Code"), '')
  )
FROM "Outlet Master" om
WHERE LOWER(TRIM(du."Outlet Name")) = LOWER(TRIM(om."Outlet Name"))
  AND du."Outlet Name" IS NOT NULL
  AND du."Outlet Name" <> '';


-- ── STEP 3: Verify ───────────────────────────────────────────
SELECT
  COUNT(*)                                          AS total_rows,
  COUNT("Company Name")                             AS has_company,
  COUNT("Group Name")                               AS has_group_name,
  COUNT("Group Code")                               AS has_group_code,
  COUNT(*) - COUNT("Company Name")                  AS missing_company,
  COUNT(*) - COUNT("Group Name")                    AS missing_group_name,
  COUNT(*) - COUNT("Group Code")                    AS missing_group_code
FROM "Data Universe"
WHERE "Outlet Name" IS NOT NULL AND "Outlet Name" <> '';
