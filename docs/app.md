# App (Expo / React Native)

Pasta: `app/`. Dono: thread do app. Para o contrato com o motor, leia só a seção "API" de [`engine.md`](engine.md).

## Estado atual

Telas mínimas da fase 1 **implementadas** (PR em revisão): Início → escolher baralho → partida contra o bot → resultado com revanche. Verificado sem celular: checagem de tipos, empacotamento do Metro (Android) e 200 partidas completas rodando o mesmo caminho de código das telas. **Ainda não testado em aparelho**: esse é o critério de "pronto" e depende do usuário (passo a passo abaixo).

**Fase 3 (contas e nuvem) no `main`.** Testes do `app/`, tipos e empacotamento web ok. **Testado pelo usuário no navegador (2026-11-09):** criar conta a partir do convidado (as 2 cartas continuam no mesmo usuário, conferido no banco) e abrir uma partida; baralho de 7 com as fotos e aviso "Salvo na nuvem" (linha criada em `decks`). Também testado no navegador: sair e entrar de novo e entrar numa aba anônima (mesmas cartas, fotos e baralho). **Ainda não testado:** celular físico (iPhone e Poco). Veja a seção "Fase 3" abaixo.

**Desistir (2026-11-09):** a partida tem o botão "🏳️ Desistir" ao lado de "Encerrar turno", disponível a qualquer momento (até na vez do bot). Pede confirmação numa janela da própria tela (não usa `Alert.alert`, que não funciona no navegador); ao confirmar, chama `forfeit()` do `useGame`, que manda `{type:'forfeit', player: HUMAN}` ao motor. A tela de resultado mostra "Você desistiu" (conta como derrota) com Revanche, Escolher outro baralho e Menu. A regra mora no motor, a tela só pede. Verificado no navegador (Playwright, 390x844); celular ainda não.

**Fase 4 (partida online 1x1, 2026-11-09):** botão "Jogar online com um amigo" no menu (só com servidor e login), telas `OnlineScreen` (criar partida, entrar com código, continuar a partida em aberto) e `OnlineGameScreen` (espera com o código, partida e fim). Verificado no navegador (Playwright, 2 jogadores em contextos separados, 390x844) contra o **handler e o banco reais** da função `match` por um servidor falso local: criar, entrar, jogar, desistir, estouro de tempo, recarregar e continuar. **Não verificado:** o Supabase de verdade (Realtime, Storage com fotos, função publicada) e o celular. Veja a seção "Fase 4" abaixo e `partidas-online.md`.

Animações continuam fora. A coleção e o baralho próprio ("Meu baralho") entraram na fase 2, veja abaixo; os 5 baralhos prontos (`PREBUILT_DECKS`) seguem disponíveis.

## Fase 2: tela "Criar carta" (PR separado do PR do servidor)

Escrita e verificada sem celular: checagem de tipos, 7 testes do cliente da API (`npm test` em `app/`) e empacotamento do Metro para Android. **Ainda não testada em aparelho** nem chamada contra o servidor real.

- Início → "Criar carta com uma foto" → câmera do app (`expo-camera`, funciona no Expo Go) → foto reduzida a 1280 px e regravada como JPEG (some o EXIF; `expo-image-manipulator`) → com o classificador manual, escolher a categoria numa lista → envio à função `create-card` → a carta aparece com o `CardView`, **com a foto dentro** (`photoUri`).
- A foto da carta recém-criada vem do próprio aparelho (data URI). Para cartas antigas (coleção, fase 2/3) será preciso URL assinada do Storage: o bucket `card-photos` é privado e o dono já tem policy de leitura em `supabase/migrations/20261108000002_fotos_storage.sql`.
- Login de convidado (`signInAnonymously`) só quando o jogador escolhe "Começar como convidado" (fase 3; antes era automático), sessão guardada no aparelho (AsyncStorage). Convidado que perde a sessão não recupera as cartas: por isso existe a conta (fase 3).
- Erros do servidor mostram a mensagem em português (cota do dia, foto repetida...). Falhas de rede e do reconhecimento têm "Tentar de novo".
- Arquivos: `src/cardApi.ts` (chamada HTTP, sem React Native, testável), `src/supabase.ts` (cliente e sessão), `src/photo.ts` (reduzir/regravar), `src/screens/CreateCardScreen.tsx`.
- Configuração: copie `app/.env.example` para `app/.env.local` e preencha a URL e a chave pública (publishable) do projeto (Supabase → Project Settings → API). `EXPO_PUBLIC_MANUAL_CATEGORY=true` mostra a lista de categorias; use `false` quando o Gemini estiver ligado no servidor. Depois de mudar o `.env.local`, rode `npx expo start -c`.
- No navegador (`w` no Expo; já inclui `react-dom` e `react-native-web`), aparece um botão extra para escolher um arquivo, só para testar no computador sem câmera. Empacotamento web verificado (`expo export --platform web`).

