-- ============================================================
-- SSP — Setup user_profile
-- รันทีละ STEP ตามลำดับใน Supabase SQL Editor
-- ============================================================


-- ════════════════════════════════════
-- STEP 1: ดู columns ทั้งหมดใน user_profile ก่อน
-- รัน STEP นี้อย่างเดียวก่อน แล้วดูผล
-- ════════════════════════════════════

SELECT
  ordinal_position AS "#",
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profile'
ORDER BY ordinal_position;


-- ════════════════════════════════════
-- STEP 2: เพิ่ม column ที่จำเป็น
-- (รันได้เลยหลัง STEP 1)
-- ════════════════════════════════════

ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS auth_email text;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS role       text DEFAULT 'User';
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS is_active  boolean DEFAULT true;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();


-- ════════════════════════════════════
-- STEP 3: สร้าง auth_email จาก primary key
-- ระบบจะหา primary key column ให้อัตโนมัติ
-- ════════════════════════════════════

DO $outer$
DECLARE
  pk_col text;
BEGIN
  -- หา primary key column อัตโนมัติ
  SELECT kcu.column_name INTO pk_col
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema   = kcu.table_schema
  WHERE tc.table_name      = 'user_profile'
    AND tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema    = 'public'
  LIMIT 1;

  IF pk_col IS NULL THEN
    RAISE EXCEPTION 'ไม่พบ Primary Key ใน user_profile — ตรวจสอบ table ด้วย STEP 1 ก่อน';
  END IF;

  RAISE NOTICE '>>> Primary key column = %', pk_col;

  -- สร้าง auth_email จาก primary key
  EXECUTE format(
    $q$UPDATE user_profile
       SET auth_email = %I::text || '@ssp.local'
       WHERE auth_email IS NULL OR auth_email = ''$q$,
    pk_col
  );

  RAISE NOTICE '>>> auth_email updated successfully';
END $outer$;


-- ════════════════════════════════════
-- STEP 4: RLS
-- ════════════════════════════════════

ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users can read user_profile"   ON user_profile;
DROP POLICY IF EXISTS "Auth users can insert user_profile" ON user_profile;
DROP POLICY IF EXISTS "Auth users can update user_profile" ON user_profile;
DROP POLICY IF EXISTS "Auth users can delete user_profile" ON user_profile;

CREATE POLICY "Auth users can read user_profile"
  ON user_profile FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert user_profile"
  ON user_profile FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update user_profile"
  ON user_profile FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete user_profile"
  ON user_profile FOR DELETE USING (auth.uid() IS NOT NULL);


-- ════════════════════════════════════
-- STEP 5: RPC function + GRANT
-- สร้างทั้ง function และ grant ให้ anon เรียกได้
-- ════════════════════════════════════

DO $outer$
DECLARE
  pk_col   text;
  func_sql text;
BEGIN
  -- หา primary key column อัตโนมัติ
  SELECT kcu.column_name INTO pk_col
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema   = kcu.table_schema
  WHERE tc.table_name      = 'user_profile'
    AND tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema    = 'public'
  LIMIT 1;

  IF pk_col IS NULL THEN
    RAISE EXCEPTION 'ไม่พบ Primary Key ใน user_profile';
  END IF;

  RAISE NOTICE '>>> Creating RPC with pk_col = %', pk_col;

  -- สร้าง function โดยฝัง column name จริง
  func_sql := format($f$
    CREATE OR REPLACE FUNCTION get_auth_email(p_id text)
    RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $body$
    DECLARE
      v_email text;
    BEGIN
      SELECT auth_email INTO v_email
      FROM user_profile
      WHERE %I::text = trim(p_id)
        AND is_active IS NOT FALSE
      LIMIT 1;
      RETURN v_email;
    END;
    $body$
  $f$, pk_col);

  EXECUTE func_sql;

  GRANT EXECUTE ON FUNCTION get_auth_email(text) TO anon;

  RAISE NOTICE '>>> RPC get_auth_email created and granted to anon';
END $outer$;


-- ════════════════════════════════════
-- STEP 6: ตรวจสอบผล
-- ════════════════════════════════════

SELECT
  *,
  to_char(created_at AT TIME ZONE 'Asia/Bangkok', 'DD Mon YYYY') AS created_th
FROM user_profile
ORDER BY created_at DESC
LIMIT 20;
