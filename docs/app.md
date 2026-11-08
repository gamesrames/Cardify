# App (Expo / React Native)

Pasta prevista: `app/` (ainda não existe). Dono: thread do app.

## Estado atual

Nada criado. Começa depois que o PR #1 (motor) entrar e as regras da fase 1 estabilizarem. Tudo abaixo é **plano**, exceto a stack, que está decidida.

## Decidido

- Expo (React Native) com TypeScript. Plataforma principal: Android; iPhone 14 Pro Max para testes via Expo Go (não precisa de Mac).
- O app importa o motor de `engine/` (TypeScript puro) e joga localmente contra o bot na fase 1. Sem servidor na fase 1.
- Público 18+, sem monetização.

## Critério de "pronto" da fase 1 (lado do app)

O usuário joga uma partida inteira contra o bot no Android, usando as cartas fixas e um baralho de 7 montado por ele.

## Telas previstas na fase 1 (proposta)

1. Início: jogar contra o bot, coleção/baralho.
2. Coleção: as 30 cartas fixas.
3. Montar baralho: 7 cartas, mostrando poder total e o limite de 110 (usar `validateDeck`).
4. Escolher baralho do bot (os baralhos prontos de `PREBUILT_DECKS`).
5. Partida: campo com 3 posições por lado, mão de 3 cartas, energia, vida, botão de encerrar turno, log de eventos (`GameEvent`).
6. Fim de partida: resultado e revanche.

Animações caprichadas ficam fora da fase 1.

## A definir

- Biblioteca de navegação e de estado (propor 2 ou 3 opções com prós e contras antes de escolher).
- Fase 2: câmera, remoção de EXIF no celular e classificação da foto no aparelho exigem um **development build** (o Expo Go não basta). Ver `geracao-cartas.md`.

## Como testar no celular

A thread do app deve documentar aqui, assim que existir: o comando para iniciar (`npx expo start`), como abrir no Expo Go no iPhone e no Android, e os passos para validar a partida completa.

## Convenções

- Toda lógica de regra fica no motor, nunca na tela. A tela só chama `legalActions`/`applyAction` e mostra o resultado.
- Entregar arquivos completos e dizer onde cada um fica.
- Comentários e textos de interface em português (pt-BR).
