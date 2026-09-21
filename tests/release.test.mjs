import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { checkVersions, setVersion, versionInfo } from '../scripts/version.mjs';
import {
  assertReleaseCommit,
  releaseInfo,
  integrity,
} from '../scripts/release.mjs';
import {
  publicationState,
  publishArguments,
  registryVersion,
} from '../scripts/publish.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const file of ['package.json', 'README.md', 'CHANGELOG.md', 'docs'])
    await cp(file, join(root, file), { recursive: true });
  for (const kind of ['group', 'individual', 'lncc']) {
    await mkdir(join(root, 'examples', kind), { recursive: true });
    await cp(
      `examples/${kind}/package.json`,
      join(root, 'examples', kind, 'package.json'),
    );
  }
  return root;
}

test('release versions accept canonical SemVer and separate stable/prerelease channels', () => {
  assert.equal(versionInfo('1.2.3').channel, 'latest');
  assert.equal(versionInfo('0.2.0-rc.1').channel, 'next');
  for (const invalid of [
    'v1.2.3',
    '1.2',
    '01.2.3',
    '1.2.3-alpha.01',
    '1.2.3+build',
    '1.2.3\n',
    '1.2.3;echo',
  ])
    assert.throws(() => versionInfo(invalid), /Invalid/);
});

test('version update changes the authority and changelog without changing docs or dependencies', async (t) => {
  const root = await fixture(t);
  const before = await checkVersions(root);
  const oldReadme = await readFile(join(root, 'README.md'), 'utf8');
  const oldSiteReadme = await readFile(
    join(root, 'docs/site-readme.md'),
    'utf8',
  );
  const oldPackage = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  );
  await setVersion(root, '2.3.4-beta.2');
  await assert.rejects(checkVersions(root), /Write release notes/);
  const path = join(root, 'CHANGELOG.md');
  await writeFile(
    path,
    (await readFile(path, 'utf8')).replace(
      '- TODO: describe this release and any migration steps.',
      '- New tested release.',
    ),
  );
  assert.equal(
    (await checkVersions(root, { tag: 'v2.3.4-beta.2' })).channel,
    'next',
  );
  assert((await readFile(path, 'utf8')).includes(`## ${before.version}`));
  const after = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.deepEqual(after.dependencies, oldPackage.dependencies);
  assert.equal(after.packageManager, oldPackage.packageManager);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), oldReadme);
  assert.equal(
    await readFile(join(root, 'docs/site-readme.md'), 'utf8'),
    oldSiteReadme,
  );
});

for (const field of ['tag', 'readme', 'docs', 'changelog', 'consumer']) {
  test(`version checker rejects a divergent ${field}`, async (t) => {
    const root = await fixture(t);
    const { version } = await checkVersions(root);
    const options = {};
    if (field === 'tag') options.tag = 'v9.8.7';
    if (field === 'readme')
      await writeFile(join(root, 'README.md'), '**Current version: `9.8.7`.**');
    if (field === 'docs')
      await writeFile(join(root, 'docs/stale.md'), 'Install sciastro@9.8.7\n');
    if (field === 'changelog')
      await writeFile(
        join(root, 'CHANGELOG.md'),
        '# Changelog\n\n## 9.8.7\n\nOld notes.',
      );
    if (field === 'consumer') {
      const path = join(root, 'examples/group/package.json');
      const data = JSON.parse(await readFile(path, 'utf8'));
      data.dependencies.sciastro = version;
      await writeFile(path, JSON.stringify(data));
    }
    await assert.rejects(checkVersions(root, options));
  });
}

test('built documentation must match the package version', async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, 'site'));
  await writeFile(
    join(root, 'site/release.json'),
    JSON.stringify({ version: '9.8.7' }),
  );
  await assert.rejects(
    checkVersions(root, { docs: join(root, 'site') }),
    /Documentation version/,
  );
});

test('release rejects tags outside main and accepts an immutable merged commit', async (t) => {
  const root = await fixture(t);
  const { version, tag } = await checkVersions(root);
  const git = (...args) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Release Tests',
        '-c',
        'user.email=tests@example.invalid',
        ...args,
      ],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
  git('init', '-b', 'main');
  git('add', '.');
  git('commit', '-m', 'Fixture');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('tag', '-a', tag, '-m', 'Release fixture');
  const info = await releaseInfo(root, `refs/tags/${tag}`, 'volpatto/sciastro');
  assert.equal(info.version, version);
  assert.equal(info.commit, git('rev-parse', 'HEAD'));
  await assert.rejects(
    releaseInfo(root, 'refs/heads/main', 'volpatto/sciastro'),
    /pushed v\* tag/,
  );
  await assert.rejects(
    releaseInfo(root, `refs/tags/${tag}`, 'other/fork'),
    /repository.url/,
  );
  await writeFile(join(root, 'unmerged.txt'), 'feature');
  git('add', '.');
  git('commit', '-m', 'Unmerged change');
  git('tag', 'v9.8.7');
  assert.throws(() => assertReleaseCommit(root, 'v9.8.7'), /origin\/main/);
  assert.throws(() => assertReleaseCommit(root, tag), /checkout must match/);
  // Advancing main must not force a tag to the new branch tip.
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('checkout', tag);
  assert.equal(assertReleaseCommit(root, tag), info.commit);
});

