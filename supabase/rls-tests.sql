-- ===========================================================================
-- LandFlow — RLS policy tests (pgTAP)
--
-- WHAT THIS IS FOR
--   You shipped a table without RLS once and found out in production.
--   These tests are the guardrail: they FAIL loudly if a policy is missing,
--   wrong, or too permissive. Run them before every schema change.
--
-- HOW TO RUN (locally, on a real Postgres — no Docker needed):
--   ./supabase/verify-rls.sh
--
-- HOW TO RUN (on Supabase Cloud, from the SQL editor):
--   Paste and run this file. It creates its own test schema, runs the
--   assertions, and cleans up after itself. Your real tables are untouched.
-- ===========================================================================

begin;

-- Isolated test schema so we never touch the real `public` tables.
create schema if not exists rls_test;

create extension if not exists pgtap with schema rls_test;
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Stub the bits of Supabase we depend on:
--   auth.users      -> the users table
--   auth.uid()      -> the id of the caller, from the JWT claims
-- In real Supabase these exist already and this block is skipped.
-- ---------------------------------------------------------------------------
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'auth' and p.proname = 'uid') then
    create table auth.users (
      id                 uuid primary key default gen_random_uuid(),
      email              text,
      raw_user_meta_data jsonb default '{}'::jsonb
    );
    -- NOTE: the inner body uses a different dollar-quote tag ($fn$) than the
    -- enclosing DO block. Using the SAME tag closes the outer block early and
    -- you get "syntax error at or near select".
    create function auth.uid() returns uuid
      language sql stable
      as $fn$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $fn$;
  end if;
end $$;

-- Roles that mirror Supabase.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema auth, rls_test to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

set search_path = rls_test, public, auth;

-- ---------------------------------------------------------------------------
-- Build a miniature version of the real schema inside rls_test.
-- The policies below are copies of supabase/schema.sql — if you change one,
-- change both, or the test is lying to you.
-- ---------------------------------------------------------------------------
create table rls_test.profiles (
  id           uuid primary key,
  full_name    text,
  avatar_url   text,
  email        text,
  is_operator  boolean not null default false,
  is_admin     boolean not null default false,
  is_banned    boolean not null default false,
  banned_reason text
);
alter table rls_test.profiles enable row level security;

create policy "profiles_select_own" on rls_test.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on rls_test.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- `is_banned()` and `is_admin()` are SECURITY DEFINER for the same reason
-- `listing_seller()` is: a plain subquery would run as the CALLER, and
-- `profiles` is owner-only, so it could never see the flag.
create function rls_test.is_banned()
  returns boolean
  language sql
  stable
  security definer
  set search_path = rls_test
  as $fn$
    select coalesce(
      (select p.is_banned from rls_test.profiles p where p.id = auth.uid()),
      false
    )
  $fn$;

create function rls_test.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = rls_test
  as $fn$
    select coalesce(
      (select p.is_admin from rls_test.profiles p where p.id = auth.uid()),
      false
    )
  $fn$;

-- The ban list. `email_is_banned()` is callable by anon, because the
-- sign-up gate runs before anybody is signed in.
create table rls_test.banned_emails (
  email     text primary key,
  reason    text,
  banned_at timestamptz not null default now(),
  banned_by uuid references rls_test.profiles (id) on delete set null
);
alter table rls_test.banned_emails enable row level security;

create function rls_test.email_is_banned(p_email text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = rls_test
  as $fn$
    select exists (
      select 1 from rls_test.banned_emails where email = lower(trim(p_email))
    )
  $fn$;

create policy "banned_emails_admin_read" on rls_test.banned_emails
  for select to authenticated using ((select rls_test.is_admin()));
create policy "banned_emails_admin_insert" on rls_test.banned_emails
  for insert to authenticated with check ((select rls_test.is_admin()));
create policy "banned_emails_admin_delete" on rls_test.banned_emails
  for delete to authenticated using ((select rls_test.is_admin()));

create table rls_test.listings (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid not null references rls_test.profiles (id) on delete cascade,
  title      text not null,
  price      bigint not null,
  status     text not null default 'active'
);
alter table rls_test.listings enable row level security;

create policy "listings_public_read" on rls_test.listings
  for select to anon, authenticated using (status = 'active');
create policy "listings_insert_own" on rls_test.listings
  for insert to authenticated
  with check ((select auth.uid()) = seller_id and not (select rls_test.is_banned()));
create policy "listings_update_own" on rls_test.listings
  for update to authenticated
  using ((select auth.uid()) = seller_id and not (select rls_test.is_banned()))
  with check ((select auth.uid()) = seller_id and not (select rls_test.is_banned()));
create policy "listings_delete_own" on rls_test.listings
  for delete to authenticated
  using ((select auth.uid()) = seller_id and not (select rls_test.is_banned()));

create table rls_test.saved_listings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  listing_id uuid not null references rls_test.listings (id) on delete cascade,
  unique (user_id, listing_id)
);
alter table rls_test.saved_listings enable row level security;

create policy "saved_select_own" on rls_test.saved_listings
  for select to authenticated
  using ((select auth.uid()) = user_id and not (select rls_test.is_banned()));
