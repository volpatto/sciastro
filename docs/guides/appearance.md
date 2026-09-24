# Palettes, typography and decorative accents

Use `appearance` in `sciastro.yaml` to choose colors, fonts, icon treatment,
optional gradients and a translucent top menu. These settings work with `classic`,
`modern` and `lncc`, and with individual, group and course profiles. Omit the new settings to retain
the selected theme's existing appearance.

The choices are independent:

| Setting | Controls |
| --- | --- |
| `kind` | Site profile and automatic content labels |
| `theme` | The underlying visual theme |
| `layout` | Main and contextual navigation placement |
| `appearance.palette` | Reading surfaces, text colors and accents |
| `appearance.typography` | Heading and body font pairing |
| `appearance.icons` | Icon presentation, independently of the selected glyph |
| `appearance.gradient` | Optional decoration on introductory areas or main titles |
| `appearance.navigation` | Solid or translucent treatment for top navigation |

For example, an LNCC site can keep its sidebar while using Ocean colors and
Humanist typography. Changing a palette does not move its navigation or alter
its content. See [navigation layouts](layouts.md) and the
[configuration reference](../reference/configuration.md#appearance).

## Choose a palette

Each palette includes coordinated light and dark colors:

| Palette | Accent direction |
| --- | --- |
| `violet` | Purple |
| `ocean` | Blue |
| `forest` | Green |
| `amber` | Warm amber |
| `slate` | Muted blue-gray |

Use one name for a complete palette:

```yaml
appearance:
  palette: ocean
```

Or choose the base and accent independently:

```yaml
appearance:
  palette:
    base: slate
    accent: violet
```

The base supplies `paper`, `surface`, `ink`, `muted` and `line`; the accent
supplies `accent`. Five bases and five accents give **25 combinations**. A single
name is equivalent to using that name for both fields. Both fields are required
when using the mapping form.

The built-in contrast tests cover normal foreground text against the selected
base's paper and surface colors in light and dark modes. This does not establish
contrast for arbitrary custom colors, images or every point in a gradient.

### Override individual colors

Existing six-digit hex overrides take precedence over a named palette:

```yaml
appearance:
  palette: ocean
  light:
    accent: '#1D5C7D'
  dark:
    accent: '#A2D8F2'
```

Unspecified colors come from the chosen palette; if no palette is selected,
they come from the theme. Check foreground/background contrast in both modes
after supplying custom colors. The supported keys are `paper`, `surface`, `ink`,
`muted`, `accent` and `line`.

## Choose typography

| Profile | Headings | Body | Metadata |
| --- | --- | --- | --- |
| `editorial` | Newsreader | Manrope | Regular metadata styling |
| `humanist` | Manrope | Manrope | Regular metadata styling |
| `technical` | System UI font | System UI font | Monospace |

```yaml
appearance:
  typography: editorial
```

Newsreader and Manrope are included in SciAstro and served locally. The system UI
font varies by operating system. Omit `typography` to retain the theme's fonts.
Code blocks keep their code formatting.

`bodyFont` and `headingFont` override the corresponding profile font separately:

```yaml
appearance:
  typography: humanist
  headingFont: "Georgia, serif"
```

Setting a family name does not install or download a font. For additional local
fonts, register a CSS entry point as described under
[advanced extensions](../customization.md#advanced-extensions).

## Style icons independently of their glyphs

```yaml
icons:
  navigation:
    research: lucide:flask-conical
appearance:
  icons:
    style: soft
    weight: regular
```

| Field | Choices | Scope |
| --- | --- | --- |
| `style` | `plain`, `accent`, `soft` | Page icons in navigation: ordinary treatment, accent color, or a soft accent background |
| `weight` | `light`, `regular`, `bold` | Stroke weight of supported icons, including interface controls |

When the `appearance.icons` mapping is present, its defaults are `plain` and
`regular`. Accent/soft backgrounds apply to navigation page icons, not to every
interface button. Flags and logos retain their original appearance; an image
file cannot acquire a different stroke weight. The top-level `icons` setting
continues to choose or hide glyphs independently. See the [icon guide](../icones.md).

## Add a restrained gradient

Gradients are disabled by default. This example adds decoration behind
introductory areas without changing body text:

```yaml
appearance:
  gradient:
    style: linear
    colors: [ocean, violet]
    targets: [hero]
    angle: 135
```

| Field | Default when the mapping is enabled | Accepted values |
| --- | --- | --- |
| `style` | `linear` | `linear`, `radial`, `mesh` |
| `colors` | `[violet, ocean]` | Exactly two built-in palette names |
| `targets` | `[hero]` | `[hero]`, `[headings]` or `[hero, headings]`, without duplicates |
| `angle` | `135` | Number from −360 to 360 degrees; affects `linear` only |

The gradient colors use the named palettes' accents for the current light/dark
mode. They are independent of the page palette and custom accent overrides.
`radial` spreads color from a center; `mesh` combines soft color regions.

The `hero` target adds a subtle background only to home introductions, composed
profiles and page headers. It does not put a gradient behind long article bodies.
The `headings` target applies gradient text only to main page H1 titles; it does
not affect headings inside article content, cards or the bibliography.

Use `gradient: false` to disable it explicitly. Gradients are also disabled for
printing and forced-colors display modes, preserving ordinary readable text.

## Use a translucent top menu

Set `appearance.navigation: glass` to give top navigation a softly blurred
surface, rounded corners and a faint shadow:

```yaml
layout:
  navigation: top
appearance:
  navigation: glass
```

The menu follows the masthead in the page and stays near the top of the viewport
as you scroll. On small screens, it retains the native collapsible menu and works
without additional JavaScript. With LNCC's top glass menu, the masthead scrolls
away instead of remaining fixed above it.

This option affects only `layout.navigation: top`. It is ignored when navigation
uses a sidebar. Classic and Modern use top navigation by default; for LNCC, or
any site configured with a sidebar, set `layout.navigation: top` explicitly.
Omit `appearance.navigation` or use `solid` to keep the ordinary menu treatment.

Browsers without backdrop blur use an opaque palette surface. The menu also uses
a solid fallback when the browser reports a reduced-transparency preference or
forced-colors mode. Colors follow the chosen palette in light and dark modes.
The individual recipe below combines this menu with the Modern theme, Humanist
typography and mesh decoration; the group recipe keeps solid navigation for comparison.

## Complete recipes

### A research group with a restrained blue accent

```yaml
kind: group
theme: classic
appearance:
  palette: ocean
  typography: editorial
  icons: { style: accent, weight: regular }
  gradient:
    style: linear
    colors: [ocean, violet]
    targets: [hero]
    angle: 135
```

### An individual profile with neutral surfaces and violet accents

```yaml
kind: individual
theme: modern
layout:
  navigation: top
appearance:
  navigation: glass
  palette: { base: slate, accent: violet }
  typography: humanist
  icons: { style: soft, weight: regular }
  gradient:
    style: mesh
    colors: [violet, ocean]
    targets: [hero, headings]
```

These are fragments to merge into an existing `sciastro.yaml`, retaining required
identity and content fields. The [gallery](../gallery.md) includes both recipes.
The starter templates retain the defaults so that each visual choice remains
explicit. Width, caption alignment and motion can be configured alongside these
settings; see [customization](../customization.md#colors-typography-and-width).
