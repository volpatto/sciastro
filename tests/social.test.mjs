import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { configSchema } from '../dist/schema.js';
import { loadSite } from '../dist/content.js';
import { resolveSocialImage } from '../dist/social.js';
import { writeSocialSite, socialImage } from './fixtures/social.mjs';

const settings = (overrides = {}) =>
  configSchema.parse({
    schemaVersion: 1,
    kind: 'individual',
    name: 'Researcher',
    description: 'Research',
    url: 'https://academic.example',
    base: '/lab/',
    home: { body: 'home.md' },
    ...overrides,
  });

test('sharing defaults to the original site logo, independent of its visual crop', () => {
  const result = resolveSocialImage(
    settings({
      logo: {
        ...socialImage('logo'),
        width: 2048,
        height: 966,
        viewBox: '205 202 555 557',
        monochrome: true,
      },
    }),
  );
  assert.deepEqual(result.image, {
    url: 'https://academic.example/lab/images/logo.png',
    alt: socialImage('logo').alt,
    type: 'image/png',
    width: 2048,
    height: 966,
  });
  assert.equal(result.warning, undefined);
});

test('custom sharing image wins over its dedicated fallback and site logo', () => {
  for (const fallback of [socialImage('fallback'), 'logo', false]) {
    const { image } = resolveSocialImage(
      settings({
        logo: socialImage('logo'),
        social: { image: socialImage('custom'), fallback },
      }),
    );
    assert.equal(image.url, 'https://academic.example/lab/images/custom.png');
    assert.deepEqual(image.alt, socialImage('custom').alt);
  }
});

test('dedicated social fallback replaces the logo and can be disabled', () => {
  const config = settings({
    logo: socialImage('logo'),
    social: { fallback: socialImage('fallback') },
  });
  assert.equal(
    resolveSocialImage(config).image.url,
    'https://academic.example/lab/images/fallback.png',
  );
  config.social.fallback = false;
  assert.deepEqual(resolveSocialImage(config), {});
});

test('no image is invented from people, favicons, portraits or built-in symbols', () => {
  assert.deepEqual(
    resolveSocialImage(
      settings({
        people: { avatarFallback: socialImage('people') },
        favicon: '/images/favicon.png',
        home: { body: 'home.md', photo: socialImage('portrait') },
      }),
    ),
    {},
  );
});

test('JPEG and remote logo URLs retain their format, query and optional dimensions', () => {
  const { image } = resolveSocialImage(
    settings({
      logo: {
        src: 'https://institution.example/Logo.JPEG?v=2',
        alt: 'Institution',
      },
    }),
  );
  assert.deepEqual(image, {
    url: 'https://institution.example/Logo.JPEG?v=2',
    alt: 'Institution',
    type: 'image/jpeg',
  });
  assert.equal(
    resolveSocialImage(
      settings({
        social: { image: { src: '/portrait.jpg', alt: 'Portrait' } },
      }),
    ).image.type,
    'image/jpeg',
  );
});

test('unsupported logo formats warn without breaking existing sites; an explicit image avoids the warning', () => {
  for (const ext of ['svg', 'webp', 'avif', 'gif']) {
    const config = settings({ logo: { src: `/logo.${ext}`, alt: 'Logo' } });
    const result = resolveSocialImage(config);
    assert.equal(result.image, undefined);
    assert.match(result.warning, /social\.image.*PNG\/JPEG/);
    config.social = { image: socialImage('custom'), fallback: 'logo' };
    assert.equal(resolveSocialImage(config).warning, undefined);
    config.social = { fallback: false };
    assert.deepEqual(resolveSocialImage(config), {});
  }
});

test('sharing configuration rejects unsupported images and malformed dimensions', () => {
  for (const fields of [
    { src: '/image.svg' },
    { src: '/image.webp' },
    { src: '/image.pdf' },
    { src: 'image.png' },
    { src: '//example.org/image.png' },
    { src: 'https://example.org/image.png' },
    { src: '/image.png?x=1' },
    { src: '/image.png#x' },
    { src: '/images\\image.png' },
    { width: 0 },
    { height: -1 },
    { width: 1.5 },
    { alt: '' },
    { alt: {} },
    { viewBox: '0 0 1 1' },
  ]) {
    for (const key of ['image', 'fallback'])
      assert.throws(() =>
        settings({
          social: { [key]: { ...socialImage('custom'), ...fields } },
        }),
      );
  }
  assert.throws(() => settings({ social: { fallback: 'people' } }));
  assert.throws(() => settings({ social: { enabled: true } }));
});

for (const mode of ['automatic', 'composed']) {
  async function fixture(t) {
    const root = await mkdtemp(join(tmpdir(), 'sciastro-social-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    return writeSocialSite(root, mode);
  }

  test(`${mode}: sharing image uses deployment overrides and remains localized`, async (t) => {
    const f = await fixture(t);
    f.config.social = { image: socialImage('custom') };
    await f.save();
    const site = await loadSite(f.file, {
      url: 'https://university.example',
      base: '/people/researcher/',
    });
    assert.equal(
      site.socialImage.url,
      'https://university.example/people/researcher/images/custom.png',
    );
    assert.deepEqual(site.socialImage.alt, socialImage('custom').alt);
    const rootSite = await loadSite(f.file, { base: '/' });
    assert.equal(
      rootSite.socialImage.url,
      'https://academic.example/images/custom.png',
    );
  });

  test(`${mode}: missing images, missing translations and out-of-root paths fail validation`, async (t) => {
    const f = await fixture(t);
    for (const key of ['image', 'fallback']) {
      f.config.social = {
        [key]: { ...socialImage('custom'), alt: { pt: 'Imagem' } },
      };
      await f.save();
      await assert.rejects(
        loadSite(f.file),
        new RegExp(`social.${key}.alt.*en.*ausente`),
      );
      f.config.social = { [key]: { src: '/missing.png', alt: 'Missing' } };
      await f.save();
      await assert.rejects(loadSite(f.file), /Imagem ausente.*missing\.png/);
      f.config.social = {
        [key]: { src: '/../private.png', alt: 'Outside public' },
      };
      await writeFile(join(f.root, 'private.png'), 'Not a public asset');
      await f.save();
      await assert.rejects(loadSite(f.file), /fora da pasta/);
    }
    f.config.social = {
      image: socialImage('custom'),
      fallback: { src: '/missing.png', alt: 'Missing' },
    };
    await f.save();
    await assert.rejects(loadSite(f.file), /Imagem ausente/);
  });
}
