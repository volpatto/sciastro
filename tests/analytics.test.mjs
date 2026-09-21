import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, stringify } from 'yaml';
import sciastro, {
  analyticsSchema,
  analyticsEventSchema,
  configSchema,
} from '../dist/index.js';
import { linkEvent, trackingAllowed } from '../dist/analytics-client.js';
import { sectionLinkSchema } from '../dist/sections.js';

const websiteId = '94db1cb1-74f4-4a40-ad6c-962362670409';
const umami = { provider: 'umami', websiteId };
const cloudflare = {
  provider: 'cloudflare',
  token: '0123456789abcdef0123456789abcdef',
};
const baseConfig = {
  schemaVersion: 1,
  kind: 'group',
  name: 'Example',
  description: 'Fictional',
  url: 'https://academic.example',
  pageFiles: ['home.yaml'],
};

test('analytics is opt-in and Umami defaults to its hosted tracker with clicks disabled', () => {
  assert.equal(configSchema.parse(baseConfig).analytics, false);
  assert.equal(analyticsSchema.parse(false), false);
  assert.deepEqual(analyticsSchema.parse(umami), {
    ...umami,
    scriptUrl: 'https://cloud.umami.is/script.js',
    events: { downloads: false, externalLinks: false, custom: false },
  });
  assert.deepEqual(analyticsSchema.parse(cloudflare), cloudflare);
  const own = analyticsSchema.parse({
    ...umami,
    scriptUrl: 'https://stats.example/script.js',
    events: { custom: true },
  });
  assert.equal(own.events.custom, true);
  assert.equal(own.events.downloads, false);
});

test('wrong credentials, unsafe URLs, unknown providers and unsupported features fail validation', () => {
  for (const config of [
    true,
    {},
    { provider: 'other' },
    { ...umami, websiteId: 'not-a-uuid' },
    { ...cloudflare, token: 'not-an-api-token' },
    { ...cloudflare, events: { downloads: true } },
    { ...umami, events: { downloads: 'true' } },
    { ...umami, events: { typo: true } },
    { ...umami, apiKey: 'private' },
    ...[
      'javascript:alert(1)',
      '//example.org/script.js',
      'http://example.org/script.js',
      'https://name:secret@example.org/script.js',
      'https://example.org/script.js#fragment',
    ].map((scriptUrl) => ({ ...umami, scriptUrl })),
  ])
    assert.equal(
      analyticsSchema.safeParse(config).success,
      false,
      JSON.stringify(config),
    );
  for (const value of [
    'Bad Name',
    '',
    'a'.repeat(51),
    '<script>',
    'false',
    true,
  ])
    assert.equal(analyticsEventSchema.safeParse(value).success, false);
  for (const value of [false, 'cv_download', 'software-voids'])
    assert.equal(
      sectionLinkSchema.parse({
        label: 'Link',
        url: '/cv.pdf',
        analyticsEvent: value,
      }).analyticsEvent,
      value,
    );
});

test('only the configured origin and base path can collect, respecting Do Not Track', () => {
  const settings = { url: 'https://academic.example', base: '/lab/' };
  for (const path of ['/lab', '/lab/', '/lab/en/research/?q=ignored#part'])
    assert(trackingAllowed(settings, new URL(path, settings.url), null));
  for (const url of [
    'https://academic.example/laboratory/',
    'https://academic.example/',
    'https://preview.example/lab/',
    'http://academic.example/lab/',
    'https://academic.example:444/lab/',
  ])
    assert.equal(trackingAllowed(settings, new URL(url), null), false, url);
  for (const signal of ['1', 'yes'])
    assert.equal(
      trackingAllowed(settings, new URL('/lab/', settings.url), signal),
      false,
    );
  for (const host of [
    'localhost',
    'preview.localhost',
    '127.0.0.1',
    '127.1.2.3',
    '[::1]',
    '0.0.0.0',
  ]) {
    const url = new URL(`http://${host}:4321/lab/`);
    assert.equal(
      trackingAllowed({ ...settings, url: url.origin }, url, null),
      false,
    );
  }
});

