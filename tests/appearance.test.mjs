import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configSchema } from '../dist/schema.js';
import { PALETTES, resolveAppearance } from '../dist/appearance.js';

const config = {
  schemaVersion: 1,
  kind: 'individual',
  name: 'Example researcher',
  description: 'Example academic website',
  url: 'https://example.org',
  home: { body: 'home.md' },
};
const parse = (appearance) =>
  configSchema.parse({ ...config, appearance }).appearance;
const names = ['violet', 'ocean', 'forest', 'amber', 'slate'];

const rgb = (color) =>
  Array.isArray(color)
    ? color
    : color
        .slice(1)
        .match(/../g)
        .map((channel) => Number.parseInt(channel, 16) / 255);
function luminance(color) {
  const channels = rgb(color).map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function composite(foreground, background, opacity) {
  const front = rgb(foreground);
  return rgb(background).map(
    (channel, index) => channel * (1 - opacity) + front[index] * opacity,
  );
}

function assertHeroContrast(tokens, from, to, opacity, label) {
  const backgrounds = [
    composite(from, tokens.paper, opacity),
    composite(to, tokens.paper, opacity),
    composite(to, composite(from, tokens.paper, opacity), opacity),
  ];
  for (const [index, background] of backgrounds.entries()) {
    for (const text of ['ink', 'muted', 'accent']) {
      const ratio = contrast(tokens[text], background);
      assert(
        ratio >= 4.5,
        `${label}: ${text} on hero layer ${index} = ${ratio.toFixed(3)}:1`,
      );
    }
    for (const stop of [from, to]) {
      const ratio = contrast(stop, background);
      assert(
        ratio >= 3,
        `${label}: large gradient heading on layer ${index} = ${ratio.toFixed(3)}:1`,
      );
    }
  }
}

test('omitted appearance preserves themes; opting in keeps existing defaults', () => {
  assert.equal(configSchema.parse(config).appearance, undefined);
  assert.deepEqual(resolveAppearance(), {
    light: {},
    dark: {},
    properties: {},
  });
  const empty = parse({});
  assert.deepEqual(resolveAppearance(empty), {
    light: {},
    dark: {},
    properties: { 'content-width': '1160px' },
  });
  assert.equal(empty.motion, 'none');
  for (const key of [
    'palette',
    'typography',
    'navigation',
    'icons',
    'gradient',
    'captions',
  ])
    assert.equal(empty[key], undefined);
  assert.deepEqual(parse({ icons: {} }).icons, {
    style: 'plain',
    weight: 'regular',
  });
  assert.deepEqual(parse({ gradient: {} }).gradient, {
    style: 'linear',
    colors: ['violet', 'ocean'],
    targets: ['hero'],
    angle: 135,
  });
  assert.deepEqual(
    resolveAppearance(parse({ gradient: false })),
    resolveAppearance(empty),
  );
  for (const navigation of ['solid', 'glass'])
    assert.equal(parse({ navigation }).navigation, navigation);
});

test('all palette mixes retain base surfaces and use the selected light/dark accent', () => {
  assert.deepEqual(Object.keys(PALETTES).sort(), [...names].sort());
  for (const base of names) {
    const simple = resolveAppearance(parse({ palette: base }));
    assert.deepEqual(simple.light, PALETTES[base].light);
    assert.deepEqual(simple.dark, PALETTES[base].dark);
    for (const accent of names) {
      const value = resolveAppearance(parse({ palette: { base, accent } }));
      for (const mode of ['light', 'dark']) {
        assert.equal(value[mode].accent, PALETTES[accent][mode].accent);
        for (const token of ['paper', 'surface', 'ink', 'muted', 'line'])
          assert.equal(value[mode][token], PALETTES[base][mode][token]);
      }
    }
  }
});

test('every mixed preset provides WCAG AA normal-text contrast on both reading surfaces', () => {
  for (const base of names)
    for (const accent of names) {
      const resolved = resolveAppearance(parse({ palette: { base, accent } }));
      for (const mode of ['light', 'dark'])
        for (const text of ['ink', 'muted', 'accent'])
          for (const surface of ['paper', 'surface']) {
            const ratio = contrast(
              resolved[mode][text],
              resolved[mode][surface],
            );
            assert(
              ratio >= 4.5,
              `${base}/${accent} ${mode}: ${text} on ${surface} = ${ratio.toFixed(3)}:1`,
            );
          }
    }
});

test('explicit colors, fonts and existing caption settings override presets without mutation', () => {
  const input = parse({
    palette: { base: 'ocean', accent: 'amber' },
    typography: 'editorial',
    light: { accent: '#123456', line: '#ABCDEF' },
    dark: { paper: '#101112' },
    bodyFont: "'Example Body', sans-serif",
    headingFont: "'Example Heading', serif",
    contentWidth: 1280,
    captions: { figures: 'right', tables: 'justify' },
  });
  const original = structuredClone(input);
  const resolved = resolveAppearance(input);
  assert.deepEqual(resolved.light, {
    ...PALETTES.ocean.light,
    accent: '#123456',
    line: '#ABCDEF',
  });
  assert.deepEqual(resolved.dark, {
    ...PALETTES.ocean.dark,
    accent: PALETTES.amber.dark.accent,
    paper: '#101112',
  });
  assert.deepEqual(resolved.properties, {
    'content-width': '1280px',
    'body-font': "'Example Body', sans-serif",
    heading: "'Example Heading', serif",
    'figure-caption-align': 'right',
    'table-caption-align': 'justify',
    'figure-caption-links-align': 'flex-end',
  });
  assert.deepEqual(input, original);
  resolved.light.paper = '#FFFFFF';
  assert.equal(resolveAppearance(input).light.paper, '#FAFCFE');
  assert.equal(PALETTES.ocean.light.paper, '#FAFCFE');
  for (const alignment of ['left', 'justify', 'center'])
    assert.equal(
      resolveAppearance(parse({ captions: { figures: alignment } })).properties[
        'figure-caption-links-align'
      ],
      alignment === 'center' ? 'center' : 'flex-start',
    );
});

test('typography and icon weights resolve into local font stacks and numeric stroke widths', () => {
  const fonts = {
    editorial: [
      "'Manrope Variable', sans-serif",
      "'Newsreader Variable', Georgia, serif",
    ],
    humanist: [
      "'Manrope Variable', sans-serif",
      "'Manrope Variable', sans-serif",
    ],
    technical: ['system-ui, sans-serif', 'system-ui, sans-serif'],
  };
  for (const [typography, [body, heading]] of Object.entries(fonts)) {
    const value = resolveAppearance(parse({ typography }));
    assert.equal(value.properties['body-font'], body);
    assert.equal(value.properties.heading, heading);
  }
  for (const style of ['plain', 'accent', 'soft'])
    for (const [weight, width] of Object.entries({
      light: '1.5',
      regular: '2',
      bold: '2.5',
    }))
      assert.equal(
        resolveAppearance(parse({ icons: { style, weight } })).properties[
          'icon-stroke-width'
        ],
        width,
      );
});

test('gradient stops have readable contrast across every base in both modes', () => {
  for (const base of names)
    for (const from of names)
      for (const to of names) {
        const value = resolveAppearance(
          parse({
            palette: base,
            gradient: { colors: [from, to], angle: -45 },
          }),
        );
        assert.equal(value.properties['gradient-angle'], '-45deg');
        for (const mode of ['light', 'dark']) {
          assert.equal(
            value[mode]['gradient-from'],
            PALETTES[from][mode].accent,
          );
          assert.equal(value[mode]['gradient-to'], PALETTES[to][mode].accent);
          for (const stop of ['gradient-from', 'gradient-to'])
            for (const surface of ['paper', 'surface'])
              assert(
                contrast(value[mode][stop], value[mode][surface]) >= 4.5,
                `${base}/${from}/${to} ${mode}: ${stop} on ${surface}`,
              );
        }
      }
  for (const style of ['linear', 'radial', 'mesh'])
    for (const targets of [['hero'], ['headings'], ['hero', 'headings']]) {
      const value = parse({ gradient: { style, targets } });
      assert.equal(value.gradient.style, style);
      assert.deepEqual(value.gradient.targets, targets);
    }
});

test('preset hero gradients retain text contrast even where two tinted mesh layers overlap', () => {
  for (const base of names)
    for (const accent of names)
      for (const from of names)
        for (const to of names) {
          const value = resolveAppearance(
            parse({
              palette: { base, accent },
              gradient: { colors: [from, to] },
            }),
          );
          assert.equal(value.properties['gradient-tint'], '8%');
          for (const mode of ['light', 'dark'])
            assertHeroContrast(
              value[mode],
              value[mode]['gradient-from'],
              value[mode]['gradient-to'],
              0.08,
              `${base}/${accent}, ${from}/${to} ${mode}`,
            );
        }
});

test('gradients without a palette preserve readable legacy theme colors with gentler tint', () => {
  // Read the actual defaults, so changing a theme's text color cannot silently
  // invalidate this contrast guarantee while leaving a duplicated fixture green.
  const site = readFileSync(
    new URL('../src/styles/site.css', import.meta.url),
    'utf8',
  );
  const lncc = readFileSync(
    new URL('../src/styles/lncc.css', import.meta.url),
    'utf8',
  );
  const tokens = (source, selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const block = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]+)\\}`).exec(
      source,
    );
    assert(block, `Missing theme rule: ${selector}`);
    return Object.fromEntries(
      [
        ...block[1].matchAll(
          /--(paper|surface|ink|muted|accent|line):\s*(#[\da-f]{6})/gi,
        ),
      ].map(([, name, color]) => [name, color]),
    );
  };
  const classicLight = tokens(site, ':root');
  const classicDark = {
    ...classicLight,
    ...tokens(site, ":root[data-theme='dark']"),
  };
  const themes = {
    classic: { light: classicLight, dark: classicDark },
    modern: {
      light: {
        ...classicLight,
        ...tokens(site, ":root[data-design='modern']"),
      },
      dark: {
        ...classicDark,
        ...tokens(site, ":root[data-design='modern'][data-theme='dark']"),
      },
    },
    lncc: {
      light: tokens(lncc, ":root[data-design='lncc']"),
      dark: tokens(lncc, ":root[data-design='lncc'][data-theme='dark']"),
    },
  };
  for (const [theme, defaults] of Object.entries(themes))
    for (const from of names)
      for (const to of names) {
        const value = resolveAppearance(
          parse({ gradient: { colors: [from, to] } }),
        );
        assert.equal(value.properties['gradient-tint'], '5%');
        for (const mode of ['light', 'dark'])
          assertHeroContrast(
            defaults[mode],
            value[mode]['gradient-from'],
            value[mode]['gradient-to'],
            0.05,
            `${theme}, ${from}/${to} ${mode}`,
          );
      }
});

test('appearance rejects unknown values, malformed pairs, duplicate targets and CSS injection', () => {
  const invalid = [
    { palette: 'unknown' },
    { palette: { base: 'ocean' } },
    { palette: { accent: 'forest' } },
    { palette: { base: 'slate', accent: 'unknown' } },
    { palette: { base: 'slate', accent: 'forest', background: '#fff' } },
    { palette: ['ocean', 'forest'] },
    { typography: 'serif' },
    { navigation: 'transparent' },
    { navigation: { style: 'glass' } },
    { navigation: 'glass;display:none' },
    { icons: { style: 'bright' } },
    { icons: { weight: 2 } },
    { icons: { style: 'soft', color: 'red' } },
    { gradient: true },
    { gradient: { style: 'conic' } },
    { gradient: { colors: ['violet'] } },
    { gradient: { colors: ['violet', 'ocean', 'forest'] } },
    { gradient: { colors: ['#123456', 'ocean'] } },
    { gradient: { targets: [] } },
    { gradient: { targets: ['hero', 'hero'] } },
    { gradient: { targets: ['body'] } },
    { gradient: { angle: '135deg' } },
    { gradient: { angle: 361 } },
    { gradient: { angle: -361 } },
    { gradient: { angle: Number.NaN } },
    { gradient: { angle: Infinity } },
    { gradient: { opacity: 0.3 } },
    { gradient: { colors: ['violet;display:none', 'ocean'] } },
    { light: { accent: '#123456;display:none' } },
    { dark: { paper: 'url(https://example.org/track)' } },
    { headingFont: 'serif;display:none' },
    { bodyFont: 'url(x)' },
    { icons: { style: '<script>' } },
  ];
  for (const appearance of invalid)
    assert.throws(() => parse(appearance), JSON.stringify(appearance));
  for (const angle of [-360, 0, 360])
    assert.equal(
      resolveAppearance(parse({ gradient: { angle } })).properties[
        'gradient-angle'
      ],
      `${angle}deg`,
    );
});
