# Visão geral

## Estado atual

**Fase 5 (progressão e ranking) em andamento (2026-11-11):** regras, simulação e SQL prontos e testados no computador; telas do app e aplicação no Supabase pendentes (`progressao.md`).

Fases 1 e 2 no `main` (motor, app Expo, foto vira carta, "Meu baralho"). **Fase 3 (contas e nuvem) pronta no navegador** (2026-11-09): conta criada a partir do convidado mantendo as cartas, baralho na nuvem, entrar de novo e em aba anônima mostram a mesma coleção. **Celular físico ainda pendente** (fases 1 a 3) e o login por apelido + senha é provisório. **Fase 4 (PvP online por convite) em andamento:** servidor e telas do app escritos e testados no computador (navegador contra o handler e o banco reais), ainda não publicados no Supabase nem testados em celular (`partidas-online.md`). Critério de pronto da fase 3 na tabela abaixo (detalhado em `backend.md`).

## O produto

Jogo de cartas para celular. O jogador tira fotos com a câmera do app e cada foto vira uma carta colecionável (elemento, raridade, ataque, vida). Monta baralhos de 7 cartas e luta contra um bot ou contra amigos 1x1 por convite. Todo o sorteio (atributos das cartas e resultado das partidas) acontece no servidor.

- Público 18+. Sem monetização. Sem troca de cartas.
- Protótipo para amigos próximos; Android primeiro, iPhone para testes quando a stack permitir.
- Fotos são visíveis para o adversário. Sem restrição de conteúdo no protótipo (isso muda antes de qualquer lançamento aberto; ver `geracao-cartas.md`).
- Limite de fotos por dia: 14 durante os testes, 3 no jogo final.

## Stack (decidida em 2026-11-08)

Expo (React Native, TypeScript) no app e Supabase no servidor (banco, login, armazenamento de fotos, tempo real, Edge Functions). O motor de combate é TypeScript puro e roda nos dois lados, escrito uma vez só.

Alternativas consideradas e descartadas por ora: Unity (C#) e Flutter + Firebase. Motivos em `decisoes.md`.

## Fases e critério de "pronto"

Cada fase só começa quando a anterior passa no critério. A fase 1 existe para responder uma pergunta: o combate é divertido?

| Fase | O que entra | Pronta quando |
| --- | --- | --- |
| 1. Protótipo offline | 20 a 30 cartas fixas, elementos com vantagem, energia por raridade, baralho de 7, bot local, motor como função pura que recebe a semente, simulador de milhares de partidas | O usuário joga uma partida inteira contra o bot no Android; o simulador roda 10 mil partidas e nenhuma carta passa de 60% de vitória nos baralhos em que aparece |
| 2. Câmera e geração de cartas | Câmera do app, remoção do EXIF no celular, classificação da foto no celular (categoria, elemento, bônus), servidor cria a carta (semente, raridade, atributos), hash perceptual, limite diário, login anônimo | Foto vira carta em menos de 10 segundos; a mesma foto tirada duas vezes é recusada; a 15ª foto do dia é bloqueada pelo servidor |
| 3. Contas e coleção na nuvem | Login (Google, e-mail; Apple quando houver iOS), coleção e baralhos no servidor, troca de celular sem perder cartas | Desinstalar o app, entrar em outro celular e ver a mesma coleção e baralhos |
| 4. PvP online | Partida contra IA no servidor, convite 1x1 por código, turnos resolvidos no servidor e enviados aos dois em tempo real, tempo limite por turno, reconexão | Dois celulares jogam uma partida inteira; fechar o app e voltar retoma a partida; o cliente não consegue mudar nenhum resultado |
| 5. Progressão e polimento | XP, moedas, melhoria de cartas com teto, ranking, matchmaking, animações e sons | A definir quando chegarmos lá |

Fica para depois (fora do escopo da fase indicada): fase 1 sem servidor, contas, fotos e animações caprichadas; fase 2 sem nomes gerados por IA e sem moderação; fase 3 sem perfil público e amigos; fase 4 sem matchmaking e espectador; fase 5 sem eventos e temporadas.

## Trabalho com o usuário

Veja as regras de trabalho em `CLAUDE.md` (idioma, entregas, perguntar antes de decidir arquitetura).
