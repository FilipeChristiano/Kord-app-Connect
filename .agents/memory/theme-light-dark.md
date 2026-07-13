---
name: Tema claro/escuro do app Kordi
description: Como o seletor de tema funciona e regras para novas telas
---

# Tema claro/escuro (app interno)

Regra: o `:root` do index.css define o tema ESCURO (padrão). A classe `.light` no `<html>` (next-themes, `attribute="class"`, `defaultTheme="dark"`, `enableSystem={false}`) sobrescreve com a identidade da landing (slate-50, superfícies brancas, primary #9673FF com texto branco).

**Why:** o usuário amou a landing clara e pediu que o tema claro do app replique exatamente essa identidade; o escuro continua padrão para não mudar nada para quem já usa.

**How to apply:**
- Novas telas internas: usar SEMPRE tokens semânticos (`text-foreground`, `bg-foreground/5`, `border-border`, `bg-card`, `bg-modal`...) — nunca `text-white`/`bg-white/5`/`border-white/10` cravados. Não usar variantes `dark:`.
- Texto branco sobre botões/gradientes coloridos fixos (btn-kordi, bg-primary, chips) continua `text-white` (correto nos dois temas).
- Papel de cifra permanece claro nos dois temas (não converter).
- Wordmark branco (imagem): usar classe `wordmark-adaptive` (filter invert no `.light`) só onde o fundo acompanha o tema; sign-in/up têm fundo escuro fixo (Clerk escuro é limitação aceita da v1).
- Landing (`landing.tsx`/`landing-demos.tsx`) é sempre clara com classes literais — o tema não a afeta.
- Utilidades compartilhadas `glass`, `glass-card`, `btn-kordi`, `text-gradient-primary` vivem no index.css e são temáveis; ao refatorar CSS global, checar consumo com grep antes de remover (a reforma da landing removeu-as e quebrou telas internas silenciosamente).
