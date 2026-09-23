-- ============================================================
-- Off-take 2026 — monthly Excel import (applied 2026-09-23)
-- Same pattern as data_u_monthly_import.sql:
--   website (js/offtake-import.js) → offtake_staging → offtake_request_replace()
--   → job in data_u_import_jobs (target = 'offtake')
--   → pg_cron worker data_u_process_import_jobs() → offtake_replace_from_staging()
--      backup current rows → TRUNCATE → insert staged rows (keeps 3 backups)
-- File: "Actual Off-Take by SKUs JAN 24 - <MONTH> 26.xlsx", sheet "Data_Total Off-Take",
-- header row 2, same 25 column names as the table. The website converts:
--   Received Month  Excel date → "24-Jan"
--   prices/totals   → "1,630.00" (text, like the existing rows)
--   codes/text      → trimmed
-- ============================================================

CREATE TABLE IF NOT EXISTS public.offtake_staging (LIKE public."Off-take 2026");
ALTER TABLE public.offtake_staging
  ADD COLUMN IF NOT EXISTS batch_id  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS loaded_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS offtake_staging_batch_idx ON public.offtake_staging (batch_id);

CREATE TABLE IF NOT EXISTS public.offtake_backup (LIKE public."Off-take 2026");
ALTER TABLE public.offtake_backup
  ADD COLUMN IF NOT EXISTS batch_id  text,
  ADD COLUMN IF NOT EXISTS backup_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS offtake_backup_batch_idx ON public.offtake_backup (batch_id);

ALTER TABLE public.offtake_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offtake_backup  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users manage offtake staging" ON public.offtake_staging
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Signed-in users read offtake backup" ON public.offtake_backup
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE ALL ON public.offtake_staging, public.offtake_backup FROM anon;
GRANT SELECT, INSERT, DELETE ON public.offtake_staging TO authenticated;
GRANT SELECT ON public.offtake_backup TO authenticated;

ALTER TABLE public.data_u_import_jobs ADD COLUMN IF NOT EXISTS target text NOT NULL DEFAULT 'data_u';

CREATE OR REPLACE FUNCTION public.offtake_replace_from_staging(p_batch text, p_force boolean DEFAULT false)
RETURNS json LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE n_new int; n_old int; cols text;
BEGIN
  SELECT count(*) INTO n_new FROM offtake_staging WHERE batch_id = p_batch;
  SELECT count(*) INTO n_old FROM "Off-take 2026";
  IF n_new = 0 THEN RAISE EXCEPTION 'No uploaded rows found for this import.'; END IF;
  IF NOT p_force AND n_new < n_old * 0.5 THEN
    RAISE EXCEPTION 'The file has % rows but Off-take has % (less than half). Import stopped to protect your data.', n_new, n_old;
  END IF;
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'offtake_staging' AND column_name NOT IN ('batch_id','loaded_at');
  EXECUTE format('INSERT INTO offtake_backup (%s, batch_id, backup_at) SELECT %s, %L, now() FROM "Off-take 2026"', cols, cols, p_batch);
  TRUNCATE "Off-take 2026";
  EXECUTE format('INSERT INTO "Off-take 2026" (%s) SELECT %s FROM offtake_staging WHERE batch_id = %L', cols, cols, p_batch);
  DELETE FROM offtake_staging WHERE batch_id = p_batch;
  DELETE FROM offtake_backup
  WHERE batch_id NOT IN (SELECT batch_id FROM offtake_backup GROUP BY batch_id ORDER BY max(backup_at) DESC LIMIT 3);
  RETURN json_build_object('previous_rows', n_old, 'new_rows', n_new);
END $$;
REVOKE ALL ON FUNCTION public.offtake_replace_from_staging(text, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.offtake_request_replace(p_batch text, p_file text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in first.'; END IF;
  SELECT count(*) INTO n FROM offtake_staging WHERE batch_id = p_batch;
  IF n = 0 THEN RAISE EXCEPTION 'No uploaded rows found for this import.'; END IF;
  IF EXISTS (SELECT 1 FROM data_u_import_jobs WHERE status IN ('queued','running')) THEN
    RAISE EXCEPTION 'Another import is already waiting or running. Please wait for it to finish.';
  END IF;
  INSERT INTO data_u_import_jobs (batch_id, target, file_name, staged_rows, requested_by)
  VALUES (p_batch, 'offtake', p_file, n, auth.jwt() ->> 'email');
  RETURN json_build_object('batch_id', p_batch, 'staged_rows', n, 'status', 'queued');
END $$;
REVOKE ALL ON FUNCTION public.offtake_request_replace(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offtake_request_replace(text, text) TO authenticated;

-- Worker now handles both targets (see data_u_monthly_import.sql for the schedule)
CREATE OR REPLACE FUNCTION public.data_u_process_import_jobs()
RETURNS void LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE j record; r json;
BEGIN
  DELETE FROM data_u_staging s WHERE loaded_at < now() - interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM data_u_import_jobs q WHERE q.batch_id = s.batch_id AND q.status IN ('queued','running'));
  DELETE FROM offtake_staging s WHERE loaded_at < now() - interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM data_u_import_jobs q WHERE q.batch_id = s.batch_id AND q.status IN ('queued','running'));

  SELECT * INTO j FROM data_u_import_jobs WHERE status = 'queued' ORDER BY requested_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE data_u_import_jobs SET status = 'running', started_at = now() WHERE batch_id = j.batch_id;

  BEGIN
    IF j.target = 'offtake' THEN r := offtake_replace_from_staging(j.batch_id);
    ELSE r := data_u_replace_from_staging(j.batch_id); END IF;
    UPDATE data_u_import_jobs SET status = 'done', finished_at = now(),
      previous_rows = (r->>'previous_rows')::int, new_rows = (r->>'new_rows')::int, message = 'Import complete'
    WHERE batch_id = j.batch_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE data_u_import_jobs SET status = 'error', finished_at = now(), message = SQLERRM WHERE batch_id = j.batch_id;
    IF j.target = 'offtake' THEN DELETE FROM offtake_staging WHERE batch_id = j.batch_id;
    ELSE DELETE FROM data_u_staging WHERE batch_id = j.batch_id; END IF;
  END;
END $$;
REVOKE ALL ON FUNCTION public.data_u_process_import_jobs() FROM PUBLIC, anon, authenticated;
