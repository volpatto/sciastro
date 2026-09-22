import type { Localized, SiteConfig } from './schema.js';
import { assetPath } from './i18n.js';

export interface BuiltSocialImage {
  /** Absolute public URL, including the deployment base for local files. */
  url: string;
  alt: Localized;
  type: 'image/png' | 'image/jpeg';
  width?: number;
  height?: number;
}

/** Sharing has its own fallback policy, independent of people and favicons. */
export function resolveSocialImage(config: SiteConfig): {
  image?: BuiltSocialImage;
  warning?: string;
} {
  const fallback = config.social?.fallback ?? 'logo';
  const source =
    config.social?.image ??
    (fallback === 'logo' ? config.logo : fallback || undefined);
  if (!source) return {};

  const extension = /\.(png|jpe?g)$/i.exec(source.src.split(/[?#]/)[0]);
  if (!extension)
    return {
      warning:
        'The site logo is not a PNG or JPEG: no sharing image was added. ' +
        'Set social.image or social.fallback to a PNG/JPEG file in public/, ' +
        'or set social.fallback: false to omit the image intentionally.',
    };

  // Use the original file. Header-only viewBox/monochrome styling does not apply.
  return {
    image: {
      url: new URL(assetPath(config.base, source.src), config.url).href,
      alt: source.alt,
      type: extension[1].toLowerCase() === 'png' ? 'image/png' : 'image/jpeg',
      ...(Number.isInteger(source.width) ? { width: source.width } : {}),
      ...(Number.isInteger(source.height) ? { height: source.height } : {}),
    },
  };
}
