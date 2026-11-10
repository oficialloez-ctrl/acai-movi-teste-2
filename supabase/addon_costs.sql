-- Custo real dos complementos e seleção para simular cada produto.
-- Nenhum preço de venda, pedido ou complemento comercial é modificado.
create table if not exists public.addon_costs (
  addon_id uuid primary key references public.addons(id) on delete cascade,
  purchase_price numeric(12,2) check (purchase_price >= 0),
  package_quantity numeric(12,3) check (package_quantity > 0),
  portion_quantity numeric(12,3) check (portion_quantity > 0),
  unit text not null default 'g' check (unit in ('g','ml','un')),
  updated_at timestamptz not null default now()
);
create table if not exists public.pricing_product_addons (
  product_id uuid primary key references public.products(id) on delete cascade,
  addon_ids uuid[] not null default array[]::uuid[] check (cardinality(addon_ids) <= 20),
  updated_at timestamptz not null default now()
);
alter table public.addon_costs enable row level security;
alter table public.pricing_product_addons enable row level security;
revoke all on public.addon_costs, public.pricing_product_addons from public, anon, authenticated;

create policy "addon_costs_admin_select" on public.addon_costs
for select to authenticated
using (exists (select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "addon_costs_admin_insert" on public.addon_costs
for insert to authenticated
with check (exists (select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "addon_costs_admin_update" on public.addon_costs
for update to authenticated
using (exists (select 1 from public.admin_users where user_id=(select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id=(select auth.uid())));

create policy "pricing_selection_admin_select" on public.pricing_product_addons
for select to authenticated
using (exists (select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "pricing_selection_admin_insert" on public.pricing_product_addons
for insert to authenticated
with check (exists (select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "pricing_selection_admin_update" on public.pricing_product_addons
for update to authenticated
using (exists (select 1 from public.admin_users where user_id=(select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id=(select auth.uid())));

grant select,insert,update on public.addon_costs, public.pricing_product_addons to authenticated;
