import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildGallery, galleryLocation } from '../scripts/build-gallery.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-gallery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    join(root, 'mkdocs.yml'),
    'site_url: https://docs.example.org/sciastro/\nemoji_index: !!python/name:material.extensions.emoji.twemoji\n',
  );
  await mkdir(join(root, 'site'));
  await writeFile(join(root, 'site/index.html'), '<h1>Documentation</h1>');
  for (const name of ['group', 'individual', 'lncc', 'writing', 'course'])
    await mkdir(join(root, 'examples', name), { recursive: true });
  return realpath(root);
}

test('gallery keeps previews portable under a custom docs subdirectory and retains docs', async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, 'site/examples/group'), { recursive: true });
  await writeFile(join(root, 'site/examples/group/stale.html'), 'old preview');
  await mkdir(join(root, 'examples/group/dist'));
  await writeFile(
    join(root, 'examples/group/dist/index.html'),
    'Normal example build',
  );
  const manifest = await buildGallery({
    root,
    docsUrl: 'https://university.example/resources/sites/',
    run: async (name, { cwd, env, outDir }) => {
      assert.equal(cwd, root);
      assert.equal(env.SITE_URL, 'https://university.example');
      assert.equal(env.BASE_PATH, `/resources/sites/examples/${name}/`);
      const output = outDir;
      assert.equal(output, join(root, '.test-output/gallery-build', name));
      await mkdir(output);
      await writeFile(
        join(output, 'index.html'),
        `<a href="${env.BASE_PATH}lesson/">Lesson</a>`,
      );
      await mkdir(join(output, 'lesson'));
      await writeFile(join(output, 'lesson/index.html'), '<h1>Lesson</h1>');
    },
  });
  assert.equal(manifest.length, 5);
  for (const example of manifest) {
    const output = join(root, 'site/examples', example.name);
    assert.match(
      await readFile(join(output, 'index.html'), 'utf8'),
      /resources\/sites\/examples\//,
    );
    assert.equal(
      await readFile(join(output, 'lesson/index.html'), 'utf8'),
      '<h1>Lesson</h1>',
    );
    assert.equal(
      example.url,
      `https://university.example/resources/sites/examples/${example.name}/`,
    );
  }
  assert.deepEqual(
    JSON.parse(
      await readFile(join(root, 'site/examples/gallery.json'), 'utf8'),
    ),
    manifest,
  );
  assert.equal(
    await readFile(join(root, 'site/index.html'), 'utf8'),
    '<h1>Documentation</h1>',
  );
  assert.equal(
    await readFile(join(root, 'examples/group/dist/index.html'), 'utf8'),
    'Normal example build',
  );
  await assert.rejects(readFile(join(root, 'site/examples/group/stale.html')), {
    code: 'ENOENT',
  });
});

test('gallery refuses missing docs output and unsafe output paths before building', async (t) => {
  const root = await fixture(t);
  const run = () =>
    assert.fail('No example should be built with an unsafe output');
  await rm(join(root, 'site/index.html'));
  await assert.rejects(buildGallery({ root, run }), /Build MkDocs first/);
  await writeFile(
    join(root, 'mkdocs.yml'),
    'site_url: https://docs.example.org/\nsite_dir: ../outside\n',
  );
  await assert.rejects(buildGallery({ root, run }), /must stay inside/);
  await writeFile(
    join(root, 'mkdocs.yml'),
    'site_url: https://docs.example.org/\nsite_dir: .\n',
  );
  await assert.rejects(buildGallery({ root, run }), /must stay inside/);
});

test('gallery refuses linked output directories and preserves existing previews when a build fails', async (t) => {
  const root = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'sciastro-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(
    outside,
    join(root, 'site/examples'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(
    buildGallery({ root, run: () => assert.fail('Unsafe target') }),
    /not a symlink/,
  );
  await rm(join(root, 'site/examples'));
  await mkdir(join(root, 'site/examples/group'), { recursive: true });
  await writeFile(
    join(root, 'site/examples/group/index.html'),
    'previous successful preview',
  );
  await assert.rejects(
    buildGallery({
      root,
      run: () => {
        throw new Error('Build failed');
      },
    }),
    /Build failed/,
  );
  assert.equal(
    await readFile(join(root, 'site/examples/group/index.html'), 'utf8'),
    'previous successful preview',
  );
});

test('gallery normalizes docs URLs and rejects non-web destinations', () => {
  assert.deepEqual(galleryLocation('https://docs.example.org/sciastro'), {
    origin: 'https://docs.example.org',
    base: '/sciastro/',
  });
  assert.deepEqual(galleryLocation('http://localhost:8000/'), {
    origin: 'http://localhost:8000',
    base: '/',
  });
  for (const url of [
    'file:///tmp/docs',
    'https://user:secret@example.org/',
    'https://example.org/?a=1',
    'https://example.org/#a',
    'https://example.org/bad%20path/',
  ])
    assert.throws(() => galleryLocation(url), /DOCS_SITE_URL/);
});

test('gallery refuses symlinked build output before invoking Astro', async (t) => {
  const root = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'sciastro-gallery-scratch-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(
    outside,
    join(root, '.test-output'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(
    buildGallery({ root, run: () => assert.fail('Unsafe scratch directory') }),
    /not a symlink/,
  );
});
