import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fallbackPairs = [
  ['src/app-security.ts', 'src/app-security.js'],
  ['src/auth-session.ts', 'src/auth-session.js'],
  ['src/shell-state.ts', 'src/shell-state.js'],
  ['src/supabase-api.ts', 'src/supabase-api.js'],
  ['src/promin-api.ts', 'src/promin-api.js'],
  ['src/osbb-auto-lock.ts', 'src/osbb-auto-lock.js'],
  ['src/osbb-calendar.ts', 'src/osbb-calendar.js'],
  ['src/osbb-client-state.ts', 'src/osbb-client-state.js'],
  ['src/osbb-attendance.ts', 'src/osbb-attendance.js'],
  ['src/osbb-attendance-controller.ts', 'src/osbb-attendance-controller.js'],
  ['src/osbb-dispatcher.ts', 'src/osbb-dispatcher.js'],
  ['src/osbb-elevator.ts', 'src/osbb-elevator.js'],
  ['src/osbb-garbage.ts', 'src/osbb-garbage.js'],
  ['src/osbb-garbage-controller.ts', 'src/osbb-garbage-controller.js'],
  ['src/osbb-lightbox-controller.ts', 'src/osbb-lightbox-controller.js'],
  ['src/osbb-lock-controller.ts', 'src/osbb-lock-controller.js'],
  ['src/osbb-offline.ts', 'src/osbb-offline.js'],
  ['src/osbb-pin-modal-controller.ts', 'src/osbb-pin-modal-controller.js'],
  ['src/osbb-photos.ts', 'src/osbb-photos.js'],
  ['src/osbb-photo-controller.ts', 'src/osbb-photo-controller.js'],
  ['src/pin-entry.ts', 'src/pin-entry.js'],
  ['src/osbb-state.ts', 'src/osbb-state.js'],
  ['src/osbb-shifts.ts', 'src/osbb-shifts.js'],
  ['src/osbb-shift-settings-controller.ts', 'src/osbb-shift-settings-controller.js'],
  ['src/osbb-shift-calendar-controller.ts', 'src/osbb-shift-calendar-controller.js'],
  ['src/osbb-staff.ts', 'src/osbb-staff.js'],
  ['src/osbb-staff-auth-controller.ts', 'src/osbb-staff-auth-controller.js'],
  ['src/osbb-tickets.ts', 'src/osbb-tickets.js'],
  ['src/sklad-audit.ts', 'src/sklad-audit.js'],
  ['src/sklad-audit-controller.ts', 'src/sklad-audit-controller.js'],
  ['src/sklad-auth-controller.ts', 'src/sklad-auth-controller.js'],
  ['src/sklad-auth.ts', 'src/sklad-auth.js'],
  ['src/sklad-client-state.ts', 'src/sklad-client-state.js'],
  ['src/sklad-data-controller.ts', 'src/sklad-data-controller.js'],
  ['src/sklad-delete-pin-controller.ts', 'src/sklad-delete-pin-controller.js'],
  ['src/sklad-modal-controller.ts', 'src/sklad-modal-controller.js'],
  ['src/sklad-item-menu-controller.ts', 'src/sklad-item-menu-controller.js'],
  ['src/sklad-item-crud-controller.ts', 'src/sklad-item-crud-controller.js'],
  ['src/sklad-dates.ts', 'src/sklad-dates.js'],
  ['src/sklad-domain.ts', 'src/sklad-domain.js'],
  ['src/sklad-movements.ts', 'src/sklad-movements.js'],
  ['src/sklad-movements-controller.ts', 'src/sklad-movements-controller.js'],
  ['src/sklad-pricing.ts', 'src/sklad-pricing.js'],
  ['src/sklad-photo-controller.ts', 'src/sklad-photo-controller.js'],
  ['src/sklad-reporting.ts', 'src/sklad-reporting.js'],
  ['src/sklad-state.ts', 'src/sklad-state.js'],
  ['src/sklad-suppliers.ts', 'src/sklad-suppliers.js'],
  ['src/sklad-supplier-controller.ts', 'src/sklad-supplier-controller.js'],
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
