import { test, expect } from '@playwright/test';

const sites = [
  { name: 'group / classic', port: 4360, english: true },
  { name: 'individual / modern', port: 4361, english: true },
  { name: 'individual / LNCC', port: 4362, english: true },
  { name: 'course / modern', port: 4364, english: false },
];

async function expectAction(page, dark, english = false) {
  const button = page.locator('.theme-toggle');
  const label = english
    ? `Switch to ${dark ? 'light' : 'dark'} mode`
    : `Ativar modo ${dark ? 'claro' : 'escuro'}`;
  await expect(button).toHaveAccessibleName(label);
  await expect(button).toHaveAttribute('title', label);
  // An action button changes its name with its next action. It is not an
  // aria-pressed toggle, whose accessible name would have to stay stable.
  await expect(button).not.toHaveAttribute('aria-pressed');
  await expect(
    button.locator(`[data-icon="lucide:${dark ? 'sun' : 'moon'}"]`),
  ).toBeVisible();
  await expect(
    button.locator(`[data-icon="lucide:${dark ? 'moon' : 'sun'}"]`),
  ).toBeHidden();
  await expect(button.locator('svg')).toHaveCount(2);
  for (const icon of await button.locator('svg').all())
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
}

async function expectCenteredIcon(page) {
  const geometry = await page.locator('.theme-toggle').evaluate((button) => {
    const icon = [...button.querySelectorAll('svg')].find(
      (svg) => getComputedStyle(svg).display !== 'none',
    );
    const control = button.getBoundingClientRect();
    const bounds = icon.getBBox();
    const point = new DOMPoint(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    ).matrixTransform(icon.getScreenCTM());
    const box = icon.getBoundingClientRect();
    return {
      width: control.width,
      height: control.height,
      visualOffsetX: point.x - (control.x + control.width / 2),
      visualOffsetY: point.y - (control.y + control.height / 2),
      boxOffsetX: box.x + box.width / 2 - (control.x + control.width / 2),
      boxOffsetY: box.y + box.height / 2 - (control.y + control.height / 2),
    };
  });
  expect(geometry.width).toBeGreaterThanOrEqual(44);
  expect(geometry.height).toBeGreaterThanOrEqual(44);
  for (const key of [
    'visualOffsetX',
    'visualOffsetY',
    'boxOffsetX',
    'boxOffsetY',
  ])
    expect(
      Math.abs(geometry[key]),
      `${key}: SVG centered in control`,
    ).toBeLessThan(0.75);
}

for (const site of sites) {
  for (const width of [1280, 390]) {
    test(`${site.name}: theme action, icon centering and persistence at ${width}px`, async ({
      page,
    }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: 'light' });
      const url = `http://127.0.0.1:${site.port}`;
      await page.goto(`${url}/`);
      await expectAction(page, false);
      await expectCenteredIcon(page);
      await page.locator('.theme-toggle').hover();
      await expectCenteredIcon(page);

      // An unset preference continues to follow live system changes.
      await page.emulateMedia({ colorScheme: 'dark' });
      await expectAction(page, true);
      await expectCenteredIcon(page);
      await page.locator('.theme-toggle').focus();
      await expect(page.locator('.theme-toggle')).toBeFocused();
      await page.keyboard.press('Space');
      await expectAction(page, false);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expectCenteredIcon(page);

      // Explicit light wins over the dark system, including a localized page.
      await page.reload();
      await expectAction(page, false);
      if (site.english) await page.goto(`${url}/en/`);
      await expectAction(page, false, site.english);
      await page.locator('.theme-toggle').click();
      await expectAction(page, true, site.english);
      await page.reload();
      await expectAction(page, true, site.english);
      await expectCenteredIcon(page);
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
}

test('course hides the unavailable theme action without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4364/');
    await expect(page.locator('.theme-toggle')).toBeHidden();
  } finally {
    await context.close();
  }
});
