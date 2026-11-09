-- ===========================================================================
-- LandFlow — self-service account creation
-- ---------------------------------------------------------------------------
-- WHY THIS EXISTS
--   Supabase's built-in email service sends at most a couple of messages an
--   hour and silently drops the rest. With "Confirm email" switched on, a new
--   account was created but the confirmation link never arrived, so nobody
--   could finish signing up. The site looked broken.
--
--   This function creates the account DIRECTLY in auth.users, with the
--   address already marked confirmed. No email is sent, no rate limit is
--   hit, and the person is signed in on the spot.
--
-- HOW IT STAYS SAFE
--   * SECURITY DEFINER — it needs to write to auth.users, which the anon
--     role cannot do.
--   * It REFUSES an address that already has an account. Without that,
--     anyone could "register" somebody else's address with a password of
--     their own and then sign in as them.
--   * It REFUSES a banned address, on the server. (The browser used to do
--     this check, which anyone could skip by calling the API directly.)
--   * It is rate limited per IP, because the endpoint is public — the
--     publishable key ships in the browser bundle, so anyone can call it.
--   * It never returns anything but the new user's id. The password hash
--     never leaves the function.
--
-- HOW TO PUT REAL EMAIL VERIFICATION BACK
--   Configure SMTP in the Supabase dashboard (Authentication -> Providers ->
--   Email -> SMTP) with a real provider such as Resend, turn "Confirm email"
--   back on, and drop this function. The app then goes back to calling
--   supabase.auth.signUp() from the browser.
-- ===========================================================================

create or replace function public.create_account(
  p_email     text,
  p_password  text,
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_id          uuid;
  v_email       text;
  v_hash        text;
  v_ip          text;
  v_recent      integer;
  v_aud         text;
  v_role        text;
  v_meta        jsonb;
begin
  v_email := lower(trim(p_email));

  -- ---- validation -------------------------------------------------------
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email address does not look right.'
      using errcode = '22023';
  end if;

  if p_password is null or length(p_password) < 8 then
    raise exception 'The password needs to be at least 8 characters.'
      using errcode = '22023';
  end if;

  -- ---- rate limit -------------------------------------------------------
  -- Two limits, because one is not enough:
  --
  --   * per IP — stops one machine creating hundreds of accounts;
  --   * across the project — stops a botnet that rotates addresses.
  --
  -- The per-IP limit is deliberately generous (10 an hour). In Uganda a lot
  -- of people share one address behind carrier NAT, so a tight limit would
  -- lock out honest users. The global cap is the real backstop.
  if (select count(*) from auth.users where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Too many accounts were created in the last hour. Please try again later.'
      using errcode = '22023';
  end if;

  begin
    v_ip := coalesce(
      current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for',
      current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip'
    );
  exception when others then
    v_ip := null;
  end;

  if v_ip is not null then
    select count(*) into v_recent
      from auth.users
     where created_at > now() - interval '1 hour'
       and raw_user_meta_data ->> 'signup_ip' = v_ip;

    if v_recent >= 10 then
      raise exception 'Too many accounts were created from this device. Please try again later.'
        using errcode = '22023';
    end if;
  end if;

  -- ---- one account per address ------------------------------------------
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'An account with that email already exists. Try signing in instead.'
      using errcode = '22005';
  end if;

  -- ---- banned addresses --------------------------------------------------
  if exists (select 1 from public.banned_emails where email = v_email) then
    raise exception 'This email address cannot be used to create an account. If you think that is a mistake, contact the site owner.'
      using errcode = '22023';
  end if;

  -- ---- create it --------------------------------------------------------
  v_id := gen_random_uuid();
  v_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));
  v_aud := 'authenticated';
  v_role := 'authenticated';
  v_meta := jsonb_build_object(
    'email', v_email,
    'email_verified', true,
    'full_name', nullif(trim(coalesce(p_full_name, '')), '')
  );
  if v_ip is not null then
    v_meta := v_meta || jsonb_build_object('signup_ip', v_ip);
  end if;

  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at
  )
  values (
    v_id, '00000000-0000-0000-0000-000000000000', v_email, v_hash, now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    v_meta, v_aud, v_role, now(), now()
  );

  -- `email` on auth.identities is a GENERATED column — it cannot be given
  -- a value, Postgres fills it in from the user row.
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object(
      'sub', v_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email', now(), now(), now()
  );

  -- The `on_auth_user_created` trigger creates the profile row.
  return v_id;
end;
$$;

revoke all on function public.create_account(text, text, text) from public;
grant execute on function public.create_account(text, text, text) to anon, authenticated;
