import type { SiteConfig } from './schema.js';

type Appearance = NonNullable<SiteConfig['appearance']>;
type PaletteName = Extract<Appearance['palette'], string>;
type PaletteTokens = Record<
  'paper' | 'surface' | 'ink' | 'muted' | 'accent' | 'line',
  string
>;

/** Neutral reading surfaces with accents tested against every preset background. */
export const PALETTES = {
  violet: {
    light: {
      paper: '#FCFBFE',
      surface: '#F1EEF8',
      ink: '#272236',
      muted: '#5F566F',
      accent: '#6542A6',
      line: '#DED8EA',
    },
    dark: {
      paper: '#181521',
      surface: '#242030',
      ink: '#F0ECFA',
      muted: '#C3BBD3',
      accent: '#C2A7FA',
      line: '#42384F',
    },
  },
  ocean: {
    light: {
      paper: '#FAFCFE',
      surface: '#EDF3F8',
      ink: '#203041',
      muted: '#516273',
      accent: '#14658E',
      line: '#D7E2EC',
    },
    dark: {
      paper: '#121C26',
      surface: '#1C2A38',
      ink: '#EAF2FB',
      muted: '#B5C3D4',
      accent: '#81C9ED',
      line: '#344A60',
    },
  },
  forest: {
    light: {
      paper: '#FBFDFC',
      surface: '#EEF4F0',
      ink: '#233A30',
      muted: '#52675B',
      accent: '#256B49',
      line: '#D8E4DC',
    },
    dark: {
      paper: '#141D18',
      surface: '#202D25',
      ink: '#ECF5EE',
      muted: '#B9CCBF',
      accent: '#94D2AA',
      line: '#384C3F',
    },
  },
  amber: {
    light: {
      paper: '#FEFCF8',
      surface: '#F7F1E7',
      ink: '#3B2D20',
      muted: '#6E5D4A',
      accent: '#8A530C',
      line: '#E8DDCA',
    },
    dark: {
      paper: '#211A11',
      surface: '#30271B',
      ink: '#F8F0E5',
      muted: '#D0C2AD',
      accent: '#E4B767',
      line: '#54442C',
    },
  },
  slate: {
    light: {
      paper: '#FBFCFD',
      surface: '#F0F2F5',
      ink: '#26313E',
      muted: '#576271',
      accent: '#526178',
      line: '#DCE1E8',
    },
    dark: {
      paper: '#171C24',
      surface: '#252C36',
      ink: '#EDF1F7',
      muted: '#BEC8D6',
      accent: '#B8CAE5',
      line: '#3D4858',
    },
  },
} as const satisfies Record<
  PaletteName,
  { light: PaletteTokens; dark: PaletteTokens }
>;

const typography = {
  editorial: {
    'body-font': "'Manrope Variable', sans-serif",
    heading: "'Newsreader Variable', Georgia, serif",
  },
  humanist: {
    'body-font': "'Manrope Variable', sans-serif",
    heading: "'Manrope Variable', sans-serif",
  },
  technical: {
    'body-font': 'system-ui, sans-serif',
    heading: 'system-ui, sans-serif',
  },
} as const;
const iconWeights = { light: '1.5', regular: '2', bold: '2.5' } as const;

export interface ResolvedAppearance {
  light: Record<string, string>;
  dark: Record<string, string>;
  /** CSS custom-property names without their leading --. */
  properties: Record<string, string>;
}

/** Resolve validated settings without overriding an omitted theme convention. */
export function resolveAppearance(appearance?: Appearance): ResolvedAppearance {
  if (!appearance) return { light: {}, dark: {}, properties: {} };
  let light: Record<string, string> = {};
  let dark: Record<string, string> = {};
  if (appearance.palette) {
    const selection =
      typeof appearance.palette === 'string'
        ? { base: appearance.palette, accent: appearance.palette }
        : appearance.palette;
    light = {
      ...PALETTES[selection.base].light,
      accent: PALETTES[selection.accent].light.accent,
    };
    dark = {
      ...PALETTES[selection.base].dark,
      accent: PALETTES[selection.accent].dark.accent,
    };
  }
  const properties: Record<string, string> = {
    'content-width': `${appearance.contentWidth}px`,
    ...(appearance.typography ? typography[appearance.typography] : {}),
  };
  if (appearance.bodyFont) properties['body-font'] = appearance.bodyFont;
  if (appearance.headingFont) properties.heading = appearance.headingFont;
  if (appearance.icons)
    properties['icon-stroke-width'] = iconWeights[appearance.icons.weight];
  if (appearance.captions) {
    const { figures, tables } = appearance.captions;
    properties['figure-caption-align'] = figures;
    properties['table-caption-align'] = tables;
    properties['figure-caption-links-align'] =
      figures === 'center'
        ? 'center'
        : figures === 'right'
          ? 'flex-end'
          : 'flex-start';
  }
  if (appearance.gradient) {
    const [from, to] = appearance.gradient.colors;
    light['gradient-from'] = PALETTES[from].light.accent;
    light['gradient-to'] = PALETTES[to].light.accent;
    dark['gradient-from'] = PALETTES[from].dark.accent;
    dark['gradient-to'] = PALETTES[to].dark.accent;
    properties['gradient-angle'] = `${appearance.gradient.angle}deg`;
    // Presets reserve more contrast for tinted surfaces; legacy themes retain
    // their original text colors and use a gentler background blend.
    properties['gradient-tint'] = appearance.palette ? '8%' : '5%';
  }
  return {
    light: { ...light, ...appearance.light },
    dark: { ...dark, ...appearance.dark },
    properties,
  };
}
