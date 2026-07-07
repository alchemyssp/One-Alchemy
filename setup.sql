-- ============================================================
-- Contract Hub - Supabase Database Setup
-- วิธีใช้: Copy ทั้งหมดนี้ไปวางใน Supabase > SQL Editor > Run
-- ============================================================

-- 1. User Profiles (ต่อยอดจาก Supabase Auth)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Outlet Master
CREATE TABLE IF NOT EXISTS outlets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  outlet_code TEXT,
  outlet_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  province TEXT,
  category TEXT DEFAULT 'Other',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Contract Master
CREATE TABLE IF NOT EXISTS contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_no TEXT,
  outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
  contract_type TEXT DEFAULT 'annual',
  start_date DATE,
  end_date DATE,
  value NUMERIC(15,2) DEFAULT 0,
  payment_terms TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Promotions / Trade Deals
CREATE TABLE IF NOT EXISTS promotions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  promo_name TEXT NOT NULL,
  promo_type TEXT DEFAULT 'discount' CHECK (promo_type IN ('discount','trade_deal','rebate','free_goods','other')),
  discount_type TEXT DEFAULT 'percent' CHECK (discount_type IN ('percent','amount')),
  discount_value NUMERIC(10,2) DEFAULT 0,
  min_purchase NUMERIC(15,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER outlets_updated_at
  BEFORE UPDATE ON outlets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER promotions_updated_at
  BEFORE UPDATE ON promotions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Auto-create user profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- user_profiles policies
DROP POLICY IF EXISTS "View own profile" ON user_profiles;
DROP POLICY IF EXISTS "Update own profile" ON user_profiles;
CREATE POLICY "View own profile" ON user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Update own profile" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- outlets policies
DROP POLICY IF EXISTS "View outlets" ON outlets;
DROP POLICY IF EXISTS "Insert outlets" ON outlets;
DROP POLICY IF EXISTS "Update outlets" ON outlets;
DROP POLICY IF EXISTS "Delete outlets" ON outlets;
CREATE POLICY "View outlets" ON outlets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert outlets" ON outlets FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Update outlets" ON outlets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Delete outlets" ON outlets FOR DELETE TO authenticated USING (true);

-- contracts policies
DROP POLICY IF EXISTS "View contracts" ON contracts;
DROP POLICY IF EXISTS "Insert contracts" ON contracts;
DROP POLICY IF EXISTS "Update contracts" ON contracts;
DROP POLICY IF EXISTS "Delete contracts" ON contracts;
CREATE POLICY "View contracts" ON contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert contracts" ON contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Update contracts" ON contracts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Delete contracts" ON contracts FOR DELETE TO authenticated USING (true);

-- promotions policies
DROP POLICY IF EXISTS "View promotions" ON promotions;
DROP POLICY IF EXISTS "Insert promotions" ON promotions;
DROP POLICY IF EXISTS "Update promotions" ON promotions;
DROP POLICY IF EXISTS "Delete promotions" ON promotions;
CREATE POLICY "View promotions" ON promotions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert promotions" ON promotions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Update promotions" ON promotions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Delete promotions" ON promotions FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Enable Realtime (safe to run multiple times)
-- ============================================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE outlets; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE contracts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE promotions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
