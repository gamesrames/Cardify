// Diz ao TypeScript o que é um `import` de arquivo de som. O Metro (empacotador do Expo) troca o
// import por um identificador do recurso; é esse valor que o expo-audio recebe.
declare module '*.wav' {
  const asset: number;
  export default asset;
}
