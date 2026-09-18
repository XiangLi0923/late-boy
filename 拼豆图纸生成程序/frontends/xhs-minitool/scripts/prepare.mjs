import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const toolDir = path.resolve(scriptDir, '..');
const projectRoot = path.resolve(toolDir, '..', '..');
const sourceDir = path.join(toolDir, 'src');
const outputDir = path.join(toolDir, 'dist');
const paletteSource = path.join(
  projectRoot,
  'frontends',
  'miniapp',
  'pages',
  'index',
  'paletteData.js'
);

if (!fs.existsSync(paletteSource)) {
  throw new Error(`Palette source not found: ${paletteSource}`);
}

fs.mkdirSync(outputDir, { recursive: true });

for (const file of ['index.html', 'styles.css', 'app.js']) {
  fs.copyFileSync(path.join(sourceDir, file), path.join(outputDir, file));
}

let paletteText = fs.readFileSync(paletteSource, 'utf8');
paletteText = paletteText.replace(
  /\/\/ Auto-generated[\s\S]*?const PALETTES =/,
  '// Generated from the website palette data for the offline mini-tool.\nwindow.PERLER_PALETTES ='
);
paletteText = paletteText.replace(/\nfunction getPalette[\s\S]*$/, '\n');

if (!paletteText.includes('window.PERLER_PALETTES')) {
  throw new Error('Failed to convert palette module for browser use.');
}

fs.writeFileSync(path.join(outputDir, 'palette-data.js'), paletteText, 'utf8');

const indexPath = path.join(outputDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  throw new Error('index.html was not created.');
}

console.log(`Prepared ${outputDir}`);
