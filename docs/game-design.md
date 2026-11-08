# Game design: regras, elementos e fórmulas

Dono: thread de motor/balanceamento. Valores aqui são a referência; o código do motor (`engine/src/rules.ts`, `DEFAULT_RULES`) deve bater com este doc.

## Estado atual

Fórmulas v0 aprovadas pelo usuário em 2026-11-08 e implementadas no motor (PR #1). Valores ainda **provisórios**: o simulador existe para ajustá-los. Problema aberto: a fórmula de poder barateia a vida (ver "Balanceamento em aberto").

## Regras da partida

- 2 jogadores, **20 de vida** cada. Vence quem zerar a vida do outro.
- Baralho de **7 cartas**, sem repetidas. Compra até ter **3 cartas na mão** no início do turno. Quando o monte acaba, o descarte é embaralhado e vira o novo monte.
- **3 de energia por turno** (não acumula). O segundo jogador ganha **+2 de energia no primeiro turno dele**, para compensar jogar depois (nas simulações, a vitória de quem começa caiu de 78% para 51%).
- Cada carta custa energia conforme a raridade (tabela abaixo). Jogar uma carta = colocá-la numa **posição vazia** do seu lado.
- **3 posições** (lanes) por jogador. Por padrão a criatura já ataca no fim do turno em que entrou (a "doença de invocação", que a faria esperar o turno seguinte, existe como opção do simulador e está desligada).
- **Combate:** no fim do turno do jogador ativo, cada criatura dele ataca a posição oposta, da esquerda para a direita. Se há criatura lá, ela leva o dano (e o dano persiste entre turnos; vida 0 = vai para o descarte). Se a posição oposta está vazia, o dano vai direto na vida do jogador. Quem é atacado não revida.
- Limite de **60 turnos** (contando os dois jogadores): vence quem tem mais vida; empate = empate.

## Elementos

Cinco elementos em ciclo; cada um vence o próximo:

Fogo > Planta > Terra > Ar > Água > Fogo

- Vantagem: dano ×1,5. Desvantagem: dano ×0,75. Neutro: ×1.
- Dano = arredondado para baixo, mínimo 1.

## Raridades, custo e orçamento de poder

**Poder = Ataque × 2 + Vida.** Cada raridade tem um orçamento máximo de poder e um custo de energia:

| Raridade | Energia | Orçamento de poder |
| --- | --- | --- |
| Comum | 1 | 9 |
| Incomum | 2 | 15 |
| Rara | 2 | 18 |
| Épica | 3 | 24 |
| Lendária | 3 | 28 |

- **Limite de poder do baralho: 110** (soma dos poderes das 7 cartas).
- **Bônus por categoria da foto** (fase 2): até **+10% do orçamento**, e conta para o limite do baralho. Exemplo: galinha ganha mais que formiga, mas nunca muito.
- **Melhoria de carta** (fase 5): até **+25%**, com teto por raridade.
- Atributos e raridade vêm sempre do servidor; o cliente nunca decide.

## Cartas fixas da fase 1

30 cartas, 6 por elemento (2 comuns, 1 incomum, 1 rara, 1 épica, 1 lendária), cada uma gastando exatamente o orçamento da sua raridade. A lista completa e os baralhos prontos do bot estão em `engine/src/cards.ts` e `engine/src/deck.ts`; não duplique a tabela aqui.

## Balanceamento em aberto

Achados do simulador (10 mil partidas, PR #1):

- Ent (planta, lendária) vence **60,6%** e Águia (ar, épica) vence **38,3%**, fora da faixa-alvo de 40% a 60%.
- Causa provável: Poder = 2×Ataque + Vida barateia a vida; cartas "gordas" rendem mais que o poder indica, e as épicas de ataque alto rendem menos.
- Próximo passo: ajustar a fórmula de poder (ou os pesos) e as cartas, e rodar o simulador de novo. Critério de aceite da fase 1: nenhuma carta passa de 60% nos baralhos em que aparece.

## Como propor mudança de regra

1. Mude o valor no simulador com as opções de linha de comando (`--hp`, `--energy`, `--limit`, `--bonus`, `--sick`, `--adv`, `--dis`) e compare.
2. Se melhorar, mude `DEFAULT_RULES`, os testes e este doc no mesmo PR.
3. Registre a decisão em `decisoes.md`.
