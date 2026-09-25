-- Brand Offer: documents (PDF, Word, Excel, forms) the team uses to make contracts with customers.
--   Files live in the private Storage bucket "brand-offer"; one row per file in public.brand_offer_files.
--   Signed-in users can list, upload, open and delete.

-- 1) bucket (private, 50 MB per file, only PDF / Word / Excel / CSV)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-offer', 'brand-offer', false, 52428800, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'text/csv'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "brand_offer_read"   on storage.objects;
drop policy if exists "brand_offer_upload" on storage.objects;
drop policy if exists "brand_offer_delete" on storage.objects;
create policy "brand_offer_read"   on storage.objects for select to authenticated using (bucket_id = 'brand-offer');
create policy "brand_offer_upload" on storage.objects for insert to authenticated with check (bucket_id = 'brand-offer');
create policy "brand_offer_delete" on storage.objects for delete to authenticated using (bucket_id = 'brand-offer');

-- 2) file list
create table if not exists public.brand_offer_files (
  id          bigint generated always as identity primary key,
  title       text not null,
  brand       text,
  category    text not null default 'Contract Form',
  note        text,
  file_path   text not null unique,      -- path inside the bucket
  file_name   text not null,             -- original file name (for download)
  mime        text,
  size_bytes  bigint,
  uploaded_by text,
  created_at  timestamptz not null default now()
);
create index if not exists brand_offer_files_created_idx on public.brand_offer_files (created_at desc);

alter table public.brand_offer_files enable row level security;
drop policy if exists "brand_offer_files_read"   on public.brand_offer_files;
drop policy if exists "brand_offer_files_insert" on public.brand_offer_files;
drop policy if exists "brand_offer_files_update" on public.brand_offer_files;
drop policy if exists "brand_offer_files_delete" on public.brand_offer_files;
create policy "brand_offer_files_read"   on public.brand_offer_files for select to authenticated using (true);
create policy "brand_offer_files_insert" on public.brand_offer_files for insert to authenticated with check (true);
create policy "brand_offer_files_update" on public.brand_offer_files for update to authenticated using (true) with check (true);
create policy "brand_offer_files_delete" on public.brand_offer_files for delete to authenticated using (true);

-- live updates on the page
do $$ begin
  alter publication supabase_realtime add table public.brand_offer_files;
exception when duplicate_object then null; end $$;

-- 3) brand folders (logo from the "Brands Logo" bucket); files go to brand-offer/<folder>/...
drop policy if exists "brands_logo_read" on storage.objects;
create policy "brands_logo_read" on storage.objects for select to authenticated using (bucket_id = 'Brands Logo');

create table if not exists public.brand_offer_brands (
  id bigint generated always as identity primary key,
  name text not null unique,
  folder text not null unique,
  logo_file text,
  created_at timestamptz not null default now());
alter table public.brand_offer_brands enable row level security;
drop policy if exists "brand_offer_brands_read" on public.brand_offer_brands;
drop policy if exists "brand_offer_brands_write" on public.brand_offer_brands;
create policy "brand_offer_brands_read"  on public.brand_offer_brands for select to authenticated using (true);
create policy "brand_offer_brands_write" on public.brand_offer_brands for insert to authenticated with check (true);

-- one folder per logo file (e.g. Campari_Logo.png → "Campari"), plus "General"
insert into public.brand_offer_brands (name, folder, logo_file)
select replace(regexp_replace(name, '_Logo\.[a-z]+$', ''), '_', ' '), regexp_replace(name, '_Logo\.[a-z]+$', ''), name
from storage.objects where bucket_id = 'Brands Logo'
on conflict (name) do nothing;
insert into public.brand_offer_brands (name, folder, logo_file) values ('General', 'General', null) on conflict (name) do nothing;

do $$ begin alter publication supabase_realtime add table public.brand_offer_brands; exception when duplicate_object then null; end $$;

-- 4) principle per brand folder (applied 2026-09-25) — the page groups folders by principle
ALTER TABLE public.brand_offer_brands ADD COLUMN IF NOT EXISTS principle text;
DROP POLICY IF EXISTS "brand_offer_brands_update" ON public.brand_offer_brands;
CREATE POLICY "brand_offer_brands_update" ON public.brand_offer_brands FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
-- filled from the brand → principle pairs in Off-take / ROI data; brands not found there = 'Other'
UPDATE public.brand_offer_brands b SET principle = v.p FROM (VALUES
  ('1800 Tequila','Proximo'), ('Aperol','Campari'), ('Appleton Estate','Campari'), ('Boodles London Dry Gin','Proximo'),
  ('Brugal','TEG'), ('Bruichladdich','RC'), ('Bulldog London Dry Gin','Campari'), ('Bushmills','Proximo'), ('Campari','Campari'),
  ('Cinzano','Campari'), ('Cointreau','RC'), ('Cynar','Campari'), ('Ferdinands Saar','Independent'), ('Four Pillars','Four Pillars'),
  ('Frangelico','Campari'), ('Galliano Vanilla Liqueur','Lucas Bols'), ('Highland Park','TEG'), ('Jose Cuervo','Proximo'),
  ('Kraken Rum','Proximo'), ('Licor 43 Cuarenta Y Tres','Independent'), ('Lucas Bols','Lucas Bols'), ('Mount Gay Rum','RC'),
  ('No3 London Dry Gin','TEG'), ('Octomore','RC'), ('Remy Martin','RC'), ('Skyy Vodka','Campari'), ('St Remy','RC'),
  ('The Botanist Gin','RC'), ('The Famous Grouse','TEG'), ('The Glenrothes','TEG'), ('The Macallan','TEG'), ('The Naked Grouse','TEG'),
  ('Vaccari Sambuca','Lucas Bols'), ('Wild Turkey','Campari'),
  ('Rekorderlig','Other'), ('Snow Leopard','Other'), ('The Kings Ginger Liqueur','Other'), ('Thomas Henry','Other'), ('General','General')
) AS v(n, p) WHERE b.name = v.n AND b.principle IS NULL;

