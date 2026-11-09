-- ===========================================================================
-- LandFlow — Supabase schema
--
-- Run this in the Supabase Dashboard SQL Editor (or `psql`) ONCE.
--
-- The security model in one line:
--   listings          -> public READ (active only), owner WRITE
--   profiles          -> owner ONLY, ever
--   saved_listings    -> owner ONLY
--   listing_enquiries -> buyer INSERTs, the SELLER reads and answers
--   listing_photos    -> follow the listing they belong to
--
-- Public seller info leaves `profiles` through the `seller_public` VIEW,
-- which exposes exactly three columns and nothing else. NEVER add a private
-- column to that view.
--
-- THE ORDER OF THIS FILE MATTERS.
--   Postgres resolves a function reference when a POLICY is created, and it
--   validates a SQL function body when the FUNCTION is created. So every
--   helper is declared in section 1b, before the policies that call it.
--   Reordering this file breaks it.
--
-- NOTE: this database is shared with other apps, so every object here is
-- named `listing_*` / `profiles` / `saved_listings`. There is already an
-- `inquiries` table belonging to another app — the LandFlow enquiry table is
-- therefore called `listing_enquiries`, never `enquiries`.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles — one row per user, created on first sign-in.
--
-- `is_operator` runs the marketplace. `is_admin` owns the site.
-- `is_banned` is the suspension switch, and it is read INSIDE the policies
-- below, so a ban takes effect on the banned user's very next request.
--
-- `email` is copied here from auth.users by the trigger at the bottom,
-- because no ordinary role can read auth.users — and the admin panel has to
-- be able to say WHO it is about to ban.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  avatar_url    text,
  phone         text,
  email         text,
  is_operator   boolean not null default false,
  is_admin      boolean not null default false,
  is_banned     boolean not null default false,
  banned_reason text,
  banned_at     timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- `create table if not exists` does NOT add columns to a table that is
-- already there, so the role and ban columns are added explicitly. This
-- block is a no-op on a fresh database and a migration on an old one.
alter table public.profiles
  add column if not exists is_operator   boolean not null default false,
  add column if not exists is_admin      boolean not null default false,
  add column if not exists is_banned     boolean not null default false,
  add column if not exists banned_reason text,
  add column if not exists banned_at     timestamptz,
  add column if not exists email         text;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id and not (select public.is_banned()))
  with check ((select auth.uid()) = id and not (select public.is_banned()));

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete
  to authenticated
  using ((select auth.uid()) = id);

create index if not exists profiles_banned_idx on public.profiles (is_banned);

-- ===========================================================================
-- 1b. The roles and the ban.
--
-- Declared HERE, before anything that uses them.
--
-- All three helpers are SECURITY DEFINER. That is not decoration: `profiles`
-- is owner-only, so a plain subquery would run as the *caller* and could
-- never see the flag it is trying to read.
--
-- They return only a boolean about the caller, so they leak nothing.
-- ===========================================================================

-- Is the caller marketplace staff? An admin counts as an operator.
create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_operator or p.is_admin
       from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Is the caller the site owner?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Is the CALLER suspended? Used inside every authenticated-only policy.
create or replace function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_banned from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_operator() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_banned() from public;
grant execute on function public.is_operator() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_banned() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The ban list.
--
-- Kept separately from `profiles` because banning an ACCOUNT and blocking
-- an EMAIL are different things: a deleted account must not be able to walk
-- straight back in and create a new one with the same address.
-- ---------------------------------------------------------------------------
create table if not exists public.banned_emails (
  email     text primary key,
  reason    text,
  banned_at timestamptz not null default now(),
  banned_by uuid references public.profiles (id) on delete set null
);

alter table public.banned_emails enable row level security;

drop policy if exists "banned_emails_admin_read" on public.banned_emails;
create policy "banned_emails_admin_read"
  on public.banned_emails for select
  to authenticated
  using ((select public.is_admin()) and not (select public.is_banned()));

drop policy if exists "banned_emails_admin_insert" on public.banned_emails;
create policy "banned_emails_admin_insert"
  on public.banned_emails for insert
  to authenticated
  with check ((select public.is_admin()) and not (select public.is_banned()));

