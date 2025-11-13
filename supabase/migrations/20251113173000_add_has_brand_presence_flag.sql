alter table public.extracted_positions
  add column if not exists has_brand_presence boolean not null default false;

update public.extracted_positions
set has_brand_presence = (total_brand_mentions > 0);

