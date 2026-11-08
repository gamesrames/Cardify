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

## Em aberto

- Ajuste da fórmula de poder: vida está barateada; Ent (60,6%) e Águia (38,3%) saíram da faixa de 40% a 60% no simulador (ver `game-design.md`).
- Tamanho final do bônus de categoria e do teto de melhoria por raridade.
- Biblioteca de classificação de foto no celular.
- Bibliotecas de navegação e de estado do app.
