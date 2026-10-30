-- Speakeasy migration 0005: avatars and media gallery
--
-- Adds profile pictures for all three roles and a photo/video gallery for
-- bartenders and bars, backed by Supabase Storage. Upload is owner-only; the
-- gallery listing respects who may see a bartender (owner, discoverable, or an
-- approved subscriber). Bar media is visible to that bar's members.
--
-- PoC note: the storage buckets are public-read, so the raw file bytes are
-- fetchable by anyone holding the URL. The media TABLE (and its RLS below) gates
-- discovery/listing. For production, move the media bucket to private and serve
-- through signed URLs created only when the media row is readable.

-- 1. Avatar columns, one per profile type so readability matches existing RLS.
alter table bartender_profiles add column if not exists avatar_url text;
alter table patron_profiles    add column if not exists avatar_url text;
alter table bar_accounts        add column if not exists avatar_url text;

-- 2. Media gallery rows. Exactly one owner (a bartender or a bar).
create table if not exists media (
  id           uuid primary key default gen_random_uuid(),
  bartender_id uuid references bartender_profiles(id) on delete cascade,
  bar_id       uuid references bar_accounts(id) on delete cascade,
  kind         text not null check (kind in ('photo','video')),
  storage_path text not null,
  caption      text not null default '',
  created_at   timestamptz not null default now(),
  check ( (bartender_id is not null)::int + (bar_id is not null)::int = 1 )
);

alter table media enable row level security;

drop policy if exists media_read on media;
create policy media_read on media for select to authenticated using (
  (
    bartender_id is not null and (
      bartender_id = app_current_bartender_id()
      or exists (select 1 from bartender_profiles b where b.id = bartender_id and b.discoverable)
      or app_has_member_access(bartender_id, 1)
    )
  )
  or ( bar_id is not null and app_is_bar_member(bar_id) )
);

drop policy if exists media_insert on media;
create policy media_insert on media for insert to authenticated with check (
  ( bartender_id is not null and bartender_id = app_current_bartender_id() )
  or ( bar_id is not null and app_is_bar_member(bar_id) )
);

drop policy if exists media_delete on media;
create policy media_delete on media for delete to authenticated using (
  ( bartender_id is not null and bartender_id = app_current_bartender_id() )
  or ( bar_id is not null and app_is_bar_member(bar_id) )
);

-- 3. Storage buckets (public-read for the PoC; see note above).
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('media',   'media',   true)
on conflict (id) do nothing;

-- 4. Storage write policies: a user may write only inside a folder named after
--    their own uid (path like "<uid>/<file>"). Public read needs no policy
--    because the buckets are public.
drop policy if exists "avatars write own" on storage.objects;
create policy "avatars write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media write own" on storage.objects;
create policy "media write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media delete own" on storage.objects;
create policy "media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
