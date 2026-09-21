import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { integrity } from './release.mjs';
import { checkVersions } from './version.mjs';

export function publishArguments(release, dryRun = false) {
  // An unprefixed relative path can be parsed by npm as a GitHub repository.
  return [
    'publish',
    resolve(release.archive),
    '--access',
    'public',
    '--tag',
    release.channel,
    '--ignore-scripts',
    ...(dryRun ? ['--dry-run'] : []),
  ];
}

export function publicationState(release, existing) {
  if (existing === null) return 'publish';
  if (
    existing.name !== release.name ||
    existing.version !== release.version ||
    existing.dist?.integrity !== release.integrity
  )
    throw new Error(
      'This npm version already exists with different contents. Do not move the tag; prepare a new version.',
    );
  return 'already-published';
}

export async function registryVersion(name, version, request = fetch) {
  const response = await request(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
    { signal: AbortSignal.timeout(30000) },
  );
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(
      `npm registry returned ${response.status}; publication was not attempted.`,
    );
  return response.json();
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const dryRun = process.argv.length === 3 && process.argv[2] === '--dry-run';
    if (process.argv.length > 2 && !dryRun)
      throw new Error('Usage: node scripts/publish.mjs [--dry-run]');
    if (
      !dryRun &&
      (process.env.GITHUB_ACTIONS !== 'true' ||
        !process.env.ACTIONS_ID_TOKEN_REQUEST_URL)
    )
      throw new Error(
        'Automatic publication requires the release workflow and npm trusted publishing.',
      );
    const release = JSON.parse(
      await readFile('artifacts/release.json', 'utf8'),
    );
    const current = await checkVersions(process.cwd(), {
      tag: release.tag,
      archive: release.archive,
    });
    if (
      release.version !== current.version ||
      release.channel !== current.channel ||
      release.name !== current.name
    )
      throw new Error(
        'Release artifact metadata differs from the checked-out package.',
      );
    if (integrity(await readFile(release.archive)) !== release.integrity)
      throw new Error('Release archive checksum mismatch.');
    if (dryRun) {
      execFileSync('npm', publishArguments(release, true), {
        stdio: 'inherit',
      });
      process.exit(0);
    }
    const state = publicationState(
      release,
      await registryVersion(release.name, release.version),
    );
    if (state === 'publish') {
      execFileSync('npm', publishArguments(release), { stdio: 'inherit' });
      console.log(
        `Published ${release.name}@${release.version} to ${release.channel}.`,
      );
    } else {
      console.log(
        'The identical archive is already on npm; continuing this release without republishing.',
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
