import { readFile, access } from 'node:fs/promises';
import {
  resolve,
  relative,
  isAbsolute,
  join,
  dirname,
  extname,
} from 'node:path';
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
import { Bibliography, referenceId, type Reference } from './bibliography.js';
import { markdownContext } from './markdown.js';
import { createDocumentContext } from './document.js';
import { renderNotebook } from './notebook.js';
import { resolveSocialImage, type BuiltSocialImage } from './social.js';
import {
  composedPageSchema,
  buildSection,
  type BuiltSection,
  type ComposedPage,
} from './sections.js';

export type { BuiltSocialImage } from './social.js';

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
  description?: string;
  heading?: string;
  navigation?: boolean;
  header?: boolean;
  sections?: BuiltSection[];
  layout?: 'page' | 'article' | 'listing';
  parent?: string;
  date?: string;
  authors?: string[];
  tags?: string[];
  toc?: boolean;
  headings?: Array<{ id: string; text: string; depth: number }>;
}
export interface BuiltSite {
  config: SiteConfig;
  socialImage?: BuiltSocialImage;
  languageIcons: Partial<Record<Locale, BuiltIcon>>;
  pages: BuiltPage[];
  members: Member[];
  bibliographyKeys: string[];
  copyright: Partial<Record<Locale, string>>;
  footer: Partial<Record<Locale, string>>;
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

/** Markdown front matter uses the same fields as an explicit YAML page. */
async function pageFile(
  file: string,
): Promise<{ page: ComposedPage; source?: string }> {
  if (/\.ya?ml$/i.test(file))
    return { page: await yaml(file, composedPageSchema) };
  if (!/\.md$/i.test(file))
    throw new Error(
      `${file}: pageFiles accepts .yaml, .yml or .md files. Reference notebooks with body: file.ipynb.`,
    );
  const source = (await read(file))
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(source);
  if (!match)
    throw new Error(
      `${file}: start Markdown pages with YAML front matter between --- lines.`,
    );
  try {
    const metadata = parseYaml(match[1]);
    if (metadata?.body !== undefined)
      throw new Error(
        'A Markdown page already contains its body; omit the body field.',
      );
    return {
      page: composedPageSchema.parse(metadata),
      source: source.slice(match[0].length),
    };
  } catch (error) {
    throw new Error(
      `${file}: ${error instanceof Error ? error.message : error}`,
    );
  }
}

async function documentBody(
  dir: string,
  file: string | undefined,
  source: string | undefined,
  bibliography: Bibliography,
  locale: Locale,
  base: string,
  options?: { showCode?: boolean; collapseCode?: boolean },
  links?: { resolveLink?: (target: string) => string; reservedIds?: string[] },
) {
  const context = await createDocumentContext(
    bibliography,
    locale,
    base,
    links,
  );
  const path = file ? within(dir, file) : undefined;
  try {
    const raw = source ?? (path ? await read(path) : '');
    if (path && !/\.(?:md|ipynb)$/i.test(path))
      throw new Error('Page body must be a .md or .ipynb file.');
    const html =
      path && extname(path).toLowerCase() === '.ipynb'
        ? renderNotebook(raw, context, options)
        : context.render(raw);
    return { ...context.finish(html), references: context.references() };
  } catch (error) {
    throw new Error(
      `${path ?? 'Markdown page'}: ${error instanceof Error ? error.message : error}`,
    );
  }
}

function validatePath(path: string | undefined, field: string) {
  if (path === undefined || (path !== '' && !/^(?:[a-z0-9-]+\/)+$/.test(path)))
    throw new Error(
      `${field}: use a relative path ending in /, or an empty home path.`,
    );
  if (path === '404/' || path.startsWith('_astro/'))
    throw new Error(`${field}: reserved path ${path}`);
}

/** Validate the page tree independently from how much the menu displays. */
interface PageLink {
  source: string;
  target: string;
  locale: Locale;
  anchor?: string;
}

function pageLinkResolver(
  config: SiteConfig,
  source: string,
  locale: Locale,
  links: PageLink[],
) {
  return (value: string) => {
    const match = /^page:([a-z0-9]+(?:-[a-z0-9]+)*)(?:#([^\s<>"'&]+))?$/.exec(
      value,
    );
    if (!match)
      throw new Error(
        `page.${source}: invalid page link '${value}'. Use page:identifier#section.`,
      );
    const anchor = match[2] ? decodeURIComponent(match[2]) : undefined;
    if (anchor && /[\s<>"'&\x00-\x1f]/.test(anchor))
      throw new Error(`page.${source}: invalid section anchor.`);
    links.push({ source, target: match[1], locale, anchor });
    return (
      routePath(config, match[1], locale) +
      (anchor ? `#${encodeURIComponent(anchor)}` : '')
    );
  };
}

function collectIds(value: unknown, ids = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    for (const [, id] of value.matchAll(/\bid="([^"\s]+)"/g)) ids.add(id);
  } else if (Array.isArray(value)) {
    for (const child of value) collectIds(child, ids);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'id' && typeof child === 'string') ids.add(child);
      if (key !== 'props') collectIds(child, ids);
    }
  }
  return ids;
}

