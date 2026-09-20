import { readFile, access } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import {
  configSchema,
  researchSchema,
  teamSchema,
  pagesSchema,
  type SiteConfig,
  type Locale,
  type Member,
  type IconSetting,
} from './schema.js';
import {
  navigationIcon,
  languageIcon,
  resolveIcon,
  type BuiltIcon,
} from './icons.js';
import { translate, routePath, labels } from './i18n.js';
import { Bibliography, type Reference } from './bibliography.js';
import { markdownContext } from './markdown.js';

export interface BuiltArea {
  id: string;
  title: string;
  summary: string;
  html: string;
  image?: { src: string; alt: string };
}
export interface BuiltPage {
  id: string;
  icon: BuiltIcon;
  locale: Locale;
  path: string;
  title: string;
  html: string;
  references: Reference[];
  areas: BuiltArea[];
}
export interface BuiltSite {
  config: SiteConfig;
  languageIcons: Partial<Record<Locale, BuiltIcon>>;
  pages: BuiltPage[];
  members: Member[];
  bibliographyKeys: string[];
}

export function within(root: string, file: string): string {
  const path = resolve(root, file);
  const delta = relative(root, path);
  if (
    isAbsolute(file) ||
    delta === '..' ||
    delta.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
  )
    throw new Error(`Caminho fora da pasta de conteúdo: ${file}`);
  return path;
}

async function read(file: string): Promise<string> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    throw new Error(`Não foi possível ler: ${file}`);
  }
}

async function yaml<T extends z.ZodType>(
  file: string,
  schema: T,
  optional = false,
): Promise<z.infer<T>> {
  try {
    await access(file);
  } catch {
    if (optional) return schema.parse([]);
    throw new Error(`Arquivo obrigatório ausente: ${file}`);
  }
  try {
    return schema.parse(parseYaml(await read(file)));
  } catch (error) {
    throw new Error(
      `${file}: ${error instanceof Error ? error.message : error}`,
    );
  }
}

export async function readConfig(file: string): Promise<SiteConfig> {
  return yaml(file, configSchema);
}

function unique(ids: string[], description: string) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id))
      throw new Error(`${description}: identificador repetido '${id}'.`);
    seen.add(id);
  }
}

function checkTranslations(
  value: unknown,
  locales: Locale[],
  path = 'configuração',
): void {
  if (!value || typeof value !== 'object') return;
  if (!Array.isArray(value) && ('pt' in value || 'en' in value)) {
    for (const locale of locales)
      if (!(locale in value))
        throw new Error(`${path}: tradução '${locale}' ausente.`);
  }
  for (const [key, child] of Object.entries(value))
    checkTranslations(child, locales, `${path}.${key}`);
}

