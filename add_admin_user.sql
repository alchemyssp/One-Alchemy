-- ============================================================
-- เพิ่ม Admin User เข้า "User" table
-- รันใน Supabase SQL Editor
-- ============================================================

-- Step 1: รัน setup_users.sql ก่อน (ถ้ายังไม่ได้รัน)

-- Step 2: เพิ่ม Admin record
-- เปลี่ยน 'Admin' เป็นชื่อที่ต้องการแสดงในระบบ
-- auth_email ต้องตรงกับ email ที่ใช้สมัคร Supabase Auth

INSERT INTO "User" (username, auth_email, role, is_active, created_at)
VALUES (
  'Admin',                              -- ชื่อที่แสดงในระบบ (เปลี่ยนได้)
  'sales_admin1@alchemy-asia.com',      -- email จริงที่ใช้ login Supabase (ห้ามเปลี่ยน)
  'Admin',
  true,
  now()
)
ON CONFLICT (username) DO UPDATE
  SET role       = 'Admin',
      auth_email = 'sales_admin1@alchemy-asia.com',
      is_active  = true,
      updated_at = now();

-- Step 3: ตรวจสอบ
SELECT id, username, auth_email, role, is_active, created_at
FROM "User"
ORDER BY created_at DESC;

-- ============================================================
-- หมายเหตุ Login:
--   Username: Admin
--   Password: (password เดิมที่ใช้ login อยู่แล้ว)
-- ถ้าต้องการเปลี่ยน Username ให้แก้ที่บรรทัด 'Admin' ด้านบน
-- ============================================================