drop policy if exists "banned_emails_admin_delete" on public.banned_emails;
create policy "banned_emails_admin_delete"
  on public.banned_emails for delete
  to authenticated
  using ((select public.is_admin()) and not (select public.is_banned()));

-- Is this EMAIL address blocked? Callable by anon, because the sign-up
-- check happens before anybody is signed in. It returns only a boolean, so
-- it works as a gate without leaking who is banned.
create or replace function public.email_is_banned(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.banned_emails where email = lower(trim(p_email))
  );
$$;

revoke all on function public.email_is_banned(text) from public;
grant execute on function public.email_is_banned(text) to anon, authenticated;

-- ===========================================================================
-- 1c. WHY THE ROLE COLUMNS ARE LOCKED DOWN AT THE GRANT LEVEL
--
-- RLS says WHICH ROWS you may touch. It says nothing about WHICH COLUMNS.
-- That matters here, because of two holes that a policy cannot close:
--
--   HOLE 1 — `profiles_update_own` lets a user update their own row. The
--     policy's WITH CHECK only verifies "the id is still mine", so a user
--     could set `is_admin = true` on their own profile and promote
--     themselves. No policy can prevent that, because from the database's
--     point of view they ARE editing their own row.
--
--   HOLE 2 — `profiles_insert_own` lets a user insert their own row. So:
--     delete your profile, then insert it again with `is_admin = true`.
--
-- The fix is a COLUMN-LEVEL GRANT. Postgres refuses the statement with
-- "permission denied for table profiles" long before RLS is even consulted:
--
--     revoke insert, update, delete on public.profiles from authenticated;
--     grant update (full_name, avatar_url, phone) on public.profiles to authenticated;
--
-- Now `authenticated` can only ever change the three harmless columns. The
-- role columns and the ban columns are unreachable from the table entirely.
--
-- Which means the admin panel CANNOT update them directly either — it has
-- to go through the SECURITY DEFINER functions below. That is the point:
-- there is exactly one door to the role columns, and that door checks
-- `is_admin()` itself.
-- ===========================================================================

revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, avatar_url, phone) on public.profiles to authenticated;

-- The insert and delete policies above are now unreachable — the GRANT is
-- gone, so no statement can use them. They are dropped so that the file
-- does not imply a way in that does not exist.
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

-- ---------------------------------------------------------------------------
-- The admin functions. SECURITY DEFINER, and each one checks `is_admin()`
-- ITSELF rather than trusting the caller to have checked.
-- ---------------------------------------------------------------------------

