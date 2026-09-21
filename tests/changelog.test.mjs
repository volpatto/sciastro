import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  changelogRange,
  generateChangelog,
  prepareRelease,
} from '../scripts/changelog.mjs';
import { releaseNotes } from '../scripts/version.mjs';

async function fixture(t, version = '1.0.0') {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-changelog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Changelog Tests',
        '-c',
        'user.email=tests@example.invalid',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'tag.gpgsign=false',
        ...args,
      ],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
  git('init', '-b', 'main');
  git('config', 'core.autocrlf', 'false');
  await cp('cliff.toml', join(root, 'cliff.toml'));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify(
      { name: 'sciastro', version, dependencies: { example: '1.0.0' } },
      null,
      2,
    ) + '\n',
  );
  const oldChangelog = `# Changelog\n\n## ${version}\n\n- Reviewed release notes: preserve this exact text.\n`;
  await writeFile(join(root, 'CHANGELOG.md'), oldChangelog);
  git('add', '.');
  git('commit', '-m', 'Initial released content');
  git('tag', '-a', `v${version}`, '-m', 'Published release');
  const base = git('rev-parse', 'HEAD');
  git(
    'commit',
    '--allow-empty',
    '-m',
    'feat: add BibTeX publication cards (#12)',
  );
  git('commit', '--allow-empty', '-m', 'fix: handle missing DOI (#13)');
  git(
    'commit',
    '--allow-empty',
    '-m',
    'Improve documentation without a conventional prefix (#14)',
  );
  const mainCommit = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', mainCommit);
  git('checkout', '-b', 'a-name-with-no-release-pattern');
  git(
    'commit',
    '--allow-empty',
    '-m',
    'feat: preparation-only change MUST-NOT-APPEAR',
  );
  git(
    'commit',
    '--allow-empty',
    '-m',
    'Review the preparation CHANGELOG MUST-NOT-APPEAR',
  );
  return { root, git, base, mainCommit, oldChangelog };
}

