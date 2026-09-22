import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse, stringify } from 'yaml';
import { loadSite } from '../dist/content.js';
import { configSchema, pagesSchema } from '../dist/schema.js';
import { composedPageSchema } from '../dist/sections.js';

async function fixture(t, kind = 'individual', automatic = false) {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-articles-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp('examples/writing/content', join(root, 'content'), {
    recursive: true,
  });
  await cp('examples/writing/public', join(root, 'public'), {
    recursive: true,
  });
  const config = parse(
    await readFile('examples/writing/sciastro.yaml', 'utf8'),
  );
  config.kind = kind;
  if (automatic) {
    delete config.pageFiles;
    config.home = { body: 'home.md' };
    await writeFile(join(root, 'content/home.md'), 'An automatic homepage.');
    await writeFile(
      join(root, 'content/post.md'),
      '## A section\n\nA formula $x^2$.\n',
    );
    await writeFile(
      join(root, 'content/pages.yaml'),
      stringify([
        {
          slug: 'news',
          title: 'News',
          layout: 'listing',
          paths: { pt: 'news/' },
        },
        {
          slug: 'post',
          title: 'A post',
          parent: 'news',
          layout: 'article',
          paths: { pt: 'news/post/' },
          body: 'post.md',
          date: '2026-09-22',
        },
        {
          slug: 'notebook',
          title: 'Notebook',
          parent: 'news',
          layout: 'article',
          body: 'notebooks/quadratura.ipynb',
        },
      ]),
    );
  }
  await writeFile(join(root, 'sciastro.yaml'), stringify(config));
  return { root, file: join(root, 'sciastro.yaml'), config };
}

for (const kind of ['individual', 'group'])
  for (const automatic of [false, true]) {
    test(`${kind}/${automatic ? 'automatic' : 'explicit'}: scientific articles and notebooks work with parent navigation`, async (t) => {
      const f = await fixture(t, kind, automatic);
      const site = await loadSite(f.file, { base: '/research/lab/' });
      assert.equal(site.config.kind, kind);
      assert.equal(site.config.navigationDepth, 2);
      assert(
        site.pages.every((page) => page.path.startsWith('/research/lab/')),
      );
      const article = site.pages.find(
        (page) => page.id === (automatic ? 'post' : 'scientific-writing'),
      );
      assert.equal(article.layout, 'article');
      assert.equal(article.parent, 'news');
      assert.equal(
        article.navigation,
        true,
        'Selecting a parent should retain its children.',
      );
      assert.equal(article.date, '2026-09-22');
      assert(article.headings.length > 0);
      assert.match(article.html, /mjx-container/);
      const notebook = site.pages.find(
        (page) => page.id === (automatic ? 'notebook' : 'quadrature'),
      );
      assert.match(notebook.html, /notebook-cell/);
      assert.match(notebook.html, /Integral exata/);
      assert.match(notebook.html, /mjx-container/);
      if (!automatic) {
        assert.deepEqual(
          article.references.map((item) => item.key),
          ['davis1984'],
        );
        assert.match(article.html, /\/research\/lab\/images\/convergence.svg/);
      }
    });
  }

test('Markdown front matter, shared bodies and nested paths work in both locales', async (t) => {
  const f = await fixture(t);
  f.config.locales = ['pt', 'en'];
  f.config.pageFiles = ['pages/home.md', 'pages/post.md'];
  f.config.navigation = ['home'];
  await writeFile(f.file, stringify(f.config));
  await writeFile(
    join(f.root, 'content/pages/home.md'),
    '---\nid: home\ntitle: {pt: Sobre, en: About}\npaths: {pt: "", en: en/}\n---\nA shared introduction.',
  );
  await writeFile(
    join(f.root, 'content/pages/post.md'),
    '---\nid: post\nparent: home\nlayout: article\ntitle: {pt: Nota, en: Note}\npaths: {pt: notas/teste/, en: en/notes/test/}\n---\n## Result\n\n$x=1$',
  );
  const site = await loadSite(f.file);
  assert(site.pages.some((p) => p.path === '/caderno/en/notes/test/'));
  assert.equal(
    site.pages.filter((p) => p.id === 'post' && p.navigation).length,
    2,
  );
});

test('drafts do not generate routes or listings, including Markdown front matter', async (t) => {
  const f = await fixture(t);
  const path = join(f.root, 'content/pages/markdown.md');
  await writeFile(
    path,
    (await readFile(path, 'utf8')).replace(
      'layout: article',
      'layout: article\ndraft: true',
    ),
  );
  await assert.rejects(
    loadSite(f.file),
    /link to unknown or draft page 'scientific-writing'/,
  );
  const home = join(f.root, 'content/pages/home.md');
  await writeFile(
    home,
    (await readFile(home, 'utf8')).replaceAll(
      'page:scientific-writing',
      'page:news',
    ),
  );
  const site = await loadSite(f.file);
  assert(!site.pages.some((p) => p.id === 'scientific-writing'));
  assert(site.pages.some((p) => p.id === 'news'));
});