-- Give or take the operator / admin roles.
create or replace function public.admin_set_role(
  p_user_id    uuid,
  p_is_operator boolean,
  p_is_admin    boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change roles.' using errcode = '42501';
  end if;

  update public.profiles
     set is_operator = p_is_operator,
         is_admin    = p_is_admin
   where id = p_user_id;

  if not found then
    raise exception 'That user does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

-- Suspend or restore an account.
--
-- `p_block_email` also puts the address on the ban list, so the person
-- cannot walk in and create a fresh account with the same email.
create or replace function public.admin_set_ban(
  p_user_id     uuid,
  p_banned      boolean,
  p_reason      text default null,
  p_block_email boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can ban accounts.' using errcode = '42501';
  end if;

  if p_banned then
    update public.profiles
       set is_banned     = true,
           banned_reason = nullif(trim(p_reason), ''),
           banned_at     = now()
     where id = p_user_id;

    if not found then
      raise exception 'That user does not exist.' using errcode = 'P0002';
    end if;

    if p_block_email then
      select email into v_email from public.profiles where id = p_user_id;
      if v_email is not null then
        insert into public.banned_emails (email, reason, banned_by)
        values (lower(v_email), nullif(trim(p_reason), ''), auth.uid())
        on conflict (email) do update
          set reason     = excluded.reason,
              banned_at  = now(),
              banned_by  = excluded.banned_by;
      end if;
    end if;
  else
    update public.profiles
       set is_banned     = false,
           banned_reason = null,
           banned_at     = null
     where id = p_user_id;

    if not found then
      raise exception 'That user does not exist.' using errcode = 'P0002';
    end if;
  end if;
end;
$$;

-- Remove an account completely.
--
-- Deleting the profile row CASCADES: their listings, those listings'
-- photos and enquiries all go with it. The email is blocked so they cannot
-- simply sign up again.
--
-- Note: the row in `auth.users` itself is NOT deleted. That needs the
-- service-role key, which this app deliberately does not have — see
-- docs/DEPLOY.md.
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can delete accounts.' using errcode = '42501';
  end if;

  select email into v_email from public.profiles where id = p_user_id;

  if v_email is not null then
    insert into public.banned_emails (email, reason, banned_by)
    values (lower(v_email), 'account deleted', auth.uid())
    on conflict (email) do update
      set reason    = excluded.reason,
          banned_at = now(),
          banned_by = excluded.banned_by;
  end if;

  delete from public.profiles where id = p_user_id;

  if not found then
    raise exception 'That user does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_role(uuid, boolean, boolean) from public;
revoke all on function public.admin_set_ban(uuid, boolean, text, boolean) from public;
revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_set_role(uuid, boolean, boolean) to authenticated;
grant execute on function public.admin_set_ban(uuid, boolean, text, boolean) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. listings — the land itself. Public to read, owner to write.
-- ---------------------------------------------------------------------------
create table if not exists public.listings (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  description text not null default '',
  price       bigint not null check (price > 0),
  location    text not null,
  region      text not null,
  land_type   text not null check (land_type in ('residential','commercial','agricultural','industrial')),
  status      text not null default 'active' check (status in ('active','sold','rented','hidden')),
  created_at  timestamptz not null default now()
);

create index if not exists listings_status_idx on public.listings (status);
create index if not exists listings_seller_idx on public.listings (seller_id);
create index if not exists listings_region_idx on public.listings (region);

-- 'hidden' is how an operator takes a listing off the market without
-- deleting it. `create table if not exists` leaves an old check constraint
-- alone, so it is dropped and re-created with the new value.
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings
  add constraint listings_status_check
  check (status in ('active','sold','rented','hidden'));

alter table public.listings enable row level security;

-- Anyone (including logged-out visitors) can see ACTIVE land.
drop policy if exists "listings_public_read" on public.listings;
create policy "listings_public_read"
  on public.listings for select
  to anon, authenticated
  using (status = 'active');

-- A signed-in user can add land, but only as themselves.
drop policy if exists "listings_insert_own" on public.listings;
create policy "listings_insert_own"
  on public.listings for insert
  to authenticated
  with check (
    (select auth.uid()) = seller_id
    and not (select public.is_banned())
  );

drop policy if exists "listings_update_own" on public.listings;
create policy "listings_update_own"
  on public.listings for update
  to authenticated
  using ((select auth.uid()) = seller_id and not (select public.is_banned()))
  with check ((select auth.uid()) = seller_id and not (select public.is_banned()));

drop policy if exists "listings_delete_own" on public.listings;
create policy "listings_delete_own"
  on public.listings for delete
  to authenticated
  using ((select auth.uid()) = seller_id and not (select public.is_banned()));

-- ---------------------------------------------------------------------------
-- 3. saved_listings — each user's private shortlist.
-- ---------------------------------------------------------------------------
create table if not exists public.saved_listings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, listing_id)
);

create index if not exists saved_listings_user_idx on public.saved_listings (user_id);

alter table public.saved_listings enable row level security;

drop policy if exists "saved_select_own" on public.saved_listings;
create policy "saved_select_own"
  on public.saved_listings for select
  to authenticated
  using ((select auth.uid()) = user_id and not (select public.is_banned()));

drop policy if exists "saved_insert_own" on public.saved_listings;
create policy "saved_insert_own"
  on public.saved_listings for insert
  to authenticated
  with check ((select auth.uid()) = user_id and not (select public.is_banned()));

drop policy if exists "saved_delete_own" on public.saved_listings;
create policy "saved_delete_own"
  on public.saved_listings for delete
  to authenticated
  using ((select auth.uid()) = user_id and not (select public.is_banned()));

