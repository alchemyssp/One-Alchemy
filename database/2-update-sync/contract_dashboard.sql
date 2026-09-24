-- ============================================================
-- Contract Master dashboard (applied 2026-09-24) — used by js/contract-dashboard.js
-- One call summarises both contract types. A "contract" = distinct "Code of Contract"
-- (old rows without a code: outlet | promotion | start). Active = "Active/Inactive" = 'Active'.
-- Runs as the caller (RLS: "Allow authenticated read Contract Master").
-- ============================================================

-- "1-Mar-19" → date (other formats → null)
CREATE OR REPLACE FUNCTION public.contract_date(t text)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN trim(t) ~ '^\d{1,2}-[A-Za-z]{3}-\d{2}$' THEN to_date(trim(t), 'FMDD-Mon-YY') END
$$;

CREATE OR REPLACE FUNCTION public.contract_dashboard()
RETURNS json LANGUAGE sql STABLE SET search_path = public AS $$
WITH c AS (
  SELECT CASE WHEN "Type" ~* 'year' THEN 'yearly' WHEN "Type" ~* 'market' THEN 'marketing' END AS kind,
         coalesce(nullif(trim("Code of Contract"), ''), coalesce("CODE OUTLET", '') || '|' || coalesce("Promotion", '') || '|' || coalesce("START", '')) AS code,
         nullif(trim("CODE OUTLET"), '') AS outlet, "OUTLET NAME" AS outlet_name,
         coalesce(nullif(trim("TEAM"), ''), '(blank)') AS team, "CURRENT BDE" AS bde,
         coalesce(nullif(trim("AREA"), ''), '(blank)') AS area,
         coalesce(nullif(trim("Principle"), ''), '(blank)') AS principle,
         "Promotion" AS promotion, "TYPE OF CONTRACT" AS yc_type,
         trim("Active/Inactive") ILIKE 'active' AS active,
         contract_date("START") AS d_start, contract_date("END") AS d_end, "END" AS end_text
  FROM "Contract Master"
), k AS (SELECT * FROM c WHERE kind IS NOT NULL)
SELECT json_build_object(
  'today', current_date,
  'kpi', (SELECT json_object_agg(kind, x) FROM (
      SELECT kind, json_build_object(
        'rows', count(*),
        'contracts', count(DISTINCT code),
        'active_contracts', count(DISTINCT code) FILTER (WHERE active),
        'active_outlets', count(DISTINCT outlet) FILTER (WHERE active),
        'active_promotions', count(DISTINCT promotion) FILTER (WHERE active),
        'expiring_90', count(DISTINCT code) FILTER (WHERE active AND d_end BETWEEN current_date AND current_date + 90),
        'started_12m', count(DISTINCT code) FILTER (WHERE d_start > current_date - interval '12 months')) AS x
      FROM k GROUP BY kind) s),
  'by_team', (SELECT json_agg(t ORDER BY t.yearly + t.marketing DESC) FROM (
      SELECT team AS name, count(DISTINCT code) FILTER (WHERE kind = 'yearly') AS yearly,
             count(DISTINCT code) FILTER (WHERE kind = 'marketing') AS marketing
      FROM k WHERE active GROUP BY team) t),
  'by_area', (SELECT json_agg(t ORDER BY t.yearly + t.marketing DESC) FROM (
      SELECT area AS name, count(DISTINCT code) FILTER (WHERE kind = 'yearly') AS yearly,
             count(DISTINCT code) FILTER (WHERE kind = 'marketing') AS marketing
      FROM k WHERE active GROUP BY area) t),
  'mkt_principle', (SELECT json_agg(t ORDER BY t.contracts DESC) FROM (
      SELECT principle AS name, count(DISTINCT code) AS contracts, count(DISTINCT outlet) AS outlets
      FROM k WHERE kind = 'marketing' AND active GROUP BY principle) t),
  'mkt_promotions', (SELECT json_agg(t) FROM (
      SELECT promotion AS name, count(DISTINCT code) AS contracts, count(DISTINCT outlet) AS outlets
      FROM k WHERE kind = 'marketing' AND active AND promotion IS NOT NULL
      GROUP BY promotion ORDER BY 2 DESC LIMIT 10) t),
  'yc_types', (SELECT json_agg(t ORDER BY t.contracts DESC) FROM (
      SELECT coalesce(nullif(trim(upper(yc_type)), ''), '(blank)') AS name, count(DISTINCT code) AS contracts
      FROM k WHERE kind = 'yearly' AND active GROUP BY 1) t),
  'yc_contract_types', (SELECT json_agg(t ORDER BY t.contracts DESC) FROM (
      SELECT coalesce(nullif(trim(promotion), ''), '(blank)') AS name, count(DISTINCT code) AS contracts
      FROM k WHERE kind = 'yearly' AND active GROUP BY 1) t),
  'monthly', (SELECT json_agg(t ORDER BY t.m) FROM (
      SELECT to_char(g.m, 'YYYY-MM') AS m,
             (SELECT count(DISTINCT code) FROM k WHERE kind = 'yearly' AND date_trunc('month', d_start) = g.m) AS yearly,
             (SELECT count(DISTINCT code) FROM k WHERE kind = 'marketing' AND date_trunc('month', d_start) = g.m) AS marketing
      FROM generate_series(date_trunc('month', current_date) - interval '11 months', date_trunc('month', current_date), interval '1 month') AS g(m)) t),
  'expiring', (SELECT json_agg(t ORDER BY t.d_end, t.outlet_name) FROM (
      SELECT DISTINCT ON (kind, code) kind, code, outlet, outlet_name, bde, promotion AS detail, end_text, d_end
      FROM k WHERE active AND d_end BETWEEN current_date AND current_date + 90
      ORDER BY kind, code, d_end) t)
)
FROM (SELECT 1) one
$$;
GRANT EXECUTE ON FUNCTION public.contract_dashboard() TO authenticated;
REVOKE ALL ON FUNCTION public.contract_dashboard() FROM anon;

