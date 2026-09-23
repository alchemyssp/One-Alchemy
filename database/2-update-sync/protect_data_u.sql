-- ============================================================
-- ทำให้ Company Name / BDE / TEAM ใน Data U อยู่ถาวร
-- แม้จะลบ record ใน Outlet Master ออก
-- Run in Supabase SQL Editor
-- ============================================================

-- Step 1: ดู FK constraint ระหว่าง Data U → Outlet Master (ถ้ามี)
SELECT
  tc.constraint_name,
  tc.table_name        AS from_table,
  kcu.column_name      AS from_column,
  ccu.table_name       AS to_table,
  ccu.column_name      AS to_column,
  rc.delete_rule
FROM information_schema.table_constraints       AS tc
JOIN information_schema.key_column_usage        AS kcu  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
JOIN information_schema.referential_constraints AS rc   ON rc.constraint_name = tc.constraint_name  AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (
    tc.table_name  = 'Data U'        -- Data U อ้างถึง Outlet Master
    OR ccu.table_name = 'Data U'     -- หรือ Outlet Master อ้างถึง Data U
  );

-- ถ้า Step 1 คืนผลว่าง (ไม่มีแถว) แสดงว่าข้อมูลถาวรอยู่แล้ว ไม่ต้องรัน Step 2
-- ถ้ามี FK ที่มี delete_rule = 'CASCADE' ให้ drop ด้วย Step 2 ด้านล่าง

-- ============================================================
-- Step 2: Drop FK ที่ cascade delete (ถ้ามี)
-- เปลี่ยน <constraint_name> เป็นชื่อจริงจาก Step 1
-- ============================================================
-- ALTER TABLE "Data U" DROP CONSTRAINT IF EXISTS "<constraint_name>";


-- ============================================================
-- Step 3: เพิ่ม trigger ใน Outlet Master
-- เมื่อลบ Outlet Master → คัดลอกค่าลง Data U ก่อน (safety net)
-- เผื่อกรณีที่มีคนลบ Outlet Master แล้ว Data U ยังไม่มีข้อมูล
-- ============================================================

CREATE OR REPLACE FUNCTION preserve_data_u_on_outlet_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- ถ้า Data U ยังไม่มี Company Name → ดึงมาจาก OLD record ก่อนลบ
  UPDATE "Data U" du
  SET
    "Company Name" = COALESCE(
      NULLIF(TRIM(du."Company Name"), ''),
      NULLIF(TRIM(OLD."COMPANY NAME"), '')
    ),
    "BDE"  = COALESCE(NULLIF(TRIM(du."BDE"),  ''), NULLIF(TRIM(OLD."BDE"),  '')),
    "TEAM" = COALESCE(NULLIF(TRIM(du."TEAM"), ''), NULLIF(TRIM(OLD."Team"), ''))
  WHERE du."Outlet Code" = OLD."Outlet Code"
    AND (
      (du."Company Name" IS NULL OR du."Company Name" = '')
      OR (du."BDE"  IS NULL OR du."BDE"  = '')
      OR (du."TEAM" IS NULL OR du."TEAM" = '')
    );
  RETURN OLD;
END;
$$;

-- ลบ trigger เก่าถ้ามี แล้วสร้างใหม่
DROP TRIGGER IF EXISTS trg_preserve_data_u ON "Outlet Master";

CREATE TRIGGER trg_preserve_data_u
  BEFORE DELETE ON "Outlet Master"
  FOR EACH ROW
  EXECUTE FUNCTION preserve_data_u_on_outlet_delete();

-- ============================================================
-- Verify: ดูว่า trigger ถูกสร้างแล้ว
-- ============================================================
SELECT trigger_name, event_manipulation, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trg_preserve_data_u';
