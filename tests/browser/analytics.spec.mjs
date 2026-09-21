import { test, expect } from '@playwright/test';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';

const origin = 'https://academic.example';
const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

async function serve(page, kind, { fail = false, reject = false } = {}) {
  const events = [],
    trackers = [],
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Intercept every request: tests never contact an analytics service or external site.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'stats.example' && url.pathname === '/api/send') {
      events.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }
    if (
      url.hostname === 'stats.example' ||
      url.hostname === 'static.cloudflareinsights.com'
    ) {
      trackers.push(url.href);
      if (fail) return route.abort();
      return route.fulfill({
        contentType: 'text/javascript',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body:
          url.hostname === 'stats.example'
            ? `
          window.umami = { track: (name, data = {}) => ${
            reject
              ? 'Promise.reject(new Error("Tracker unavailable"))'
              : `fetch('https://stats.example/api/send', {
            method: 'POST', body: JSON.stringify({ name: name || 'pageview', path: location.pathname, ...data }), keepalive: true
          })`
          } };
          ${reject ? '' : 'window.umami.track();'}
        `
            : 'window.cloudflareLoaded = true;',
      });
    }
    const local = [
      origin,
      'https://preview.example',
      'http://127.0.0.1:4321',
    ].includes(url.origin);
    if (!local)
      return route.fulfill({
        contentType: 'text/html',
        body: '<h1>External destination</h1>',
      });
    const root = resolve('.test-output/analytics', kind, 'dist');
    let file = join(root, url.pathname.replace(/^\/lab\/?/, ''));
    const entry = await stat(file).catch(() => undefined);
    if (entry?.isDirectory()) file = join(file, 'index.html');
    if (!entry) file = join(root, 'index.html'); // Also exercise copied pages outside base.
    return route.fulfill({
      contentType: mime[extname(file)] ?? 'application/octet-stream',
      body: await readFile(file),
    });
  });
  return { events, trackers, errors };
}

test('disabled analytics never loads a remote tracker', async ({ page }) => {
  const state = await serve(page, 'disabled');
  await page.goto(origin + '/lab/');
  await page.getByRole('link', { name: 'English page', exact: true }).click();
  expect(state.trackers).toEqual([]);
  expect(state.events).toEqual([]);
});

test('Cloudflare is injected once with its token on both language pages', async ({
  page,
}) => {
  const state = await serve(page, 'cloudflare');
  for (const path of ['/lab/', '/lab/en/']) {
    await page.goto(origin + path);
    await expect(
      page.locator('script[data-sciastro-analytics="cloudflare"]'),
    ).toHaveCount(1);
    await expect(page.locator('script[data-cf-beacon]')).toHaveAttribute(
      'data-cf-beacon',
      '{"token":"0123456789abcdef0123456789abcdef"}',
    );
    await expect
      .poll(() => page.evaluate(() => window.cloudflareLoaded))
      .toBe(true);
  }
  expect(state.trackers).toHaveLength(2);
  expect(state.errors).toEqual([]);
});

