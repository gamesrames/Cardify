# Partidas online 1x1 por convite (fase 4)

Pasta do servidor: `supabase/` (`src/match/`, migração `20261109000002_partidas_online.sql`). Visão por jogador: `engine/src/view.ts`. Leia também `backend.md` (visão geral do servidor) e a API do motor em `engine.md`.

## Estado atual

**Servidor escrito e testado no computador** (banco real em memória, motor real), **ainda não publicado** no projeto Supabase: depende de o usuário colar a migração e a função no painel (roteiro abaixo). Telas do app: PR seguinte.

## Critério de pronto da fase 4

1. Um jogador cria a partida e recebe um código de 6 caracteres; o outro digita o código e entra; os dois jogam uma partida inteira.
2. Cada jogador vê só a própria mão. A mão e o monte do adversário não passam pelo banco nem pelo Realtime. As fotos das cartas do adversário aparecem quando ele as joga.
3. O servidor valida cada jogada com o motor. O app só pede a ação e mostra o resultado.
4. Fechar o app e voltar (ou recarregar a página) retoma a partida.
5. Estouro do tempo de turno, desistência e sumiço terminam pelo mesmo desfecho `forfeit` do motor.
6. Tudo no plano grátis do Supabase. Um teste automatizado mostra que um jogador não lê a mão do outro.

## Como funciona

```
app ──(POST op: create | join | play | end | forfeit | timeout | cancel)──▶ Edge Function `match`
                                                                              │ motor (applyAction), semente sorteada aqui
                                                                              ▼
                                              Postgres: matches (estado completo, SEGREDO) + match_views (1 linha por jogador)
app ◀──(Realtime: mudança na própria linha de match_views; consulta periódica como reserva)
```

- **`matches`**: estado completo (`GameState` com mãos, ordem dos montes e `rngState`), todos os eventos, versão, prazo do turno, estouros seguidos por lado. **Sem grant e sem policy**: nem `select` o cliente consegue; só a chave de serviço da função.
- **`match_views`**: uma linha por jogador com a visão dele (`viewFor` do motor: a própria mão, só a *quantidade* de cartas da mão do outro, campo e descartes à vista, `legal` = jogadas que o motor permite agora). O jogador lê só a própria linha (RLS `player_id = auth.uid()`); a tabela está na publicação `supabase_realtime`, então o app é avisado quando a linha muda. O Realtime respeita a RLS, e a tela não depende só dele: busca a linha de novo de tempos em tempos e ao voltar para o app.
- **Criador = lado 0 do motor, quem entra = lado 1.** Quem *começa* é sorteado pelo motor com a semente do servidor (`createGame`). O cliente nunca vê nem escolhe a semente.
- **Convite:** código de 6 caracteres sem `0/O/1/I` (ex.: `K7M2QX`), vale 15 minutos (`app_config.invite_minutes`). O servidor lê o baralho "Meu baralho" salvo na nuvem de cada jogador, confere que as cartas de foto são dele e valida pelo motor (`validateDeck`: 7 cartas, teto de poder 110). O app não manda baralho nenhum. Um jogador só tem **uma partida em aberto**; criar um convite novo cancela o antigo; quem já está jogando recebe `already_in_match` com o `matchId` para retomar.
- **Versão:** cada ação traz a `version` que a tela viu; se outra ação passou na frente (duplo toque, tela velha), o servidor responde `409 stale_state`. Desistir e pedir `timeout` não exigem versão.
- **Fotos do adversário:** a visão de cada jogador traz `photos` (id da carta → caminho) das *próprias* cartas e das do adversário que já foram jogadas (em campo ou mortas). Os caminhos das cartas do adversário também ficam em `match_views.photo_paths`, e uma policy de `storage.objects` deixa o jogador ler exatamente essas fotos (o resto do bucket continua privado). Cartas ainda na mão ou no monte dele não entram. O app pede URLs assinadas como já faz na coleção.
- **Nome do adversário** vem dentro da visão (`foeName`); a policy nova em `profiles` prevista na fase 3 **não foi necessária**.

## Tempo do turno e quedas

Valores em `app_config` (mudam com `UPDATE`, sem republicar): `turn_seconds = 60`, `max_missed_turns = 2`, `abandon_seconds = 300`, `invite_minutes = 15`.

- Cada turno tem um prazo (`deadlineMs` na visão). **Jogar uma carta não reinicia o relógio**; só passar o turno abre o prazo do próximo jogador.
- O servidor não tem relógio rodando sozinho (plano grátis, sem processo fixo). Quem aplica o estouro é o pedido `timeout`, que **qualquer um dos dois jogadores** pode mandar e que o servidor confere contra o relógio dele (`409 not_expired` se ainda não venceu). O app do jogador que está *esperando* manda o pedido ao ver o prazo vencer, e o app de quem volta a uma partida parada também.
- **1º estouro:** o turno passa sozinho (como "encerrar turno"). **2 estouros seguidos do mesmo jogador** (`max_missed_turns`): ele perde por tempo, com o desfecho `forfeit` do motor (`endCause: 'timeout'`). Qualquer ação do jogador (jogar ou encerrar) zera a contagem dele.
- **Sumiu:** turno vencido há mais de `abandon_seconds` quando alguém pede o `timeout` = derrota por abandono (`endCause: 'abandoned'`), sem esperar o segundo estouro.
- **Desconexão não é detectada à parte:** quem cai simplesmente deixa o prazo vencer e cai nas regras acima. Voltar antes disso e jogar normalmente retoma a partida.
- Jogador que age *depois* do prazo mas *antes* de alguém pedir o `timeout` tem a jogada aceita (tolerância; é protótipo com amigos).
- Partidas em que os dois somem ficam `active` no banco até alguém abri-las. Limpeza automática (pg_cron) fica para a fase 5.

