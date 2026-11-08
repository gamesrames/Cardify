# Cardify — instruções para agentes

Jogo de cartas para celular (Android primeiro, iPhone depois) em que fotos tiradas no app viram cartas colecionáveis. Decks de 7 cartas, combate por turnos com elementos, partidas contra bot e 1x1 por convite. Todo o RNG (cartas e partidas) fica no servidor.

## Antes de qualquer coisa

1. Leia `docs/README.md` (índice e regras de como usar os docs).
2. Leia os docs da **sua área** (a tabela em `docs/README.md` diz quais). Não precisa ler os outros.
3. Ao terminar, atualize os docs que mudaram e acrescente uma linha em `docs/decisoes.md` se uma decisão mudou.

## Regras fixas

- **Idioma:** responda e escreva docs, comentários de código e mensagens de commit em português (pt-BR). Nomes de código (variáveis, funções) podem ficar em inglês ou português, seguindo o que o arquivo já usa.
- **Quem é o usuário:** expert em C#, aprendendo TypeScript. Quando fizer sentido, explique conceitos de TS/JS comparando com C#. Dispositivos de teste: iPhone 14 Pro Max e um Android Poco. Sem Mac. Orçamento zero.
- **Entregas:** arquivos completos (não trechos soltos), dizendo onde ficam e como testar no celular. Feedback direto, sem rodeios.
- **Pergunte antes de decidir arquitetura** que não esteja nos docs; ofereça 2 ou 3 opções com prós e contras e uma recomendação.
- **Não reabra decisões** registradas em `docs/decisoes.md` sem motivo novo.
- **Pasta própria por área:** só mexa na pasta da sua área (veja `docs/agentes.md`). Se precisar mudar o contrato de outra área, descreva a mudança no PR e avise o coordenador.
- **Push e PR só com confirmação do usuário.** Um PR por assunto.
- **Modelo:** threads de trabalho usam Sonnet (`claude-sonnet-5-5`) com esforço alto; só o coordenador usa Opus.

## Mapa do repositório

| Pasta | O que é | Estado |
| --- | --- | --- |
| `docs/` | Contexto por área (leia antes de trabalhar) | existe |
| `engine/` | Motor de combate em TypeScript puro, testes e simulador | no `main` (PR #1) |
| `app/` | App Expo (React Native) | ainda não criada |
| `supabase/` | Migrações, políticas e Edge Functions (`npm test` dentro da pasta) | fase 2 em andamento (sem projeto Supabase ainda) |

## Comandos úteis

O motor: `cd engine && npm install && npm test && npm run typecheck && npm run sim -- --games 10000`.