for (const kind of ['umami', 'cloudflare']) {
  test(`${kind}: localhost, foreign origins, paths outside base and DNT make no tracker requests`, async ({
    browser,
  }) => {
    for (const [url, dnt] of [
      ['http://127.0.0.1:4321/lab/', false],
      ['https://preview.example/lab/', false],
      [origin + '/laboratory/', false],
      [origin + '/lab/', true],
    ]) {
      const context = await browser.newContext();
      try {
        if (dnt)
          await context.addInitScript(() =>
            Object.defineProperty(navigator, 'doNotTrack', { value: '1' }),
          );
        const page = await context.newPage();
        const state = await serve(page, kind);
        await page.goto(url);
        expect(state.trackers).toEqual([]);
        expect(state.events).toEqual([]);
        await expect(
          page.locator('script[data-sciastro-analytics]'),
        ).toHaveCount(0);
        expect(state.errors).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });
}

test('Umami records one pageview per document, and a single event per click with safe metadata', async ({
  page,
}) => {
  const state = await serve(page, 'umami');
  await page.goto(origin + '/lab/?private=hidden#anchor');
  await expect.poll(() => state.events.length).toBe(1);
  const script = page.locator('script[data-sciastro-analytics="umami"]');
  await expect(script).toHaveAttribute(
    'data-website-id',
    '94db1cb1-74f4-4a40-ad6c-962362670409',
  );
  await expect(script).toHaveAttribute('data-exclude-search', 'true');
  await expect(script).toHaveAttribute('data-exclude-hash', 'true');
  await expect(script).toHaveAttribute('data-do-not-track', 'true');
  for (const [label, name] of [
    ['CV', 'cv_download'],
    ['File', 'file_download'],
  ]) {
    const downloaded = page.waitForEvent('download');
    await page.getByRole('link', { name: label, exact: true }).click();
    await downloaded;
    await expect
      .poll(() => state.events.filter((e) => e.name === name).length)
      .toBe(1);
  }
  await page.getByRole('link', { name: 'English page', exact: true }).click();
  await expect(page).toHaveURL(origin + '/lab/en/');
  await expect
    .poll(() => state.events.filter((e) => e.name === 'pageview').length)
    .toBe(2);
  await page.getByRole('link', { name: 'GitHub', exact: true }).click();
  await expect(page).toHaveURL(/github.com/);
  await expect
    .poll(() => state.events.filter((e) => e.name === 'external_link').length)
    .toBe(1);
  expect(state.events.find((e) => e.name === 'external_link')).toEqual({
    name: 'external_link',
    path: '/lab/en/',
    locale: 'en',
    url: 'https://github.com/example',
  });
  expect(JSON.stringify(state.events)).not.toMatch(
    /secret|private|hidden|anchor/,
  );
  expect(state.errors).toEqual([]);
});

test('Markdown links and linked logos use the same event handler', async ({
  page,
}) => {
  const state = await serve(page, 'umami');
  await page.goto(origin + '/lab/');
  await expect.poll(() => state.events.length).toBe(1);
  await page.getByRole('link', { name: 'Markdown DOI' }).click();
  await expect
    .poll(() =>
      state.events.some((e) => e.url === 'https://doi.org/10.1234/example'),
    )
    .toBe(true);
  await page.goto(origin + '/lab/');
  await expect
    .poll(() => state.events.filter((e) => e.name === 'pageview').length)
    .toBe(2);
  await page.locator('[data-sciastro-event="institution"]').click();
  await expect
    .poll(() => state.events.filter((e) => e.name === 'institution').length)
    .toBe(1);
});

test('per-link opt-out survives rendering in section and profile links', async ({
  page,
}) => {
  const state = await serve(page, 'umami');
  for (const label of ['Ignored', 'Ignored profile']) {
    await page.goto(origin + '/lab/');
    await expect(
      page.getByRole('link', { name: label, exact: true }),
    ).toHaveAttribute('data-sciastro-event', 'false');
    await expect
      .poll(() => state.events.filter((e) => e.name === 'pageview').length)
      .toBe(label === 'Ignored' ? 1 : 2);
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(/github.com/);
  }
  expect(state.events.every((e) => e.name === 'pageview')).toBe(true);
});

test('events remain opt-in while pageviews work with built-in and custom layouts', async ({
  page,
}) => {
  const state = await serve(page, 'pageviews-only');
  await page.goto(origin + '/lab/');
  await expect.poll(() => state.events.length).toBe(1);
  await page.getByRole('link', { name: 'GitHub', exact: true }).click();
  await expect(page).toHaveURL(/github.com/);
  expect(state.events).toHaveLength(1);
  await page.unrouteAll();
  const custom = await serve(page, 'custom-layout');
  await page.goto(origin + '/lab/');
  await expect(page).toHaveTitle('Custom layout');
  await expect.poll(() => custom.events.length).toBe(1);
});

for (const failure of ['blocked', 'rejected']) {
  test(`${failure} tracking cannot prevent navigation or downloads`, async ({
    page,
  }) => {
    const state = await serve(page, 'umami', {
      fail: failure === 'blocked',
      reject: failure === 'rejected',
    });
    await page.goto(origin + '/lab/');
    await expect.poll(() => state.trackers.length).toBe(1);
    const downloaded = page.waitForEvent('download');
    await page.getByRole('link', { name: 'CV', exact: true }).click();
    await downloaded;
    await page.getByRole('link', { name: 'English page', exact: true }).click();
    await expect(page).toHaveURL(origin + '/lab/en/');
    await page.getByRole('link', { name: 'GitHub', exact: true }).click();
    await expect(page).toHaveURL(/github.com/);
    expect(state.errors).toEqual([]);
  });
}
