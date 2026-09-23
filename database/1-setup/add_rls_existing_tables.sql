-- ============================================================
-- เปิดสิทธิ์อ่านข้อมูลสำหรับ Table ที่มีอยู่แล้วใน Supabase
-- รัน SQL นี้ใน Supabase SQL Editor ครั้งเดียว
-- ============================================================

-- ---- Return of investment ----
ALTER TABLE "Return of investment" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read ROI" ON "Return of investment";
CREATE POLICY "Allow authenticated read ROI"
  ON "Return of investment" FOR SELECT TO authenticated USING (true);

-- ---- Off-take 2026 ----
ALTER TABLE "Off-take 2026" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read Offtake" ON "Off-take 2026";
CREATE POLICY "Allow authenticated read Offtake"
  ON "Off-take 2026" FOR SELECT TO authenticated USING (true);

-- ---- SKU ----
ALTER TABLE "SKU" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read SKU" ON "SKU";
CREATE POLICY "Allow authenticated read SKU"
  ON "SKU" FOR SELECT TO authenticated USING (true);

-- ---- Contract Master (ถ้ามีข้อมูลแยกจาก contracts) ----
ALTER TABLE "Contract Master" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read Contract Master" ON "Contract Master";
CREATE POLICY "Allow authenticated read Contract Master"
  ON "Contract Master" FOR SELECT TO authenticated USING (true);

-- ---- Outlet Master (ถ้ามีข้อมูลแยกจาก outlets) ----
ALTER TABLE "Outlet Master" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read Outlet Master" ON "Outlet Master";
CREATE POLICY "Allow authenticated read Outlet Master"
  ON "Outlet Master" FOR SELECT TO authenticated USING (true);

-- ---- Promotion / Trade deal ----
ALTER TABLE "Promotion / Trade deal" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read Promotion Trade deal" ON "Promotion / Trade deal";
CREATE POLICY "Allow authenticated read Promotion Trade deal"
  ON "Promotion / Trade deal" FOR SELECT TO authenticated USING (true);

-- ============================================================
-- เปิด Realtime สำหรับ Table ใหม่
-- ============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "Return of investment";
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "Off-take 2026";
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "SKU";
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
