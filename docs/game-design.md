# Game design: regras, elementos e fórmulas

Dono: thread de motor/balanceamento. Valores aqui são a referência; o código do motor (`engine/src/rules.ts`, `DEFAULT_RULES`) deve bater com este doc.

## Estado atual

Fórmulas v0 aprovadas pelo usuário em 2026-11-08 e implementadas no motor (PR #1). Depois da primeira rodada de balanceamento, o orçamento da raridade **épica subiu de 24 para 27** e 9 cartas tiveram ataque/vida redistribuídos (ver "Balanceamento"). Valores ainda **provisórios** (a épica em 27 já foi aprovada): o simulador existe para ajustá-los.

## Regras da partida

- 2 jogadores, **20 de vida** cada. Vence quem zerar a vida do outro.
- Baralho de **7 cartas**, sem repetidas. Compra até ter **3 cartas na mão** no início do turno. Quando o monte acaba, o descarte é embaralhado e vira o novo monte.
- **3 de energia por turno** (não acumula). O segundo jogador ganha **+2 de energia no primeiro turno dele**, para compensar jogar depois (nas simulações, a vitória de quem começa caiu de 78% para 51%).
- Cada carta custa energia conforme a raridade (tabela abaixo). Jogar uma carta = colocá-la numa **posição vazia** do seu lado.
- **3 posições** (lanes) por jogador. Por padrão a criatura já ataca no fim do turno em que entrou (a "doença de invocação", que a faria esperar o turno seguinte, existe como opção do simulador e está desligada).
- **Combate:** no fim do turno do jogador ativo, cada criatura dele ataca a posição oposta, da esquerda para a direita. Se há criatura lá, ela leva o dano (e o dano persiste entre turnos; vida 0 = vai para o descarte). Se a posição oposta está vazia, o dano vai direto na vida do jogador. Quem é atacado não revida.
- Limite de **60 turnos** (contando os dois jogadores): vence quem tem mais vida; empate = empate.
- **Desistência:** qualquer jogador pode desistir a qualquer momento (mesmo fora da vez dele). A partida termina na hora e o **adversário vence**; vida, campo e mãos ficam como estavam. É um motivo de fim de jogo como os outros (`endReason`: `hp_zero`, `turn_limit`, `forfeit`).

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
| Épica | 3 | 27 |
| Lendária | 3 | 28 |

- **Limite de poder do baralho: 110** (soma dos poderes das 7 cartas).
- **Bônus por categoria da foto** (fase 2): até **+10% do orçamento** (arredondado para baixo, **mínimo +1** quando a categoria tem bônus), e conta para o limite do baralho. Exemplo: galinha ganha mais que formiga, mas nunca muito. Teto por raridade: comum +1, incomum +1, rara +1, épica +2, lendária +2.
- **Melhoria de carta** (fase 5): até **+25%** do orçamento, arredondado para baixo, com teto por raridade (comum +2, incomum +3, rara +4, épica +6, lendária +7).
- **Teto de poder de uma carta** = orçamento + bônus de foto + melhoria (comum 12, incomum 19, rara 23, épica 35, lendária 37). `validateDeck` aceita cartas até esse teto; o limite de 110 do baralho conta o **poder real** das cartas.
- Atributos e raridade vêm sempre do servidor; o cliente nunca decide.

## Cartas fixas da fase 1

30 cartas, 6 por elemento (2 comuns, 1 incomum, 1 rara, 1 épica, 1 lendária), cada uma gastando exatamente o orçamento da sua raridade (épicas: 27). A lista completa e os baralhos prontos do bot estão em `engine/src/cards.ts` e `engine/src/deck.ts`; não duplique a tabela aqui.

## Balanceamento

Primeira rodada (PR #1, simulador com 20 mil partidas, bot guloso contra bot guloso):

- **Antes:** Ent (planta, lendária) vencia 60,6% e Águia (ar, épica) 38,3%, fora da faixa-alvo de 40% a 60%. Causa: Poder = 2×Ataque + Vida barateia a vida, e as épicas rendiam menos que o poder indica (média de 44,7%).
- **Redistribuição de ataque/vida** (mesmo poder): Ent 9/10, Baleia 9/10, Condor 10/8, Águia 10/7, Foca 5/8 e Elefante 7/13. Resultado: pior carta a 9 pontos de 50% (antes 11,7), nenhuma fora de 40% a 60%.
- **Orçamento da épica de 24 para 27**, o que também mudou Leão (9/9), Urso (8/11) e Tubarão (9/9). Resultado: épicas de 44,7% para 48,4%; pior carta a 6,3 pontos de 50%; todas as raridades entre 48% e 53%.
- Segundo jogador com +2 de energia no primeiro turno: vitória de quem começa em ~51%.

Orçamento da épica em 27 aprovado pelo usuário em 2026-11-08 (a v0 original era 24). Rodar o simulador de novo se alguma regra mudar. Critério de aceite da fase 1: nenhuma carta passa de 60% nos baralhos em que aparece.

## Como propor mudança de regra

1. Mude o valor no simulador com as opções de linha de comando (`--hp`, `--energy`, `--limit`, `--bonus`, `--sick`, `--adv`, `--dis`) e compare.
2. Se melhorar, mude `DEFAULT_RULES`, os testes e este doc no mesmo PR.
3. Registre a decisão em `decisoes.md`.
