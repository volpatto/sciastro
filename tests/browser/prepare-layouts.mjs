import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'astro';
import sciastro from '../../dist/index.js';
import { layoutVariants, writeLayoutSite } from '../fixtures/layouts.mjs';

export default async function prepareLayouts() {
  for (const variant of layoutVariants) {
    const root = resolve('.test-output/layouts', variant.name);
    await writeLayoutSite(root, variant);
    await build({
      root: pathToFileURL(root + '/'),
      configFile: false,
      logLevel: 'error',
      integrations: [sciastro()],
    });
  }
}