## Contrato da função `match` (app ↔ servidor)

`POST /functions/v1/match`, cabeçalho `Authorization: Bearer <token do login>`, corpo JSON com `op`:

| `op` | Corpo | O que faz |
| --- | --- | --- |
| `create` | — | Cria o convite com o baralho salvo na nuvem. Devolve `{ matchId, view: { kind: 'waiting', code, ... } }`. |
| `join` | `code` | Entra no convite (aceita minúsculas e espaços), sorteia a partida e devolve a visão do jogador. |
| `play` | `matchId, version, handIndex, slot` | Joga uma carta da mão numa posição (só o jogador da vez). |
| `end` | `matchId, version` | Encerra o turno (resolve os ataques, passa a vez, abre o prazo do próximo). |
| `forfeit` | `matchId` | Desiste, a qualquer momento (até fora da vez). Motor: `forfeit`. |
| `timeout` | `matchId` | Pede ao servidor para aplicar o estouro do turno (regras acima). |
| `cancel` | `matchId` | O criador desiste do convite antes de alguém entrar. |

Sucesso `200`: `{ matchId, view }` com a **visão nova de quem chamou** (o adversário recebe a dele pelo Realtime); `view` é `null` em `cancel`. Os tipos estão em `supabase/src/match/types.ts` (o app importa só esse arquivo). Erros: `{ "error": "<código>", "message": "<texto em português>" }`:

`401 unauthorized`, `400 invalid_request`, `400 invalid_code`, `404 code_not_found` (inexistente, já usado ou vencido), `409 own_match`, `409 already_in_match` (traz `matchId`), `422 deck_missing`, `422 deck_invalid`, `404 match_not_found` (também para quem não joga a partida), `409 match_finished`, `409 not_your_turn`, `409 stale_state`, `422 illegal_action`, `409 not_expired` (traz `remainingMs`), `409 not_waiting`, `500 internal`.

O app **lê** as visões direto da tabela (`match_views`, só a própria linha, por `match_id` ou a mais recente com `status in ('waiting','active')` para retomar). Só escrever passa pela função.

## Como publicar (passos do usuário no painel do Supabase)

Nenhum destes passos pode ser feito pelas threads (o ambiente delas não alcança o projeto para escrever).

1. **Aplicar a migração:** painel → **SQL Editor** → **New query** → colar o conteúdo inteiro de `supabase/migrations/20261109000002_partidas_online.sql` → **Run**. Esperado: "Success. No rows returned". Conferir em **Table Editor** que existem `matches` e `match_views`, e em **Database → Publications** (`supabase_realtime`) que `match_views` está ligada.
2. **Publicar a função:** **Edge Functions** → **Deploy a new function** → **Via Editor** → nome **`match`** (exatamente) → apagar o exemplo e colar o conteúdo inteiro de `supabase/functions/match/index.ts` → **Deploy function** (10 a 30 s). Deixar **Verify JWT** ligado (padrão). Não precisa de segredo novo: `SUPABASE_URL` e a chave de serviço já são fornecidas à função pelo Supabase.
3. Para republicar depois de mudar `supabase/src/`: `cd supabase`, `npm.cmd run build`, e colar de novo o `functions/match/index.ts` no mesmo editor. A migração só se aplica uma vez.

## Como testar

- Computador: `cd supabase && npm.cmd test` (inclui `test/match.test.ts`, `test/partidas.test.ts`) e `cd engine && npm.cmd test` (`test/view.test.ts`).
- Cobertura que importa: o jogador não lê `matches` nem a linha do adversário; nenhuma carta do outro baralho aparece na visão antes de ser jogada; a foto do adversário só vira legível depois que a carta é jogada; ação fora da vez, versão velha e jogada duplicada são recusadas; partida inteira até o fim; desistir fora da vez; estouros de tempo.
- 1x1 sozinho (depois das telas do app): um navegador normal com uma conta e uma **aba anônima** (ou outro navegador) com outra conta.

## Limites conhecidos

- Anti-fraude leve, de protótipo: o servidor é a autoridade do estado, mas não há detecção de contas múltiplas nem de conluio.
- Sem revanche, sem espectador, sem matchmaking e sem limpeza automática de partidas abandonadas (fase 5).
- A função `match` ainda não foi chamada num servidor real (o ambiente de desenvolvimento não alcança `supabase.co` e não há Deno): o primeiro uso real é o teste do usuário. O bundle foi carregado em Node com um Supabase falso para conferir que sobe sem erro.
