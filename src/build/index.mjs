import fs from 'node:fs';
import { validateAll } from './validate.mjs';
import { emitColors } from './emit-colors.mjs';
import { emitBootstrap } from './emit-bootstrap.mjs';
import { emitFonts } from './emit-fonts.mjs';
import { emitImages } from './emit-images.mjs';
import { emitManifest } from './emit-manifest.mjs';
import { emitTailwind } from './emit-tailwind.mjs';

try {
  const { tokens, colors, report } = validateAll();
  const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
  fs.mkdirSync('build', { recursive: true });
  fs.writeFileSync('build/computed.json', JSON.stringify(colors, null, 1) + '\n');
  emitColors(tokens, colors, 'dist/colors', version);
  emitFonts(tokens, 'dist/fonts');
  const images = await emitImages(tokens, 'dist/images');
  emitBootstrap(tokens, 'dist/colors', 'dist/bootstrap');
  emitTailwind(tokens, 'dist/tailwind');
  fs.writeFileSync('dist/contrast-report.json', JSON.stringify({ allowListed: report.allowed, total: report.total }, null, 1) + '\n');
  fs.copyFileSync('LICENSE', 'dist/LICENSE'); // the release zip must carry the licence
  const manifest = emitManifest(tokens, 'dist', { version, contrast: report });
  console.log(`wrote dist/ (manifest: ${manifest.files.length} files) -> dist/colors/, dist/bootstrap/, dist/tailwind/, dist/fonts/, dist/images/ (${images} files) and build/computed.json (${Object.keys(colors).length} colours), contrast exceptions: ${report.allowed.length}`);
} catch (e) {
  console.error(e.message);
  process.exit(1); // never publish from a failed build
}
