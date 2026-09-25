-- ============================================================
-- ROI Analysis (applied 2026-09-25) — used by roi.html + js/roi-import.js
--
-- Data: "Return of investment" = the ROI Excel file (one row per outlet contract × SKU):
--   yearly target (Yearly Vol (btl), Yearly Value (THB)), rebate %, Total Discount (Net) (THB) per year.
-- Actual: "Off-take 2026" matched on outlet code + SKU code, inside the contract period.
--
-- Target to date     = yearly target × (contract months that have off-take data) / 12
--   (window = contract months ∩ off-take months; off-take starts 2024-01, so old contracts are compared fairly)
-- Investment to date = Total Discount (Net) per year × the same months / 12
--
-- Speed: results per contract × SKU are stored in materialized views (roi_lines_mv, roi_month_mv),
--   refreshed by roi_refresh() after every ROI import and every Off-take import (worker).
-- Upload (replace all): page → roi_staging (500 rows per request) → roi_request_replace() queues a job
--   → worker data_u_process_import_jobs() runs roi_replace_from_staging() (keeps one backup in roi_backup).
-- ============================================================

-- numbers stored as text ("4,708.00", "5%", " 57,982.74 ") → numeric
CREATE OR REPLACE FUNCTION public.roi_num(t text) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN regexp_replace(coalesce(t, ''), '[^0-9.\-]', '', 'g') ~ '^-?\d+(\.\d+)?$'
              THEN regexp_replace(t, '[^0-9.\-]', '', 'g')::numeric END
$$;

-- decimals allowed in these two columns
ALTER TABLE public."Return of investment" ALTER COLUMN "Packing" TYPE numeric USING "Packing"::numeric;
ALTER TABLE public."Return of investment" ALTER COLUMN "Yearly Vol (btl)" TYPE numeric USING "Yearly Vol (btl)"::numeric;

-- ── upload ──
CREATE TABLE IF NOT EXISTS public.roi_staging (
  batch_id text NOT NULL, rn int NOT NULL, data jsonb NOT NULL, loaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, rn));
ALTER TABLE public.roi_staging ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roi_staging_insert" ON public.roi_staging;
DROP POLICY IF EXISTS "roi_staging_delete" ON public.roi_staging;
CREATE POLICY "roi_staging_insert" ON public.roi_staging FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "roi_staging_delete" ON public.roi_staging FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.roi_backup (LIKE public."Return of investment");
ALTER TABLE public.roi_backup ADD COLUMN IF NOT EXISTS backed_up_at timestamptz DEFAULT now();
ALTER TABLE public.roi_backup ENABLE ROW LEVEL SECURITY;      -- no policies: not readable from the page

CREATE TABLE IF NOT EXISTS public.roi_import_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, file_name text, rows_before int, rows_after int,
  imported_by text, imported_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.roi_import_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roi_import_log_read" ON public.roi_import_log;
CREATE POLICY "roi_import_log_read" ON public.roi_import_log FOR SELECT TO authenticated USING (true);

-- ── typed views ──
CREATE OR REPLACE VIEW public.roi_facts WITH (security_invoker = true) AS
SELECT nullif(trim("Outlets Code"), '') AS outlet_code, nullif(trim("Outlet"), '') AS outlet, nullif(trim("Group"), '') AS grp,
       nullif(trim("BDE"), '') AS bde, nullif(trim("Area"), '') AS area,
       contract_date("Start Date") AS d_start, contract_date("End Date") AS d_end,
       coalesce(nullif(trim("Outlets Contract"), ''), trim("Outlets Code") || '|' || coalesce("Start Date", '')) AS contract,
       nullif(trim("SKU Code"), '') AS sku, nullif(trim("Principle"), '') AS principle, nullif(trim("Category"), '') AS category,
       nullif(trim("Brand"), '') AS brand, nullif(trim("Product"), '') AS product, nullif(trim("Proposed for"), '') AS proposed,
       nullif(trim("Tier"), '') AS tier,
       coalesce(roi_num("Yearly Vol (btl)"::text), 0) AS vol_y, coalesce(roi_num("Yearly Value (THB)"), 0) AS val_y,
       coalesce(roi_num("Total Discount (Net) (THB)"), 0) AS disc_y, roi_num("% Rebate from BDE") AS rebate_pct,
       CASE WHEN "Received Month" ~ '^\d{2}-[A-Za-z]{3}$' THEN to_date('20' || "Received Month", 'YYYY-Mon') END AS received
