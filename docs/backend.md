# Backend (Supabase)

Pasta prevista: `supabase/` (ainda não existe). Dono: thread de backend. Começa na fase 2.

## Estado atual

Nada criado. A stack está decidida (Supabase); o restante é **proposta** até a thread de backend confirmar com o usuário.

## Decidido

- Supabase: banco Postgres, login, armazenamento de fotos, tempo real e Edge Functions.
- **Todo RNG no servidor**: semente das cartas, atributos, raridade e sorteios das partidas.
- O servidor executa o mesmo motor de `engine/` nas Edge Functions (TypeScript). O cliente nunca decide resultado.
- Anti-fraude no início: confiar nos usuários (teste só com amigos próximos). Escopo de protótipo, não de produção.
- Limite diário de fotos validado pelo servidor: 14 nos testes, 3 no jogo final.

## Fases do backend

| Fase | Entrega |
| --- | --- |
| 2 | Login anônimo, tabela de cartas, função que cria a carta (semente + raridade + atributos), hash perceptual, limite diário |
| 3 | Login Google/e-mail (Apple quando houver iOS), coleção e baralhos na nuvem, migração de conta anônima |
| 4 | Partidas: convite por código, turnos resolvidos no servidor, tempo real para os dois jogadores, tempo limite por turno, reconexão |

## Proposta de dados (rascunho, não é decisão)

- `profiles`: usuário, data de nascimento/confirmação 18+.
- `cards`: dono, foto (caminho no storage), categoria, elemento, raridade, ataque, vida, semente, hash perceptual, criada em.
- `decks` e `deck_cards`: baralhos de 7.
- `matches` e `match_actions`: estado serializado do motor + ações aplicadas (permite repetir a partida pela semente).
- `daily_photo_quota` (ou contagem derivada de `cards`): fotos por dia.

## Segurança

- Row Level Security ligado em todas as tabelas; o cliente só lê o que é dele (e, em partida, as cartas do adversário que precisam ser mostradas).
- Escrita em `cards` e `matches` só por funções do servidor, nunca direto pelo cliente.
- Chaves de serviço só em segredos das Edge Functions; nunca no app nem neste repositório.

## Limitações do plano grátis a lembrar

- O projeto grátis do Supabase **pausa após 1 semana sem uso**; avise o usuário se algo "parou de funcionar" depois de um tempo parado.
- Orçamento do projeto é zero; antes de qualquer serviço pago, perguntar.

## Convenções

- Mudanças de esquema como migrações versionadas em `supabase/migrations/`.
- Documente aqui cada função exposta ao app (nome, entrada, saída, erros): esse é o contrato app ↔ servidor.
