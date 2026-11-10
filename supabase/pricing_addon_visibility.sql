-- Gerenciamento independente dos complementos na precificação.
-- "Ocultar da precificação" não exclui o complemento do cardápio nem os custos registrados.
alter table public.addons
  add column if not exists pricing_visible boolean not null default true;

comment on column public.addons.pricing_visible is
  'Visibilidade apenas no simulador de precificação; independente de is_active no cardápio.';

-- RLS e permissões administrativas já existentes em public.addons continuam vigentes.
