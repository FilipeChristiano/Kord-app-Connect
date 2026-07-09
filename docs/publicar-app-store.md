# Como publicar o Kordi na App Store (iOS)

Guia passo a passo para colocar o Kordi na App Store como **app gratuito,
apenas com login** — a assinatura continua acontecendo no site, fora do app.

> **Leia primeiro a última seção ("Riscos reais de rejeição")** antes de pagar
> a conta de desenvolvedor. A publicação na Apple tem mais risco de rejeição
> que no Google Play, e é bom decidir com essa informação na mão.

---

## O que já está pronto neste projeto

- **Projeto nativo iOS** em `artifacts/acordes/ios/` (gerado com Capacitor).
  Ele abre o site publicado (`kordi.app.br`) dentro do app, com ícone, tela
  de abertura (splash) e permissão de microfone já configurados em português.
- **Modo App Store no site**: quando o site percebe que está rodando dentro
  do app iOS, a tela de "sem acesso" esconde preço, botão de compra e qualquer
  instrução de onde assinar (exigência da Apple). O usuário só vê o estado da
  conta e os botões "Verificar agora" e "Sair".
- **Kit da loja** em `store-assets/app-store/`: ícone 1024, screenshots de
  iPhone nos dois tamanhos e todos os textos da ficha (`ficha-da-loja.md`).

## O que você vai precisar

| Item | Custo | Observação |
|---|---|---|
| Conta Apple Developer | **US$ 99/ano** | https://developer.apple.com/programs/enroll/ — pode levar 1–2 dias para aprovar |
| Um Mac com Xcode **ou** um serviço de build na nuvem | Mac: grátis (se já tiver) / Nuvem: plano gratuito dá conta | Não é possível compilar apps iOS no Replit ou no Windows |
| Site publicado | — | O app carrega `kordi.app.br`; ele precisa estar no ar |

## Etapa 1 — Criar a conta Apple Developer

1. Acesse https://developer.apple.com e entre com (ou crie) um ID Apple.
2. Inscreva-se no **Apple Developer Program** (US$ 99/ano). Para pessoa
   física, a aprovação costuma sair em até 48 h.

## Etapa 2 — Gerar o app (build)

O código nativo já está pronto em `artifacts/acordes/ios/`. Falta compilar,
o que exige um Mac **ou** um serviço de nuvem:

### Opção A — Você tem um Mac
1. Instale o **Xcode** pela App Store do Mac.
2. Baixe o projeto do Replit (menu ⋮ → *Download as zip*) e descompacte.
3. No Terminal do Mac, dentro de `artifacts/acordes`:
   `npm install && npx cap sync ios && npx cap open ios`
4. No Xcode: selecione o time (sua conta Developer) em *Signing &
   Capabilities*, escolha *Any iOS Device* e use **Product → Archive**.
5. Ao final do Archive, clique **Distribute App → App Store Connect** —
   o Xcode envia o app direto para a Apple.

### Opção B — Sem Mac: build na nuvem (Codemagic)
1. Crie uma conta gratuita em https://codemagic.io (500 min/mês grátis).
2. Conecte o repositório do projeto (exporte o Replit para o GitHub em
   *Git → Connect to GitHub*).
3. Crie um app do tipo **Capacitor**, aponte para `artifacts/acordes` e
   siga o assistente de *iOS code signing* (o Codemagic cria os certificados
   na sua conta Apple automaticamente com a *App Store Connect API key*).
4. O Codemagic compila e envia o app para o App Store Connect sozinho.
   (Alternativa equivalente: Ionic Appflow.)

## Etapa 3 — Criar o app no App Store Connect

1. Acesse https://appstoreconnect.apple.com → **Meus apps → ＋ → Novo app**.
2. Preencha:
   - Plataforma: **iOS**
   - Nome: **Kordi — Acordes e Cifras**
   - Idioma principal: **Português (Brasil)**
   - Bundle ID: **br.app.kordi** (crie antes em *Certificates → Identifiers*
     se não aparecer na lista)
   - SKU: `kordi-ios` (qualquer texto único)
