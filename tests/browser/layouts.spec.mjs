import { test, expect } from '@playwright/test';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { layoutVariants } from '../fixtures/layouts.mjs';

const origin = 'https://layouts.example';
const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

async function serve(page, variant) {
  const failures = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || !url.pathname.startsWith('/lab/')) {
      failures.push(url.href);
      return route.abort();
    }
    let file = join(
      resolve('.test-output/layouts', variant, 'dist'),
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

async function expectNoOverflowOrDuplicateIds(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(
    await page.locator('[id]').evaluateAll((elements) => {
      const ids = elements.map((element) => element.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    }),
  ).toEqual([]);
}

for (const variant of layoutVariants) {
  for (const width of [1440, 900, 390]) {
    test(`${variant.name} / ${width}: layout, context and navigation depth`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const failures = await serve(page, variant.name);
      await page.goto(`${origin}/lab/curso/aula/`);
      const navigation =
        variant.layout?.navigation ??
        (variant.theme === 'lncc' ? 'sidebar' : 'top');
      const subnavigation = variant.layout?.subnavigation ?? 'inline';
      await expect(page.locator('html')).toHaveAttribute(
        'data-navigation',
        navigation,
      );
      await expect(page.locator('html')).toHaveAttribute(
        'data-subnavigation',
        subnavigation,
      );
      await expect(page.locator('html')).toHaveAttribute(
        'data-motion',
        variant.motion ?? 'none',
      );
      const menu = page.locator('.site-navigation');
      await expect(menu.locator('nav')).toHaveCount(1);
      await expect(menu.locator('a[data-page="course"]')).toHaveAttribute(
        'data-active-ancestor',
        'true',
      );
      await expect(menu.locator('a[data-page="appendix"]')).toHaveCount(0);
      await expect(menu.locator('a[data-page="lesson"]')).toHaveCount(
        variant.depth === 2 ? 1 : 0,
      );
      if (width >= 900 && navigation === 'sidebar') {
        const left = await menu.boundingBox();
        const main = await page.locator('main').boundingBox();
        expect(left.x + left.width).toBeLessThan(main.x);
      } else {
        const top = await menu.boundingBox();
        const main = await page.locator('main').boundingBox();
        expect(top.y + top.height).toBeLessThanOrEqual(main.y + 1);
      }
      await expect(page.locator('.article-toc')).toHaveCount(
        subnavigation === 'inline' ? 1 : 0,
      );
      await expect(page.locator('.page-context')).toHaveCount(
        subnavigation === 'right' ? 1 : 0,
      );
      await expect(
        page.getByRole('navigation', {
          name: 'Sumário da página',
          exact: true,
          includeHidden: true,
        }),
      ).toHaveCount(subnavigation === 'none' ? 0 : 1);
      if (subnavigation === 'right') {
        const context = page.locator('.page-context');
        await expect(
          context.getByRole('link', {
            name: 'Apêndice',
            exact: true,
            includeHidden: true,
          }),
        ).toHaveAttribute('href', '/lab/curso/aula/apendice/');
        await expect(
          context.getByRole('link', {
            name: 'Outro tópico',
            exact: true,
            includeHidden: true,
          }),
        ).toHaveAttribute('href', '/lab/curso/outro/');
        const wide = width >= 1100 && !variant.width;
        if (wide)
          await expect(context.locator('details')).toHaveAttribute('open', '');
        else
          await expect(context.locator('details')).not.toHaveAttribute('open');
        await expect(context).toHaveCSS('position', wide ? 'sticky' : 'static');
        const aside = await context.boundingBox();
        const content = await page.locator('.page-content').boundingBox();
        if (wide) {
          expect(aside.x).toBeGreaterThanOrEqual(content.x + content.width);
          await page.evaluate(() => scrollBy(0, 300));
          expect((await context.boundingBox()).y).toBeGreaterThanOrEqual(24);
          await page.evaluate(() => scrollTo(0, 0));
        } else {
          expect(aside.y + aside.height).toBeLessThanOrEqual(content.y + 1);
        }
      }
      await expectNoOverflowOrDuplicateIds(page);
      await page
        .getByRole('button', {
          name: /Ativar modo (claro|escuro)/,
        })
        .click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expectNoOverflowOrDuplicateIds(page);
      expect(failures).toEqual([]);
      if (
        ['sidebar-right', 'top-right'].includes(variant.name) &&
        width !== 900
      ) {
        await page.screenshot({
          path: `.test-output/layouts-${variant.name}-${width}.png`,
          fullPage: true,
        });
      }
    });
  }
}

test('top-right: contextual panel clears the menu divider and keeps its sticky inset while scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const failures = await serve(page, 'top-right');
  await page.goto(`${origin}/lab/curso/aula/`);
  await page.evaluate(() => document.fonts.ready);
  const context = page.locator('.page-context');
  await expect(context).toHaveCSS('position', 'sticky');
  await expect(context.locator('details')).toHaveAttribute('open', '');
  const menu = await page.locator('.site-navigation').boundingBox();
  const initial = await context.boundingBox();
  expect(
    initial.y - (menu.y + menu.height),
    'the panel needs breathing room below the horizontal menu divider',
  ).toBeGreaterThanOrEqual(20);

  // Use the real inset and the long lesson to enter the sticky interval,
  // without relying on header height or on the page's initial vertical offset.
  const inset = await context.evaluate((element) =>
    parseFloat(getComputedStyle(element).top),
  );
  const firstScroll = Math.ceil(initial.y - inset + 48);
  for (const target of [firstScroll, firstScroll + 48]) {
    await page.evaluate(
      (top) => scrollTo({ top, behavior: 'instant' }),
      target,
    );
    expect(
      await page.evaluate(() => scrollY),
      'the lesson must have enough content to exercise both scroll positions',
    ).toBeGreaterThanOrEqual(target - 1);
    await expect
      .poll(async () => Math.abs((await context.boundingBox()).y - inset))
      .toBeLessThan(1);
    const panel = await context.boundingBox();
    const header = await page.locator('.site-header').boundingBox();
    expect(
      panel.y - (header.y + header.height),
      'the sticky panel remains clear of the sticky header',
    ).toBeGreaterThanOrEqual(20);
    expect(panel.y + panel.height).toBeLessThanOrEqual(880);
    await expect(context.locator('summary')).toBeInViewport();
  }
  await expectNoOverflowOrDuplicateIds(page);
  expect(failures).toEqual([]);
});

