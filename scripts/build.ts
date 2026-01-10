import { $ } from 'bun';
import { mkdirSync, existsSync, rmSync } from 'fs';

// Use baseline targets for x64 platforms to avoid AVX2 requirement
// This ensures compatibility with older CPUs (pre-2013)
const targets = [
  { target: 'bun-linux-x64-baseline', name: 'vibe-linux-x64' },
  { target: 'bun-darwin-arm64', name: 'vibe-darwin-arm64' },  // ARM64 doesn't need baseline
  { target: 'bun-darwin-x64-baseline', name: 'vibe-darwin-x64' },
  { target: 'bun-windows-x64-baseline', name: 'vibe-windows-x64.exe' },
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