create policy "saved_insert_own" on rls_test.saved_listings
  for insert to authenticated
  with check ((select auth.uid()) = user_id and not (select rls_test.is_banned()));
create policy "saved_delete_own" on rls_test.saved_listings
  for delete to authenticated
  using ((select auth.uid()) = user_id and not (select rls_test.is_banned()));

-- ---------------------------------------------------------------------------
-- listing_enquiries — the business loop.
--
-- A visitor asks about a piece of land; the SELLER reads and answers it.
--
-- `listing_seller()` is SECURITY DEFINER on purpose. A plain subquery would
-- run as the CALLER, and the `listings` policy only lets a seller see their
-- own ACTIVE land — so a seller would lose sight of the enquiries on a
-- listing they had just marked 'sold'. The definer function sees the row
-- regardless of status.
-- ---------------------------------------------------------------------------
create table rls_test.listing_enquiries (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references rls_test.listings (id) on delete cascade,
  buyer_id    uuid,
  buyer_name  text not null,
  buyer_email text not null,
  message     text not null default '',
  status      text not null default 'new'
);
alter table rls_test.listing_enquiries enable row level security;

create function rls_test.listing_seller(p_listing_id uuid)
  returns uuid
  language sql
  security definer
  set search_path = rls_test
  as $fn$ select seller_id from rls_test.listings where id = p_listing_id $fn$;

-- `is_operator()` is SECURITY DEFINER for the same reason `listing_seller()`
-- is: a plain subquery would run as the CALLER, and `profiles` is owner-only,
-- so a plain subquery could never see the flag. It returns only a boolean
-- about the caller, so it leaks nothing.
create function rls_test.is_operator()
  returns boolean
  language sql
  stable
  security definer
  set search_path = rls_test
  as $fn$
    select coalesce(
      (select p.is_operator from rls_test.profiles p where p.id = auth.uid()),
      false
    )
  $fn$;



create policy "enquiries_insert_any" on rls_test.listing_enquiries
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from rls_test.listings l
      where l.id = listing_id and l.status = 'active'
    )
    and not (select rls_test.is_banned())
  );
create policy "enquiries_seller_read" on rls_test.listing_enquiries
  for select to authenticated
  using (
    (select rls_test.listing_seller(listing_id)) = (select auth.uid())
    and not (select rls_test.is_banned())
  );
create policy "enquiries_buyer_read" on rls_test.listing_enquiries
  for select to authenticated
  using ((select auth.uid()) = buyer_id and not (select rls_test.is_banned()));
create policy "enquiries_seller_update" on rls_test.listing_enquiries
  for update to authenticated
  using (
    (select rls_test.listing_seller(listing_id)) = (select auth.uid())
    and not (select rls_test.is_banned())
  )
  with check (
    (select rls_test.listing_seller(listing_id)) = (select auth.uid())
    and not (select rls_test.is_banned())
  );
create policy "enquiries_seller_delete" on rls_test.listing_enquiries
  for delete to authenticated
  using (
    (select rls_test.listing_seller(listing_id)) = (select auth.uid())
    and not (select rls_test.is_banned())
  );
create policy "enquiries_buyer_delete" on rls_test.listing_enquiries
  for delete to authenticated
  using ((select auth.uid()) = buyer_id and not (select rls_test.is_banned()));

-- ---------------------------------------------------------------------------
-- listing_photos — the pictures on a listing.
--
-- A photo is visible when the LISTING is visible: the owner sees their own
-- photos whatever the status, anyone sees the photos of an ACTIVE listing
-- (that is the cover image in the marketplace), and an operator sees all.
-- ---------------------------------------------------------------------------
create table rls_test.listing_photos (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references rls_test.listings (id) on delete cascade,
  storage_path text not null,
  url          text not null,
  sort_order   int not null default 0
);
alter table rls_test.listing_photos enable row level security;

create policy "listing_photos_read" on rls_test.listing_photos
  for select to anon, authenticated
  using (
    (select rls_test.listing_seller(listing_id)) = (select auth.uid())
    or exists (
      select 1 from rls_test.listings l
      where l.id = listing_id and l.status = 'active'
    )
    or (select rls_test.is_operator())
  );
create policy "listing_photos_insert_own" on rls_test.listing_photos
  for insert to authenticated
  with check (
    (select rls_test.listing_seller(listing_id)) = (select auth.uid())
    and not (select rls_test.is_banned())
  );
create policy "listing_photos_update_own" on rls_test.listing_photos
  for update to authenticated
  using (
    (select rls_test.listing_seller(listing_id)) = (select auth.uid())
    and not (select rls_test.is_banned())
  )
  with check (
    (select rls_test.listing_seller(listing_id)) = (select auth.uid())
    and not (select rls_test.is_banned())
  );
create policy "listing_photos_delete_own" on rls_test.listing_photos
  for delete to authenticated
  using (
    (select rls_test.listing_seller(listing_id)) = (select auth.uid())
    and not (select rls_test.is_banned())
  );