### Como testar a criação de carta

1. Servidor: o login anônimo precisa estar ligado no painel do Supabase (Authentication → Sign In / Providers → Allow anonymous sign-ins).
2. `cd app && npm install && npx expo start -c`. No celular, escaneie o QR (mesmo roteiro da fase 1) e permita a câmera.
3. Criar carta → tirar foto → escolher a categoria → a carta aparece em poucos segundos.
4. Tire a mesma foto de novo: deve aparecer "Essa foto (ou uma quase igual) já virou carta". A 15ª foto do dia deve ser recusada.

## Fase 3: conta e baralho na nuvem

- **Sem sessão** (app novo, outro aparelho, depois de sair): `WelcomeScreen` com "Já tenho conta" (apelido + senha) e "Começar como convidado" (login anônimo, como na fase 2). Com sessão guardada, abre direto no menu. Sem servidor configurado (modo offline da fase 1), o app abre no menu e a conta some.
- **Minha conta** (`AccountScreen`, botão no menu): o convidado cria a conta com **apelido + senha** (senha repetida duas vezes) e o app a liga ao **mesmo usuário** (`updateUser({ email: fictício })` e depois `updateUser({ password })`), então as cartas ficam. Quem já tem conta vê o apelido, edita o nome de jogador, troca a senha e sai. O convidado que quer entrar numa conta antiga recebe o aviso de que as cartas do convidado não vão junto. **Limites da opção B:** sem recuperação de senha e apelido único por ordem de chegada (`backend.md`).
- **Baralho na nuvem** (`deckSync.ts`, `MyDeckScreen`): a nuvem manda; se estiver vazia, o baralho do aparelho sobe uma vez (inclusive o da fase 2, que ficava sem dono na chave `v1`). Há cópia local por usuário (`v2.<id>`) para jogar sem internet; sem rede o rodapé avisa e a próxima alteração tenta enviar de novo. Gravações vão numa fila (uma por vez, só a mais nova).
- Arquivos novos: `src/auth.ts` (única porta para o login; trocar o método = trocar este arquivo e os formulários), `src/authText.ts` (apelido, e-mail fictício e mensagens em português), `src/useAuth.ts` (estado da sessão), `src/deckSync.ts`, `src/components/CredentialsForm.tsx`, `src/screens/WelcomeScreen.tsx`, `src/screens/AccountScreen.tsx`. Testes: `test/deckSync.test.ts`, `test/authText.test.ts`.
- Pré-requisitos no painel do Supabase (aplicar a migração e desligar "Confirm email"): `backend.md`, "Como publicar a fase 3". Opcional no `.env.local`: `EXPO_PUBLIC_LOGIN_EMAIL_DOMAIN`.

### Como testar a conta (depois de aplicar a migração e desligar "Confirm email")

