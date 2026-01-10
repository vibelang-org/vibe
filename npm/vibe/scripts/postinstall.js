#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const platform = process.platform;
const arch = process.arch;

const platformMap = {
  'linux-x64': '@vibe-lang/vibe-linux-x64',
  'win32-x64': '@vibe-lang/vibe-windows-x64',
};

const key = `${platform}-${arch}`;
const pkgName = platformMap[key];

if (!pkgName) {
  console.warn(`Warning: No prebuilt binary for ${key}. Vibe may not work on this platform.`);
  process.exit(0);
}

try {
  const binName = platform === 'win32' ? 'vibe.exe' : 'vibe';
  const srcPath = require.resolve(`${pkgName}/bin/${binName}`);
  const destDir = path.join(__dirname, '..', 'bin');
  const destPath = path.join(destDir, binName);

  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcPath, destPath);

  if (platform !== 'win32') {
    fs.chmodSync(destPath, 0o755);
  }

  console.log(`Vibe installed successfully for ${key}`);
} catch (e) {
  console.error('Failed to install vibe binary:', e.message);
  process.exit(1);
}
