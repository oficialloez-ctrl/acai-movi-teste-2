-- Açaí Moví: precificação interna, sem alteração dos preços de venda.
-- Apenas administradores autorizados podem ler ou editar custos.

create table public.pricing_settings (
  id smallint primary key check (id = 1),
  acai_cost_per_kg numeric(12,2) check (acai_cost_per_kg >= 0),
  fixed_monthly_expenses numeric(12,2) check (fixed_monthly_expenses >= 0),
  expected_monthly_cups integer check (expected_monthly_cups > 0),
  payment_fee_percent numeric(6,3) not null default 0 check (payment_fee_percent >= 0 and payment_fee_percent < 100),
  acai_waste_percent numeric(6,3) not null default 0 check (acai_waste_percent >= 0 and acai_waste_percent < 100),
  desired_margin_percent numeric(6,3) not null default 30 check (desired_margin_percent >= 0 and desired_margin_percent < 90),
  updated_at timestamptz not null default now()
);

create table public.product_pricing (
  product_id uuid primary key references public.products(id) on delete cascade,
  acai_grams numeric(9,2) check (acai_grams > 0 and acai_grams <= 5000),
  toppings_cost numeric(12,2) check (toppings_cost >= 0),
  packaging_cost numeric(12,2) check (packaging_cost >= 0),
  other_unit_cost numeric(12,2) not null default 0 check (other_unit_cost >= 0),
  updated_at timestamptz not null default now()
);

alter table public.pricing_settings enable row level security;
alter table public.product_pricing enable row level security;

-- Prevent accidental exposure even if public schema's default grants are broad.
revoke all on public.pricing_settings, public.product_pricing from public, anon, authenticated;

create policy "pricing_settings_admin_select"
on public.pricing_settings
for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

create policy "pricing_settings_admin_update"
on public.pricing_settings
for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (id = 1 and exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

create policy "product_pricing_admin_select"
on public.product_pricing
for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

create policy "product_pricing_admin_insert"
on public.product_pricing
for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

create policy "product_pricing_admin_update"
on public.product_pricing
for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

grant select, update on public.pricing_settings to authenticated;
grant select, insert, update on public.product_pricing to authenticated;

insert into public.pricing_settings (id) values (1);
