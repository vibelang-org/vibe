# Plan: Publish Vibe CLI to npm as @vibe-lang/vibe

## Goal
Enable users to install Vibe globally via `npm install -g @vibe-lang/vibe` and run scripts with `vibe script.vibe`. No separate Bun installation required.

## Approach
Use `bun` as an npm dependency. The published package includes the TypeScript source and a thin Node.js wrapper that spawns `bun` to run the Vibe runtime. This avoids the complexity of compiling and distributing platform-specific binaries.

### Why This Approach?

| Aspect | Bun as Dependency | Compiled Binaries |
|--------|-------------------|-------------------|
| Package size | ~50MB (bun, shared) | ~50-80MB per platform |
| Build complexity | Very simple | Complex (multiple platforms) |
| Startup time | Slightly slower (spawns bun) | Faster (single executable) |
| Maintenance | Automatic bun updates | Manual recompilation |
| Packages to publish | 1 | 5 (main + 4 platforms) |

---

## Package Structure

```
@vibe-lang/vibe/
├── package.json
├── bin/
│   └── vibe.js          <- Node.js wrapper that spawns bun
├── src/
│   ├── index.ts         <- Main entry point
│   ├── lexer.ts
│   ├── parser.ts
│   ├── runtime.ts
│   └── ...
└── README.md
```

---

## Step 1: Create CLI Wrapper

**File:** `bin/vibe.js`

```javascript
#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Resolve the bun binary from our dependency
let bunPath;
try {
  bunPath = require.resolve('bun/bin/bun');
} catch {
  // Fallback for Windows where the path might differ
  bunPath = require.resolve('bun/bin/bun.exe');
}

// Path to our TypeScript entry point
const cliPath = path.join(__dirname, '..', 'src', 'index.ts');

// Spawn bun with the same arguments
const child = spawn(bunPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
```

---

## Step 2: Create npm Package Configuration

**File:** `npm/package.json` (to be copied during publish)

```json
{
  "name": "@vibe-lang/vibe",
  "version": "0.1.0",
  "description": "AI agent orchestration language and runtime",
  "bin": {
    "vibe": "bin/vibe.js"
  },
  "files": [
    "bin/",
    "src/",
    "README.md"
  ],
  "dependencies": {
    "bun": "^1.0.0"
  },
  "keywords": [
    "ai",
    "agent",
    "orchestration",
    "dsl",
    "language",
    "vibe",
    "llm"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/vibe-lang/vibe"
  },
  "homepage": "https://github.com/vibe-lang/vibe",
  "bugs": {
    "url": "https://github.com/vibe-lang/vibe/issues"
  },
  "license": "MIT",
  "engines": {
    "node": ">=18"
  }
}
```

---

## Step 3: Create Publish Script

**File:** `scripts/publish.ts`

```typescript
import { $ } from 'bun';
import { readFileSync, writeFileSync, cpSync, mkdirSync } from 'fs';
import { join } from 'path';

const version = process.argv[2] || '0.1.0';
const distDir = 'dist/npm';

console.log(`Preparing @vibe-lang/vibe v${version} for publishing...`);

// 1. Clean and create dist directory
await $`rm -rf ${distDir}`;
mkdirSync(distDir, { recursive: true });

// 2. Copy source files
cpSync('src', join(distDir, 'src'), { recursive: true });
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
    bun: '^1.0.0',
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
cpSync('README.md', join(distDir, 'README.md'));

console.log(`\nPackage prepared in ${distDir}/`);
console.log('\nTo publish:');
console.log(`  cd ${distDir} && npm publish --access public`);
console.log('\nTo test locally:');
console.log(`  cd ${distDir} && npm pack`);
console.log(`  npm install -g vibe-lang-vibe-${version}.tgz`);
```

---

## Step 4: Update package.json Scripts

**File:** `package.json` (add scripts)

```json
{
  "scripts": {
    "prepublish": "bun run scripts/publish.ts",
    "publish:npm": "bun run scripts/publish.ts && cd dist/npm && npm publish --access public"
  }
}
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `scripts/publish.ts` | Create - prepares package for publishing |
| `bin/vibe.js` | Create - CLI wrapper (generated by publish script) |
| `package.json` | Modify - add publish scripts |
| `README.md` | Modify - add installation instructions |

---

## User Experience

```bash
# Install globally
npm install -g @vibe-lang/vibe

# Run a script
vibe script.vibe

# Or use npx (no install)
npx @vibe-lang/vibe script.vibe
```

The `bun` runtime is automatically installed as a dependency - no manual Bun installation required.

---

## Verification Steps

1. Prepare package: `bun run scripts/publish.ts 0.1.0`
2. Test npm pack: `cd dist/npm && npm pack`
3. Test local install: `npm install -g ./vibe-lang-vibe-0.1.0.tgz`
4. Verify it works: `vibe examples/hello.vibe`
5. Publish: `cd dist/npm && npm publish --access public`

---

## Notes

- The `bun` npm package handles platform detection automatically
- Users on unsupported platforms will get an error from the `bun` package during install
- The wrapper adds ~10-20ms startup overhead vs a compiled binary
- Source maps work correctly since we're running TypeScript directly
