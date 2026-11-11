# Motor de combate e simulador

Pasta: `engine/`. Dono: thread de motor/balanceamento. Regras e fórmulas ficam em [`game-design.md`](game-design.md); este doc descreve o código.

## Estado atual

**Fase 5 (2026-11-11):** novo `src/progression.ts` (funções puras de melhoria de carta, Elo e recompensas: `checkUpgrade`, `applyUpgrade`, `upgradeCost`, `ratingDelta`, `settleMatch`, `DEFAULT_PROGRESSION`), 17 testes em `test/progression.test.ts` e o simulador `npm run sim:upgrades`. Só acréscimo ao contrato; o combate não mudou. Regras em `game-design.md`, resumo em `progressao.md`.

Motor no `main` desde o **PR #1**: 30 cartas, validação de baralho, 5 baralhos prontos, bot guloso, bot aleatório, simulador e 18 testes (vitest). Balanceamento da primeira rodada já incluído: orçamento da épica em 27 e ataque/vida de 9 cartas redistribuídos (detalhes em `game-design.md`). O segundo jogador recebe +2 de energia no primeiro turno (`secondPlayerBonusEnergy`).

**Bônus de foto e melhorias na validação:** `validateDeck` não compara mais o poder da carta com o orçamento da raridade, e sim com o **teto da carta** = orçamento + bônus de foto (10%, mínimo +1) + melhoria (25%), calculado por `maxCardPower(rarity, rules)` (`photoBonusCap` e `upgradeCap` dão as partes). Isso deixa cartas com bônus de categoria, e depois melhoradas, entrarem no baralho. O limite de 110 do baralho continua contando o poder real de cada carta (`deckPower`). As frações ficam em `Rules` (`photoBonusRatio`, `upgradeRatio`).

**Desistência (2026-11-09):** nova ação `{ type: 'forfeit', player }`. Termina a partida na hora com o adversário como vencedor. Vale a qualquer momento e para qualquer jogador (inclusive fora da vez, que é o caso do 1x1 online), por isso carrega o `player` e **não** aparece em `legalActions` (que lista só as ações do jogador ativo); `applyAction` a trata antes da checagem de legalidade e lança erro se a partida já terminou. O estado ganhou `endReason` (`'hp_zero' | 'turn_limit' | 'forfeit' | null`) e o evento `game_over` ganhou `reason`. 8 testes novos (26 no total).

**Visão por jogador (fase 4, 2026-11-09):** `engine/src/view.ts`, só acréscimo (nada do contrato anterior mudou). `viewFor(state, seat)` devolve o `PlayerView` do jogador: a própria mão, só a *quantidade* de cartas da mão e do monte do adversário, campos e descartes (que são públicos), `energy`, `winner`, `endReason` e `legal` (as ações do motor permitidas a ele agora; vazio fora da vez). Não inclui a ordem dos montes nem `rngState` (que permitiria prever compras). `redactEvents(events, seat)` tira dos eventos as compras do adversário. O servidor guarda o `GameState` completo e manda a cada jogador só isto. Testes em `test/view.test.ts` (nenhum id do outro baralho aparece na visão antes de ser jogado). Detalhes do uso em [`partidas-online.md`](partidas-online.md).

## Princípios

- **TypeScript puro**: sem tela, relógio, rede ou `Math.random`. Roda no celular (fase 1) e no servidor (fases 2 a 4) com o mesmo código.
- **Função pura**: `createGame` e `applyAction` recebem estado e devolvem **estado novo** (o antigo nunca muda). A mesma semente gera a mesma partida, então qualquer partida pode ser repetida e auditada.
- **Estado é JSON puro**: dá para trafegar entre app e servidor e salvar no banco sem conversão. O estado do gerador de números aleatórios faz parte do estado do jogo.
- **Todas as regras ajustáveis ficam em `Rules`** (`DEFAULT_RULES`), para o simulador variar.

## API (exportada por `engine/src/index.ts`)

| Função / tipo | O que faz |
| --- | --- |
| `createGame(deckA, deckB, seed, rules?)` | Valida os dois baralhos, embaralha com a semente, sorteia quem começa e devolve `{ state, events }`. Lança erro se o baralho for inválido. |
| `legalActions(state)` | Lista as ações permitidas ao jogador ativo: `{type:'play', handIndex, slot}` e `{type:'end'}`. Não inclui `forfeit` (veja abaixo). Vazia quando a partida terminou. |
| `applyAction(state, action)` | Aplica uma ação e devolve `{ state, events }`. Lança erro para ação ilegal. `end` resolve os ataques e passa o turno. `{type:'forfeit', player}` encerra a partida com vitória do outro jogador (`endReason: 'forfeit'`), a qualquer momento enquanto ela não terminou. |
| `validateDeck(deck, rules)` | Devolve a lista de problemas (vazia = válido): tamanho, repetidas, teto de poder por raridade (orçamento + bônus de foto + melhoria) e limite de poder do baralho. |
| `cardPower`, `deckPower`, `energyCostOf`, `damageAgainst`, `elementMultiplier`, `maxCardPower`, `photoBonusCap`, `upgradeCap` | Helpers de regra. |
| `greedyBot`, `makeRandomBot(rng)` | Bots. Cada chamada devolve **uma** ação; chame de novo até vir `{type:'end'}`. O guloso é determinístico. |
| `CARDS`, `PREBUILT_DECKS` | Cartas fixas da fase 1 e baralhos prontos. |
| `viewFor(state, seat)`, `redactEvents(events, seat)`, `PlayerView` | Visão de um jogador sem os segredos do adversário (fase 4; veja acima). |
| `GameEvent` | Eventos para o app animar/mostrar o log (`turn_start`, `draw`, `play`, `attack_creature`, `attack_player`, `creature_died`, `game_over` com `winner` e `reason`). |

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
