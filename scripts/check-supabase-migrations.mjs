import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'sklad/supabase');
const migrationDir = path.join(root, 'supabase/migrations');

const sources = fs.readdirSync(sourceDir)
  .filter((name) => /^\d{3}_.+\.sql$/.test(name))
  .sort();

if (!sources.length) {
  console.error('No historical SQL files found in sklad/supabase');
  process.exit(1);
}

for (const sourceName of sources) {
  const [sequence, ...restParts] = sourceName.split('_');
  const migrationName = `202607190${sequence}00_${restParts.join('_')}`;
  const sourcePath = path.join(sourceDir, sourceName);
  const migrationPath = path.join(migrationDir, migrationName);

  if (!fs.existsSync(migrationPath)) {
    console.error(`Missing Supabase CLI migration mirror: ${migrationName}`);
    process.exitCode = 1;
    continue;
  }

  const sourceSql = fs.readFileSync(sourcePath, 'utf8').trimEnd();
  const migrationSql = fs.readFileSync(migrationPath, 'utf8').trimEnd();
  const migrationBody = migrationSql.split('\n').slice(3).join('\n');

  if (migrationBody !== sourceSql) {
    console.error(`Migration mirror drifted from source: ${migrationName}`);
    process.exitCode = 1;
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`ok - ${sources.length} Supabase CLI migration mirrors match sklad/supabase SQL files`);