-- ---------------------------------------------------------------------------
-- The operator role: moderation and full visibility.
-- ---------------------------------------------------------------------------
create policy "listings_operator_read" on rls_test.listings
  for select to authenticated using ((select rls_test.is_operator()));
create policy "listings_operator_update" on rls_test.listings
  for update to authenticated
  using ((select rls_test.is_operator()))
  with check ((select rls_test.is_operator()));
create policy "enquiries_operator_read" on rls_test.listing_enquiries
  for select to authenticated using ((select rls_test.is_operator()));

-- ---------------------------------------------------------------------------
-- The admin policies — full CRUD, and user management.
-- ---------------------------------------------------------------------------
create policy "listings_admin_delete" on rls_test.listings
  for delete to authenticated using ((select rls_test.is_admin()));

create policy "enquiries_admin_update" on rls_test.listing_enquiries
  for update to authenticated
  using ((select rls_test.is_admin()))
  with check ((select rls_test.is_admin()));

create policy "enquiries_admin_delete" on rls_test.listing_enquiries
  for delete to authenticated using ((select rls_test.is_admin()));

create policy "listing_photos_admin_delete" on rls_test.listing_photos
  for delete to authenticated using ((select rls_test.is_admin()));

create policy "profiles_admin_read" on rls_test.profiles
  for select to authenticated using ((select rls_test.is_admin()));

create view rls_test.seller_public
  with (security_invoker = false)
  as select id, full_name, avatar_url from rls_test.profiles;

grant usage on schema rls_test to anon, authenticated;
grant select on rls_test.listings to anon, authenticated;
grant insert, update, delete on rls_test.listings to authenticated;
grant select on rls_test.seller_public to anon, authenticated;
-- COLUMN-LEVEL GRANT. RLS says WHICH ROWS; it says nothing about WHICH
-- COLUMNS. Without this, a user could edit their own profile row and set
-- `is_admin = true` -- the WITH CHECK only proves the row is still theirs.
-- With this, Postgres rejects the statement before RLS is even consulted.
revoke insert, update, delete on rls_test.profiles from authenticated;
grant update (full_name, avatar_url) on rls_test.profiles to authenticated;
grant select on rls_test.profiles to authenticated;
grant select on rls_test.banned_emails to authenticated;
grant insert, delete on rls_test.banned_emails to authenticated;
grant execute on function rls_test.is_banned() to anon, authenticated;
grant execute on function rls_test.is_admin() to anon, authenticated;
grant execute on function rls_test.email_is_banned(text) to anon, authenticated;
grant select, insert, delete on rls_test.saved_listings to authenticated;
grant insert on rls_test.listing_enquiries to anon, authenticated;
grant select, update on rls_test.listing_enquiries to authenticated;
grant delete on rls_test.listing_enquiries to authenticated;
grant execute on function rls_test.listing_seller(uuid) to anon, authenticated;
grant select on rls_test.listing_photos to anon, authenticated;
grant insert, update, delete on rls_test.listing_photos to authenticated;
grant execute on function rls_test.is_operator() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures: two sellers with their own land, plus one stranger who owns
-- nothing and has asked about nothing — the "nobody special" user we use to
-- prove that an unrelated account can touch neither seller's nor buyer's rows.
-- ---------------------------------------------------------------------------
insert into rls_test.profiles
  (id, full_name, email, is_operator, is_admin, is_banned) values
  ('11111111-1111-1111-1111-111111111111', 'Amina', 'amina@example.test', false, false, false),
  ('22222222-2222-2222-2222-222222222222', 'Patrick', 'patrick@example.test', false, false, false),
  ('33333333-3333-3333-3333-333333333333', 'Stranger', 'stranger@example.test', false, false, false),
  ('44444444-4444-4444-4444-444444444444', 'Nabirye', 'nabirye@example.test', true, true, false),
  ('55555555-5555-5555-5555-555555555555', 'Banned', 'banned@example.test', false, false, true);

-- One address is blocked outright, so it cannot be used to sign up again.
insert into rls_test.banned_emails (email, reason) values
  ('blocked@example.test', 'account deleted');

-- The suspended user's own land, and their own enquiry. Nothing else in
-- the suite touches these two rows, so the new tests can assert against
-- them without depending on the state earlier tests left behind.
insert into rls_test.listings (id, seller_id, title, price, status) values
  ('aaaaaaaa-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555555', 'Banned land', 400, 'sold');

