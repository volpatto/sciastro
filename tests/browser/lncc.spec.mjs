import { test, expect } from '@playwright/test';

test('LNCC Theme composes a profile, cards, local extension and sidebar', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-design', 'lncc');
  expect(
    await page
      .locator('html')
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue('--content-width').trim(),
      ),
  ).toBe('1140px');
  expect(
    await page
      .locator('html')
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue('--accent').trim(),
      ),
  ).toBe('#6250a6');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Marina Silva',
  );
  await expect(page.locator('[data-custom-component]')).toContainText(
    'Uma extensão local',
  );
  await expect(page.locator('.project-note')).toHaveCSS(
    'border-top-style',
    'dashed',
  );
  if (info.project.metadata.mobile)
    await page.locator('.navigation summary').click();
  await expect(page.locator('.navigation nav a')).toHaveCount(3);
  await page.locator('.navigation a[data-page="research"]').click();
  await expect(page).toHaveURL(/\/linhas\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pesquisa');
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/topics\/$/);
  const citation = page.locator('[role="doc-biblioref"]').first();
  const href = await citation.getAttribute('href');
  await expect(page.locator(href)).toHaveCount(1);
});

test('custom routes, metadata and assets remain local with no layout overflow', async ({
  page,
}) => {
  const errors = [];
  const failed = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  for (const path of ['/', '/en/', '/linhas/', '/software/', '/creditos/']) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(await page.locator('h1').count()).toBe(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://example.org' + path,
    );
  }
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test('dark preference persists and the mobile menu closes with Escape', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.locator('.theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await page
      .locator('html')
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue('--accent').trim(),
      ),
  ).toBe('#c2b6fa');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  if (info.project.metadata.mobile) {
    await page.locator('.navigation summary').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.navigation')).not.toHaveAttribute('open', '');
    await expect(page.locator('.navigation summary')).toBeFocused();
  }
});

test('LNCC navigation and composed pages remain usable without JavaScript', async ({
  browser,
  baseURL,
}, info) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: info.project.use.viewport,
  });
  try {
    const page = await context.newPage();
    await page.goto(baseURL);
    await expect(
      page.locator('.navigation a[data-page="research"]'),
    ).toBeVisible();
    await page.locator('.navigation a[data-page="research"]').click();
    await expect(
      page.getByRole('heading', { name: 'Simulação científica', exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
