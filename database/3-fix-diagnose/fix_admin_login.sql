-- ============================================================
-- STEP 1: ดูว่า auth_email ของ Nida คืออะไร
-- ============================================================
SELECT * FROM user_profile WHERE CAST(id AS TEXT) ILIKE '%nida%'
   OR CAST(username AS TEXT) ILIKE '%nida%'
   OR CAST(name AS TEXT) ILIKE '%nida%';

-- ถ้าไม่เจอ ให้ดูทั้งหมด:
-- SELECT * FROM user_profile ORDER BY created_at DESC;

-- ============================================================
-- STEP 2: ดู auth_email ที่ RPC จะ return
-- ============================================================
SELECT get_auth_email('Nida') AS auth_email_returned;

-- ============================================================
-- STEP 3: ดู Supabase Auth accounts ว่ามี nida@ssp.local ไหม
-- ============================================================
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- ============================================================
-- FIX A: ถ้า auth.users ไม่มี nida@ssp.local เลย
-- → user ถูกเพิ่มใน user_profile แต่ไม่มี Supabase Auth account
-- → ต้อง reset password ผ่าน Dashboard หรือสร้าง user ใหม่ผ่าน User Management
-- ============================================================

-- FIX B: ถ้าต้องการ reset password ให้ Nida ผ่าน SQL (service role)
-- UPDATE auth.users SET encrypted_password = crypt('AA1234', gen_salt('bf'))
-- WHERE email = 'nida@ssp.local';
