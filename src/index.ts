import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { loadSite } from './content.js';

export interface SciPagesOptions {
  configFile?: string;
}

/** The consumer owns only configuration, content and public assets. */
export default function scipages(
  options: SciPagesOptions = {},
): AstroIntegration {
  return {
    name: 'scipages',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, injectRoute }) => {
        const root = fileURLToPath(config.root);
        const configFile = resolve(root, options.configFile ?? 'scipages.yaml');
        const overrides = {
          url: process.env.SITE_URL,
          base: process.env.BASE_PATH,
        };
        const { config: settings } = await loadSite(configFile, overrides);
        const virtual = '\0virtual:scipages';
        injectRoute({
          pattern: '/[...scipage]',
          entrypoint: new URL('./pages/Page.astro', import.meta.url),
          prerender: true,
        });
        injectRoute({
          pattern: '/404',
          entrypoint: new URL('./pages/404.astro', import.meta.url),
          prerender: true,
        });
        updateConfig({
          site: settings.url,
          base: settings.base,
          output: 'static',
          trailingSlash: 'always',
          vite: {
            plugins: [
              {
                name: 'scipages-content',
                resolveId(id) {
                  if (id === 'virtual:scipages') return virtual;
                },
                async load(id) {
                  if (id !== virtual) return;
                  const site = await loadSite(configFile, overrides);
                  return `export default ${JSON.stringify(site)};`;
                },
                configureServer(server) {
                  const contentDir = resolve(root, settings.contentDir);
                  server.watcher.add([configFile, contentDir]);
                  server.watcher.on('all', (_event, file) => {
                    const delta = relative(contentDir, file);
                    if (
                      file !== configFile &&
                      (delta.startsWith('..') ||
                        !/\.(?:md|yaml|yml|bib)$/.test(file))
                    )
                      return;
                    // Configuration affects base URLs and route generation as well as
                    // content; restarting prevents stale routes or theme settings.
                    void server.restart();
                  });
                },
              },
            ],
          },
        });
      },
    },
  };
}
export { loadSite } from './content.js';
export {
  configSchema,
  researchSchema,
  teamSchema,
  pagesSchema,
  iconSchema,
} from './schema.js';
export type {
  SiteConfig,
  Member,
  ResearchArea,
  Locale,
  IconSetting,
} from './schema.js';
