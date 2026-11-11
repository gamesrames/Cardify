# Docs do Cardify

Contexto do projeto dividido por área, para cada agente ler só o que precisa. Os docs são a fonte de verdade para quem escreve código; o documento de escopo no Claude ([Cardify: escopo e decisões](https://claude.ai/artifact/4sJnNsdYxhY1etzsR6ZmTQ)) é a visão de produto para o dono do projeto. Se os dois divergirem, avise o coordenador em vez de escolher um lado.

## O que ler, por área

| Se você trabalha em... | Leia | Pasta de código |
| --- | --- | --- |
| Regras, fórmulas, balanceamento | `visao-geral.md`, `game-design.md`, `engine.md` | `engine/` |
| App (telas, navegação, câmera) | `visao-geral.md`, `app.md`, `game-design.md` (resumo das regras), `engine.md` (só a API) | `app/` |
| Servidor (banco, login, partidas online) | `visao-geral.md`, `backend.md`, `partidas-online.md` (fase 4), `engine.md` (só a API) | `supabase/` |
| Geração de cartas a partir de foto, moderação | `visao-geral.md`, `geracao-cartas.md`, `game-design.md` (fórmulas), `backend.md` | `supabase/` e `app/` (partes da câmera) |
| Coordenação, novas threads | `agentes.md`, `decisoes.md` | — |

Todo mundo deve passar por `visao-geral.md` na primeira vez.

## Índice

- [`visao-geral.md`](visao-geral.md) — o produto, as 5 fases e o critério de "pronto" de cada uma.
- [`agentes.md`](agentes.md) — como dividir o trabalho entre agentes (threads), quem é dono de quê.
- [`game-design.md`](game-design.md) — regras, elementos, raridades, fórmulas e valores.
- [`engine.md`](engine.md) — motor de combate, API, simulador, achados de balanceamento.
- [`app.md`](app.md) — app Expo: stack, telas previstas, como testar no celular.
- [`backend.md`](backend.md) — Supabase: dados, segurança, login.
- [`partidas-online.md`](partidas-online.md) — fase 4: 1x1 por convite, turnos no servidor, tempo de turno, privacidade da mão.
- [`progressao.md`](progressao.md) — fase 5: Essência, melhoria de cartas, ranking Elo, escolhas padrão, passo a passo do SQL e roteiro de teste.
- [`geracao-cartas.md`](geracao-cartas.md) — da foto à carta, duplicatas, moderação e privacidade.
- [`decisoes.md`](decisoes.md) — registro de decisões em ordem cronológica.

## Como manter os docs

- **Atualize na mesma entrega.** Mudou uma regra, fórmula, API ou decisão? O doc muda no mesmo PR do código.
- **Cada doc tem uma seção "Estado atual"** no topo. Mantenha-a curta e verdadeira: o que existe, o que está em andamento, o que é só plano.
- **Marque o que é plano.** Texto sob "Proposta" ou "A definir" não é decisão. Só vira decisão quando entra em `decisoes.md`.
- **`decisoes.md` só recebe linhas novas** (data, decisão, motivo). Não reescreva o histórico; se uma decisão for substituída, acrescente uma linha nova que a revoga.
- **Um assunto, um lugar.** Fórmulas ficam em `game-design.md`; o código do motor só aponta para lá. Não copie tabelas entre docs, aponte o link.
- **Sem segredos.** Nunca coloque chaves, senhas ou URLs privadas do Supabase nos docs.
- **Mantenha curto.** Se um doc passar de umas 200 linhas, divida por assunto.
