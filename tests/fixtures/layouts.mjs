import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';

export const layoutVariants = [
  { name: 'default-classic', theme: 'classic' },
  { name: 'default-lncc', theme: 'lncc' },
  {
    name: 'sidebar-right',
    theme: 'classic',
    layout: { navigation: 'sidebar', subnavigation: 'right' },
    motion: 'subtle',
    depth: 2,
  },
  {
    name: 'top-right',
    theme: 'lncc',
    layout: { navigation: 'top', subnavigation: 'right' },
    motion: 'expressive',
    depth: 2,
  },
  {
    name: 'without-context',
    theme: 'modern',
    layout: { navigation: 'sidebar', subnavigation: 'none' },
  },
  {
    name: 'narrow-content',
    theme: 'classic',
    layout: { navigation: 'top', subnavigation: 'right' },
    motion: 'expressive',
    width: 720,
  },
];

export async function writeLayoutSite(root, variant = layoutVariants[2]) {
  const directory = join(root, 'content');
  await mkdir(directory, { recursive: true });
  const config = {
    schemaVersion: 1,
    kind: 'individual',
    name: 'Scientific notes',
    description: {
      pt: 'Métodos, hipóteses e resultados.',
      en: 'Methods, assumptions and results.',
    },
    url: 'https://layouts.example',
    base: '/lab/',
    locales: ['pt', 'en'],
    defaultLocale: 'pt',
    theme: variant.theme,
    contentDir: 'content',
    navigation: ['home', 'course'],
    navigationDepth: variant.depth ?? 1,
    pageFiles: [
      'home.md',
      'course.yaml',
      'lesson.md',
      'sibling.md',
      'appendix.md',
      'no-toc.md',
      'hidden.yaml',
      'hidden-child.md',
    ],
    ...(variant.layout ? { layout: variant.layout } : {}),
    ...(variant.motion || variant.width
      ? {
          appearance: {
            motion: variant.motion ?? 'none',
            ...(variant.width ? { contentWidth: variant.width } : {}),
          },
        }
      : {}),
  };
  const markdown = async (file, metadata, body) =>
    writeFile(
      join(directory, file),
      `---\n${stringify(metadata)}---\n\n${body}\n`,
    );
  await markdown(
    'home.md',
    {
      id: 'home',
      title: { pt: 'Início', en: 'Home' },
      paths: { pt: '', en: 'en/' },
    },
    `
::: cards
::: card title="Métodos numéricos"
Um roteiro de estudo com hipóteses explícitas.

[Ler a aula](page:lesson)
:::
:::
`,
  );
  await writeFile(
    join(directory, 'course.yaml'),
    stringify({
      id: 'course',
      title: { pt: 'Curso', en: 'Course' },
      paths: { pt: 'curso/', en: 'en/course/' },
      layout: 'listing',
    }),
  );
  await markdown(
    'lesson.md',
    {
      id: 'lesson',
      title: { pt: 'Uma aula', en: 'A lesson' },
      paths: { pt: 'curso/aula/', en: 'en/course/lesson/' },
      parent: 'course',
      layout: 'article',
    },
    `## Hipóteses\n\nCondições necessárias para o método.\n\n### Regularidade\n\nA solução deve ser suficientemente regular.\n\n## Resultados\n\n${'Resultados e limitações devem acompanhar os valores calculados.\n\n'.repeat(12)}`,
  );
  await markdown(
    'sibling.md',
    {
      id: 'sibling',
      title: { pt: 'Outro tópico', en: 'Another topic' },
      paths: { pt: 'curso/outro/', en: 'en/course/other/' },
      parent: 'course',
      layout: 'article',
    },
    '## Outro resultado\n\nUma página relacionada.',
  );
  await markdown(
    'appendix.md',
    {
      id: 'appendix',
      title: { pt: 'Apêndice', en: 'Appendix' },
      paths: { pt: 'curso/aula/apendice/', en: 'en/course/lesson/appendix/' },
      parent: 'lesson',
      layout: 'article',
    },
    '## Detalhes\n\nUma página além da profundidade do menu principal.',
  );
  await markdown(
    'no-toc.md',
    {
      id: 'no-toc',
      title: 'Sem sumário',
      paths: { pt: 'curso/sem-sumario/', en: 'en/course/no-toc/' },
      parent: 'course',
      layout: 'article',
      toc: false,
    },
    '## Ainda existe um título\n\nO conteúdo permanece visível.',
  );
  await writeFile(
    join(directory, 'hidden.yaml'),
    stringify({
      id: 'hidden',
      title: 'Hidden branch',
      paths: { pt: 'oculto/', en: 'en/hidden/' },
      navigation: false,
      layout: 'listing',
    }),
  );
  await markdown(
    'hidden-child.md',
    {
      id: 'hidden-child',
      title: 'Hidden child',
      paths: { pt: 'oculto/filho/', en: 'en/hidden/child/' },
      parent: 'hidden',
      layout: 'article',
    },
    '## Private menu branch\n\nThis route exists but its branch is absent from navigation.',
  );
  await writeFile(join(root, 'sciastro.yaml'), stringify(config));
  return config;
}
