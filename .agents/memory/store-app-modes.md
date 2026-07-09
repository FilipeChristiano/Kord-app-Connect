---
name: Modos de loja (iOS/Android) na tela de assinatura
description: Regras que qualquer texto de preço/compra no site precisa respeitar quando roda dentro dos apps das lojas.
---

Regra: todo conteúdo de preço/compra/assinatura exibido pelo site precisa respeitar o modo de loja detectado em runtime.

- **iOS (App Store, wrapper Capacitor):** NENHUMA menção a preço, compra, botão OU orientação de onde assinar (Apple 3.1.1 é mais rígida que o Google). Detecção: marcador "KordiApp-iOS" no user agent (appendUserAgent do Capacitor) OU `window.Capacitor.getPlatform()==="ios"` — helper compartilhado em `src/lib/native-app.ts`. Deslogado no iOS vai para /sign-in (somente-login), não /sign-up.
- **Android (Play Store, TWA):** sem botão/link de compra, mas texto orientando a assinar pelo site é aceito. Detecção: referrer `android-app://` persistido em **sessionStorage** (nunca localStorage — TWA e Chrome compartilham storage e um falso positivo permanente bloquearia o checkout web) + fallback standalone+UA Android.

**Why:** apps rejeitados/removidos das lojas se qualquer atualização do site vazar preço/checkout dentro do wrapper; o app carrega o site remoto, então mudanças no site afetam apps já aprovados.

**How to apply:** ao criar/editar qualquer superfície com preço, upsell ou instrução de assinatura, condicione ao modo de loja (iOS esconde tudo; Android só texto). Build iOS não compila no Replit — guia via Mac/Codemagic em docs/publicar-app-store.md; login Google pode falhar em webview (disallowed_useragent), login por e-mail é o caminho.
