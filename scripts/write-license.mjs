// Gera src/license.local.ts a partir da variável de ambiente PRIMEUI_LICENSE
// (usada no build do Cloudflare). Local: se o arquivo já existe e a variável
// não está definida, mantém o arquivo. Sem nenhum dos dois, gera chave vazia.
import { existsSync, writeFileSync } from 'node:fs';

const file = new URL('../src/license.local.ts', import.meta.url);
const key = process.env.PRIMEUI_LICENSE;

if (key) {
  writeFileSync(file, `export const PRIMEUI_LICENSE = ${JSON.stringify(key.trim())};\n`);
  console.log('license.local.ts gerado a partir de PRIMEUI_LICENSE');
} else if (!existsSync(file)) {
  writeFileSync(file, `export const PRIMEUI_LICENSE = '';\n`);
  console.warn('PRIMEUI_LICENSE não definida: build sem licença PrimeUI.');
}
