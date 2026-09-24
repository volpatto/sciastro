import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'astro';
import sciastro from '../../dist/index.js';
import {
  appearanceVariants,
  writeAppearanceSite,
} from '../fixtures/appearance.mjs';

export default async function prepareAppearance() {
  for (const variant of appearanceVariants) {
    const root = resolve('.test-output/appearance', variant.name);
    await writeAppearanceSite(root, variant);
    await build({
      root: pathToFileURL(root + '/'),
      configFile: false,
      logLevel: 'error',
      integrations: [sciastro()],
    });
  }
}
