# Açaí Moví — nova infraestrutura

Esta versão foi preparada a partir do ZIP acai-movi-teste-2-main.zip, sem alterar o site original.

## Ambientes
- Vercel própria: https://vercel.com/oficialloez-3374/acai-movi-loez
- Loja: https://acai-movi-loez.vercel.app
- Painel: https://acai-movi-loez.vercel.app/admin
- GitHub: branch nova-infra-vercel-supabase (a branch main foi preservada)

## Status
- Next.js compilado e implantado na Vercel
- Catálogo, imagens, adicionais, carrinho, cálculo de entrega por bairro e resumo para WhatsApp
- Painel para itens, entregas, abertura, horários e estados de pedidos
- SQL de Supabase com segurança RLS e cálculo de preços no banco
- Projeto Supabase dedicado ainda não criado nem conectado
- Conta de administrador ainda não configurada
- Fluxo de pedido persistente ainda não testado

## Configuração do Supabase
1. Criar projeto independente na organização escolhida, preferencialmente na região sa-east-1.
2. Executar supabase/schema.sql APENAS no projeto novo.
3. Adicionar NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY na Vercel para ambientes usados.
4. Fazer novo deploy da branch.
5. Abrir /admin, cadastrar e confirmar um e-mail.
6. Com o UUID apresentado no painel e usando o editor SQL autorizado, execute:
   insert into public.admin_users(user_id) values ('UUID-DO-USUARIO');
7. Abrir /admin, configurar número oficial WhatsApp (código 55 + DDD + celular), validar preços, fretes e horários.
8. Somente após testes reais, ativar "Aceitar pedidos".

## Segurança e limitações
- Nenhum pedido é persistido sem conexão e configuração do Supabase.
- O link curto de WhatsApp antigo é usado somente como alternativa; confirme que pertence à loja.
- O banco bloqueia leitura pública de pedidos e recalcula valores no servidor.
- Antes de abrir a loja ao público, implementar mitigação anti-spam/bot e revisar consentimento/privacidade dos clientes.
- Não há processamento automático de cartão/PIX; pagamento é apenas uma preferência registrada no pedido.
- O ZIP não continha dados de pedidos anteriores nem exportação de um banco, então nenhuma informação do amigo foi migrada.
- Nenhum outro projeto existente foi modificado.