3. Preencha a ficha com os textos de
   `store-assets/app-store/ficha-da-loja.md` e envie o ícone e os screenshots
   da mesma pasta.
4. Preencha o formulário **Privacidade do app** conforme a seção
   correspondente da ficha.

## Etapa 4 — Enviar para revisão (a parte mais importante)

1. Na versão do app, selecione o build que subiu na Etapa 2.
2. Em **Informações de revisão do app**, preencha:
   - **Conta de demonstração**: crie um usuário de teste no site com
     assinatura ativa e informe e-mail + senha aqui. **Sem isso a revisão
     é rejeitada na hora**, porque o revisor precisa entrar no app.
   - **Notas para o revisor** (sugestão, em inglês):
     > Kordi is a companion app for existing Kordi accounts. The app does
     > not sell anything and contains no purchase buttons, prices, or links
     > to external payment. Users sign in with an existing account
     > (demo account provided). Microphone is used only for the optional
     > music-transcription feature.
3. Clique em **Enviar para revisão**. A resposta costuma sair em 1–3 dias.

## Etapa 5 — Depois da aprovação

- O app entra na App Store algumas horas após a aprovação.
- Atualizações do **site** aparecem no app automaticamente (o app carrega o
  site) — só é preciso enviar novo build à Apple se mudar algo **nativo**
  (ícone, splash, permissões).

---

## Riscos reais de rejeição (leia antes de pagar)

Seja realista: este formato (app que embrulha um site, sem venda interna)
é permitido, mas é o que mais recebe rejeição na Apple. Os três riscos:

### 1. Guideline 4.2 — "Cara de site empacotado"
A Apple rejeita apps que "são só um site". O Kordi tem a seu favor: funciona
offline (dicionário/ferramentas), usa microfone e áudio em tempo real, e tem
navegação de app. Ainda assim, o revisor pode rejeitar na primeira tentativa.
**Como responder:** conteste pelo *Resolution Center* destacando os recursos
nativos (gravação por microfone, áudio de baixa latência do metrônomo/pads,
funcionamento offline). Rejeições 4.2 são revertidas com frequência quando o
app claramente faz mais que mostrar páginas.

### 2. Guideline 3.1.1 — Pagamentos
Apps que vendem conteúdo digital DENTRO do app precisam usar o pagamento da
Apple (taxa de 15–30%). O Kordi contorna isso não vendendo nada no app — mas
a regra vai além: **o app não pode nem mencionar preço ou dizer onde assinar**
(diferente do Android, onde um texto explicativo é aceito). O modo App Store
já cuida disso automaticamente. **Cuidado no futuro:** qualquer texto novo no
site que fale de preço/assinatura precisa ficar escondido quando o site roda
dentro do app iOS, senão a atualização do site pode derrubar o app já aprovado.

### 3. Login com Google dentro do app
O Google costuma bloquear o login "Entrar com Google" dentro de WebViews de
apps (erro *disallowed_useragent*). Se isso acontecer no app iOS, os usuários
ainda conseguem entrar com **e-mail e código**, que funciona normalmente.
Se o revisor tropeçar nisso, a resposta é orientar o login por e-mail — ou,
numa próxima versão, abrir o login do Google no navegador do sistema.

### Se a Apple exigir compra interna mesmo assim
Em último caso (rejeição 3.1.1 mantida após contestação), a saída é adicionar
assinatura via Apple (StoreKit/RevenueCat) pagando a taxa de 15–30% — isso
está fora do escopo atual e só deve ser feito se realmente for exigido.

---

## Checklist final

- [ ] Site publicado e funcionando em `kordi.app.br`
- [ ] Conta Apple Developer ativa (US$ 99/ano)
- [ ] Build enviado via Xcode (Mac) ou Codemagic (nuvem)
- [ ] Ficha preenchida com os textos de `store-assets/app-store/`
- [ ] Formulário de privacidade preenchido
- [ ] Conta de demonstração com acesso ativo informada na revisão
- [ ] Notas para o revisor preenchidas
