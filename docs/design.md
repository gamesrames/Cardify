# Design visual (identidade "Arena")

Pasta: `app/` (tema em `app/src/theme/`, peças em `app/src/components/`). Dono: thread de design. Este doc é a fonte de verdade sobre **aparência**; regras continuam em [`game-design.md`](game-design.md) e o funcionamento das telas em [`app.md`](app.md).

## Estado atual

Direção **Arena** escolhida pelo usuário em 2026-11-11 e aplicada em todas as telas (boas-vindas, início, escolher baralho, meu baralho, criar carta, conta, online, partida contra o bot e partida online). Nenhuma regra, motor ou servidor mudou.

**Verificado no navegador** (Playwright contra `expo start --web`, 430×932 iPhone 14 Pro Max, 393×873 Poco, 360×640 e 1280×720): todas as telas, a partida inteira, janelas de confirmação e de resultado, sem erro no console. Com servidor falso: boas-vindas, baralho com fotos, online, câmera e escolha de categoria. `npm test` e `npm run typecheck` passam.

**Não verificado (precisa do celular):** as fontes no aparelho, brilho e degradê das molduras no Android, vibração, os sons de ouvido (foram sintetizados e nunca ouvidos por uma pessoa), a câmera real com a guia. Roteiro em "Como conferir no celular".

