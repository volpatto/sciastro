import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { configSchema } from '../dist/schema.js';
import { loadSite } from '../dist/content.js';
import { pageContext } from '../dist/layout.js';
import { writeLayoutSite } from './fixtures/layouts.mjs';

const base = {
  schemaVersion: 1,
  kind: 'individual',
  name: 'Example',
  description: 'Example',
  url: 'https://example.org',
  home: { body: 'home.md' },
};

test('layout omission preserves theme navigation and motion remains opt-in', () => {
  for (const theme of ['classic', 'modern', 'lncc']) {
    const config = configSchema.parse({ ...base, theme });
    assert.equal(config.layout, undefined);
    assert.equal(
      configSchema.parse({ ...base, appearance: {} }).appearance.motion,
      'none',
    );
  }
  assert.deepEqual(
    configSchema.parse({ ...base, layout: { navigation: 'sidebar' } }).layout,
    { navigation: 'sidebar', subnavigation: 'inline' },
  );
  for (const navigation of ['top', 'sidebar'])
    for (const subnavigation of ['inline', 'right', 'none'])
      for (const motion of ['none', 'subtle', 'expressive']) {
        const config = configSchema.parse({
          ...base,
          layout: { navigation, subnavigation },
          appearance: { motion },
        });
        assert.equal(config.layout.navigation, navigation);
        assert.equal(config.layout.subnavigation, subnavigation);
        assert.equal(config.appearance.motion, motion);
      }
  for (const input of [
    { layout: { navigation: 'left' } },
    { layout: { subnavigation: 'floating' } },
    { appearance: { motion: 'always' } },
  ])
    assert.throws(() => configSchema.parse({ ...base, ...input }));
});

test('context respects locale, hidden ancestors and toc while reaching beyond menu depth', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-layouts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeLayoutSite(root);
  const site = await loadSite(join(root, 'sciastro.yaml'), {
    base: '/courses/site/',
  });
  const page = site.pages.find(
    (entry) => entry.id === 'lesson' && entry.locale === 'en',
  );
  const context = pageContext(site.pages, page);
  assert.equal(site.config.navigationDepth, 2);
  assert.equal(context.parent.id, 'course');
  assert.deepEqual(
    context.children.map((entry) => entry.id),
    ['appendix'],
  );
  assert.deepEqual(
    context.siblings.map((entry) => entry.id),
    ['sibling', 'no-toc'],
  );
  assert(
    [...context.children, ...context.siblings].every(
      (entry) =>
        entry.locale === 'en' && entry.path.startsWith('/courses/site/en/'),
    ),
  );
  assert.deepEqual(
    context.headings.map((heading) => heading.depth),
    [2, 3, 2],
  );
  const withoutTOC = pageContext(
    site.pages,
    site.pages.find((entry) => entry.id === 'no-toc' && entry.locale === 'pt'),
  );
  assert.equal(withoutTOC.headings.length, 0);
  assert(
    withoutTOC.siblings.length > 0,
    'toc:false suppresses headings, not related pages',
  );
  const hidden = pageContext(
    site.pages,
    site.pages.find(
      (entry) => entry.id === 'hidden-child' && entry.locale === 'pt',
    ),
  );
  assert.equal(hidden.parent, undefined);
  assert.deepEqual(hidden.children, []);
  assert.deepEqual(hidden.siblings, []);
});
