import { z } from 'zod';
import { analyticsSchema, analyticsEventSchema } from './analytics.js';

export const localeSchema = z.enum(['pt', 'en']);
export type Locale = z.infer<typeof localeSchema>;
const text = z.string().trim().min(1);
export const localizedSchema = z.union([
  text,
  z.object({ pt: text.optional(), en: text.optional() }).strict(),
]);
export type Localized = z.infer<typeof localizedSchema>;
export const captionAlignmentSchema = z.enum([
  'left',
  'center',
  'right',
  'justify',
]);
export type CaptionAlignment = z.infer<typeof captionAlignmentSchema>;
const id = text.regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'Use letras minúsculas, números e hífens.',
);
const httpUrl = z
  .url()
  .refine((value) => /^https?:\/\//.test(value), 'Use http:// ou https://.');
const image = z.object({ src: text, alt: localizedSchema }).strict();
const socialImageSchema = image.extend({
  alt: localizedSchema.refine(
    (value) => typeof value === 'string' || Object.keys(value).length > 0,
    'Provide an image description, shared or localized.',
  ),
  src: text.refine(
    (value) =>
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !/[?#\\\x00-\x1f]/.test(value) &&
      /\.(?:png|jpe?g)$/i.test(value),
    'Use a PNG or JPEG file in public/, such as /images/social.png.',
  ),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
// Shared by automatic home portraits and composed-page figures.
export const profilePhotoSchema = image.extend({
  src: text.refine(
    (value) => value.startsWith('/') && !value.startsWith('//'),
    'Images must use /paths in public/.',
  ),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  shape: z.enum(['rectangle', 'circle']).default('rectangle'),
  position: z
    .tuple([z.number().min(0).max(100), z.number().min(0).max(100)])
    .optional(),
});
// A separate symbol avoids reusing a header wordmark as a person's portrait.
const avatarFallback = image
  .extend({
    viewBox: text
      .regex(/^\d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)?$/)
      .refine(
        (value) =>
          value
            .split(' ')
            .slice(2)
            .every((part) => Number(part) > 0),
        'The crop width and height must be positive.',
      )
      .optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.viewBox && (!value.width || !value.height))
      ctx.addIssue({
        code: 'custom',
        path: ['viewBox'],
        message:
          'Provide the original image width and height when using viewBox.',
      });
  });

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
    kind: z.enum(['group', 'individual', 'course']),
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
    /** Number of levels displayed in the menu; deeper pages keep their URLs. */
    navigationDepth: z.number().int().min(1).max(10).default(2),
    /** Number Markdown sections in article bodies; individual pages may override. */
    numberSections: z.boolean().default(false),
    layout: z
      .object({
        // Omission preserves each theme's existing navigation placement.
        navigation: z.enum(['top', 'sidebar']).optional(),
        subnavigation: z.enum(['inline', 'right', 'none']).default('inline'),
      })
      .strict()
      .optional(),
    downloads: z
      .object({
        notebook: z.boolean().default(false),
        pdf: z.boolean().default(false),
      })
      .strict()
      .default({ notebook: false, pdf: false }),
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
        palette: z
          .union([
            z.enum(['violet', 'ocean', 'forest', 'amber', 'slate']),
            z
              .object({
                base: z.enum(['violet', 'ocean', 'forest', 'amber', 'slate']),
                accent: z.enum(['violet', 'ocean', 'forest', 'amber', 'slate']),
              })
              .strict(),
          ])
          .optional(),
        typography: z.enum(['editorial', 'humanist', 'technical']).optional(),
        navigation: z.enum(['solid', 'glass']).optional(),
        icons: z
          .object({
            style: z.enum(['plain', 'accent', 'soft']).default('plain'),
            weight: z.enum(['light', 'regular', 'bold']).default('regular'),
          })
          .strict()
          .optional(),
        gradient: z
          .union([
            z.literal(false),
            z
              .object({
                style: z.enum(['linear', 'radial', 'mesh']).default('linear'),
                colors: z
                  .tuple([
                    z.enum(['violet', 'ocean', 'forest', 'amber', 'slate']),
                    z.enum(['violet', 'ocean', 'forest', 'amber', 'slate']),
                  ])
                  .default(['violet', 'ocean']),
                targets: z
                  .array(z.enum(['hero', 'headings']))
                  .nonempty()
                  .refine(
                    (values) => new Set(values).size === values.length,
                    'Gradient targets must not be repeated.',
                  )
                  .default(['hero']),
                angle: z.number().min(-360).max(360).default(135),
              })
              .strict(),
          ])
          .optional(),
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
        motion: z.enum(['none', 'subtle', 'expressive']).default('none'),
        bodyFont: text.regex(/^[\w\s,'"-]+$/).optional(),
        headingFont: text.regex(/^[\w\s,'"-]+$/).optional(),
        captions: z
          .object({
            figures: captionAlignmentSchema.default('center'),
            tables: captionAlignmentSchema.default('center'),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    favicon: text.optional(),
    social: z
      .object({
        image: socialImageSchema.optional(),
        fallback: z
          .union([z.literal('logo'), z.literal(false), socialImageSchema])
          .default('logo'),
      })
      .strict()
      .optional(),
    themeStorageKey: text.default('sciastro-theme'),
    copyright: localizedSchema.optional(),
    footer: localizedSchema.optional(),
    icons: iconsSchema.default({ navigation: {}, languages: {} }),
    contentDir: text.default('content'),
    analytics: analyticsSchema.default(false),
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
    people: z
      .object({
        /** Relative to contentDir; omitted sites continue to use team.yaml. */
        file: text.optional(),
        avatarFallback: avatarFallback.optional(),
      })
      .strict()
      .optional(),
    notice: localizedSchema.optional(),
    home: z
      .object({ body: localizedSchema, photo: profilePhotoSchema.optional() })
      .strict()
      .optional(),
    bibliography: z
      .object({
        file: text.default('references.bib'),
        style: z.enum(['apa', 'vancouver']).default('apa'),
        publications: z.array(text).default([]),
      })
      .strict()
      .optional(),
    links: z
      .array(
        z
          .object({
            label: text,
            url: httpUrl,
            analyticsEvent: analyticsEventSchema.optional(),
          })
          .strict(),
      )
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
    if (config.kind === 'course' && !config.pageFiles)
      ctx.addIssue({
        code: 'custom',
        path: ['pageFiles'],
        message:
          'Course sites require pageFiles for their syllabus and lessons.',
      });
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
      photo: image
        .extend({
          // Horizontal/vertical percentages: [50, 50] centers the circular crop.
          position: z
            .tuple([z.number().min(0).max(100), z.number().min(0).max(100)])
            .optional(),
        })
        .optional(),
      avatarFallback: avatarFallback.optional(),
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

/** Shared by automatic pages and explicit YAML/Markdown pages. */
export const pagePresentationFields = {
  layout: z.enum(['page', 'article', 'listing']).default('page'),
  parent: id.optional(),
  date: text
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
    .refine((value) => {
      const parsed = new Date(`${value}T00:00:00Z`);
      return (
        Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
      );
    }, 'Use a valid calendar date.')
    .optional(),
  authors: z.array(text).default([]),
  tags: z.array(text).default([]),
  toc: z.boolean().default(true),
  numberSections: z.boolean().optional(),
  draft: z.boolean().default(false),
  downloads: z
    .object({
      notebook: z.boolean().optional(),
      pdf: z.boolean().optional(),
    })
    .strict()
    .optional(),
  notebook: z
    .object({
      showCode: z.boolean().default(true),
      collapseCode: z.boolean().default(false),
    })
    .strict()
    .optional(),
};

export const pagesSchema = z.array(
  z
    .object({
      ...pagePresentationFields,
      slug: id,
      title: localizedSchema,
      icon: iconSchema.optional(),
      body: localizedSchema.optional(),
      description: localizedSchema.optional(),
      navigation: z.boolean().default(true),
      paths: z
        .object({ pt: text.optional(), en: text.optional() })
        .strict()
        .optional(),
    })
    .strict()
    .superRefine((page, ctx) => {
      if (!page.body && page.layout !== 'listing')
        ctx.addIssue({
          code: 'custom',
          path: ['body'],
          message: 'Provide body, or use layout: listing.',
        });
    }),
);
export type ContentPage = z.infer<typeof pagesSchema>[number];
