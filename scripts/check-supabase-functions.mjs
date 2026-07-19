import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const functions = ['notify-telegram', 'fetch-item-prices'];

for (const name of functions) {
  const sourcePath = path.join(root, 'sklad/supabase/functions', name, 'index.ts');
  const cliPath = path.join(root, 'supabase/functions', name, 'index.ts');

  if (!fs.existsSync(sourcePath)) {
    console.error(`Missing historical Edge Function source: ${sourcePath}`);
    process.exitCode = 1;
    continue;
  }
  if (!fs.existsSync(cliPath)) {
    console.error(`Missing Supabase CLI Edge Function mirror: ${cliPath}`);
    process.exitCode = 1;
    continue;
  }

  const source = fs.readFileSync(sourcePath, 'utf8').trimEnd();
  const cli = fs.readFileSync(cliPath, 'utf8').trimEnd();
  if (source !== cli) {
    console.error(`Edge Function mirror drifted from source: ${name}`);
    process.exitCode = 1;
  }
}

const configPath = path.join(root, 'supabase/config.toml');
const config = fs.readFileSync(configPath, 'utf8');
for (const name of functions) {
  if (!config.includes(`[functions.${name}]`) || !config.match(new RegExp(`\\[functions\\.${name}\\][\\s\\S]*?verify_jwt\\s*=\\s*false`))) {
    console.error(`supabase/config.toml must disable JWT verification for ${name}`);
    process.exitCode = 1;
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`ok - ${functions.length} Supabase CLI Edge Function mirrors match sklad/supabase/functions`);
