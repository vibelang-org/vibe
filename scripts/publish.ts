import { $ } from 'bun';
import { writeFileSync, cpSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const version = process.argv[2] || '0.1.0';
const distDir = 'dist/npm';

console.log(`Preparing @vibe-lang/vibe v${version} for publishing...`);

// 1. Clean and create dist directory
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
}
mkdirSync(distDir, { recursive: true });

// 2. Copy source files (excluding test files and fixtures)
cpSync('src', join(distDir, 'src'), {
  recursive: true,
  filter: (src) => {
    const normalized = src.replace(/\\/g, '/');
    return !normalized.includes('.test.') &&
           !normalized.includes('/test/') &&
           !normalized.includes('/test\\');
  }
});
mkdirSync(join(distDir, 'bin'), { recursive: true });

// 3. Create the CLI wrapper
const cliWrapper = `#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

let bunPath;
try {
  bunPath = require.resolve('bun/bin/bun');
} catch {
  try {
    bunPath = require.resolve('bun/bin/bun.exe');
  } catch {
    console.error('Error: Could not find bun binary. Please ensure bun is installed.');
    process.exit(1);
  }
}

const cliPath = path.join(__dirname, '..', 'src', 'index.ts');

const child = spawn(bunPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
`;

writeFileSync(join(distDir, 'bin', 'vibe.js'), cliWrapper);

// 4. Create package.json with correct version
const packageJson = {
  name: '@vibe-lang/vibe',
  version,
  description: 'AI agent orchestration language and runtime',
  bin: {
    vibe: 'bin/vibe.js',
  },
  files: ['bin/', 'src/', 'README.md'],
  dependencies: {
    '@anthropic-ai/sdk': '^0.71.2',
    '@google/genai': '^1.34.0',
    'bun': '^1.0.0',
    'chevrotain': '^11.0.3',
    'openai': '^6.15.0',
    'typescript': '^5.0.0',
  },
  keywords: ['ai', 'agent', 'orchestration', 'dsl', 'language', 'vibe', 'llm'],
  repository: {
    type: 'git',
    url: 'https://github.com/vibe-lang/vibe',
  },
  homepage: 'https://github.com/vibe-lang/vibe',
  bugs: {
    url: 'https://github.com/vibe-lang/vibe/issues',
  },
  license: 'MIT',
  engines: {
    node: '>=18',
  },
};

writeFileSync(join(distDir, 'package.json'), JSON.stringify(packageJson, null, 2));

// 5. Copy README
if (existsSync('README.md')) {
  cpSync('README.md', join(distDir, 'README.md'));
}

console.log(`\n✓ Package prepared in ${distDir}/`);
console.log('\nTo publish:');
console.log(`  cd ${distDir} && npm publish --access public`);
console.log('\nTo test locally:');
console.log(`  cd ${distDir} && npm pack`);
console.log(`  npm install -g vibe-lang-vibe-${version}.tgz`);
