#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { loadSite } from './content.js';

const usage = `SciPages — sites acadêmicos com YAML, Markdown e BibTeX

  scipages init <pasta> --kind group|individual
  scipages check [--config scipages.yaml]

init cria um projeto em pasta nova ou vazia; não instala nem publica nada.
check valida configuração, traduções, conteúdo e referências localmente.
`;

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      kind: { type: 'string', default: 'group' },
      config: { type: 'string', default: 'scipages.yaml' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || positionals.length === 0) {
    console.log(usage);
    return;
  }
  const [command, destination] = positionals;
  if (command === 'check') {
    const site = await loadSite(resolve(values.config), {
      url: process.env.SITE_URL,
      base: process.env.BASE_PATH,
    });
    console.log(
      `OK: ${site.pages.length} páginas, ${site.members.length} pessoas e ${site.bibliographyKeys.length} referências.`,
    );
    return;
  }
  if (command !== 'init' || !destination || positionals.length !== 2)
    throw new Error(usage);
  if (!['group', 'individual'].includes(values.kind))
    throw new Error('--kind deve ser group ou individual.');
  const target = resolve(destination);
  let files: string[] = [];
  try {
    files = await readdir(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (files.length)
    throw new Error(
      `A pasta ${target} não está vazia. Nenhum arquivo foi alterado.`,
    );
  const packageRoot = fileURLToPath(new URL('../', import.meta.url));
  const pkg = JSON.parse(
    await readFile(join(packageRoot, 'package.json'), 'utf8'),
  );
  await mkdir(target, { recursive: true });
  await cp(join(packageRoot, 'starters', values.kind), target, {
    recursive: true,
  });
  await mkdir(join(target, 'public'), { recursive: true });
  await writeFile(
    join(target, 'package.json'),
    JSON.stringify(
      {
        name: 'my-scipages-site',
        private: true,
        type: 'module',
        packageManager: pkg.packageManager,
        engines: pkg.engines,
        scripts: {
          dev: 'astro dev --host 127.0.0.1',
          build: 'astro build',
          preview: 'astro preview --host 127.0.0.1',
          'dev:stop': 'astro dev stop',
          'preview:stop': 'astro preview stop',
          check: 'scipages check',
        },
        dependencies: { scipages: pkg.version, astro: '7.3.3' },
      },
      null,
      2,
    ) + '\n',
  );
  await writeFile(
    join(target, '.gitignore'),
    'node_modules/\n.pixi/\ndist/\n.astro/\n.sites-runtime/\n.DS_Store\n',
  );
  await writeFile(
    join(target, 'pnpm-workspace.yaml'),
    'allowBuilds:\n  esbuild: true\n',
  );
  await writeFile(
    join(target, 'pixi.toml'),
    `[workspace]\nname = "my-scipages-site"\nchannels = ["conda-forge"]\nplatforms = ["osx-arm64", "osx-64", "linux-64", "win-64"]\n\n[dependencies]\nnodejs = "24.*"\npnpm = "==11.19.0"\n\n[tasks.setup]\ncmd = "pnpm install --frozen-lockfile"\n[tasks.dev]\ncmd = "pnpm dev"\ndepends-on = ["setup"]\n[tasks.build]\ncmd = "pnpm check && pnpm build"\ndepends-on = ["setup"]\n[tasks.dev-stop]\ncmd = "pnpm dev:stop"\ndepends-on = ["setup"]\n`,
  );
  await cp(join(packageRoot, 'docs/site-readme.md'), join(target, 'README.md'));
  console.log(
    `Projeto ${values.kind} criado em ${target}. Edite scipages.yaml e content/. Consulte o README para instalar as dependências.`,
  );
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      `SciPages: ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  });
}
