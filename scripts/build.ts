import { $ } from 'bun';
import { mkdirSync, existsSync, rmSync } from 'fs';

const targets = [
  { target: 'bun-linux-x64', name: 'vibe-linux-x64' },
  { target: 'bun-windows-x64', name: 'vibe-windows-x64.exe' },
];

console.log('Building Vibe binaries...\n');

if (existsSync('dist')) {
  rmSync('dist', { recursive: true });
}
mkdirSync('dist', { recursive: true });

for (const { target, name } of targets) {
  console.log(`Building ${name}...`);
  await $`bun build --compile --target=${target} ./src/index.ts --outfile ./dist/${name}`;
  console.log(`  ✓ dist/${name}\n`);
}

console.log('Done! Binaries are in dist/');
