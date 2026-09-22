import { checkDefaultBranding } from './branding.mjs';
import { test as base, expect } from '@playwright/test';

// A separate browser context per test avoids leaking language/theme preferences.
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(page);
    expect(errors, 'Unhandled JavaScript errors').toEqual([]);
  },
});

async function openMenu(page, testInfo) {
  if (testInfo.project.metadata.mobile)
    await page.locator('.navigation > summary').click();
  return page.getByRole('navigation', { name: 'Navegação principal' });
}

test('menu has accessible names, decorative icons and BR/GB language flags', async ({
  page,
}, testInfo) => {
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  const group = testInfo.project.metadata.kind === 'group';
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    group ? 'Grupo Horizonte' : 'Ana Silva',
  );
  const menu = await openMenu(page, testInfo);
  const links = menu.getByRole('link');
  await expect(links).toHaveCount(6);
  await expect(
    menu.getByRole('link', { name: group ? 'Início' : 'Sobre', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  for (const link of await links.all()) {
    await expect(link).toBeVisible();
    await expect(link.locator('.ui-icon')).toBeVisible();
    await expect(link.locator('.ui-icon')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  }
  await expect(
    page.getByRole('link', { name: 'Português', exact: true }).locator('svg'),
  ).toHaveAttribute('data-icon', 'circle-flags:br');
  await expect(
    page.getByRole('link', { name: 'English', exact: true }).locator('svg'),
  ).toHaveAttribute('data-icon', 'circle-flags:gb');
  expect(
    requests.every((url) => new URL(url).origin === new URL(page.url()).origin),
    'Icons and page assets should be served locally',
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('research cards and citations navigate to their corresponding sections', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('link', { name: /Métodos numéricos Discretização/ })
    .click();
  await expect(page).toHaveURL(/\/pesquisa\/#numerical-methods$/);
  await expect(page.locator('#numerical-methods')).toBeInViewport();
  const citation = page.locator('a[role="doc-biblioref"]').first();
  const reference = await citation.getAttribute('href');
  expect(reference).toMatch(/^#ref-[a-f0-9]+$/);
  await citation.click();
  await expect(page.locator(reference)).toBeInViewport();
  expect(new URL(page.url()).hash).toBe(reference);
  await expect(page.locator(reference)).toContainText('2025');
});

test('language switch preserves the page and updates the active navigation', async ({
  page,
}, testInfo) => {
  await page.goto('/pesquisa/');
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/research\/$/);
  await expect(
    page.getByRole('heading', { name: 'Research', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'English', exact: true }),
  ).toHaveAttribute('aria-current', 'true');
  if (testInfo.project.metadata.mobile)
    await page.locator('.navigation > summary').click();
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Research', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'Português', exact: true }).click();
  await expect(page).toHaveURL(/\/pesquisa\/$/);
  await expect(
    page.getByRole('heading', { name: 'Pesquisa', exact: true }),
  ).toBeVisible();
});

test('theme follows the system until a saved choice persists across navigation and reload', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const toggle = page.getByRole('button', {
    name: 'Alternar modo claro e escuro',
  });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const darkBackground = await page
    .locator('body')
    .evaluate((body) => getComputedStyle(body).backgroundColor);
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(
    await page
      .locator('body')
      .evaluate((body) => getComputedStyle(body).backgroundColor),
  ).not.toBe(darkBackground);
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.goto('/equipe/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await toggle.click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('menu works with a keyboard and team separates active levels from alumni', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  const group = testInfo.project.metadata.kind === 'group';
  if (testInfo.project.metadata.mobile) {
    const summary = page.locator('.navigation > summary');
    await expect(page.locator('.navigation')).not.toHaveAttribute('open', '');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.navigation')).toHaveAttribute('open', '');
  }
  const team = page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: group ? 'Equipe' : 'Orientações', exact: true });
  await team.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/equipe\/$/);
  await expect(page.locator('#level-undergraduate')).toContainText(
    'Clara Santos',
  );
  await expect(page.locator('#level-masters')).toContainText('Pedro Lima');
  await expect(page.locator('#level-phd')).toContainText('Beatriz Souza');
  await expect(page.locator('#students')).not.toContainText('Rafael Alves');
  await expect(page.locator('#alumni')).toContainText('Rafael Alves');
  await expect(page.locator('#faculty .member-card')).toHaveCount(
    group ? 2 : 0,
  );
});

test('missing routes show a useful 404 with a working home link', async ({
  page,
}) => {
  const response = await page.goto('/missing-page/');
  expect(response.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'Página não encontrada' }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Voltar ao início/ }).click();
  await expect(page.locator('.home-introduction')).toBeVisible();
});

test('people use circular portraits, per-person symbols and site or built-in fallbacks', async ({
  page,
}, testInfo) => {
  const group = testInfo.project.metadata.kind === 'group';
  await page.goto('/equipe/');
  const portrait = page.locator('#member-clara-santos .avatar-photo');
  await expect(portrait).toHaveCSS('border-radius', '50%');
  await expect(portrait).toHaveCSS('overflow', 'hidden');
  const photo = portrait.locator('img');
  await expect(photo).toHaveAttribute('src', '/images/fictional-portrait.svg');
  await expect(photo).toHaveAttribute(
    'alt',
    'Ilustração fictícia de Clara Santos',
  );
  await expect(photo).toHaveCSS('object-fit', 'cover');
  await expect(photo).toHaveCSS('object-position', '50% 35%');
  await expect
    .poll(() => photo.evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  const size = await portrait.boundingBox();
  expect(size.width).toBe(size.height);

  // This member overrides the shared fallback, including a symbol-only crop.
  const personal = page.locator('#member-beatriz-souza .avatar-fallback');
  await personal.scrollIntoViewIfNeeded();
  await expect(personal.locator('svg')).toHaveAttribute('viewBox', '5 5 54 54');
  await expect(personal.locator('svg image')).toHaveAttribute(
    'href',
    '/images/academic-symbol.svg',
  );
  await expect(personal.locator('svg')).toHaveAttribute(
    'aria-label',
    'Símbolo acadêmico fictício',
  );

  // Both active and former students, as well as faculty, use the same renderer.
  for (const id of [
    'pedro-lima',
    'rafael-alves',
    ...(group ? ['ana-silva', 'lucas-costa'] : []),
  ]) {
    const fallback = page.locator(`#member-${id} .avatar-fallback`);
    await fallback.scrollIntoViewIfNeeded();
    await expect(fallback).toHaveCSS('border-radius', '50%');
    await expect(fallback).toHaveText('');
    if (group) {
      await expect(fallback.locator('img')).toHaveAttribute(
        'src',
        '/images/academic-symbol.svg',
      );
      await expect(fallback.locator('img')).toHaveCSS('object-fit', 'contain');
      await expect(fallback.locator('img')).toHaveJSProperty('complete', true);
      expect(
        await fallback.locator('img').evaluate((image) => image.naturalWidth),
      ).toBeGreaterThan(0);
    } else {
      await expect(fallback.locator('svg')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
      await expect(fallback.locator('svg text, img')).toHaveCount(0);
    }
  }
  await page
    .getByRole('button', { name: 'Alternar modo claro e escuro' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(
    page.locator('#member-rafael-alves .avatar-fallback'),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.goto('/en/team/');
  await expect(
    page.locator('#member-clara-santos .avatar-photo img'),
  ).toHaveAttribute('alt', 'Fictional illustration of Clara Santos');
  await expect(
    page.locator('#member-beatriz-souza .avatar-fallback svg'),
  ).toHaveAttribute('aria-label', 'Fictional academic symbol');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('navigation, icons, citations and language links remain usable', async ({
    page,
  }) => {
    await page.goto('/');
    // Native details is open by default; no client script is needed to navigate.
    const menu = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(
      menu
        .getByRole('link', { name: 'Pesquisa', exact: true })
        .locator('.ui-icon'),
    ).toBeVisible();
    await expect(page.locator('.theme-toggle')).toBeHidden();
    await menu.getByRole('link', { name: 'Pesquisa', exact: true }).click();
    const citation = page.locator('a[role="doc-biblioref"]').first();
    const target = await citation.getAttribute('href');
    await citation.click();
    await expect(page.locator(target)).toBeInViewport();
    await page.getByRole('link', { name: 'English', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/research\/$/);
    await expect(
      page
        .getByRole('link', { name: 'English', exact: true })
        .locator('.ui-icon'),
    ).toBeVisible();
  });

  test('portraits and fallback symbols render without JavaScript', async ({
    page,
  }, testInfo) => {
    await page.goto('/equipe/');
    const portrait = page.locator('#member-clara-santos .avatar-photo img');
    await expect(portrait).toBeVisible();
    await expect
      .poll(() => portrait.evaluate((image) => image.naturalWidth))
      .toBeGreaterThan(0);
    const fallback = page.locator('#member-pedro-lima .avatar-fallback');
    await fallback.scrollIntoViewIfNeeded();
    await expect(
      fallback.locator(
        testInfo.project.metadata.kind === 'group' ? 'img' : 'svg',
      ),
    ).toBeVisible();
    await expect(fallback).toHaveText('');
  });
});

test('default branding follows the theme and keeps the footer credit accessible', async ({
  page,
}) => {
  await checkDefaultBranding(page);
});
