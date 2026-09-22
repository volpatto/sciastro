import { test, expect } from '@playwright/test';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';

const origin = 'https://academic.example';
const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

for (const kind of ['logo', 'custom', 'fallback', 'none']) {
  test(`${kind}: sharing metadata and original image are available without JavaScript`, async ({
    page,
  }) => {
    const failures = [];
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || !url.pathname.startsWith('/lab/')) {
        failures.push(url.href);
        return route.abort();
      }
      let file = join(
        resolve('.test-output/social', kind, 'dist'),
        url.pathname.slice('/lab/'.length),
      );
      const entry = await stat(file).catch(() => undefined);
      if (!entry) {
        failures.push(url.href);
        return route.fulfill({ status: 404, body: 'Missing asset' });
      }
      if (entry.isDirectory()) file = join(file, 'index.html');
      return route.fulfill({
        contentType: mime[extname(file)],
        body: await readFile(file),
      });
    });
    const meta = (property) =>
      page.locator(`head meta[property="${property}"]`);
    const twitter = (name) => page.locator(`head meta[name="twitter:${name}"]`);
    const paths = ['', 'en/'];
    if (['custom', 'none'].includes(kind))
      paths.push('pesquisa/', 'en/research/');
    paths.push('404.html');
    for (const path of paths) {
      const response = await page.goto(`${origin}/lab/${path}`);
      const en = path.startsWith('en/');
      await expect(meta('og:url')).toHaveAttribute(
        'content',
        `${origin}/lab/${path}`,
      );
      await expect(meta('og:site_name')).toHaveAttribute(
        'content',
        'Research & Education',
      );
      await expect(meta('og:locale')).toHaveAttribute(
        'content',
        en ? 'en_GB' : 'pt_BR',
      );
      await expect(meta('og:locale:alternate')).toHaveAttribute(
        'content',
        en ? 'pt_BR' : 'en_GB',
      );
      await expect(twitter('title')).toHaveAttribute(
        'content',
        await meta('og:title').getAttribute('content'),
      );
      await expect(twitter('description')).toHaveAttribute(
        'content',
        await meta('og:description').getAttribute('content'),
      );
      if (path.includes('research') || path.includes('pesquisa'))
        await expect(meta('og:description')).toHaveAttribute(
          'content',
          en ? 'research description' : 'Descrição research',
        );
      if (kind === 'none') {
        await expect(meta('og:image')).toHaveCount(0);
        await expect(page.locator('meta[property^="og:image:"]')).toHaveCount(
          0,
        );
        await expect(twitter('image')).toHaveCount(0);
        await expect(twitter('card')).toHaveAttribute('content', 'summary');
        continue;
      }
      const url = `${origin}/lab/images/${kind}.png`;
      const alt = en
        ? `${kind} image`
        : kind === 'custom'
          ? 'Imagem custom & "teste"'
          : `Imagem ${kind}`;
      expect(await response.text()).toContain('property="og:image"');
      await expect(meta('og:image')).toHaveCount(1);
      await expect(meta('og:image')).toHaveAttribute('content', url);
      await expect(meta('og:image:alt')).toHaveAttribute('content', alt);
      await expect(meta('og:image:type')).toHaveAttribute(
        'content',
        'image/png',
      );
      await expect(meta('og:image:width')).toHaveAttribute('content', '1');
      await expect(meta('og:image:height')).toHaveAttribute('content', '1');
      await expect(twitter('image')).toHaveAttribute('content', url);
      await expect(twitter('image:alt')).toHaveAttribute('content', alt);
      await expect(twitter('card')).toHaveAttribute(
        'content',
        'summary_large_image',
      );
    }
    if (kind !== 'none') {
      // The metadata must point to a deployed, decodable image, not just a string.
      const response = await page.goto(`${origin}/lab/images/${kind}.png`);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toBe('image/png');
      await expect
        .poll(() => page.locator('img').evaluate((img) => img.naturalWidth))
        .toBe(1);
    }
    expect(failures).toEqual([]);
  });
}
