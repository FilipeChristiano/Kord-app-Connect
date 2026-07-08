---
name: stripe-replit-sync backfill
description: Como o syncBackfill da lib stripe-replit-sync funciona e o acesso via schema stripe no Kordi
---

- `stripeSync.syncBackfill()` **sem parâmetros sincroniza nada** (retorna `{}`). É obrigatório passar `{ object: "all" }` (ou chamar métodos individuais `syncProducts`, `syncSubscriptions`, etc.).
- **Why:** descoberto quando `stripe.products` ficou vazio e `/api/stripe/plan` dava 404 mesmo com seed OK.
- **How to apply:** qualquer chamada de backfill no startup do api-server deve usar `{ object: "all" }`.

Outras decisões da assinatura Stripe (Task de assinatura mensal):
- Acesso Stripe é lido **direto do schema `stripe`** (join `stripe.subscriptions` + `stripe.customers` por e-mail, status active/trialing) — fonte única; NUNCA grava em `allowed_emails` (que fica só para Hotmart legado/manual, intocado).
- Webhook raw (`express.raw`) registrado ANTES de `express.json` em app.ts; `stripe-replit-sync` valida a assinatura.
- Credenciais vêm da connection Replit: chave em `settings.secret` (não `secret_key`); `settings.webhook_secret` para o webhook.
- URLs de retorno do checkout/portal: validar host contra `REPLIT_DOMAINS` (nunca confiar em `x-forwarded-host` puro) para evitar open redirect.
- Teste e2e em modo test: criar payment method com `card: { token: "tok_visa" }` e attach (o atalho `pm_card_visa` NÃO existe na API server-side).