test('publication retries require the identical version and archive bytes', () => {
  const release = {
    name: 'sciastro',
    version: '1.0.0',
    integrity: integrity(Buffer.from('archive')),
  };
  assert.equal(publicationState(release, null), 'publish');
  assert.equal(
    publicationState(release, {
      ...release,
      dist: { integrity: release.integrity },
    }),
    'already-published',
  );
  assert.throws(
    () =>
      publicationState(release, {
        ...release,
        dist: { integrity: integrity(Buffer.from('different')) },
      }),
    /different contents/,
  );
  assert.throws(() =>
    publicationState(release, {
      ...release,
      version: '1.0.1',
      dist: { integrity: release.integrity },
    }),
  );
});

test('registry errors must not be interpreted as an unpublished package', async () => {
  assert.equal(
    await registryVersion('sciastro', '1.0.0', async () => ({ status: 404 })),
    null,
  );
  for (const status of [401, 429, 500])
    await assert.rejects(
      registryVersion('sciastro', '1.0.0', async () => ({ status, ok: false })),
      /publication was not attempted/,
    );
});

test('workflow gates npm and docs behind the full test suite and immutable artifacts', async () => {
  const workflow = parse(
    await readFile('.github/workflows/release.yml', 'utf8'),
  );
  assert.deepEqual(workflow.on, { push: { tags: ['v*'] } });
  const jobs = workflow.jobs;
  assert.equal(jobs.tests.uses, './.github/workflows/ci.yml');
  assert.equal(jobs.tests.with.ref, '${{ needs.validate.outputs.commit }}');
  assert.deepEqual(jobs.artifacts.needs, ['validate', 'tests']);
  assert(jobs.publish.needs.includes('artifacts'));
  assert(jobs.docs.needs.includes('publish'));
  assert.equal(jobs.publish.permissions['id-token'], 'write');
  assert(jobs.artifacts.env.SCIASTRO_TEST_ARCHIVE);
  const ci = parse(await readFile('.github/workflows/ci.yml', 'utf8'));
  assert.deepEqual(ci.jobs.tests.strategy.matrix.os, [
    'ubuntu-latest',
    'macos-latest',
    'windows-latest',
  ]);
  assert(ci.jobs.docs && ci.jobs.browser && ci.on.workflow_call);
  assert.equal(ci.permissions.contents, 'read');
  for (const job of Object.values(ci.jobs))
    for (const step of job.steps)
      assert(
        !step.uses?.startsWith('actions/deploy-pages'),
        'Normal CI must never deploy docs.',
      );
});

test('npm publication always uses a filesystem archive, including dry runs', () => {
  const release = {
    archive: 'artifacts/sciastro-1.0.0.tgz',
    channel: 'latest',
  };
  const args = publishArguments(release);
  assert.equal(args[1], resolve(release.archive));
  assert(args.includes('--ignore-scripts'));
  assert(!args.includes('--dry-run'));
  assert.deepEqual(publishArguments(release, true), [...args, '--dry-run']);
});

test('archive validation rejects a stale packaged manifest', async (t) => {
  const root = await fixture(t);
  const path = join(root, 'package');
  await mkdir(path);
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  pkg.version = '9.8.7';
  await writeFile(join(path, 'package.json'), JSON.stringify(pkg));
  const archive = join(root, 'stale.tgz');
  execFileSync('tar', ['-czf', archive, '-C', root, 'package'], {
    stdio: 'pipe',
  });
  await assert.rejects(
    checkVersions(root, { archive }),
    /Archive package.json version/,
  );
});

test('invalid version updates do not modify tracked version fields', async (t) => {
  const root = await fixture(t);
  const before = await readFile(join(root, 'package.json'), 'utf8');
  await assert.rejects(
    setVersion(root, 'not-semver'),
    /Invalid release version/,
  );
  assert.equal(await readFile(join(root, 'package.json'), 'utf8'), before);
});
