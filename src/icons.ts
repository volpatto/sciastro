import { icons as lucide } from '@iconify-json/lucide';
import { icons as flags } from '@iconify-json/circle-flags';
import { getIconData, iconToSVG, replaceIDs } from '@iconify/utils';
import type { IconSetting, Locale, SiteConfig } from './schema.js';

export type BuiltIcon =
  | { kind: 'svg'; name: string; viewBox: string; body: string }
  | { kind: 'image'; src: string; monochrome?: boolean }
  | false;

/** Only installed catalogs are used; there are no requests to an icon API. */
export function resolveIcon(setting: IconSetting, field: string): BuiltIcon {
  if (setting === false) return false;
  if (typeof setting === 'object')
    return {
      kind: 'image',
      src: setting.src,
      ...(setting.monochrome ? { monochrome: true } : {}),
    };
  const [prefix, name] = setting.split(':');
  const collection =
    prefix === 'lucide'
      ? lucide
      : prefix === 'circle-flags'
        ? flags
        : undefined;
  const data = collection && getIconData(collection, name);
  if (!data)
    throw new Error(
      `${field}: ícone '${setting}' não encontrado nos catálogos incluídos. Consulte docs/icones.md.`,
    );
  const svg = iconToSVG(data);
  return {
    kind: 'svg',
    name: setting,
    viewBox: svg.attributes.viewBox,
    body: replaceIDs(svg.body),
  };
}

export function navigationIcon(
  config: SiteConfig,
  page: string,
  custom?: IconSetting,
): BuiltIcon {
  if (config.icons === false || config.icons.navigation === false) return false;
  const defaults: Record<string, string> = {
    home: config.kind === 'group' ? 'lucide:house' : 'lucide:user-round',
    research: 'lucide:flask-conical',
    team:
      config.kind === 'group' ? 'lucide:users-round' : 'lucide:graduation-cap',
    publications: 'lucide:book-open',
  };
  return resolveIcon(
    config.icons.navigation[page] ??
      custom ??
      defaults[page] ??
      'lucide:file-text',
    `icons.navigation.${page}`,
  );
}

export function languageIcon(config: SiteConfig, locale: Locale): BuiltIcon {
  if (config.icons === false || config.icons.languages === false) return false;
  return resolveIcon(
    config.icons.languages[locale] ??
      (locale === 'pt' ? 'circle-flags:br' : 'circle-flags:gb'),
    `icons.languages.${locale}`,
  );
}
