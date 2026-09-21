import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkVersions } from './version.mjs';

export function assertReleaseCommit(root, tag) {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const commit = git('rev-parse', 'HEAD');
  if (git('rev-parse', `refs/tags/${tag}^{commit}`) !== commit)
    throw new Error(
      'The checkout must match the release tag, not a moving branch.',
    );
  try {
    git('merge-base', '--is-ancestor', commit, 'refs/remotes/origin/main');
  } catch {
    throw new Error(
      'Release tags must point to commits already included in origin/main.',
    );
  }
  return commit;
}

export async function releaseInfo(root, ref, repository) {
  if (!ref?.startsWith('refs/tags/v'))
    throw new Error('Releases require a pushed v* tag.');
  const info = await checkVersions(root, {
    tag: ref.slice('refs/tags/'.length),
  });
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  if (
    !repository ||
    pkg.repository?.url !== `https://github.com/${repository}.git`
  )
    throw new Error(
      'package.json repository.url must match the GitHub repository for trusted publishing.',
    );
  return { ...info, commit: assertReleaseCommit(root, info.tag) };
}

export function integrity(bytes) {
  return `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const info = await releaseInfo(
      process.cwd(),
      process.env.GITHUB_REF,
      process.env.GITHUB_REPOSITORY,
    );
    const command = process.argv[2];
    if (command === 'check') {
      if (process.env.GITHUB_OUTPUT)
        await appendFile(
          process.env.GITHUB_OUTPUT,
          ['version', 'tag', 'channel', 'prerelease', 'commit']
            .map((key) => `${key}=${info[key]}\n`)
            .join(''),
        );
    } else if (command === 'artifacts') {
      const archive = `artifacts/${info.name}-${info.version}.tgz`;
      await checkVersions(process.cwd(), {
        tag: info.tag,
        archive,
        docs: 'site',
      });
      const metadata = JSON.parse(await readFile('site/release.json', 'utf8'));
      if (metadata.commit !== info.commit)
        throw new Error('The docs were not built for the release commit.');
      await writeFile(
        'artifacts/release.json',
        JSON.stringify(
          { ...info, archive, integrity: integrity(await readFile(archive)) },
          null,
          2,
        ) + '\n',
      );
      await writeFile('artifacts/release-notes.md', info.notes + '\n');
    } else throw new Error('Usage: node scripts/release.mjs check|artifacts');
    console.log(
      `Release validated: ${info.tag} at ${info.commit} (${info.channel}).`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
