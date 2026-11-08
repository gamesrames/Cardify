# App (Expo / React Native)

Pasta: `app/`. Dono: thread do app. Para o contrato com o motor, leia só a seção "API" de [`engine.md`](engine.md).

## Estado atual

Telas mínimas da fase 1 **implementadas** (PR em revisão): Início → escolher baralho → partida contra o bot → resultado com revanche. Verificado sem celular: checagem de tipos, empacotamento do Metro (Android) e 200 partidas completas rodando o mesmo caminho de código das telas. **Ainda não testado em aparelho**: esse é o critério de "pronto" e depende do usuário (passo a passo abaixo).

Fora desta entrega (planejado): coleção de cartas, montar baralho próprio de 7 cartas, animações. Hoje o jogador só escolhe um dos 5 baralhos prontos (`PREBUILT_DECKS`).

## Fase 2: tela "Criar carta" (PR separado do PR do servidor)

Escrita e verificada sem celular: checagem de tipos, 7 testes do cliente da API (`npm test` em `app/`) e empacotamento do Metro para Android. **Ainda não testada em aparelho** nem chamada contra o servidor real.

- Início → "Criar carta com uma foto" → câmera do app (`expo-camera`, funciona no Expo Go) → foto reduzida a 1280 px e regravada como JPEG (some o EXIF; `expo-image-manipulator`) → com o classificador manual, escolher a categoria numa lista → envio à função `create-card` → carta aparece com o `CardView`.
- Login anônimo automático (`supabase.auth.signInAnonymously`), sessão guardada no aparelho (AsyncStorage). Sem sessão guardada (app reinstalado), vira outro usuário anônimo: as cartas antigas ficam no servidor, mas não voltam (a fase 3 resolve com login de verdade).
- Erros do servidor mostram a mensagem em português (cota do dia, foto repetida...). Falhas de rede e do reconhecimento têm "Tentar de novo".
- Arquivos: `src/cardApi.ts` (chamada HTTP, sem React Native, testável), `src/supabase.ts` (cliente e sessão), `src/photo.ts` (reduzir/regravar), `src/screens/CreateCardScreen.tsx`.
- Configuração: copie `app/.env.example` para `app/.env.local` e preencha a URL e a chave pública (publishable) do projeto (Supabase → Project Settings → API). `EXPO_PUBLIC_MANUAL_CATEGORY=true` mostra a lista de categorias; use `false` quando o Gemini estiver ligado no servidor. Depois de mudar o `.env.local`, rode `npx expo start -c`.
- No navegador (`w` no Expo; já inclui `react-dom` e `react-native-web`), aparece um botão extra para escolher um arquivo, só para testar no computador sem câmera. Empacotamento web verificado (`expo export --platform web`).

### Como testar a criação de carta

1. Servidor: o login anônimo precisa estar ligado no painel do Supabase (Authentication → Sign In / Providers → Allow anonymous sign-ins).
2. `cd app && npm install && npx expo start -c`. No celular, escaneie o QR (mesmo roteiro da fase 1) e permita a câmera.
3. Criar carta → tirar foto → escolher a categoria → a carta aparece em poucos segundos.
4. Tire a mesma foto de novo: deve aparecer "Essa foto (ou uma quase igual) já virou carta". A 15ª foto do dia deve ser recusada.

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
    layout.ts                tamanho das cartas a partir da janela (test/layout.test.ts garante que a partida cabe na tela)
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

**Testar no navegador do PC** (útil para depressa, mas o teste que vale é no celular): no terminal do `expo start`, pressione `w`. O jogo aparece numa coluna centralizada de no máximo 480 de largura, e as cartas encolhem para a partida caber na altura da janela. Dependências web (`react-dom`, `react-native-web`) já estão no `package.json`.

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

## Testes do app

`cd app && npm test` (vitest) e `npm run typecheck`. Hoje cobrem o cálculo de tamanho das cartas (`layout.ts`): a partida precisa caber na altura de desktop e de celular. Mudou o layout da `GameScreen` (barras, botão, log)? Reveja `NON_CARD_HEIGHT` em `layout.ts`; o teste acusa se ficar curto.

## Histórico de correções

- 2026-11-08: no navegador (Expo web, janela larga) o botão "Encerrar turno" ficava fora da tela, pois a carta tinha altura proporcional à largura da janela (1280x720 gerava cartas de ~570 de altura, botão em y=1864). Corrigido com `layout.ts` e coluna de no máximo 480 de largura.

## A definir

- Biblioteca de navegação e de estado: reavaliar quando entrar câmera e coleção (fase 2).
- Coleção (listar as cartas criadas) e montar baralho com elas: fases 2/3; hoje a carta criada só aparece no resultado.

## Convenções

- Toda lógica de regra fica no motor, nunca na tela. A tela só chama `legalActions`/`applyAction` e mostra o resultado.
- Importe o motor sempre por `src/motor.ts`.
- Adicione pacotes com `npx expo install <pacote>` (escolhe a versão compatível com o SDK). Se a rede bloquear a consulta, use `npm install <pacote>@<versão de node_modules/expo/bundledNativeModules.json>`.
- Entregar arquivos completos e dizer onde cada um fica.
- Comentários e textos de interface em português (pt-BR).
