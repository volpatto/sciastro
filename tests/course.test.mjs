import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { main } from '../dist/cli.js';
import { loadSite } from '../dist/content.js';

for (const theme of ['classic', 'modern', 'lncc']) {
  test(`course CLI scaffolds a portable ${theme} site with lessons and an unexecuted notebook`, async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'sciastro-course-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    await main(['init', root, '--kind', 'course', '--theme', theme]);
    const site = await loadSite(join(root, 'sciastro.yaml'), {
      url: 'https://teaching.example.org',
      base: '/classes/numerics/',
    });
    assert.equal(site.config.kind, 'course');
    assert.equal(site.config.theme, theme);
    assert.deepEqual(site.config.layout, {
      navigation: 'top',
      subnavigation: 'right',
    });
    assert.equal(site.pages.length, 5);
    assert(
      site.pages.every((page) => page.path.startsWith('/classes/numerics/')),
    );
    assert.equal(
      site.pages.find((page) => page.id === 'lessons').layout,
      'listing',
    );
    const lesson = site.pages.find((page) => page.id === 'integration');
    assert.equal(lesson.parent, 'lessons');
    assert.match(lesson.html, /document-math/);
    assert.match(lesson.html, /\/classes\/numerics\/aulas\/laboratorio\//);
    const notebook = site.pages.find(
      (page) => page.id === 'trapezoid-notebook',
    );
    assert.equal(notebook.parent, 'lessons');
    assert.match(notebook.html, /notebook-cell/);
    assert.match(notebook.html, /sem execução e sem saídas salvas/);
    assert.equal(site.members.length, 0);
    const sourceNotebook = JSON.parse(
      await readFile(join(root, 'content/notebooks/trapezoid.ipynb'), 'utf8'),
    );
    const code = sourceNotebook.cells.filter(
      (cell) => cell.cell_type === 'code',
    );
    assert(code.length > 0);
    assert(
      code.every(
        (cell) => cell.execution_count === null && cell.outputs.length === 0,
      ),
    );
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    const framework = JSON.parse(
      await readFile(resolve('package.json'), 'utf8'),
    );
    assert.equal(pkg.dependencies.sciastro, framework.version);
    assert.equal(pkg.private, true);
  });
}

test('course initialization keeps existing content intact and rejects unsupported profiles', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-course-existing-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'notes.md'), 'Keep my work');
  await assert.rejects(
    main(['init', root, '--kind', 'course']),
    /não está vazia/,
  );
  assert.equal(await readFile(join(root, 'notes.md'), 'utf8'), 'Keep my work');
  await assert.rejects(
    main(['init', root, '--kind', 'lecture']),
    /group, individual ou course/,
  );
});

test('course example and starter expose the same editing entry points', async () => {
  for (const dir of ['starters/course', 'examples/course']) {
    const config = parse(await readFile(join(dir, 'sciastro.yaml'), 'utf8'));
    assert.equal(config.kind, 'course');
    assert(config.pageFiles.includes('pages/integration.md'));
    assert(config.pageFiles.includes('pages/notebook.yaml'));
    const site = await loadSite(resolve(dir, 'sciastro.yaml'));
    assert.deepEqual(
      site.pages.map((page) => page.id),
      ['home', 'syllabus', 'lessons', 'integration', 'trapezoid-notebook'],
    );
  }
});