FROM "Return of investment";

CREATE OR REPLACE VIEW public.roi_offtake_monthly WITH (security_invoker = true) AS
SELECT nullif(trim("Code"), '') AS outlet_code, nullif(trim("SKU Code"), '') AS sku,
       to_date('20' || "Received Month", 'YYYY-Mon') AS month,
       sum(coalesce("Vol. Btls.", 0))::numeric AS vol, sum(coalesce(roi_num("Total Price Inc.VAT"), 0)) AS val
FROM "Off-take 2026" WHERE "Received Month" ~ '^\d{2}-[A-Za-z]{3}$'
GROUP BY 1, 2, 3;

-- ── stored results ──
CREATE MATERIALIZED VIEW IF NOT EXISTS public.roi_offtake_mv AS SELECT * FROM public.roi_offtake_monthly;
CREATE INDEX IF NOT EXISTS roi_offtake_mv_key ON public.roi_offtake_mv (outlet_code, sku, month);

DROP MATERIALIZED VIEW IF EXISTS public.roi_month_mv;
DROP MATERIALIZED VIEW IF EXISTS public.roi_lines_mv;
CREATE MATERIALIZED VIEW public.roi_lines_mv AS
WITH b AS (SELECT min(month) AS f, max(month) AS l FROM roi_offtake_mv),
k AS (
  SELECT f.contract, f.sku, max(f.outlet_code) outlet_code, max(f.outlet) outlet, max(f.grp) grp, max(f.bde) bde, max(f.area) area,
         max(f.tier) tier, max(f.principle) principle, max(f.brand) brand, max(f.product) product, max(f.proposed) proposed,
         max(f.rebate_pct) rebate_pct, min(f.d_start) d_start, max(f.d_end) d_end,
         greatest(date_trunc('month', min(f.d_start))::date, (SELECT f FROM b)) ws,
         least(date_trunc('month', max(f.d_end))::date, (SELECT l FROM b)) we,
         sum(f.vol_y) vol_y, sum(f.val_y) val_y, sum(f.disc_y) disc_y
  FROM roi_facts f WHERE f.d_start IS NOT NULL AND f.d_end IS NOT NULL GROUP BY f.contract, f.sku),
k2 AS (SELECT k.*, CASE WHEN we >= ws THEN (extract(year FROM age(we, ws)) * 12 + extract(month FROM age(we, ws)) + 1)::int ELSE 0 END AS months FROM k)
SELECT k2.*, k2.vol_y * k2.months / 12.0 AS t_vol, k2.val_y * k2.months / 12.0 AS t_val, k2.disc_y * k2.months / 12.0 AS inv,
       coalesce(a.vol, 0) AS a_vol, coalesce(a.val, 0) AS a_val, a.vol IS NOT NULL AS sold
FROM k2 LEFT JOIN LATERAL (
  SELECT sum(om.vol) vol, sum(om.val) val FROM roi_offtake_mv om
  WHERE om.outlet_code = k2.outlet_code AND om.sku = k2.sku AND om.month BETWEEN k2.ws AND k2.we HAVING count(*) > 0) a ON true;
CREATE INDEX roi_lines_mv_contract ON public.roi_lines_mv (contract);

CREATE MATERIALIZED VIEW public.roi_month_mv AS
SELECT l.contract, l.sku, l.bde, l.area, l.principle, l.brand, l.tier, l.grp, l.d_end, g.m::date AS m,
       l.vol_y / 12.0 AS t_vol, coalesce(om.vol, 0) AS a_vol
FROM roi_lines_mv l
JOIN LATERAL generate_series(l.ws, l.we, interval '1 month') g(m) ON l.we >= l.ws
LEFT JOIN roi_offtake_mv om ON om.outlet_code = l.outlet_code AND om.sku = l.sku AND om.month = g.m::date;

REVOKE ALL ON public.roi_offtake_mv, public.roi_lines_mv, public.roi_month_mv FROM anon;
GRANT SELECT ON public.roi_offtake_mv, public.roi_lines_mv, public.roi_month_mv TO authenticated;

CREATE OR REPLACE FUNCTION public.roi_refresh() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  REFRESH MATERIALIZED VIEW roi_offtake_mv;
  REFRESH MATERIALIZED VIEW roi_lines_mv;
  REFRESH MATERIALIZED VIEW roi_month_mv;
$$;
REVOKE ALL ON FUNCTION public.roi_refresh() FROM public, anon, authenticated;

