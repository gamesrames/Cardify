# Divisão de trabalho entre agentes

## Estado atual

Threads ativas: motor/balanceamento (PR #1 aberto) e esta, de documentação. As demais áreas só começam quando fizer sentido (tabela abaixo).

## Regras gerais

- **Coordenador** (Opus): conversa com o usuário no chat do projeto, decide a divisão, escreve o prompt de cada thread e abre threads novas. É o único que fala no chat do projeto.
- **Threads de trabalho** (Sonnet `claude-sonnet-5-5`, esforço alto): cada uma cuida de uma área, em uma pasta e um conjunto de docs próprios.
- Cada thread trabalha em **uma branch e um PR por assunto**, lê os docs da sua área antes de começar e os atualiza no mesmo PR.
- Nenhuma thread dá push nem abre PR sem confirmação do usuário.
- Threads não editam a pasta de outra área. Precisa de uma mudança lá? Descreva no PR e avise o coordenador, que repassa para a thread dona.

## Áreas e donos

| Área | Pasta | Docs | Quando começa | O que entrega |
| --- | --- | --- | --- | --- |
| Motor e balanceamento | `engine/` | `game-design.md`, `engine.md` | Já em andamento | Regras em código, cartas fixas, bots, simulador, ajuste das fórmulas |
| App Expo | `app/` | `app.md` | Quando o PR #1 entrar e as regras da fase 1 estabilizarem | Telas da fase 1: coleção fixa, montar baralho, partida contra o bot, testável no celular |
| Backend Supabase | `supabase/` | `backend.md` | Início da fase 2 | Banco, políticas de acesso, login anônimo, Edge Functions que rodam o motor |
| Geração de cartas e moderação | `supabase/` (funções) e `app/` (câmera) | `geracao-cartas.md` | Início da fase 2, junto com o backend | Da foto à carta: EXIF, classificação, hash, atributos, limite diário |
| Revisão de código | — (só lê) | os da área revisada | A cada PR relevante | Comentários sobre bugs, regras quebradas e divergência dos docs |

Observações:

- Em fase 1, só **motor** e **app** trabalham em paralelo. Backend e geração de cartas esperam o critério de "pronto" da fase 1.
- Em fase 2, backend e geração de cartas podem ser uma thread só no começo (compartilham a pasta `supabase/`); separe se o volume crescer.
- Fronteira motor ↔ app/servidor: o contrato é a API exportada por `engine/src/index.ts` e os tipos de `engine/src/types.ts`. Mudou o contrato? Avise todos os donos afetados antes de mesclar.
- Fronteira app ↔ servidor (fase 2+): o contrato são as funções do servidor e as tabelas descritas em `backend.md`. A thread de backend é a dona desse contrato.

## Modelo de prompt para abrir uma thread nova

O coordenador pode usar este roteiro:

1. Área e objetivo em uma frase, mais o critério de "pronto" da entrega.
2. Quais docs ler (a coluna "Docs" acima) e qual pasta é dela.
3. O que não mexer (pastas das outras áreas).
4. Como testar (comandos e, no app, como abrir no celular).
5. Lembrete: atualizar os docs da área, pedir confirmação antes de push/PR, responder em português.

## Conflitos e arquivos compartilhados

- `docs/decisoes.md`: só se acrescentam linhas no fim; conflitos de merge nesse arquivo se resolvem mantendo as duas versões.
- `docs/game-design.md` pertence à thread de motor. Outras áreas propõem mudança de regra no PR delas e a thread de motor aplica.
- `README.md` e `CLAUDE.md` na raiz: o coordenador ou a thread de documentação cuida.
