import { expect } from '@playwright/test';

// Exercise each example theme and viewport through the existing project matrix.
export async function checkDefaultBranding(page) {
  const colors = [];
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    const mark = page.locator('.identity > .brand-mark');
    await expect(mark).toBeVisible();
    await expect(mark).toHaveAttribute('viewBox', '0 0 400 320');
    await expect(mark).toHaveAttribute('aria-hidden', 'true');
    await expect(mark).toHaveAttribute('focusable', 'false');
    await expect(mark.locator('path')).toHaveCount(2);
    await expect(page.locator('.identity').getByRole('img')).toHaveCount(0);
    const color = await mark.evaluate((svg) => getComputedStyle(svg).color);
    colors.push(color);
    for (const path of await mark.locator('path').all())
      await expect(path).toHaveCSS('fill', color);

    const credit = page.locator('.footer-brand');
    await expect(credit).toHaveCount(1);
    await expect(credit).toHaveAccessibleName('Feito com SciAstro');
    await expect(credit).toHaveAttribute(
      'href',
      'https://github.com/volpatto/sciastro',
    );
    const footerMark = credit.locator('svg');
    await expect(footerMark).toBeVisible();
    await expect(footerMark).toHaveAttribute('aria-hidden', 'true');
    await expect(footerMark).toHaveAttribute('focusable', 'false');
    const creditColor = await credit.evaluate(
      (link) => getComputedStyle(link).color,
    );
    for (const path of await footerMark.locator('path').all())
      await expect(path).toHaveCSS('fill', creditColor);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    colors[0],
    'The fallback follows the theme instead of a fixed brand color',
  ).not.toBe(colors[1]);
}
