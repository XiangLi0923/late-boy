import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(webRoot, 'dist');
const dest = resolve(webRoot, '..', 'desktop', 'renderer');

if (!existsSync(src)) {
  console.error('未找到 frontends/web/dist，请先执行 npm run build');
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`已同步网页版构建产物到桌面版: ${dest}`);
