import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fallbackPairs = [
  ['src/auth-session.ts', 'src/auth-session.js'],
  ['src/shell-state.ts', 'src/shell-state.js'],
  ['src/supabase-api.ts', 'src/supabase-api.js'],
  ['src/shell-controller.ts', 'src/shell-controller.js'],
  ['src/shell.ts', 'src/shell.js'],
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exportedNames(source) {
  const names = new Set();
  for (const match of source.matchAll(/^export\s+(?:declare\s+)?(?:const|let|var|function|class|interface|type)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (match[0].includes(' interface ') || match[0].includes(' type ')) continue;
    names.add(match[1]);
  }
  for (const match of source.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const part of match[1].split(',')) {
      const [name] = part.trim().split(/\s+as\s+/);
      if (name) names.add(name.trim());
    }
  }
  return [...names].sort();
}

function localImports(source) {
  return [...source.matchAll(/^import\s+(?!type\b).*?from\s+['"](\.\.?\/[^'"]+)['"]/gm)]
    .map((match) => match[1])
    .sort();
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`Mismatch: ${label}`);
    console.error('expected:', expected);
    console.error('actual:  ', actual);
    process.exitCode = 1;
  }
}

for (const [tsPath, jsPath] of fallbackPairs) {
  const tsSource = read(tsPath);
  const jsSource = read(jsPath);

  assertEqual(exportedNames(jsSource), exportedNames(tsSource), `${jsPath} exports mirror ${tsPath}`);

  const expectedJsImports = localImports(tsSource).map((specifier) => specifier.replace(/\.ts$/, '.js'));
  assertEqual(localImports(jsSource), expectedJsImports, `${jsPath} local imports mirror ${tsPath}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`ok - ${fallbackPairs.length} JS fallback modules mirror TypeScript export/import contracts`);
