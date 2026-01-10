#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const binName = isWindows ? 'vibe.exe' : 'vibe';
const binPath = path.join(__dirname, binName);

const child = spawn(binPath, process.argv.slice(2), {
  stdio: 'inherit',
  shell: false,
});

child.on('error', (err) => {
  console.error(`Failed to start vibe: ${err.message}`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
