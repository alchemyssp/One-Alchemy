-- ============================================================
-- SSP — Full Setup SQL
-- Run this ONCE in Supabase SQL Editor after re-creating tables
-- SQL Editor → New query → Paste → RUN
-- ============================================================

-- ============================================================
-- PART 1: RLS for "Outlet Master" table
-- ============================================================

ALTER TABLE "Outlet Master" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read Outlet Master"   ON "Outlet Master";
DROP POLICY IF EXISTS "Allow authenticated insert Outlet Master" ON "Outlet Master";
DROP POLICY IF EXISTS "Allow authenticated update Outlet Master" ON "Outlet Master";
DROP POLICY IF EXISTS "Allow authenticated delete Outlet Master" ON "Outlet Master";
DROP POLICY IF EXISTS "anon read Outlet Master"                  ON "Outlet Master";

-- Logged-in users can read/add/edit/delete
CREATE POLICY "Allow authenticated read Outlet Master"
  ON "Outlet Master" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert Outlet Master"
  ON "Outlet Master" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update Outlet Master"
  ON "Outlet Master" FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete Outlet Master"
  ON "Outlet Master" FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PART 2: Create outlet_change_log table (for Log History)
-- ============================================================

CREATE TABLE IF NOT EXISTS outlet_change_log (
  id          BIGSERIAL    PRIMARY KEY,
  action      TEXT         NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  record_id   TEXT,
  old_data    JSONB,
  new_data    JSONB,
  changed_by  TEXT,
  changed_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlet_log_record ON outlet_change_log (record_id);
CREATE INDEX IF NOT EXISTS idx_outlet_log_time   ON outlet_change_log (changed_at DESC);

ALTER TABLE outlet_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read log"   ON outlet_change_log;
DROP POLICY IF EXISTS "Allow authenticated insert log" ON outlet_change_log;

CREATE POLICY "Allow authenticated read log"
  ON outlet_change_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert log"
  ON outlet_change_log FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- PART 3: user_profiles table (for sidebar name display)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;

CREATE POLICY "Users read own profile"
  ON user_profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============================================================
-- Done! Now go back to the browser and Sign In again.
-- ============================================================
