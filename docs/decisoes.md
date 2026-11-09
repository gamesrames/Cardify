# Registro de decisões

Só se acrescentam linhas no fim (ordem cronológica). Se uma decisão for substituída, acrescente uma linha nova que a revoga em vez de apagar a antiga. Formato: data, decisão, motivo, área.

## 2026-11-08

| Decisão | Motivo | Área |
| --- | --- | --- |
| Stack: Expo (React Native + TypeScript) com Supabase. | O motor de combate é escrito uma vez só em TS e roda no celular (fase 1) e no servidor (fases 2 a 4); testa no iPhone pelo Expo Go sem Mac; plano grátis cobre banco, fotos, login e tempo real. Unity (C#) e Flutter + Firebase ficaram como alternativas: Unity pede Mac para iPhone e hospedagem .NET grátis é difícil; Firebase exige plano pago para as funções de servidor. | Geral |
| Semente da carta: o servidor sorteia e salva. Hash perceptual só para duplicatas. | RNG no servidor impede o cliente de manipular cartas. | Geração de cartas |
| Anti-fraude: confiar nos usuários no início (teste com amigos próximos). | Escopo de protótipo. | Backend |
| Equilíbrio: limite de poder por baralho e energia por raridade. Foto pode dar bônus modesto de atributo (galinha > formiga). | Evitar cartas fortes demais só por serem fotos "boas". | Game design |
| Fotos por dia: 14 nos testes, 3 no jogo final. | Ritmo de coleção; teste precisa de volume. | Geração de cartas |
| Baralho de 7 cartas. Regras provisórias: 5 elementos em ciclo, 20 de vida, 3 cartas na mão, 3 de energia por turno. | Ajustar pelo simulador da fase 1. | Game design |
| Fórmulas v0: Poder = Ataque×2 + Vida; custo/orçamento por raridade (Comum 1/9, Incomum 2/15, Rara 2/18, Épica 3/24, Lendária 3/28); limite de baralho 110; bônus de categoria até +10% do orçamento (conta no limite); melhoria até +25%; ciclo Fogo > Planta > Terra > Ar > Água > Fogo, vantagem ×1,5, desvantagem ×0,75. | Aprovadas pelo usuário como ponto de partida. | Game design |
| Combate: até 3 posições por lado; criatura ataca a posição oposta; posição vazia = dano direto no jogador. | Regra simples de ler no celular. | Game design |
| Segundo jogador ganha +2 de energia no primeiro turno dele. | Simulador: vitória de quem começa caiu de 78% para 51%. | Motor |
| Modos: contra bot com baralhos prontos (principal); 1x1 por convite em tempo real, servidor resolve cada turno, com tempo limite; matchmaking por último. | Foco no que dá para testar com amigos. | Geral |
| Público 18+. Fotos visíveis ao adversário, sem restrição de conteúdo no protótipo. Sem troca de cartas. Sem monetização. | Escopo de protótipo; moderação fica para antes do lançamento aberto. | Geral |
| Melhoria de cartas: sim, com teto por raridade (fase 5). | Progressão sem quebrar o limite de poder. | Game design |
| Todas as threads de trabalho usam Sonnet (`claude-sonnet-5-5`) com esforço alto; só o coordenador usa Opus. | Regra do usuário para o projeto. | Processo |
| Docs de contexto por área em `docs/`, mais `CLAUDE.md` na raiz; threads leem os da sua área e os atualizam ao mudar uma decisão. | Cada agente lê só o que precisa. | Processo |

## 2026-11-08 (balanceamento do PR #1)

| Decisão | Motivo | Área |
| --- | --- | --- |
| Orçamento de poder da raridade épica sobe de 24 para 27 (revoga o 24 das fórmulas v0). Demais raridades inalteradas. | Simulador (20 mil partidas): épicas de 44,7% para 48,4% de vitória; todas as raridades entre 48% e 53%. Aprovado pelo usuário em 2026-11-08. | Game design / Motor |
| Ataque e vida de 9 cartas redistribuídos, sem mudar o poder da raridade: Ent 9/10, Baleia 9/10, Condor 10/8, Águia 10/7, Foca 5/8, Elefante 7/13; e, pela mudança da épica, Leão 9/9, Urso 8/11, Tubarão 9/9. | Tirar Ent (60,6%) e Águia (38,3%) da zona fora de 40% a 60%. | Motor |

## 2026-11-08 (app da fase 1)

| Decisão | Motivo | Área |
| --- | --- | --- |
| O app (`app/`) usa Expo SDK 58 e importa o motor por caminho relativo (`../../engine/src`), concentrado em `app/src/motor.ts`; o `metro.config.js` libera a leitura de `engine/`. Sem copiar nem publicar o motor como pacote. | Motor único para app e servidor, sem etapa de build extra. Se o contrato mudar, só `motor.ts` precisa de revisão. | App |
| Fase 1 sem biblioteca de navegação nem de estado: um `useState` escolhe a tela e um hook (`useGame`) guarda o `GameState`. Reavaliar na fase 2 (câmera, coleção). | São 3 telas; biblioteca seria peso sem ganho. | App |
| Na fase 1 o humano é sempre o jogador 0 e o bot o jogador 1; o bot usa `greedyBot` e joga com um baralho pronto sorteado, diferente do escolhido. A semente é sorteada na camada de tela (`Math.random` só fora do motor). | Escopo mínimo jogável; a semente fica visível no fim da partida para reproduzir. | App |

## 2026-11-08 (fase 2: foto vira carta)

| Decisão | Motivo | Área |
| --- | --- | --- |
| A foto é identificada **no servidor**, atrás da interface `Classifier`: `ManualClassifier` (testes e plano B) e `GeminiClassifier` (plano grátis do Gemini). Revoga a ideia de classificar no celular (proposta em `geracao-cartas.md`). | Funciona no Expo Go do iPhone (dev build exigiria conta Apple paga), é testável no computador e a lista de categorias é nossa. | Geração de cartas |
| A chave do Gemini vive só em segredo do Supabase (`GEMINI_API_KEY`); nunca em código, commit, docs ou mensagens. | Segurança; a chave foi criada pelo usuário. | Backend |
| Hash perceptual dHash de 64 bits, calculado no servidor; duplicata = distância ≤ 10, vale entre todos os jogadores. Limiar a validar com fotos reais. | Amigos não devem repetir a mesma foto; ajustável em `app_config` sem deploy. | Geração de cartas |
| Cota diária por dia de São Paulo, lida de `app_config` (14 agora, 3 no final); cota e duplicata são conferidas dentro da transação de gravação. | Servidor decide; duas fotos simultâneas não furam o limite. | Backend |
| O servidor recodifica o JPEG antes de guardar (some o EXIF). | Não depender do app para privacidade. | Geração de cartas |
| Gerador de cartas: raridade 60/25/10/4/1, ataque/vida dividem o poder (orçamento + bônus da categoria) com 30% a 75% em ataque. Bônus arredonda para baixo (teto 10%), com mínimo de +1 ponto quando a categoria tem bônus (a comum passa de 10%). Aprovado pelo usuário. | Regras do usuário; a fatia de ataque cobre o intervalo das cartas fixas sem extremos. | Geração de cartas |
| Câmera do app com `expo-camera` e `expo-image-manipulator` (funcionam no Expo Go); sem development build na fase 2. Login anônimo com sessão em AsyncStorage. Revoga "classificação no celular exige dev build" de `app.md`. | Classificar no servidor torna o build nativo desnecessário. | App |
| "Meu baralho": coleção (cartas de foto + fixas) e montagem de 7 cartas no app, validada pelo `validateDeck`; o baralho fica só no aparelho (AsyncStorage) até a fase 3, e a partida o lê por `customDeck.ts`. | Para as cartas de foto poderem ser jogadas já na fase 2 sem antecipar a nuvem. | App |
| O servidor é empacotado com esbuild (`supabase/build.mjs`) em vez de alterar o motor para o Deno. | O motor não muda de contrato; o bundle sai de `src/`. | Backend |

## 2026-11-08 (bônus de foto na validação)

| Decisão | Motivo | Área |
| --- | --- | --- |
| Bônus de categoria da foto: até +10% do orçamento da raridade, arredondado para baixo, com **mínimo de +1** quando a categoria tem bônus (comum +1, incomum +1, rara +1, épica +2, lendária +2). Aprovado pelo usuário em 2026-11-08. | Sem o mínimo, o bônus de 10% sobre 9 de poder (comum) valeria 0 e a foto não faria diferença nas comuns. | Game design |
| `validateDeck` compara o poder de cada carta com o teto = orçamento + bônus de foto + melhoria (25%, planejada): comum 12, incomum 19, rara 23, épica 35, lendária 37. O limite de 110 do baralho conta o poder real. Substitui "poder da carta ≤ orçamento da raridade". | Antes, qualquer carta com bônus (poder acima do orçamento) seria recusada em todo baralho. | Motor |

## 2026-11-09 (fase 3: contas e nuvem)

| Decisão | Motivo | Área |
| --- | --- | --- |
| Convidado vira conta **ligando um e-mail ao mesmo usuário anônimo** (`updateUser({ email })`); o id do jogador não muda. | As cartas já criadas (dono = id do usuário anônimo) continuam dele sem migrar nada. | Backend / App |
| Login por **apelido + senha, sem e-mail de verdade** (opção B, escolhida pelo usuário em 2026-11-09). O app monta um e-mail fictício `cardify.<apelido>@gmail.com` (domínio configurável) e usa o login por e-mail + senha do Supabase com "Confirm email" desligado. Sem recuperação de senha; apelido único por ordem de chegada. Convidado (anônimo) continua. Isolado em `app/src/auth.ts` para trocar por e-mail de verdade (código por e-mail, Google) no lançamento. | Zero configuração e zero custo para testar com amigos. A opção A (e-mail + código) exigia SMTP próprio, porque o e-mail embutido do Supabase só envia a membros da organização. Vale só para o protótipo. | Backend / App |
| O upgrade do convidado para apelido + senha mantendo o id **ainda não foi exercitado no servidor real**. Se falhar, plano B: Edge Function com chave de serviço (`auth.admin.updateUserById`). | Ambiente das threads não alcança o Supabase; o app mostra a causa de cada falha conhecida. | Backend |
| Exige SMTP próprio no Supabase só se voltarmos ao e-mail de verdade (A). Grátis: Brevo (300/dia). | O e-mail embutido só envia a membros da organização. | Backend |
| `profiles` (nome de exibição) e `decks` (`card_ids text[]`, único por dono e nome) com RLS por dono; o banco não valida a legalidade do baralho, o motor valida ao iniciar a partida (fase 4). | O servidor decide a regra, uma vez só, no lugar certo; a fase 4 não precisa de mudança de esquema. | Backend |
| Quem entra numa conta existente deixa o convidado para trás (sem fundir cartas). | Fundir exige regras de cota diária e duplicatas; fica fora do protótipo. A tela avisa. | App |

## 2026-11-09 (desistência)

| Decisão | Motivo | Área |
| --- | --- | --- |
| **Desistir é uma ação do motor**, `{ type: 'forfeit', player }`: termina a partida na hora, o adversário vence, `endReason: 'forfeit'`. Vale a qualquer momento e para qualquer jogador; não entra em `legalActions`. Todo fim de jogo agora tem motivo (`hp_zero`, `turn_limit`, `forfeit`). No app, botão "Desistir" com confirmação na tela de partida. | Testar sem jogar 25+ turnos, e o 1x1 online da fase 4 precisa da mesma regra no servidor (quem desiste fora da vez, quem some). Sem mexer em balanceamento. | Motor / App |

## Em aberto

- Se a fórmula Poder = 2×Ataque + Vida continua ou muda de vez (a vida segue barateada; foi compensado nas cartas e no orçamento da épica).
- Teto final de melhoria por raridade (hoje 25% do orçamento, só reservado na validação) e a lista final de categorias com seus bônus.
- Limiar do hash perceptual com fotos reais de celular.
- Quais categorias novas acrescentar (hoje coelho vira "Animal"); inserir na tabela `categories` não exige republicar a função.
- Bibliotecas de navegação e de estado do app.
