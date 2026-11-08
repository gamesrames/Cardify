# Cardify

Jogo de cartas para celular em que fotos viram cartas colecionáveis. Este repositório está na **fase 1: protótipo offline** (cartas fixas, combate contra bot, sem servidor).

Escopo e decisões: https://claude.ai/artifact/4sJnNsdYxhY1etzsR6ZmTQ

## Estrutura

- `engine/` — motor de combate em TypeScript puro (sem tela), testes e simulador. É o mesmo código que vai rodar no app e, depois, no servidor.

## Rodando o motor

Precisa de Node 20 ou mais novo.

```bash
cd engine
npm install
npm test            # testes do motor
npm run typecheck   # checagem de tipos (como o compilador do C#)
npm run sim -- --games 10000   # simulador: acha cartas fortes/fracas demais
```

Variações de regra no simulador: `--bonus 2`, `--sick 1`, `--limit 100`, `--hp 20`, `--energy 3`, `--adv 1.5`, `--dis 0.75`, `--quiet 1`.
