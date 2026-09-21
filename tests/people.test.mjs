import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  writeFile,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { loadSite } from '../dist/content.js';
import { configSchema, teamSchema } from '../dist/schema.js';

async function fixture(t, kind, composed) {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-people-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(`starters/${kind}`, root, { recursive: true });
  const path = join(root, 'sciastro.yaml');
  const config = parse(await readFile(path, 'utf8'));
  const teamPath = join(root, 'content/team.yaml');
  const members = parse(await readFile(teamPath, 'utf8'));
  if (composed) {
    config.pageFiles = ['people.yaml'];
    // Existing automatic-menu overrides have no meaning in this one-page fixture.
    delete config.icons;
    await writeFile(
      join(root, 'content/people.yaml'),
      stringify({
        id: 'home',
        title: { pt: 'Pessoas', en: 'People' },
        paths: { pt: '', en: 'en/' },
        sections: [{ type: 'team' }],
      }),
    );
  }
  const save = async () => {
    await writeFile(path, stringify(config));
    await writeFile(teamPath, stringify(members));
  };
  await save();
  return { root, path, config, members, save };
}

const symbol = {
  src: '/images/academic-symbol.svg',
  alt: { pt: 'Símbolo fictício', en: 'Fictional symbol' },
};

for (const kind of ['group', 'individual']) {
  for (const composed of [false, true]) {
    const mode = `${kind}, ${composed ? 'composed' : 'automatic'}`;
    test(`a custom people file preserves records, photos and grouping (${mode})`, async (t) => {
      const f = await fixture(t, kind, composed);
      f.config.people = { avatarFallback: symbol };
      await f.save();
      const original = await loadSite(f.path);
      f.config.people.file = 'pessoas/orientacoes.yaml';
      await f.save();
      await mkdir(join(f.root, 'content/pessoas'));
      const file = join(f.root, 'content/pessoas/orientacoes.yaml');
      await rename(join(f.root, 'content/team.yaml'), file);
      const custom = await loadSite(f.path);
      assert.equal(custom.config.people.file, 'pessoas/orientacoes.yaml');
      assert.deepEqual(custom.config.people.avatarFallback, symbol);
      assert.deepEqual(custom.members, original.members);
      assert.deepEqual(custom.pages, original.pages);

      // A legacy file must not be loaded or merged when an explicit source exists.
      await writeFile(join(f.root, 'content/team.yaml'), 'invalid: [');
      assert.deepEqual((await loadSite(f.path)).members, original.members);
      await writeFile(file, 'not-an-array: true');
      await assert.rejects(loadSite(f.path), /orientacoes\.yaml/);
    });

    test(`custom people files are required and stay inside contentDir (${mode})`, async (t) => {
      const f = await fixture(t, kind, composed);
      f.config.people = { avatarFallback: symbol };
      await f.save();
      await rm(join(f.root, 'content/team.yaml'));
      assert.deepEqual(
        (await loadSite(f.path)).members,
        [],
        'the omitted default remains optional',
      );

      for (const file of ['missing.yaml', 'team.yaml']) {
        f.config.people.file = file;
        await writeFile(f.path, stringify(f.config));
        await assert.rejects(loadSite(f.path), /Arquivo obrigatório ausente/);
      }
      for (const file of ['../outside.yaml', join(f.root, 'outside.yaml')]) {
        f.config.people.file = file;
        await writeFile(f.path, stringify(f.config));
        await assert.rejects(loadSite(f.path), /fora da pasta de conteúdo/);
      }
      f.config.people.file = '';
      assert.throws(() => configSchema.parse(f.config));
    });

    test(`people photos and site/member fallbacks load with localized labels (${mode})`, async (t) => {
      const f = await fixture(t, kind, composed);
      f.config.people = { avatarFallback: symbol };
      const person = f.members.find((member) => member.id === 'clara-santos');
      person.avatarFallback = { ...symbol, alt: 'Person-specific symbol' };
      await f.save();
      const site = await loadSite(f.path, { base: '/research/lab/' });
      const loaded = site.members.find((member) => member.id === person.id);
      assert.deepEqual(loaded.photo.position, [50, 35]);
      assert.equal(
        loaded.photo.alt.en,
        'Fictional illustration of Clara Santos',
      );
      assert.equal(loaded.avatarFallback.alt, 'Person-specific symbol');
      assert.deepEqual(site.config.people.avatarFallback, symbol);
      assert(
        site.pages.every((page) => page.path.startsWith('/research/lab/')),
      );
      // Existing YAML without people/photos remains valid; the renderer supplies
      // the built-in symbol without requiring a file in the consumer's public/.
      delete f.config.people;
      for (const member of f.members) {
        delete member.photo;
        delete member.avatarFallback;
      }
      await f.save();
      await rm(join(f.root, 'public'), { recursive: true });
      const minimal = await loadSite(f.path);
      assert.equal(minimal.config.people, undefined);
      assert(
        minimal.members.every(
          (member) => !member.photo && !member.avatarFallback,
        ),
      );
    });

    test(`missing local photos and fallback images fail before rendering (${mode})`, async (t) => {
      const f = await fixture(t, kind, composed);
      const person = f.members.find((member) => member.id === 'clara-santos');
      const originalPhoto = person.photo;
      person.photo = { ...originalPhoto, src: '/images/missing-photo.png' };
      await f.save();
      await assert.rejects(loadSite(f.path), /Imagem ausente.*missing-photo/);
      person.photo = originalPhoto;
      person.avatarFallback = { ...symbol, src: '/images/missing-person.svg' };
      await f.save();
      await assert.rejects(loadSite(f.path), /Imagem ausente.*missing-person/);
      delete person.avatarFallback;
      f.config.people = {
        avatarFallback: { ...symbol, src: '/images/missing-site.svg' },
      };
      await f.save();
      await assert.rejects(loadSite(f.path), /Imagem ausente.*missing-site/);
      f.config.people.avatarFallback.src = '/../outside.svg';
      await f.save();
      await assert.rejects(loadSite(f.path), /fora da pasta/);
    });

    test(`photo and fallback translations are validated (${mode})`, async (t) => {
      const f = await fixture(t, kind, composed);
      const person = f.members.find((member) => member.id === 'clara-santos');
      delete person.photo.alt.en;
      await f.save();
      await assert.rejects(loadSite(f.path), /photo.alt.*en/);
      person.photo.alt.en = 'Fictional portrait';
      person.avatarFallback = { ...symbol, alt: { pt: 'Símbolo' } };
      await f.save();
      await assert.rejects(loadSite(f.path), /avatarFallback.alt.*en/);
      delete person.avatarFallback;
      f.config.people = {
        avatarFallback: { ...symbol, alt: { pt: 'Símbolo' } },
      };
      await f.save();
      await assert.rejects(loadSite(f.path), /avatarFallback.alt.*en/);
    });
  }
}

