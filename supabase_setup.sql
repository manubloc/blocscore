-- blocscore · Supabase setup
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────

-- Main key/value store (used for community data, photos)
create table if not exists blocscore_store (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz default now()
);

-- Optional: keep a simple change history (last 100 writes per key)
-- Useful if you ever want to recover accidentally deleted data.
create table if not exists blocscore_history (
  id          bigserial primary key,
  key         text not null,
  value       text not null,
  written_at  timestamptz default now()
);

create or replace function blocscore_log_change()
returns trigger language plpgsql as $$
begin
  insert into blocscore_history (key, value) values (NEW.key, NEW.value);
  -- keep only the last 100 entries per key
  delete from blocscore_history
  where key = NEW.key
    and id not in (
      select id from blocscore_history
      where key = NEW.key
      order by id desc
      limit 100
    );
  return NEW;
end;
$$;

create or replace trigger blocscore_store_log
after insert or update on blocscore_store
for each row execute function blocscore_log_change();

-- Allow public read/write (the app handles its own auth via PINs).
-- If you later want per-user access control, enable RLS here.
alter table blocscore_store   enable row level security;
alter table blocscore_history enable row level security;

create policy "public read"  on blocscore_store   for select using (true);
create policy "public write" on blocscore_store   for all    using (true);
create policy "public read"  on blocscore_history for select using (true);

-- Done! Your database is ready.