-- ---------------------------------------------------------------------------
-- 4. listing_enquiries — the actual business loop.
--
-- A visitor (logged in or not) asks about a piece of land. The SELLER reads
-- and answers it. Nobody else can.
--
-- The seller check goes through `listing_seller()` — a SECURITY DEFINER
-- helper — because a plain subquery would run as the *caller*, and the
-- `listings` RLS policy only lets a seller see their own ACTIVE listings.
-- That would hide the enquiries for a listing they just marked 'sold'.
-- ---------------------------------------------------------------------------
create table if not exists public.listing_enquiries (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings (id) on delete cascade,
  buyer_id    uuid references auth.users (id) on delete set null,
  buyer_name  text not null,
  buyer_email text not null,
  buyer_phone text,
  message     text not null default '',
  status      text not null default 'new' check (status in ('new','read','replied','closed')),
  created_at  timestamptz not null default now()
);

create index if not exists listing_enquiries_listing_idx on public.listing_enquiries (listing_id);
create index if not exists listing_enquiries_status_idx on public.listing_enquiries (status);

alter table public.listing_enquiries enable row level security;

-- SECURITY DEFINER: reads the listing regardless of its status.
create or replace function public.listing_seller(p_listing_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select seller_id from public.listings where id = p_listing_id;
$$;

revoke all on function public.listing_seller(uuid) from public;
grant execute on function public.listing_seller(uuid) to anon, authenticated;

-- A visitor can send an enquiry — but only about a listing that really
-- exists and is still active.
drop policy if exists "enquiries_insert_any" on public.listing_enquiries;
create policy "enquiries_insert_any"
  on public.listing_enquiries for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status = 'active'
    )
    and not (select public.is_banned())
  );

-- Only the seller of the listing may read its enquiries.
drop policy if exists "enquiries_seller_read" on public.listing_enquiries;
create policy "enquiries_seller_read"
  on public.listing_enquiries for select
  to authenticated
  using (
    (select public.listing_seller(listing_id)) = (select auth.uid())
    and not (select public.is_banned())
  );

-- The BUYER must also be able to see their own enquiry — otherwise they
-- cannot track it ("we have your request") and cannot withdraw it.
--
-- SUBTLETY THAT COST US A TEST FAILURE: in PostgreSQL, a row must pass a
-- SELECT policy before DELETE can act on it. A policy that only allows
-- DELETE is not enough — if the row is invisible to the caller, the delete
-- is silently filtered to zero rows and NO error is raised. So "the buyer
-- may delete" is only true if "the buyer may read" is true first.
drop policy if exists "enquiries_buyer_read" on public.listing_enquiries;
create policy "enquiries_buyer_read"
  on public.listing_enquiries for select
  to authenticated
  using ((select auth.uid()) = buyer_id and not (select public.is_banned()));

-- Only the seller may move an enquiry along (new -> read -> replied).
drop policy if exists "enquiries_seller_update" on public.listing_enquiries;
create policy "enquiries_seller_update"
  on public.listing_enquiries for update
  to authenticated
  using (
    (select public.listing_seller(listing_id)) = (select auth.uid())
    and not (select public.is_banned())
  )
  with check (
    (select public.listing_seller(listing_id)) = (select auth.uid())
    and not (select public.is_banned())
  );

-- The seller may remove an enquiry on their own land.
drop policy if exists "enquiries_seller_delete" on public.listing_enquiries;
create policy "enquiries_seller_delete"
  on public.listing_enquiries for delete
  to authenticated
  using (
    (select public.listing_seller(listing_id)) = (select auth.uid())
    and not (select public.is_banned())
  );

-- A buyer may remove their own enquiry.
drop policy if exists "enquiries_buyer_delete" on public.listing_enquiries;
create policy "enquiries_buyer_delete"
  on public.listing_enquiries for delete
  to authenticated
  using ((select auth.uid()) = buyer_id and not (select public.is_banned()));

-- ---------------------------------------------------------------------------
-- 5. seller_public — the ONLY way seller info leaves `profiles`.
--
-- `security_invoker = false` (the default) means this view runs with the
-- definer's rights, so it can read `profiles` even though RLS hides that
-- table from everyone else. It still exposes only these three columns.
-- ---------------------------------------------------------------------------
drop view if exists public.seller_public;
create view public.seller_public
  with (security_invoker = false)
  as
  select id, full_name, avatar_url
  from public.profiles;

