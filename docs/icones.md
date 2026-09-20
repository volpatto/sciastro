# Navigation and language icons

Icons are enabled by default. No extra library installation or TypeScript changes
are needed. Page labels and **PT**/**EN** remain visible. Icons are decorative and
do not repeat these labels to screen readers.

## Defaults

| Item | Group | Individual |
| --- | --- | --- |
| Home / About | `lucide:house` | `lucide:user-round` |
| Research | `lucide:flask-conical` | `lucide:flask-conical` |
| Team / Supervision | `lucide:users-round` | `lucide:graduation-cap` |
| Publications | `lucide:book-open` | `lucide:book-open` |
| Additional page | `lucide:file-text` | `lucide:file-text` |
| Portuguese | `circle-flags:br` (Brazil) | Same |
| English | `circle-flags:gb` (United Kingdom) | Same |

The supplied starters also set `lucide:code-xml` for Software and `lucide:mail` for
Contact in `content/pages.yaml`.

## Change an icon

In `scipages.yaml`, override only the items you want to change. Omitted items keep
their defaults:

```yaml
icons:
  navigation:
    research: lucide:microscope
    team: lucide:users
  languages:
    pt: circle-flags:br
    en: circle-flags:gb
```

Built-in page keys are always `home`, `research`, `team` and `publications`, regardless
of language. For additional pages, use the `slug` from `content/pages.yaml`.

You can also define an icon alongside an additional page:

```yaml
- slug: projects
  title: { pt: Projetos, en: Projects }
  icon: lucide:folder-open
  body: { pt: projects.pt.md, en: projects.en.md }
```

If present, `icons.navigation.projects` takes precedence over `icon` in `pages.yaml`.
The same icon is used in both languages and themes.

## Choose from a catalog

- [Lucide on Iconify](https://icon-sets.iconify.design/lucide/): use the full name,
  such as `lucide:atom`, `lucide:network`, `lucide:code-xml`, or `lucide:mail`.
- [Circle Flags on Iconify](https://icon-sets.iconify.design/circle-flags/): use
  `circle-flags:br`, `circle-flags:gb`, or another flag from the collection.

Both collections are installed with the package, at locked versions. Only used
icons are embedded in the HTML at build time; the browser does not download the
catalog or contact an icon API. Names unavailable in the installed version fail
validation with the field to correct. Other prefixes are not supported; use a
local file for another collection or an institutional symbol.

## Use your own image

Place the image in `public/icons/`, such as `public/icons/research.svg`, and configure:

```yaml
icons:
  navigation:
    research:
      src: /icons/research.svg
  languages:
    en:
      src: /icons/english.svg
```

The same `src` object works in an additional page's `icon` field. **Local** SVG,
PNG, JPEG, WebP, AVIF and GIF files are supported. The build checks that the file
exists inside `public/` and adds `base` automatically. Do not include the hosting
subdirectory in `src`.

Lucide icons follow the surrounding text color in light and dark modes. Flags and
custom images retain their colors, so choose an image legible against both
backgrounds. Custom SVG files are displayed as images, not inserted as inline HTML.

## Hide icons

Use unquoted `false` to keep only an item's text label:

```yaml
icons:
  navigation:
    publications: false
  languages:
    en: false
```

To hide all menu icons while keeping flags:

```yaml
icons:
  navigation: false
```

Use `icons: { languages: false }` to hide only the flags, or `icons: false` to hide
all configurable icons. These options do not change the site logo or theme button.
Pages without content remain absent from navigation even if an icon is configured.

## Credits

The drawings come from [Lucide](https://lucide.dev/license) and
[Circle Flags](https://github.com/HatScripts/circle-flags), with their
[license notices](icon-licenses.txt). These notices are also preserved in a comment
in generated HTML. Custom files retain their respective authors' licensing terms.