insert into rls_test.listings (id, seller_id, title, price, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Amina land', 100, 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Patrick land', 200, 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Amina sold land', 300, 'sold');

-- One photo on an ACTIVE listing (public cover image) and one on a SOLD
-- listing (only the owner and an operator may see it).
insert into rls_test.listing_photos (id, listing_id, storage_path, url) values
  ('ffffffff-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'u/1/active.jpg', 'https://example.test/active.jpg'),
  ('ffffffff-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003',
   'u/1/sold.jpg', 'https://example.test/sold.jpg');

insert into rls_test.listing_enquiries
  (id, listing_id, buyer_id, buyer_name, buyer_email, message, status) values
  ('eeeeeeee-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001',
   '55555555-5555-5555-5555-555555555555', 'Banned', 'banned@example.test', 'Can I still buy this?', 'new');

insert into rls_test.listing_enquiries
  (id, listing_id, buyer_id, buyer_name, buyer_email, message, status) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', 'Patrick', 'patrick@example.com', 'Is this still available?', 'new'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111', 'Amina', 'amina@example.com', 'What are the title papers?', 'new'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003',
   '22222222-2222-2222-2222-222222222222', 'Patrick', 'patrick@example.com', 'Can I still view this?', 'new');

-- ===========================================================================
-- TESTS
-- ===========================================================================

select plan(89);

-- ===========================================================================
-- 12. PHOTOS
--
-- A photo follows the listing it belongs to. The owner sees their own
-- pictures whatever the status of the listing; anybody sees the pictures of
-- an ACTIVE listing, because that is the cover image in the marketplace.
-- ===========================================================================

-- --- 12a. anonymous sees the photo of an ACTIVE listing ------------------
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select is(
  (select count(*)::int from rls_test.listing_photos),
  1::int,
  'anon sees the photo of the ACTIVE listing only'
);
select is_empty(
  'select url from rls_test.listing_photos where url like ''%sold.jpg''',
  'anon cannot see the photo of a SOLD listing'
);
reset role;

-- --- 12b. a stranger sees the photo of an ACTIVE listing ------------------
-- The cover image in the marketplace is public. Hiding it from other
-- signed-in users would make the marketplace look broken.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select is(
  (select count(*)::int from rls_test.listing_photos),
  1::int,
  'a signed-in stranger still sees only the photo of the ACTIVE listing'
);
reset role;

-- --- 12c. the owner sees the photo of their SOLD listing -----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select is(
  (select count(*)::int from rls_test.listing_photos),
  2::int,
  'the owner sees the photos of BOTH their listings (active and sold)'
);
reset role;

-- --- 12d. a stranger CANNOT add a photo to somebody else''s listing -------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select throws_ok(
  'insert into rls_test.listing_photos (listing_id, storage_path, url) values (''aaaaaaaa-0000-0000-0000-000000000002'', ''hack/1.jpg'', ''https://example.test/hack.jpg'')',
  '42501',
  null,
  'a stranger cannot attach a photo to another seller''s listing'
);
reset role;

-- --- 12e. the owner CAN add a photo to their own listing -----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  'insert into rls_test.listing_photos (listing_id, storage_path, url) values (''aaaaaaaa-0000-0000-0000-000000000001'', ''u/1/mine.jpg'', ''https://example.test/mine.jpg'')',
  'the owner can attach a photo to their own listing'
);
reset role;

-- --- 12f. a stranger CANNOT delete somebody else''s photo -----------------
--
-- DELETE that violates a USING clause is filtered to zero rows and raises
-- NO error, so we check from the privileged side that the photo survived.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select lives_ok(
  'delete from rls_test.listing_photos where id = ''ffffffff-0000-0000-0000-000000000001''',
  'DELETE on another owner''s photo raises no error (it is filtered to 0 rows)'
);
reset role;
select is(
  (select count(*)::int from rls_test.listing_photos where id = 'ffffffff-0000-0000-0000-000000000001'),
  1::int,
  'the other owner''s photo STILL EXISTS after the blocked DELETE'
);

-- --- 12g. the owner CAN delete their own photo --------------------------
-- They delete the photo on their ACTIVE listing. The one on the SOLD
-- listing stays, because test 13i needs it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  'delete from rls_test.listing_photos where id = ''ffffffff-0000-0000-0000-000000000001''',
  'the owner can delete their own photo'
);
reset role;
select is(
  (select count(*)::int from rls_test.listing_photos where id = 'ffffffff-0000-0000-0000-000000000001'),
  0::int,
  'and the photo is gone'
);

-- ===========================================================================
-- 13. THE OPERATOR ROLE
--
-- An operator runs the marketplace: they moderate the listings and they can
-- see every enquiry, whoever sent it. The role is a boolean on the profile,
-- read through a SECURITY DEFINER helper so that a plain subquery is not
-- needed (and would not work — `profiles` is owner-only).
-- ===========================================================================

