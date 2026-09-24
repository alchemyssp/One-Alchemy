-- ============================================================
-- Contract Master — Excel import (applied 2026-09-24)
-- Two source files, each REPLACES only its own contract type:
--   "YEARLY CONTRACT LIST - updated.xlsx"          sheet "Data_Yearly Contracts"    → Type = 'Yearly Contract'
--   "Marketing Contracts Updated 2023 - 2026 ….xlsx" sheet "Data_Marketing Contracts" → Type = 'Marketing Contract'
-- Same pattern as data_u_monthly_import.sql:
--   website (js/contract-import.js) → contract_staging → contract_request_replace()
--   → job in data_u_import_jobs (target = 'contract_yearly' / 'contract_marketing')
--   → pg_cron worker data_u_process_import_jobs() → contract_replace_from_staging()
--      backup rows of that type → delete them → insert staged rows (keeps 3 backups)
-- The website maps Excel columns to the existing Contract Master columns, converts
-- Excel dates to "1-Mar-19" (START/END) and "19-Mar" (RECEIVED DATE), drops helper
-- columns and removes rows that are identical in every column.
-- ============================================================

-- columns from the new files that had no match in Contract Master
ALTER TABLE public."Contract Master"
  ADD COLUMN IF NOT EXISTS "Code of Contract"   text,
  ADD COLUMN IF NOT EXISTS "Company Code"       text,
  ADD COLUMN IF NOT EXISTS "Field"              text,
  ADD COLUMN IF NOT EXISTS "Priority SKUs"      text,
  ADD COLUMN IF NOT EXISTS "Total Sku"          text,
  ADD COLUMN IF NOT EXISTS "Total Target (ROI)" text,
  ADD COLUMN IF NOT EXISTS "SCAN"               text;

CREATE TABLE IF NOT EXISTS public.contract_staging (LIKE public."Contract Master");
ALTER TABLE public.contract_staging
  ADD COLUMN IF NOT EXISTS batch_id  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS loaded_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS contract_staging_batch_idx ON public.contract_staging (batch_id);

CREATE TABLE IF NOT EXISTS public.contract_backup (LIKE public."Contract Master");
ALTER TABLE public.contract_backup
  ADD COLUMN IF NOT EXISTS batch_id  text,
  ADD COLUMN IF NOT EXISTS backup_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS contract_backup_batch_idx ON public.contract_backup (batch_id);

ALTER TABLE public.contract_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_backup  ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in users manage contract staging" ON public.contract_staging;
CREATE POLICY "Signed-in users manage contract staging" ON public.contract_staging
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Signed-in users read contract backup" ON public.contract_backup;
CREATE POLICY "Signed-in users read contract backup" ON public.contract_backup
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE ALL ON public.contract_staging, public.contract_backup FROM anon;
GRANT SELECT, INSERT, DELETE ON public.contract_staging TO authenticated;
GRANT SELECT ON public.contract_backup TO authenticated;

