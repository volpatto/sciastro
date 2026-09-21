import { execFileSync } from 'node:child_process';
import {
  mkdtemp,
  cp,
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
const sourcePackage = JSON.parse(
  await readFile(join(root, 'package.json'), 'utf8'),
);
const scratch = await mkdtemp(join(tmpdir(), 'sciastro-package-'));
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
  // Releases exercise the exact archive subsequently uploaded to npm.
  let tarball = process.env.SCIASTRO_TEST_ARCHIVE;
  if (tarball) tarball = resolve(tarball);
  else {
    run(['pack', '--skip-manifest-obfuscation', '--pack-destination', scratch]);
    tarball = join(
      scratch,
      (await readdir(scratch)).find((name) => name.endsWith('.tgz')),
    );
  }
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
    pkg.dependencies.sciastro = `file:${tarball}`;
    await writeFile(packageFile, JSON.stringify(pkg, null, 2));
    run(['install', '--no-frozen-lockfile'], consumer);
    assert.match(
      run(['exec', 'sciastro', 'check'], consumer),
      /OK: [1-9]\d* páginas/,
    );
    const generated = join(scratch, `${kind}-from-installed-cli`);
    assert.match(
      run(
        [
          'exec',
          'sciastro',
          'init',
          generated,
          '--kind',
          kind,
          '--theme',
          'lncc',
        ],
        consumer,
      ),
      /Projeto .* criado/,
    );
    assert.match(
      await readFile(join(generated, 'sciastro.yaml'), 'utf8'),
      new RegExp(`kind: ${kind}`),
    );
    assert.match(
      await readFile(join(generated, 'sciastro.yaml'), 'utf8'),
      /theme: lncc/,
    );
    const generatedPackage = JSON.parse(
      await readFile(join(generated, 'package.json'), 'utf8'),
    );
    assert.equal(generatedPackage.dependencies.sciastro, sourcePackage.version);
    assert.equal(generatedPackage.packageManager, sourcePackage.packageManager);
    assert.deepEqual(generatedPackage.engines, sourcePackage.engines);
    assert.equal(
      generatedPackage.dependencies.astro,
      sourcePackage.devDependencies.astro,
    );
    const overrides =
      kind === 'group'
        ? { SITE_URL: 'https://example.org', BASE_PATH: '/lab/' }
        : { SITE_URL: 'https://example.org', BASE_PATH: '/' };
    // Exercise customization in a real installed consumer, including assets
    // beneath a deployment base path. The individual keeps all defaults.
    if (kind === 'group') {
      const configFile = join(consumer, 'sciastro.yaml');
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
    const smoke = join(consumer, 'dev-test.mjs');
    await writeFile(
      smoke,
      `import assert from 'node:assert/strict';
import { dev } from 'astro';
import {readFile,writeFile} from 'node:fs/promises';
const server = await dev({root:process.cwd(), server:{host:'127.0.0.1',port:0}, logLevel:'error'});
try {
  const url='http://127.0.0.1:'+server.address.port+'/';
  const response=await fetch(url); assert.equal(response.status,200); assert.match(await response.text(),/<h1/);
  const original=await readFile('sciastro.yaml','utf8');
  await writeFile('sciastro.yaml',original.replace(/^name:.*$/m,'name: Updated Regression Site'));
  let updated=false;
  for(let attempt=0;attempt<50&&!updated;attempt++) {
    await new Promise(resolve=>setTimeout(resolve,100));
    try {const response=await fetch(url,{signal:AbortSignal.timeout(1000)});updated=response.status===200&&(await response.text()).includes('Updated Regression Site');} catch {}
  }
  await writeFile('sciastro.yaml',original);
  assert(updated,'YAML edit must refresh the installed-consumer preview');
}
finally { await server.stop(); }`,
    );
    execFileSync(process.execPath, [smoke], {
      cwd: consumer,
      stdio: 'pipe',
      timeout: 60000,
    });
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
    if (kind === 'individual') {
      for (const path of ['content', 'src', 'public']) {
        const source = join(root, 'examples/lncc', path);
        const destination = join(consumer, path);
        await rm(destination, { recursive: true, force: true });
        if (path === 'public') {
          // The asset-free example has no tracked public/ directory. Git does
          // not preserve empty directories, so a fresh checkout may omit it.
          const assets = await stat(source).catch((error) => {
            if (error.code !== 'ENOENT') throw error;
            return undefined;
          });
          if (!assets) {
            await mkdir(destination, { recursive: true });
            continue;
          }
        }
        await cp(source, destination, {
          recursive: true,
        });
      }
      for (const path of ['sciastro.yaml', 'astro.config.mjs'])
        await cp(join(root, 'examples/lncc', path), join(consumer, path));
      const base = '/institute/lab/';
      run(['build'], consumer, {
        SITE_URL: 'https://institute.example.org',
        BASE_PATH: base,
      });
      const count = await audit(join(consumer, 'dist'), base);
      const home = await readFile(join(consumer, 'dist/index.html'), 'utf8');
      assert.match(home, /data-design="lncc"/);
      assert.match(home, /data-custom-component="project-note"/);
      assert(
        (
          await readFile(join(consumer, 'dist/linhas/index.html'), 'utf8')
        ).includes('href="/institute/lab/en/topics/"'),
        'language switch preserves custom route under base',
      );
      execFileSync(process.execPath, [smoke], {
        cwd: consumer,
        stdio: 'pipe',
        timeout: 60000,
      });
      // Exercise public renderer/layout overrides through the installed exports.
      await writeFile(
        join(consumer, 'src/components/LocalLayout.astro'),
        `---
import Base from 'sciastro/components/Layout.astro';
---
<Base {...Astro.props}><div data-local-layout><slot/></div></Base>`,
      );
      await writeFile(
        join(consumer, 'src/components/LocalProse.astro'),
        `---
import Base from 'sciastro/components/Section.astro';
---
<div data-local-prose><Base {...Astro.props}/></div>`,
      );
      const originalConfig = await readFile(
        join(consumer, 'astro.config.mjs'),
        'utf8',
      );
      await writeFile(
        join(consumer, 'astro.config.mjs'),
        originalConfig
          .replace(
            'components: { sections:',
            "components: { layout: './src/components/LocalLayout.astro', sections:",
          )
          .replace(
            "'project-note':",
            "prose: './src/components/LocalProse.astro', 'project-note':",
          ),
      );
      run(['build'], consumer);
      assert(
        (await readFile(join(consumer, 'dist/404.html'), 'utf8')).includes(
          'data-local-layout',
        ),
      );
      assert(
        (
          await readFile(join(consumer, 'dist/linhas/index.html'), 'utf8')
        ).includes('data-local-prose'),
      );
      await writeFile(join(consumer, 'astro.config.mjs'), originalConfig);
      // A missing registration is an actionable build error, never an empty section.
      const config = await readFile(join(consumer, 'astro.config.mjs'), 'utf8');
      await writeFile(
        join(consumer, 'astro.config.mjs'),
        "import {defineConfig} from 'astro/config'; import sciastro from 'sciastro'; export default defineConfig({integrations:[sciastro()]});",
      );
      assert.throws(
        () => run(['build'], consumer),
        (error) =>
          /register components.sections.project-note/.test(
            error.stdout?.toString() + error.stderr?.toString(),
          ),
      );
      await writeFile(join(consumer, 'astro.config.mjs'), config);
      console.log(
        `OK: LNCC Theme Installed Package Tests, ${count} pages, custom components/CSS, development and subdirectory deployment.`,
      );
    }
  }
} catch (error) {
  console.error(error.stdout?.toString() ?? '');
  console.error(error.stderr?.toString() ?? '');
  throw error;
} finally {
  await rm(scratch, { recursive: true, force: true });
}