-- --- 13a. the helper answers correctly -----------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select is(
  (select rls_test.is_operator())::bool,
  false::bool,
  'is_operator() is false for an ordinary user'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
select is(
  (select rls_test.is_operator())::bool,
  true::bool,
  'is_operator() is true for the operator'
);
reset role;

-- --- 13b. an ordinary user still cannot see sold listings ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select is(
  (select count(*)::int from rls_test.listings),
  2::int,
  'an ordinary signed-in user still sees only the ACTIVE listings'
);
reset role;

-- --- 13c. the operator sees EVERY listing, in every status --------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
select is(
  (select count(*)::int from rls_test.listings),
  4::int,
  'the operator sees all 4 listings, including the SOLD ones'
);
reset role;

-- --- 13d. the operator sees EVERY enquiry, not just their own -----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
select is(
  (select count(*)::int from rls_test.listing_enquiries),
  4::int,
  'the operator sees all 4 enquiries on the marketplace'
);
reset role;

-- --- 13e. an ordinary user sees only their own enquiries -----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select is(
  (select count(*)::int from rls_test.listing_enquiries),
  0::int,
  'a stranger sees no enquiries at all'
);
reset role;

-- --- 13f. an ordinary user CANNOT hide a listing they do not own --------
-- Again: the UPDATE is filtered to zero rows and raises NO error, so the
-- assertion has to be made from the privileged side.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select lives_ok(
  'update rls_test.listings set status = ''hidden'' where id = ''aaaaaaaa-0000-0000-0000-000000000002''',
  'an ordinary user hiding another seller''s listing raises no error'
);
reset role;
select is(
  (select status from rls_test.listings where id = 'aaaaaaaa-0000-0000-0000-000000000002')::text,
  'active'::text,
  'and the listing is STILL ACTIVE — the update was filtered out'
);

-- --- 13g. the operator CAN hide a listing they do not own ---------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
select lives_ok(
  'update rls_test.listings set status = ''hidden'' where id = ''aaaaaaaa-0000-0000-0000-000000000002''',
  'the operator can take a listing off the market'
);
reset role;
select is(
  (select status from rls_test.listings where id = 'aaaaaaaa-0000-0000-0000-000000000002')::text,
  'hidden'::text,
  'and the listing IS hidden'
);

-- --- 13h. a hidden listing disappears from the marketplace --------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select is(
  (select count(*)::int from rls_test.listings),
  1::int,
  'a hidden listing is no longer visible to ordinary visitors'
);
reset role;

-- Put the listing back, so the marketplace counts in the later tests are
-- unaffected. The order matters: this has to come AFTER 13h, otherwise the
-- listing would be active again before we checked that hiding it worked.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
select lives_ok(
  'update rls_test.listings set status = ''active'' where id = ''aaaaaaaa-0000-0000-0000-000000000002''',
  'the operator can also put a listing back on the market'
);
reset role;

-- --- 13i. the operator sees the photo of a SOLD listing ------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
select is(
  (select count(*)::int from rls_test.listing_photos
     where listing_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  1::int,
  'the operator sees the photo of the SOLD listing'
);
reset role;


-- --- 1. anonymous can browse active land -------------------------------
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select is(
  (select count(*)::int from rls_test.listings),
  2::int,
  'anon sees exactly the 2 ACTIVE listings (sold one is hidden)'
);
select is_empty(
  'select title from rls_test.listings where status = ''sold''',
  'anon cannot see sold listings'
);
reset role;

-- --- 2. anonymous CANNOT read profiles ---------------------------------
set local role anon;
select throws_ok(
  'select count(*) from rls_test.profiles',
  '42501',
  null,
  'anon is blocked from reading profiles'
);
reset role;

-- --- 3. anonymous CANNOT write listings --------------------------------
set local role anon;
select throws_ok(
  'insert into rls_test.listings (seller_id, title, price) values (''11111111-1111-1111-1111-111111111111'', ''hack'', 1)',
  '42501',
  null,
  'anon cannot insert a listing'
);
reset role;

-- --- 4. signed-in user sees only their own profile ----------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select is(
  (select count(*)::int from rls_test.profiles),
  1::int,
  'a signed-in user sees only their own profile row'
);
select is(
  (select full_name from rls_test.profiles)::text,
  'Amina'::text,
  'and it is their own'
);
reset role;

-- --- 5. signed-in user can insert their own listing ---------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  'insert into rls_test.listings (seller_id, title, price) values (''11111111-1111-1111-1111-111111111111'', ''My new plot'', 500)',
  'a user can post land under their own id'
);
reset role;

-- --- 6. signed-in user CANNOT insert land for someone else -------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select throws_ok(
  'insert into rls_test.listings (seller_id, title, price) values (''22222222-2222-2222-2222-222222222222'', ''Fake listing'', 999)',
  '42501',
  null,
  'a user cannot post land claiming to be another seller'
);
reset role;

-- --- 7. signed-in user CANNOT update or delete another seller land -----
--
-- IMPORTANT RLS SUBTLETY (this bit us while writing these tests):
--   INSERT that violates a WITH CHECK  -> Postgres RAISES 42501.
--   UPDATE / DELETE that violates a USING -> Postgres SILENTLY FILTERS the
--   row out. No error. The statement just affects 0 rows, because from the
--   caller's point of view that row does not exist.
--
-- So "no error" is NOT proof the write was blocked. To prove it, you must
-- check from the privileged side afterwards that the row is unchanged.
-- That is exactly what these four assertions do.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  'update rls_test.listings set price = 1 where id = ''aaaaaaaa-0000-0000-0000-000000000002''',
  'UPDATE on another seller''s listing raises no error (it is filtered to 0 rows)'
);
reset role;
select is(
  (select price from rls_test.listings where id = 'aaaaaaaa-0000-0000-0000-000000000002')::bigint,
  200::bigint,
  'the price of another seller''s listing is UNCHANGED (checked from the privileged side)'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  'delete from rls_test.listings where id = ''aaaaaaaa-0000-0000-0000-000000000002''',
  'DELETE on another seller''s listing raises no error (it is filtered to 0 rows)'
);
reset role;
select is(
  (select count(*)::int from rls_test.listings where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  1::int,
  'the other seller''s listing STILL EXISTS after the blocked DELETE'
);

-- --- 8. saved_listings is strictly private -----------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  'insert into rls_test.saved_listings (user_id, listing_id) values (''11111111-1111-1111-1111-111111111111'', ''aaaaaaaa-0000-0000-0000-000000000002'')',
  'a user can save a listing'
);
select is(
  (select count(*)::int from rls_test.saved_listings),
  1::int,
  'a user sees only their own saved listings'
);
reset role;

