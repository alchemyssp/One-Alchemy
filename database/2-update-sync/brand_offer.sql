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
