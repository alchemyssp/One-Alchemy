-- ============================================================
-- SSP — Outlet Change Log Table Setup
-- Run this ONCE in Supabase SQL Editor (Database > SQL Editor)
-- ============================================================

-- 1. Create the log table
CREATE TABLE IF NOT EXISTS outlet_change_log (
  id          BIGSERIAL PRIMARY KEY,
  action      TEXT        NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  record_id   TEXT,
  old_data    JSONB,
  new_data    JSONB,
  changed_by  TEXT,
  changed_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index for fast lookups by record and time
CREATE INDEX IF NOT EXISTS idx_outlet_log_record ON outlet_change_log (record_id);
CREATE INDEX IF NOT EXISTS idx_outlet_log_time   ON outlet_change_log (changed_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE outlet_change_log ENABLE ROW LEVEL SECURITY;

-- 4. Allow authenticated users to read and insert log entries
DROP POLICY IF EXISTS "Allow authenticated read log"   ON outlet_change_log;
DROP POLICY IF EXISTS "Allow authenticated insert log" ON outlet_change_log;

CREATE POLICY "Allow authenticated read log"
  ON outlet_change_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert log"
  ON outlet_change_log FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================
-- Also add INSERT / UPDATE / DELETE policies for Outlet Master
-- (if not already done via add_rls_existing_tables.sql)
-- ============================================================

ALTER TABLE "Outlet Master" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read Outlet Master"   ON "Outlet Master";
DROP POLICY IF EXISTS "Allow authenticated insert Outlet Master" ON "Outlet Master";
DROP POLICY IF EXISTS "Allow authenticated update Outlet Master" ON "Outlet Master";
DROP POLICY IF EXISTS "Allow authenticated delete Outlet Master" ON "Outlet Master";

CREATE POLICY "Allow authenticated read Outlet Master"
  ON "Outlet Master" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert Outlet Master"
  ON "Outlet Master" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update Outlet Master"
  ON "Outlet Master" FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete Outlet Master"
  ON "Outlet Master" FOR DELETE TO authenticated USING (true);

-- Done! Refresh your browser after running this.
