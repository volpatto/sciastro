import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import { loadSite } from '../dist/content.js';
import { configSchema } from '../dist/schema.js';
import { composedPageSchema } from '../dist/sections.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-composed-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp('examples/lncc/content', join(root, 'content'), { recursive: true });
  await cp('examples/lncc/sciastro.yaml', join(root, 'sciastro.yaml'));
  return {
    root,
    config: join(root, 'sciastro.yaml'),
    page: join(root, 'content/pages/research.yaml'),
  };
}
async function edit(path, mutate) {
  const data = parse(await readFile(path, 'utf8'));
  mutate(data);
  await writeFile(path, stringify(data));
}

test('explicit pages preserve localized routes, hidden pages, menu order and section citations', async () => {
  const site = await loadSite(resolve('examples/lncc/sciastro.yaml'), {
    base: '/lab/',
  });
  assert.equal(site.config.theme, 'lncc');
  const menu = site.pages
    .filter((p) => p.locale === 'pt' && p.navigation)
    .map((p) => p.id);
  assert.deepEqual(menu, ['home', 'research', 'software']);
  const research = site.pages.find((p) => p.path === '/lab/en/topics/');
  assert.match(research.sections[0].html, /role="doc-biblioref"/);
  assert.equal(research.references[0].key, 'silva2025');
  assert(site.pages.some((p) => p.id === 'credits' && p.navigation === false));
  assert.equal(
    site.pages.find((p) => p.id === 'home').sections[2].component,
    'project-note',
  );
});

test('duplicate paths and IDs fail before Astro creates ambiguous routes', async (t) => {
  const f = await fixture(t);
  await edit(f.page, (data) => {
    data.paths.pt = '';
  });
  await assert.rejects(loadSite(f.config), /URLs.*repetido/);
  await edit(f.page, (data) => {
    data.paths.pt = 'linhas/';
    data.sections.push(data.sections[0]);
  });
  await assert.rejects(loadSite(f.config), /section IDs.*repetido/);
});

for (const kind of ['individual', 'lncc']) {
  test(`${kind}: copyright and license notes render independently in both languages`, async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'sciastro-footer-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    await cp(`examples/${kind}/content`, join(root, 'content'), {
      recursive: true,
    });
    await cp(`examples/${kind}/sciastro.yaml`, join(root, 'sciastro.yaml'));
    if (kind === 'individual')
      await cp(`examples/${kind}/public`, join(root, 'public'), {
        recursive: true,
      });
    const config = join(root, 'sciastro.yaml');
    await edit(config, (data) => {
      data.copyright = {
        pt: '© 2026 Pesquisa & Ensino · [Instituto](/instituto/)',
        en: '© 2026 Research & Teaching · [Institute](/en/institute/)',
      };
      data.footer = {
        pt: '[Créditos](/creditos/)',
        en: '[Credits](/en/credits/)',
      };
    });
    const site = await loadSite(config, { base: '/lab/' });
    assert.match(site.copyright.pt, /Pesquisa &amp; Ensino/);
    assert.match(site.copyright.en, /Research &amp; Teaching/);
    assert.match(site.copyright.pt, /href="\/lab\/instituto\/"/);
    assert.match(site.copyright.en, /href="\/lab\/en\/institute\/"/);
    assert.match(site.footer.pt, /href="\/lab\/creditos\/"/);
    assert.match(site.footer.en, /href="\/lab\/en\/credits\/"/);
    assert.doesNotMatch(site.footer.pt, /©/);
  });
}

test('missing translations and invalid navigation provide the page or configuration field', async (t) => {
  const f = await fixture(t);
  await edit(f.page, (data) => {
    delete data.sections[0].text.en;
  });
  await assert.rejects(loadSite(f.config), /page.research.sections.0.text.*en/);
  await edit(f.page, (data) => {
    data.sections[0].text.en = 'Restored';
  });
  await edit(f.config, (data) => {
    data.navigation.push('missing');
  });
  await assert.rejects(loadSite(f.config), /navigation.*missing/);
});

