const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

// Shared build options
const sharedOptions = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch,
  platform: 'node',
  target: 'node20', // VSCode 1.85+ requires Node 20
  format: 'cjs',
  external: ['vscode'], // vscode module is provided by VSCode runtime
};

// Build the extension (client)
const extensionBuild = {
  ...sharedOptions,
  entryPoints: [path.join(__dirname, 'src', 'extension.ts')],
  outfile: path.join(__dirname, 'out', 'extension.js'),
};

// Build the language server
const serverBuild = {
  ...sharedOptions,
  entryPoints: [path.join(__dirname, 'src', 'server.ts')],
  outfile: path.join(__dirname, 'out', 'server.js'),
};

async function build() {
  try {
    if (isWatch) {
      // Watch mode - rebuild on changes
      const extensionCtx = await esbuild.context(extensionBuild);
      const serverCtx = await esbuild.context(serverBuild);

      await Promise.all([
        extensionCtx.watch(),
        serverCtx.watch(),
      ]);

      console.log('Watching for changes...');
    } else {
      // Production build
      await Promise.all([
        esbuild.build(extensionBuild),
        esbuild.build(serverBuild),
      ]);

      console.log('Build complete!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