test('git-cliff uses only last-release..origin/main, regardless of branch names, local commits or foreign tags', async (t) => {
  const f = await fixture(t);
  f.git('tag', 'v99.0.0'); // Newer version, but it is not on main.
  f.git('tag', 'vnot-a-release', f.mainCommit);
  const before = f.git('status', '--porcelain');
  const result = await generateChangelog(f.root);
  assert.equal(result.tag, 'v1.0.0');
  assert.equal(result.mainCommit, f.mainCommit);
  assert.equal(result.range, `${f.base}..${f.mainCommit}`);
  assert.match(result.notes, /### Features[\s\S]*add BibTeX publication cards/);
  assert.match(result.notes, /### Fixes[\s\S]*handle missing DOI/);
  assert.match(
    result.notes,
    /### Other changes[\s\S]*without a conventional prefix/,
  );
  assert.doesNotMatch(result.notes, /MUST-NOT-APPEAR|Initial released content/);
  assert.equal(
    f.git('status', '--porcelain'),
    before,
    'preview does not edit files',
  );
});

test('prepare and regenerate are idempotent and preserve previous releases and handwritten migration notes', async (t) => {
  const f = await fixture(t);
  const original = JSON.parse(
    await readFile(join(f.root, 'package.json'), 'utf8'),
  );
  const head = f.git('rev-parse', 'HEAD');
  const tags = f.git('tag', '--list');
  const path = join(f.root, 'CHANGELOG.md');
  await prepareRelease(f.root, '1.1.0');
  const first = await readFile(path, 'utf8');
  assert(first.endsWith(f.oldChangelog.replace(/^# Changelog\s*/, '')));
  assert.match(releaseNotes(first, '1.1.0'), /add BibTeX publication cards/);
  const pkg = JSON.parse(await readFile(join(f.root, 'package.json'), 'utf8'));
  assert.deepEqual(pkg, { ...original, version: '1.1.0' });
  await prepareRelease(f.root, '1.1.0');
  assert.equal(await readFile(path, 'utf8'), first);
  const migration = first.replace(
    '<!-- sciastro:generated:end -->',
    '<!-- sciastro:generated:end -->\n\n### Migration\n\nKeep these reviewed instructions.',
  );
  await writeFile(path, migration);
  f.git('add', '.');
  f.git('commit', '-m', 'Prepare Release v1.1.0 MUST-NOT-APPEAR');
  await prepareRelease(f.root, '1.1.0');
  assert.equal(await readFile(path, 'utf8'), migration);
  assert.doesNotMatch(migration, /MUST-NOT-APPEAR/);
  assert.equal(f.git('tag', '--list'), tags, 'preparation creates no tag');
  assert.equal(
    f.git('rev-parse', 'HEAD^'),
    head,
    'only the test created a commit',
  );
});

test('new main commits require branch synchronization and then enter regenerated notes', async (t) => {
  const f = await fixture(t);
  await prepareRelease(f.root, '1.1.0');
  f.git('add', '.');
  f.git('commit', '-m', 'Prepare release');
  f.git('checkout', 'main');
  f.git(
    'commit',
    '--allow-empty',
    '-m',
    'docs: describe another merged feature',
  );
  f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  f.git('checkout', 'a-name-with-no-release-pattern');
  const before = await readFile(join(f.root, 'CHANGELOG.md'), 'utf8');
  await assert.rejects(
    prepareRelease(f.root, '1.1.0'),
    /Merge or rebase origin\/main/,
  );
  assert.equal(await readFile(join(f.root, 'CHANGELOG.md'), 'utf8'), before);
  f.git('merge', '--no-edit', 'origin/main');
  await prepareRelease(f.root, '1.1.0');
  const regenerated = await readFile(join(f.root, 'CHANGELOG.md'), 'utf8');
  assert.match(regenerated, /another merged feature/);
  assert.doesNotMatch(regenerated, /MUST-NOT-APPEAR|Prepare release/);
});

test('a squash-merged preparation is excluded from the following release by its tag', async (t) => {
  const f = await fixture(t);
  await prepareRelease(f.root, '1.1.0');
  f.git('add', '.');
  f.git('commit', '-m', 'Prepare and review release metadata');
  f.git('checkout', 'main');
  f.git('merge', '--squash', 'a-name-with-no-release-pattern');
  f.git('commit', '-m', 'Prepare Release v1.1.0 (#15)');
  f.git('tag', 'v1.1.0'); // Lightweight tags work as well as annotated ones.
  f.git(
    'commit',
    '--allow-empty',
    '-m',
    'feat!: introduce a new configuration contract',
  );
  f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  f.git('checkout', '-b', 'next-release-any-name');
  const result = await prepareRelease(f.root, '2.0.0');
  assert.equal(result.tag, 'v1.1.0');
  assert.match(result.notes, /\*\*Breaking:\*\*.*new configuration contract/);
  assert.doesNotMatch(
    result.notes,
    /Prepare Release|BibTeX publication cards|MUST-NOT-APPEAR/,
  );
});

test('release tag selection follows main topology and handles prerelease versions numerically', async (t) => {
  const f = await fixture(t, '1.0.0-alpha.9');
  await prepareRelease(f.root, '1.0.0-alpha.10');
  // Two tags at the same commit: choose the higher canonical version.
  f.git('tag', 'v1.0.0-alpha.10', f.mainCommit);
  f.git('tag', 'v1.0.0-alpha.11', f.mainCommit);
  assert.equal(changelogRange(f.root).tag, 'v1.0.0-alpha.11');
});

test('invalid, old, tagged or conflicting pending versions cannot overwrite release files', async (t) => {
  const f = await fixture(t);
  const before = await readFile(join(f.root, 'package.json'), 'utf8');
  for (const version of ['not-a-version', '0.9.0', '1.0.0', '1.0.0-rc.1'])
    await assert.rejects(
      prepareRelease(f.root, version),
      /Invalid release version|already exists|greater than/,
    );
  assert.equal(await readFile(join(f.root, 'package.json'), 'utf8'), before);
  assert.equal(
    await readFile(join(f.root, 'CHANGELOG.md'), 'utf8'),
    f.oldChangelog,
  );
  await prepareRelease(f.root, '1.1.0');
  const prepared = await readFile(join(f.root, 'CHANGELOG.md'), 'utf8');
  await assert.rejects(prepareRelease(f.root, '1.2.0'), /untagged release/);
  assert.equal(await readFile(join(f.root, 'CHANGELOG.md'), 'utf8'), prepared);
  await writeFile(
    join(f.root, 'CHANGELOG.md'),
    prepared.replace(
      '<!-- sciastro:generated:start -->',
      'Handwritten content',
    ),
  );
  await assert.rejects(prepareRelease(f.root, '1.1.0'), /markers/);
  assert.equal(
    JSON.parse(await readFile(join(f.root, 'package.json'), 'utf8')).version,
    '1.1.0',
  );
});

test('missing main, missing tags, empty ranges and shallow clones fail explicitly', async (t) => {
  const f = await fixture(t);
  f.git('update-ref', '-d', 'refs/remotes/origin/main');
  assert.throws(() => changelogRange(f.root), /origin\/main is unavailable/);
  f.git('update-ref', 'refs/remotes/origin/main', f.base);
  await assert.rejects(generateChangelog(f.root), /No commits on origin\/main/);
  f.git('tag', '-d', 'v1.0.0');
  assert.throws(() => changelogRange(f.root), /No release tag/);
  await writeFile(join(f.root, '.git/shallow'), f.base + '\n');
  assert.throws(() => changelogRange(f.root), /full Git history/);
});

test('git-cliff failures leave both package metadata and changelog unchanged', async (t) => {
  const f = await fixture(t);
  const original = await readFile(join(f.root, 'package.json'), 'utf8');
  await writeFile(join(f.root, 'cliff.toml'), '[invalid TOML');
  await assert.rejects(prepareRelease(f.root, '1.1.0'), /git-cliff failed/);
  assert.equal(await readFile(join(f.root, 'package.json'), 'utf8'), original);
  assert.equal(
    await readFile(join(f.root, 'CHANGELOG.md'), 'utf8'),
    f.oldChangelog,
  );
});

test('a commit mentioning TODO is a valid note, but the original TODO placeholder is rejected', () => {
  assert.match(
    releaseNotes(
      '# Changelog\n\n## 1.0.0\n\n- Remove TODO comments from examples.',
      '1.0.0',
    ),
    /Remove TODO/,
  );
  assert.throws(
    () =>
      releaseNotes(
        '# Changelog\n\n## 1.0.0\n\n- TODO: describe this release.',
        '1.0.0',
      ),
    /Write release notes/,
  );
});
