import { test, expect } from '@playwright/test';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { appearanceVariants } from '../fixtures/appearance.mjs';
import { PALETTES } from '../../dist/appearance.js';

const origin = 'https://appearance.example';
const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const rgb = (hex) =>
  `rgb(${[1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

async function serve(page, variant) {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || !url.pathname.startsWith('/lab/')) {
      failures.push(url.href);
      return route.abort();
    }
    let file = join(
      resolve('.test-output/appearance', variant, 'dist'),
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

async function expectColors(page, variant, mode) {
  const expected = variant.expected[mode];
  await expect(page.locator('html')).toHaveCSS('color-scheme', mode);
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    rgb(expected.paper),
  );
  await expect(page.locator('.navigation a[aria-current="page"]')).toHaveCSS(
    'color',
    rgb(expected.accent),
  );
  const tokens = await page.locator('html').evaluate((element) => {
    const style = getComputedStyle(element);
    return Object.fromEntries(
      ['paper', 'accent', 'gradient-from', 'gradient-to'].map((name) => [
        name,
        style.getPropertyValue(`--${name}`).trim().toLowerCase(),
      ]),
    );
  });
  expect(tokens.paper).toBe(expected.paper);
  expect(tokens.accent).toBe(expected.accent);
  if (variant.appearance?.gradient) {
    const [from, to] = variant.appearance.gradient.colors;
    expect(tokens['gradient-from']).toBe(
      PALETTES[from][mode].accent.toLowerCase(),
    );
    expect(tokens['gradient-to']).toBe(PALETTES[to][mode].accent.toLowerCase());
  }
}

async function expectFonts(page, variant) {
  expect(
    await page
      .locator('body')
      .evaluate((element) => getComputedStyle(element).fontFamily),
  ).toContain(variant.expected.bodyFont);
  for (const heading of await page.locator('main h1').all())
    expect(
      await heading.evaluate((element) => getComputedStyle(element).fontFamily),
    ).toContain(variant.expected.headingFont);
}

async function expectGradients(page, variant, accessible = false) {
  const gradient = variant.appearance?.gradient;
  const heroes = page.locator('[data-appearance-hero]');
  expect(await heroes.count()).toBeGreaterThan(0);
  for (const hero of await heroes.all()) {
    const image = await hero.evaluate(
      (element) => getComputedStyle(element, '::before').backgroundImage,
    );
    if (gradient && gradient.targets.includes('hero') && !accessible)
      expect(image).toContain(
        gradient.style === 'linear' ? 'linear-gradient(' : 'radial-gradient(',
      );
    else expect(image).toBe('none');
  }
  for (const heading of await page.locator('[data-appearance-heading]').all()) {
    const paint = await heading.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        image: style.backgroundImage,
        color: style.color,
        fill: style.webkitTextFillColor,
      };
    });
    if (gradient && gradient.targets.includes('headings') && !accessible)
      expect(paint.image).toContain(
        gradient.style === 'linear' ? 'linear-gradient(' : 'radial-gradient(',
      );
    else {
      expect(paint.image).toBe('none');
      expect(paint.color).not.toMatch(/^(transparent|rgba\([^)]*, 0\))$/);
      expect(paint.fill).not.toMatch(/^(transparent|rgba\([^)]*, 0\))$/);
    }
  }
  await expect(page.locator('.site-header')).toHaveCSS(
    'background-image',
    'none',
  );
  await expect(page.locator('main')).toHaveCSS('background-image', 'none');
}

async function expectIconsAndTargets(page, variant) {
  const menu = page.locator('details.navigation');
  if ((await menu.getAttribute('open')) === null)
    await menu.locator(':scope > summary').click();
  const icon = menu.locator(
    'a[data-page="home"] > svg[data-icon="lucide:house"]',
  );
  const presentation = variant.appearance?.icons ?? {
    style: 'plain',
    weight: 'regular',
  };
  const stroke = await icon.evaluate((element) =>
    parseFloat(
      getComputedStyle(element.querySelector('[stroke-width]') ?? element)
        .strokeWidth,
    ),
  );
  expect(stroke).toBe(
    { light: 1.5, regular: 2, bold: 2.5 }[presentation.weight],
  );
  const paint = await icon.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      background: style.backgroundColor,
      padding: parseFloat(style.paddingLeft),
    };
  });
  if (presentation.style !== 'plain')
    expect(paint.color).toBe(rgb(variant.expected.light.accent));
  if (presentation.style === 'soft') {
    expect(paint.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(paint.padding).toBeGreaterThan(0);
  } else {
    expect(paint.background).toBe('rgba(0, 0, 0, 0)');
    expect(paint.padding).toBe(0);
  }

  // Flags and the author's multicolored logo are deliberately placed in the
  // same navigation, so an overly broad .ui-icon rule is observable here.
  for (const unaffected of await page
    .locator(
      '.ui-icon[data-icon^="circle-flags:"], .navigation a[data-page="brand"] > img.ui-icon, .theme-toggle .ui-icon',
    )
    .all()) {
    await expect(unaffected).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(unaffected).toHaveCSS('padding', '0px');
    await expect(unaffected).toHaveCSS('filter', 'none');
  }
  await expect(menu.locator('a[data-page="flag"] > svg')).toHaveAttribute(
    'data-icon',
    'circle-flags:br',
  );
  await expect(menu.locator('a[data-page="brand"] > img')).toHaveAttribute(
    'src',
    '/lab/brand.svg',
  );
  for (const control of await page
    .locator('.navigation a[data-page]:visible, .theme-toggle')
    .all()) {
    const box = await control.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

async function expectNoOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

for (const variant of appearanceVariants) {
  for (const width of [1440, 390]) {
    test(`${variant.name} / ${width}: appearance renders and follows automatic and explicit themes`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: 'light' });
      const failures = await serve(page, variant.name);
      await page.goto(`${origin}/lab/`);
      await page.evaluate(() => document.fonts.ready);
      const html = page.locator('html');
      await expect(html).not.toHaveAttribute('data-theme');
      if (variant.appearance?.typography)
        await expect(html).toHaveAttribute(
          'data-typography',
          variant.appearance.typography,
        );
      if (variant.appearance?.icons)
        await expect(html).toHaveAttribute(
          'data-icon-style',
          variant.appearance.icons.style,
        );
      if (variant.appearance?.navigation)
        await expect(html).toHaveAttribute(
          'data-navigation-style',
          variant.appearance.navigation,
        );
      const glass =
        variant.appearance?.navigation === 'glass' &&
        (variant.layout?.navigation ??
          (variant.theme === 'lncc' ? 'sidebar' : 'top')) === 'top';
      await expect(page.locator('.site-navigation')).toHaveCSS(
        'position',
        glass ? 'sticky' : 'static',
      );
      if (!glass)
        await expect(page.locator('.navigation')).toHaveCSS(
          'backdrop-filter',
          'none',
        );
      const gradient = variant.appearance?.gradient;
      if (gradient) {
        await expect(html).toHaveAttribute('data-gradient', gradient.style);
        await expect(html).toHaveAttribute(
          'data-gradient-targets',
          gradient.targets.join(' '),
        );
      } else
        await expect(html).not.toHaveAttribute(
          'data-gradient',
          /linear|radial|mesh/,
        );
      await expectColors(page, variant, 'light');
      await expectFonts(page, variant);
      await expectGradients(page, variant);
      await expectIconsAndTargets(page, variant);
      await expectNoOverflow(page);

      // No stored preference: a light-only override must not leak into dark.
      await page.emulateMedia({ colorScheme: 'dark' });
      await expect(html).not.toHaveAttribute('data-theme');
      await expectColors(page, variant, 'dark');
      await expectGradients(page, variant);
      await page.locator('.theme-toggle').click();
      await expect(html).toHaveAttribute('data-theme', 'light');
      await expectColors(page, variant, 'light');
      await page.reload();
      await expectColors(page, variant, 'light');
      await page.locator('.theme-toggle').click();
      await page.emulateMedia({ colorScheme: 'light' });
      await expect(html).toHaveAttribute('data-theme', 'dark');
      await expectColors(page, variant, 'dark');

      await page.goto(`${origin}/lab/lesson/`);
      await expectFonts(page, variant);
      await expectGradients(page, variant);
      const bodyHeading = page.locator('.sciastro-document h1');
      await expect(bodyHeading).toHaveCount(1);
      await expect(bodyHeading).not.toHaveAttribute('data-appearance-heading');
      await expect(bodyHeading).toHaveCSS('background-image', 'none');
      expect(
        await bodyHeading.evaluate(
          (element) => getComputedStyle(element).webkitTextFillColor,
        ),
      ).not.toBe('rgba(0, 0, 0, 0)');
      await expect(page.locator('main h2').first()).toHaveCSS(
        'background-image',
        'none',
      );
      if (variant.appearance?.typography === 'technical')
        expect(
          await page
            .locator('.article-metadata')
            .evaluate((element) => getComputedStyle(element).fontFamily),
        ).toContain('monospace');
      await expectNoOverflow(page);
      expect(failures).toEqual([]);
    });
  }
}

for (const width of [1440, 390]) {
  test(`glass navigation / ${width}: sticky menu, native disclosure and reduced transparency`, async ({
    page,
  }) => {
    const variant = appearanceVariants.find(
      (item) => item.name === 'modern-mesh',
    );
    await page.setViewportSize({ width, height: 900 });
    const failures = await serve(page, variant.name);
    await page.goto(`${origin}/lab/lesson/`);
    await page.evaluate(() => document.fonts.ready);
    const navigation = page.locator('.site-navigation');
    const menu = page.locator('details.navigation');
    await expect(navigation).toHaveCSS('position', 'sticky');
    expect(
      await menu.evaluate(
        (element) => getComputedStyle(element).backdropFilter,
      ),
    ).toContain('blur(');
    await page.evaluate(() => scrollTo({ top: 450, behavior: 'instant' }));
    expect(await page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(449);
    await expect
      .poll(async () => (await navigation.boundingBox()).y)
      .toBeCloseTo(12, 0);
    if ((await menu.getAttribute('open')) === null)
      await menu.locator(':scope > summary').click();
    const toggle = menu.getByLabel('Subpáginas de Métodos', { exact: true });
    const branch = toggle.locator('..');
    if ((await branch.getAttribute('open')) !== null) await toggle.click();
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(branch).toHaveAttribute('open', '');
    await page.keyboard.press('Tab');
    const child = menu.locator('a[data-page="section"]');
    await expect(child).toBeFocused();
    await expect(child).toBeInViewport();
    await expectNoOverflow(page);
    await page.keyboard.press('Escape');
    await expect(branch).not.toHaveAttribute('open');
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Enter');
    await child.click();
    await expect(page).toHaveURL(`${origin}/lab/section/`);

    // Chromium exposes this accessibility preference through its media
    // emulation protocol even when Playwright's typed options omit it.
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
      });
      expect(
        await page.evaluate(
          () => matchMedia('(prefers-reduced-transparency: reduce)').matches,
        ),
      ).toBe(true);
      await expect(menu).toHaveCSS('backdrop-filter', 'none');
      await expect(menu).toHaveCSS(
        'background-color',
        rgb(PALETTES[variant.appearance.palette].light.surface),
      );
      await cdp.send('Emulation.setEmulatedMedia', { features: [] });
      await page.emulateMedia({ forcedColors: 'active' });
      await expect(menu).toHaveCSS('backdrop-filter', 'none');
      await expectNoOverflow(page);
    } finally {
      await cdp.detach();
    }
    expect(failures).toEqual([]);
  });
}

for (const variant of appearanceVariants.filter(
  (item) => item.appearance?.gradient,
)) {
  test(`${variant.name}: print and forced colors remove decorative gradients and keep text readable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const failures = await serve(page, variant.name);
    await page.goto(`${origin}/lab/`);
    await expectGradients(page, variant);
    await page.emulateMedia({ media: 'print' });
    await expectGradients(page, variant, true);
    await expect(page.locator('main h1').first()).toBeVisible();
    await page.emulateMedia({ media: 'screen', forcedColors: 'active' });
    await expectGradients(page, variant, true);
    const link = page.locator('.navigation a[data-page="home"]');
    await link.focus();
    await expect(link).toBeFocused();
    expect(
      await link.evaluate((element) => getComputedStyle(element).outlineStyle),
    ).not.toBe('none');
    await expectNoOverflow(page);
    expect(failures).toEqual([]);
  });
}
