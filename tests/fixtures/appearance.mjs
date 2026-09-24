import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { PALETTES } from '../../dist/appearance.js';

const paletteColors = (base, accent = base) =>
  Object.fromEntries(
    ['light', 'dark'].map((mode) => [
      mode,
      {
        paper: PALETTES[base][mode].paper.toLowerCase(),
        accent: PALETTES[accent][mode].accent.toLowerCase(),
      },
    ]),
  );

export const appearanceVariants = [
  {
    name: 'defaults',
    kind: 'group',
    theme: 'classic',
    automatic: true,
    expected: {
      light: { paper: '#fcfcfe', accent: '#5146a5' },
      dark: { paper: '#141827', accent: '#b8aff0' },
      bodyFont: 'system-ui',
      headingFont: 'Georgia',
    },
  },
  {
    name: 'classic-mixed',
    kind: 'group',
    theme: 'classic',
    automatic: true,
    appearance: {
      palette: { base: 'ocean', accent: 'amber' },
      typography: 'editorial',
      light: { paper: '#fff9f1', accent: '#6b2a82' },
      icons: { style: 'soft', weight: 'bold' },
      gradient: {
        style: 'linear',
        colors: ['violet', 'ocean'],
        targets: ['hero', 'headings'],
        angle: 135,
      },
    },
    expected: {
      ...paletteColors('ocean', 'amber'),
      light: { paper: '#fff9f1', accent: '#6b2a82' },
      bodyFont: 'Manrope Variable',
      headingFont: 'Newsreader Variable',
    },
  },
  {
    name: 'modern-mesh',
    kind: 'individual',
    theme: 'modern',
    profile: true,
    layout: { navigation: 'top' },
    appearance: {
      navigation: 'glass',
      palette: 'forest',
      typography: 'humanist',
      icons: { style: 'accent', weight: 'light' },
      gradient: {
        style: 'mesh',
        colors: ['forest', 'ocean'],
        targets: ['hero'],
      },
    },
    expected: {
      ...paletteColors('forest'),
      bodyFont: 'Manrope Variable',
      headingFont: 'Manrope Variable',
    },
  },
  {
    name: 'lncc-radial',
    kind: 'course',
    theme: 'lncc',
    appearance: {
      navigation: 'glass',
      palette: 'violet',
      typography: 'editorial',
      icons: { style: 'plain', weight: 'regular' },
      gradient: {
        style: 'radial',
        colors: ['violet', 'amber'],
        targets: ['headings'],
      },
    },
    expected: {
      ...paletteColors('violet'),
      bodyFont: 'Manrope Variable',
      headingFont: 'Newsreader Variable',
    },
  },
  {
    name: 'technical',
    kind: 'individual',
    theme: 'classic',
    appearance: {
      palette: 'slate',
      typography: 'technical',
      icons: { style: 'plain', weight: 'bold' },
      gradient: false,
    },
    expected: {
      ...paletteColors('slate'),
      bodyFont: 'system-ui',
      headingFont: 'system-ui',
    },
  },
  {
    name: 'custom-fonts',
    kind: 'group',
    theme: 'modern',
    automatic: true,
    appearance: {
      typography: 'technical',
      light: { paper: '#fff8ee', accent: '#8a530c' },
      bodyFont: 'Georgia, serif',
      headingFont: 'Arial, sans-serif',
      icons: { style: 'soft', weight: 'regular' },
      gradient: {
        style: 'linear',
        colors: ['amber', 'forest'],
        targets: ['hero'],
        angle: 35,
      },
    },
    expected: {
      light: { paper: '#fff8ee', accent: '#8a530c' },
      dark: { paper: '#131e1b', accent: '#98d3bd' },
      bodyFont: 'Georgia',
      headingFont: 'Arial',
    },
  },
];

export async function writeAppearanceSite(root, variant) {
  const content = join(root, 'content');
  await mkdir(content, { recursive: true });
  await mkdir(join(root, 'public'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  await writeFile(
    join(root, 'public/brand.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="4" fill="#b23b54"/><circle cx="12" cy="12" r="5" fill="#f9dc75"/></svg>',
  );
  const config = {
    schemaVersion: 1,
    kind: variant.kind,
    theme: variant.theme,
    name: 'Scientific appearance',
    description: {
      pt: 'Pesquisa, métodos e ensino.',
      en: 'Research, methods and teaching.',
    },
    url: 'https://appearance.example',
    base: '/lab/',
    locales: ['pt', 'en'],
    defaultLocale: 'pt',
    contentDir: 'content',
    navigation: ['home', 'lesson', 'flag', 'brand'],
    icons: {
      navigation: {
        home: 'lucide:house',
        lesson: 'lucide:book-open',
        flag: 'circle-flags:br',
        brand: { src: '/brand.svg' },
      },
      languages: { pt: 'circle-flags:br', en: 'circle-flags:gb' },
    },
    ...(variant.appearance ? { appearance: variant.appearance } : {}),
    ...(variant.layout ? { layout: variant.layout } : {}),
  };
  const body =
    '# Título dentro do documento\n\n## Método\n\nUma comparação com hipóteses explícitas.\n\n[Uma marca local](page:brand) e resultados verificáveis.\n\n## Resultados\n\n' +
    'O conteúdo deve permanecer legível em todos os modos, com resultados verificáveis e hipóteses explícitas.\n\n'.repeat(
      14,
    );
  await writeFile(
    join(content, 'home.md'),
    'Conhecimento científico com exemplos e métodos reproduzíveis.\n',
  );
  await writeFile(join(content, 'lesson.md'), body);
  const pages = [
    {
      id: 'lesson',
      title: { pt: 'Métodos', en: 'Methods' },
      layout: 'article',
      date: '2026-09-23',
      authors: ['Pesquisadora Exemplo'],
      body: 'lesson.md',
    },
    { id: 'flag', title: { pt: 'País', en: 'Country' }, body: 'home.md' },
    { id: 'brand', title: { pt: 'Marca', en: 'Brand' }, body: 'home.md' },
    {
      id: 'section',
      parent: 'lesson',
      title: { pt: 'Detalhes', en: 'Details' },
      body: 'home.md',
    },
  ];
  if (variant.automatic) {
    config.home = { body: 'home.md' };
    await writeFile(
      join(content, 'pages.yaml'),
      stringify(
        pages.map(({ id, ...page }) => ({
          ...page,
          slug: id,
          paths: { pt: `${id}/`, en: `en/${id}/` },
        })),
      ),
    );
  } else {
    config.pageFiles = ['home.yaml', ...pages.map(({ id }) => `${id}.yaml`)];
    await writeFile(
      join(content, 'home.yaml'),
      stringify({
        id: 'home',
        title: { pt: 'Início', en: 'Home' },
        paths: { pt: '', en: 'en/' },
        ...(variant.profile
          ? {
              header: false,
              sections: [
                {
                  type: 'profile',
                  title: 'Pesquisa e formação',
                  text: 'Um perfil para avaliar a apresentação do conteúdo.',
                },
              ],
            }
          : { body: 'home.md' }),
      }),
    );
    for (const page of pages)
      await writeFile(
        join(content, `${page.id}.yaml`),
        stringify({
          ...page,
          paths: { pt: `${page.id}/`, en: `en/${page.id}/` },
        }),
      );
  }
  await writeFile(join(root, 'sciastro.yaml'), stringify(config));
}
