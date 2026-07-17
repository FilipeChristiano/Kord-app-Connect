---
name: Busca de credenciais Stripe no proxy de conexões
description: O filtro connector_names=stripe do proxy de conexões pode retornar vazio; buscar todas e filtrar pelo nome.
---

O endpoint `https://$REPLIT_CONNECTORS_HOSTNAME/api/v2/connection?include_secrets=true&connector_names=stripe` passou a retornar 0 itens mesmo com a conexão saudável, enquanto a mesma chamada SEM o filtro retorna a conexão da Stripe normalmente.

**Why:** o servidor ficou "sem Stripe" em dev e parecia que a conexão tinha caído; reautorizar não resolvia. A causa era só o filtro da query.

**How to apply:** nos `stripeClient.ts` (api-server e scripts), buscar todas as conexões e selecionar `connector_name === "stripe"` no código. A chave fica em `settings.secret` (não `secret_key`). Se "Stripe indisponível" voltar, testar o proxy com e sem o filtro antes de mexer na conexão.

Nota: a conta live da Stripe do usuário ainda precisa ser ativada (dados do negócio) para vender de verdade; em dev tudo roda na sandbox. Anti-abuso de trial: webhook encerra o teste (trial_end now) se o e-mail já teve assinatura antes.