-- ---------------------------------------------------------------------------
-- 6. Photos — a listing with no picture is a spreadsheet row, not a listing.
--
-- The images live in Supabase Storage (`listing-photos` bucket) and this
-- table is the index: which file belongs to which listing, and in what
-- order. The bucket is public-read; the TABLE is where the permissions
-- live, because that is where we know who owns what.
--
-- Path layout:  <user-uuid>/<listing-uuid>/<random>.jpg
-- The first folder is the user's id, which is what the storage policies
-- check — so a seller can only ever write inside their own folder.
-- ---------------------------------------------------------------------------
create table if not exists public.listing_photos (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings (id) on delete cascade,
  storage_path text not null,
  url          text not null,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists listing_photos_listing_idx
  on public.listing_photos (listing_id, sort_order);

alter table public.listing_photos enable row level security;

-- A photo is visible when the listing it belongs to is visible:
--   - the owner of the listing sees it, whatever the listing's status
--   - anyone sees the photos of an ACTIVE listing (the marketplace)
--   - an operator sees everything
drop policy if exists "listing_photos_read" on public.listing_photos;
create policy "listing_photos_read"
  on public.listing_photos for select
  to anon, authenticated
  using (
    (select public.listing_seller(listing_id)) = (select auth.uid())
    or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status = 'active'
    )
    or (select public.is_operator())
  );

drop policy if exists "listing_photos_insert_own" on public.listing_photos;
create policy "listing_photos_insert_own"
  on public.listing_photos for insert
  to authenticated
  with check (
    (select public.listing_seller(listing_id)) = (select auth.uid())
    and not (select public.is_banned())
  );

drop policy if exists "listing_photos_update_own" on public.listing_photos;
create policy "listing_photos_update_own"
  on public.listing_photos for update
  to authenticated
  using (
    (select public.listing_seller(listing_id)) = (select auth.uid())
    and not (select public.is_banned())
  )
  with check (
    (select public.listing_seller(listing_id)) = (select auth.uid())
    and not (select public.is_banned())
  );

-- DELETE only works on a row the caller can also SELECT — otherwise
-- Postgres filters the delete to zero rows without raising an error.
-- `listing_photos_read` already lets the owner see their own photos, so
-- this delete is allowed to fire.
drop policy if exists "listing_photos_delete_own" on public.listing_photos;
create policy "listing_photos_delete_own"
  on public.listing_photos for delete
  to authenticated
  using (
    (select public.listing_seller(listing_id)) = (select auth.uid())
    and not (select public.is_banned())
  );

-- ---------------------------------------------------------------------------
-- 7. The operator role.
--
-- A seller can only ever see their own land. An operator is the person who
-- runs the marketplace: they moderate listings and they can see every
-- enquiry so they can step in when a buyer is ignored.
--
-- The role lives in `profiles.is_operator` and is read through a
-- SECURITY DEFINER helper, for the same reason `listing_seller()` exists:
-- a plain subquery would run as the caller, and `profiles` is owner-only.
--
-- SECURITY DEFINER means this function can read `profiles` no matter who
-- is calling it — but it only ever returns a boolean about THEM, so it
-- leaks nothing.
-- ---------------------------------------------------------------------------

-- Operators see land in every status, not just the active ones.
-- The ban check is here too, so an admin who bans themselves immediately
-- loses their own powers.
drop policy if exists "listings_operator_read" on public.listings;
create policy "listings_operator_read"
  on public.listings for select
  to authenticated
  using ((select public.is_operator()) and not (select public.is_banned()));

-- ...and may take a listing off the market (or put it back).
drop policy if exists "listings_operator_update" on public.listings;
create policy "listings_operator_update"
  on public.listings for update
  to authenticated
  using ((select public.is_operator()) and not (select public.is_banned()))
  with check ((select public.is_operator()) and not (select public.is_banned()));

