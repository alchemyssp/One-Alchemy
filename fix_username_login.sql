-- ============================================================
-- FIX: ใช้ username column เป็น login key
-- รันทั้งหมดในคราวเดียว
-- ============================================================

-- STEP 1: อัปเดต auth_email ให้ตรงกับ username
UPDATE user_profile
SET auth_email = lower(trim(username)) || '@ssp.local'
WHERE username IS NOT NULL AND trim(username) != '';

-- STEP 2: สร้าง RPC ใหม่ ให้ lookup ด้วย username column
CREATE OR REPLACE FUNCTION get_auth_email(p_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email text;
BEGIN
  SELECT auth_email INTO v_email
  FROM user_profile
  WHERE lower(trim(username::text)) = lower(trim(p_id))
    AND is_active IS NOT FALSE
  LIMIT 1;
  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION get_auth_email(text) TO anon;

-- STEP 3: ตรวจสอบผล
SELECT no, username, auth_email, role, is_active FROM user_profile ORDER BY no;
