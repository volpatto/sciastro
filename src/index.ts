import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'node:url';
import { resolve, relative, extname } from 'node:path';
import { access } from 'node:fs/promises';
import { loadSite } from './content.js';
import { resolveSocialImage } from './social.js';

export interface SciAstroOptions {
  configFile?: string;
  /** CSS entry points relative to the consumer root; may import local fonts. */
  styles?: string[];
  /** Astro components receive the documented site/page/section properties. */
  components?: { layout?: string; sections?: Record<string, string> };
}

/** The consumer owns only configuration, content and public assets. */
export default function sciastro(
  options: SciAstroOptions = {},
): AstroIntegration {
  return {
    name: 'sciastro',
    hooks: {
      'astro:config:setup': async ({
        config,
        updateConfig,
        injectRoute,
        injectScript,
        command,
        logger,
      }) => {
        const root = fileURLToPath(config.root);
        const configFile = resolve(root, options.configFile ?? 'sciastro.yaml');
        const overrides = {
          url: process.env.SITE_URL,
          base: process.env.BASE_PATH,
        };
        const initial = await loadSite(configFile, overrides);
        const { config: settings } = initial;
        const socialWarning = resolveSocialImage(settings).warning;
        if (socialWarning) logger.warn(socialWarning);
        if (
          command === 'build' &&
          settings.analytics &&
          process.env.SCIASTRO_ANALYTICS !== 'false'
        ) {
          const runtime = fileURLToPath(
            new URL('./analytics-client.js', import.meta.url),
          ).replaceAll('\\', '/');
          injectScript(
            'page',
            `import { startAnalytics } from ${JSON.stringify(runtime)};\nstartAnalytics(${JSON.stringify({ analytics: settings.analytics, url: settings.url, base: settings.base })});`,
          );
        }
        const components = options.components?.sections ?? {};
        for (const page of initial.pages)
          for (const section of page.sections ?? [])
            if (section.type === 'custom' && !components[section.component!])
              throw new Error(
                `Page ${page.id}: register components.sections.${section.component} in astro.config.mjs.`,
              );
        const source = async (path: string, extension: string) => {
          const full = resolve(root, path);
          if (extname(full) !== extension)
            throw new Error(`Expected a ${extension} file: ${path}`);
          await access(full);
          return full.replaceAll('\\', '/');
        };
        const layout = options.components?.layout
          ? await source(options.components.layout, '.astro')
          : fileURLToPath(
              new URL('./components/Layout.astro', import.meta.url),
            ).replaceAll('\\', '/');
        const imports = [
          `export { default as Layout } from ${JSON.stringify(layout)};`,
        ];
        const entries: string[] = [];
        for (const [key, path] of Object.entries(components)) {
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key))
            throw new Error(`Invalid component key: ${key}`);
          const name = `Section${entries.length}`;
          imports.push(
            `import ${name} from ${JSON.stringify(await source(path, '.astro'))};`,
          );
          entries.push(`${JSON.stringify(key)}: ${name}`);
        }
        for (const path of options.styles ?? [])
          imports.push(`import ${JSON.stringify(await source(path, '.css'))};`);
        imports.push(`export const sections = {${entries.join(',')}};`);
        const virtual = '\0virtual:sciastro';
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
        injectRoute({
          pattern: '/_sciastro/downloads/[...download].ipynb',
          entrypoint: new URL('./pages/Download.js', import.meta.url),
          prerender: true,
        });
        updateConfig({
          site: settings.url,
          base: settings.base,
          output: 'static',
          trailingSlash: 'always',
          vite: {
            // Font CSS must pass through Vite in installed-consumer development too.
            ssr: {
              noExternal: [
                'sciastro',
                '@fontsource-variable/manrope',
                '@fontsource-variable/newsreader',
              ],
            },
            plugins: [
              {
                name: 'sciastro-content',
                resolveId(id) {
                  if (id === 'virtual:sciastro') return virtual;
                  if (id === 'virtual:sciastro/components')
                    return '\0virtual:sciastro/components';
                },
                async load(id) {
                  if (id === '\0virtual:sciastro/components')
                    return imports.join('\n');
                  if (id !== virtual) return;
                  const site = await loadSite(configFile, overrides);
                  return `export default ${JSON.stringify(site)};`;
                },
                configureServer(server) {
                  const contentDir = resolve(root, settings.contentDir);
                  server.watcher.add([configFile, contentDir]);
                  let restartTimer: ReturnType<typeof setTimeout> | undefined;
                  server.httpServer?.once('close', () =>
                    clearTimeout(restartTimer),
                  );
                  server.watcher.on('all', (_event, file) => {
                    const delta = relative(contentDir, file);
                    if (
                      file !== configFile &&
                      (delta.startsWith('..') ||
                        !/\.(?:md|ipynb|json|yaml|yml|bib)$/i.test(file))
                    )
                      return;
                    // Configuration affects base URLs and route generation as well as
                    // content; restarting prevents stale routes or theme settings.
                    clearTimeout(restartTimer);
                    restartTimer = setTimeout(() => {
                      void server.restart().catch((error: unknown) => {
                        server.config.logger.error(
                          error instanceof Error
                            ? error.message
                            : String(error),
                        );
                      });
                    }, 100);
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
export { analyticsSchema, analyticsEventSchema } from './analytics.js';
export type { AnalyticsConfig } from './analytics.js';
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

export { sectionSchema, composedPageSchema } from './sections.js';
export type {
  Section,
  BuiltSection,
  BuiltFigure,
  BuiltLink,
  BuiltEntry,
} from './sections.js';
export type { BuiltPage, BuiltSite, BuiltSocialImage } from './content.js';
