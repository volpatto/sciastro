import { mkdir, cp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';

// Both authoring modes use the same non-square, fictional illustration.
export async function writePortraitSite(root, mode, theme = 'classic') {
  await mkdir(join(root, 'content'), { recursive: true });
  await mkdir(join(root, 'public/images'), { recursive: true });
  await cp(
    'examples/individual/public/images/fictional-portrait.svg',
    join(root, 'public/images/portrait.svg'),
  );
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  const photo = {
    src: '/images/portrait.svg',
    alt: { pt: 'Retrato fictício', en: 'Fictional portrait' },
    width: 240,
    height: 300,
    shape: 'circle',
    position: [50, 30],
  };
  const config = {
    schemaVersion: 1,
    kind: 'individual',
    name: 'Example Researcher',
    description: { pt: 'Pesquisa e ensino', en: 'Research and teaching' },
    url: 'https://portraits.example',
    base: '/lab/',
    locales: ['pt', 'en'],
    theme,
  };
  if (mode === 'automatic') {
    config.home = { body: 'about.md', photo };
    await writeFile(join(root, 'content/about.md'), 'A fictional biography.');
  } else {
    config.pageFiles = [];
    for (const variant of ['home', 'rectangle', 'no-photo', 'viewbox']) {
      const filename = `${variant}.yaml`;
      config.pageFiles.push(filename);
      const image = { ...photo };
      if (variant === 'rectangle') delete image.shape;
      if (variant === 'viewbox') image.viewBox = '0 0 240 300';
      await writeFile(
        join(root, 'content', filename),
        stringify({
          id: variant,
          title: variant === 'home' ? { pt: 'Sobre', en: 'About' } : variant,
          paths: {
            pt: variant === 'home' ? '' : `${variant}/`,
            en: variant === 'home' ? 'en/' : `en/${variant}/`,
          },
          header: false,
          sections: [
            {
              type: 'profile',
              title: 'Example Researcher',
              text: 'A fictional biography.',
              ...(variant === 'no-photo'
                ? {}
                : {
                    image: {
                      ...image,
                      caption: {
                        pt: 'Ilustração fictícia',
                        en: 'Fictional illustration',
                      },
                      enlarge: true,
                      links: [
                        {
                          label: 'Credits',
                          url: 'https://example.org/credits',
                        },
                      ],
                    },
                  }),
            },
          ],
        }),
      );
    }
  }
  const configFile = join(root, 'sciastro.yaml');
  await writeFile(configFile, stringify(config));
  return { configFile, config, photo };
}