test('top-right: contextual panel stays in natural mobile flow with space around its disclosure', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const failures = await serve(page, 'top-right');
  await page.goto(`${origin}/lab/curso/aula/`);
  await page.evaluate(() => document.fonts.ready);
  const context = page.locator('.page-context');
  const details = context.locator('details');
  const content = page.locator('.page-content');
  await expect(context).toHaveCSS('position', 'static');
  await expect(details).not.toHaveAttribute('open');
  const menu = await page.locator('.site-navigation').boundingBox();
  const closed = await context.boundingBox();
  expect(closed.y - (menu.y + menu.height)).toBeGreaterThanOrEqual(20);
  const contentBefore = await content.boundingBox();
  await details.locator(':scope > summary').click();
  await expect(details).toHaveAttribute('open', '');
  const expanded = await context.boundingBox();
  const contentAfter = await content.boundingBox();
  expect(expanded.height).toBeGreaterThan(closed.height);
  expect(contentAfter.y).toBeGreaterThan(contentBefore.y);
  expect(
    contentAfter.y - (expanded.y + expanded.height),
  ).toBeGreaterThanOrEqual(20);
  const initialScroll = await page.evaluate(() => scrollY);
  await page.evaluate(() => scrollBy({ top: 160, behavior: 'instant' }));
  const scrolled = await page.evaluate(() => scrollY);
  expect(scrolled - initialScroll).toBeGreaterThanOrEqual(159);
  expect(
    Math.abs(
      (await context.boundingBox()).y -
        (expanded.y - (scrolled - initialScroll)),
    ),
    'the mobile panel scrolls with the document instead of sticking',
  ).toBeLessThan(1);
  await expectNoOverflowOrDuplicateIds(page);
  expect(failures).toEqual([]);
});

