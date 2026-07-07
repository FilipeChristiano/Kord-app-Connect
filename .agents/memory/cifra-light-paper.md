---
name: Cifra em fundo claro (papel)
description: Superfícies de leitura de cifra usam fundo claro estilo papel, mesmo com o app em tema escuro.
---
Regra: toda área que exibe cifra para leitura (Sofisticador, cifras salvas, previews de cifra) usa fundo claro `#fdfcf9` com texto escuro (zinc-700/800), acordes substituídos em violet-700 (chip violet-100) e acordes originais em orange-600.

**Why:** o usuário achou a cifra em fundo escuro desconfortável de acompanhar (07/2026) e pediu conforto visual estilo folha clara (referência Cifra Club, sem copiar).

**How to apply:** ao criar qualquer nova superfície que renderize cifra (novos módulos, exports, modais), use o padrão claro acima — não renderizar cifra em fundo escuro.
