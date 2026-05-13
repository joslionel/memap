-- Memory Palace App — Supabase Schema
-- Run this in the Supabase SQL editor after creating your project.

-- PALACES
create table palaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table palaces enable row level security;
create policy "Users manage own palaces" on palaces for all using (auth.uid() = user_id);

-- LOCI (locations within a palace)
create table loci (
  id uuid primary key default gen_random_uuid(),
  palace_id uuid references palaces(id) on delete cascade not null,
  position integer not null default 0,
  name text not null,
  descriptor text default '',
  notes text default '',
  coords jsonb,
  created_at timestamptz default now()
);
alter table loci enable row level security;
create policy "Users manage loci via palace" on loci for all using (
  exists (select 1 from palaces where palaces.id = loci.palace_id and palaces.user_id = auth.uid())
);

-- MEMORY SETS (collections of items to memorise)
create table memory_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text default '',
  icon text default '📚',
  -- schema: array of {key, label, type, required} field definitions
  schema jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table memory_sets enable row level security;
create policy "Users manage own sets" on memory_sets for all using (auth.uid() = user_id);

-- MEMORY ITEMS (individual cards in a set)
create table memory_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid references memory_sets(id) on delete cascade not null,
  position integer not null default 0,
  is_aside boolean default false,
  -- data: {name, description, imagery, notes, startDate, endDate, ...custom fields}
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table memory_items enable row level security;
create policy "Users manage items via set" on memory_items for all using (
  exists (select 1 from memory_sets where memory_sets.id = memory_items.set_id and memory_sets.user_id = auth.uid())
);

-- JOURNEYS (a palace + a memory set, linked via assignments)
create table journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  palace_id uuid references palaces(id) on delete set null,
  set_id uuid references memory_sets(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table journeys enable row level security;
create policy "Users manage own journeys" on journeys for all using (auth.uid() = user_id);

-- ASSIGNMENTS (item pinned to a locus within a journey, with SR state)
create table assignments (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid references journeys(id) on delete cascade not null,
  locus_id uuid references loci(id) on delete set null,
  item_id uuid references memory_items(id) on delete set null,
  position integer not null default 0,
  -- SM-2 spaced repetition state
  ease_factor real default 2.5,
  interval_days integer default 0,
  repetitions integer default 0,
  next_review timestamptz default now(),
  last_reviewed timestamptz,
  last_confidence integer,
  created_at timestamptz default now()
);
alter table assignments enable row level security;
create policy "Users manage assignments via journey" on assignments for all using (
  exists (select 1 from journeys where journeys.id = assignments.journey_id and journeys.user_id = auth.uid())
);

-- PRACTICE LOG (history of every review)
create table practice_log (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  confidence integer not null check (confidence between 1 and 5),
  reviewed_at timestamptz default now()
);
alter table practice_log enable row level security;
create policy "Users manage own practice log" on practice_log for all using (auth.uid() = user_id);
