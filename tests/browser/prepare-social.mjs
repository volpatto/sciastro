import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'astro';
import sciastro from '../../dist/index.js';
import { writeSocialSite, socialImage } from '../fixtures/social.mjs';

export default async function prepareSocial() {
  for (const kind of ['logo', 'custom', 'fallback', 'none']) {
    const root = resolve('.test-output/social', kind);
    const f = await writeSocialSite(
      root,
      ['custom', 'none'].includes(kind) ? 'composed' : 'automatic',
    );
    if (kind === 'logo') {
      f.config.logo.viewBox = '0 0 1 1';
      f.config.logo.monochrome = true;
    }
    if (kind === 'custom') {
      f.config.social = {
        image: socialImage('custom'),
        fallback: socialImage('fallback'),
      };
      f.config.social.image.alt.pt = 'Imagem custom & "teste"';
    }
    if (kind === 'fallback')
      f.config.social = { fallback: socialImage('fallback') };
    if (kind === 'none') delete f.config.logo;
    await f.save();
    await build({
      root: pathToFileURL(root + '/'),
      configFile: false,
      logLevel: 'error',
      integrations: [sciastro()],
    });
  }
}