-- Operators see every enquiry on the marketplace, whoever sent it.
drop policy if exists "enquiries_operator_read" on public.listing_enquiries;
create policy "enquiries_operator_read"
  on public.listing_enquiries for select
  to authenticated
  using ((select public.is_operator()) and not (select public.is_banned()));

-- ---------------------------------------------------------------------------
-- 8. The storage bucket.
--
-- `public = true` means anyone can READ a file whose path they know — that
-- is how the <img> tag works without a signed URL. Writing is still
-- restricted to the owner's own folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos', 'listing-photos', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "listing_photos_bucket_read" on storage.objects;
create policy "listing_photos_bucket_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'listing-photos');

-- The first folder must be the caller's own user id.
drop policy if exists "listing_photos_bucket_insert" on storage.objects;
create policy "listing_photos_bucket_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "listing_photos_bucket_update" on storage.objects;
create policy "listing_photos_bucket_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "listing_photos_bucket_delete" on storage.objects;
create policy "listing_photos_bucket_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ===========================================================================
-- 9. ADMIN POLICIES — full CRUD, and user management.
--
-- These are the "master key" policies, and they are the ONLY ones. An admin
-- can:
--     delete any listing, enquiry or photo
--     update any listing, enquiry or profile
--     read every profile (that is how the panel knows who to ban)
--     ban and unban accounts, and block email addresses
--
-- An admin still CANNOT read anybody's `saved_listings` (a shortlist is
-- private), and still cannot read a password hash. Every one of those is a
-- policy that deliberately does not exist.
-- ===========================================================================

drop policy if exists "profiles_admin_read" on public.profiles;
create policy "profiles_admin_read"
  on public.profiles for select
  to authenticated
  using ((select public.is_admin()) and not (select public.is_banned()));

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
  on public.profiles for update
  to authenticated
  using ((select public.is_admin()) and not (select public.is_banned()))
  with check ((select public.is_admin()) and not (select public.is_banned()));

drop policy if exists "profiles_admin_delete" on public.profiles;
create policy "profiles_admin_delete"
  on public.profiles for delete
  to authenticated
  using ((select public.is_admin()) and not (select public.is_banned()));

drop policy if exists "listings_admin_delete" on public.listings;
create policy "listings_admin_delete"
  on public.listings for delete
  to authenticated
  using ((select public.is_admin()) and not (select public.is_banned()));

drop policy if exists "enquiries_admin_update" on public.listing_enquiries;
create policy "enquiries_admin_update"
  on public.listing_enquiries for update
  to authenticated
  using ((select public.is_admin()) and not (select public.is_banned()))
  with check ((select public.is_admin()) and not (select public.is_banned()));

drop policy if exists "enquiries_admin_delete" on public.listing_enquiries;
create policy "enquiries_admin_delete"
  on public.listing_enquiries for delete
  to authenticated
  using ((select public.is_admin()) and not (select public.is_banned()));

drop policy if exists "listing_photos_admin_delete" on public.listing_photos;
create policy "listing_photos_admin_delete"
  on public.listing_photos for delete
  to authenticated
  using ((select public.is_admin()) and not (select public.is_banned()));

-- ---------------------------------------------------------------------------
-- 10. Grants
--
-- Supabase's model: grant table privileges to anon and authenticated, and
-- let RLS decide what is visible. Revoking from anon turns "0 rows" into a
-- permission error (42501) and breaks the app.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;
grant select on public.seller_public to anon, authenticated;
-- NOTE: only SELECT. The column-level UPDATE grant for profiles lives in
-- section 1c, because it is part of the privilege-escalation defence.
grant select on public.profiles to authenticated;
grant select, insert, delete on public.saved_listings to authenticated;
grant insert on public.listing_enquiries to anon, authenticated;
grant select, update on public.listing_enquiries to authenticated;
grant delete on public.listing_enquiries to authenticated;
grant select on public.listing_photos to anon, authenticated;
grant insert, update, delete on public.listing_photos to authenticated;
grant select on public.banned_emails to authenticated;
grant insert, delete on public.banned_emails to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Auto-create a profile when a user signs up.
--
-- The email is copied here because no ordinary role can read auth.users,
-- and the admin panel has to be able to name a user before banning them.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill the email for accounts created before this column existed.
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id and p.email is null;
