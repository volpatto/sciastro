import { createServer } from 'node:http';
import { access, readFile, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, extname, join } from 'node:path';

const [kind, portText] = process.argv.slice(2);
if (
  !['group', 'individual', 'lncc', 'writing', 'course'].includes(kind) ||
  !/^\d+$/.test(portText ?? '')
)
  throw new Error(
    'Use: node tests/browser/server.mjs group|individual|lncc|writing|course <porta>',
  );
const root = resolve('examples', kind, 'dist');
const base = kind === 'writing' ? '/caderno/' : '/';
await access(join(root, 'index.html')); // Fail clearly if the build was omitted.
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.ipynb': 'application/x-ipynb+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(
      new URL(request.url, 'http://localhost').pathname,
    );
    if (!pathname.startsWith(base)) {
      response.writeHead(404).end();
      return;
    }
    pathname = `/${pathname.slice(base.length)}`;
    let file = resolve(root, `.${pathname}`);
    const delta = relative(root, file);
    if (
      isAbsolute(delta) ||
      delta === '..' ||
      delta.startsWith('..\\') ||
      delta.startsWith('../')
    ) {
      response.writeHead(403).end();
      return;
    }
    const entry = await stat(file).catch(() => undefined);
    if (entry?.isDirectory()) file = join(file, 'index.html');
    let status = 200;
    if (!entry) {
      file = join(root, '404.html');
      status = 404;
    }
    const content = await readFile(file);
    response.writeHead(status, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 500).end();
  }
});
server.listen(Number(portText), '127.0.0.1');
// Playwright owns the server lifecycle; these never stop a development daemon.
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => server.close(() => process.exit(0)));
