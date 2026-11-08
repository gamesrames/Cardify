# Motor de combate e simulador

Pasta: `engine/`. Dono: thread de motor/balanceamento. Regras e fórmulas ficam em [`game-design.md`](game-design.md); este doc descreve o código.

## Estado atual

Implementado e aberto como **PR #1** (branch `fase-1-motor-de-combate`, ainda não está no `main`): motor, 30 cartas, validação de baralho, 5 baralhos prontos, bot guloso, bot aleatório, simulador e 14 testes (vitest). O PR já inclui a primeira rodada de balanceamento: orçamento da épica em 27 e ataque/vida de 9 cartas redistribuídos (detalhes em `game-design.md`). O segundo jogador recebe +2 de energia no primeiro turno (`secondPlayerBonusEnergy`). Os caminhos abaixo existem depois que o PR entrar.

## Princípios

- **TypeScript puro**: sem tela, relógio, rede ou `Math.random`. Roda no celular (fase 1) e no servidor (fases 2 a 4) com o mesmo código.
- **Função pura**: `createGame` e `applyAction` recebem estado e devolvem **estado novo** (o antigo nunca muda). A mesma semente gera a mesma partida, então qualquer partida pode ser repetida e auditada.
- **Estado é JSON puro**: dá para trafegar entre app e servidor e salvar no banco sem conversão. O estado do gerador de números aleatórios faz parte do estado do jogo.
- **Todas as regras ajustáveis ficam em `Rules`** (`DEFAULT_RULES`), para o simulador variar.

## API (exportada por `engine/src/index.ts`)

| Função / tipo | O que faz |
| --- | --- |
| `createGame(deckA, deckB, seed, rules?)` | Valida os dois baralhos, embaralha com a semente, sorteia quem começa e devolve `{ state, events }`. Lança erro se o baralho for inválido. |
| `legalActions(state)` | Lista as ações permitidas ao jogador ativo: `{type:'play', handIndex, slot}` e `{type:'end'}`. |
| `applyAction(state, action)` | Aplica uma ação e devolve `{ state, events }`. Lança erro para ação ilegal. `end` resolve os ataques e passa o turno. |
| `validateDeck(deck, rules)` | Devolve a lista de problemas (vazia = válido): tamanho, repetidas, orçamento por raridade, limite de poder. |
| `cardPower`, `deckPower`, `energyCostOf`, `damageAgainst`, `elementMultiplier` | Helpers de regra. |
| `greedyBot`, `makeRandomBot(rng)` | Bots. Cada chamada devolve **uma** ação; chame de novo até vir `{type:'end'}`. O guloso é determinístico. |
| `CARDS`, `PREBUILT_DECKS` | Cartas fixas da fase 1 e baralhos prontos. |
| `GameEvent` | Eventos para o app animar/mostrar o log (`turn_start`, `draw`, `play`, `attack_creature`, `attack_player`, `creature_died`, `game_over`). |

Arquivos: `types.ts` (tipos), `rules.ts` (regras e `DEFAULT_RULES`), `cards.ts`, `deck.ts`, `game.ts`, `bots.ts`, `rng.ts` (gerador determinístico).

## Contrato com app e servidor

- O app (fase 1) chama o motor localmente contra o bot.
- Na fase 4 o **servidor** executa `applyAction`; o cliente só envia a ação desejada e recebe o novo estado/eventos. O cliente nunca calcula o resultado oficial.
- Mudou um tipo ou uma função exportada? É mudança de contrato: avise o coordenador e atualize `app.md` e `backend.md`.

## Como rodar

Precisa de Node 20 ou mais novo.

```bash
cd engine
npm install
npm test                       # testes (vitest)
npm run typecheck              # checagem de tipos, como o compilador do C#
npm run sim -- --games 10000   # simulador
```

Opções do simulador: `--games`, `--seed`, `--bonus`, `--sick`, `--limit`, `--hp`, `--energy`, `--adv`, `--dis`, `--quiet 1` (só o resumo).

O simulador joga bot guloso contra bot guloso com baralhos aleatórios válidos e mostra a taxa de vitória por carta e a vantagem de quem começa.

## Convenções

- Toda regra nova vem com teste.
- Nunca use `Math.random`, `Date.now` ou I/O dentro do motor; use o `Rng` com semente.
- Comentários em português; explique o "porquê" (o usuário vem de C#).
- Valor de regra novo entra em `Rules`, não como número solto no código.
