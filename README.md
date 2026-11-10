# Açaí Moví — nova infraestrutura própria
Recriado a partir do ZIP enviado, em uma branch separada, sem alterar a loja do amigo nem outros projetos.

## URLs
- Loja de testes: https://acai-movi-loez.vercel.app
- Painel: https://acai-movi-loez.vercel.app/admin
- Vercel: https://vercel.com/oficialloez-3374/acai-movi-loez
- Supabase: https://supabase.com/dashboard/project/pbdvhnmjinojopjeqyjn

## Infraestrutura confirmada
- Projeto Vercel próprio (Next.js 16, Node 22), deploy de produção da branch nova-infra-vercel-supabase
- Projeto Supabase próprio acai-movi-loez, região sa-east-1
- Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY na Vercel
- Migrações aplicadas: supabase/schema.sql e supabase/security-hardening.sql
- Segurança: RLS em todas as 6 tabelas, sem alertas dos advisors
- Dados iniciais: 4 produtos, 13 complementos e 35 áreas de entrega
- Loja FECHADA por padrão para não receber pedidos antes da homologação
- Testes de banco: pedido fora do horário negado e preço recalculado no banco (ambos sem deixar registros)

## Para autorizar o primeiro administrador
1. No Supabase, Authentication > URL Configuration, configure **Site URL** = https://acai-movi-loez.vercel.app e permita https://acai-movi-loez.vercel.app/** em **Redirect URLs**.
2. Abra https://acai-movi-loez.vercel.app/admin e clique em **Criar conta** com o e-mail que será o administrador. Confirme o e-mail.
3. Se já entrou, o painel mostrará seu UUID; conceda acesso no SQL Editor do projeto NOVO:
   insert into public.admin_users(user_id) values ('SEU-UUID');
   Ou peça ao operador autorizado a executar esse comando; não cole senhas aqui.
4. Entre no painel administrativo, confira o número oficial do WhatsApp (formato 55+DDD+número), preços, bairros, fretes e dias/horários.
5. Teste um pedido completo e só então ative **Aceitar pedidos**. Até lá a loja permanece fechada.

## Limitações atuais
- O WhatsApp é aberto no aplicativo/site com o texto do pedido; não existe automação oficial da API do WhatsApp Business nem confirmação de pagamento.
- Não há migração dos pedidos anteriores, pois o ZIP fornecido não continha banco de clientes/pedidos.
- Não há testes E2E automatizados no navegador nesta etapa; o build da Vercel e os testes SQL foram concluídos.
- Falta validação presencial da operação por administrador, proteção adicional anti-bot e política de privacidade antes de liberar ao público.
- A nova loja usa outro endereço; acai-movi.vercel.app continua sob a configuração original de terceiros.

## Arquivos importantes
- src/app/page.jsx: loja, seleção de adicionais, carrinho e checkout.
- src/app/admin/page.jsx: painel e login com Supabase Auth.
- supabase/schema.sql: estrutura inicial e políticas.
- supabase/security-hardening.sql: restrições finais, cálculo de horário no servidor e controle básico de abuso.

**Não coloque chaves secretas no repositório ou em variáveis NEXT_PUBLIC_.**


## Complementos na precificação (atualização)
Na aba **Precificação**, seção de complementos:
- **Adicionar complemento** cria o item no cadastro central, com preço de venda R$ 0 e `is_active=false`, para não aparecer automaticamente no cardápio de clientes. É possível ativá-lo e ajustar o preço depois na aba **Adicionais**.
- **Retirar** apenas coloca `addons.pricing_visible=false`, ocultando-o da precificação sem apagar custos, pedidos, seleções anteriores nem alterar a visibilidade no cardápio.
- **Ver removidos / Restaurar** permite recuperá-lo a qualquer momento.
- Complementos ocultos ficam fora do custo estimado e da seleção de novos cenários enquanto estiverem ocultos. Se já estavam selecionados anteriormente, a configuração histórica fica guardada até nova gravação da seleção.
- A migração SQL necessária está em `supabase/pricing_addon_visibility.sql` e preserva os 13 complementos existentes.

*Não confundir "Retirar da precificação" com "desativar no cardápio" na aba Adicionais.*