test('photo framing uses bounded percentages and symbol crops require original image dimensions', () => {
  const person = { id: 'a', name: 'A', role: 'faculty', status: 'active' };
  const photo = { src: '/portrait.jpg', alt: 'Portrait' };
  for (const position of [
    [50, 35],
    [0, 100],
    [33.5, 62.1],
  ]) {
    assert.deepEqual(
      teamSchema.parse([{ ...person, photo: { ...photo, position } }])[0].photo
        .position,
      position,
    );
  }
  for (const position of [[-1, 50], [50, 101], [50], 'center', ['50', 50]]) {
    assert.throws(() =>
      teamSchema.parse([{ ...person, photo: { ...photo, position } }]),
    );
  }
  const crop = { ...symbol, viewBox: '0 0 64 64', width: 180, height: 64 };
  assert.deepEqual(
    teamSchema.parse([{ ...person, avatarFallback: crop }])[0].avatarFallback,
    crop,
  );
  for (const invalid of [
    { ...symbol, viewBox: '0 0 64 64' },
    { ...crop, width: 0 },
    { ...crop, viewBox: '0 0 0 64' },
    { ...crop, viewBox: 'not a crop' },
    { ...crop, unknown: true },
  ]) {
    assert.throws(() =>
      teamSchema.parse([{ ...person, avatarFallback: invalid }]),
    );
  }
  const config = {
    schemaVersion: 1,
    kind: 'group',
    name: 'Example',
    description: 'Example',
    url: 'https://example.org',
    home: { body: 'home.md' },
  };
  assert.deepEqual(
    configSchema.parse({ ...config, people: { avatarFallback: crop } }).people
      .avatarFallback,
    crop,
  );
  assert.throws(() =>
    configSchema.parse({
      ...config,
      people: { avatarFallback: { ...symbol, viewBox: '0 0 64 64' } },
    }),
  );
  assert.throws(() =>
    configSchema.parse({ ...config, people: { avatarFallbak: symbol } }),
  );
});
