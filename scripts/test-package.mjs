import { execFileSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
import { parse, stringify } from 'yaml';

const root = resolve('.');
const scratch = await mkdtemp(join(tmpdir(), 'scipages-package-'));
const pnpm = process.env.npm_execpath;
assert(pnpm, 'Execute este teste com pnpm test:package.');
const run = (args, cwd = root, extraEnv = {}) =>
  execFileSync(process.execPath, [pnpm, ...args], {
    cwd,
    stdio: 'pipe',
    env: { ...process.env, ...extraEnv },
  }).toString();
async function htmlFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(file)));
    else if (file.endsWith('.html')) files.push(file);
  }
  return files;
}
async function audit(directory, base) {
  const files = await htmlFiles(directory);
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(
      new Set(ids).size,
      ids.length,
      `${file}: duplicate HTML/SVG IDs`,
    );
    for (const [, attribute, raw] of html.matchAll(/\b(href|src)="([^"]+)"/g)) {
      if (/^(?:[a-z]+:|\/\/)/i.test(raw)) continue;
      const href = raw.replaceAll('&amp;', '&');
      const [path, hash] = href.split('#');
      let target = file;
      if (path) {
        if (path.startsWith('/')) {
          assert(
            path.startsWith(base),
            `${file}: ${path} does not respect ${base}`,
          );
          target = join(directory, decodeURIComponent(path.slice(base.length)));
        } else target = resolve(dirname(file), decodeURIComponent(path));
        const entry = await stat(target).catch(() => null);
        assert(entry, `${file}: missing ${attribute}=${href}`);
        if (entry.isDirectory()) target = join(target, 'index.html');
      }
      if (hash && target.endsWith('.html'))
        assert(
          (await readFile(target, 'utf8')).includes(
            `id="${decodeURIComponent(hash)}"`,
          ),
          `${file}: missing anchor ${href}`,
        );
    }
  }
  return files.length;
}

try {
  run(['pack', '--pack-destination', scratch]);
  const tarball = join(
    scratch,
    (await readdir(scratch)).find((name) => name.endsWith('.tgz')),
  );
  for (const kind of ['group', 'individual']) {
    const consumer = join(scratch, kind);
    execFileSync(process.execPath, [
      join(root, 'dist/cli.js'),
      'init',
      consumer,
      '--kind',
      kind,
    ]);
    const packageFile = join(consumer, 'package.json');
    const pkg = JSON.parse(await readFile(packageFile, 'utf8'));
    pkg.dependencies.scipages = `file:${tarball}`;
    await writeFile(packageFile, JSON.stringify(pkg, null, 2));
    run(['install', '--no-frozen-lockfile'], consumer);
    assert.match(
      run(['exec', 'scipages', 'check'], consumer),
      /OK: [1-9]\d* páginas/,
    );
    const generated = join(scratch, `${kind}-from-installed-cli`);
    assert.match(
      run(['exec', 'scipages', 'init', generated, '--kind', kind], consumer),
      /Projeto .* criado/,
    );
    assert.match(
      await readFile(join(generated, 'scipages.yaml'), 'utf8'),
      new RegExp(`kind: ${kind}`),
    );
    const overrides =
      kind === 'group'
        ? { SITE_URL: 'https://example.org', BASE_PATH: '/lab/' }
        : { SITE_URL: 'https://example.org', BASE_PATH: '/' };
    // Exercise customization in a real installed consumer, including assets
    // beneath a deployment base path. The individual keeps all defaults.
    if (kind === 'group') {
      const configFile = join(consumer, 'scipages.yaml');
      const config = parse(await readFile(configFile, 'utf8'));
      config.icons = {
        navigation: {
          home: false,
          research: { src: '/icons/custom.svg' },
          team: 'lucide:microscope',
        },
        languages: { pt: false, en: 'lucide:languages' },
      };
      await writeFile(configFile, stringify(config));
      await mkdir(join(consumer, 'public/icons'), { recursive: true });
      await writeFile(
        join(consumer, 'public/icons/custom.svg'),
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>',
      );
    }
    run(['build'], consumer, overrides);
    const count = await audit(join(consumer, 'dist'), overrides.BASE_PATH);
    const home = await readFile(join(consumer, 'dist/index.html'), 'utf8');
    assert.match(home, kind === 'group' ? /Início/ : /Sobre/);
    assert.match(home, /Copyright \(c\) 2026 Lucide/);
    assert.match(home, /Copyright \(c\) 2026 HatScripts/);
    assert.match(home, /data-icon="lucide:code-xml"/);
    assert.match(home, /data-icon="lucide:mail"/);
    if (kind === 'group') {
      assert.match(home, /src="\/lab\/icons\/custom.svg"/);
      assert.match(home, /data-icon="lucide:microscope"/);
      assert.match(home, /data-icon="lucide:languages"/);
      assert.doesNotMatch(home, /data-icon="(?:lucide:house|circle-flags:br)"/);
    } else {
      assert.match(home, /data-icon="lucide:user-round"/);
      assert.match(home, /data-icon="circle-flags:br"/);
      assert.match(home, /data-icon="circle-flags:gb"/);
    }
    const team = await readFile(
      join(consumer, 'dist/equipe/index.html'),
      'utf8',
    );
    assert.match(team, /id="level-undergraduate"/);
    assert.match(team, /id="level-masters"/);
    assert.match(team, /id="level-phd"/);
    assert.match(team, /id="alumni"/);
    if (kind === 'group') assert.match(team, /id="faculty"/);
    const active = team.slice(
      team.indexOf('id="students"'),
      team.indexOf('id="alumni"'),
    );
    assert(
      !active.includes('Rafael Alves'),
      'Alumni leaked into active students',
    );
    assert.match(team.slice(team.indexOf('id="alumni"')), /Rafael Alves/);
    const research = await readFile(
      join(consumer, 'dist/pesquisa/index.html'),
      'utf8',
    );
    assert.match(research, /role="doc-biblioref"/);
    assert.match(research, /data-bibliography/);
    // Running init twice must never overwrite a populated consumer project.
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [join(root, 'dist/cli.js'), 'init', consumer],
        { stdio: 'pipe' },
      ),
    );
    console.log(
      `OK: pacote instalado isoladamente (${kind}), ${count} páginas e todos os links/âncoras locais; base=${overrides.BASE_PATH}`,
    );
  }
} catch (error) {
  console.error(error.stdout?.toString() ?? '');
  console.error(error.stderr?.toString() ?? '');
  throw error;
} finally {
  await rm(scratch, { recursive: true, force: true });
}