1. App aberto com a sessão de convidado que já tem as suas cartas → **Convidado · criar conta** → apelido e senha (anote a senha!). O botão do menu passa a mostrar "Conta: seu_apelido" e as cartas continuam em "Meu baralho". *(Feito pelo usuário em 2026-11-09 no navegador; se der erro, a mensagem na tela diz a causa: Confirm email ligado, domínio recusado...)*
2. Monte o baralho de 7 e confira "Salvo na nuvem".
3. Outro aparelho (ou navegador limpo / app reinstalado): **Já tenho conta** → mesmo apelido e senha → "Meu baralho" mostra as mesmas cartas, com fotos, e o mesmo baralho.
4. Sair da conta volta às boas-vindas. Teste também com o Wi-Fi desligado: o baralho local abre e o rodapé avisa que está sem conexão.

### Meu baralho (coleção + montar baralho)

Tela `MyDeckScreen`: lista as cartas de foto do jogador (lidas da tabela `cards`, a RLS só devolve as dele) e as 30 fixas; o jogador marca 7. O app valida com `validateDeck` do motor (7 cartas, teto de poder por raridade com bônus de foto, limite de 110) e só habilita "Jogar contra o bot" com baralho válido.

- **Desde a fase 3 o baralho fica na conta** (tabela `decks`) com cópia no aparelho (AsyncStorage, `src/deckStorage.ts`, por usuário). Na fase 2 era só no aparelho.
- As fotos vêm de URLs assinadas de 1 h do bucket privado (`signedPhotoUrls`). Sem rede ou sem servidor, a tela avisa e deixa montar só com as cartas fixas.
- A partida resolve o baralho pelo nome: `"Meu baralho"` lê `src/customDeck.ts` (`setCustomDeck` antes de iniciar). O bot continua com um baralho pronto sorteado.
- O `CardView` acha a foto sozinho pelo id da carta (`src/cardPhotos.tsx`, contexto), então `GameScreen` não mudou.
- Verificado no navegador (Playwright contra `expo start --web`, sem servidor): montar 7 cartas, contador 7/7 e poder 96/110, jogar e abrir a partida com "Você · Meu baralho". **Não verificado:** fotos na grade e na partida (precisa do servidor) e o celular.
- Testes: `app/test/myCards.test.ts` (coleção, limite de 7, validação de carta de foto).

## Fase 4: partida online 1x1

Contrato e regras (tempo de turno, privacidade da mão, erros) em [`partidas-online.md`](partidas-online.md); aqui só o que é do app.

- **Fluxo:** Menu → "Jogar online com um amigo" (`OnlineScreen`). Quem cria recebe um código de 6 caracteres e fica na espera (`OnlineGameScreen`, modo convite); quem entra digita o código. Se o jogador já tem uma partida em aberto, a tela oferece "Continuar" (e `already_in_match` do servidor leva direto a ela). Os dois precisam ter o baralho de 7 salvo em "Meu baralho" (o servidor lê da nuvem e valida; o app não manda baralho).
- **A tela só pede e mostra.** `useOnlineMatch(matchId)` guarda a visão que o servidor mandou (`match_views`, só a minha linha) e expõe `act(...)` para `play`, `end`, `forfeit`, `timeout`, `cancel`. As jogadas permitidas vêm prontas em `view.game.legal` (o motor calculou no servidor); a tela não recalcula regra. Cada ação leva a `version` que a tela viu; `stale_state` (duplo toque, tela velha) só atualiza a tela.
- **Atualização:** Realtime (mudança na minha linha de `match_views`) como caminho principal, mais consulta de reserva a cada 3 s (esperando) ou 5 s (jogando) e ao voltar para o app. Se o Realtime não funcionar no seu projeto, o jogo continua, só com até 5 s de atraso.
- **Contagem do turno:** `⏱ 0:42` na barra de status, com a diferença de relógio entre servidor e aparelho corrigida (`matchApi.ts`: `clockOffsetMs`, `msLeft`). Quando o prazo do **adversário** vence (mais 1,5 s de tolerância), o app pede `timeout`; o servidor confere e responde. Na minha vez o app nunca pede (quem volta atrasado quer jogar).
- **Fotos:** a visão traz `photos` (id da carta → caminho); `useMatchPhotos` pede as URLs assinadas e o `CardView` as acha pelo contexto, como na coleção.
- **Sair da tela não desiste:** a partida continua valendo e o tempo corre; volta-se por "Jogar online" → "Continuar". Para encerrar: "Desistir".
- Arquivos: `src/matchApi.ts` (chamada HTTP, relógio, texto do desfecho; sem React Native, testado), `src/matchClient.ts`, `src/useOnlineMatch.ts`, `src/useMatchPhotos.ts`, `src/components/Board.tsx` (`PlayerBar` e `Lane`, extraídos da `GameScreen` e usados pelas duas partidas), `src/screens/OnlineScreen.tsx`, `src/screens/OnlineGameScreen.tsx`. `describeEvent` ganhou opções (`foeName`, `endCause`) para falar o nome do adversário e explicar derrota por tempo. Testes: `test/matchApi.test.ts`.
- Os tipos do contrato vêm de `supabase/src/match/types.ts` por `import type` (só o TypeScript lê; o Metro não precisa).

