import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { Bibliography } from '../dist/bibliography.js';
import { loadSite } from '../dist/content.js';
import { sectionSchema } from '../dist/sections.js';

const bibtex = String.raw`@string{journal = {Example Journal}}
@article{article,
  author={de la Cruz, Juan and M{\"u}ller, Jos{\'e} and {Research Consortium} and van Beethoven, Jr, Ludwig},
  title={A {GPU} method}, journal=journal, year={2026}, volume={42}, number={2},
  pages={10--20}, doi={https://doi.org/10.1234/example}, url={https://example.org/article}
}
@inproceedings{conference, author={Doe, Jane}, title={An example method},
  booktitle={Fictional Proceedings}, year={2025}, eid={e123}, url={https://example.org/proceedings}}
@book{book, title={An edited handbook}, editor={Doe, Jane}, publisher={Fictional Press}, year={2024}}
@misc{undated, title={An undated note}}
@misc{unsafe, title={<img src=x onerror=alert(1)>}, url={javascript:alert(1)}}`;

async function fixture(t, items, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-publication-cards-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'content'));
  const files = options.files ?? { 'library.bib': bibtex };
  for (const [file, text] of Object.entries(files))
    await writeFile(join(root, 'content', file), text);
  const config = {
    schemaVersion: 1,
    kind: 'individual',
    name: 'Example Researcher',
    description: 'Fictional publication examples.',
    url: 'https://example.org',
    locales: ['pt', 'en'],
    defaultLocale: 'pt',
    pageFiles: ['home.yaml'],
    ...(options.bibliography === false
      ? {}
      : { bibliography: { file: 'library.bib' } }),
  };
  const page = {
    id: 'home',
    title: 'Publications',
    paths: { pt: '', en: 'en/' },
    sections: [{ type: 'publications', items }],
  };
  await writeFile(join(root, 'sciastro.yaml'), stringify(config));
  await writeFile(join(root, 'content/home.yaml'), stringify(page));
  return join(root, 'sciastro.yaml');
}

test('BibTeX metadata populates authors, journal, volume, issue, pages, year and normalized DOI', () => {
  const library = new Bibliography(bibtex);
  assert.deepEqual(library.publication('article'), {
    title: 'A GPU method',
    authors:
      'Juan de la Cruz; José Müller; Research Consortium; Ludwig van Beethoven, Jr',
    year: '2026',
    journal: 'Example Journal',
    citation: '42(2), 10–20',
    doi: '10.1234/example',
    url: 'https://example.org/article',
  });
  const changed = library.publication('article');
  changed.title = 'Changed outside the library';
  assert.equal(library.publication('article').title, 'A GPU method');
});

test('conference, book and sparse metadata do not invent authors, years or links', () => {
  const library = new Bibliography(bibtex);
  assert.equal(
    library.publication('conference').journal,
    'Fictional Proceedings',
  );
  assert.equal(library.publication('conference').citation, 'e123');
  assert.equal(library.publication('book').journal, 'Fictional Press');
  assert.equal(
    library.publication('book').authors,
    undefined,
    'editors are not silently credited as authors',
  );
  const note = library.publication('undated');
  assert.equal(note.title, 'An undated note');
  for (const key of ['authors', 'year', 'journal', 'citation', 'doi', 'url'])
    assert.equal(note[key], undefined);
  assert.equal(library.publication('unsafe').url, undefined);
});

for (const source of ['article', { file: 'library.bib', key: 'article' }]) {
  test(`a publication needs only ${typeof source === 'string' ? 'the configured library key' : 'a file and key'}, in both languages`, async (t) => {
    const config = await fixture(t, [{ bibtex: source }], {
      bibliography: typeof source === 'string',
    });
    const site = await loadSite(config, { base: '/lab/' });
    assert.equal(site.pages.length, 2);
    for (const page of site.pages) {
      const [entry] = page.sections[0].publications;
      assert.equal(entry.title, 'A GPU method');
      assert.equal(
        entry.authors,
        'Juan de la Cruz; José Müller; Research Consortium; Ludwig van Beethoven, Jr',
      );
      assert.equal(entry.year, '2026');
      assert.equal(entry.journal, 'Example Journal');
      assert.equal(entry.citation, '42(2), 10–20');
      assert.equal(entry.doi, '10.1234/example');
      assert.equal(
        page.references.length,
        0,
        'cards do not add duplicate references',
      );
    }
  });
}