Quadro com as três direções propostas (só leitura, para referência): [Cardify · direções visuais](https://claude.ai/artifact/YB73xznjzkhP7KSjPDmo5W).

## A identidade em uma frase

Fundo escuro quase preto, **uma única cor de ação** (verde-limão) e a **foto do jogador ocupando a carta inteira**. O app é discreto para a foto e a raridade aparecerem.

- **Tom:** jogo competitivo e direto, sem fantasia medieval e sem infantil. Textos curtos, em português, sem emoji.
- **Cor de ação (`accent`, verde-limão):** só para o que o jogador pode tocar agora ou acabou de escolher (botão principal, custo da carta, posição jogável, seleção). Se tudo for verde, nada é.
- **Cor dos elementos e das raridades:** só nas cartas e em marcadores pequenos; nunca como cor de botão.

## Tokens (de onde vêm os valores)

Tudo mora em `app/src/theme/arena.ts`. **Não digite cor, fonte ou raio numa tela**: importe de `../theme`.

| Grupo | Tokens | Uso |
| --- | --- | --- |
| Fundo | `bg` `#0C0E13`, `surface` `#161922`, `raised` `#1F2430`, `line` `#2C3240` | tela, caixas, peças sobre caixas, bordas |
| Texto | `text` `#F2F4F8`, `textDim` `#9AA1B2`, `textFaint` `#5A6275` | principal, explicações, desligado |
| Ação | `accent` `#C8F031`, `onAccent` `#0C0E13` | botão principal, custo, seleção |
| Estado | `good` `#43D17A`, `bad` `#FF5D5D`, `badSoft` `#FF8A8A`, `warn` `#FFC53D` | vitória/ok, dano/erro, vida, aviso |
| Elementos | fogo `#FF6A3D`, planta `#43D17A`, terra `#D49A5B`, ar `#8FD8FF`, água `#4C86FF` | selo na carta, arte das cartas sem foto |
| Raridades | comum `#8D94A5`, incomum `#43D17A`, rara `#4C86FF`, épica `#B26BFF`, lendária `#FFC53D` | cor da moldura; da incomum para cima a moldura brilha; a lendária tem moldura em degradê |
| Fontes | `display`/`displayHeavy` = Unbounded 700/800; `body`/`bodySemi`/`bodyBold` = Inter 500/600/700 | títulos, números e botões / texto corrido |
| Forma | `radius` 8/12/16/pill, `space` 4/8/12/16/24 | cantos e espaçamentos |

Fontes: use sempre `fontFamily: fonts.algo`, **nunca `fontWeight`** (cada peso é um arquivo de fonte próprio; `fontWeight` com fonte carregada cai na fonte do sistema no Android).

### Trocar de identidade

O tema é um objeto que segue a interface `Theme` (`theme/types.ts`); parecido com trocar a implementação de uma interface em C#.

1. Copie `theme/arena.ts` para `theme/outra.ts` e mude os valores.
2. Em `theme/index.ts`, troque `export const theme: Theme = arena;`.
3. Se mudar de fonte: instale o pacote `@expo-google-fonts/<fonte>`, importe os arquivos em `theme/fontAssets.ts` e use os mesmos nomes em `fonts`.

Telas e componentes não mudam. O que **não** troca só com o tema: a anatomia da carta (`CardView.tsx`) e os sons.

## A carta (`components/CardView.tsx`)

Proporção fixa (largura/altura = 0,72, em `layout.ts`). Todas as medidas escalam com a largura (`px(n)` = "n pixels numa carta de 98 de largura"), então a mesma carta serve de 84 a 210 px.

- **Foto na carta inteira**; um escurecido na base garante a leitura do texto sobre qualquer foto.
- **Custo de energia** no canto superior esquerdo (selo verde-limão com raio). Some em campo (`hideCost`): já foi pago.
- **Elemento** no canto superior direito (círculo na cor do elemento, com ícone).
- **Nome** e, embaixo, **ataque** (espada) à esquerda e **vida** (coração) à direita. Vida ferida fica vermelha viva.
- **Raridade = moldura.** O nome da raridade por escrito só aparece em cartas grandes (largura ≥ 140).
- **Carta fixa (sem foto):** degradê na cor do elemento com o ícone grande no lugar da arte.
- **Escolhida:** moldura verde-limão; na mão ela sobe, em grades só ganha a moldura (`liftOnSelect={false}`).

## Peças prontas (use em telas novas)

| Peça | Arquivo | Para quê |
| --- | --- | --- |
| `Screen` | `components/Screen.tsx` | moldura de tela: seta de voltar, título, conteúdo rolável, rodapé fixo opcional |
| `Button` | `components/Button.tsx` | variantes `primary` (um por tela), `secondary`, `outline`, `danger`, `ghost`; aceita `icon` |
| `Dialog` | `components/Dialog.tsx` | janela de confirmação/resultado sobre a tela (não use `Alert.alert`: não funciona no navegador) |
| `ui` | `components/ui.ts` | estilos de texto e caixas: `hero`, `section`, `body`, `dim`, `small`, `label`, `error`, `box`, `input`... |
| `Icon` | `components/Icon.tsx` | único ponto que importa ícones (Material Community Icons). Ícone novo: acrescente o nome em `IconName` |
| `CardView` | `components/CardView.tsx` | a carta |
| `BattleTable`, `Board` | `components/` | a mesa de partida, igual para bot e online; as telas de partida só passam dados |
| `Wordmark` | `components/Wordmark.tsx` | a marca (cartinha inclinada + "Cardify") |

Regras de uso: um botão `primary` por tela; alvo de toque de pelo menos 44 px; sem emoji (ícone sempre pelo `Icon`); texto de erro em `ui.error`.

## Animações

Feitas com o `Animated` do React Native (sem biblioteca extra). São **reações a mudança de dados**, não uma linha do tempo: o componente compara o valor novo com o anterior.

- Carta: sobe ao ser escolhida; entra com um salto quando aparece em campo ou é revelada (`appear`); ao perder vida treme, pisca em vermelho e mostra `-N` subindo.
- Vida do jogador: pulsa quando muda. Posição jogável: "respira" em verde-limão. Botões: encolhem ao toque. Janelas: entram com mola.
- **Limite conhecido:** o ataque não tem animação de "investida". O motor resolve o combate de uma vez e entrega o estado final; para animar golpe a golpe a tela precisaria tocar os eventos um por um (possível, mas é trabalho à parte).

## Sons e vibração (`src/sfx.ts`)

- 8 efeitos curtos em `app/assets/sfx/`: `tap`, `select`, `play` (carta em campo), `hit` (dano), `turn` (sua vez), `reveal` (carta nova), `win`, `lose`.
- São **sintetizados** por `app/scripts/gerar-sons.py` (numpy): nenhum arquivo de terceiros, nenhuma licença a cumprir. Para mudar um som, edite o script e rode `python scripts/gerar-sons.py` em `app/`.
- Vibração (`expo-haptics`) acompanha jogar carta, dano, vitória e derrota; não existe no navegador.
- Botão de som no canto da tela inicial liga/desliga som **e** vibração; a escolha fica guardada no aparelho.
- No iPhone, o som respeita a chave lateral de silencioso.

## Ícone do app

`app/assets/icon.png`, `favicon.png`, `splash-icon.png` e os três `android-icon-*`: duas cartas em leque, a da frente verde-limão, fundo `bg`. Gerados por `app/scripts/gerar-icones.py` (Pillow). No Expo Go o ícone que aparece é o do Expo Go; o do app só aparece num build próprio.

## Licenças

| Item | Origem | Licença |
| --- | --- | --- |
| Unbounded, Inter | `@expo-google-fonts/*` | SIL Open Font License 1.1 (uso livre, inclusive comercial) |
| Ícones | Material Community Icons, via `@expo/vector-icons` | Apache 2.0 / MIT |
| Sons, ícone do app | feitos no próprio repositório (scripts) | do projeto |

## Como conferir no celular

Depois de baixar a branch: `cd app`, `npm.cmd install` (há pacotes novos: fontes, ícones, áudio, vibração), `npx.cmd expo start -c` e abra no Expo Go (roteiro completo em [`app.md`](app.md)). Olhe, no iPhone e no Poco:

1. **Fontes:** o título "Cardify" e os botões estão numa fonte larga e arredondada (Unbounded)? Se parecer a fonte padrão do sistema, anote o aparelho.
2. **Tela inicial:** os três cartões em leque e todos os botões cabem sem rolar? O botão de som (canto superior direito) liga e desliga.
3. **Carta:** as molduras rara/épica/lendária têm brilho em volta? A lendária tem moldura em degradê? (No Android antigo o brilho pode não aparecer; a cor da moldura deve aparecer sempre.)
4. **Partida:** tudo cabe sem rolar, do adversário até "Encerrar turno"? A carta escolhida sobe, a posição jogável pisca, o dano treme e mostra `-N`?
5. **Sons e vibração:** tocar, jogar carta, dano, sua vez, vitória/derrota. Diga quais incomodam ou estão altos/baixos demais.
6. **Criar carta:** a guia em formato de carta aparece sobre a câmera? A carta revelada entra com salto e som?
7. **Meu baralho:** três cartas por linha, fotos nítidas, selo de "escolhida" visível.

## Direções que ficaram de fora

Mostradas ao usuário em 2026-11-11 junto com a Arena; registradas para o caso de se querer mudar.

| Direção | Ideia | Por que não |
| --- | --- | --- |
| Álbum de figurinhas | fundo claro, cartas como figurinhas com borda branca, cores alegres (Bricolage Grotesque + Nunito) | simpática e muito legível, mas puxa para infantil (o público é 18+) e fotos escuras somem no fundo claro |
| Grimório | mesa de feltro, pergaminho e dourado (Cinzel + Alegreya Sans) | clima forte de jogo de cartas clássico, mas briga com fotos do dia a dia (gato, planta) e é a mais cara de produzir bem |

## A definir

- Animação de ataque golpe a golpe (ver "Limite conhecido").
- O leque da tela inicial usar as cartas de foto do próprio jogador quando ele tiver.
- Revisar os sons depois de ouvidos no aparelho.
- Telas da fase 5 (progressão e ranking): seguir este doc e as peças prontas.
