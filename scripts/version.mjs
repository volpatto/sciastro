import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// npm versions cannot contain build metadata in this release policy. Reject
// noncanonical numeric identifiers so a Git tag cannot normalize to another version.
export function versionInfo(version) {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(
      version,
    );
  if (
    !match ||
    match[0] !== version ||
    match.slice(1, 4).some((part) => !Number.isSafeInteger(Number(part))) ||
    (match[4] && match[4].split('.').some((part) => /^0\d+$/.test(part)))
  )
    throw new Error(
      `Invalid release version: ${version}. Use X.Y.Z, optionally with a prerelease suffix (no leading v or build metadata).`,
    );
  return {
    version,
    tag: `v${version}`,
    channel: match[4] ? 'next' : 'latest',
    prerelease: Boolean(match[4]),
  };
}

export function releaseNotes(changelog, version) {
  const headings = [...changelog.matchAll(/^## (\S+)\s*$/gm)];
  if (!headings.length || headings[0][1] !== version)
    throw new Error(`The first CHANGELOG.md release must be ## ${version}.`);
  const notes = changelog
    .slice(headings[0].index + headings[0][0].length, headings[1]?.index)
    .trim();
  if (!notes || /^\s*-\s+TODO(?:\s|:|$)/m.test(notes))
    throw new Error('Write release notes in CHANGELOG.md before releasing.');
  return notes;
}

async function markdownFiles(dir) {
  const paths = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.isDirectory())
      paths.push(...(await markdownFiles(join(dir, item.name))));
    else if (item.name.endsWith('.md')) paths.push(join(dir, item.name));
  }
  return paths;
}

export async function checkVersions(root, { tag, archive, docs } = {}) {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const info = versionInfo(pkg.version);
  if (tag !== undefined && tag !== info.tag)
    throw new Error(`Tag ${tag} does not match package.json (${info.tag}).`);
  const files = [
    join(root, 'README.md'),
    ...(await markdownFiles(join(root, 'docs'))),
  ];
  for (const path of files) {
    const source = await readFile(path, 'utf8');
    if (
      /Current version:|Documentation for \d+\.|\{\{ sciastro_version \}\}/.test(
        source,
      )
    )
      throw new Error(
        `${path}: describe the project without embedding a package version.`,
      );
    for (const match of source.matchAll(
      /sciastro(?:-|@)(\d+\.\d+\.\d+(?:-[\w.-]+)?)(?:\.tgz|(?=[\s`]))/g,
    )) {
      const actual = match[1].replace(/\.tgz$/, '');
      throw new Error(
        `${path}: replace hardcoded SciAstro version ${actual} with VERSION or a release channel.`,
      );
    }
  }
  for (const name of ['group', 'individual', 'lncc', 'writing']) {
    const example = JSON.parse(
      await readFile(join(root, 'examples', name, 'package.json'), 'utf8'),
    );
    if (!example.private || example.dependencies?.sciastro !== 'workspace:*')
      throw new Error(
        `examples/${name}: keep the consumer private and sciastro at workspace:*.`,
      );
  }
  const notes = releaseNotes(
    await readFile(join(root, 'CHANGELOG.md'), 'utf8'),
    info.version,
  );
  if (archive) {
    const packed = JSON.parse(
      execFileSync('tar', ['-xOf', resolve(archive), 'package/package.json'], {
        encoding: 'utf8',
      }),
    );
    for (const key of [
      'name',
      'version',
      'repository',
      'engines',
      'packageManager',
      'dependencies',
      'peerDependencies',
      'exports',
      'publishConfig',
    ])
      if (JSON.stringify(packed[key]) !== JSON.stringify(pkg[key]))
        throw new Error(
          `Archive package.json ${key} differs from the source manifest.`,
        );
  }
  if (docs) {
    const built = JSON.parse(
      await readFile(join(docs, 'release.json'), 'utf8'),
    );
    if (built.version !== info.version)
      throw new Error(
        `Documentation version ${built.version} differs from ${info.version}.`,
      );
  }
  return { ...info, name: pkg.name, notes };
}

export async function setVersion(root, version) {
  versionInfo(version);
  const path = join(root, 'package.json');
  const pkg = JSON.parse(await readFile(path, 'utf8'));
  const previous = pkg.version;
  if (previous === version) return;
  pkg.version = version;
  await writeFile(path, JSON.stringify(pkg, null, 2) + '\n');
  const changelogPath = join(root, 'CHANGELOG.md');
  const changelog = await readFile(changelogPath, 'utf8');
  await writeFile(
    changelogPath,
    changelog.replace(
      /^# Changelog\s*/,
      `# Changelog\n\n## ${version}\n\n- TODO: describe this release and any migration steps.\n\n`,
    ),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === 'set' && args.length === 1) {
      await setVersion(process.cwd(), args[0]);
      console.log(
        'Package version updated. Complete the new CHANGELOG.md entry, then run version-check.',
      );
    } else if (command === 'check') {
      const options = {};
      for (let i = 0; i < args.length; i += 2) {
        if (!['--tag', '--archive', '--docs'].includes(args[i]) || !args[i + 1])
          throw new Error(
            'Expected --tag TAG, --archive FILE or --docs DIRECTORY.',
          );
        options[args[i].slice(2)] = args[i + 1];
      }
      const info = await checkVersions(process.cwd(), options);
      console.log(`Versions consistent: ${info.version} (${info.channel}).`);
    } else
      throw new Error(
        'Usage: node scripts/version.mjs check [--tag vX.Y.Z] [--archive FILE] [--docs DIRECTORY] | set X.Y.Z',
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
