# Progressão e ranking (fase 5)

Dono: thread da fase 5 (toca `engine/`, `supabase/` e, depois, `app/`). Fórmulas e números ficam em [`game-design.md`](game-design.md), "Progressão e ranking"; este doc é o resumo da fase, o passo a passo do SQL e o roteiro de teste.

## Estado atual

**Pausado no meio (2026-11-11), retomado em seguida.** Pronto e testado no computador: regras do motor (`engine/src/progression.ts`, 17 testes), simulador (`npm run sim:upgrades`), migração `20261111000001_progressao_ranking.sql` e 12 testes dela contra o banco real em memória, cruzando o SQL com o motor. **Ainda não existe:** as telas do app (esperam o design visual entrar no `main`) e nada foi aplicado no Supabase de verdade. A migração é aditiva: o app e a função `match` atuais seguem funcionando sem ela e com ela.

## Escolhas padrão (a pessoa estava indisponível; reversíveis, aguardam revisão)

| Ponto em aberto | Escolha | Como mudar |
| --- | --- | --- |
| XP e moedas | **Um recurso só: Essência.** Sem nível de jogador. | Futuro: acrescentar coluna em `player_stats`. |
| De onde vem a Essência | Só de **partidas online 1x1** (o servidor as resolve). Partida contra o bot roda no celular e não paga nada. | Partida contra bot no servidor é trabalho à parte. |
| Quanto paga | Vitória 30, empate 20, derrota 10. Quem **desistiu, estourou o tempo ou sumiu** ganha 0. Partida com menos de 6 turnos não paga. | `app_config` (`reward_*`) com `UPDATE`. |
| O que melhora | **Só cartas de foto.** As 30 fixas são o conjunto grátis e seguem iguais. | — |
| Como melhora | Cada passo é **+1 vida** (1 ponto de poder) ou **+1 ataque** (2 pontos). Teto por carta: comum 2, incomum 3, rara 4, épica 6, lendária 7 pontos (os 25% já decididos). | Tabela `upgrade_rules`. |
| Custo | Por ponto de poder: comum 10, incomum 15, rara 20, épica 30, lendária 40 (ataque custa o dobro da vida). Custo fixo por passo. | Tabela `upgrade_rules`. |
| Melhoria entra no limite do baralho | Sim (poder real conta nos 110). Melhorar uma carta do baralho pode deixá-lo inválido; o servidor avisa ao criar a partida. | — |
| Ranking | **Elo**, começa em 1000, K = 32, soma zero, piso 0. Só partidas online. Desistir/estourar tempo/sumir = derrota normal. Empate conta 0,5. | `app_config` (`elo_k`, `rating_floor`). |
| Quem aparece | Só quem jogou ao menos uma partida pontuada; lista pública com apelido, rating e vitórias/derrotas/empates (top 50 + a própria linha). | Função `leaderboard`. |
| Anti-farm leve | O mesmo par de jogadores só pontua **10 partidas por dia** (3 no jogo final); depois é amistosa (nada muda). | `rated_pair_daily` em `app_config`. |
| Fora desta fase | Temporadas, matchmaking, nível de jogador, desfazer melhoria, melhoria das cartas fixas. | — |

## Achado da simulação (decisão pendente da pessoa)

`npm run sim:upgrades` (4000 partidas por linha, bot guloso): um baralho melhorado até o limite de 110 (cerca de +9 de poder, gastando ~150 Essência) ganha **~68% a 70%** de um baralho sem melhoria (poder ~100), e **~69% de um baralho sem melhoria já com poder 108+**. Entre dois baralhos melhorados fica em ~50%, e o controle sem melhoria em ~50%. Causa: poder por **raridade** custa energia (cartas caras), poder por **melhoria** não custa. Efeito: cada ponto de poder vale uns 2 pontos de vitória. É progressão sentida, mas o ranking vai medir muito "quem melhorou mais". Opções se for forte demais: (a) baixar `upgradeRatio` de 25% (muda o teto e o `validateDeck`; republicar `match`), (b) custo crescente por passo, (c) aceitar. Não mudei nada: os 25% são decisão da pessoa.

## Como funciona

- **Fim de partida:** um *trigger* em `matches` (quando o status vira `finished`) grava uma linha em `match_results` e atualiza `player_stats` dos dois jogadores na mesma transação. **Não exige republicar a função `match`.** Se a pontuação falhar por qualquer motivo, ela é desfeita e a partida termina normalmente (aviso no log do banco).
- **Melhorar carta:** função SQL `upgrade_card(carta, 'attack' | 'health')`, chamada pelo app com o login do jogador (`supabase.rpc`). Confere dono, teto e saldo; erros: `unauthorized`, `invalid_stat`, `card_not_found`, `upgrade_cap`, `not_enough_essence`. As colunas `attack`/`health` da carta já incluem as melhorias (a partida online e o "Meu baralho" leem os mesmos campos de antes); `upgrade_attack`/`upgrade_health` contam os passos.
- **Leitura pelo app:** `player_stats` (próprio saldo e rating), `match_results` (resultado de uma partida, ex.: tela de fim), `leaderboard(limite)` e `my_match_history(limite)`.
- **Regras em dois lugares:** o motor (`progression.ts`) é a referência e o que o app usa para *mostrar* custos; o SQL é quem decide. `supabase/test/progressao.test.ts` roda uma grade de casos (ratings, resultados, causas, turnos, raridades) e exige o mesmo resultado nos dois.

## Como publicar (passo do usuário, ~2 minutos)

Só há **uma migração**; nenhuma função nova nem republicação.

1. Abra o painel do Supabase do projeto `cardify` → menu da esquerda **SQL Editor** → **New query**.
2. Abra o arquivo `supabase/migrations/20261111000001_progressao_ranking.sql` no repositório (GitHub → botão **Raw** → selecionar tudo e copiar), cole no editor e clique **Run**.
3. Esperado: "Success. No rows returned". Conferir em **Table Editor**: existem `player_stats`, `match_results` e `upgrade_rules` (5 linhas), e `cards` ganhou as colunas `upgrade_attack` e `upgrade_health`.
4. Rodar a migração duas vezes dá erro ("already exists"): é normal, ela se aplica uma vez.

## Roteiro de teste

**Já dá para testar (só o servidor, sem telas novas):**
1. Aplique a migração (acima).
2. Faça uma partida online 1x1 inteira (dois navegadores, um deles em aba anônima, como em `partidas-online.md`).
3. Table Editor → `player_stats`: os dois jogadores aparecem; o vencedor com rating 1016 e 30 de `essence`, o perdedor com 984 e 10 (se a partida teve 6 turnos ou mais). `match_results` tem uma linha da partida.
4. Desista no primeiro turno de outra partida: o rating mexe (±16), a Essência não.

**Depois que as telas existirem (a escrever com o app):** ver a Essência e o rating, melhorar uma carta de foto (+vida / +ataque), tentar passar do teto e sem saldo, abrir o ranking e o histórico, e ver o ganho na tela de fim de partida; repetir no celular.

## O que ficou sem verificar

- Nada foi aplicado no Supabase real (o ambiente das threads não alcança o projeto): o SQL foi testado num Postgres em memória (PGlite) com as migrações das fases 2 a 5.
- `leaderboard` e `my_match_history` chamadas pela API do Supabase (PostgREST) com o login de verdade; telas e celular.
