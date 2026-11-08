# Geração de cartas, duplicatas e moderação

Fase 2 em diante. Dono: thread de geração de cartas (junto com backend no começo).

## Estado atual

**Servidor implementado e testado no computador** (branch da fase 2, ainda sem PR): gerador de cartas, hash perceptual, cota diária, duplicatas e classificadores (manual e Gemini) em `supabase/`. **Ainda não rodou num projeto Supabase de verdade** (falta criar o projeto) **nem na câmera do app** (a parte do app ainda não foi feita). O classificador ativo é escolhido pelo segredo `CLASSIFIER` (`manual` por padrão; `gemini` quando a chave estiver salva).

## Decidido

- Foto tirada pela câmera **do app** vira carta. Limite diário de fotos: 14 nos testes, 3 no final.
- O **servidor sorteia uma semente aleatória** na criação da carta e a salva. A foto não define os atributos por si só.
- **Raridade e atributos vêm do servidor.** O cliente só informa a foto e a classificação.
- A **categoria da foto** (formiga, galinha...) dá um bônus pequeno e limitado: até +10% do orçamento de poder, que conta para o limite do baralho (fórmulas em `game-design.md`).
- **Hash perceptual** bloqueia fotos quase iguais (duplicatas). Não é usado para definir atributos.
- Fraude de foto (foto de tela, foto da internet): caminho "inocente" por enquanto, só amigos próximos.
- Fotos visíveis para o adversário. Sem restrição de conteúdo no protótipo.
- Remoção do EXIF (localização etc.): o app tira antes de enviar **e** o servidor recodifica o JPEG antes de guardar (defesa em dupla; o servidor não confia no app).
- **Quem identifica a foto (2026-11-08):** o servidor, por trás da interface `Classifier`. Dois classificadores: `ManualClassifier` (o app manda o `slug` da categoria; usado nos testes e como plano B) e `GeminiClassifier` (API do Gemini, plano grátis, restrita à nossa lista de categorias). A chave fica só em segredo do Supabase (`GEMINI_API_KEY`), nunca no código, nos docs ou no app.

## Fluxo implementado (Edge Function `create-card`)

1. O app tira a foto, reduz (lado maior até ~1280 px), remove o EXIF e envia o JPEG em base64 com o login anônimo.
2. O servidor decodifica a foto, calcula o **dHash** (64 bits) e consulta `photo_check`: cota diária e duplicata. Se recusar, nada mais é gasto (nem chamada de IA).
3. O classificador devolve o `slug` da categoria (Gemini olha a foto; o manual lê o `slug` enviado).
4. O servidor sorteia a **semente** (32 bits, `crypto.getRandomValues`), sorteia a raridade (60/25/10/4/1) e distribui ataque/vida (gerador abaixo).
5. Sobe o JPEG limpo ao bucket privado `card-photos/<usuário>/<carta>.jpg` e grava a carta com `insert_card`, que **refaz** cota e duplicata dentro da transação (lock por usuário). Se a transação recusar, a foto enviada é apagada.
6. Devolve a carta pronta. Meta: menos de 10 s da foto à carta (medido no computador: ~0,25 s de processamento de imagem; falta medir com rede e Gemini).

### Gerador (`supabase/src/create-card/generator.ts`)

Função pura: mesma semente e categoria dão a mesma carta. Usa `DEFAULT_RULES` e o `Rng` do motor; não copia regra.

- Raridade: pesos 60/25/10/4/1 (`RARITY_WEIGHTS`).
- Poder total = orçamento da raridade + bônus da categoria. Bônus = `floor(orçamento × bonus_pct / 100)`, com `bonus_pct` entre 0 e 10 (a tabela `categories` guarda o valor; o gerador também limita), e **no mínimo +1 ponto** quando `bonus_pct` > 0. Só a comum passa de 10% por causa do mínimo (aprovado pelo usuário em 2026-11-08).
- Ataque/vida: a fatia do poder gasta em ataque sorteia entre 30% e 75% (`ATTACK_SHARE`); ataque e vida mínimos de 1; gasta o poder total exatamente.
- Elemento e nome vêm da categoria. A foto não define mais nada.

### Duplicatas

- dHash de 64 bits, distância de Hamming **até 10 bits** = mesma foto (`app_config.duplicate_max_distance`, ajustável sem deploy). Vale **entre todos os jogadores** (amigos não repetem a mesma foto).
- Testado com fotos sintéticas: a mesma cena com ruído e outro tamanho fica a ≤10 bits; cenas diferentes ficam bem acima. **O limiar 10 precisa ser conferido com fotos reais de celular** (mesmo objeto fotografado duas vezes à mão).

### Contrato da função

Detalhes (entrada, saída, erros) em [`backend.md`](backend.md).

## Critério de "pronto" da fase 2

Foto vira carta em menos de 10 segundos; a mesma foto tirada duas vezes é recusada; a 15ª foto do dia é bloqueada pelo servidor.

## Fora da fase 2

Nomes gerados por IA e moderação.

## Antes de abrir ao público (não bloqueia o protótipo)

As lojas e a LGPD exigem, antes de qualquer lançamento aberto:

- Denúncia de foto e bloqueio de jogador (obrigatório nas lojas para conteúdo enviado por usuários).
- Moderação automática de nudez e violência antes de a foto ficar visível a outros.
- Regra para fotos com rostos de terceiros (dados pessoais pela LGPD).
- Política de privacidade, termos de uso e confirmação de idade 18+.
- Remoção do EXIF (já entra na fase 2).
- Contas falsas: limitar a criação de contas por aparelho.

## A definir

- Limiar do hash com fotos reais (hoje 10 de 64 bits) e se fotos de tela/foto da foto passam.
- Bônus de categoria: resolvido com o mínimo de +1 (ver acima); conferir no simulador se a comum com +1 (10 de poder) desequilibra.
- **Pendência para a thread do motor:** `validateDeck` rejeita carta acima do orçamento da raridade, mas cartas com bônus passam disso (poder = orçamento + bônus). Precisa aceitar `orçamento + floor(orçamento × 10%)` (ou a carta carregar o próprio orçamento). Sem isso, carta de foto com bônus não entra em baralho.
- Balanceamento das cartas geradas: rodar o simulador com cartas geradas (ataque/vida sorteados, raridades 60/25/10/4/1) para ver se alguma combinação passa de 60% de vitória. Ainda não feito.
- Lista final de categorias e bônus (a inicial tem 25, em `supabase/migrations/`, ajustável por `UPDATE`).
- Nome do modelo do Gemini (`GEMINI_MODEL`, padrão `gemini-flash-lite-latest`) e limites atuais do plano grátis: conferir no Google AI Studio antes de ligar. No plano grátis o Google pode usar as imagens para melhorar produtos.
