/*
  # Add metadata column to extracted_positions

  - Store supplemental JSON metadata (e.g. topic_name) for each extracted position row
  - Backfill topic_name from generated_queries metadata when available
*/

alter table public.extracted_positions
  add column if not exists metadata jsonb;

-- Ensure metadata column defaults to an empty object instead of null
update public.extracted_positions
set metadata = '{}'::jsonb
where metadata is null;

-- Backfill topic_name from generated_queries metadata when present
update public.extracted_positions ep
set metadata = jsonb_set(
  coalesce(ep.metadata, '{}'::jsonb),
  '{topic_name}',
  to_jsonb(g.metadata ->> 'topic_name')
)
from generated_queries g
where ep.query_id = g.id
  and g.metadata ? 'topic_name';