### Como testar 1x1 sozinho (depois de publicar a migração e a função, `partidas-online.md`)

1. `cd app`, `npx.cmd expo start -c`, tecle `w` (navegador). Entre como convidado ou com conta e monte e salve um baralho de 7 em "Meu baralho".
2. Abra **uma aba anônima** (ou outro navegador) no mesmo endereço, entre como convidado e monte o baralho de 7 lá também. (Convidado novo só tem as cartas fixas; serve.)
3. Numa janela: "Jogar online com um amigo" → "Criar partida" → anote o código. Na outra: "Jogar online com um amigo" → digite o código → "Entrar com código". As duas entram na partida.
4. Jogue: quem tem a vez toca numa carta da mão e numa posição vazia, depois "Encerrar turno". A outra janela atualiza sozinha. Confira que cada janela só mostra a *própria* mão.
5. Teste o tempo: deixe uma janela parada por 60 s (o turno passa sozinho); duas vezes seguidas = derrota por tempo. Teste "Desistir" e recarregar a página (F5) no meio: "Jogar online" → "Continuar".
6. No celular: o mesmo, com o Expo Go no celular e o navegador no PC (ou dois celulares).

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

6. Para testar sem jogar tudo: toque em **Desistir** → "Desistir" na confirmação (ou "Continuar jogando" para voltar). Deve aparecer "Você desistiu" com as três opções.

Botão voltar do Android durante a partida pede confirmação antes de sair.

## Testes do app

`cd app && npm test` (vitest) e `npm run typecheck`. Hoje cobrem o cálculo de tamanho das cartas (`layout.ts`): a partida precisa caber na altura de desktop e de celular. Mudou o layout da `GameScreen` (barras, botão, log)? Reveja `NON_CARD_HEIGHT` em `layout.ts`; o teste acusa se ficar curto.

## Histórico de correções

- 2026-11-08: no navegador (Expo web, janela larga) o botão "Encerrar turno" ficava fora da tela, pois a carta tinha altura proporcional à largura da janela (1280x720 gerava cartas de ~570 de altura, botão em y=1864). Corrigido com `layout.ts` e coluna de no máximo 480 de largura.

## A definir

- Biblioteca de navegação e de estado: reavaliar quando entrar câmera e coleção (fase 2).
- Várias listas de baralho salvas: o servidor já aceita, o app usa só um ("Meu baralho").

## Convenções

- Toda lógica de regra fica no motor, nunca na tela. A tela só chama `legalActions`/`applyAction` e mostra o resultado.
- Importe o motor sempre por `src/motor.ts`.
- Adicione pacotes com `npx expo install <pacote>` (escolhe a versão compatível com o SDK). Se a rede bloquear a consulta, use `npm install <pacote>@<versão de node_modules/expo/bundledNativeModules.json>`.
- Entregar arquivos completos e dizer onde cada um fica.
- Comentários e textos de interface em português (pt-BR).