-- 5) new logos (2026-09-25) and brands per principle from the team
--    (the page also creates / links folders by itself when a new logo appears in "Brands Logo")
INSERT INTO public.brand_offer_brands (name, folder, logo_file, principle) VALUES
  ('BBC', 'BBC', 'BBC_Logo.gif', 'BBC'), ('The Kyoto Whisky', 'The_Kyoto_Whisky', 'the-kyoto-whisky_Logo.png', 'Kyoto'),
  ('Branca', 'Branca', 'Branca_Logo.png', 'Branca'), ('Louis XIII', 'Louis_XIII', 'Louis_XIII_Logo.png', 'RC'),
  ('Clase Azul Tequila', 'Clase_Azul_Tequila', 'Clase azul tequila_Logo.webp', 'Clase Azul'), ('Dictador', 'Dictador', 'Dictador_Logo.png', 'Dictador'),
  ('Kilo', 'Kilo', 'Kilo_Logo.png', 'Kilo'), ('Pommery', 'Pommery', 'Pommery_Logo.png', 'Independent'),
  ('Lark', 'Lark', 'Lark_Logo.webp', 'Lark'), ('Telmont', 'Telmont', 'Telmont_Logo.png', 'RC'), ('Teremana', 'Teremana', 'Teremana_Logo.png', 'Teremana'),
  ('Tito''s', 'Titos', NULL, 'Independent'), ('Matusalem', 'Matusalem', NULL, 'Independent'), ('Lady Trieu', 'Lady_Trieu', NULL, 'Independent'),
  ('Kaibutsu', 'Kaibutsu', NULL, 'Independent'), ('Nhau', 'Nhau', NULL, 'Independent'), ('Real McCoy', 'Real_McCoy', NULL, 'Independent'),
  ('Passao', 'Passao', NULL, 'Lucas Bols'), ('Henkes', 'Henkes', NULL, 'Lucas Bols')
ON CONFLICT (name) DO UPDATE SET principle = excluded.principle, logo_file = coalesce(excluded.logo_file, brand_offer_brands.logo_file);
UPDATE public.brand_offer_brands SET principle = 'Independent' WHERE name = 'Four Pillars';
-- Bols Liqueur / Bols Vodka / Bols Genever: one folder "Lucas Bols" (team request)
DELETE FROM public.brand_offer_brands WHERE name IN ('Bols Liqueur', 'Bols Vodka', 'Bols Genever')
  AND NOT EXISTS (SELECT 1 FROM public.brand_offer_files f WHERE f.brand = brand_offer_brands.name);
-- brands under BBC (team request)
UPDATE public.brand_offer_brands SET principle = 'BBC'
WHERE name IN ('Branca', 'Clase Azul Tequila', 'Dictador', 'Kilo', 'The Kyoto Whisky', 'Lark', 'Teremana');

-- 6) campaigns belong to a principle and can cover several brands (2026-09-25)
--    page: principle cards → principle page (brand cards are display only) → upload with ticked brands
ALTER TABLE public.brand_offer_files ADD COLUMN IF NOT EXISTS principle text;
ALTER TABLE public.brand_offer_files ADD COLUMN IF NOT EXISTS brands text[];
UPDATE public.brand_offer_files f SET principle = coalesce(b.principle, 'Other'), brands = ARRAY[f.brand]
FROM public.brand_offer_brands b WHERE f.brand = b.name AND f.principle IS NULL;
CREATE INDEX IF NOT EXISTS brand_offer_files_principle_idx ON public.brand_offer_files (principle);
-- principle renamed Independent → Independence (team request); its logo = Independence_Logo.webp in "Brands Logo"
UPDATE public.brand_offer_brands SET principle = 'Independence' WHERE principle = 'Independent';
UPDATE public.brand_offer_files SET principle = 'Independence' WHERE principle = 'Independent';

-- 7) campaign period (2026-09-25): Launch Date / Until on each file; category list on the page adds "Presentation"
ALTER TABLE public.brand_offer_files ADD COLUMN IF NOT EXISTS launch_date date;
ALTER TABLE public.brand_offer_files ADD COLUMN IF NOT EXISTS until_date date;

-- 8) allow moving files inside brand-offer (the page moves files out of folders ending with "." — Microsoft's viewer
--    drops the trailing dot and then cannot find the file)
DROP POLICY IF EXISTS "brand_offer_move" ON storage.objects;
CREATE POLICY "brand_offer_move" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'brand-offer') WITH CHECK (bucket_id = 'brand-offer');
