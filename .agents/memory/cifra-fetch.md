---
name: Download de cifra (CifraClub)
description: Fallbacks e armadilhas ao baixar a página da cifra no api-server
---

**Regra:** a página `/artista/musica/imprimir.html` do CifraClub responde 500 para ALGUMAS músicas (intermitente por música, não global). O download da cifra deve sempre cair para a página normal `/artista/musica/`, que também traz o `<pre>` com a cifra.

**Why:** em jul/2026 a busca do Audio Lab "parou de funcionar" — a busca (Solr) achava as versões, mas o pick falhava porque só a imprimir.html era tentada e ela devolvia 500.

**How to apply:**
- Qualquer parse do "tom:" no HTML precisa de limite de palavra (`(?<![a-z])tom\s*:`) — a página normal tem CSS embutido com `bottom:10px` que casa `indexOf("tom:")`.
- Testar o fluxo por curl: POST /api/cifra `{query}` → candidates; POST `{pick:id}` → cifra. Lembrar de reiniciar o workflow do api-server após editar rotas (tsx sem --watch).
