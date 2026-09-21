import { z } from 'zod';

export const localeSchema = z.enum(['pt', 'en']);
export type Locale = z.infer<typeof localeSchema>;
const text = z.string().trim().min(1);
export const localizedSchema = z.union([
  text,
  z.object({ pt: text.optional(), en: text.optional() }).strict(),
]);
export type Localized = z.infer<typeof localizedSchema>;
const id = text.regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'Use letras minúsculas, números e hífens.',
);
const httpUrl = z
  .url()
  .refine((value) => /^https?:\/\//.test(value), 'Use http:// ou https://.');
const image = z.object({ src: text, alt: localizedSchema }).strict();

/** Catalog name, a file in public/, or false to hide the decorative icon. */
export const iconSchema = z.union([
  z.literal(false),
  text.regex(
    /^(?:lucide|circle-flags):[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lucide:nome, circle-flags:país, { src: /icons/arquivo.svg } ou false.',
  ),
  z
    .object({
      monochrome: z.boolean().optional(),
      src: text.refine(
        (value) =>
          !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value) &&
          /\.(?:svg|png|jpe?g|webp|avif|gif)$/i.test(value),
        'Informe uma imagem local em public/, por exemplo /icons/pesquisa.svg.',
      ),
    })
    .strict(),
]);
export type IconSetting = z.infer<typeof iconSchema>;
const iconsSchema = z.union([
  z.literal(false),
  z
    .object({
      navigation: z
        .union([z.literal(false), z.record(id, iconSchema)])
        .default({}),
      languages: z
        .union([
          z.literal(false),
          z
            .object({ pt: iconSchema.optional(), en: iconSchema.optional() })
            .strict(),
        ])
        .default({}),
    })
    .strict(),
]);

export const configSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.enum(['group', 'individual']),
    name: text,
    description: localizedSchema,
    affiliation: localizedSchema.optional(),
    url: httpUrl.refine((value) => {
      const url = new URL(value);
      return url.pathname === '/' && !url.search && !url.hash;
    }, 'Informe somente a origem; configure o subdiretório em base.'),
    base: z
      .string()
      .regex(/^\/(?:[a-zA-Z0-9_-]+\/)*$/, 'Use / ou um caminho como /grupo/.')
      .default('/'),
    locales: z.array(localeSchema).nonempty().default(['pt']),
    defaultLocale: localeSchema.default('pt'),
    theme: z.enum(['classic', 'modern', 'lncc']).default('classic'),
    // Explicit pages replace automatic pages; their order is the menu order.
    pageFiles: z.array(text).nonempty().optional(),
    navigation: z.array(id).optional(),
    routes: z
      .record(
        id,
        z
          .object({ pt: z.string().optional(), en: z.string().optional() })
          .strict(),
      )
      .default({}),
    structuredData: z.record(z.string(), z.unknown()).optional(),
    ui: z.record(text, localizedSchema).default({}),
    appearance: z
      .object({
        light: z
          .partialRecord(
            z.enum(['paper', 'surface', 'ink', 'muted', 'accent', 'line']),
            text.regex(/^#[0-9a-fA-F]{6}$/),
          )
          .default({}),
        dark: z
          .partialRecord(
            z.enum(['paper', 'surface', 'ink', 'muted', 'accent', 'line']),
            text.regex(/^#[0-9a-fA-F]{6}$/),
          )
          .default({}),
        contentWidth: z.number().min(720).max(1600).default(1160),
        bodyFont: text.regex(/^[\w\s,'"-]+$/).optional(),
        headingFont: text.regex(/^[\w\s,'"-]+$/).optional(),
      })
      .strict()
      .optional(),
    favicon: text.optional(),
    themeStorageKey: text.default('sciastro-theme'),
    copyright: localizedSchema.optional(),
    footer: localizedSchema.optional(),
    icons: iconsSchema.default({ navigation: {}, languages: {} }),
    contentDir: text.default('content'),
    logo: image
      .extend({
        viewBox: text
          .regex(/^\d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)?$/)
          .optional(),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
        monochrome: z.boolean().default(false),
      })
      .optional(),
    notice: localizedSchema.optional(),
    home: z.object({ body: localizedSchema }).strict().optional(),
    bibliography: z
      .object({
        file: text.default('references.bib'),
        style: z.enum(['apa', 'vancouver']).default('apa'),
        publications: z.array(text).default([]),
      })
      .strict()
      .optional(),
    links: z
      .array(z.object({ label: text, url: httpUrl }).strict())
      .default([]),
    studentLevels: z
      .array(z.object({ id, label: localizedSchema }).strict())
      .default([
        {
          id: 'undergraduate',
          label: { pt: 'Iniciação científica', en: 'Undergraduate research' },
        },
        { id: 'masters', label: { pt: 'Mestrado', en: 'Master’s students' } },
        { id: 'phd', label: { pt: 'Doutorado', en: 'Doctoral students' } },
        {
          id: 'postdoc',
          label: { pt: 'Pós-doutorado', en: 'Postdoctoral researchers' },
        },
      ]),
  })
  .strict()
  .superRefine((config, ctx) => {
    if (!config.home && !config.pageFiles)
      ctx.addIssue({
        code: 'custom',
        path: ['home'],
        message: 'Provide home.body or pageFiles.',
      });
    if (!config.locales.includes(config.defaultLocale))
      ctx.addIssue({
        code: 'custom',
        path: ['defaultLocale'],
        message: 'O idioma padrão deve estar em locales.',
      });
    if (new Set(config.locales).size !== config.locales.length)
      ctx.addIssue({
        code: 'custom',
        path: ['locales'],
        message: 'Idiomas repetidos.',
      });
  });
export type SiteConfig = z.infer<typeof configSchema>;

export const researchSchema = z.array(
  z
    .object({
      id,
      title: localizedSchema,
      summary: localizedSchema,
      body: localizedSchema,
      image: image.optional(),
    })
    .strict(),
);
export type ResearchArea = z.infer<typeof researchSchema>[number];

export const teamSchema = z.array(
  z
    .object({
      id,
      name: text,
      role: z.enum(['faculty', 'student', 'researcher']),
      status: z.enum(['active', 'alumni']),
      level: id.optional(),
      affiliation: localizedSchema.optional(),
      topic: localizedSchema.optional(),
      startYear: z.number().int().min(1900).optional(),
      endYear: z.number().int().min(1900).optional(),
      photo: image.optional(),
      links: z
        .array(z.object({ label: text, url: httpUrl }).strict())
        .default([]),
    })
    .strict()
    .superRefine((member, ctx) => {
      if (member.role === 'student' && !member.level)
        ctx.addIssue({
          code: 'custom',
          path: ['level'],
          message: 'Informe o nível do aluno.',
        });
      if (
        member.endYear &&
        member.startYear &&
        member.endYear < member.startYear
      )
        ctx.addIssue({
          code: 'custom',
          path: ['endYear'],
          message: 'O fim não pode anteceder o início.',
        });
      if (member.status === 'active' && member.endYear)
        ctx.addIssue({
          code: 'custom',
          path: ['endYear'],
          message: 'Um membro ativo não deve ter ano de saída.',
        });
    }),
);
export type Member = z.infer<typeof teamSchema>[number];

export const pagesSchema = z.array(
  z
    .object({
      slug: id,
      title: localizedSchema,
      icon: iconSchema.optional(),
      body: localizedSchema,
    })
    .strict(),
);
export type ContentPage = z.infer<typeof pagesSchema>[number];
