#!/usr/bin/env node
// Генерує src/*.js з src/*.ts для модулів, де TypeScript — джерело істини.
// Модулі з `export declare function` — навпаки: реалізація живе в .js, а .ts
// лише описує контракт (їх цей скрипт не чіпає).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');

export const isDeclarationShim = (source) => /^export\s+declare\s+function\b/m.test(source);

export function tsSourceModules() {
  return fs.readdirSync(srcDir)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts') && file !== 'database.types.ts')
    .filter((file) => !isDeclarationShim(fs.readFileSync(path.join(srcDir, file), 'utf8')))
    .sort();
}

export function generateJs(tsFile) {
  const source = fs.readFileSync(path.join(srcDir, tsFile), 'utf8');
  const { code } = transformSync(source, { loader: 'ts', format: 'esm', target: 'es2022', charset: 'utf8', sourcefile: tsFile });
  const body = code.replace(/(\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.\.?\/[^'"]+)\.ts\2/g, '$1$2$3.js$2');
  return `// Згенеровано з src/${tsFile} (scripts/build-js-fallback.mjs). Не редагувати вручну.\n${body}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const tsFile of tsSourceModules()) {
    fs.writeFileSync(path.join(srcDir, tsFile.replace(/\.ts$/, '.js')), generateJs(tsFile));
  }
  console.log(`generated ${tsSourceModules().length} JS modules from TypeScript`);
}