test('context follows the page locale and respects toc:false and hidden parent branches', async ({
  page,
}) => {
  const failures = await serve(page, 'sidebar-right');
  await page.goto(`${origin}/lab/curso/aula/`);
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/lab/en/course/lesson/`);
  const context = page.locator('.page-context');
  await expect(
    context.getByRole('link', { name: 'Appendix', exact: true }),
  ).toHaveAttribute('href', '/lab/en/course/lesson/appendix/');
  await expect(
    context.getByRole('link', { name: 'Another topic', exact: true }),
  ).toHaveAttribute('href', '/lab/en/course/other/');
  await expect(
    context.getByRole('navigation', { name: 'Table of contents', exact: true }),
  ).toBeVisible();
  await page.goto(`${origin}/lab/curso/sem-sumario/`);
  await expect(
    page.getByRole('heading', { name: 'Ainda existe um título' }),
  ).toBeVisible();
  await expect(
    context.getByRole('navigation', { name: 'Sumário da página', exact: true }),
  ).toHaveCount(0);
  await expect(
    context.getByRole('link', { name: 'Uma aula', exact: true }),
  ).toBeVisible();
  await page.goto(`${origin}/lab/oculto/filho/`);
  await expect(context.locator('a[href^="/lab/"]')).toHaveCount(0);
  await expect(
    context.getByRole('link', { name: 'Private menu branch', exact: true }),
  ).toBeVisible();
  expect(failures).toEqual([]);
});

test('context preserves user toggles within a layout mode and focused links on resize', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const failures = await serve(page, 'sidebar-right');
  await page.goto(`${origin}/lab/curso/aula/`);
  const details = page.locator('.context-navigation');
  await expect(details).not.toHaveAttribute('open');
  await details.locator(':scope > summary').click();
  await page.setViewportSize({ width: 420, height: 844 });
  await expect(details).toHaveAttribute('open', '');
  await page.setViewportSize({ width: 1440, height: 900 });
  const link = details.getByRole('link', { name: 'Apêndice', exact: true });
  await link.focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(link).toBeVisible();
  await expect(link).toBeFocused();
  await expect(details).toHaveAttribute('open', '');
  await expectNoOverflowOrDuplicateIds(page);
  expect(failures).toEqual([]);
});

test.describe('native navigation without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  for (const variant of ['default-classic', 'sidebar-right', 'top-right']) {
    test(`${variant}: menus and contextual links remain usable on mobile`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const failures = await serve(page, variant);
      await page.goto(`${origin}/lab/curso/aula/`);
      const menu = page.locator('details.navigation');
      await expect(menu).toHaveAttribute('open', '');
      await menu.locator(':scope > summary').click();
      await expect(menu).not.toHaveAttribute('open');
      await page.keyboard.press('Enter');
      await expect(menu).toHaveAttribute('open', '');
      if (variant !== 'default-classic') {
        const details = page.locator('details.context-navigation');
        await details.locator(':scope > summary').click();
        await expect(details).not.toHaveAttribute('open');
        await page.keyboard.press('Enter');
        await expect(details).toHaveAttribute('open', '');
        await details
          .getByRole('link', { name: 'Apêndice', exact: true })
          .click();
        await expect(page).toHaveURL(`${origin}/lab/curso/aula/apendice/`);
      } else {
        await menu.getByRole('link', { name: 'Curso', exact: true }).click();
        await expect(page).toHaveURL(`${origin}/lab/curso/`);
      }
      await expectNoOverflowOrDuplicateIds(page);
      expect(failures).toEqual([]);
    });
  }
});

for (const variant of ['default-classic', 'sidebar-right', 'top-right']) {
  test(`${variant}: motion is opt-in and disabled by reduced motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const failures = await serve(page, variant);
    await page.goto(`${origin}/lab/`);
    const card = page.locator('.document-card');
    const link = card.getByRole('link', { name: 'Ler a aula', exact: true });
    await expect(card).toHaveCSS('transform', 'none');
    await link.hover();
    if (variant === 'default-classic') {
      await expect(card).toHaveCSS('transform', 'none');
    } else {
      await expect(card).not.toHaveCSS('transform', 'none');
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(card).toHaveCSS('transform', 'none');
    await expect(card).toHaveCSS('transition-duration', '0s');
    await page.mouse.move(0, 0);
    await page.keyboard.press('Tab');
    await link.focus();
    await expect(link).toBeFocused();
    expect(
      await link.evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe('none');
    await expect(card).toHaveCSS('transform', 'none');
    await expectNoOverflowOrDuplicateIds(page);
    expect(failures).toEqual([]);
  });
}

test('coarse touch pointers do not animate even when motion is enabled', async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    reducedMotion: 'no-preference',
  });
  try {
    const page = await context.newPage();
    const failures = await serve(page, 'top-right');
    await page.goto(`${origin}/lab/`);
    expect(
      await page.evaluate(() => matchMedia('(pointer: coarse)').matches),
    ).toBe(true);
    const card = page.locator('.document-card');
    await card.getByRole('link', { name: 'Ler a aula', exact: true }).hover();
    await expect(card).toHaveCSS('transform', 'none');
    await expect(card).toHaveCSS('transition-duration', '0s');
    expect(failures).toEqual([]);
  } finally {
    await context.close();
  }
});

