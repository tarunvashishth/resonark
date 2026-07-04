-- Schema mirrors src/lib/types.ts and src/lib/db.ts.
-- Not yet applied to a live project (no Supabase project provisioned during
-- MVP dev). Run with `supabase link` + `supabase db push` once one exists,
-- then swap src/lib/db.ts and src/lib/auth.ts for Supabase-backed versions.

create extension if not exists "pgcrypto";

create type engine as enum ('openai', 'gemini', 'perplexity');
create type plan as enum ('free', 'pro');
create type run_status as enum ('ok', 'error');
create type sentiment as enum ('positive', 'neutral', 'negative');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan plan not null default 'free',
  created_at timestamptz not null default now()
);

-- auth.users isn't exposed over PostgREST, so mirror the email onto profiles
-- at signup — the scheduler worker reads profiles.email for weekly digests.
create function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

create table brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  domain text not null,
  category text not null,
  competitors jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table prompts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  text text not null,
  intent_category text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table runs (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references prompts (id) on delete cascade,
  engine engine not null,
  ran_at timestamptz not null default now(),
  response_text text not null,
  cited_urls jsonb not null default '[]',
  status run_status not null
);

create table mentions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  entity_name text not null,
  is_own_brand boolean not null,
  mentioned boolean not null,
  rank int,
  sentiment sentiment
);

create index on brands (user_id);
create index on prompts (brand_id);
create index on runs (prompt_id);
create index on mentions (run_id);

alter table profiles enable row level security;
alter table brands enable row level security;
alter table prompts enable row level security;
alter table runs enable row level security;
alter table mentions enable row level security;

-- `for all` combines SELECT/UPDATE/DELETE (checked against `using`) with INSERT
-- (checked against `with check`, which implicitly reuses `using` when omitted, as
-- it is here). If a future edit adds an explicit `with check` to any of these
-- policies, make sure it still enforces ownership — omitting it silently
-- reverts to unrestricted inserts.
create policy "own profile" on profiles for all using (auth.uid() = id);

create policy "own brands" on brands for all using (auth.uid() = user_id);

create policy "own prompts" on prompts for all using (
  auth.uid() = (select user_id from brands where brands.id = prompts.brand_id)
);

create policy "own runs" on runs for all using (
  auth.uid() = (
    select b.user_id from brands b join prompts p on p.brand_id = b.id where p.id = runs.prompt_id
  )
);

create policy "own mentions" on mentions for all using (
  auth.uid() = (
    select b.user_id from brands b
    join prompts p on p.brand_id = b.id
    join runs r on r.prompt_id = p.id
    where r.id = mentions.run_id
  )
);

-- Cron worker and other server-side jobs use the service_role key, which
-- bypasses RLS, so no separate write policy is needed for the scheduler.
