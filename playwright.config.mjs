import { defineConfig } from '@playwright/test';

// Test the generated static sites, on ports separate from the user's previews.
const sites = [
  { kind: 'group', port: 4360 },
  { kind: 'individual', port: 4361 },
  { kind: 'lncc', port: 4362 },
  { kind: 'writing', port: 4363 },
  { kind: 'course', port: 4364 },
];

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.mjs',
  globalSetup: './tests/browser/prepare.mjs',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: '.test-output/browser',
  reporter: [
    ['list'],
    ['html', { outputFolder: '.test-output/playwright-report', open: 'never' }],
    ['junit', { outputFile: '.test-output/junit.xml' }],
  ],
  use: {
    browserName: 'chromium',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'social',
      testMatch: '**/social.spec.mjs',
      use: { javaScriptEnabled: false },
    },
    {
      name: 'portraits',
      testMatch: '**/portraits.spec.mjs',
      use: { javaScriptEnabled: false },
    },
    { name: 'analytics', testMatch: '**/analytics.spec.mjs' },
    { name: 'layouts', testMatch: '**/layouts.spec.mjs' },
    { name: 'appearance', testMatch: '**/appearance.spec.mjs' },
    { name: 'theme', testMatch: '**/theme.spec.mjs' },
    ...sites.flatMap(({ kind, port }) =>
      [
        { label: 'desktop', width: 1280, height: 800 },
        { label: 'mobile', width: 390, height: 844 },
      ].map(({ label, width, height }) => ({
        name: `${kind}-${label}`,
        testMatch:
          kind === 'course'
            ? '**/course.spec.mjs'
            : kind === 'writing'
              ? '**/writing.spec.mjs'
              : kind === 'lncc'
                ? '**/lncc.spec.mjs'
                : '**/site.spec.mjs',
        metadata: { kind, mobile: label === 'mobile' },
        use: {
          baseURL: `http://127.0.0.1:${port}`,
          viewport: { width, height },
        },
      })),
    ),
  ],
  webServer: sites.map(({ kind, port }) => ({
    command: `node tests/browser/server.mjs ${kind} ${port}`,
    url: `http://127.0.0.1:${port}/${kind === 'writing' ? 'caderno/' : ''}`,
    timeout: 20_000,
    reuseExistingServer: false,
  })),
});
