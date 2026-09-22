# Configuration reference

The root `sciastro.yaml` is validated against `configSchema`. Unknown fields are
rejected; indentation and field names are case-sensitive. The current content
schema is **`schemaVersion: 1`**, independent of the npm package's version.

A localized value is a nonempty string shared by all languages, or a mapping with
a value for every enabled locale: `{ pt: Pesquisa, en: Research }`.

## Identity and generation

| Field | Required / default | Meaning |
| --- | --- | --- |
| `schemaVersion` | Required: `1` | Content contract version |
| `kind` | Required: `individual` or `group` | Automatic page labels and site identity |
| `name` | Required | Researcher or group name |
| `description` | Required, localized | Site description and fallback page metadata |
| `affiliation` | Optional, localized | Institution(s) |
| `url` | Required | HTTP(S) origin only; no path, query or fragment |
| `base` | `/` | Deployment prefix, e.g. `/lab/`; must end with `/` |
| `locales` | `[pt]` | Nonempty unique subset of `[pt, en]` |
| `defaultLocale` | `pt` | Must be included in `locales` |
| `contentDir` | `content` | Directory inside the website root |
| `home.body` | Required in automatic mode | Localized Markdown filename relative to `contentDir` |
| `home.photo` | No portrait | Optional automatic About/Home image: `src`, localized `alt`, `shape: rectangle` (default) or `circle`, optional `position: [x, y]` percentages and original `width`/`height`. For composed pages, use `profile.image`; see [profile photographs](../customization.md#profile-photographs) |
| `pageFiles` | Optional nonempty list | YAML page files relative to `contentDir`; replaces automatic pages |
| `navigation` | Optional list | Existing page IDs, in menu order |
| `routes` | `{}` | Automatic-page ID → localized path overrides |
| `notice` | Optional, localized | Short site notice |
| `structuredData` | Optional object | Additional JSON-LD fields; author is responsible for correctness |

`SITE_URL` and `BASE_PATH` override `url` and `base` in the CLI and Astro integration.
The lower-level `loadSite` API takes explicit overrides instead of reading the environment.

## Analytics

See the [analytics guide](../guides/analytics.md) for setup and complete examples.

| Field | Default | Meaning |
| --- | --- | --- |
| `analytics` | `false` | Disabled, or one provider configuration |
| `analytics.provider` | Required when enabled | `cloudflare` or `umami` |
| `analytics.token` | Required for Cloudflare | Public 32-character hexadecimal Web Analytics token |
| `analytics.websiteId` | Required for Umami | Public website UUID |
| `analytics.scriptUrl` | `https://cloud.umami.is/script.js` | Umami tracker HTTPS URL; override for self-hosting |
| `analytics.events.downloads` | `false` | Umami file-link clicks |
| `analytics.events.externalLinks` | `false` | Umami external HTTP(S) link clicks |
| `analytics.events.custom` | `false` | Umami names from `analyticsEvent` on links |

Provider fields cannot be mixed; Cloudflare rejects `events`. Production tracking
is limited to `url` and `base`. Set `SCIASTRO_ANALYTICS=false` in the build environment
to disable injection temporarily. Settings are public, never secret API credentials.

## Link previews and sharing

See [link previews](../guides/sharing.md) for full examples and format limitations.

| Field | Default | Meaning |
| --- | --- | --- |
| `social.image` | Omitted | Global sharing image: local PNG/JPEG `src`, localized `alt`, optional original `width`/`height` |
| `social.fallback` | `logo` | Independent fallback: reuse the configured site logo, provide an image object with the same fields, or use `false` to omit the fallback |

An explicit image takes priority. The logo is reused in full, without `viewBox`
or styling. Unsupported logo formats produce an Astro warning and no image tags;
missing explicit files fail validation. Sharing does not use people fallbacks,
favicons or a generic symbol. Titles and descriptions are preserved without an image.

## Appearance

| Field | Default | Meaning |
| --- | --- | --- |
| `theme` | `classic` | `classic`, `modern` or `lncc` |
| `logo` | Built-in mark | `src`, localized `alt`, optional `viewBox`, `width`, `height`, `monochrome` |
| `favicon` | Optional | Asset path under `public/` |
| `appearance.light`, `.dark` | Theme palette | `paper`, `surface`, `ink`, `muted`, `accent`, `line`; six-digit hex values |
| `appearance.contentWidth` | `1160` when appearance configured | Content width, 720–1600 px |
| `appearance.bodyFont`, `.headingFont` | Theme fonts | Font-family strings; does not download fonts |
| `themeStorageKey` | `sciastro-theme` | Browser storage key for saved theme |
| `copyright` | Site name | Localized Markdown beside the framework credit |
| `footer` | Optional | Localized Markdown below the copyright row |
| `icons` | Defaults enabled | `false`, or `navigation` and `languages` settings |

An icon can be `lucide:name`, `circle-flags:code`, `{ src: /icons/name.svg }`, or
`false`. Local image icons also accept `monochrome: true`. See [icons](../icones.md)
and [theme customization](../customization.md#colors-typography-and-width).

## Bibliography and people

| Field | Default | Meaning |
| --- | --- | --- |
| `bibliography` | Omitted | Enables a local reference library |
| `bibliography.file` | `references.bib` | Relative to `contentDir` |
| `bibliography.style` | `apa` | `apa` or `vancouver` |
| `bibliography.publications` | `[]` | Keys explicitly selected as the site's publications |
| `studentLevels` | Undergraduate, masters, phd, postdoc | Ordered objects with `id` and localized `label`; replaces the whole list |
| `people.file` | `team.yaml` | People records, relative to `contentDir`; an explicitly configured file must exist |
| `people.avatarFallback` | Built-in fictional symbol | Shared fallback for people without a photo: `src`, localized `alt`, optional `viewBox`, `width`, `height`; separate from the header `logo` |
| `links` | `[]` | Profile links with string `label`, HTTP(S) `url` and optional `analyticsEvent` (name or `false`) |

The [content guide](../conteudo.md) covers `research.yaml`, `team.yaml` and
`pages.yaml`. The [composition guide](../customization.md#page-fields) specifies
page fields, all ten section types and shared item/image/link contracts.
See [portraits and fallback symbols](../conteudo.md#portraits-and-fallback-symbols)
for per-person overrides, circular photo framing and cropping the lettering out of a logo.

## Interface labels

`ui` maps an existing label key to localized text. Built-in keys are:

```text
home about research team supervision publications faculty researchers students
alumni references areas details skip theme navigation menu languages built
emptyReferences notFound back since
```

For a composed page, edit its `title`/`heading` to change that page's name.
These labels control shared interface elements, not your editorial content.

## Validation boundaries

`sciastro check` loads content, validates translations and relationships, checks
local images/icons, parses citations and detects conflicting routes/identifiers.
It does not crawl external links, run browser interaction tests, validate scientific
claims or infer permissions to redistribute images. The package's own test suite
adds installed-site link/anchor and browser checks.
