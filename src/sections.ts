import { z } from 'zod';
import { localizedSchema as localized, iconSchema } from './schema.js';
import type { Locale } from './schema.js';
import { translate } from './i18n.js';
import { resolveIcon, type BuiltIcon } from './icons.js';
import type { markdownContext } from './markdown.js';
import type { PublicationMetadata } from './bibliography.js';

const text = z.string().trim().min(1);
const id = text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
// Root-relative links are portable across deployment base paths.
const href = text.refine(
  (value) =>
    /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/.test(value) &&
    !/[\s<>]/.test(value),
  'Use http(s), mailto, tel, #anchor or /local/path.',
);
export const sectionLinkSchema = z
  .object({
    label: localized,
    url: z.union([
      href,
      z.object({ pt: href.optional(), en: href.optional() }).strict(),
    ]),
    icon: iconSchema.optional(),
    download: z.boolean().optional(),
  })
  .strict();
export const figureSchema = z
  .object({
    src: text.refine(
      (value) => value.startsWith('/') && !value.startsWith('//'),
      'Images must use /paths in public/.',
    ),
    alt: localized,
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    caption: localized.optional(),
    links: z.array(sectionLinkSchema).default([]),
    enlarge: z.boolean().default(false),
    // A display window preserves the original file (e.g. a logo with white margins).
    viewBox: text
      .regex(/^\d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)?$/)
      .optional(),
  })
  .strict();
const common = {
  id: id.optional(),
  title: localized.optional(),
  text: localized.optional(),
  links: z.array(sectionLinkSchema).default([]),
};
const entry = z
  .object({
    id: id.optional(),
    title: localized,
    eyebrow: localized.optional(),
    subtitle: localized.optional(),
    text: localized.optional(),
    meta: localized.optional(),
    images: z.array(figureSchema).default([]),
    links: z.array(sectionLinkSchema).default([]),
  })
  .strict();
const publicationFields = {
  title: text,
  authors: text,
  year: z.union([text, z.number().int()]).transform(String),
  journal: text,
  citation: text,
  doi: text.regex(/^10\.\d{4,9}\/\S+$/),
  url: z
    .url()
    .refine(
      (value) => /^https?:\/\//i.test(value),
      'Use an http(s) publication URL.',
    )
    .optional(),
  topic: localized.optional(),
};
const manualPublication = z.object(publicationFields).strict();
const bibtexSource = z.union([
  text,
  z.object({ file: text, key: text }).strict(),
]);
export type BibtexSource = z.infer<typeof bibtexSource>;
const bibtexPublication = manualPublication
  .partial()
  .extend({ bibtex: bibtexSource });
// A BibTeX record can legitimately lack a date, journal or DOI (e.g. a preprint).
const resolvedPublication = manualPublication.partial().extend({
  title: text,
  bibtex: bibtexSource.optional(),
});
export const sectionSchema = z.discriminatedUnion('type', [
  z.object({ ...common, type: z.literal('team') }).strict(),
  z
    .object({
      ...common,
      type: z.literal('prose'),
      tone: z.enum(['plain', 'note']).default('plain'),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('profile'),
      title: localized,
      eyebrow: localized.optional(),
      image: figureSchema.optional(),
    })
    .strict(),
  z
    .object({ ...common, type: z.literal('figure'), image: figureSchema })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('cards'),
      layout: z.enum(['grid', 'rows']).default('grid'),
      items: z.array(entry).nonempty(),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('list'),
      items: z.array(entry).nonempty(),
      collapsible: z.boolean().default(false),
      open: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('timeline'),
      items: z.array(entry.extend({ period: localized })).nonempty(),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('logos'),
      items: z
        .array(
          z
            .object({ image: figureSchema, link: sectionLinkSchema.optional() })
            .strict(),
        )
        .nonempty(),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('publications'),
      items: z
        .array(z.union([bibtexPublication, manualPublication]))
        .nonempty(),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('custom'),
      component: id,
      props: z.record(z.string(), z.unknown()).default({}),
    })
    .strict(),
]);
export const composedPageSchema = z
  .object({
    id,
    title: localized,
    // Paths include the language prefix; do not include the deployment base.
    paths: z
      .object({ pt: z.string().optional(), en: z.string().optional() })
      .strict(),
    description: localized.optional(),
    heading: localized.optional(),
    icon: iconSchema.optional(),
    navigation: z.boolean().default(true),
    header: z.boolean().default(true),
    body: localized.optional(),
    references: z.array(text).default([]),
    sections: z.array(sectionSchema).default([]),
  })
  .strict();
