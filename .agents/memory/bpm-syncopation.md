---
name: BPM síncope bossa (acordes)
description: Correção de síncope no detector de BPM do cliente (teste de família ACF) e lições sobre fidelidade do harness Node vs Web Audio.
---

Em grooves sincopados 3+3+2 (bossa/samba, ex.: "Boa Sorte" ~112), o consenso
ACF+tempograma trava num parcial rítmico (a periodicidade de 3 colcheias, 2/3
do pulso, ou um espúrio do tempograma). Multi-janelas e pesos de banda NÃO
resolvem. Assinatura do pulso verdadeiro B: a ACF também tem picos na família
2/3·B e 4/3·B; o parcial espúrio não tem.

**Regra** (detectTempo): se fam(vencedor) é fraca E mensurável, troca para pico
alternativo com família forte, score razoável, e que não seja meia/dupla oitava.

**Salvaguardas aprendidas por regressão (todas necessárias):**
- fam mensurável: 2/3·B e 4/3·B do vencedor DENTRO da grade — fora da grade,
  fam=0 é "não sei", não "sem família" (senão sequestra 6/8 reais, ex.: colcheia
  158 → 4/3=211 fora da grade).
- Nunca trocar para ~metade/dobro (oitavas já são as opções metade/dobro; em 6/8
  real o pico 1.5× tem família forte e sequestraria).
- famAt precisa de janela ±2 bins: os picos da família raramente caem no bin
  exato arredondado (2/3·111=74 mas o pico está em 75) — sem isso a correção
  não dispara.

**Fidelidade do harness Node (scripts/debug-bpm.ts):** o shim de biquad tem que
(1) manter cada filtro no seu próprio slot da cadeia (HP→LP, não sobrescrever) e
(2) usar Q em dB para lowpass/highpass (Web Audio: Q_linear=10^(Q/20)). Um shim
infiel dá resultados totalmente diferentes do navegador e invalida o diagnóstico.
Depois de corrigido, o harness reproduziu o navegador real bin a bin (validado
com página estática temporária em public/ + teste e2e; headless Chromium NÃO
decodifica m4a/AAC — usar WAV).

**Fase (contratempo):** nesses grooves, casar onsets esparsos com tolerância
larga (T/2) trava a fase no contratempo — as antecipações graves dominam a
força. Solução: escolher a fase pelo perfil circular da envelope INTEIRA
dobrada no período T com kernel estreito (~T/16): posições on-beat acumulam
energia em todos os ciclos (no 3+3+2, tempos 1 e 3 são on-beat; a antecipação
só aparece 1×/compasso). Validar comparando a grade (segStart+phaseSec+k·T)
com beat_track do librosa nas faixas de teste.

**Why:** librosa também erra a métrica dessa música no servidor; a família ACF
foi o único discriminador confiável (111 tem família forte, 139 e 75 não).
**How to apply:** ao mexer no detector, rodar o harness nas faixas de teste e
comparar antes/depois; endpoints /stems/beats do servidor são código morto para
o Audio Lab.
