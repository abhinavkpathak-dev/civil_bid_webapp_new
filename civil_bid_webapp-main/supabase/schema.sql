-- CivilBid database schema. Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- ---------- Profiles (one row per account; passwords live only in Supabase Auth) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  role text not null check (role in ('gov','org','bidder')),
  department text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_key on public.profiles (lower(username));

alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Create the profile automatically when someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, email, role, department, data)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    new.email,
    new.raw_user_meta_data->>'role',
    new.raw_user_meta_data->>'department',
    coalesce(new.raw_user_meta_data->'profile', '{}'::jsonb)
  );
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Tenders ----------
create table if not exists public.tenders (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null,
  department text,
  issuer_type text,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.my_gov_dept() returns text
language sql stable security definer set search_path = public as $$
  select department from public.profiles where id = auth.uid() and role = 'gov'
$$;

alter table public.tenders enable row level security;
drop policy if exists "tenders_select" on public.tenders;
drop policy if exists "tenders_insert" on public.tenders;
drop policy if exists "tenders_update" on public.tenders;
drop policy if exists "tenders_delete" on public.tenders;
create policy "tenders_select" on public.tenders for select using (
  status = 'Published'
  or owner_id = auth.uid()
  or (issuer_type = 'Government' and department = public.my_gov_dept())
);
create policy "tenders_insert" on public.tenders for insert with check (owner_id = auth.uid());
create policy "tenders_update" on public.tenders for update using (
  owner_id = auth.uid() or (issuer_type = 'Government' and department = public.my_gov_dept())
);
create policy "tenders_delete" on public.tenders for delete using (
  owner_id = auth.uid() or (issuer_type = 'Government' and department = public.my_gov_dept())
);

-- ---------- Bids ----------
create table if not exists public.bids (
  id text primary key,
  tender_id text not null references public.tenders(id) on delete cascade,
  bidder_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (tender_id, bidder_id)
);

create or replace function public.can_manage_tender(tid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenders t
    where t.id = tid
      and (t.owner_id = auth.uid()
           or (t.issuer_type = 'Government' and t.department = public.my_gov_dept()))
  )
$$;

alter table public.bids enable row level security;
drop policy if exists "bids_select" on public.bids;
drop policy if exists "bids_insert" on public.bids;
create policy "bids_select" on public.bids for select using (
  bidder_id = auth.uid() or public.can_manage_tender(tender_id)
);
create policy "bids_insert" on public.bids for insert with check (
  bidder_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'bidder')
);

-- ---------- Small public helper functions ----------
create or replace function public.username_taken(u text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where lower(username) = lower(u))
$$;

create or replace function public.login_email(term text, r text) returns text
language sql stable security definer set search_path = public as $$
  select email from public.profiles
  where role = r and (lower(username) = lower(term) or lower(email) = lower(term))
  limit 1
$$;

create or replace function public.bid_count() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.bids
$$;

-- ---------- Live updates ----------
alter publication supabase_realtime add table public.tenders;
alter publication supabase_realtime add table public.bids;
