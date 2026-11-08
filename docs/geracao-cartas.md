# Geração de cartas, duplicatas e moderação

Fase 2 em diante. Dono: thread de geração de cartas (junto com backend no começo).

## Estado atual

Nada implementado. As decisões abaixo estão fechadas; o fluxo técnico detalhado é **proposta**.

## Decidido

- Foto tirada pela câmera **do app** vira carta. Limite diário de fotos: 14 nos testes, 3 no final.
- O **servidor sorteia uma semente aleatória** na criação da carta e a salva. A foto não define os atributos por si só.
- **Raridade e atributos vêm do servidor.** O cliente só informa a foto e a classificação.
- A **categoria da foto** (formiga, galinha...) dá um bônus pequeno e limitado: até +10% do orçamento de poder, que conta para o limite do baralho (fórmulas em `game-design.md`).
- **Hash perceptual** bloqueia fotos quase iguais (duplicatas). Não é usado para definir atributos.
- Fraude de foto (foto de tela, foto da internet): caminho "inocente" por enquanto, só amigos próximos.
- Fotos visíveis para o adversário. Sem restrição de conteúdo no protótipo.
- Remoção do EXIF (localização etc.) no celular, antes de enviar.

## Fluxo previsto (proposta)

1. App tira a foto, remove o EXIF e classifica no próprio celular (categoria, elemento, bônus). Isso exige development build.
2. App envia a foto e a classificação ao servidor.
3. Servidor confere o limite diário, calcula o hash perceptual e recusa duplicatas.
4. Servidor sorteia a semente, define raridade e atributos dentro do orçamento de poder da raridade (mais o bônus de categoria limitado) e grava a carta.
5. App recebe a carta pronta. Meta: menos de 10 segundos da foto à carta.

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

- Modelo/biblioteca de classificação no celular e a lista de categorias com seus bônus.
- Algoritmo e limiar do hash perceptual.
- Como o bônus de categoria entra na distribuição de ataque e vida.
