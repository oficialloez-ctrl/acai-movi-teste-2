-- RLS: separate unauthenticated storefront reads from authenticated admin reads.
alter policy "public reads active products" on public.products to anon;
alter policy "admin reads all products" on public.products to authenticated
  using (is_active or exists(select 1 from public.admin_users where user_id=(select auth.uid())));
alter policy "public reads active addons" on public.addons to anon;
alter policy "admin reads all addons" on public.addons to authenticated
  using (is_active or exists(select 1 from public.admin_users where user_id=(select auth.uid())));
alter policy "public reads delivery areas" on public.delivery_areas to anon;
alter policy "admin reads all areas" on public.delivery_areas to authenticated
  using (is_active or exists(select 1 from public.admin_users where user_id=(select auth.uid())));

-- Anonymous insertion is allowed only while the store is open on the server's Brazil timezone.
create or replace function app_private.enforce_order_hours()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cfg public.store_settings%rowtype;
  ts timestamp;
  dow int;
  prev_dow int;
  curr_min int;
  open_min int;
  close_min int;
  allowed boolean := false;
  recent_orders int;
begin
  select * into cfg from public.store_settings where id=1;
  if not found or not cfg.accepting_orders then
    raise exception 'Loja fechada' using errcode='P0001';
  end if;
  ts := current_timestamp at time zone 'America/Sao_Paulo';
  dow := extract(dow from ts)::int;
  prev_dow := (dow + 6) % 7;
  curr_min := extract(hour from ts)::int * 60 + extract(minute from ts)::int;
  open_min := extract(hour from cfg.opening_time)::int * 60 + extract(minute from cfg.opening_time)::int;
  close_min := extract(hour from cfg.closing_time)::int * 60 + extract(minute from cfg.closing_time)::int;
  if open_min < close_min then
     allowed := dow = any(cfg.open_days) and curr_min >= open_min and curr_min < close_min;
  elsif open_min > close_min then
     allowed := (dow = any(cfg.open_days) and curr_min >= open_min)
         or (prev_dow = any(cfg.open_days) and curr_min < close_min);
  end if;
  if not allowed then
     raise exception 'Fora do horario de atendimento' using errcode='P0001';
  end if;
  select count(*) into recent_orders
  from public.orders o
  where o.phone=new.phone and o.created_at > now() - interval '1 hour';
  if recent_orders >= 5 then
     raise exception 'Limite de pedidos por telefone excedido' using errcode='P0001';
  end if;
  return new;
end
$$;
revoke all on function app_private.enforce_order_hours() from public, anon, authenticated;
drop trigger if exists trg_order_window on public.orders;
create trigger trg_order_window before insert on public.orders
for each row execute function app_private.enforce_order_hours();

-- Enforce minimum required privileges, not broad PUBLIC defaults.
revoke all on public.admin_users, public.products, public.addons, public.delivery_areas,
  public.store_settings, public.orders from anon, authenticated;
grant select on public.admin_users to authenticated;
grant select on public.products, public.addons, public.delivery_areas, public.store_settings
  to anon, authenticated;
grant insert, update on public.products, public.addons, public.delivery_areas to authenticated;
grant update on public.store_settings to authenticated;
grant insert on public.orders to anon, authenticated;
grant select, update on public.orders to authenticated;