export type Section = z.infer<typeof sectionSchema>;
export type ComposedPage = z.infer<typeof composedPageSchema>;
export interface BuiltLink {
  label: string;
  url: string;
  icon: BuiltIcon;
  download?: boolean;
}
export interface BuiltFigure {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  caption?: string;
  links: BuiltLink[];
  enlarge: boolean;
  viewBox?: string;
}
export interface BuiltEntry {
  id?: string;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  html?: string;
  meta?: string;
  period?: string;
  images: BuiltFigure[];
  links: BuiltLink[];
}
export interface BuiltSection {
  type: Section['type'];
  id?: string;
  title?: string;
  html?: string;
  links: BuiltLink[];
  tone?: string;
  eyebrow?: string;
  image?: BuiltFigure;
  layout?: string;
  items?: BuiltEntry[];
  collapsible?: boolean;
  open?: boolean;
  logos?: { image: BuiltFigure; link?: BuiltLink }[];
  publications?: {
    title: string;
    authors?: string;
    year?: string;
    journal?: string;
    citation?: string;
    doi?: string;
    url?: string;
    bibtex?: BibtexSource;
    topic?: string;
  }[];
  component?: string;
  props?: Record<string, unknown>;
}

export function buildSection(
  section: Section,
  locale: Locale,
  context: ReturnType<typeof markdownContext>,
  resolvePublication?: (source: BibtexSource) => PublicationMetadata,
): BuiltSection {
  const local = (value: z.infer<typeof localized> | undefined) =>
    value === undefined ? undefined : translate(value, locale);
  const link = (value: z.infer<typeof sectionLinkSchema>): BuiltLink => ({
    ...value,
    label: translate(value.label, locale),
    url: translate(value.url, locale),
    icon: resolveIcon(value.icon ?? false, 'section.link.icon'),
  });
  const figure = (value: z.infer<typeof figureSchema>): BuiltFigure => ({
    ...value,
    alt: translate(value.alt, locale),
    caption: local(value.caption),
    links: value.links.map(link),
  });
  const item = (
    value: z.infer<typeof entry> & { period?: z.infer<typeof localized> },
  ): BuiltEntry => ({
    id: value.id,
    title: translate(value.title, locale),
    eyebrow: local(value.eyebrow),
    subtitle: local(value.subtitle),
    html: value.text
      ? context.render(translate(value.text, locale))
      : undefined,
    meta: local(value.meta),
    period: local(value.period),
    images: value.images.map(figure),
    links: value.links.map(link),
  });
  const built: BuiltSection = {
    type: section.type,
    id: section.id,
    title: local(section.title),
    html: section.text
      ? context.render(translate(section.text, locale))
      : undefined,
    links: section.links.map(link),
  };
  switch (section.type) {
    case 'team':
      return built;
    case 'prose':
      return { ...built, tone: section.tone };
    case 'profile':
      return {
        ...built,
        eyebrow: local(section.eyebrow),
        image: section.image && figure(section.image),
      };
    case 'figure':
      return { ...built, image: figure(section.image) };
    case 'cards':
      return {
        ...built,
        layout: section.layout,
        items: section.items.map(item),
      };
    case 'list':
      return {
        ...built,
        items: section.items.map(item),
        collapsible: section.collapsible,
        open: section.open,
      };
    case 'timeline':
      return { ...built, items: section.items.map(item) };
    case 'logos':
      return {
        ...built,
        logos: section.items.map((value) => ({
          image: figure(value.image),
          link: value.link && link(value.link),
        })),
      };
    case 'publications':
      return {
        ...built,
        publications: section.items.map((value) => {
          if (!('bibtex' in value))
            return { ...value, topic: local(value.topic) };
          const key =
            typeof value.bibtex === 'string' ? value.bibtex : value.bibtex.key;
          if (!resolvePublication)
            throw new Error(
              `Publication '${key}' requires a BibTeX resolver; use loadSite to resolve files automatically.`,
            );
          const parsed = resolvedPublication.safeParse({
            ...resolvePublication(value.bibtex),
            ...value,
          });
          if (!parsed.success)
            throw new Error(`Publication '${key}': ${parsed.error.message}`);
          return { ...parsed.data, topic: local(parsed.data.topic) };
        }),
      };
    case 'custom':
      return { ...built, component: section.component, props: section.props };
  }
}
