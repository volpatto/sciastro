import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import { configSchema, iconSchema } from '../dist/schema.js';
import { navigationIcon, languageIcon, resolveIcon } from '../dist/icons.js';
import { loadSite } from '../dist/content.js';

const config = (overrides = {}) =>
  configSchema.parse({
    schemaVersion: 1,
    kind: 'group',
    name: 'Lab',
    description: 'Example',
    url: 'https://example.org',
    home: { body: 'home.md' },
    ...overrides,
  });

test('existing configurations get menu icons and Brazilian/British flags without new fields', () => {
  const site = config();
  assert.equal(navigationIcon(site, 'home').name, 'lucide:house');
  assert.equal(navigationIcon(site, 'research').name, 'lucide:flask-conical');
  assert.equal(navigationIcon(site, 'team').name, 'lucide:users-round');
  assert.equal(navigationIcon(site, 'publications').name, 'lucide:book-open');
  assert.equal(navigationIcon(site, 'projects').name, 'lucide:file-text');
  assert.equal(languageIcon(site, 'pt').name, 'circle-flags:br');
  assert.equal(languageIcon(site, 'en').name, 'circle-flags:gb');
  const individual = config({ kind: 'individual' });
  assert.equal(navigationIcon(individual, 'home').name, 'lucide:user-round');
  assert.equal(
    navigationIcon(individual, 'team').name,
    'lucide:graduation-cap',
  );
});

test('overrides, page icons and section/global disabling have explicit precedence', () => {
  const site = config({
    icons: {
      navigation: { home: false, projects: 'lucide:atom' },
      languages: { pt: false },
    },
  });
  assert.equal(navigationIcon(site, 'home'), false);
  assert.equal(
    navigationIcon(site, 'projects', 'lucide:folder').name,
    'lucide:atom',
  );
  assert.equal(
    navigationIcon(site, 'custom', 'lucide:network').name,
    'lucide:network',
  );
  assert.equal(navigationIcon(site, 'hidden', false), false);
  assert.equal(languageIcon(site, 'pt'), false);
  assert.equal(languageIcon(site, 'en').name, 'circle-flags:gb');
  const noMenu = config({ icons: { navigation: false } });
  assert.equal(navigationIcon(noMenu, 'custom', 'lucide:atom'), false);
  assert.equal(languageIcon(noMenu, 'en').name, 'circle-flags:gb');
  const noLanguages = config({ icons: { languages: false } });
  assert.equal(languageIcon(noLanguages, 'pt'), false);
  assert.equal(navigationIcon(noLanguages, 'home').name, 'lucide:house');
  const disabled = config({ icons: false });
  assert.equal(navigationIcon(disabled, 'home'), false);
  assert.equal(languageIcon(disabled, 'pt'), false);
});

test('catalog aliases work and repeated SVGs have distinct definition IDs', () => {
  assert.equal(resolveIcon('lucide:home', 'test').kind, 'svg');
  const first = resolveIcon('circle-flags:gb', 'test');
  const second = resolveIcon('circle-flags:gb', 'test');
  const ids = (body) => [...body.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert(ids(first.body).length > 0);
  assert(!ids(first.body).some((id) => ids(second.body).includes(id)));
});

test('invalid catalog names, raw SVG and remote images cannot masquerade as local icons', () => {
  for (const input of [
    '<svg/>',
    'other:house',
    true,
    { src: 'https://example.org/icon.svg' },
    { src: '//example.org/icon.svg' },
  ])
    assert.equal(iconSchema.safeParse(input).success, false);
  assert.throws(
    () => resolveIcon('lucide:no-such-icon-sciastro', 'icons.navigation.home'),
    /icons.navigation.home.*não encontrado/,
  );
});

test('content validation handles partial locale overrides, custom files and actionable errors', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'sciastro-icons-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await cp(resolve('starters/group'), folder, { recursive: true });
  const file = join(folder, 'sciastro.yaml');
  const data = parse(await readFile(file, 'utf8'));
  const save = async (icons) => writeFile(file, stringify({ ...data, icons }));
  await save({ languages: { pt: 'circle-flags:pt' } });
  let site = await loadSite(file);
  assert.equal(site.languageIcons.pt.name, 'circle-flags:pt');
  assert.equal(site.languageIcons.en.name, 'circle-flags:gb');
  assert.equal(
    site.pages.find((page) => page.id === 'software').icon.name,
    'lucide:code-xml',
  );
  await mkdir(join(folder, 'public/icons'), { recursive: true });
  await writeFile(
    join(folder, 'public/icons/custom.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>',
  );
  await save({ navigation: { research: { src: '/icons/custom.svg' } } });
  site = await loadSite(file, { base: '/lab/' });
  assert.deepEqual(site.pages.find((page) => page.id === 'research').icon, {
    kind: 'image',
    src: '/icons/custom.svg',
  });
  await save({ navigation: { research: { src: '/icons/missing.svg' } } });
  await assert.rejects(
    loadSite(file),
    /icons.navigation.research.*Imagem ausente/,
  );
  await save({ navigation: { research: { src: '../outside.svg' } } });
  await assert.rejects(loadSite(file), /fora da pasta/);
  await save({ navigation: { pesquisa: 'lucide:atom' } });
  await assert.rejects(
    loadSite(file),
    /icons.navigation.pesquisa.*página desconhecida/,
  );
  await save({ languages: { en: 'circle-flags:nonexistent' } });
  await assert.rejects(loadSite(file), /icons.languages.en.*não encontrado/);
});