for (const [name, parent, pattern] of [
  ['unknown parent', 'missing', /unknown or draft/],
  ['self parent', 'news', /cycle/],
  ['indirect cycle', 'tutorials', /cycle/],
])
  test(`invalid hierarchy rejects ${name}`, async (t) => {
    const f = await fixture(t);
    const path = join(f.root, 'content/pages/news.yaml');
    const page = parse(await readFile(path, 'utf8'));
    page.parent = parent;
    delete f.config.navigation;
    await writeFile(f.file, stringify(f.config));
    await writeFile(path, stringify(page));
    await assert.rejects(loadSite(f.file), pattern);
  });

test('bad dates, notebook settings and menu depths fail validation', () => {
  for (const date of ['2026-02-30', 'tomorrow', '2026-13-01'])
    assert.throws(() =>
      pagesSchema.parse([
        { slug: 'post', title: 'Post', body: 'post.md', date },
      ]),
    );
  assert.throws(() =>
    composedPageSchema.parse({
      id: 'post',
      title: 'Post',
      paths: { pt: 'post/' },
      notebook: { execute: true },
    }),
  );
  const base = {
    schemaVersion: 1,
    kind: 'individual',
    name: 'Example',
    description: 'Example',
    url: 'https://example.org',
    home: { body: 'home.md' },
  };
  for (const navigationDepth of [0, -1, 1.5, 11])
    assert.throws(() => configSchema.parse({ ...base, navigationDepth }));
});

test('Markdown page errors identify the source and reject conflicting body metadata', async (t) => {
  const f = await fixture(t);
  const path = join(f.root, 'content/pages/markdown.md');
  await writeFile(path, 'No front matter.');
  await assert.rejects(loadSite(f.file), /markdown.md.*front matter/);
  await writeFile(path, '---\nid: article\nbody: other.md\n---\nText');
  await assert.rejects(loadSite(f.file), /markdown.md.*omit the body/);
});

test('notebook file errors and path traversal remain actionable', async (t) => {
  const f = await fixture(t);
  await writeFile(
    join(f.root, 'content/notebooks/quadratura.ipynb'),
    'invalid JSON',
  );
  await assert.rejects(loadSite(f.file), /quadratura.ipynb/);
  const page = parse(
    await readFile(join(f.root, 'content/pages/notebook.yaml'), 'utf8'),
  );
  page.body = '../../outside.ipynb';
  await writeFile(join(f.root, 'content/pages/notebook.yaml'), stringify(page));
  await assert.rejects(loadSite(f.file), /fora da pasta/);
});

test('page-identifier links follow the locale and base, and YAML links use one base prefix', async (t) => {
  const f = await fixture(t);
  f.config.locales = ['pt', 'en'];
  f.config.navigation = ['home'];
  f.config.pageFiles = ['pages/home.yaml', 'pages/post.md'];
  await writeFile(f.file, stringify(f.config));
  await writeFile(
    join(f.root, 'content/pages/home.yaml'),
    stringify({
      id: 'home',
      title: 'Home',
      paths: { pt: '', en: 'en/' },
      sections: [
        {
          type: 'prose',
          text: '[Open](page:post#method)',
          links: [{ label: 'Method', url: 'page:post#method' }],
        },
      ],
    }),
  );
  await writeFile(
    join(f.root, 'content/pages/post.md'),
    '---\nid: post\ntitle: Post\npaths: {pt: notas/novo/, en: en/notes/new/}\nparent: home\nlayout: article\n---\n## Método {#method}\n\n[Home](page:home)',
  );
  const site = await loadSite(f.file, { base: '/deep/site/' });
  const en = site.pages.find((p) => p.id === 'home' && p.locale === 'en');
  assert.match(
    en.sections[0].html,
    /href="\/deep\/site\/en\/notes\/new\/#method"/,
  );
  assert.equal(
    en.sections[0].links[0].url,
    '/en/notes/new/#method',
    'Section component adds deployment base.',
  );
  assert.match(
    site.pages.find((p) => p.id === 'post' && p.locale === 'pt').html,
    /href="\/deep\/site\/"/,
  );
});

for (const [url, pattern] of [
  ['page:missing', /unknown or draft page 'missing'/],
  [
    'page:scientific-writing#missing-section',
    /section 'missing-section'.*scientific-writing/,
  ],
])
  test(`invalid page link fails with context: ${url}`, async (t) => {
    const f = await fixture(t);
    const path = join(f.root, 'content/pages/home.md');
    await writeFile(
      path,
      (await readFile(path, 'utf8')) + `\n[Broken](${url})\n`,
    );
    await assert.rejects(loadSite(f.file), pattern);
  });

test('document heading identifiers avoid surrounding sections and main', async (t) => {
  const f = await fixture(t);
  await writeFile(
    join(f.root, 'content/collision.md'),
    '## Main\n\n## Results\n',
  );
  const path = join(f.root, 'content/pages/news.yaml');
  const news = parse(await readFile(path, 'utf8'));
  news.body = 'collision.md';
  news.sections = [
    { type: 'prose', id: 'results', text: 'A distinct composed section.' },
  ];
  await writeFile(path, stringify(news));
  const site = await loadSite(f.file);
  const page = site.pages.find((p) => p.id === 'news');
  assert.match(page.html, /id="main-2"/);
  assert.match(page.html, /id="results-2"/);
});
