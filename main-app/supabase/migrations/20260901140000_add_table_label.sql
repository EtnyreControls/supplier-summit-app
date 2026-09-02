-- Adds a friendly display name for each event_tables row, distinct from
-- table_name (the "1".."12" identifier used everywhere as the stable id —
-- vote tallies, "Welcome - Find Your Table", event_table_members joins).
-- Defaults to 'TBD' for every existing table until someone assigns real
-- names. polls/page.tsx uses this as the display label for the "Best
-- Table" poll's options while still submitting/tallying on table_name.

alter table public.event_tables add column table_label text not null default 'TBD';
