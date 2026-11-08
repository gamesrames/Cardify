// Ponto ÚNICO de contato entre o app e o motor de combate (pasta engine/).
// Toda tela importa o motor daqui, nunca direto de ../../engine. Assim, se o contrato do
// motor mudar, só este arquivo precisa ser revisado. O motor é TypeScript puro: o mesmo
// código roda aqui, nos testes e (fases 2 a 4) no servidor.
export * from '../../engine/src/index';
