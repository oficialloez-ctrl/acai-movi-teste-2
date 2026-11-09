-- Açaí Moví | banco NOVO, sem importar dados pessoais do projeto anterior.
-- Executar apenas no projeto Supabase dedicado ao Açaí Moví.
create extension if not exists pgcrypto;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(10,2) not null check (price >= 0),
  addons_limit integer not null default 4 check (addons_limit between 0 and 20),
  size_ml integer not null default 300,
  is_active boolean not null default true,
  sort_order integer not null default 0
);
create table if not exists public.addons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(10,2) not null default 0 check(price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0
);
create table if not exists public.delivery_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  fee numeric(10,2) not null check (fee >= 0),
  is_active boolean not null default true
);
create table if not exists public.store_settings (
  id integer primary key default 1 check(id = 1),
  whatsapp_number text not null default '',
  accepting_orders boolean not null default false,
  open_days smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
  opening_time time not null default '13:00',
  closing_time time not null default '22:00',
  updated_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check(length(trim(customer_name)) between 2 and 120),
  phone text not null check(length(trim(phone)) between 10 and 32),
  fulfillment text not null check(fulfillment in ('pickup','delivery')),
  delivery_area text,
  delivery_address text,
  payment_method text not null check(payment_method in ('PIX','Cartão','Dinheiro')),
  items jsonb not null check(jsonb_typeof(items) = 'array'),
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  status text not null default 'novo' check(status in ('novo','confirmado','preparando','saiu_para_entrega','finalizado','cancelado')),
  created_at timestamptz not null default now()
);
-- Preço e frete são recalculados no banco, não confiamos nos totais enviados pelo navegador.
create or replace function app_private.calculate_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  part jsonb; addon jsonb; pr record; ad record;
  amount integer; addon_count integer; addon_cost numeric;
  normalized_addons jsonb; normalized_items jsonb := '[]'::jsonb;
  sub numeric := 0; shipping numeric := 0;
  num_items integer;
begin
  if jsonb_typeof(new.items) <> 'array' then raise exception 'Lista de itens inválida'; end if;
  num_items := jsonb_array_length(new.items);
  if num_items < 1 or num_items > 15 then raise exception 'Quantidade de itens inválida'; end if;
  for part in select value from jsonb_array_elements(new.items) loop
    select p.name,p.price,p.addons_limit into pr
      from public.products p where p.id=(part->>'product_id')::uuid and p.is_active;
    if not found then raise exception 'Produto indisponível'; end if;
    amount := (part->>'quantity')::integer;
    if amount is null or amount < 1 or amount > 20 then raise exception 'Quantidade inválida'; end if;
    if jsonb_typeof(part->'addons') <> 'array' then raise exception 'Adicionais inválidos'; end if;
    addon_count := jsonb_array_length(part->'addons');
    if addon_count > pr.addons_limit then raise exception 'Limite de adicionais excedido'; end if;
    normalized_addons := '[]'::jsonb; addon_cost := 0;
    for addon in select value from jsonb_array_elements(part->'addons') loop
      select a.name,a.price into ad from public.addons a
        where a.id=(addon->>'id')::uuid and a.is_active;
      if not found then raise exception 'Adicional indisponível'; end if;
      if (select count(*) from jsonb_array_elements(normalized_addons) na
          where na->>'id'=addon->>'id') > 0 then raise exception 'Adicional duplicado'; end if;
      addon_cost := addon_cost + ad.price;
      normalized_addons := normalized_addons ||
        jsonb_build_array(jsonb_build_object('id',addon->>'id','name',ad.name,'price',ad.price));
    end loop;
    sub := sub + amount * (pr.price + addon_cost);
    normalized_items := normalized_items || jsonb_build_array(
      jsonb_build_object('product_id',part->>'product_id','name',pr.name,'quantity',amount,
        'unit_price',pr.price+addon_cost,'addons',normalized_addons));
  end loop;
  if new.fulfillment='delivery' then
    if length(trim(coalesce(new.delivery_address,''))) < 6 then raise exception 'Endereço incompleto'; end if;
    select z.fee into shipping from public.delivery_areas z
      where z.name=new.delivery_area and z.is_active;
    if shipping is null then raise exception 'Bairro indisponível'; end if;
  else
    new.delivery_area := null; new.delivery_address := null;
  end if;
  if not exists(select 1 from public.store_settings s
       where s.id=1 and s.accepting_orders=true) then
    raise exception 'Loja fechada';
  end if;
  new.items := normalized_items;
  new.delivery_fee := shipping; new.total := sub + shipping;
  new.status := 'novo';
  return new;
