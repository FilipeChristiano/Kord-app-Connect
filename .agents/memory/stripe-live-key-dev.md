---
name: Chave live da Stripe no desenvolvimento
description: Por decisão do usuário, o dev usa a conta LIVE da Stripe via STRIPE_SECRET_KEY; cuidados ao testar e ao trocar de conta.
---

Por escolha explícita do usuário, o desenvolvimento usa a conta REAL da Stripe (Vetra Transformação) via secret `STRIPE_SECRET_KEY` (sk_live_). Os `stripeClient.ts` (api-server e scripts) priorizam essa env var sobre a integração Replit; sem ela, caem para a conexão (sandbox em dev).

**Why:** o usuário já tinha produto/método de pagamento configurados na conta real e a sandbox recriada a cada reconexão gerava confusão.

**How to apply:**
- CUIDADO: qualquer checkout/assinatura de teste em dev aparece na conta real; cartões de teste (4242…) NÃO funcionam em live mode. Não criar cobranças reais sem avisar o usuário.
- Chave restrita (rk_live_) não serve: faltam permissões (accounts, products write etc.) — exigir sk_live_.
- Ao trocar de conta Stripe, o schema `stripe` local guarda dados da conta antiga: truncar todas as tabelas de dados (o TRUNCATE cascateia para `_managed_webhooks`, que é recriada no startup; manter `_migrations`) e reiniciar o api-server para ressincronizar.
- `ensurePlan` troca o `default_price` do produto antes de arquivar preço antigo (preço default não pode ser arquivado).
