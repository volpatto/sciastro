import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'astro';
import sciastro from '../../dist/index.js';
import { writePortraitSite } from '../fixtures/portraits.mjs';

export default async function preparePortraits() {
  for (const [mode, kind] of [
    ['automatic', 'individual'],
    ['composed', 'individual'],
    ['composed', 'group'],
  ]) {
    for (const theme of ['classic', 'modern', 'lncc']) {
      const root = resolve(
        '.test-output/portraits',
        `${mode}-${kind}-${theme}`,
      );
      await writePortraitSite(root, mode, theme, kind);
      await build({
        root: pathToFileURL(root + '/'),
        configFile: false,
        logLevel: 'error',
        integrations: [sciastro()],
      });
    }
  }
  for (const kind of ['individual', 'group']) {
    for (const theme of ['classic', 'modern', 'lncc']) {
      const root = resolve(
        '.test-output/portraits',
        `alignment-${kind}-${theme}`,
      );
      await writePortraitSite(root, 'composed', theme, kind, {
        figures: 'left',
        tables: 'right',
      });
      await build({
        root: pathToFileURL(root + '/'),
        configFile: false,
        logLevel: 'error',
        integrations: [sciastro()],
      });
    }
  }
}
