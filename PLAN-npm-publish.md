# Plan: Publish Vibe CLI to npm as @vibe-lang/vibe

## Goal
Enable users to install Vibe globally via `npm install -g @vibe-lang/vibe` and run scripts with `vibe script.vibe`. No separate Bun installation required.

## Approach
Use `bun build --compile` to create standalone binaries for each platform, then distribute via npm using the optional dependencies pattern (like esbuild/swc/turbo).

## Package Structure

```
@vibe-lang/vibe           <- Main package (wrapper + optionalDependencies)
@vibe-lang/vibe-linux-x64      <- Linux x64 binary
@vibe-lang/vibe-darwin-arm64   <- macOS Apple Silicon binary
@vibe-lang/vibe-darwin-x64     <- macOS Intel binary
@vibe-lang/vibe-windows-x64    <- Windows binary
```

---

## Step 1: Create Build Script

**File:** `scripts/build.ts`

```typescript
import { $ } from 'bun';

const targets = [
  { target: 'bun-linux-x64', name: 'vibe-linux-x64' },
  { target: 'bun-darwin-arm64', name: 'vibe-darwin-arm64' },
  { target: 'bun-darwin-x64', name: 'vibe-darwin-x64' },
  { target: 'bun-windows-x64', name: 'vibe-windows-x64.exe' },
];

for (const { target, name } of targets) {
  console.log(`Building ${name}...`);
  await $`bun build --compile --target=${target} ./src/index.ts --outfile ./dist/${name}`;
}
```

---

## Step 2: Create Platform Package Structure

**Directory:** `npm/` (for platform-specific packages)

```
npm/
├── vibe-linux-x64/
│   ├── package.json
│   └── bin/vibe          <- binary goes here after build
├── vibe-darwin-arm64/
│   ├── package.json
│   └── bin/vibe
├── vibe-darwin-x64/
│   ├── package.json
│   └── bin/vibe
└── vibe-windows-x64/
    ├── package.json
    └── bin/vibe.exe
```

**Example:** `npm/vibe-linux-x64/package.json`
```json
{
  "name": "@vibe-lang/vibe-linux-x64",
  "version": "0.1.0",
  "description": "Vibe CLI binary for Linux x64",
  "os": ["linux"],
  "cpu": ["x64"],
  "bin": {
    "vibe": "bin/vibe"
  },
  "files": ["bin/vibe"],
  "license": "MIT"
}
```

---

## Step 3: Create Main Package Wrapper

**File:** `npm/vibe/package.json`
```json
{
  "name": "@vibe-lang/vibe",
  "version": "0.1.0",
  "description": "AI agent orchestration language and runtime",
  "bin": {
    "vibe": "bin/vibe"
  },
  "files": ["bin/vibe"],
  "optionalDependencies": {
    "@vibe-lang/vibe-linux-x64": "0.1.0",
    "@vibe-lang/vibe-darwin-arm64": "0.1.0",
    "@vibe-lang/vibe-darwin-x64": "0.1.0",
    "@vibe-lang/vibe-windows-x64": "0.1.0"
  },
  "scripts": {
    "postinstall": "node scripts/postinstall.js"
  },
  "keywords": ["ai", "agent", "orchestration", "dsl", "language", "vibe"],
  "repository": {
    "type": "git",
    "url": "https://github.com/vibe-lang/vibe"
  },
  "license": "MIT"
}
```

**File:** `npm/vibe/scripts/postinstall.js`
```javascript
#!/usr/bin/env node
// Finds the platform-specific binary and symlinks/copies it to bin/vibe
const fs = require('fs');
const path = require('path');

const platform = process.platform;
const arch = process.arch;

const platformMap = {
  'linux-x64': '@vibe-lang/vibe-linux-x64',
  'darwin-arm64': '@vibe-lang/vibe-darwin-arm64',
  'darwin-x64': '@vibe-lang/vibe-darwin-x64',
  'win32-x64': '@vibe-lang/vibe-windows-x64',
};

const key = `${platform}-${arch}`;
const pkgName = platformMap[key];

if (!pkgName) {
  console.error(`Unsupported platform: ${key}`);
  process.exit(1);
}

try {
  const binName = platform === 'win32' ? 'vibe.exe' : 'vibe';
  const srcPath = require.resolve(`${pkgName}/bin/${binName}`);
  const destPath = path.join(__dirname, '..', 'bin', binName);

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  fs.chmodSync(destPath, 0o755);
} catch (e) {
  console.error('Failed to install vibe binary:', e.message);
  process.exit(1);
}
```

---

## Step 4: Create Publish Script

**File:** `scripts/publish.ts`

```typescript
import { $ } from 'bun';

const version = '0.1.0';

// 1. Build all binaries
await $`bun run scripts/build.ts`;

// 2. Copy binaries to platform packages
await $`cp dist/vibe-linux-x64 npm/vibe-linux-x64/bin/vibe`;
await $`cp dist/vibe-darwin-arm64 npm/vibe-darwin-arm64/bin/vibe`;
await $`cp dist/vibe-darwin-x64 npm/vibe-darwin-x64/bin/vibe`;
await $`cp dist/vibe-windows-x64.exe npm/vibe-windows-x64/bin/vibe.exe`;

// 3. Publish platform packages first
for (const pkg of ['linux-x64', 'darwin-arm64', 'darwin-x64', 'windows-x64']) {
  await $`cd npm/vibe-${pkg} && npm publish --access public`;
}

// 4. Publish main package
await $`cd npm/vibe && npm publish --access public`;
```

---

## Step 5: Update package.json Scripts

**File:** `package.json` (add scripts)
```json
{
  "scripts": {
    "build:binaries": "bun run scripts/build.ts",
    "publish:npm": "bun run scripts/publish.ts"
  }
}
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `scripts/build.ts` | Create - builds binaries for all platforms |
| `scripts/publish.ts` | Create - copies binaries and publishes packages |
| `npm/vibe/package.json` | Create - main package with optionalDeps |
| `npm/vibe/scripts/postinstall.js` | Create - finds and links correct binary |
| `npm/vibe-linux-x64/package.json` | Create - Linux x64 package |
| `npm/vibe-darwin-arm64/package.json` | Create - macOS ARM package |
| `npm/vibe-darwin-x64/package.json` | Create - macOS Intel package |
| `npm/vibe-windows-x64/package.json` | Create - Windows package |
| `package.json` | Modify - add build/publish scripts |
| `README.md` | Modify - add installation instructions |

---

## User Experience

```bash
# Install globally
npm install -g @vibe-lang/vibe

# Run a script
vibe script.vibe

# Or use npx
npx @vibe-lang/vibe script.vibe
```

No Bun installation required - the binary is self-contained.

---

## Verification Steps

1. Build binaries: `bun run build:binaries`
2. Test binary locally: `./dist/vibe-linux-x64 examples/hello.vibe`
3. Test npm pack: `cd npm/vibe && npm pack`
4. Test local install: `npm install -g ./npm/vibe/vibe-0.1.0.tgz`
5. Publish: `bun run publish:npm`