end $$;
revoke all on function app_private.calculate_order() from public, anon, authenticated;
drop trigger if exists trg_order_totals on public.orders;
create trigger trg_order_totals before insert on public.orders
for each row execute function app_private.calculate_order();

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.addons enable row level security;
alter table public.delivery_areas enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
create policy "admin reads self" on public.admin_users for select to authenticated
using ((select auth.uid()) = user_id);
create policy "public reads active products" on public.products for select to anon, authenticated using (is_active);
create policy "admin reads all products" on public.products for select to authenticated
using (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "admin adds products" on public.products for insert to authenticated
with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "admin updates products" on public.products for update to authenticated
using (exists(select 1 from public.admin_users where user_id=(select auth.uid())))
with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "public reads active addons" on public.addons for select to anon, authenticated using (is_active);
create policy "admin reads all addons" on public.addons for select to authenticated
using (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "admin adds addons" on public.addons for insert to authenticated
with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "admin updates addons" on public.addons for update to authenticated
using (exists(select 1 from public.admin_users where user_id=(select auth.uid())))
with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "public reads delivery areas" on public.delivery_areas for select to anon, authenticated using (is_active);
create policy "admin reads all areas" on public.delivery_areas for select to authenticated
using (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "admin adds areas" on public.delivery_areas for insert to authenticated
with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "admin updates areas" on public.delivery_areas for update to authenticated
using (exists(select 1 from public.admin_users where user_id=(select auth.uid())))
with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "public reads store status" on public.store_settings for select to anon, authenticated using (true);
create policy "admin updates store" on public.store_settings for update to authenticated
using (exists(select 1 from public.admin_users where user_id=(select auth.uid())))
with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "public places order" on public.orders for insert to anon, authenticated
with check (status='novo' and total >= 0 and delivery_fee >= 0);
create policy "admin sees orders" on public.orders for select to authenticated
using (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "admin updates order status" on public.orders for update to authenticated
using (exists(select 1 from public.admin_users where user_id=(select auth.uid())))
with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));

grant usage on schema public to anon, authenticated;
grant select on public.products,public.addons,public.delivery_areas,public.store_settings to anon, authenticated;
grant select on public.admin_users to authenticated;
grant insert on public.orders to anon, authenticated;
grant select,update on public.orders to authenticated;
grant insert,update on public.products,public.addons,public.delivery_areas to authenticated;
grant update on public.store_settings to authenticated;

insert into public.store_settings(id) values(1) on conflict(id) do nothing;
insert into public.products(name,price,addons_limit,size_ml,sort_order) values
('Açaí 300ml',18,4,300,1),('Açaí 400ml',20,4,400,2),
('Açaí 500ml',22,4,500,3),('Marmita 1kg',45,6,1000,4)
on conflict(name) do nothing;
insert into public.addons(name,price,sort_order) values
('Banana',0,1),('Granola',0,2),('Amendoim',0,3),('Paçoca',0,4),
('Leite em pó',0,5),('Confete',0,6),('Coco ralado',0,7),
('Leite condensado',0,8),('Bis',0,9),('Morango',3,10),
('Kiwi',3,11),('Creme de avelã',3,12),('Oreo',3,13)
on conflict(name) do nothing;
insert into public.delivery_areas(name,fee) values
('Centro',10),('Alvorada',10),('Cango',10),('Kennedy',10),
('Cristo Rei',10),('Guanabara',11),('São Francisco',11),('Alto da Julio',12),
('Industrial',12),('Marrecas',12),('Vila Nova',12),('Novo Mundo',12),
('Novo Horizonte',12),('Aeroporto',13),('Bom Pastor',13),('Seminário',13),
('Raffer',13),('Água Branca',14),('Jardim Floresta',14),
('Jardim Itália',12),('Primavera',14),('Júpiter',14),('Miniguaçu',14),
('Pinheirinho',14),('Pinheirão',15),('Terra Nossa',15),
('Sadia',15),('São Marcos',18),('Pedra Branca M',18),('Nortão',20),
('Santa Bárbara',20),('Centro M',30),('Ipiranga M',30),
('Marmeleiro',30),('Passarela M',30)
on conflict(name) do nothing;
-- PRIMEIRO ADMIN: cadastre um usuário pelo Supabase Auth e execute MANUALMENTE:
-- insert into public.admin_users(user_id) values ('UUID_DO_USUARIO');
-- A loja permanece fechada até um administrador habilitar pedidos.