for (const variant of ['sidebar-right', 'top-right', 'default-lncc']) {
  for (const width of [1440, 390]) {
    test(`${variant} / ${width}: readable menu scale and distinct keyboard/touch targets`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const failures = await serve(page, variant);
      await page.goto(`${origin}/lab/curso/aula/`);
      const menu = page.locator('details.navigation');
      if (width < 760) await menu.locator(':scope > summary').click();
      await expect(
        menu.locator('[role="menu"], [role="menuitem"]'),
      ).toHaveCount(0);
      for (const link of await menu.locator('a:visible').all()) {
        await expect(link).toHaveCSS('font-size', '14px');
        const box = await link.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
        if (await link.locator('.ui-icon').count()) {
          await expect(link.locator('.ui-icon')).toHaveCSS('width', '18px');
          await expect(link.locator('.ui-icon')).toHaveCSS('height', '18px');
        }
      }
      const toggle = menu.getByLabel('Subpáginas de Curso', { exact: true });
      if (await toggle.count()) {
        const branch = menu.locator(
          '.navigation-tree > .navigation-item > .navigation-branch',
        );
        if ((await branch.getAttribute('open')) !== null) await toggle.click();
        await toggle.hover();
        await expect(branch).not.toHaveAttribute('open');
        await toggle.focus();
        await page.keyboard.press('Enter');
        await expect(branch).toHaveAttribute('open', '');
        const parent = await menu
          .locator('a[data-page="course"]')
          .boundingBox();
        const control = await toggle.boundingBox();
        expect(control.width).toBe(44);
        expect(control.height).toBe(44);
        expect(parent.x + parent.width).toBeLessThanOrEqual(control.x + 1);
        await page.keyboard.press('Tab');
        await expect(menu.locator('a[data-page="lesson"]')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(branch).not.toHaveAttribute('open');
        await expect(toggle).toBeFocused();
        if (variant === 'top-right' && width >= 760) {
          await page.keyboard.press('Enter');
          await page.locator('h1').click();
          await expect(branch).not.toHaveAttribute('open');
          await toggle.click();
          await page.locator('.theme-toggle').focus();
          await expect(branch).not.toHaveAttribute('open');
        }
        await toggle.click();
        const child = menu.locator('a[data-page="lesson"]');
        await expect(child).toBeVisible();
        expect((await child.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
      await expectNoOverflowOrDuplicateIds(page);
      await page.screenshot({
        path: `.test-output/menu-${variant}-${width}-light.png`,
      });
      await page
        .getByRole('button', {
          name: /Ativar modo (claro|escuro)/,
        })
        .click();
      if (variant === 'top-right' && width >= 760) await toggle.click();
      await page.screenshot({
        path: `.test-output/menu-${variant}-${width}-dark.png`,
      });
      await page.emulateMedia({ forcedColors: 'active' });
      const current = menu.locator('a[data-active-ancestor]').first();
      await expect(current).toHaveCSS('outline-style', 'solid');
      await page.keyboard.press('Tab');
      await current.focus();
      await expect(current).toHaveCSS('outline-width', '2px');
      await expect(current).toHaveCSS('outline-offset', '2px');
      await expectNoOverflowOrDuplicateIds(page);
      expect(failures).toEqual([]);
    });
  }
}

for (const javaScriptEnabled of [true, false]) {
  test.describe(`multiline navigation rows / ${javaScriptEnabled ? 'JavaScript' : 'no JavaScript'}`, () => {
    test.use({ javaScriptEnabled });
    for (const variant of ['sidebar-right', 'top-right']) {
      for (const width of [1440, 390]) {
        test(`${variant} / ${width}: link and disclosure stay aligned in light/dark and open/closed states`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 900 });
          const failures = await serve(page, variant);
          await page.goto(`${origin}/lab/curso/aula/`);
          await page.evaluate(() => document.fonts.ready);
          const menu = page.locator('details.navigation');
          if ((await menu.getAttribute('open')) === null)
            await menu.locator(':scope > summary').click();
          const link = menu.locator('a[data-page="course"]');
          const branch = menu.locator(
            '.navigation-tree > .navigation-item > .navigation-branch',
          );
          const toggle = branch.locator(':scope > summary');
          const label = 'Notícias e notas sobre métodos numéricos e aplicações';
          // This fixture changes only the label and available width. The real
          // component, native disclosure and stylesheet stay under test.
          await link
            .locator('span')
            .last()
            .evaluate((element, text) => {
              element.textContent = text;
            }, label);
          await link.evaluate((element) => {
            element.closest('.navigation-item').style.maxWidth = '240px';
          });
          await toggle.evaluate((element, text) => {
            element.setAttribute('aria-label', `Subpáginas de ${text}`);
          }, label);
          for (const colorScheme of ['light', 'dark']) {
            await page.emulateMedia({ colorScheme });
            await expect(page.locator('html')).toHaveCSS(
              'color-scheme',
              colorScheme,
            );
            if ((await branch.getAttribute('open')) !== null)
              await toggle.click();
            for (const open of [false, true]) {
              if (open) {
                await toggle.focus();
                await page.keyboard.press('Enter');
                await expect(branch).toHaveAttribute('open', '');
              } else {
                await expect(branch).not.toHaveAttribute('open');
              }
              const row = await link.boundingBox();
              const control = await toggle.boundingBox();
              expect(
                row.height,
                'the fixture must wrap onto multiple lines',
              ).toBeGreaterThan(44);
              expect(control.width).toBeGreaterThanOrEqual(44);
              expect(control.height).toBeGreaterThanOrEqual(44);
              expect(
                Math.abs(row.y - control.y),
                'link and disclosure share the row top',
              ).toBeLessThan(1);
              expect(
                Math.abs(row.height - control.height),
                'the disclosure follows the link height, excluding expanded children',
              ).toBeLessThan(1);
              expect(
                row.x + row.width,
                'separate actions must not overlap',
              ).toBeLessThanOrEqual(control.x + 1);
              await expect(link).toHaveAttribute('href', '/lab/curso/');
              await expectNoOverflowOrDuplicateIds(page);
            }
            await page.keyboard.press('Tab');
            await expect(menu.locator('a[data-page="lesson"]')).toBeFocused();
            if (javaScriptEnabled) {
              await page.keyboard.press('Escape');
              await expect(toggle).toBeFocused();
            } else {
              await toggle.focus();
              await page.keyboard.press('Enter');
            }
            await expect(branch).not.toHaveAttribute('open');
          }
          // The label still navigates independently; it is not part of the
          // disclosure's activation area even when its text wraps.
          await link.click();
          await expect(page).toHaveURL(`${origin}/lab/curso/`);
          expect(failures).toEqual([]);
        });
      }
    }
  });
}
