import { cp, mkdir } from 'node:fs/promises';
for (const name of ['components', 'pages', 'styles', 'assets']) {
  await mkdir(`dist/${name}`, { recursive: true });
  await cp(`src/${name}`, `dist/${name}`, { recursive: true });
}
