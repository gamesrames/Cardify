// Empacota a Edge Function num arquivo só, com o motor de combate dentro.
// Motivo: o Deno exige extensão nos imports (`./types.ts`) e o motor não usa;
// o esbuild resolve tudo e entrega um arquivo que o Supabase aceita.
// Uso: npm run build  (gera functions/create-card/index.ts e functions/match/index.ts; commite o resultado).
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// A versão do imagescript no Deno é a MESMA testada aqui (a API mudou entre versões).
const imagescriptVersion = JSON.parse(readFileSync('node_modules/imagescript/package.json', 'utf8')).version;

const NPM_VERSIONS = {
  imagescript: `npm:imagescript@${imagescriptVersion}`,
  '@supabase/supabase-js': 'npm:@supabase/supabase-js@2',
};

const FUNCTIONS = ['create-card', 'match'];

for (const name of FUNCTIONS) {
  await build({
    entryPoints: [`src/${name}/index.ts`],
    outfile: `functions/${name}/index.ts`,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    banner: { js: `// GERADO por \`npm run build\` (supabase/build.mjs). Não edite: mude src/${name}/.` },
    plugins: [
      {
        name: 'npm-para-deno',
        setup(b) {
          b.onResolve({ filter: /^(imagescript|@supabase\/supabase-js)$/ }, (args) => ({
            path: NPM_VERSIONS[args.path],
            external: true,
          }));
        },
      },
    ],
  });
}
console.log('OK: ' + FUNCTIONS.map((n) => `functions/${n}/index.ts`).join(', '));
