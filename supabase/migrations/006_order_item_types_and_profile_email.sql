-- =============================================
-- Order item source types and profile email sync
-- =============================================

alter table public.order_items
  add column if not exists item_type text not null default 'card',
  add column if not exists requested_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_item_type_check'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_item_type_check
      check (item_type in ('card', 'unlisted'));
  end if;
end $$;

update public.order_items
set item_type = 'unlisted',
    requested_note = coalesce(requested_note, 'リストにない商品の査定依頼')
where card_id is null
  and item_type = 'card';

alter table public.profiles
  add column if not exists email text;

update public.profiles as profiles
set email = auth_users.email
from auth.users as auth_users
where profiles.id = auth_users.id
  and profiles.email is distinct from auth_users.email;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
  set email = excluded.email;
  return new;
end;
$$;

create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer as $$
begin
  update public.profiles
  set email = new.email,
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_profile_email();
