import { execFileSync } from 'node:child_process';
import {
  cp,
  lstat,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

export const galleryExamples = [
  'group',
  'individual',
  'lncc',
  'writing',
  'course',
];
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function inside(parent, child) {
  const path = relative(parent, child);
  return (
    path !== '' &&
    !isAbsolute(path) &&
    path !== '..' &&
    !path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
  );
}

async function directoryWithin(parent, directory, label, optional = false) {
  if (!inside(parent, directory))
    throw new Error(`${label} must stay inside ${parent}.`);
  const entry = await lstat(directory).catch((error) => {
    if (optional && error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (!entry) return;
  if (
    entry.isSymbolicLink() ||
    !entry.isDirectory() ||
    !inside(parent, await realpath(directory))
  )
    throw new Error(
      `${label} must be a real directory inside ${parent}, not a symlink.`,
    );
}

export function galleryLocation(value) {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      'DOCS_SITE_URL must be an HTTP(S) documentation URL without credentials, query or fragment.',
    );
  if (
    url.pathname.includes('//') ||
    /[\\\x00-\x20]/.test(decodeURIComponent(url.pathname))
  )
    throw new Error('DOCS_SITE_URL must have a valid documentation path.');
  const base = `${url.pathname.replace(/\/+$/, '')}/`;
  return { origin: url.origin, base };
}

async function runExample(name, { cwd, env, outDir }) {
  const pnpm = process.env.npm_execpath;
  if (!pnpm)
    throw new Error(
      'Run the gallery through pnpm docs:gallery or pixi run --locked docs-gallery.',
    );
  execFileSync(
    process.execPath,
    [pnpm, '--filter', `sciastro-example-${name}`, 'build', '--outDir', outDir],
    {
      cwd,
      env,
      stdio: 'inherit',
    },
  );
}

/** Build example sites under the docs URL, then copy their output into an existing MkDocs build. */
export async function buildGallery({
  root = repository,
  docsUrl = process.env.DOCS_SITE_URL,
  run = runExample,
} = {}) {
  root = await realpath(root);
  // MkDocs may contain Python-specific tags for plugins. Only ordinary scalar
  // path fields are needed here; retain parser errors without resolving tags.
  const document = parseDocument(
    await readFile(join(root, 'mkdocs.yml'), 'utf8'),
  );
  if (document.errors.length) throw document.errors[0];
  const config = document.toJS();
  const location = galleryLocation(docsUrl ?? config.site_url);
  const docs = resolve(root, config.site_dir ?? 'site');
  await directoryWithin(root, docs, 'Documentation output', true);
  const index = await lstat(join(docs, 'index.html')).catch(() => undefined);
  if (!index?.isFile() || index.isSymbolicLink())
    throw new Error(
      'Build MkDocs first: the documentation output must contain index.html.',
    );
  const destination = join(docs, 'examples');
  await directoryWithin(docs, destination, 'Gallery output', true);
  const temporary = join(root, '.test-output');
  await directoryWithin(root, temporary, 'Temporary output', true);
  await mkdir(temporary, { recursive: true });
  const scratch = join(temporary, 'gallery-build');
  await directoryWithin(temporary, scratch, 'Gallery build output', true);
  await mkdir(scratch, { recursive: true });

  const built = [];
  for (const name of galleryExamples) {
    const example = join(root, 'examples', name);
    await directoryWithin(root, example, `Example ${name}`);
    const base = `${location.base}examples/${name}/`;
    const source = join(scratch, name);
    await directoryWithin(scratch, source, `Built example ${name}`, true);
    await run(name, {
      cwd: root,
      env: { ...process.env, SITE_URL: location.origin, BASE_PATH: base },
      outDir: source,
    });
    await directoryWithin(scratch, source, `Built example ${name}`);
    if (!(await lstat(join(source, 'index.html'))).isFile())
      throw new Error(`Example ${name} did not produce index.html.`);
    built.push({ name, source, base, url: `${location.origin}${base}` });
  }

  // Finish every build before replacing any existing gallery previews.
  await mkdir(destination, { recursive: true });
  for (const entry of built) {
    const target = join(destination, entry.name);
    await directoryWithin(
      destination,
      target,
      `Gallery example ${entry.name}`,
      true,
    );
    await rm(target, { recursive: true, force: true });
    await cp(entry.source, target, { recursive: true, dereference: false });
  }
  const manifest = built.map(({ name, base, url }) => ({ name, base, url }));
  await writeFile(
    join(destination, 'gallery.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  return manifest;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  buildGallery().then(
    (examples) =>
      console.log(
        `Gallery ready: ${examples.length} examples copied into the documentation build.`,
      ),
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