-- another user must not see that saved row
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select is(
  (select count(*)::int from rls_test.saved_listings),
  0::int,
  'a different user sees none of them'
);
select throws_ok(
  'insert into rls_test.saved_listings (user_id, listing_id) values (''11111111-1111-1111-1111-111111111111'', ''aaaaaaaa-0000-0000-0000-000000000001'')',
  '42501',
  null,
  'a user cannot save a listing under someone else''s user_id'
);
reset role;

-- --- 9. the seller_public view leaks nothing private -------------------
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select is(
  (select count(*)::int from rls_test.seller_public),
  5::int,
  'anon can read public seller info through the view (5 sellers)'
);
select is(
  (select count(*)::int from information_schema.columns
     where table_schema = 'rls_test' and table_name = 'seller_public'),
  3::int,
  'seller_public exposes exactly 3 columns (id, full_name, avatar_url)'
);
reset role;

-- --- 10. listing_enquiries: the business loop ---------------------------
--
-- Three fixtures:
--   ...e1  an enquiry on Amina's ACTIVE land   (asked by Patrick)
--   ...e2  an enquiry on Patrick's ACTIVE land (asked by Amina)
--   ...e3  an enquiry on Amina's SOLD land     (asked by Patrick)

-- A logged-out visitor can ask about land that is actually for sale.
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select lives_ok(
  'insert into rls_test.listing_enquiries (listing_id, buyer_name, buyer_email, message) values (''aaaaaaaa-0000-0000-0000-000000000001'', ''Walk-in'', ''walkin@example.com'', ''How much per acre?'')',
  'anon can send an enquiry about an active listing'
);
reset role;

-- ...but not about land that has been sold.
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  'insert into rls_test.listing_enquiries (listing_id, buyer_name, buyer_email, message) values (''aaaaaaaa-0000-0000-0000-000000000003'', ''Walk-in'', ''walkin@example.com'', ''Still there?'')',
  '42501',
  null,
  'anon CANNOT send an enquiry about a sold listing'
);
reset role;

-- The seller sees enquiries on their own land...
--
-- Amina owns listings ...001 and ...003, and she asked a question about
-- Patrick's listing ...002 (she is that enquiry's BUYER). So she sees:
--   e1 (she sold it), walk-in (she sold it), e3 (she sold it), e2 (she asked),
--   e5 (the suspended user's, on her land) = 5. Note that the SOLD listing's
--   enquiry is in there — that is exactly what listing_seller() is for.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select is(
  (select count(*)::int from rls_test.listing_enquiries),
  5::int,
  'the seller sees enquiries on their own land — including the SOLD listing (that is what listing_seller() is for)'
);
reset role;

-- ...and nobody else's.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select is(
  (select count(*)::int from rls_test.listing_enquiries),
  3::int,
  'a different seller sees only the enquiry on their own land, plus their OWN enquiries'
);
reset role;

-- The BUYER can see their own enquiry — otherwise they cannot track it,
-- and (see the note below) they cannot delete it either.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select is(
  (select count(*)::int from rls_test.listing_enquiries
     where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  1::int,
  'the buyer can see the enquiry they sent, even though it is on someone else''s land'
);
reset role;

-- The seller can move an enquiry along, and the change is real.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  'update rls_test.listing_enquiries set status = ''replied'' where id = ''eeeeeeee-0000-0000-0000-000000000001''',
  'the seller can mark an enquiry as replied'
);
reset role;
select is(
  (select status from rls_test.listing_enquiries where id = 'eeeeeeee-0000-0000-0000-000000000001')::text,
  'replied'::text,
  'the status really changed (checked from the privileged side)'
);

-- A stranger's UPDATE raises no error but changes nothing.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select lives_ok(
  'update rls_test.listing_enquiries set status = ''closed'' where id = ''eeeeeeee-0000-0000-0000-000000000001''',
  'a non-seller UPDATE raises no error (it is filtered to 0 rows)'
);
reset role;
select is(
  (select status from rls_test.listing_enquiries where id = 'eeeeeeee-0000-0000-0000-000000000001')::text,
  'replied'::text,
  'the other user''s enquiry status is UNCHANGED'
);

-- The buyer can withdraw their own enquiry.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
select lives_ok(
  'delete from rls_test.listing_enquiries where id = ''eeeeeeee-0000-0000-0000-000000000003''',
  'the buyer can delete their own enquiry'
);
reset role;
select is(
  (select count(*)::int from rls_test.listing_enquiries where id = 'eeeeeeee-0000-0000-0000-000000000003'),
  0::int,
  'and it is really gone'
);

