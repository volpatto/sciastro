import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { loadSite } from '../dist/content.js';
import { configSchema, pagesSchema } from '../dist/schema.js';
import { composedPageSchema } from '../dist/sections.js';
import { pageContext } from '../dist/layout.js';

const markdown = `# Título do documento {#document-title}

## Método {#method}

Uma formulação verificável.

### Hipóteses

Condições de validade.

## Resultados {#results}

[Voltar ao método](#method) e [método da aula](page:inherited#method).
`;
const notebook = {
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {
    kernelspec: {
      name: 'python3',
      display_name: 'Python 3',
      language: 'python',
    },
  },
  cells: [
    {
      cell_type: 'markdown',
      metadata: {},
      source: '# Título do notebook\n\n## Dados {#data}\n',
    },
    {
      cell_type: 'code',
      metadata: {},
      execution_count: null,
      outputs: [],
      source: 'raise RuntimeError("## not a heading and never executed")',
    },
    {
      cell_type: 'markdown',
      metadata: {},
      source: '### Hipóteses\n\nHipóteses em outra célula.\n',
    },
    {
      cell_type: 'markdown',
      metadata: {},
      source:
        '## Resultados {#results}\n\n[Dados](#data) e [método](page:inherited#method).\n',
    },
  ],
};
const expectedNumbers = ['1', '1.1', '2'];
const numbers = (html) =>
  [
    ...html.matchAll(
      /<span\b[^>]*class="document-heading-number"[^>]*>([\d.]+)<\/span>/g,
    ),
  ].map((match) => match[1]);
const identity = (page) =>
  (page.headings ?? []).map(({ id, text, depth }) => ({ id, text, depth }));

async function fixture(t, kind, automatic) {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-section-numbering-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const content = join(root, 'content');
  await mkdir(content);
  const config = {
    schemaVersion: 1,
    kind,
    name: 'Numbering fixture',
    description: 'A fixture with stable scientific section links.',
    url: 'https://numbering.example',
    locales: ['pt', 'en'],
    defaultLocale: 'pt',
  };
  const entry = (id, extra = {}) => ({
    id,
    title: id,
    paths: { pt: `${id}/`, en: `en/${id}/` },
    body: 'article.md',
    layout: 'article',
    ...extra,
  });
  const entries = [
    entry('home', {
      paths: { pt: '', en: 'en/' },
      layout: 'page',
      body: 'home.md',
    }),
    entry('inherited'),
    entry('opt-in', { numberSections: true }),
    entry('opt-out', { numberSections: false }),
    entry('without-toc', { toc: false }),
    entry('calculation', { body: 'calculation.ipynb' }),
    entry('ordinary', { layout: 'page', numberSections: true }),
    entry('listing', { layout: 'listing', numberSections: true }),
  ];
  await writeFile(
    join(content, 'home.md'),
    '## Introdução\n\nUma página inicial.\n',
  );
  await writeFile(join(content, 'article.md'), markdown);
  await writeFile(join(content, 'calculation.ipynb'), JSON.stringify(notebook));
  if (automatic) {
    config.home = { body: 'home.md' };
    await writeFile(
      join(content, 'pages.yaml'),
      stringify(
        entries.slice(1).map(({ id, ...page }) => ({ slug: id, ...page })),
      ),
    );
  } else {
    config.pageFiles = entries.map(
      (page) => `${page.id}.${page.id === 'opt-in' ? 'md' : 'yaml'}`,
    );
    for (const page of entries) {
      if (page.id === 'opt-in') {
        const { body, ...metadata } = page;
        await writeFile(
          join(content, 'opt-in.md'),
          `---\n${stringify(metadata)}---\n\n${markdown}`,
        );
      } else {
        await writeFile(join(content, `${page.id}.yaml`), stringify(page));
      }
    }
  }
  const file = join(root, 'sciastro.yaml');
  const save = () => writeFile(file, stringify(config));
  await save();
  return { config, file, save };
}

