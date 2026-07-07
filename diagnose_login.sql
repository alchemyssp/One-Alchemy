-- ============================================================
-- Login Diagnostic — รันใน Supabase SQL Editor
-- ============================================================

-- STEP A: ดูโครงสร้าง user_profile และข้อมูลทั้งหมด
SELECT
  ordinal_position AS "#",
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_profile'
ORDER BY ordinal_position;

-- ============================================================
-- STEP B: ดูข้อมูลผู้ใช้ทั้งหมด (รัน step นี้แยก)
-- ============================================================

SELECT * FROM user_profile ORDER BY created_at DESC LIMIT 20;

-- ============================================================
-- STEP C: ดู primary key column
-- ============================================================

SELECT kcu.column_name AS pk_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema   = kcu.table_schema
WHERE tc.table_name      = 'user_profile'
  AND tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema    = 'public';

-- ============================================================
-- STEP D: ทดสอบ RPC function โดยตรง
-- เปลี่ยน 'YOUR_USERNAME' เป็น username ที่คุณพิมพ์บน Login
-- ============================================================

SELECT get_auth_email('YOUR_USERNAME') AS result;

-- ============================================================
-- STEP E: ดู Supabase Auth users (ต้องใช้ service_role)
-- ถ้าใช้ anon key ไม่ได้ → ไปดูที่ Supabase Dashboard > Auth > Users
-- ============================================================

SELECT id, email, created_at, last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;