async function checkImage(root: string, src: string) {
  if (/^https?:\/\//.test(src)) return;
  const file = within(join(root, 'public'), src.replace(/^\//, ''));
  try {
    await access(file);
  } catch {
    throw new Error(`Imagem ausente: ${file}`);
  }
}

export async function loadSite(
  configFile: string,
  overrides: { url?: string; base?: string } = {},
): Promise<BuiltSite> {
  const root = dirname(configFile);
  const config = configSchema.parse({
    ...(await readConfig(configFile)),
    ...Object.fromEntries(
      Object.entries(overrides).filter(([, value]) => value !== undefined),
    ),
  });
  const dir = within(root, config.contentDir);
  const research = await yaml(join(dir, 'research.yaml'), researchSchema, true);
  const members = await yaml(join(dir, 'team.yaml'), teamSchema, true);
  const custom = await yaml(join(dir, 'pages.yaml'), pagesSchema, true);
  unique(
    research.map((area) => area.id),
    'Pesquisa',
  );
  unique(
    members.map((person) => person.id),
    'Equipe',
  );
  unique(
    config.studentLevels.map((level) => level.id),
    'Níveis',
  );
  unique(
    custom.map((page) => page.slug),
    'Páginas',
  );
  for (const person of members)
    if (
      person.level &&
      !config.studentLevels.some((level) => level.id === person.level)
    )
      throw new Error(
        `Equipe.${person.id}: nível '${person.level}' não cadastrado em studentLevels.`,
      );
  const reserved = new Set([
    'home',
    'research',
    'pesquisa',
    'team',
    'equipe',
    'publications',
    'publicacoes',
    'en',
    'pt',
    '404',
  ]);
  for (const page of custom)
    if (reserved.has(page.slug))
      throw new Error(`Página '${page.slug}': caminho reservado.`);
  // Icon overrides use locale keys, but are not translated text: missing keys
  // deliberately keep their defaults (e.g. changing PT must not require EN).
  const { icons, ...translatedConfig } = config;
  checkTranslations(
    { config: translatedConfig, research, members, custom },
    config.locales,
  );
  const checkIcon = async (setting: IconSetting, field: string) => {
    resolveIcon(setting, field);
    if (setting && typeof setting === 'object') {
      try {
        await checkImage(root, setting.src);
      } catch (error) {
        throw new Error(
          `${field}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  };
  const pageIds = new Set([
    'home',
    'research',
    'team',
    'publications',
    ...custom.map((page) => page.slug),
  ]);
  if (icons !== false) {
    if (icons.navigation !== false)
      for (const [page, setting] of Object.entries(icons.navigation)) {
        if (!pageIds.has(page))
          throw new Error(
            `icons.navigation.${page}: página desconhecida; use home, research, team, publications ou um slug de pages.yaml.`,
          );
        await checkIcon(setting, `icons.navigation.${page}`);
      }
    if (icons.languages !== false)
      for (const [locale, setting] of Object.entries(icons.languages))
        await checkIcon(setting, `icons.languages.${locale}`);
  }
  for (const page of custom)
    if (page.icon !== undefined)
      await checkIcon(page.icon, `pages.${page.slug}.icon`);
  const languageIcons = Object.fromEntries(
    config.locales.map((locale) => [locale, languageIcon(config, locale)]),
  );
  if (config.logo) await checkImage(root, config.logo.src);
  for (const area of research) {
    for (const locale of config.locales)
      if (translate(area.summary, locale).length > 240)
        throw new Error(
          `Pesquisa.${area.id}.summary.${locale}: use no máximo 240 caracteres; os detalhes pertencem ao Markdown.`,
        );
    if (area.image) await checkImage(root, area.image.src);
  }
  for (const person of members)
    if (person.photo) await checkImage(root, person.photo.src);
  const bibliography = new Bibliography(
    config.bibliography
      ? await read(within(dir, config.bibliography.file))
      : '',
    config.bibliography?.style,
  );
  const pages: BuiltPage[] = [];
  for (const locale of config.locales) {
    const l = labels[locale];
    const render = async (
      file: string,
      context: ReturnType<typeof markdownContext>,
    ) => {
      const path = within(dir, file);
      try {
        return context.render(await read(path));
      } catch (error) {
        throw new Error(
          `${path}: ${error instanceof Error ? error.message : error}`,
        );
      }
    };
    const makePage = (id: string, title: string): BuiltPage => ({
      id,
      icon: navigationIcon(
        config,
        id,
        custom.find((page) => page.slug === id)?.icon,
      ),
      title,
      locale,
      path: routePath(config, id, locale),
      html: '',
      references: [],
      areas: [],
    });
    const homeContext = markdownContext(bibliography, locale, config.base);
    const home = makePage('home', config.kind === 'group' ? l.home : l.about);
    home.html = await render(translate(config.home.body, locale), homeContext);
    home.references = homeContext.references();
    home.areas = research.map((area) => ({
      id: area.id,
      title: translate(area.title, locale),
      summary: translate(area.summary, locale),
      html: '',
    }));
    pages.push(home);
    if (research.length) {
      const researchContext = markdownContext(
        bibliography,
        locale,
        config.base,
      );
      const page = makePage('research', l.research);
      for (const area of research)
        page.areas.push({
          id: area.id,
          title: translate(area.title, locale),
          summary: translate(area.summary, locale),
          html: await render(translate(area.body, locale), researchContext),
          image: area.image
            ? { src: area.image.src, alt: translate(area.image.alt, locale) }
            : undefined,
        });
      page.references = researchContext.references();
      pages.push(page);
    }
    if (members.length)
      pages.push(
        makePage('team', config.kind === 'group' ? l.team : l.supervision),
      );
    if (config.bibliography?.publications.length) {
      const page = makePage('publications', l.publications);
      page.references = bibliography.references(
        config.bibliography.publications,
        locale,
      );
      pages.push(page);
    }
    for (const entry of custom) {
      const context = markdownContext(bibliography, locale, config.base);
      const page = makePage(entry.slug, translate(entry.title, locale));
      page.html = await render(translate(entry.body, locale), context);
      page.references = context.references();
      pages.push(page);
    }
  }
  unique(
    pages.map((page) => page.path),
    'URLs',
  );
  return {
    config,
    languageIcons,
    pages,
    members,
    bibliographyKeys: bibliography.keys,
  };
}