-- ============================================================
-- 2026-09-24 (v2): row editing on the Yearly / Marketing tabs (js/contract-edit.js)
-- + dashboard: 'by_location' (active contracts per PROVINCE → map points), 'monthly' removed,
--   blank TYPE / Contract Type removed from the Yearly type tables.
-- The live function definition is the source of truth: select pg_get_functiondef('contract_dashboard'::regproc);
-- ============================================================
ALTER TABLE public."Contract Master" ADD COLUMN IF NOT EXISTS id bigint GENERATED BY DEFAULT AS IDENTITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"Contract Master"'::regclass AND contype = 'p') THEN
    ALTER TABLE public."Contract Master" ADD PRIMARY KEY (id);
  END IF;
END $$;
DROP POLICY IF EXISTS "Signed-in users add Contract Master" ON public."Contract Master";
CREATE POLICY "Signed-in users add Contract Master" ON public."Contract Master"
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Signed-in users edit Contract Master" ON public."Contract Master";
CREATE POLICY "Signed-in users edit Contract Master" ON public."Contract Master"
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
GRANT INSERT, UPDATE ON public."Contract Master" TO authenticated;

-- ============================================================
-- 2026-09-24 (v3): Delete record (website) + "Documents on Hand" card
--   * RLS DELETE for signed-in users; BEFORE DELETE trigger copies each row deleted from the
--     website (auth.uid() set) to public.contract_deleted (row_data jsonb, deleted_at, deleted_by).
--     Imports (pg_cron worker) are not logged here — they keep contract_backup.
--   * contract_on_doc(): contracts whose "ON DOC" is set (one row per contract + holder), read-only card.
-- Live definitions: select pg_get_functiondef('contract_on_doc'::regproc), pg_get_functiondef('contract_log_delete'::regproc);
-- ============================================================
