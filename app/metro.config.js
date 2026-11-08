// Configuração do Metro (o "empacotador" do Expo, parecido com o MSBuild do .NET).
// O app importa o motor de ../engine, que fica FORA da pasta app/. Por padrão o Metro
// só enxerga a própria pasta, então avisamos que a pasta do motor também deve ser lida.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const engineRoot = path.resolve(__dirname, '../engine');
config.watchFolders = [...(config.watchFolders ?? []), engineRoot];

// O motor tem as próprias dependências de desenvolvimento (vitest, tsx...). O app não usa
// nenhuma, então o Metro ignora essa pasta (fica mais rápido e evita conflitos de versão).
const ignoreEngineModules = new RegExp(
  `${path.join(engineRoot, 'node_modules').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[/\\\\].*`,
);
const currentBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(currentBlockList) ? currentBlockList : currentBlockList ? [currentBlockList] : []),
  ignoreEngineModules,
];

module.exports = config;
