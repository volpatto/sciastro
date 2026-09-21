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

const photo = { src: '/images/portrait.svg', alt: 'Portrait' };
const automatic = (photo) =>
  configSchema.parse({
    schemaVersion: 1,
    kind: 'individual',
    name: 'Example',
    description: 'Research',
    url: 'https://example.org',
    home: { body: 'about.md', photo },
  }).home.photo;
const composed = (image) =>
  sectionSchema.parse({
    type: 'profile',
    title: 'Example',
    image,
  }).image;

for (const [mode, read] of [
  ['automatic', automatic],
  ['composed', composed],
]) {
  test(`${mode} portraits are optional and preserve rectangular defaults`, () => {
    assert.equal(read(undefined), undefined);
    assert.equal(read(photo).shape, 'rectangle');
    assert.equal(read({ ...photo, shape: 'rectangle' }).shape, 'rectangle');
    assert.deepEqual(
      read({ ...photo, shape: 'circle', position: [25, 0] }).position,
      [25, 0],
    );
    assert.deepEqual(
      read({ ...photo, shape: 'circle', position: [100, 100] }).position,
      [100, 100],
    );
  });

  test(`${mode} portraits reject invalid shapes, framing, dimensions and paths`, () => {
    for (const fields of [
      { shape: 'oval' },
      { position: [101, 50] },
      { position: [0, -1] },
      { position: ['50', 0] },
      { position: [50] },
      { position: [50, 50, 50] },
      { width: 0 },
      { height: -1 },
      { width: 3.5 },
      { alt: '' },
      { src: 'portrait.jpg' },
      { src: '//example.org/photo.jpg' },
      { src: 'https://example.org/photo.jpg' },
    ])
      assert.throws(() => read({ ...photo, ...fields }));
  });

  test(`${mode} portraits load, localize and validate their source files`, async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'sciastro-portraits-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const { configFile } = await writePortraitSite(root, mode);
    const site = await loadSite(configFile);
    if (mode === 'composed') {
      const home = site.pages.filter((page) => page.id === 'home');
      assert.deepEqual(
        home.map((page) => page.sections[0].image.alt),
        ['Retrato fictício', 'Fictional portrait'],
      );
      for (const page of home) {
        assert.equal(page.sections[0].image.shape, 'circle');
        assert.deepEqual(page.sections[0].image.position, [50, 30]);
      }
      assert.equal(
        site.pages.find((page) => page.id === 'rectangle').sections[0].image
          .shape,
        'rectangle',
      );
    } else {
      assert.equal(site.config.home.photo.shape, 'circle');
    }
    const file =
      mode === 'automatic' ? configFile : join(root, 'content/home.yaml');
    const data = parse(await readFile(file, 'utf8'));
    const image =
      mode === 'automatic' ? data.home.photo : data.sections[0].image;
    delete image.alt.en;
    await writeFile(file, stringify(data));
    await assert.rejects(loadSite(configFile), /alt.*en.*ausente/);
    image.alt.en = 'Fictional portrait';
    await writeFile(file, stringify(data));
    await rm(join(root, 'public/images/portrait.svg'));
    await assert.rejects(loadSite(configFile), /Imagem ausente.*portrait\.svg/);
  });
}
