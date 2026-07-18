-- TradePlan AI Indonesia Supabase schema
-- Jalankan di Supabase SQL Editor.

create extension if not exists pgcrypto;

-- 1. profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  risk_profile text default 'Moderat',
  default_modal bigint default 10000000,
  default_trading_mode text default 'PAGI_SORE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_created_at_idx on public.profiles (created_at);

alter table public.profiles enable row level security;

create policy if not exists "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy if not exists "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy if not exists "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- 2. analyses
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_type text not null default 'MANUAL',
  title text,
  summary text,
  market_bias text,
  market_overview jsonb,
  watchlist jsonb default '[]'::jsonb,
  stocks jsonb default '[]'::jsonb,
  risk_warning text,
  raw_plan jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists analyses_user_id_idx on public.analyses (user_id);
create index if not exists analyses_created_at_idx on public.analyses (created_at desc);

alter table public.analyses enable row level security;

create policy if not exists "Users can view their own analyses"
  on public.analyses
  for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert their own analyses"
  on public.analyses
  for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update their own analyses"
  on public.analyses
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists "Users can delete their own analyses"
  on public.analyses
  for delete
  using (auth.uid() = user_id);

-- 3. watchlists
create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text,
  score numeric,
  category_matches jsonb default '[]'::jsonb,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watchlists_user_id_idx on public.watchlists (user_id);
create index if not exists watchlists_code_idx on public.watchlists (code);

alter table public.watchlists enable row level security;

create policy if not exists "Users can view their own watchlists"
  on public.watchlists
  for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert their own watchlists"
  on public.watchlists
  for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update their own watchlists"
  on public.watchlists
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists "Users can delete their own watchlists"
  on public.watchlists
  for delete
  using (auth.uid() = user_id);

-- 4. trading_journal
create table if not exists public.trading_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  entry_price numeric,
  exit_price numeric,
  position_size numeric,
  result_amount numeric,
  status text default 'OPEN',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trading_journal_user_id_idx on public.trading_journal (user_id);
create index if not exists trading_journal_symbol_idx on public.trading_journal (symbol);
create index if not exists trading_journal_created_at_idx on public.trading_journal (created_at desc);

alter table public.trading_journal enable row level security;

create policy if not exists "Users can view their own trading journal"
  on public.trading_journal
  for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert their own trading journal"
  on public.trading_journal
  for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update their own trading journal"
  on public.trading_journal
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists "Users can delete their own trading journal"
  on public.trading_journal
  for delete
  using (auth.uid() = user_id);

-- Optional helper trigger to update updated_at automatically
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger if not exists profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger if not exists analyses_set_updated_at
  before update on public.analyses
  for each row execute function public.set_updated_at();

create trigger if not exists watchlists_set_updated_at
  before update on public.watchlists
  for each row execute function public.set_updated_at();

create trigger if not exists trading_journal_set_updated_at
  before update on public.trading_journal
  for each row execute function public.set_updated_at();