test('composed sections validate assets, icon files and citations in page text', async (t) => {
  const f = await fixture(t);
  await edit(f.page, (data) => {
    data.sections.push({
      type: 'figure',
      image: { src: '/missing.png', alt: 'A missing figure' },
    });
  });
  await assert.rejects(loadSite(f.config), /Imagem ausente/);
  await edit(f.page, (data) => {
    data.sections.pop();
    data.sections[0].links = [
      {
        label: 'Code',
        url: 'https://example.org',
        icon: { src: '/missing.svg' },
      },
    ];
  });
  await assert.rejects(loadSite(f.config), /Imagem ausente/);
  await edit(f.page, (data) => {
    data.sections[0].links = [];
    data.sections[0].text = '[@unknown]';
  });
  await assert.rejects(loadSite(f.config), /unknown.*BibTeX/);
});

test('theme tokens accept partial palettes and reject CSS injection and unknown keys', () => {
  const base = {
    schemaVersion: 1,
    kind: 'individual',
    name: 'A',
    description: 'B',
    url: 'https://example.org',
    home: { body: 'home.md' },
  };
  assert.equal(
    configSchema.parse({
      ...base,
      appearance: { light: { accent: '#123456' } },
    }).appearance.light.accent,
    '#123456',
  );
  assert.throws(() =>
    configSchema.parse({
      ...base,
      appearance: {
        light: { accent: 'red; background:url(https://example.org)' },
      },
    }),
  );
  assert.throws(() =>
    configSchema.parse({ ...base, appearance: { light: { typo: '#123456' } } }),
  );
  assert.throws(() =>
    configSchema.parse({
      ...base,
      appearance: { bodyFont: 'sans-serif;display:none' },
    }),
  );
});

test('section fields are strict and unsafe links cannot reach the renderer', () => {
  const base = { id: 'x', title: 'Page', paths: { pt: 'x/' }, sections: [] };
  for (const url of [
    'javascript:alert(1)',
    '//external.org',
    'data:text/html,test',
  ])
    assert.throws(() =>
      composedPageSchema.parse({
        ...base,
        sections: [{ type: 'prose', links: [{ label: 'bad', url }] }],
      }),
    );
  assert.throws(() =>
    composedPageSchema.parse({
      ...base,
      sections: [{ type: 'prose', titel: 'typo' }],
    }),
  );
});

test('composition requires exactly one top-level heading', async (t) => {
  const f = await fixture(t);
  const home = join(f.root, 'content/pages/about.yaml');
  await edit(home, (data) => {
    data.header = true;
  });
  await assert.rejects(loadSite(f.config), /one profile.*header/);
});

test('page paths and files cannot escape the content or deployment root', async (t) => {
  const f = await fixture(t);
  await edit(f.page, (data) => {
    data.paths.en = '../outside/';
  });
  await assert.rejects(loadSite(f.config), /paths.en/);
  await edit(f.config, (data) => {
    data.pageFiles.push('../outside.yaml');
  });
  await assert.rejects(loadSite(f.config), /fora da pasta/);
});

test('composed pages reuse the structured team and explicitly selected BibTeX entries', async (t) => {
  const f = await fixture(t);
  await cp(
    'starters/group/content/team.yaml',
    join(f.root, 'content/team.yaml'),
  );
  await cp('starters/group/public', join(f.root, 'public'), {
    recursive: true,
  });
  await edit(f.page, (data) => {
    data.sections.push({ type: 'team' });
    data.references = ['silva2025', 'costa2024'];
  });
  const site = await loadSite(f.config);
  assert(site.members.some((member) => member.status === 'alumni'));
  const research = site.pages.find(
    (page) => page.id === 'research' && page.locale === 'pt',
  );
  assert.equal(research.sections.at(-1).type, 'team');
  assert.deepEqual(
    research.references.map((reference) => reference.key),
    ['silva2025', 'costa2024'],
  );
  await edit(f.page, (data) => {
    data.references = ['missing'];
  });
  await assert.rejects(loadSite(f.config), /missing/);
});
