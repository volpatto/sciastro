import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { stringify } from 'yaml';
import sciastro from '../dist/index.js';
import { loadSite } from '../dist/content.js';
import {
  articleDownloads,
  markdownNotebook,
  notebookResponse,
} from '../dist/downloads.js';

const originalNotebook =
  JSON.stringify(
    {
      cells: [
        {
          cell_type: 'markdown',
          metadata: {},
          source: ['## Saved result\n', 'A notebook with an earlier output.'],
        },
        {
          cell_type: 'code',
          metadata: { tags: ['hide-input'] },
          source:
            'raise RuntimeError("the exporter must never execute this")\n',
          execution_count: 7,
          outputs: [
            {
              output_type: 'display_data',
              metadata: {},
              data: {
                'text/html':
                  '<p>Saved output</p><script>window.downloadProbe = true;</script>',
                'text/plain': 'Saved output',
              },
            },
          ],
        },
      ],
      metadata: {
        kernelspec: {
          name: 'python3',
          display_name: 'Python 3',
          language: 'python',
        },
        language_info: { name: 'python' },
        extra: 'download-only-metadata',
      },
      nbformat: 4,
      nbformat_minor: 5,
    },
    null,
    4,
  ).replaceAll('\n', '\r\n') + '\r\n';

async function fixture(t, { automatic = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-downloads-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const content = join(root, 'content');
  await mkdir(content);
  const config = {
    schemaVersion: 1,
    kind: 'individual',
    name: 'Example',
    description: 'Example',
    url: 'https://example.org',
    base: '/',
    locales: ['pt', 'en'],
    defaultLocale: 'pt',
  };
  const entries = [
    {
      id: 'home',
      title: 'Home',
      paths: { pt: '', en: 'en/' },
      body: 'home.md',
    },
    {
      id: 'lesson',
      title: 'Lesson',
      layout: 'article',
      paths: { pt: 'curso/metodo/', en: 'en/course/method/' },
      body: 'lesson.md',
    },
    {
      id: 'calculation',
      title: 'Calculation',
      layout: 'article',
      paths: { pt: 'calculo/', en: 'en/calculation/' },
      body: 'original.ipynb',
    },
    {
      id: 'index',
      title: 'Index',
      layout: 'listing',
      paths: { pt: 'indice/', en: 'en/index/' },
      body: 'lesson.md',
    },
    {
      id: 'empty',
      title: 'Empty',
      layout: 'article',
      paths: { pt: 'vazio/', en: 'en/empty/' },
      body: 'empty.md',
    },
    {
      id: 'draft',
      title: 'Draft',
      layout: 'article',
      draft: true,
      paths: { pt: 'rascunho/', en: 'en/draft/' },
      body: 'missing.ipynb',
    },
  ];
  await writeFile(join(content, 'home.md'), 'A homepage.\n');
  await writeFile(
    join(content, 'lesson.md'),
    '## Method\n\n```python\nx = 1 + 1\n```\n',
  );
  await writeFile(join(content, 'empty.md'), '\n   \n');
  await writeFile(join(content, 'original.ipynb'), originalNotebook);
  const file = join(root, 'sciastro.yaml');
  const save = async () => {
    if (automatic) {
      config.home = { body: 'home.md' };
      await writeFile(
        join(content, 'pages.yaml'),
        stringify(
          entries.slice(1).map(({ id, ...page }) => ({ ...page, slug: id })),
        ),
      );
    } else {
      config.pageFiles = entries.map((page) => `${page.id}.yaml`);
      for (const page of entries)
        await writeFile(join(content, `${page.id}.yaml`), stringify(page));
    }
    await writeFile(file, stringify(config));
  };
  await save();
  return { root, content, file, config, entries, save };
}

test('Markdown export keeps prose and other languages while creating unexecuted Python cells', () => {
  const source = [
    '## Method\n\n::: note title="Source directive"\nKeep [@reference] and [local data](data/input.csv).\n:::\n\n',
    '```python\nfrom pathlib import Path\nPath("must-not-exist").write_text("never execute")\n```\n\n',
    '```javascript\nwindow.alert("source only");\n```\n\n',
    '~~~py\nprint(2)\n~~~\n\n',
    '[Next page](page:next)\n',
  ].join('');
  const notebook = JSON.parse(
    markdownNotebook(source, 'https://example.org/lesson/'),
  );
  assert.equal(notebook.nbformat, 4);
  assert.equal(notebook.nbformat_minor, 5);
  assert.deepEqual(
    notebook.cells.map((cell) => cell.cell_type),
    ['markdown', 'code', 'markdown', 'code', 'markdown'],
  );
  assert.match(notebook.cells[0].source, /::: note/);
  assert.match(notebook.cells[0].source, /\[@reference\]/);
  assert.match(notebook.cells[0].source, /data\/input\.csv/);
  assert.match(notebook.cells[2].source, /```javascript/);
  assert.equal(notebook.cells[3].source, 'print(2)\n');
  assert.equal(notebook.cells[4].source, '\n[Next page](page:next)\n');
  for (const cell of notebook.cells.filter(
    (cell) => cell.cell_type === 'code',
  )) {
    assert.equal(cell.execution_count, null);
    assert.deepEqual(cell.outputs, []);
    assert.equal(cell.metadata.trusted, undefined);
  }
  assert.equal(notebook.metadata.kernelspec.name, 'python3');
  assert.equal(
    new Set(notebook.cells.map((cell) => cell.id)).size,
    notebook.cells.length,
  );
  assert(notebook.cells.every((cell) => /^[a-zA-Z0-9_-]{1,64}$/.test(cell.id)));
  assert.match(notebook.metadata.sciastro.notes.join(' '), /not bundled/);
  assert.equal(
    markdownNotebook(source),
    markdownNotebook(source),
    'cell IDs and content are deterministic',
  );
});

test('nested Python fences remain Markdown and line endings/empty code cells are handled', () => {
  const nested =
    '> ```python\n> print(1)\n> ```\n\n- Item\n\n  ```python\n  print(2)\n  ```\n';
  const notebook = JSON.parse(markdownNotebook(nested));
  assert.equal(notebook.cells.length, 1);
  assert.equal(notebook.cells[0].source, nested);
  assert.equal(notebook.cells[0].cell_type, 'markdown');
  const windows = JSON.parse(
    markdownNotebook('Before\r\n\r\n```python3\r\nx = 1\r\n```\r\nAfter\r\n'),
  );
  assert.equal(windows.cells[1].source, 'x = 1\n');
  assert.equal(windows.cells[2].source, 'After\n');
  const empty = JSON.parse(markdownNotebook('```python\n```\n'));
  assert.equal(empty.cells[0].cell_type, 'code');
  assert.equal(empty.cells[0].source, '');
});

for (const automatic of [false, true]) {
  test(`${automatic ? 'automatic' : 'composed'} pages require opt-in and inherit per-page overrides`, async (t) => {
    const f = await fixture(t, { automatic });
    let site = await loadSite(f.file);
    assert.deepEqual(site.downloads, []);
    assert(site.pages.every((page) => page.downloads === undefined));
    f.config.downloads = { notebook: true, pdf: true };
    f.entries.find((page) => page.id === 'lesson').downloads = {
      notebook: false,
    };
    f.entries.find((page) => page.id === 'calculation').downloads = {
      pdf: false,
    };
    await f.save();
    site = await loadSite(f.file, { base: '/research/lab/' });
    assert.equal(site.downloads.length, 2);
    for (const locale of ['pt', 'en']) {
      const lesson = site.pages.find(
        (page) => page.id === 'lesson' && page.locale === locale,
      );
      assert.deepEqual(lesson.downloads, { pdf: true });
      const calculation = site.pages.find(
        (page) => page.id === 'calculation' && page.locale === locale,
      );
      assert.deepEqual(calculation.downloads, {
        pdf: false,
        notebook: {
          path: `/research/lab/_sciastro/downloads/${locale}/calculation.ipynb`,
          filename: `calculation-${locale}.ipynb`,
        },
      });
      assert(!('content' in calculation.downloads.notebook));
      assert(!calculation.html.includes('download-only-metadata'));
      assert(!calculation.html.includes('<script>'));
      const exported = site.downloads.find(
        (entry) => entry.path === calculation.downloads.notebook.path,
      );
      assert.equal(
        exported.content,
        originalNotebook,
        'original bytes including CRLF, metadata and saved outputs are retained',
      );
    }
    assert.equal(
      new Set(site.downloads.map((file) => file.path)).size,
      site.downloads.length,
    );
    assert(
      site.pages
        .filter((page) => ['home', 'index', 'empty'].includes(page.id))
        .every((page) => !page.downloads),
    );
    assert(!site.pages.some((page) => page.id === 'draft'));
    assert(!site.downloads.some((file) => file.path.includes('draft')));
  });
}

test('Markdown front matter is excluded from the exported notebook source', async (t) => {
  const f = await fixture(t);
  f.config.pageFiles = ['home.yaml', 'post.md'];
  await writeFile(
    join(f.content, 'post.md'),
    [
      '---',
      'id: post',
      'title: Post',
      'description: A worked example.',
      'layout: article',
      'paths: {pt: notas/post/, en: en/notes/post/}',
      'downloads: {notebook: true}',
      '---',
      '## Source body',
      '',
      '```python',
      'print(1)',
      '```',
      '',
    ].join('\n'),
  );
  await writeFile(f.file, stringify(f.config));
  const site = await loadSite(f.file);
  assert.equal(site.downloads.length, 2);
  const notebook = JSON.parse(site.downloads[0].content);
  assert.match(notebook.cells[0].source, /^# Post\n\nA worked example\./);
  assert.match(
    notebook.cells[0].source,
    /\[Página de origem\]\(<https:\/\/example.org\/notas\/post\/>\)/,
  );
  assert.match(notebook.cells[1].source, /^## Source body/);
  assert(!notebook.cells.some((cell) => cell.source.includes('downloads:')));
  assert.equal(
    notebook.metadata.sciastro.source_page,
    'https://example.org/notas/post/',
  );
});

test('empty original notebooks and section-only articles do not produce misleading notebooks', async (t) => {
  const f = await fixture(t);
  f.config.downloads = { notebook: true, pdf: true };
  await writeFile(
    join(f.content, 'original.ipynb'),
    JSON.stringify({ cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 }),
  );
  const lesson = f.entries.find((page) => page.id === 'lesson');
  delete lesson.body;
  lesson.sections = [{ type: 'prose', text: 'A real page section.' }];
  await f.save();
  const site = await loadSite(f.file);
  assert.deepEqual(site.downloads, []);
  assert.deepEqual(site.pages.find((page) => page.id === 'lesson').downloads, {
    pdf: true,
  });
  assert(!site.pages.find((page) => page.id === 'calculation').downloads);
});

test('invalid notebooks, escaping body paths and duplicate pages fail before export', async (t) => {
  const f = await fixture(t);
  f.config.downloads = { notebook: true };
  await f.save();
  await writeFile(join(f.content, 'original.ipynb'), '{not JSON');
  await assert.rejects(loadSite(f.file), /original.ipynb.*invalid JSON/);
  await writeFile(join(f.content, 'original.ipynb'), originalNotebook);
  const page = f.entries.find((entry) => entry.id === 'calculation');
  page.body = '../../private.ipynb';
  await f.save();
  await assert.rejects(loadSite(f.file), /fora da pasta/);
  page.body = 'original.ipynb';
  await f.save();
  f.config.pageFiles.push('calculation.yaml');
  await writeFile(f.file, stringify(f.config));
  await assert.rejects(loadSite(f.file), /repetido/);
});

test('download paths/headers cannot be built from traversal or header-injection identifiers', async () => {
  const input = {
    id: 'lesson',
    locale: 'en',
    layout: 'article',
    base: '/lab/',
    sourcePage: 'https://example.org/lab/lesson/',
    source: { format: 'markdown', content: 'Text' },
    defaults: { notebook: true, pdf: false },
  };
  for (const changed of [
    { id: '../private' },
    { id: 'x\r\nBad: value' },
    { locale: '../en' },
    { base: '//other.example/' },
    { base: '/../' },
  ]) {
    assert.throws(
      () => articleDownloads({ ...input, ...changed }),
      /Invalid notebook download/,
    );
  }
  const file = articleDownloads(input).file;
  const response = notebookResponse(file);
  assert.equal(
    response.headers.get('content-disposition'),
    'attachment; filename="lesson-en.ipynb"',
  );
  assert.equal(
    response.headers.get('content-type'),
    'application/x-ipynb+json; charset=utf-8',
  );
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await response.text(), file.content);
  assert.throws(
    () =>
      notebookResponse({ ...file, filename: 'x"\r\nInjected: value.ipynb' }),
    /Invalid notebook download filename/,
  );
});

test('integration registers the same prerendered notebook endpoint for development and production', async (t) => {
  const f = await fixture(t);
  f.config.downloads = { notebook: true };
  await f.save();
  for (const command of ['dev', 'build']) {
    const routes = [];
    await sciastro().hooks['astro:config:setup']({
      command,
      config: { root: pathToFileURL(`${f.root}/`) },
      updateConfig() {},
      injectRoute(route) {
        routes.push(route);
      },
      injectScript() {},
      logger: { warn() {} },
    });
    const route = routes.find(
      (entry) => entry.pattern === '/_sciastro/downloads/[...download].ipynb',
    );
    assert(route);
    assert.equal(route.prerender, true);
    assert(route.entrypoint.pathname.endsWith('/pages/Download.js'));
  }
});
