---
name: Kordi video usa HeroShowcase verbatim
description: Regra do vídeo de apresentação (artifacts/kordi-video) — nunca adaptar a animação da landing, copiar 100%.
---

O usuário exige que o vídeo de apresentação seja uma cópia 100% fiel do HeroShowcase da página de vendas (artifacts/acordes/src/components/HeroShowcase.tsx). Adaptações "inspiradas" foram rejeitadas duas vezes.

**Why:** o usuário considera o showcase da landing a referência de qualidade; qualquer divergência de animação/tempo é vista como defeito e desperdício de créditos.

**How to apply:**
- Se o HeroShowcase da landing mudar, re-copiar o arquivo inteiro para artifacts/kordi-video/src/components/showcase/HeroShowcase.tsx (únicas mudanças permitidas: sound=true fixo e remoção do botão de som).
- A gravação do vídeo captura o áudio da própria página: os sons reais tocam do componente (playClip/piano). A trilha composite_audio.mp3 tem música de fundo SÓ na intro e no outro — nunca durante o showcase (mistura de áudio foi outra reclamação).
- Duração da cena showcase = soma exata de um ciclo do SCENES do componente (recalcular se o original mudar).
- Logo da intro: usar a logo oficial com fundo removido (logo-transparent.png); logo-light.png tem fundo branco e logo.png tem quadrado escuro.
- Piano do dicionário usa AudioContext: a cena Showcase pré-aquece com getAudio()+warmPiano em intervalo até "running".