-- ── import job (worker) ──
CREATE OR REPLACE FUNCTION public.roi_replace_from_staging(p_batch text)
RETURNS json LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE n_new int; n_old int;
BEGIN
  SELECT count(*) INTO n_new FROM roi_staging WHERE batch_id = p_batch;
  IF n_new = 0 THEN RAISE EXCEPTION 'No rows were uploaded for this batch'; END IF;
  SELECT count(*) INTO n_old FROM "Return of investment";
  DELETE FROM roi_backup;
  INSERT INTO roi_backup SELECT r.*, now() FROM "Return of investment" r;
  DELETE FROM "Return of investment";
  INSERT INTO "Return of investment"
    SELECT (jsonb_populate_record(NULL::"Return of investment", s.data)).* FROM roi_staging s WHERE s.batch_id = p_batch ORDER BY s.rn;
  DELETE FROM roi_staging WHERE batch_id = p_batch;
  PERFORM roi_refresh();
  INSERT INTO roi_import_log (file_name, rows_before, rows_after, imported_by)
    SELECT file_name, n_old, n_new, requested_by FROM data_u_import_jobs WHERE batch_id = p_batch;
  RETURN json_build_object('previous_rows', n_old, 'new_rows', n_new);
END $$;
REVOKE ALL ON FUNCTION public.roi_replace_from_staging(text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.roi_request_replace(p_batch text, p_file text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in first.'; END IF;
  SELECT count(*) INTO n FROM roi_staging WHERE batch_id = p_batch;
  IF n = 0 THEN RAISE EXCEPTION 'No uploaded rows found for this import.'; END IF;
  IF EXISTS (SELECT 1 FROM data_u_import_jobs WHERE status IN ('queued', 'running')) THEN
    RAISE EXCEPTION 'Another import is already waiting or running. Please wait for it to finish.';
  END IF;
  INSERT INTO data_u_import_jobs (batch_id, target, file_name, staged_rows, requested_by)
  VALUES (p_batch, 'roi', p_file, n, auth.jwt() ->> 'email');
  RETURN json_build_object('batch_id', p_batch, 'staged_rows', n, 'status', 'queued');
END $$;
REVOKE ALL ON FUNCTION public.roi_request_replace(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.roi_request_replace(text, text) TO authenticated;

-- worker data_u_process_import_jobs() was patched in place:
--   target 'roi' → roi_replace_from_staging(batch); target 'offtake' → also PERFORM roi_refresh();
--   old roi_staging rows (> 1 day, no running job) are cleaned up; on error the batch's roi_staging rows are deleted.

-- ── page RPCs ──
-- filters: p_status 'active' (end date today or later) / 'ended' / NULL = all
CREATE OR REPLACE FUNCTION public.roi_dashboard(p_bde text DEFAULT NULL, p_area text DEFAULT NULL, p_principle text DEFAULT NULL,
  p_brand text DEFAULT NULL, p_tier text DEFAULT NULL, p_group text DEFAULT NULL, p_status text DEFAULT NULL)
RETURNS json LANGUAGE sql STABLE SET search_path TO 'public' AS $$
WITH x AS (
  SELECT l.*, l.d_end >= current_date AS active FROM roi_lines_mv l
  WHERE (p_bde IS NULL OR l.bde = p_bde) AND (p_area IS NULL OR l.area = p_area)
    AND (p_principle IS NULL OR l.principle = p_principle) AND (p_brand IS NULL OR l.brand = p_brand)
    AND (p_tier IS NULL OR l.tier = p_tier) AND (p_group IS NULL OR l.grp = p_group)
    AND (p_status IS NULL OR (p_status = 'active') = (l.d_end >= current_date))),
c AS (
  SELECT contract, max(outlet_code) outlet_code, max(outlet) outlet, max(grp) grp, max(bde) bde, max(area) area, max(tier) tier,
         min(d_start) d_start, max(d_end) d_end, bool_or(active) active, max(months) months,
         count(*) skus, count(*) FILTER (WHERE sold) skus_sold,
         round(sum(t_vol)) t_vol, round(sum(a_vol)) a_vol, round(sum(t_val)) t_val, round(sum(a_val)) a_val, round(sum(inv)) inv,
         round(sum(vol_y)) vol_y, round(sum(val_y)) val_y, round(sum(disc_y)) disc_y
  FROM x GROUP BY contract)
SELECT json_build_object(
  'data_from', (SELECT min(month) FROM roi_offtake_mv), 'data_to', (SELECT max(month) FROM roi_offtake_mv), 'today', current_date,
  'kpi', (SELECT json_build_object(
      'contracts', count(*), 'active', count(*) FILTER (WHERE active), 'outlets', count(DISTINCT outlet_code),
      'skus', coalesce(sum(skus), 0), 'skus_sold', coalesce(sum(skus_sold), 0),
      't_vol', coalesce(sum(t_vol), 0), 'a_vol', coalesce(sum(a_vol), 0), 't_val', coalesce(sum(t_val), 0), 'a_val', coalesce(sum(a_val), 0),
      'inv', coalesce(sum(inv), 0),
      'hit', count(*) FILTER (WHERE t_vol > 0 AND a_vol >= t_vol), 'with_target', count(*) FILTER (WHERE t_vol > 0)) FROM c),
  'contracts', (SELECT json_agg(c ORDER BY c.d_end DESC, c.outlet) FROM c),
  'by_bde', (SELECT json_agg(t ORDER BY t.t_vol DESC) FROM (
      SELECT coalesce(bde, '(blank)') name, round(sum(t_vol)) t_vol, round(sum(a_vol)) a_vol, round(sum(inv)) inv, round(sum(a_val)) a_val,
             count(DISTINCT contract) contracts FROM x GROUP BY 1) t),
  'by_principle', (SELECT json_agg(t ORDER BY t.t_vol DESC) FROM (
      SELECT coalesce(principle, '(blank)') name, round(sum(t_vol)) t_vol, round(sum(a_vol)) a_vol, round(sum(inv)) inv, round(sum(a_val)) a_val
      FROM x GROUP BY 1) t),
  'by_tier', (SELECT json_agg(t ORDER BY t.name) FROM (
      SELECT coalesce(tier, '(blank)') name, round(sum(t_vol)) t_vol, round(sum(a_vol)) a_vol, count(DISTINCT contract) contracts
      FROM x GROUP BY 1) t),
  'monthly', (SELECT json_agg(t ORDER BY t.m) FROM (
      SELECT m, round(sum(t_vol)) t_vol, round(sum(a_vol)) a_vol FROM roi_month_mv mm
      WHERE (p_bde IS NULL OR mm.bde = p_bde) AND (p_area IS NULL OR mm.area = p_area)
        AND (p_principle IS NULL OR mm.principle = p_principle) AND (p_brand IS NULL OR mm.brand = p_brand)
        AND (p_tier IS NULL OR mm.tier = p_tier) AND (p_group IS NULL OR mm.grp = p_group)
        AND (p_status IS NULL OR (p_status = 'active') = (mm.d_end >= current_date))
      GROUP BY m) t)
)
$$;
GRANT EXECUTE ON FUNCTION public.roi_dashboard(text, text, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.roi_contract_detail(p_contract text)
RETURNS json LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT json_agg(t ORDER BY t.t_vol DESC NULLS LAST) FROM (
    SELECT sku, principle, brand, product, proposed, rebate_pct, months,
           round(t_vol) t_vol, round(a_vol) a_vol, round(t_val) t_val, round(a_val) a_val, round(inv) inv
    FROM roi_lines_mv WHERE contract = p_contract) t
$$;
GRANT EXECUTE ON FUNCTION public.roi_contract_detail(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.roi_options()
RETURNS json LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT json_build_object(
    'bdes', (SELECT json_agg(DISTINCT bde ORDER BY bde) FROM roi_facts WHERE bde IS NOT NULL),
    'areas', (SELECT json_agg(DISTINCT area ORDER BY area) FROM roi_facts WHERE area IS NOT NULL),
    'principles', (SELECT json_agg(DISTINCT principle ORDER BY principle) FROM roi_facts WHERE principle IS NOT NULL),
    'brands', (SELECT json_agg(DISTINCT brand ORDER BY brand) FROM roi_facts WHERE brand IS NOT NULL),
    'tiers', (SELECT json_agg(DISTINCT tier ORDER BY tier) FROM roi_facts WHERE tier IS NOT NULL),
    'groups', (SELECT json_agg(DISTINCT grp ORDER BY grp) FROM roi_facts WHERE grp IS NOT NULL),
    'rows', (SELECT count(*) FROM "Return of investment"),
    'last_import', (SELECT row_to_json(l) FROM (SELECT file_name, rows_after, imported_by, imported_at FROM roi_import_log ORDER BY id DESC LIMIT 1) l))
$$;
GRANT EXECUTE ON FUNCTION public.roi_options() TO authenticated;
