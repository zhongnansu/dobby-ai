const esbuild = require('esbuild');
const fs = require('fs');

const DIST = 'dist';

async function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // Bundle content script
  await esbuild.build({
    entryPoints: ['src/content/index.js'],
    bundle: true,
    outfile: `${DIST}/content.js`,
    format: 'iife',
    target: 'chrome115',
    minify: false,
  });

  // Bundle background service worker
  await esbuild.build({
    entryPoints: ['src/background/index.js'],
    bundle: true,
    outfile: `${DIST}/background.js`,
    format: 'iife',
    target: 'chrome115',
    minify: false,
  });

  // Bundle popup and options
  await esbuild.build({
    entryPoints: ['src/popup.js', 'src/options.js'],
    bundle: true,
    outdir: DIST,
    format: 'iife',
    target: 'chrome115',
    minify: false,
  });

  // Copy static assets
  fs.copyFileSync('popup.html', `${DIST}/popup.html`);
  fs.copyFileSync('options.html', `${DIST}/options.html`);

  // Copy manifest with bundled file paths
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  manifest.content_scripts[0].js = ['content.js'];
  manifest.background.service_worker = 'background.js';
  fs.writeFileSync(`${DIST}/manifest.json`, JSON.stringify(manifest, null, 2));

  // Copy icons
  if (fs.existsSync('icons')) {
    fs.cpSync('icons', `${DIST}/icons`, { recursive: true });
  }

  console.log('Build complete → dist/');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