-- rows of one type ('Yearly Contract' / 'Marketing Contract'; old rows used the typo 'Marketinng Contract')
CREATE OR REPLACE FUNCTION public.contract_is_type(t text, p_type text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_type = 'Yearly Contract' THEN coalesce(t, '') ~* 'year'
              ELSE coalesce(t, '') ~* 'market' END
$$;

CREATE OR REPLACE FUNCTION public.contract_replace_from_staging(p_batch text, p_type text, p_force boolean DEFAULT false)
RETURNS json LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE n_new int; n_old int; cols text;
BEGIN
  IF p_type NOT IN ('Yearly Contract', 'Marketing Contract') THEN RAISE EXCEPTION 'Unknown contract type %', p_type; END IF;
  SELECT count(*) INTO n_new FROM contract_staging WHERE batch_id = p_batch;
  SELECT count(*) INTO n_old FROM "Contract Master" WHERE contract_is_type("Type", p_type);
  IF n_new = 0 THEN RAISE EXCEPTION 'No uploaded rows found for this import.'; END IF;
  IF NOT p_force AND n_new < n_old * 0.5 THEN
    RAISE EXCEPTION 'The file has % rows but Contract Master has % % rows (less than half). Import stopped to protect your data.', n_new, n_old, p_type;
  END IF;
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'contract_staging' AND column_name NOT IN ('batch_id', 'loaded_at');
  EXECUTE format('INSERT INTO contract_backup (%s, batch_id, backup_at) SELECT %s, %L, now() FROM "Contract Master" WHERE contract_is_type("Type", %L)',
                 cols, cols, p_batch, p_type);
  DELETE FROM "Contract Master" WHERE contract_is_type("Type", p_type);
  EXECUTE format('INSERT INTO "Contract Master" (%s) SELECT %s FROM contract_staging WHERE batch_id = %L', cols, cols, p_batch);
  DELETE FROM contract_staging WHERE batch_id = p_batch;
  DELETE FROM contract_backup
  WHERE batch_id NOT IN (SELECT batch_id FROM contract_backup GROUP BY batch_id ORDER BY max(backup_at) DESC LIMIT 3);
  RETURN json_build_object('previous_rows', n_old, 'new_rows', n_new);
END $$;
REVOKE ALL ON FUNCTION public.contract_replace_from_staging(text, text, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.contract_request_replace(p_batch text, p_type text, p_file text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in first.'; END IF;
  IF p_type NOT IN ('Yearly Contract', 'Marketing Contract') THEN RAISE EXCEPTION 'Unknown contract type %', p_type; END IF;
  SELECT count(*) INTO n FROM contract_staging WHERE batch_id = p_batch;
  IF n = 0 THEN RAISE EXCEPTION 'No uploaded rows found for this import.'; END IF;
  IF EXISTS (SELECT 1 FROM data_u_import_jobs WHERE status IN ('queued', 'running')) THEN
    RAISE EXCEPTION 'Another import is already waiting or running. Please wait for it to finish.';
  END IF;
  INSERT INTO data_u_import_jobs (batch_id, target, file_name, staged_rows, requested_by)
  VALUES (p_batch, CASE WHEN p_type = 'Yearly Contract' THEN 'contract_yearly' ELSE 'contract_marketing' END,
          p_file, n, auth.jwt() ->> 'email');
  RETURN json_build_object('batch_id', p_batch, 'staged_rows', n, 'status', 'queued');
END $$;
REVOKE ALL ON FUNCTION public.contract_request_replace(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_request_replace(text, text, text) TO authenticated;

-- Worker now handles Data U, Off-take and both contract types (schedule: see data_u_monthly_import.sql)
CREATE OR REPLACE FUNCTION public.data_u_process_import_jobs()
RETURNS void LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE j record; r json;
BEGIN
  DELETE FROM data_u_staging s WHERE loaded_at < now() - interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM data_u_import_jobs q WHERE q.batch_id = s.batch_id AND q.status IN ('queued','running'));
  DELETE FROM offtake_staging s WHERE loaded_at < now() - interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM data_u_import_jobs q WHERE q.batch_id = s.batch_id AND q.status IN ('queued','running'));
  DELETE FROM contract_staging s WHERE loaded_at < now() - interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM data_u_import_jobs q WHERE q.batch_id = s.batch_id AND q.status IN ('queued','running'));

  SELECT * INTO j FROM data_u_import_jobs WHERE status = 'queued' ORDER BY requested_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE data_u_import_jobs SET status = 'running', started_at = now() WHERE batch_id = j.batch_id;

  BEGIN
    IF j.target = 'offtake' THEN r := offtake_replace_from_staging(j.batch_id);
    ELSIF j.target = 'contract_yearly' THEN r := contract_replace_from_staging(j.batch_id, 'Yearly Contract');
    ELSIF j.target = 'contract_marketing' THEN r := contract_replace_from_staging(j.batch_id, 'Marketing Contract');
    ELSE r := data_u_replace_from_staging(j.batch_id); END IF;
    UPDATE data_u_import_jobs SET status = 'done', finished_at = now(),
      previous_rows = (r->>'previous_rows')::int, new_rows = (r->>'new_rows')::int, message = 'Import complete'
    WHERE batch_id = j.batch_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE data_u_import_jobs SET status = 'error', finished_at = now(), message = SQLERRM WHERE batch_id = j.batch_id;
    IF j.target = 'offtake' THEN DELETE FROM offtake_staging WHERE batch_id = j.batch_id;
    ELSIF j.target LIKE 'contract_%' THEN DELETE FROM contract_staging WHERE batch_id = j.batch_id;
    ELSE DELETE FROM data_u_staging WHERE batch_id = j.batch_id; END IF;
  END;
END $$;
REVOKE ALL ON FUNCTION public.data_u_process_import_jobs() FROM PUBLIC, anon, authenticated;
