import { $ } from 'bun';
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const version = process.argv[2] || '0.1.0';
const dryRun = process.argv.includes('--dry-run');

console.log(`Publishing @vibe-lang/vibe v${version}${dryRun ? ' (dry run)' : ''}...\n`);

// 1. Build binaries for all platforms
console.log('Step 1: Building binaries...');
await $`bun run scripts/build.ts`;

// 2. Update version in all package.json files
console.log('\nStep 2: Updating versions...');

const packages = [
  'npm/vibe/package.json',
  'npm/vibe-linux-x64/package.json',
  'npm/vibe-windows-x64/package.json',
];

for (const pkgPath of packages) {
  const pkg = await Bun.file(pkgPath).json();
  pkg.version = version;

  // Update optionalDependencies versions in main package
  if (pkg.optionalDependencies) {
    for (const dep of Object.keys(pkg.optionalDependencies)) {
      pkg.optionalDependencies[dep] = version;
    }
  }

  await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  ✓ ${pkgPath}`);
}

// 3. Copy binaries to platform packages
console.log('\nStep 3: Copying binaries to packages...');

const binaries = [
  { src: 'dist/vibe-linux-x64', dest: 'npm/vibe-linux-x64/bin/vibe' },
  { src: 'dist/vibe-windows-x64.exe', dest: 'npm/vibe-windows-x64/bin/vibe.exe' },
];

for (const { src, dest } of binaries) {
  if (!existsSync(src)) {
    console.error(`  ✗ Binary not found: ${src}`);
    process.exit(1);
  }
  cpSync(src, dest);
  console.log(`  ✓ ${src} -> ${dest}`);
}

// 4. Copy README to main package
console.log('\nStep 4: Copying README...');
if (existsSync('README.md')) {
  cpSync('README.md', 'npm/vibe/README.md');
  console.log('  ✓ README.md -> npm/vibe/README.md');
}

// 5. Publish packages
console.log('\nStep 5: Publishing packages...');

const publishCmd = dryRun ? 'npm publish --access public --dry-run' : 'npm publish --access public';

// Publish platform packages first
for (const platform of ['linux-x64', 'windows-x64']) {
  const pkgDir = `npm/vibe-${platform}`;
  console.log(`\n  Publishing @vibe-lang/vibe-${platform}...`);

  if (dryRun) {
    await $`cd ${pkgDir} && npm publish --access public --dry-run`.quiet();
  } else {
    await $`cd ${pkgDir} && npm publish --access public`;
  }
  console.log(`  ✓ @vibe-lang/vibe-${platform}@${version}`);
}

// Publish main package
console.log('\n  Publishing @vibe-lang/vibe...');
if (dryRun) {
  await $`cd npm/vibe && npm publish --access public --dry-run`.quiet();
} else {
  await $`cd npm/vibe && npm publish --access public`;
}
console.log(`  ✓ @vibe-lang/vibe@${version}`);

console.log(`\n✓ All packages published${dryRun ? ' (dry run)' : ''}!`);
console.log('\nTo install:');
console.log('  npm install -g @vibe-lang/vibe');
