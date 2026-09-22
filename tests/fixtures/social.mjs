import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';

// A real 1x1 PNG. The image contents are irrelevant; its public URL is not.
export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGD8AAAAASUVORK5CYII=',
  'base64',
);
export const socialImage = (name) => ({
  src: `/images/${name}.png`,
  alt: { pt: `Imagem ${name}`, en: `${name} image` },
  width: 1,
  height: 1,
});

export async function writeSocialSite(root, mode = 'automatic') {
  await mkdir(join(root, 'content'), { recursive: true });
  await mkdir(join(root, 'public/images'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  for (const name of ['logo', 'custom', 'fallback', 'people', 'favicon'])
    await writeFile(join(root, `public/images/${name}.png`), png);
  await writeFile(
    join(root, 'public/images/vector.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>',
  );
  const config = {
    schemaVersion: 1,
    kind: mode === 'automatic' ? 'individual' : 'group',
    name: 'Research & Education',
    description: { pt: 'Descrição do site', en: 'Site description' },
    url: 'https://academic.example',
    base: '/lab/',
    locales: ['pt', 'en'],
    logo: socialImage('logo'),
    favicon: '/images/favicon.png',
    people: { avatarFallback: socialImage('people') },
  };
  if (mode === 'automatic') {
    config.home = { body: 'home.md' };
    await writeFile(join(root, 'content/home.md'), 'Fictional test site.');
  } else {
    config.pageFiles = ['home.yaml', 'research.yaml'];
    for (const id of ['home', 'research'])
      await writeFile(
        join(root, `content/${id}.yaml`),
        stringify({
          id,
          title: {
            pt: id === 'home' ? 'Início' : 'Pesquisa',
            en: id === 'home' ? 'Home' : 'Research',
          },
          description: { pt: `Descrição ${id}`, en: `${id} description` },
          paths: {
            pt: id === 'home' ? '' : 'pesquisa/',
            en: id === 'home' ? 'en/' : 'en/research/',
          },
          sections: [{ type: 'prose', text: 'Fictional test site.' }],
        }),
      );
  }
  const file = join(root, 'sciastro.yaml');
  const save = () => writeFile(file, stringify(config));
  await save();
  return { root, config, file, save };
}
