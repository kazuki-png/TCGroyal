-- Provider reference metadata only. Never mix with public.cards or customer photos.
create table public.lending_card_references (
 provider text not null check (provider = 'snkrdunk'),
 product_id text not null check (product_id ~ '^[1-9][0-9]{0,8}$'),
 name text not null check (length(name) between 1 and 500),
 card_number text not null check (length(card_number) <= 100),
 category text not null check (category in ('pokemon','onepiece')),
 image_url text check (length(image_url) <= 2000 and image_url like 'https://cdn.snkrdunk.com/%'),
 source_url text not null check (source_url = 'https://snkrdunk.com/apparels/' || product_id),
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 primary key (provider,product_id)
);
create index lending_card_references_number_idx on public.lending_card_references (card_number);
alter table public.lending_card_references enable row level security;
revoke all on public.lending_card_references from public,anon,authenticated;
grant select,insert,update on public.lending_card_references to service_role;
comment on table public.lending_card_references is 'Validated provider metadata for lending. Image URLs only, no user uploads, prices, automatic identity mappings, or original cards mutations.';