test('events have deterministic precedence and exclude URL queries, fragments and credentials', () => {
  const current = new URL('https://academic.example/lab/en/?secret=hidden');
  const events = { downloads: true, externalLinks: true, custom: true };
  const link = {
    href: 'https://name:password@files.example/CV.PDF?token=private#section',
    download: false,
  };
  assert.deepEqual(linkEvent(link, current, events, 'en'), {
    name: 'file_download',
    data: { url: 'https://files.example/CV.PDF', locale: 'en' },
  });
  assert.equal(
    linkEvent({ ...link, custom: 'cv_download' }, current, events, 'pt').name,
    'cv_download',
  );
  assert.equal(
    linkEvent({ ...link, custom: 'false' }, current, events, 'pt'),
    undefined,
  );
  assert.equal(
    linkEvent(link, current, { ...events, downloads: false }, 'en').name,
    'external_link',
  );
  assert.equal(
    linkEvent({ href: '/lab/cv', download: true }, current, events, 'en').name,
    'file_download',
  );
  assert.equal(
    linkEvent(
      { href: '/lab/research/', download: false },
      current,
      events,
      'en',
    ),
    undefined,
  );
  for (const href of [
    'mailto:person@example.org',
    'tel:123',
    'javascript:alert(1)',
    '#references',
  ])
    assert.equal(
      linkEvent({ href, download: false }, current, events, 'en'),
      undefined,
    );
  assert.equal(
    linkEvent(
      link,
      current,
      { downloads: false, externalLinks: false, custom: false },
      'en',
    ),
    undefined,
  );
});

test('integration includes analytics only for enabled builds, including the emergency disable switch', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-analytics-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const configFile = join(root, 'sciastro.yaml');
  await writeFile(
    join(root, 'home.yaml'),
    stringify({
      id: 'home',
      title: 'Home',
      paths: { pt: '' },
      sections: [{ type: 'prose', text: 'Fictional content' }],
    }),
  );
  const settings = { ...baseConfig, contentDir: '.', analytics: umami };
  await writeFile(configFile, stringify(settings));
  const original = process.env.SCIASTRO_ANALYTICS;
  t.after(() => {
    if (original === undefined) delete process.env.SCIASTRO_ANALYTICS;
    else process.env.SCIASTRO_ANALYTICS = original;
  });
  delete process.env.SCIASTRO_ANALYTICS;
  async function injected(command) {
    const scripts = [];
    await sciastro().hooks['astro:config:setup']({
      command,
      config: { root: pathToFileURL(root + '/') },
      updateConfig() {},
      injectRoute() {},
      injectScript(stage, code) {
        scripts.push({ stage, code });
      },
    });
    return scripts;
  }
  for (const command of ['dev', 'sync', 'preview'])
    assert.deepEqual(await injected(command), []);
  const scripts = await injected('build');
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].stage, 'page');
  assert.match(scripts[0].code, /startAnalytics/);
  assert(scripts[0].code.includes(websiteId));
  process.env.SCIASTRO_ANALYTICS = 'false';
  assert.deepEqual(await injected('build'), []);
  delete process.env.SCIASTRO_ANALYTICS;
  await writeFile(configFile, stringify({ ...settings, analytics: false }));
  assert.deepEqual(await injected('build'), []);
});

for (const [format, newline] of [
  ['LF', '\n'],
  ['CRLF', '\r\n'],
]) {
  test(`documented analytics configurations and links validate against the shipped schemas (${format})`, async () => {
    // Exercise both checkout formats on every OS, including local macOS runs.
    const source = (
      await readFile(resolve('docs/guides/analytics.md'), 'utf8')
    ).replace(/\r?\n/g, newline);
    const blocks = [...source.matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/g)];
    assert(
      blocks.length >= 4,
      `Expected the documented YAML examples (${format}).`,
    );
    for (const [, yaml] of blocks) {
      const data = parse(yaml);
      if ('analytics' in data) configSchema.parse({ ...baseConfig, ...data });
      else for (const link of data.links) sectionLinkSchema.parse(link);
    }
  });
}
