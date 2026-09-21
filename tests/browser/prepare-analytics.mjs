import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'astro';
import { stringify } from 'yaml';
import sciastro from '../../dist/index.js';

// Isolated sites with fictional identifiers; no tracker is fetched during builds.
export default async function prepareAnalytics() {
  const umami = {
    provider: 'umami',
    websiteId: '94db1cb1-74f4-4a40-ad6c-962362670409',
    scriptUrl: 'https://stats.example/script.js',
  };
  const configurations = {
    disabled: false,
    cloudflare: {
      provider: 'cloudflare',
      token: '0123456789abcdef0123456789abcdef',
    },
    umami: {
      ...umami,
      events: { downloads: true, externalLinks: true, custom: true },
    },
    'pageviews-only': umami,
    'custom-layout': umami,
  };
  for (const [kind, analytics] of Object.entries(configurations)) {
    const root = resolve('.test-output/analytics', kind);
    await mkdir(join(root, 'content'), { recursive: true });
    await mkdir(join(root, 'public'), { recursive: true });
    await writeFile(join(root, 'package.json'), '{"type":"module"}');
    await writeFile(
      join(root, 'sciastro.yaml'),
      stringify({
        schemaVersion: 1,
        kind: 'group',
        name: 'Analytics fixture',
        description: 'Fictional test site',
        url: 'https://academic.example',
        base: '/lab/',
        locales: ['pt', 'en'],
        pageFiles: ['home.yaml'],
        analytics,
        links: [
          {
            label: 'Ignored profile',
            url: 'https://github.com/example',
            analyticsEvent: false,
          },
        ],
      }),
    );
    await writeFile(
      join(root, 'content/home.yaml'),
      stringify({
        id: 'home',
        title: { pt: 'Início', en: 'Home' },
        paths: { pt: '', en: 'en/' },
        sections: [
          {
            type: 'prose',
            text: '[Markdown DOI](https://doi.org/10.1234/example?token=secret#part)',
            links: [
              {
                label: 'CV',
                url: '/cv.pdf?token=secret#section',
                download: true,
                analyticsEvent: 'cv_download',
              },
              { label: 'File', url: '/cv.pdf', download: true },
              {
                label: 'GitHub',
                url: 'https://github.com/example?token=secret#part',
              },
              {
                label: 'Ignored',
                url: 'https://github.com/example',
                analyticsEvent: false,
              },
              { label: 'English page', url: '/en/' },
              { label: 'Email', url: 'mailto:example@example.org' },
            ],
          },
          {
            type: 'logos',
            items: [
              {
                image: { src: '/symbol.svg', alt: 'Symbol' },
                link: {
                  label: 'Institution',
                  url: 'https://institute.example',
                  analyticsEvent: 'institution',
                },
              },
            ],
          },
        ],
      }),
    );
    await writeFile(
      join(root, 'public/cv.pdf'),
      '%PDF-1.4\n% Fictional download test\n',
    );
    await writeFile(
      join(root, 'public/symbol.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg>',
    );
    if (kind === 'custom-layout')
      await writeFile(
        join(root, 'Layout.astro'),
        '<!doctype html><html lang="en"><head><title>Custom layout</title></head><body><slot /></body></html>',
      );
    await build({
      root: pathToFileURL(root + '/'),
      configFile: false,
      logLevel: 'error',
      integrations: [
        sciastro(
          kind === 'custom-layout'
            ? { components: { layout: './Layout.astro' } }
            : {},
        ),
      ],
    });
  }
}
