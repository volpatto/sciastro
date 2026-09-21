import { z } from 'zod';

/** Public identifiers only: analytics configuration is included in the website. */
export const analyticsSchema = z.union([
  z.literal(false),
  z.discriminatedUnion('provider', [
    z
      .object({
        provider: z.literal('cloudflare'),
        token: z
          .string()
          .trim()
          .regex(
            /^[a-f0-9]{32}$/i,
            'Use the 32-character token from Cloudflare Web Analytics, not an API token.',
          ),
      })
      .strict(),
    z
      .object({
        provider: z.literal('umami'),
        websiteId: z.uuid('Use the website ID from the Umami tracking code.'),
        scriptUrl: z
          .url()
          .refine((value) => {
            if (!URL.canParse(value)) return false;
            const url = new URL(value);
            return (
              url.protocol === 'https:' &&
              !url.username &&
              !url.password &&
              !url.hash
            );
          }, 'Use an HTTPS tracker URL without credentials or a fragment.')
          .default('https://cloud.umami.is/script.js'),
        events: z
          .object({
            downloads: z.boolean().default(false),
            externalLinks: z.boolean().default(false),
            custom: z.boolean().default(false),
          })
          .strict()
          .default({ downloads: false, externalLinks: false, custom: false }),
      })
      .strict(),
  ]),
]);
export type AnalyticsConfig = z.infer<typeof analyticsSchema>;

/** false excludes a link from every SciAstro click event. */
export const analyticsEventSchema = z.union([
  z.literal(false),
  z
    .string()
    .regex(
      /^[a-z][a-z0-9_-]{0,49}$/,
      'Use an event name of up to 50 lowercase letters, digits, underscores or hyphens.',
    )
    .refine(
      (value) => value !== 'false',
      'The name "false" is reserved for excluding a link.',
    ),
]);
