import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { versionInfo, releaseNotes } from './version.mjs';

const mainRef = 'refs/remotes/origin/main';
const start = '<!-- sciastro:generated:start -->';
const end = '<!-- sciastro:generated:end -->';
const git = (root, ...args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

// Compare canonical SemVer, including alpha.9 < alpha.10 and prerelease < stable.
function compareVersions(left, right) {
  const parts = (value) => {
    versionInfo(value);
    const [core, ...suffix] = value.split('-');
    return {
      core: core.split('.').map(Number),
      pre: suffix.join('-').split('.').filter(Boolean),
    };
  };
  const a = parts(left),
    b = parts(right);
  for (let i = 0; i < 3; i++)
    if (a.core[i] !== b.core[i]) return a.core[i] < b.core[i] ? -1 : 1;
  if (!a.pre.length || !b.pre.length)
    return a.pre.length === b.pre.length ? 0 : a.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    if (a.pre[i] === b.pre[i]) continue;
    if (a.pre[i] === undefined) return -1;
    if (b.pre[i] === undefined) return 1;
    const numericA = /^\d+$/.test(a.pre[i]),
      numericB = /^\d+$/.test(b.pre[i]);
    if (numericA && numericB)
      return BigInt(a.pre[i]) < BigInt(b.pre[i]) ? -1 : 1;
    if (numericA !== numericB) return numericA ? -1 : 1;
    return a.pre[i] < b.pre[i] ? -1 : 1;
  }
  return 0;
}

export function changelogRange(root) {
  if (git(root, 'rev-parse', '--is-shallow-repository') === 'true')
    throw new Error(
      'Changelog generation requires full Git history. Fetch with --unshallow, then run release-fetch.',
    );
  let mainCommit;
  try {
    mainCommit = git(root, 'rev-parse', '--verify', `${mainRef}^{commit}`);
  } catch {
    throw new Error(
      'origin/main is unavailable. Run pixi run --locked release-fetch first.',
    );
  }
  const tags = new Map();
  const refs = git(
    root,
    'for-each-ref',
    '--format=%(refname:strip=2)\t%(objectname)\t%(*objectname)',
    'refs/tags',
  );
  for (const line of refs.split('\n').filter(Boolean)) {
    const [tag, object, peeled] = line.split('\t');
    if (!tag.startsWith('v')) continue;
    try {
      versionInfo(tag.slice(1));
    } catch {
      continue;
    }
    const commit = peeled || object;
    const existing = tags.get(commit);
    if (!existing || compareVersions(tag.slice(1), existing.slice(1)) > 0)
      tags.set(commit, tag);
  }
  // Select the nearest release in main's history, not the newest tag elsewhere
  // or the highest version from an unmerged development branch.
  for (const commit of git(
    root,
    'rev-list',
    '--first-parent',
    mainCommit,
  ).split('\n')) {
    const tag = tags.get(commit);
    if (tag)
      return {
        tag,
        baseCommit: commit,
        mainCommit,
        range: `${commit}..${mainCommit}`,
      };
  }
  throw new Error(
    'No release tag (vSEMVER) exists on origin/main first-parent history. Run release-fetch; prepare the first release manually if none exists.',
  );
}

