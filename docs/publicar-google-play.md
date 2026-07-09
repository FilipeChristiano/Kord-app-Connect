# Guia: publicar o Kordi no Google Play (Android)

Este guia leva o Kordi do site publicado até a Play Store, passo a passo,
sem precisar programar nada. Reserve cerca de 1 a 2 horas no total
(a revisão do Google depois leva de alguns dias a 2 semanas).

**Pré-requisito:** o site precisa estar publicado e funcionando em
`https://kordi.app.br` (o app Android é uma "casca" que abre o site em tela
cheia — tecnologia chamada Trusted Web Activity/TWA).

---

## Etapa 1 — Criar a conta de desenvolvedor Google (taxa única de US$ 25)

1. Acesse https://play.google.com/console/signup
2. Entre com a sua conta Google e escolha o tipo de conta
   (**Pessoal** é o mais simples).
3. Preencha os dados, pague a taxa única de **US$ 25** (cartão de crédito
   internacional) e confirme a identidade quando o Google pedir
   (pode levar 1–2 dias).

> Contas pessoais novas precisam de um teste fechado com pelo menos 12
> testadores por 14 dias antes de publicar para o público. O Play Console
> mostra isso no caminho "Testes". Se aparecer essa exigência, convide
> amigos/alunos por e-mail — eles só precisam instalar o app e mantê-lo
> instalado.

## Etapa 2 — Gerar o pacote Android (AAB) com o PWABuilder

O PWABuilder é uma ferramenta gratuita da Microsoft que transforma o site
(PWA) em um pacote Android pronto para a loja.

1. Acesse https://www.pwabuilder.com
2. Cole a URL do site: `https://kordi.app.br` e clique em **Start**.
3. Ele vai analisar o site (manifest, service worker). Clique em
   **Package for Stores → Android**.
4. Preencha as opções:
   - **Package ID:** `br.app.kordi`
   - **App name:** `Kordi`
   - **Version / Version code:** deixe o padrão (1.0.0 / 1)
   - **Display mode:** Standalone
   - **Signing key:** escolha **Create new** (o PWABuilder cria a chave de
     assinatura para você). **GUARDE o arquivo .keystore e as senhas em um
     lugar seguro** — sem eles não dá para atualizar o app depois!
5. Clique em **Download** e salve o arquivo `.zip`. Dentro dele há:
   - `app-release-signed.aab` → é o pacote que sobe na loja
   - `signing.keystore` + senhas → guarde com carinho
   - `assetlinks.json` → veja a Etapa 4

## Etapa 3 — Criar o app no Play Console e subir o AAB

1. No Play Console, clique em **Criar app**:
   - Nome: `Kordi — Acordes e Cifras`
   - Idioma padrão: Português (Brasil)
   - Tipo: App • Gratuito
2. Vá em **Testes → Teste interno** (recomendado para começar) →
   **Criar nova versão** → envie o arquivo `app-release-signed.aab`.
3. Preencha a **Ficha da loja** com os textos e imagens prontos na pasta
   `store-assets/google-play/` deste projeto (arquivo `ficha-da-loja.md`).
4. Complete os questionários obrigatórios do painel:
   - **Classificação de conteúdo:** app de música/utilidade, sem conteúdo
     sensível → classificação Livre.
   - **Segurança dos dados:** o app coleta e-mail (para login) e dados de
     pagamento são processados fora do app (site). Áudio enviado é
     processado e descartado. Política: `https://kordi.app.br/privacidade`
   - **Público-alvo:** 13 anos ou mais.
   - **Contém anúncios:** Não.

## Etapa 4 — Vincular o app ao site (assetlinks) — MUITO IMPORTANTE

Sem este passo o app abre com uma barra de navegador em cima, em vez de
tela cheia.

1. No Play Console, vá em **Configurações (ou "Test and release") → Assinatura de apps**
   ("App signing"). Copie a **impressão digital do certificado SHA-256**
   (algo como `AB:CD:12:...` — use a da seção "Chave de assinatura de app").
2. No projeto, abra o arquivo
   `artifacts/acordes/public/.well-known/assetlinks.json` e substitua o
   texto `SUBSTITUA_PELO_SHA256_DO_PLAY_CONSOLE` pela impressão digital
   copiada (mantendo os dois-pontos).
   > É só pedir aqui no chat: "troque o SHA-256 do assetlinks por: (cole o
   > código)" que eu atualizo para você.
3. Publique o site de novo (Republish) para o arquivo entrar no ar.
4. Confira se `https://kordi.app.br/.well-known/assetlinks.json` abre no
   navegador mostrando o código.

## Etapa 5 — Enviar para revisão e publicar

1. Termine o teste interno/fechado exigido (se houver).
2. Vá em **Produção → Criar nova versão**, use o mesmo AAB e clique em
   **Enviar para revisão**.
3. A primeira revisão costuma levar de 2 a 14 dias. Depois de aprovado, o
   Kordi aparece na Play Store para qualquer pessoa baixar. 🎉

## Atualizações futuras

- **Mudanças no site** (novas funções, correções): basta republicar o site —
  o app da loja mostra sempre a versão mais recente automaticamente, sem
  precisar subir nada no Play Console.
- **Mudanças no pacote** (ícone, nome, package): gere um novo AAB no
  PWABuilder usando a MESMA chave `.keystore` guardada, aumente o
  "version code" e suba a nova versão no Play Console.

## Regras importantes (para não ser rejeitado)

- O app **não vende nada dentro dele**: a página de assinatura detecta o
  app Android e mostra apenas o aviso "a assinatura é feita pelo site",
  **sem botão nem link de pagamento** (isso já está implementado). Não
  adicione links de compra dentro do app — é contra a política da loja
  para apps que não usam o pagamento do Google.
- A política de privacidade precisa continuar acessível em
  `https://kordi.app.br/privacidade` (já está no site).

## Checklist rápido

- [ ] Site publicado em kordi.app.br
- [ ] Conta de desenvolvedor criada (US$ 25)
- [ ] AAB gerado no PWABuilder (package `br.app.kordi`) e keystore guardado
- [ ] App criado no Play Console + AAB enviado
- [ ] Ficha da loja preenchida (textos/imagens de `store-assets/google-play/`)
- [ ] Questionários (classificação, segurança de dados, público) completos
- [ ] SHA-256 do Play Console colocado no `assetlinks.json` + site republicado
- [ ] Enviado para revisão