test('files with the same BibTeX key remain distinct and preserve the selected order', async (t) => {
  const config = await fixture(
    t,
    [
      { bibtex: { file: 'second.bib', key: 'shared' } },
      { bibtex: { file: 'first.bib', key: 'shared' } },
      { bibtex: { file: 'second.bib', key: 'shared' } },
    ],
    {
      bibliography: false,
      files: {
        'first.bib': '@misc{shared,title={First library}}',
        'second.bib': '@misc{shared,title={Second library}}',
      },
    },
  );
  const site = await loadSite(config);
  assert.deepEqual(
    site.pages[0].sections[0].publications.map((p) => p.title),
    ['Second library', 'First library', 'Second library'],
  );
});

test('automatic publications coexist with manual records and optional editorial overrides', async (t) => {
  const manual = {
    title: 'A manually entered publication',
    authors: 'A. Author',
    year: '2020',
    journal: 'Manual Journal',
    citation: '1, 1–2',
    doi: '10.1234/manual',
  };
  const config = await fixture(t, [
    {
      bibtex: { file: 'library.bib', key: 'article' },
      title: 'An editorial title',
      authors: 'J. de la Cruz et al.',
      year: 2027,
      journal: 'Corrected Journal',
      citation: '43, e1',
      doi: '10.1234/corrected',
      topic: { pt: 'Métodos numéricos', en: 'Numerical methods' },
    },
    manual,
    { bibtex: 'undated' },
  ]);
  const site = await loadSite(config);
  for (const page of site.pages) {
    const [overridden, preserved, sparse] = page.sections[0].publications;
    assert.equal(overridden.title, 'An editorial title');
    assert.equal(overridden.authors, 'J. de la Cruz et al.');
    assert.equal(overridden.year, '2027');
    assert.equal(overridden.journal, 'Corrected Journal');
    assert.equal(overridden.citation, '43, e1');
    assert.equal(overridden.doi, '10.1234/corrected');
    assert.equal(
      overridden.topic,
      page.locale === 'pt' ? 'Métodos numéricos' : 'Numerical methods',
    );
    assert.deepEqual(preserved, { ...manual, topic: undefined });
    assert.equal(sparse.title, 'An undated note');
    assert.equal(sparse.doi, undefined);
  }
});

test('missing, case-mismatched and duplicate keys fail with an actionable source', async (t) => {
  for (const key of ['missing', 'Article']) {
    const config = await fixture(t, [{ bibtex: { file: 'library.bib', key } }]);
    await assert.rejects(
      loadSite(config),
      new RegExp(`library.bib:.*${key}.*não encontrada`),
    );
  }
  const duplicate = await fixture(
    t,
    [{ bibtex: { file: 'library.bib', key: 'x' } }],
    {
      bibliography: false,
      files: { 'library.bib': '@misc{x,title={One}}\n@misc{x,title={Two}}' },
    },
  );
  await assert.rejects(loadSite(duplicate), /repetida.*x/);
  const unconfigured = await fixture(t, [{ bibtex: 'article' }], {
    bibliography: false,
  });
  await assert.rejects(loadSite(unconfigured), /article.*bibliography.file/);
});

test('missing, malformed and out-of-root bibliography files are rejected', async (t) => {
  const missing = await fixture(t, [
    { bibtex: { file: 'missing.bib', key: 'x' } },
  ]);
  await assert.rejects(loadSite(missing), /missing.bib/);
  const outside = await fixture(t, [
    { bibtex: { file: '../outside.bib', key: 'x' } },
  ]);
  await assert.rejects(loadSite(outside), /fora da pasta/);
  const malformed = await fixture(
    t,
    [{ bibtex: { file: 'broken.bib', key: 'x' } }],
    {
      bibliography: false,
      files: { 'broken.bib': '@article{x,title={Unclosed' },
    },
  );
  await assert.rejects(loadSite(malformed), /BibTeX inválido/);
});

test('invalid selectors, incomplete manual records and malformed resolved metadata fail validation', async (t) => {
  for (const value of [
    '',
    {},
    { file: 'library.bib' },
    { key: 'article' },
    { file: 'library.bib', key: 'article', typo: true },
  ])
    assert.equal(
      sectionSchema.safeParse({
        type: 'publications',
        items: [{ bibtex: value }],
      }).success,
      false,
    );
  assert.equal(
    sectionSchema.safeParse({
      type: 'publications',
      items: [{ title: 'Missing metadata' }],
    }).success,
    false,
  );
  for (const [fields, field] of [
    ['year={2020}', 'title'],
    ['title={Invalid DOI},doi={not-a-doi}', 'doi'],
    ['title={Invalid URL},url={https://}', 'url'],
  ]) {
    const config = await fixture(t, [{ bibtex: 'invalid' }], {
      files: { 'library.bib': `@misc{invalid,${fields}}` },
    });
    await assert.rejects(
      loadSite(config),
      new RegExp(`Publication 'invalid':[\\s\\S]*${field}`),
    );
  }
});
