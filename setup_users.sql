-- ============================================================
-- User Management Table Setup
-- Run in Supabase SQL Editor
-- ============================================================

-- Step 1: ปรับ "User" table ให้มี column ที่จำเป็น
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username"   text NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "auth_email" text;         -- internal email ใช้กับ Supabase Auth
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role"       text DEFAULT 'User';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "is_active"  boolean DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "created_at" timestamptz DEFAULT now();
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now();

-- Step 2: เพิ่ม UNIQUE constraint บน username
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS user_username_unique;
ALTER TABLE "User" ADD CONSTRAINT user_username_unique UNIQUE (username);

-- Step 3: เปิด RLS
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS Policies
DROP POLICY IF EXISTS "Auth users can read User"   ON "User";
DROP POLICY IF EXISTS "Auth users can insert User" ON "User";
DROP POLICY IF EXISTS "Auth users can update User" ON "User";
DROP POLICY IF EXISTS "Auth users can delete User" ON "User";

CREATE POLICY "Auth users can read User"
  ON "User" FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert User"
  ON "User" FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update User"
  ON "User" FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete User"
  ON "User" FOR DELETE USING (auth.uid() IS NOT NULL);

-- Step 5: RPC function — ให้ anon ค้นหา auth_email จาก username ได้
-- (จำเป็นสำหรับ login flow: username → auth_email → signInWithPassword)
CREATE OR REPLACE FUNCTION get_auth_email(p_username text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email text;
BEGIN
  SELECT auth_email INTO v_email
  FROM "User"
  WHERE lower(trim(username)) = lower(trim(p_username))
    AND is_active IS NOT FALSE
  LIMIT 1;
  RETURN v_email;
END;
$$;

-- อนุญาตให้ anon เรียก function นี้ได้ (จำเป็นสำหรับ login ก่อน auth)
GRANT EXECUTE ON FUNCTION get_auth_email(text) TO anon;

-- Step 6: ดู columns ปัจจุบัน
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'User'
ORDER BY ordinal_position;

-- ============================================================
-- หมายเหตุ: ใน Supabase Dashboard → Authentication → Settings
-- ให้ปิด "Confirm email" เพื่อให้ user ที่ admin สร้างล็อกอินได้ทันที
-- ============================================================
