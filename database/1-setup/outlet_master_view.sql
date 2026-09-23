-- ============================================================
-- Outlet Master (VIEW) — applied 2026-09-23
-- One row per outlet from "Data Universe" (latest Update_Date wins),
-- without SKU / purchase columns, plus:
--   "Contract"       = 'With Contract' / 'No Contract'
--   "Contract Count" = number of rows in "Contract Master"
-- matched by  Data Universe."Outlet Code" = Contract Master."CODE OUTLET"
-- (trimmed, case-insensitive).
-- Read-only. security_invoker keeps the login-only RLS of the source tables.
-- Re-run this file any time columns are added to "Data Universe".
-- Updated 2026-09-23: excludes id, Catalogue Status, Contract Flag (row/SKU level); includes Current BDE.
-- ============================================================
DROP VIEW IF EXISTS public."Outlet Master";  -- column list changes, so rebuild

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(format('o.%I', column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'Data Universe'
    AND column_name NOT IN ('id','SKU Code','Principle','Category','Brand','SKU','Product','Size','Pack','SKU Status','Catalogue Status','Contract Flag');

  EXECUTE format($v$
    CREATE OR REPLACE VIEW public."Outlet Master" WITH (security_invoker = true) AS
    WITH o AS (
      SELECT DISTINCT ON (upper(trim(du."Outlet Code"))) du.*
      FROM public."Data Universe" du
      WHERE coalesce(trim(du."Outlet Code"), '') <> ''
      /* dates are stored as text M/D/YYYY — compare them as real dates */
      ORDER BY upper(trim(du."Outlet Code")),
        CASE WHEN du."Update_Date"   ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN to_date(du."Update_Date",   'FMMM/FMDD/YYYY') END DESC NULLS LAST,
        CASE WHEN du."Date_Register" ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN to_date(du."Date_Register", 'FMMM/FMDD/YYYY') END DESC NULLS LAST,
        du.id DESC
    ),
    c AS (
      SELECT upper(trim("CODE OUTLET")) AS code, count(*) AS n
      FROM public."Contract Master"
      WHERE coalesce(trim("CODE OUTLET"), '') <> ''
      GROUP BY 1
    )
    SELECT %s,
           CASE WHEN c.code IS NOT NULL THEN 'With Contract' ELSE 'No Contract' END AS "Contract",
           coalesce(c.n, 0)::int AS "Contract Count"
    FROM o
    LEFT JOIN c ON c.code = upper(trim(o."Outlet Code"))
  $v$, cols);
END $$;

GRANT SELECT ON public."Outlet Master" TO authenticated;
REVOKE ALL ON public."Outlet Master" FROM anon;
