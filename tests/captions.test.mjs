import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { configSchema } from '../dist/schema.js';
import { sectionSchema } from '../dist/sections.js';
import { loadSite } from '../dist/content.js';
import { writePortraitSite } from './fixtures/portraits.mjs';

const config = {
  schemaVersion: 1,
  kind: 'individual',
  name: 'Example',
  description: 'Research',
  url: 'https://example.org',
  home: { body: 'about.md' },
};
const image = {
  src: '/images/portrait.svg',
  alt: 'Portrait',
  caption: 'About',
};

test('caption defaults are optional and figures and tables can be configured independently', () => {
  assert.equal(configSchema.parse(config).appearance, undefined);
  for (const kind of ['individual', 'group']) {
    for (const key of ['figures', 'tables']) {
      for (const alignment of ['left', 'center', 'right', 'justify']) {
        const parsed = configSchema.parse({
          ...config,
          kind,
          appearance: { captions: { [key]: alignment } },
        });
        assert.deepEqual(parsed.appearance.captions, {
          figures: 'center',
          tables: 'center',
          [key]: alignment,
        });
      }
    }
  }
});

test('invalid caption alignments and misspelled settings fail with their field names', () => {
  for (const alignment of [
    '',
    'start',
    'CENTER',
    'left;display:none',
    1,
    false,
    null,
    {},
  ]) {
    for (const key of ['figures', 'tables']) {
      assert.throws(
        () =>
          configSchema.parse({
            ...config,
            appearance: { captions: { [key]: alignment } },
          }),
        new RegExp(key),
      );
    }
    assert.throws(
      () =>
        sectionSchema.parse({
          type: 'figure',
          image: { ...image, captionAlign: alignment },
        }),
      /captionAlign/,
    );
  }
  assert.throws(
    () =>
      configSchema.parse({
        ...config,
        appearance: { captions: { figure: 'left' } },
      }),
    /figure/,
  );
});

test('composed captions preserve per-image alignment through localization in every figure use', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-captions-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { configFile, config } = await writePortraitSite(root, 'composed');
  config.appearance = { captions: { figures: 'left', tables: 'right' } };
  await writeFile(configFile, stringify(config));
  const homeFile = join(root, 'content/home.yaml');
  const home = parse(await readFile(homeFile, 'utf8'));
  home.sections[0].image.captionAlign = 'right';
  await writeFile(homeFile, stringify(home));
  const figuresFile = join(root, 'content/figures.yaml');
  const figures = parse(await readFile(figuresFile, 'utf8'));
  figures.sections[0].image = {
    ...figures.sections[0].image,
    captionAlign: 'left',
  };
  figures.sections[1].items[0].images[0] = {
    ...figures.sections[1].items[0].images[0],
    captionAlign: 'center',
  };
  figures.sections[2].items[0].image = {
    ...figures.sections[2].items[0].image,
    captionAlign: 'justify',
  };
  await writeFile(figuresFile, stringify(figures));

  const site = await loadSite(configFile);
  for (const locale of ['pt', 'en']) {
    const profile = site.pages.find(
      (p) => p.id === 'home' && p.locale === locale,
    ).sections[0].image;
    assert.equal(profile.captionAlign, 'right');
    assert.equal(
      profile.caption,
      locale === 'pt' ? 'Ilustração fictícia' : 'Fictional illustration',
    );
    assert.equal(profile.shape, 'circle');
    const sections = site.pages.find(
      (p) => p.id === 'figures' && p.locale === locale,
    ).sections;
    assert.equal(sections[0].image.captionAlign, 'left');
    assert.equal(sections[1].items[0].images[0].captionAlign, 'center');
    assert.equal(sections[2].logos[0].image.captionAlign, 'justify');
    const inherited = site.pages.find(
      (p) => p.id === 'rectangle' && p.locale === locale,
    ).sections[0].image;
    assert.equal(inherited.captionAlign, undefined);
  }
  assert.deepEqual(site.config.appearance.captions, {
    figures: 'left',
    tables: 'right',
  });
});
