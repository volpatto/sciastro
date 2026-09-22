import { test, expect } from '@playwright/test';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';

const origin = 'https://portraits.example';
const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

async function serve(page, kind) {
  const failures = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || !url.pathname.startsWith('/lab/')) {
      failures.push(url.href);
      return route.abort();
    }
    let file = join(
      resolve('.test-output/portraits', kind, 'dist'),
      url.pathname.slice('/lab/'.length),
    );
    const entry = await stat(file).catch(() => undefined);
    if (!entry) {
      failures.push(url.href);
      return route.fulfill({ status: 404, body: 'Missing fixture asset' });
    }
    if (entry.isDirectory()) file = join(file, 'index.html');
    return route.fulfill({
      contentType: mime[extname(file)],
      body: await readFile(file),
    });
  });
  return failures;
}

for (const kind of ['individual', 'group']) {
  for (const theme of ['classic', 'modern', 'lncc']) {
    for (const width of [1280, 390]) {
      test(`${kind} / ${theme} / ${width}: global and individual caption alignment without moving figures or table cells`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        const failures = await serve(page, `alignment-${kind}-${theme}`);
        for (const colorScheme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme });
          await page.goto(`${origin}/lab/alignment/`);
          const figures = page.locator('main figure.sp-figure');
          await expect(figures).toHaveCount(5);
          for (const [index, alignment] of [
            'left',
            'left',
            'center',
            'right',
            'justify',
          ].entries()) {
            const figure = figures.nth(index);
            const caption = figure.locator('figcaption');
            const links = caption.locator('.sp-links');
            await expect(caption).toHaveCSS('text-align', alignment);
            const flex =
              alignment === 'center'
                ? 'center'
                : alignment === 'right'
                  ? 'flex-end'
                  : 'flex-start';
            await expect(links).toHaveCSS('justify-content', flex);
            const frame = await figure
              .locator('.sp-figure-media')
              .boundingBox();
            const credit = await links
              .getByRole('link', { name: 'Credits' })
              .boundingBox();
            const edge =
              alignment === 'center' ? 0.5 : alignment === 'right' ? 1 : 0;
            expect(
              Math.abs(
                credit.x + credit.width * edge - (frame.x + frame.width * edge),
              ),
            ).toBeLessThan(1);
          }
          const document = page
            .locator('main .sciastro-document')
            .filter({ has: page.locator('.document-figure') });
          const documentFigures = document.locator('figure.document-figure');
          const documentTables = document.locator('figure.document-table');
          await expect(documentFigures).toHaveCount(5);
          await expect(documentTables).toHaveCount(5);
          const body = await document.boundingBox();
          for (let index = 0; index < 5; index++) {
            const figure = documentFigures.nth(index);
            const table = documentTables.nth(index);
            await expect(figure.locator('figcaption')).toHaveCSS(
              'text-align',
              ['left', 'left', 'center', 'right', 'justify'][index],
            );
            await expect(table.locator('figcaption')).toHaveCSS(
              'text-align',
              ['right', 'left', 'center', 'right', 'justify'][index],
            );
            const figureBox = await figure.boundingBox();
            const tableBox = await table.boundingBox();
            // Media placement stays independent of the caption's alignment.
            expect(
              Math.abs(figureBox.x + figureBox.width - (body.x + body.width)),
            ).toBeLessThan(1);
            expect(Math.abs(tableBox.x - body.x)).toBeLessThan(1);
            expect(figureBox.width / body.width).toBeCloseTo(0.6, 2);
            expect(tableBox.width / body.width).toBeCloseTo(0.6, 2);
            for (const [column, alignment] of [
              'left',
              'center',
              'right',
            ].entries()) {
              await expect(table.locator('th').nth(column)).toHaveCSS(
                'text-align',
                alignment,
              );
              await expect(table.locator('td').nth(column)).toHaveCSS(
                'text-align',
                alignment,
              );
            }
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          if (
            kind === 'individual' &&
            theme === 'lncc' &&
            colorScheme === 'light'
          ) {
            await page.screenshot({
              path: `.test-output/caption-alignment-${width}.png`,
              fullPage: true,
            });
            await documentTables.first().screenshot({
              path: `.test-output/caption-alignment-table-${width}.png`,
            });
          }
        }
        expect(failures).toEqual([]);
      });
    }
  }
}