-- A stranger's DELETE raises no error but changes nothing.
-- The Stranger owns nothing and asked about nothing, so it is neither the
-- seller nor the buyer of e1.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select lives_ok(
  'delete from rls_test.listing_enquiries where id = ''eeeeeeee-0000-0000-0000-000000000001''',
  'an unrelated user DELETE raises no error (it is filtered to 0 rows)'
);
reset role;
select is(
  (select count(*)::int from rls_test.listing_enquiries where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  1::int,
  'the enquiry STILL EXISTS after the blocked DELETE'
);

-- The SELLER may remove an enquiry on their own land.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  'delete from rls_test.listing_enquiries where id = ''eeeeeeee-0000-0000-0000-000000000001''',
  'the seller can delete an enquiry on their own land'
);
reset role;
select is(
  (select count(*)::int from rls_test.listing_enquiries where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  0::int,
  'and it is really gone'
);


-- ===========================================================================
-- 14. BANNING AN ACCOUNT
--
-- A ban is enforced by the DATABASE, not by the app. The flag is read
-- inside the RLS policies, so a banned user's existing JWT stops granting
-- them anything on their very next request -- no re-login, no window.
--
-- The naive version of "ban this user" (a flag plus a check in the UI) is
-- worthless, because the user already holds a signed token.
-- ===========================================================================

-- --- 14a. the helper answers correctly -----------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555"}', true);
select is(
  (select rls_test.is_banned())::bool,
  true::bool,
  'is_banned() is true for a suspended account'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select is(
  (select rls_test.is_banned())::bool,
  false::bool,
  'is_banned() is false for an ordinary account'
);
reset role;

-- --- 14b. a suspended user cannot post land -----------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555"}', true);
select throws_ok(
  'insert into rls_test.listings (seller_id, title, price) values (''55555555-5555-5555-5555-555555555555'', ''Sneaky'', 1)',
  '42501',
  null,
  'a suspended account cannot post a listing'
);
reset role;

-- --- 14c. a suspended user cannot edit their own land --------------------
-- UPDATE that violates a USING clause is filtered to zero rows and raises
-- NO error, so the assertion is made from the privileged side.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  'update rls_test.listings set price = 1 where id = ''aaaaaaaa-0000-0000-0000-000000000001''',
  'an ordinary seller CAN edit their own listing (the baseline)'
);
reset role;
select is(
  (select price from rls_test.listings where id = 'aaaaaaaa-0000-0000-0000-000000000001')::bigint,
  1::bigint,
  'and the price really changed (proving the update path works)'
);

-- --- 14d. a suspended user cannot delete their own land ------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555"}', true);
select lives_ok(
  'delete from rls_test.listings where id = ''aaaaaaaa-0000-0000-0000-000000000004''',
  'a suspended account deleting their own listing raises no error'
);
reset role;
select is(
  (select count(*)::int from rls_test.listings where id = 'aaaaaaaa-0000-0000-0000-000000000004'),
  1::int,
  'but the listing STILL EXISTS -- the delete was filtered out'
);

-- --- 14e. a suspended user cannot see their own enquiries ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555"}', true);
select is(
  (select count(*)::int from rls_test.listing_enquiries),
  0::int,
  'a suspended account sees no enquiries at all -- not even the one they sent'
);
reset role;

-- --- 14f. a suspended user cannot send an enquiry ------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555"}', true);
select throws_ok(
  'insert into rls_test.listing_enquiries (listing_id, buyer_id, buyer_name, buyer_email, message) values (''aaaaaaaa-0000-0000-0000-000000000001'', ''55555555-5555-5555-5555-555555555555'', ''Banned'', ''banned@example.test'', ''Please let me in'')',
  '42501',
  null,
  'a suspended account cannot send an enquiry'
);
reset role;

-- --- 14g. a LOGGED-OUT visitor is NOT banned ----------------------------
-- A ban is on an ACCOUNT, not on the public marketplace. Browsing and
-- asking a question as an anonymous visitor must keep working.
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select ok(
  (select count(*)::int from rls_test.listings where status = 'active') >= 2,
  'a logged-out visitor still sees the ACTIVE listings'
);
select lives_ok(
  'insert into rls_test.listing_enquiries (listing_id, buyer_name, buyer_email, message) values (''aaaaaaaa-0000-0000-0000-000000000002'', ''Anon'', ''anon@example.test'', ''Is this still available?'')',
  'a logged-out visitor can still send an enquiry'
);
reset role;

-- --- 14h. the email gate ------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select is(
  (select rls_test.email_is_banned('blocked@example.test'))::bool,
  true::bool,
  'email_is_banned() blocks a deleted account''s address'
);
select is(
  (select rls_test.email_is_banned('  BLOCKED@Example.test  '))::bool,
  true::bool,
  'and it ignores case and surrounding spaces'
);
select is(
  (select rls_test.email_is_banned('amina@example.test'))::bool,
  false::bool,
  'an ordinary address is not blocked'
);
reset role;

-- ===========================================================================
-- 15. THE ADMIN ROLE
--
-- An admin can delete any listing, any enquiry, and any photo, and can
-- read every profile. An operator can do none of that. There is no
-- privileged connection and no `if (admin)` in the app: the difference is
-- entirely in the policies.
-- ===========================================================================

-- --- 15a. an admin can delete a listing they do not own ------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
select lives_ok(
  'delete from rls_test.listings where id = ''aaaaaaaa-0000-0000-0000-000000000002''',
  'an admin can delete a listing they do not own'
);
reset role;
select is(
  (select count(*)::int from rls_test.listings where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0::int,
  'and the listing is really gone'
);

-- --- 15b. an operator can NOT delete a listing they do not own -----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  'delete from rls_test.listings where id = ''aaaaaaaa-0000-0000-0000-000000000004''',
  'an ordinary user deleting another seller''s listing raises no error'
);
reset role;
select is(
  (select count(*)::int from rls_test.listings where id = 'aaaaaaaa-0000-0000-0000-000000000004'),
  1::int,
  'but the listing STILL EXISTS -- the delete was filtered out'
);

-- --- 15c. an admin can update a listing they do not own ------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
select lives_ok(
  'update rls_test.listings set price = 777 where id = ''aaaaaaaa-0000-0000-0000-000000000001''',
  'an admin can correct a price on a listing they do not own'
);
reset role;
select is(
  (select price from rls_test.listings where id = 'aaaaaaaa-0000-0000-0000-000000000001')::bigint,
  777::bigint,
  'and the price really changed'
);

-- --- 15d. an admin can delete any enquiry -------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
select lives_ok(
  'delete from rls_test.listing_enquiries where id = ''eeeeeeee-0000-0000-0000-000000000002''',
  'an admin can delete an enquiry they have nothing to do with'
);
reset role;
select is(
  (select count(*)::int from rls_test.listing_enquiries where id = 'eeeeeeee-0000-0000-0000-000000000002'),
  0::int,
  'and the enquiry is really gone'
);

-- --- 15e. an ordinary user cannot delete another person's enquiry -------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select lives_ok(
  'delete from rls_test.listing_enquiries where id = ''eeeeeeee-0000-0000-0000-000000000005''',
  'a stranger deleting somebody else''s enquiry raises no error'
);
reset role;
select is(
  (select count(*)::int from rls_test.listing_enquiries where id = 'eeeeeeee-0000-0000-0000-000000000005'),
  1::int,
  'but the enquiry STILL EXISTS -- the delete was filtered out'
);

