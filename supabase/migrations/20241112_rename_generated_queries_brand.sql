alter table public.generated_queries
  rename column entity to brand;

alter table public.generated_queries
  drop column if exists brand_name;

