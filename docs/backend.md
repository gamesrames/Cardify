# Backend (Supabase)

Pasta: `supabase/`. Dono: thread de backend. Fase 2 em andamento.

## Estado atual

Escrito e testado no computador, **ainda não aplicado num projeto Supabase real** (falta o usuário criar o projeto). Existem: migrações (`categories`, `app_config`, `cards`, funções `photo_check` e `insert_card`, bucket `card-photos`), a Edge Function `create-card` e 38 testes (Vitest; o banco dos testes é o PGlite, um Postgres em memória que roda a migração de verdade). Não existem ainda: `profiles`, decks, partidas (fases 3 e 4).

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

## Dados da fase 2 (implementado em `supabase/migrations/`)

- `categories`: `slug`, `nome`, `element`, `bonus_pct` (0 a 10), `ativa`. 25 categorias iniciais.
- `app_config`: `daily_photo_limit` (14 nos testes; 3 no jogo final) e `duplicate_max_distance` (10). Mudam com um `UPDATE`, sem deploy.
- `cards`: dono, nome, `photo_path`, `photo_hash bit(64)`, categoria, elemento, raridade, ataque, vida, `seed`, `bonus_points`, data. O cliente só lê as próprias.
- `photo_check(usuário, hash)` → `ok` | `quota_exceeded` | `duplicate`. Cota = cartas do dia em São Paulo.
- `insert_card(...)`: lock por usuário, refaz `photo_check` e insere. Só a chave de serviço executa (revogado de `anon` e `authenticated`).
- Rascunho para as próximas fases (não é decisão): `profiles`, `decks`/`deck_cards`, `matches`/`match_actions`.

## Contrato da função `create-card` (app ↔ servidor)

`POST /functions/v1/create-card`, cabeçalho `Authorization: Bearer <token do login anônimo>`.

Entrada (JSON): `{ "photo": "<JPEG ou PNG em base64, até 4 MB>", "mime": "image/jpeg", "category": "<slug>" }`. `category` só vale com o classificador manual; com Gemini é ignorado.

Saída `201`: `{ "card": { id, name, category, element, rarity, attack, health, bonusPoints, photoPath, createdAt } }`.

Erros: `401 unauthorized`, `400 invalid_request`, `429 quota_exceeded`, `409 duplicate_photo`, `422 category_not_recognized`, `502 classifier_unavailable`, `500 internal`. Corpo: `{ "error": "<código>", "message": "<texto em português>" }`.

## Como rodar e testar (no computador)

```bash
cd supabase
npm install
npm test            # 38 testes, ~25 s (cada teste sobe um Postgres em memória)
npm run typecheck
npm run build       # gera functions/create-card/index.ts (commitar o resultado)
```

`functions/create-card/index.ts` é **gerado**: o esbuild junta o código e o motor num arquivo só, porque o Deno das Edge Functions exige extensão nos imports e o motor não usa. Edite `src/`, nunca o gerado. O bundle ainda **não foi executado no Deno** (não há Deno neste ambiente); a primeira publicação precisa conferir isso.

## Como publicar (quando o projeto Supabase existir)

Passos, a confirmar na primeira vez com o usuário:
1. Criar o projeto grátis em supabase.com e ligar **Authentication → Sign In / Providers → Allow anonymous sign-ins**.
2. Aplicar as duas migrações de `supabase/migrations/`.
3. Segredos da função (o usuário salva a chave, nós nunca a vemos): `CLASSIFIER=gemini`, `GEMINI_API_KEY=...`, opcional `GEMINI_MODEL`. Sem `CLASSIFIER`, a função usa o classificador manual.
4. Publicar `functions/create-card/index.ts` como função `create-card` (com verificação de JWT ligada).

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