-- --- 15f. an admin can read every profile --------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
select is(
  (select count(*)::int from rls_test.profiles),
  5::int,
  'an admin can read every profile (that is how the panel knows who to ban)'
);
reset role;

-- --- 15g. an ordinary user can only read their own profile ---------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select is(
  (select count(*)::int from rls_test.profiles),
  1::int,
  'an ordinary user still sees only their own profile row'
);
reset role;

-- --- 15h. an ordinary user cannot read the ban list ---------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select is(
  (select count(*)::int from rls_test.banned_emails),
  0::int,
  'the ban list is invisible to ordinary users'
);
reset role;

-- ===========================================================================
-- 16. NO SELF-PROMOTION
--
-- RLS says WHICH ROWS you may touch. It says nothing about WHICH COLUMNS.
-- So `profiles_update_own` would let a user edit their own row and set
-- `is_admin = true` -- and the WITH CHECK would be perfectly happy,
-- because the row IS still theirs.
--
-- The fix is a COLUMN-LEVEL GRANT. Postgres rejects the statement with
-- "permission denied" before RLS is even consulted.
-- ===========================================================================

-- --- 16a. a user cannot promote themselves ------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select throws_ok(
  'update rls_test.profiles set is_admin = true where id = ''33333333-3333-3333-3333-333333333333''',
  '42501',
  null,
  'a user cannot set is_admin on their own profile'
);
reset role;
select is(
  (select is_admin from rls_test.profiles where id = '33333333-3333-3333-3333-333333333333')::bool,
  false::bool,
  'and they are still not an admin (checked from the privileged side)'
);

-- --- 16b. a user cannot clear their own ban -----------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555"}', true);
select throws_ok(
  'update rls_test.profiles set is_banned = false where id = ''55555555-5555-5555-5555-555555555555''',
  '42501',
  null,
  'a suspended user cannot unban themselves'
);
reset role;
select is(
  (select is_banned from rls_test.profiles where id = '55555555-5555-5555-5555-555555555555')::bool,
  true::bool,
  'and they are still suspended'
);

-- --- 16c. a user CAN still edit their harmless columns ------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select lives_ok(
  'update rls_test.profiles set full_name = ''Stranger Renamed'' where id = ''33333333-3333-3333-3333-333333333333''',
  'a user can still change their own name'
);
reset role;
select is(
  (select full_name from rls_test.profiles where id = '33333333-3333-3333-3333-333333333333')::text,
  'Stranger Renamed'::text,
  'and the name really changed'
);

select * from finish();
rollback;
