import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import ts from 'typescript';
import { parse } from 'yaml';
import { loadSite } from '../dist/content.js';
import { sectionSchema } from '../dist/sections.js';
import { configSchema } from '../dist/schema.js';
import { main } from '../dist/cli.js';

for (const kind of ['individual', 'group']) {
  test(`documentation tutorial: ${kind} files load and produce the described pages`, async (t) => {
    const root = await mkdtemp(join(tmpdir(), `sciastro-docs-${kind}-`));
    t.after(() => rm(root, { recursive: true, force: true }));
    const source = (
      await readFile(`docs/tutorials/${kind}.md`, 'utf8')
    ).replaceAll('\r\n', '\n');
    const blocks = [
      ...source.matchAll(
        /```(?:yaml|markdown|bibtex) title="([^"]+)"\n([\s\S]*?)\n```/g,
      ),
    ];
    assert(blocks.length >= 6, 'Tutorial must include complete named files.');
    for (const [, filename, content] of blocks) {
      assert(!filename.includes('..'));
      const target = join(root, filename);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content + '\n');
    }
    const site = await loadSite(join(root, 'sciastro.yaml'));
    assert.equal(site.config.kind, kind);
    if (kind === 'individual') {
      assert.equal(site.pages.length, 5);
      assert.deepEqual(
        site.pages.map((p) => p.id),
        ['home', 'research', 'team', 'teaching', 'contact'],
      );
      assert(
        site.pages.some(
          (p) => p.path === '/research/' && p.areas[0].id === 'transport',
        ),
      );
      assert.equal(site.members[0].level, 'masters');
    } else {
      assert.equal(site.pages.length, 6);
      assert.deepEqual(
        site.pages.filter((p) => p.id === 'home').map((p) => p.title),
        ['Início', 'Home'],
      );
      for (const page of site.pages.filter((p) => p.id === 'research')) {
        assert.equal(page.references[0].key, 'example2026');
        assert.match(page.areas[0].html, /role="doc-biblioref"/);
      }
      assert.equal(site.members.filter((m) => m.status === 'alumni').length, 1);
      assert.equal(site.members.filter((m) => m.role === 'faculty').length, 1);
    }
  });
}

test('all documented section recipes satisfy the public schema', async () => {
  const source = await readFile('docs/guides/recipes.md', 'utf8');
  const blocks = [...source.matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/g)];
  assert(blocks.length >= 6);
  for (const [, yaml] of blocks)
    for (const section of parse(yaml)) sectionSchema.parse(section);
});

test('documented sharing examples satisfy the configuration schema', async () => {
  const source = await readFile('docs/guides/sharing.md', 'utf8');
  const blocks = [...source.matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/g)];
  assert.equal(blocks.length, 3);
  for (const [, yaml] of blocks)
    configSchema.parse({
      schemaVersion: 1,
      kind: 'individual',
      name: 'Example',
      description: 'Research',
      url: 'https://example.org',
      home: { body: 'home.md' },
      ...parse(yaml),
    });
});

test('the scientific writing guide builds its Markdown and notebook pages', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-writing-guide-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = (await readFile('docs/guides/writing.md', 'utf8')).replaceAll(
    '\r\n',
    '\n',
  );
  const blocks = [
    ...source.matchAll(
      /^(`{3,4})(?:yaml|markdown) title="([^"]+)"\n([\s\S]*?)\n\1$/gm,
    ),
  ];
  assert.equal(blocks.length, 4);
  for (const [, , filename, content] of blocks) {
    const target = join(root, filename);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content + '\n');
  }
  await writeFile(
    join(root, 'content/pages/home.yaml'),
    'id: home\ntitle: Home\npaths: {en: ""}\n',
  );
  await mkdir(join(root, 'content/notebooks'), { recursive: true });
  await cp(
    'examples/writing/content/notebooks/quadratura.ipynb',
    join(root, 'content/notebooks/quadrature.ipynb'),
  );
  await writeFile(
    join(root, 'sciastro.yaml'),
    `schemaVersion: 1
kind: group
name: Guide example
description: Scientific writing
url: https://example.org
locales: [en]
defaultLocale: en
pageFiles: [pages/home.yaml, pages/news.yaml, pages/first-note.md, pages/notebook.yaml]
navigation: [home, news]
`,
  );
  const site = await loadSite(join(root, 'sciastro.yaml'));
  assert.equal(site.pages.length, 4);
  assert.match(
    site.pages.find((p) => p.id === 'first-note').html,
    /mjx-container/,
  );
  assert.match(
    site.pages.find((p) => p.id === 'quadrature').html,
    /notebook-output/,
  );
});

test('API page covers all public entry points, runtime exports and root types', async () => {
  const api = await readFile('docs/reference/api.md', 'utf8');
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  for (const [key, target] of Object.entries(pkg.exports)) {
    const path = key === '.' ? 'sciastro' : `sciastro${key.slice(1)}`;
    assert(api.includes(path), `Missing API documentation for ${path}`);
    if (typeof target === 'object') {
      const exports = await import(
        new URL(`../${target.import}`, import.meta.url)
      );
      for (const name of Object.keys(exports))
        assert(api.includes(name), `Missing API export: ${name}`);
    }
  }
  const source = ts.createSourceFile(
    'index.ts',
    await readFile('src/index.ts', 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  for (const node of source.statements) {
    if (
      ts.isExportDeclaration(node) &&
      node.exportClause &&
      ts.isNamedExports(node.exportClause)
    )
      for (const specifier of node.exportClause.elements)
        assert(
          api.includes(specifier.name.text),
          `Missing exported type/schema: ${specifier.name.text}`,
        );
    if (
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    )
      assert(api.includes(node.name.text));
  }
});

test('generated consumer pins the current SciAstro version and toolchain', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-version-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await main(['init', root, '--kind', 'individual']);
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const consumer = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  );
  assert.equal(consumer.dependencies.sciastro, pkg.version);
  assert.equal(consumer.packageManager, pkg.packageManager);
  assert.deepEqual(consumer.engines, pkg.engines);
  assert.equal(consumer.dependencies.astro, pkg.devDependencies.astro);
});
