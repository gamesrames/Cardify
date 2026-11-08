# App (Expo / React Native)

Pasta: `app/`. Dono: thread do app. Para o contrato com o motor, leia só a seção "API" de [`engine.md`](engine.md).

## Estado atual

Telas mínimas da fase 1 **implementadas** (PR em revisão): Início → escolher baralho → partida contra o bot → resultado com revanche. Verificado sem celular: checagem de tipos, empacotamento do Metro (Android) e 200 partidas completas rodando o mesmo caminho de código das telas. **Ainda não testado em aparelho**: esse é o critério de "pronto" e depende do usuário (passo a passo abaixo).

Fora desta entrega (planejado): coleção de cartas, montar baralho próprio de 7 cartas, animações. Hoje o jogador só escolhe um dos 5 baralhos prontos (`PREBUILT_DECKS`).

## Decidido

- Expo SDK 58 (React Native, TypeScript). Plataforma principal: Android; iPhone 14 Pro Max via Expo Go (não precisa de Mac).
- O app importa o motor de `engine/` (TypeScript puro) e joga localmente contra o bot. Sem servidor na fase 1.
- Público 18+, sem monetização.
- Sem biblioteca de navegação nem de estado na fase 1 (ver `decisoes.md`).

## Estrutura

```
app/
  App.tsx                    escolhe a tela (estado simples) e sorteia a semente
  metro.config.js            deixa o Metro ler ../engine (fora da pasta app/)
  src/
    motor.ts                 ÚNICO ponto que importa o motor (re-exporta engine/src/index.ts)
    useGame.ts               hook: guarda o GameState, aplica ações, faz o bot jogar (pausa de 0,8 s por ação)
    describeEvent.ts         transforma GameEvent em linhas de log em português
    theme.ts                 cores, emojis e nomes de elementos e raridades
    components/              Button, CardView (só desenha dados)
    screens/                 HomeScreen, DeckPickScreen, GameScreen
```

## Como as telas usam o motor

- Jogadas permitidas: `legalActions(state)`. A tela só habilita o que o motor lista (carta acessível, posição livre).
- Jogar e encerrar turno: `applyAction`. O estado é imutável; cada ação gera um novo, e `useGame` guarda o mais recente.
- Bot: `greedyBot(state)` devolve UMA ação por chamada; o hook chama de novo até vir `{ type: 'end' }`.
- Textos de regras na tela inicial (vida, energia, ciclo de elementos) são lidos de `DEFAULT_RULES` e `hasAdvantage`, não digitados.
- O humano é sempre o jogador 0; quem começa é sorteado pelo motor. Se o bot começa, ele joga sozinho primeiro.
- A semente de cada partida aparece na tela de resultado: com ela dá para reproduzir a partida.

## Como testar no celular (primeira vez com Expo)

Pré-requisitos no computador: Node.js 20 ou mais novo (nodejs.org, versão LTS) e Git. O celular e o computador precisam estar **na mesma rede Wi-Fi**.

1. No celular, instale o **Expo Go** (App Store no iPhone, Play Store no Android).
2. No computador, num terminal:
   ```bash
   git clone https://github.com/gamesrames/Cardify.git
   cd Cardify/app
   npm install
   npx expo start
   ```
   (Não precisa instalar nada em `engine/`.) O terminal mostra um QR code.
3. **Android (Poco):** abra o Expo Go, toque em "Scan QR code" e escaneie o QR do terminal.
   **iPhone:** abra a câmera do iPhone, aponte para o QR e toque no aviso "Abrir no Expo Go".
4. O primeiro carregamento leva alguns segundos. Para recarregar depois de mudar código: sacuda o celular e escolha "Reload", ou pressione `r` no terminal.

Se não conectar:
- Rode `npx expo start --tunnel` (funciona mesmo em redes que bloqueiam conexões locais; o Expo pede para instalar um pacote, aceite).
- No Windows, permita o Node.js no firewall quando o aviso aparecer.
- Se o Expo Go reclamar da versão do SDK, atualize o Expo Go na loja (este app usa o SDK 58).

### Roteiro de validação (critério de "pronto")

1. Início → "Jogar contra o bot" → escolha um baralho → "Jogar".
2. Na sua vez: toque numa carta da mão (as que você não pode pagar ou não cabem ficam apagadas), depois numa posição vazia marcada em verde. Repita enquanto tiver energia.
3. Toque em "Encerrar turno". Suas cartas atacam; o bot joga em seguida e o log mostra tudo.
4. Jogue até a vida de alguém chegar a 0. Deve aparecer o vencedor com "Revanche", "Escolher outro baralho" e "Menu".
5. Repita no iPhone e no Android. Anote qualquer travamento, texto cortado ou botão difícil de tocar.

Botão voltar do Android durante a partida pede confirmação antes de sair.

## A definir

- Biblioteca de navegação e de estado: reavaliar quando entrar câmera e coleção (fase 2).
- Fase 2: câmera, remoção de EXIF no celular e classificação da foto no aparelho exigem um **development build** (o Expo Go não basta). Ver `geracao-cartas.md`.

## Convenções

- Toda lógica de regra fica no motor, nunca na tela. A tela só chama `legalActions`/`applyAction` e mostra o resultado.
- Importe o motor sempre por `src/motor.ts`.
- Adicione pacotes com `npx expo install <pacote>` (escolhe a versão compatível com o SDK). Se a rede bloquear a consulta, use `npm install <pacote>@<versão de node_modules/expo/bundledNativeModules.json>`.
- Entregar arquivos completos e dizer onde cada um fica.
- Comentários e textos de interface em português (pt-BR).
