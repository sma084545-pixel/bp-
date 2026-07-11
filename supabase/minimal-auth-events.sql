create table if not exists public.bp_resource_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id text not null,
  event_type text not null check (event_type in ('preview', 'download')),
  created_at timestamptz not null default now()
);

alter table public.bp_resource_events enable row level security;

drop policy if exists "Users can insert their own bp resource events"
on public.bp_resource_events;

create policy "Users can insert their own bp resource events"
on public.bp_resource_events
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can read their own bp resource events"
on public.bp_resource_events;

create policy "Users can read their own bp resource events"
on public.bp_resource_events
for select
to authenticated
using (auth.uid() = user_id);
