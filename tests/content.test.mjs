import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadSite, within } from '../dist/content.js';
import { configSchema, teamSchema } from '../dist/schema.js';

test('group home has short cards pointing to stable research section identifiers', async () => {
  const site = await loadSite(resolve('examples/group/sciastro.yaml'));
  const home = site.pages.find(
    (page) => page.id === 'home' && page.locale === 'pt',
  );
  const research = site.pages.find(
    (page) => page.id === 'research' && page.locale === 'pt',
  );
  assert.equal(home.title, 'Início');
  assert.deepEqual(
    home.areas.map((area) => area.id),
    research.areas.map((area) => area.id),
  );
  assert(home.areas.every((area) => !area.html && area.summary.length <= 240));
  assert(
    research.areas.every((area) => area.html.length > area.summary.length),
  );
  assert.equal(
    site.members.filter((person) => person.status === 'alumni').length,
    1,
  );
});

test('individual site uses Sobre/Orientações', async () => {
  const site = await loadSite(resolve('examples/individual/sciastro.yaml'));
  assert.equal(
    site.pages.find((page) => page.id === 'home' && page.locale === 'pt').title,
    'Sobre',
  );
  assert.equal(
    site.pages.find((page) => page.id === 'team' && page.locale === 'pt').title,
    'Orientações',
  );
});

test('all generated routes and Markdown links can be mounted in a subdirectory', async () => {
  const site = await loadSite(resolve('examples/group/sciastro.yaml'), {
    url: 'https://university.example.org',
    base: '/research/lab/',
  });
  assert(site.pages.every((page) => page.path.startsWith('/research/lab/')));
  assert(site.pages.some((page) => page.path === '/research/lab/en/team/'));
});

test('student levels and periods must be consistent', () => {
  assert.throws(
    () =>
      teamSchema.parse([
        { id: 'a', name: 'A', role: 'student', status: 'active' },
      ]),
    /nível/,
  );
  assert.throws(
    () =>
      teamSchema.parse([
        {
          id: 'a',
          name: 'A',
          role: 'faculty',
          status: 'alumni',
          startYear: 2025,
          endYear: 2024,
        },
      ]),
    /anteceder/,
  );
  assert.throws(
    () =>
      teamSchema.parse([
        {
          id: 'a',
          name: 'A',
          role: 'student',
          status: 'active',
          level: 'phd',
          endYear: 2025,
        },
      ]),
    /ativo/,
  );
});

test('missing translations and unknown student levels include actionable errors', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'sciastro-content-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await cp('starters/group', folder, { recursive: true });
  const configFile = join(folder, 'sciastro.yaml');
  const config = await readFile(configFile, 'utf8');
  await writeFile(
    configFile,
    config.replace(
      '  en: Mathematical modeling and scientific computing.\n',
      '',
    ),
  );
  await assert.rejects(
    loadSite(configFile),
    /description.*tradução 'en' ausente/,
  );
  await writeFile(configFile, config);
  const teamFile = join(folder, 'content/team.yaml');
  await writeFile(
    teamFile,
    (await readFile(teamFile, 'utf8')).replace(
      'level: masters',
      'level: unknown',
    ),
  );
  await assert.rejects(loadSite(configFile), /unknown.*não cadastrado/);
});

test('content paths cannot escape their directory', () => {
  assert.throws(
    () => within(resolve('content'), '../../outside.md'),
    /fora da pasta/,
  );
});

test('minimal configuration supports one language and optional sections', () => {
  const config = configSchema.parse({
    schemaVersion: 1,
    kind: 'group',
    name: 'Lab',
    description: 'A lab',
    url: 'https://example.org',
    home: { body: 'home.md' },
  });
  assert.deepEqual(config.locales, ['pt']);
  assert.equal(config.theme, 'classic');
});

test('a minimal English-only site builds without research, people or bibliography files', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'sciastro-minimal-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await cp('starters/group', folder, { recursive: true });
  for (const file of [
    'research.yaml',
    'team.yaml',
    'pages.yaml',
    'references.bib',
  ])
    await rm(join(folder, 'content', file));
  await writeFile(
    join(folder, 'sciastro.yaml'),
    'schemaVersion: 1\nkind: group\nname: Example\ndescription: Minimal English site\nurl: https://example.org\nlocales: [en]\ndefaultLocale: en\nhome:\n  body: home.en.md\n',
  );
  const site = await loadSite(join(folder, 'sciastro.yaml'));
  assert.equal(site.pages.length, 1);
  assert.equal(site.pages[0].title, 'Home');
  assert.equal(site.pages[0].path, '/');
});

test('citable references are not automatically listed as the site author’s publications', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'sciastro-publications-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await cp('starters/group', folder, { recursive: true });
  const configFile = join(folder, 'sciastro.yaml');
  const config = await readFile(configFile, 'utf8');
  await writeFile(
    configFile,
    config.replace(
      'publications: [silva2025, costa2024]',
      'publications: [silva2025]',
    ),
  );
  const site = await loadSite(configFile);
  assert.deepEqual(
    site.pages
      .find((page) => page.id === 'publications')
      .references.map((entry) => entry.key),
    ['silva2025'],
  );
  assert(
    site.pages
      .find((page) => page.id === 'research')
      .references.some((entry) => entry.key === 'costa2024'),
  );
});
