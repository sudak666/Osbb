#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const files = [
  'manifest.json',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
  'osbb/manifest.json',
  'osbb/sw.js',
  'osbb/icon-192.png',
  'osbb/icon-512.png',
  'sklad/manifest.json',
  'sklad/sw.js',
  'sklad/icon-192.png',
  'sklad/icon-512.png',
];

for (const file of files) {
  if (!existsSync(file)) continue;
  const dest = join('dist', file);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(file, dest);
}