function teamIds(members: Member[]): string[] {
  const ids = members.map((member) => `member-${member.id}`);
  for (const role of ['faculty', 'researcher'] as const)
    if (
      members.some(
        (member) => member.role === role && member.status === 'active',
      )
    )
      ids.push(role === 'faculty' ? 'faculty' : 'researchers');
  const students = members.filter(
    (member) => member.role === 'student' && member.status === 'active',
  );
  if (students.length)
    ids.push('students', ...students.map((member) => `level-${member.level}`));
  if (members.some((member) => member.status === 'alumni')) ids.push('alumni');
  return ids;
}

function finalizePages(
  pages: BuiltPage[],
  config: SiteConfig,
  links: PageLink[] = [],
  members: Member[] = [],
) {
  unique(
    pages.map((page) => page.path),
    'URLs',
  );
  unique(config.navigation ?? [], 'Navigation');
  for (const locale of config.locales) {
    const localized = pages.filter((page) => page.locale === locale);
    const byId = new Map(localized.map((page) => [page.id, page]));
    for (const key of config.navigation ?? []) {
      if (!byId.has(key)) throw new Error(`navigation: unknown page '${key}'.`);
      if (byId.get(key)?.parent)
        throw new Error(
          `navigation: '${key}' is a child page; list its top-level parent instead.`,
        );
    }
    for (const page of localized) {
      if (page.id === 'home' && page.parent)
        throw new Error('The home page cannot have a parent.');
      const visited = new Set<string>([page.id]);
      let parent = page.parent;
      while (parent) {
        if (visited.has(parent))
          throw new Error(
            `page.${page.id}.parent: hierarchy contains a cycle at '${parent}'.`,
          );
        visited.add(parent);
        const ancestor = byId.get(parent);
        if (!ancestor)
          throw new Error(
            `page.${page.id}.parent: unknown or draft page '${parent}'.`,
          );
        parent = ancestor.parent;
      }
      if (
        config.navigation &&
        !page.parent &&
        !config.navigation.includes(page.id)
      )
        page.navigation = false;
    }
  }
  if (config.navigation) {
    const order = (page: BuiltPage) => {
      const index = config.navigation!.indexOf(page.id);
      return index === -1 ? config.navigation!.length : index;
    };
    pages.sort((a, b) => order(a) - order(b));
  }
  for (const link of links) {
    const target = pages.find(
      (page) => page.id === link.target && page.locale === link.locale,
    );
    if (!target)
      throw new Error(
        `page.${link.source}: link to unknown or draft page '${link.target}'.`,
      );
    if (link.anchor) {
      const ids = collectIds([
        target.html,
        target.sections,
        target.id === 'research' ? target.areas : [],
        target.references,
      ]);
      ids.add('main');
      if (target.id === 'home' && target.areas.length) ids.add('areas-title');
      if (
        target.id === 'team' ||
        target.sections?.some((section) => section.type === 'team')
      )
        for (const id of teamIds(members)) ids.add(id);
      if (!ids.has(link.anchor))
        throw new Error(
          `page.${link.source}: section '${link.anchor}' was not found in page '${link.target}'.`,
        );
    }
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
  const file = within(
    join(root, 'public'),
    src.split(/[?#]/)[0].replace(/^\//, ''),
  );
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
  // Check every explicitly configured image, even an unused fallback, so typos
  // fail early instead of becoming a broken preview after a later edit.
  for (const image of [config.social?.image, config.social?.fallback])
    if (image && typeof image === 'object') await checkImage(root, image.src);
  const socialImage = resolveSocialImage(config).image;
  if (config.pageFiles)
    return { ...(await loadComposed(root, dir, config)), socialImage };
  const research = await yaml(join(dir, 'research.yaml'), researchSchema, true);
  const members = await yaml(
    within(dir, config.people?.file ?? 'team.yaml'),
    teamSchema,
    // Explicit sources must exist; a missing default file still means no people.
    config.people?.file === undefined,
  );
  const custom = (
    await yaml(join(dir, 'pages.yaml'), pagesSchema, true)
  ).filter((page) => !page.draft);
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
  for (const page of custom) {
    if (!page.paths) continue;
    for (const locale of config.locales)
      validatePath(page.paths[locale], `page.${page.slug}.paths.${locale}`);
    config.routes[page.slug] = page.paths;
  }
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
  if (config.home?.photo) await checkImage(root, config.home.photo.src);
  if (config.people?.avatarFallback)
    await checkImage(root, config.people.avatarFallback.src);
  for (const area of research) {
    for (const locale of config.locales)
      if (translate(area.summary, locale).length > 240)
        throw new Error(
          `Pesquisa.${area.id}.summary.${locale}: use no máximo 240 caracteres; os detalhes pertencem ao Markdown.`,
        );
    if (area.image) await checkImage(root, area.image.src);
  }
  for (const person of members) {
    if (person.photo) await checkImage(root, person.photo.src);
    if (person.avatarFallback)
      await checkImage(root, person.avatarFallback.src);
  }
  const bibliography = new Bibliography(
    config.bibliography
      ? await read(within(dir, config.bibliography.file))
      : '',
    config.bibliography?.style,
  );
  const pages: BuiltPage[] = [];
  const links: PageLink[] = [];
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
    const homeContext = markdownContext(
      bibliography,
      locale,
      config.base,
      pageLinkResolver(config, 'home', locale, links),
    );
    const home = makePage('home', config.kind === 'group' ? l.home : l.about);
    home.html = await render(translate(config.home!.body, locale), homeContext);
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
        pageLinkResolver(config, 'research', locale, links),
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
      const page = makePage(entry.slug, translate(entry.title, locale));
      const document = await documentBody(
        dir,
        entry.body ? translate(entry.body, locale) : undefined,
        undefined,
        bibliography,
        locale,
        config.base,
        entry.notebook,
        {
          resolveLink: pageLinkResolver(config, entry.slug, locale, links),
          reservedIds: bibliography.keys.map(referenceId),
        },
      );
      page.html = document.html;
      page.references = document.references;
      page.headings = document.headings;
      page.description = entry.description
        ? translate(entry.description, locale)
        : undefined;
      page.layout = entry.layout;
      page.parent = entry.parent;
      page.date = entry.date;
      page.authors = entry.authors;
      page.tags = entry.tags;
      page.toc = entry.toc;
      page.navigation = entry.navigation;
      pages.push(page);
    }
  }
  finalizePages(pages, config, links, members);
  return {
    config,
    languageIcons,
    socialImage,
    pages,
    members,
    bibliographyKeys: bibliography.keys,
    copyright: Object.fromEntries(
      config.locales.map((locale) => [
        locale,
        config.copyright
          ? markdownContext(bibliography, locale, config.base).render(
              translate(config.copyright, locale),
            )
          : '',
      ]),
    ),
    footer: Object.fromEntries(
      config.locales.map((locale) => [
        locale,
        config.footer
          ? markdownContext(bibliography, locale, config.base).render(
              translate(config.footer, locale),
            )
          : '',
      ]),
    ),
  };
}

async function loadComposed(
  root: string,
  dir: string,
  config: SiteConfig,
): Promise<BuiltSite> {
  const members = await yaml(
    within(dir, config.people?.file ?? 'team.yaml'),
    teamSchema,
    config.people?.file === undefined,
  );
  unique(
    members.map((member) => member.id),
    'Team',
  );
  for (const member of members)
    if (
      member.level &&
      !config.studentLevels.some((level) => level.id === member.level)
    )
      throw new Error(
        `Team ${member.id}: unknown student level ${member.level}`,
      );
  checkTranslations(members, config.locales, 'team');
  const sources = (
    await Promise.all(
      config.pageFiles!.map((file) => pageFile(within(dir, file))),
    )
  ).filter(({ page }) => !page.draft);
  const entries = sources.map(({ page }) => page);
  unique(
    entries.map((page) => page.id),
    'Pages',
  );
  if (!entries.some((page) => page.id === 'home'))
    throw new Error('pageFiles must contain a home page.');
  const pageIds = new Set(entries.map((page) => page.id));
  for (const page of entries) {
    checkTranslations(page, config.locales, `page.${page.id}`);
    for (const locale of config.locales) {
      const path = page.paths[locale];
      validatePath(path, `page.${page.id}.paths.${locale}`);
    }
    config.routes[page.id] = page.paths;
    const ids: string[] = [];
    for (const section of page.sections) {
      if (section.id) ids.push(section.id);
      if (
        'items' in section &&
        section.type !== 'logos' &&
        section.type !== 'publications'
      )
        for (const item of section.items) if (item.id) ids.push(item.id);
    }
    unique(ids, `page.${page.id} section IDs`);
    if (ids.includes('main'))
      throw new Error(`page.${page.id}: main is a reserved section ID.`);
    const profileCount = page.sections.filter(
      (section) => section.type === 'profile',
    ).length;
    if (
      profileCount > 1 ||
      (profileCount && page.header) ||
      (!page.header && profileCount !== 1 && page.layout === 'page') ||
      (profileCount && page.layout !== 'page')
    )
      throw new Error(
        `page.${page.id}: use one profile with header: false, or header: true without a profile.`,
      );
  }
  unique(config.navigation ?? [], 'Navigation');
  for (const key of config.navigation ?? [])
    if (!pageIds.has(key))
      throw new Error(`navigation: unknown page '${key}'.`);
  const { icons, routes, ...translated } = config;
  checkTranslations(translated, config.locales);
  if (icons !== false && icons.navigation !== false)
    for (const key of Object.keys(icons.navigation))
      if (!pageIds.has(key))
        throw new Error(`icons.navigation: unknown page '${key}'.`);
  // Walk declared assets and icon settings before rendering. Custom props stay opaque.
  async function assets(value: unknown): Promise<void> {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const child of value) await assets(child);
      return;
    }
    const object = value as Record<string, unknown>;
    if (typeof object.src === 'string') await checkImage(root, object.src);
    if (object.icon !== undefined)
      resolveIcon(object.icon as IconSetting, 'section.icon');
    for (const [key, child] of Object.entries(object))
      if (key !== 'props' && key !== 'structuredData') await assets(child);
  }
  await assets([config, entries, members]);
  if (config.favicon) await checkImage(root, config.favicon);
  const bibliography = new Bibliography(
    config.bibliography
      ? await read(within(dir, config.bibliography.file))
      : '',
    config.bibliography?.style,
  );
  // Parse each selected file once, even when several cards/languages reuse it.
  const publicationLibraries = new Map<string, Bibliography>();
  if (config.bibliography)
    publicationLibraries.set(
      within(dir, config.bibliography.file),
      bibliography,
    );
  for (const page of entries)
    for (const section of page.sections)
      if (section.type === 'publications')
        for (const item of section.items)
          if ('bibtex' in item && typeof item.bibtex !== 'string') {
            const file = within(dir, item.bibtex.file);
            if (!publicationLibraries.has(file))
              publicationLibraries.set(
                file,
                new Bibliography(await read(file)),
              );
          }
  const pages: BuiltPage[] = [];
  const links: PageLink[] = [];
  for (const locale of config.locales)
    for (const { page: entry, source } of sources) {
      const resolveLink = pageLinkResolver(config, entry.id, locale, links);
      const context = markdownContext(
        bibliography,
        locale,
        config.base,
        resolveLink,
      );
      const document = await documentBody(
        dir,
        entry.body ? translate(entry.body, locale) : undefined,
        source,
        bibliography,
        locale,
        config.base,
        entry.notebook,
        {
          resolveLink,
          reservedIds: [
            ...collectIds(entry.sections),
            ...bibliography.keys.map(referenceId),
            ...(entry.sections.some((section) => section.type === 'team')
              ? teamIds(members)
              : []),
          ],
        },
      );
      const sections = entry.sections.map((section) =>
        buildSection(
          section,
          locale,
          context,
          (source) => {
            if (typeof source === 'string')
              return bibliography.publication(source);
            const file = within(dir, source.file);
            try {
              return publicationLibraries.get(file)!.publication(source.key);
            } catch (error) {
              throw new Error(
                `${source.file}: ${error instanceof Error ? error.message : error}`,
              );
            }
          },
          (target) => `/${resolveLink(target).slice(config.base.length)}`,
        ),
      );
      pages.push({
        id: entry.id,
        title: translate(entry.title, locale),
        heading: entry.heading ? translate(entry.heading, locale) : undefined,
        description: translate(entry.description ?? config.description, locale),
        locale,
        path: routePath(config, entry.id, locale),
        icon: navigationIcon(config, entry.id, entry.icon),
        navigation:
          entry.navigation &&
          (!config.navigation ||
            Boolean(entry.parent) ||
            config.navigation.includes(entry.id)),
        header: entry.header,
        html: document.html,
        headings: document.headings,
        layout: entry.layout,
        parent: entry.parent,
        date: entry.date,
        authors: entry.authors,
        tags: entry.tags,
        toc: entry.toc,
        sections,
        references: bibliography.references(
          [
            ...new Set([
              ...entry.references,
              ...document.references.map((reference) => reference.key),
              ...context.references().map((reference) => reference.key),
            ]),
          ],
          locale,
        ),
        areas: [],
      });
    }
  finalizePages(pages, config, links, members);
  return {
    config,
    pages,
    members,
    bibliographyKeys: bibliography.keys,
    languageIcons: Object.fromEntries(
      config.locales.map((locale) => [locale, languageIcon(config, locale)]),
    ),
    copyright: Object.fromEntries(
      config.locales.map((locale) => [
        locale,
        config.copyright
          ? markdownContext(bibliography, locale, config.base).render(
              translate(config.copyright, locale),
            )
          : '',
      ]),
    ),
    footer: Object.fromEntries(
      config.locales.map((locale) => [
        locale,
        config.footer
          ? markdownContext(bibliography, locale, config.base).render(
              translate(config.footer, locale),
            )
          : '',
      ]),
    ),
  };
}