export async function generateChangelog(root) {
  const source = changelogRange(root);
  if (source.baseCommit === source.mainCommit)
    throw new Error(
      'No commits on origin/main after the last release tag. Preparation-branch commits are intentionally excluded.',
    );
  let body;
  try {
    body = execFileSync(
      'git-cliff',
      [
        '--config',
        join(root, 'cliff.toml'),
        '--offline',
        '--no-exec',
        '--strip',
        'all',
        source.range,
      ],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
  } catch (error) {
    if (error.code === 'ENOENT')
      throw new Error(
        'git-cliff is missing. Run this task through the locked Pixi development environment.',
      );
    throw new Error(
      `git-cliff failed: ${error.stderr?.toString().trim() || error.message}`,
    );
  }
  if (!body)
    throw new Error(
      'git-cliff produced no release notes. Check cliff.toml before preparing a release.',
    );
  return {
    ...source,
    notes: `${start}\n<!-- Source: ${source.tag}..${source.mainCommit} -->\n\n${body}\n\n${end}`,
  };
}

export function updateChangelog(changelog, version, notes) {
  const heading = /^# Changelog\s*/.exec(changelog);
  if (!heading) throw new Error('CHANGELOG.md must start with # Changelog.');
  const releases = [...changelog.matchAll(/^## (\S+)\s*$/gm)];
  const current = releases.find((match) => match[1] === version);
  if (current) {
    if (current !== releases[0])
      throw new Error('Do not rewrite an older changelog release.');
    const bodyEnd = releases[1]?.index ?? changelog.length;
    const body = changelog.slice(current.index, bodyEnd);
    const first = body.indexOf(start),
      last = body.indexOf(end);
    if (
      first === -1 ||
      last < first ||
      body.indexOf(start, first + start.length) !== -1 ||
      body.indexOf(end, last + end.length) !== -1
    )
      throw new Error(
        'The existing release entry has no unique generated block. Preserve or restore its markers before regenerating.',
      );
    return (
      changelog.slice(0, current.index + first) +
      notes +
      changelog.slice(current.index + last + end.length)
    );
  }
  return `# Changelog\n\n## ${version}\n\n${notes}\n\n${changelog.slice(heading[0].length)}`;
}

export async function prepareRelease(root, version) {
  const info = versionInfo(version);
  // This also rejects local tags: release tags are created only after the merge.
  if (git(root, 'tag', '--list', info.tag))
    throw new Error(
      `Tag ${info.tag} already exists. Never rewrite a tagged release.`,
    );
  const generated = await generateChangelog(root);
  if (compareVersions(version, generated.tag.slice(1)) <= 0)
    throw new Error(
      `The new version must be greater than ${generated.tag.slice(1)}.`,
    );
  try {
    git(root, 'merge-base', '--is-ancestor', generated.mainCommit, 'HEAD');
  } catch {
    throw new Error(
      'Your branch does not include the current origin/main. Merge or rebase origin/main into it, then regenerate the changelog.',
    );
  }
  const packagePath = join(root, 'package.json');
  const changelogPath = join(root, 'CHANGELOG.md');
  const originalPackage = await readFile(packagePath, 'utf8');
  const pkg = JSON.parse(originalPackage);
  const originalChangelog = await readFile(changelogPath, 'utf8');
  if (
    pkg.version !== version &&
    !git(root, 'tag', '--list', `v${pkg.version}`) &&
    originalChangelog.includes(start)
  )
    throw new Error(
      `An untagged release (${pkg.version}) is already being prepared. Regenerate that version or deliberately restore its preparation before choosing another version.`,
    );
  const changelog = updateChangelog(
    originalChangelog,
    version,
    generated.notes,
  );
  // Validate before either file is touched. Additional notes outside the block
  // survive repeated preparations; previously published sections stay verbatim.
  releaseNotes(changelog, version);
  pkg.version = version;
  await writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  try {
    await writeFile(changelogPath, changelog);
  } catch (error) {
    await writeFile(packagePath, originalPackage);
    throw error;
  }
  return { ...generated, version };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === 'preview' && args.length === 0) {
      const result = await generateChangelog(process.cwd());
      console.log(`## Unreleased\n\n${result.notes}`);
    } else if (command === 'prepare' && args.length === 1) {
      const result = await prepareRelease(process.cwd(), args[0]);
      console.log(
        `Prepared ${result.version} from ${result.tag}..${result.mainCommit}. Review CHANGELOG.md and run version-check. No commit, tag or publication was created.`,
      );
    } else {
      throw new Error(
        'Usage: node scripts/changelog.mjs preview | prepare VERSION',
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