async function expectCenteredCaption(figure) {
  const caption = figure.locator('figcaption');
  const media = figure.locator('.sp-figure-media');
  await expect(caption).toHaveCSS('text-align', 'center');
  await expect(caption.locator('.sp-links')).toHaveCSS(
    'justify-content',
    'center',
  );
  const imageBox = await media.boundingBox();
  const creditBox = await caption
    .getByRole('link', { name: 'Credits' })
    .boundingBox();
  expect(
    Math.abs(
      creditBox.x + creditBox.width / 2 - (imageBox.x + imageBox.width / 2),
    ),
  ).toBeLessThan(1);
}

for (const [mode, kind] of [
  ['automatic', 'individual'],
  ['composed', 'individual'],
  ['composed', 'group'],
]) {
  for (const theme of ['classic', 'modern', 'lncc']) {
    for (const width of [1280, 390]) {
      test(`${mode} / ${kind} / ${theme} / ${width}: circular portraits and centered figure captions without JavaScript`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        const failures = await serve(page, `${mode}-${kind}-${theme}`);
        for (const colorScheme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme });
          for (const [locale, alt] of [
            ['pt', 'Retrato fictício'],
            ['en', 'Fictional portrait'],
          ]) {
            await page.goto(`${origin}/lab/${locale === 'en' ? 'en/' : ''}`);
            const figure = page.locator('main .sp-figure');
            const media = figure.locator('.sp-figure-media');
            const img = figure.getByRole('img', { name: alt, exact: true });
            await expect(img).toBeVisible();
            await expect(img).toHaveAttribute(
              'src',
              '/lab/images/portrait.svg',
            );
            await expect(img).toHaveAttribute('loading', 'eager');
            await expect(img).toHaveCSS('object-fit', 'cover');
            await expect(img).toHaveCSS('object-position', '50% 30%');
            await expect(media).toHaveCSS('border-radius', '50%');
            await expect(media).toHaveCSS('overflow', 'hidden');
            expect(
              await img.evaluate((el) => el.complete && el.naturalWidth > 0),
            ).toBe(true);
            const frame = await media.boundingBox();
            const pixels = await img.boundingBox();
            expect(Math.abs(frame.width - frame.height)).toBeLessThan(1);
            expect(Math.abs(pixels.width - frame.width)).toBeLessThan(1);
            expect(Math.abs(pixels.height - frame.height)).toBeLessThan(1);
            expect(frame.width).toBeGreaterThan(100);
            expect(frame.width).toBeLessThanOrEqual(245);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            if (mode === 'composed') {
              await expect(media).toHaveAttribute(
                'href',
                '/lab/images/portrait.svg',
              );
              await media.focus();
              await expect(media).toBeFocused();
              const caption = figure.locator('figcaption');
              await expect(caption).toContainText(
                locale === 'pt'
                  ? 'Ilustração fictícia'
                  : 'Fictional illustration',
              );
              await expect(
                caption.getByRole('link', { name: 'Credits' }),
              ).toBeVisible();
              expect((await caption.boundingBox()).y).toBeGreaterThanOrEqual(
                frame.y + frame.height,
              );
              await expectCenteredCaption(figure);
            }
            if (theme === 'lncc' && colorScheme === 'light' && locale === 'pt')
              await page.screenshot({
                path: `.test-output/portraits-${mode}-${kind}-${width}.png`,
                fullPage: true,
              });
          }
          if (mode === 'composed') {
            await page.goto(`${origin}/lab/figures/`);
            const figures = page.locator('main figure.sp-figure');
            await expect(figures).toHaveCount(3);
            for (const figure of await figures.all())
              await expectCenteredCaption(figure);
          }
        }
        if (mode === 'composed') {
          await page.goto(`${origin}/lab/rectangle/`);
          const figure = page.locator('main .sp-figure');
          await expect(figure).not.toHaveClass(/sp-figure-circle/);
          const img = figure.locator('img');
          await expect(img).toHaveCSS('object-fit', 'contain');
          const box = await img.boundingBox();
          expect(box.width / box.height).toBeCloseTo(240 / 300, 2);
          await page.goto(`${origin}/lab/no-photo/`);
          await expect(page.locator('main .sp-figure')).toHaveCount(0);
          await expect(
            page.getByRole('heading', {
              name: 'Example Researcher',
              exact: true,
            }),
          ).toBeVisible();
          await page.goto(`${origin}/lab/viewbox/`);
          const svg = page.locator('main .sp-figure-media > svg');
          await expect(svg).toHaveAttribute('viewBox', '0 0 240 300');
          await expect(svg).toHaveAttribute(
            'preserveAspectRatio',
            'xMidYMid slice',
          );
          const crop = await svg.boundingBox();
          expect(Math.abs(crop.width - crop.height)).toBeLessThan(1);
        }
        expect(failures).toEqual([]);
      });
    }
  }
}
