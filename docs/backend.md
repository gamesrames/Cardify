# Backend (Supabase)

Pasta: `supabase/`. Dono: thread de backend. Fase 2 concluída; fase 3 (contas e nuvem) em andamento.

## Estado atual

Escrito e testado no computador e **publicado no projeto Supabase `cardify`** (plano grátis, região São Paulo, criado em 2026-11-08): as duas migrações estão aplicadas e a função `create-card` está no ar com o classificador **manual** (`CLASSIFIER` não definido; nenhum segredo do Gemini salvo). **Ainda não foi chamada por HTTP** (o ambiente de desenvolvimento não alcança `supabase.co`) e o login anônimo precisa ser ligado pelo usuário no painel. Existem: migrações (`categories`, `app_config`, `cards`, funções `photo_check` e `insert_card`, bucket `card-photos`), a Edge Function `create-card` e 39 testes (Vitest; o banco dos testes é o PGlite, um Postgres em memória que roda a migração de verdade). 

**Fase 3 (escrita e testada no computador, ainda sem PR):** migração `20261109000001_perfis_e_baralhos.sql` com `profiles` e `decks` (RLS por dono, 14 testes pelos papéis `authenticated` e `anon` em `test/contas.test.ts`). **A migração ainda não foi aplicada no projeto real** (a aplicação pelo MCP foi negada; veja "Como publicar a fase 3"). Não existem ainda: partidas (fase 4).

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
- Rascunho para a fase 4 (não é decisão): `matches`/`match_actions`.

## Dados da fase 3 (implementado em `supabase/migrations/20261109000001_perfis_e_baralhos.sql`)

- **O id do jogador é o id do login** (`auth.users.id`). Quando o convidado (login anônimo) cria a conta, o Supabase **mantém o mesmo id**: cartas, baralho e perfil continuam dele, sem migração. Quem entra numa conta que já existia deixa o convidado para trás (as cartas do convidado não são fundidas; a tela avisa).
- `profiles(id, display_name, created_at, updated_at)`: criado por trigger em cada login novo (e para quem já existia). O cliente lê o próprio e edita só `display_name` (2 a 20 letras; `grant update (display_name)`). Na fase 4 uma policy nova deixa o adversário ler o nome durante a partida.
- `decks(id, owner_id, name, card_ids text[], ...)`, `unique (owner_id, name)`: o app usa um baralho chamado "Meu baralho" (o esquema aceita vários). `card_ids` mistura ids de cartas fixas (texto do motor) e de foto (uuid). O dono faz CRUD só nos próprios (RLS). **O banco não valida se o baralho é legal** (7 cartas, teto de poder, posse das cartas): isso é do motor, no servidor, ao iniciar a partida (fase 4). Só há um limite de higiene de 20 ids.
- Reforço nas tabelas da fase 2: tirada a permissão de escrita de `anon` e `authenticated` em `cards` e `categories`, e todo acesso a `app_config` (além da RLS).
- Login: **e-mail + código de 6 dígitos** (sem senha, sem link) e convidado por login anônimo. Decisão e alternativas em `decisoes.md`.

## Como publicar a fase 3 (passos do usuário no painel; o que for SQL pode ser aplicado por nós)

1. **SMTP próprio** (Authentication → Emails → SMTP Settings). O e-mail embutido do Supabase só envia para membros da organização, então os amigos não receberiam o código. Opção grátis: Brevo (300 e-mails/dia). A senha do SMTP fica só no painel, nunca no repositório nem em mensagens.
2. **Modelos de e-mail** (Authentication → Emails → Templates): em **Magic Link** e em **Change Email Address**, troque o link pelo código: `<h2>Seu código do Cardify</h2><p>Digite no app: <b>{{ .Token }}</b></p>`.
3. Aplicar a migração `20261109000001_perfis_e_baralhos.sql` (SQL Editor do painel, ou pedir para a thread aplicar pelo MCP depois de liberar).
4. Conferir **Allow anonymous sign-ins** ligado (já estava, da fase 2).

## Contrato da função `create-card` (app ↔ servidor)

`POST /functions/v1/create-card`, cabeçalho `Authorization: Bearer <token do login anônimo>`.

Entrada (JSON): `{ "photo": "<JPEG ou PNG em base64, até 4 MB>", "mime": "image/jpeg", "category": "<slug>" }`. `category` só vale com o classificador manual; com Gemini é ignorado.

Saída `201`: `{ "card": { id, name, category, element, rarity, attack, health, bonusPoints, photoPath, createdAt } }`.

Erros: `401 unauthorized`, `400 invalid_request`, `429 quota_exceeded`, `409 duplicate_photo`, `422 category_not_recognized`, `502 classifier_unavailable`, `500 internal`. Corpo: `{ "error": "<código>", "message": "<texto em português>" }`.

## Como rodar e testar (no computador)

```bash
cd supabase
npm install
npm test            # 39 testes, ~25 s (cada teste sobe um Postgres em memória)
npm run typecheck
npm run build       # gera functions/create-card/index.ts (commitar o resultado)
```

`functions/create-card/index.ts` é **gerado**: o esbuild junta o código e o motor num arquivo só, porque o Deno das Edge Functions exige extensão nos imports e o motor não usa. Edite `src/`, nunca o gerado. O bundle foi publicado, mas ainda **não foi chamado de verdade** (não há Deno neste ambiente): a primeira chamada pelo app ou por `curl` confirma que ele roda.

## Como publicar

O projeto já existe (URL e chave pública ficam no painel do Supabase, em Project Settings → API; não coloque nos docs). Passos, feitos na primeira publicação e para repetir ao mudar `src/`:
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