for (const [kind, automatic] of [
  ['group', false],
  ['individual', false],
  ['course', false],
  ['group', true],
  ['individual', true],
]) {
  test(`${kind} / ${automatic ? 'automatic pages' : 'pageFiles'}: article numbering inherits opt-in, respects overrides and keeps anchors stable`, async (t) => {
    const f = await fixture(t, kind, automatic);
    const mount = { base: '/subjects/numerics/' };
    const original = await loadSite(f.file, mount);
    assert.equal(original.config.numberSections, false);
    for (const page of original.pages) {
      assert.deepEqual(
        numbers(page.html),
        page.id === 'opt-in' ? expectedNumbers : [],
        `${page.id}/${page.locale}: numbering defaults to off`,
      );
    }
    f.config.numberSections = true;
    await f.save();
    const numbered = await loadSite(f.file, mount);
    for (const locale of ['pt', 'en']) {
      const find = (id) =>
        numbered.pages.find((page) => page.id === id && page.locale === locale);
      for (const id of ['inherited', 'opt-in', 'without-toc', 'calculation']) {
        const page = find(id);
        assert.deepEqual(
          numbers(page.html),
          expectedNumbers,
          `${id}/${locale}: article sections are numbered`,
        );
        assert.deepEqual(
          (page.headings ?? [])
            .filter((heading) => heading.depth >= 2)
            .map((heading) => heading.number),
          expectedNumbers,
        );
        assert(
          (page.headings ?? [])
            .filter((heading) => heading.depth === 1)
            .every((heading) => heading.number === undefined),
        );
        for (const [, , content] of page.html.matchAll(
          /<h(1)\b[^>]*>([\s\S]*?)<\/h1>/g,
        )) {
          assert(
            !content.includes('document-heading-number'),
            'body h1 headings stay unnumbered',
          );
        }
        const before = original.pages.find(
          (entry) => entry.id === id && entry.locale === locale,
        );
        assert.deepEqual(
          identity(page),
          identity(before),
          'numbering does not alter heading text, depth or fragment IDs',
        );
        const route = `${mount.base}${locale === 'en' ? 'en/' : ''}inherited/#method`;
        assert(
          page.html.includes(`href="${route}"`),
          'cross-page links keep their locale and mount path',
        );
      }
      for (const id of ['home', 'ordinary', 'listing', 'opt-out']) {
        assert.deepEqual(
          numbers(find(id).html),
          [],
          `${id}: explicit false and non-article layouts remain unnumbered`,
        );
      }
      assert.equal(find('without-toc').toc, false);
      assert.deepEqual(
        pageContext(numbered.pages, find('without-toc')).headings,
        [],
        'toc:false hides the contents list without disabling section numbering',
      );
      assert(find('inherited').html.includes('href="#method"'));
      assert(find('calculation').html.includes('href="#data"'));
      assert.deepEqual(
        identity(find('calculation')).map(({ text }) => text),
        ['Título do notebook', 'Dados', 'Hipóteses', 'Resultados'],
      );
    }
    f.config.numberSections = false;
    await f.save();
    const disabled = await loadSite(f.file, mount);
    for (const page of disabled.pages) {
      assert.deepEqual(
        numbers(page.html),
        page.id === 'opt-in' ? expectedNumbers : [],
        'explicit global false still permits a per-page opt-in',
      );
    }
  });
}

test('section numbering accepts booleans only and preserves page inheritance when omitted', () => {
  const config = {
    schemaVersion: 1,
    kind: 'individual',
    name: 'Example',
    description: 'Example',
    url: 'https://example.org',
    home: { body: 'home.md' },
  };
  const automaticPage = {
    slug: 'lesson',
    title: 'Lesson',
    layout: 'article',
    body: 'lesson.md',
  };
  const composedPage = {
    id: 'lesson',
    title: 'Lesson',
    layout: 'article',
    body: 'lesson.md',
    paths: { pt: 'lesson/' },
  };
  assert.equal(configSchema.parse(config).numberSections, false);
  assert.equal(pagesSchema.parse([automaticPage])[0].numberSections, undefined);
  assert.equal(
    composedPageSchema.parse(composedPage).numberSections,
    undefined,
  );
  for (const value of [true, false]) {
    assert.equal(
      configSchema.parse({ ...config, numberSections: value }).numberSections,
      value,
    );
    assert.equal(
      pagesSchema.parse([{ ...automaticPage, numberSections: value }])[0]
        .numberSections,
      value,
    );
    assert.equal(
      composedPageSchema.parse({ ...composedPage, numberSections: value })
        .numberSections,
      value,
    );
  }
  for (const value of ['true', 'false', 0, 1, null, [], {}]) {
    for (const result of [
      configSchema.safeParse({ ...config, numberSections: value }),
      pagesSchema.safeParse([{ ...automaticPage, numberSections: value }]),
      composedPageSchema.safeParse({ ...composedPage, numberSections: value }),
    ]) {
      assert.equal(result.success, false);
      assert(
        result.error.issues.some(
          (issue) => issue.path.at(-1) === 'numberSections',
        ),
      );
    }
  }
});
