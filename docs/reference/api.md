# API reference

Most authors only need YAML and Markdown. The API is for integration, validation
and custom presentation. This page describes the **public package export paths**
for SciAstro; importing arbitrary `dist/` files is not supported.
The npm package ships TypeScript declarations alongside JavaScript.

## Astro integration: `sciastro`

```ts
import sciastro, { loadSite } from 'sciastro';
import type { SciAstroOptions, BuiltSite, BuiltPage, BuiltSection } from 'sciastro';

const options: SciAstroOptions = {
  configFile: 'sciastro.yaml',
  styles: ['./src/styles/custom.css'],
  components: {
    sections: { 'project-note': './src/components/ProjectNote.astro' },
  },
};
```

### `sciastro(options?: SciAstroOptions): AstroIntegration`

The default export goes in `defineConfig({ integrations: [sciastro()] })`.
It loads/validates content, configures static output, the URL/base and trailing
slashes, injects pages plus a 404, and watches content in development.

| Option | Default | Contract |
| --- | --- | --- |
| `configFile` | `sciastro.yaml` | Configuration path relative to the consumer root |
| `styles` | `[]` | Local `.css` entry points relative to that root |
| `components.layout` | Built-in layout | Local `.astro` component receiving site/page and a default slot |
| `components.sections` | `{}` | Component key → local `.astro` renderer; keys use lowercase letters, numbers and hyphens |

A missing component or wrong file extension fails the build. Custom section keys
must be registered before a YAML page can use them. Registering a built-in key
such as `cards` overrides that section renderer. Configuration is trusted project
code; editorial YAML cannot import executable components.

### `loadSite(configFile, overrides?): Promise<BuiltSite>`

```js
import { resolve } from 'node:path';
import { loadSite } from 'sciastro';

const site = await loadSite(resolve('sciastro.yaml'), {
  url: 'https://example.org',
  base: '/lab/',
});
console.log(site.pages.map(({ path }) => path));
```

Use an absolute config path. `overrides` accepts optional `url` and `base`; values
pass the same validation as YAML. The API reads local files and prepares localized
page data and sanitized HTML without building Astro or fetching reference metadata.
Invalid input rejects with an `Error`; do not depend on exact wording, which may
change or be localized. Schemas alone validate shapes; `loadSite` also checks file
existence, translations, IDs, routes and relationships.

## Public schemas and types

The root module exports these Zod schemas:

| Export | Accepted data |
| --- | --- |
| `configSchema` | Root site configuration |
| `researchSchema` | Array of research-area records |
| `teamSchema` | Array of person records |
| `pagesSchema` | Array of additional automatic-mode page records |
| `iconSchema` | Catalog name, local image object or `false` |
| `sectionSchema` | One composed section, discriminated by `type` |
| `composedPageSchema` | One explicit page record |

Use `.parse(value)` to receive validated data with defaults, or `.safeParse(value)`
to inspect errors. Configuration field details are in
[Configuration](configuration.md), [Content](../conteudo.md) and
[Page composition](../customization.md).

The root type exports are `SciAstroOptions`, `SiteConfig`, `Member`, `ResearchArea`,
`Locale`, `IconSetting`, `Section`, `BuiltSection`, `BuiltFigure`, `BuiltLink`,
`BuiltEntry`, `BuiltPage` and `BuiltSite`. `SiteConfig`/`Section` describe parsed data
including defaults, so an authored YAML object may have fewer fields. `Locale` is
`'pt' | 'en'`. `Section` is a discriminated union; narrow by `section.type`.

`Member.photo` accepts `{ src, alt, position? }`, where `position` is a pair of
horizontal/vertical percentages in `[0, 100]`. `Member.avatarFallback` and
`SiteConfig.people?.avatarFallback` accept `{ src, alt, viewBox?, width?, height? }`;
cropping requires positive original image dimensions. `alt` is localized. These
fields remain available in `BuiltSite.members` and `BuiltSite.config`; the shared
team renderer selects the photo, then the member fallback, then the site fallback,
then the built-in fictional symbol. See the [people guide](../conteudo.md#portraits-and-fallback-symbols).

### Prepared data

| Type | Main fields |
| --- | --- |
| `BuiltSite` | `config`, `pages`, `members`, `bibliographyKeys`, `languageIcons`, `copyright`, `footer` |
| `BuiltPage` | `id`, resolved `icon`, `locale`, base-aware `path`, `title`, `html`, `references`, `areas`; optional `sections`, `heading`, `description`, `navigation`, `header` |
| `BuiltSection` | `type`, optional `id`, `title`, sanitized `html`, `links`, and type-specific fields such as `items`, `image`, `logos`, `publications`, `component`, `props` |
| `BuiltEntry` | `title`, optional `id`, `eyebrow`, `subtitle`, `html`, `meta`, `period`; `images` and `links` |
| `BuiltFigure` | `src`, translated `alt`, `links`, `enlarge`; optional dimensions, `caption`, `viewBox` |
| `BuiltLink` | Translated `label`/`url`, resolved `icon`, optional `download` |

Page paths already include `base`; prepared section image and link paths are
resolved by the rendering components. Do not prefix paths twice. A custom
component owns validation of arbitrary `section.props` and must not assume it is
sanitized HTML. See the [custom component example](../customization.md#advanced-extensions).

## Content helpers: `sciastro/content`

Exports `loadSite`, `readConfig(file): Promise<SiteConfig>`, and
`within(root, file): string`, plus `BuiltArea`, `BuiltPage`, `BuiltSite` types.
`readConfig` parses only the root YAML; it does not perform a full content check.
`within` rejects absolute paths and lexical traversal outside the supplied root;
it is not a filesystem/symlink sandbox.

`BuiltArea` contains `id`, `title`, `summary`, `html` and an optional `{src, alt}`
image. Most integrations should use `loadSite` instead of composing these helpers.

## Bibliography: `sciastro/bibliography`

```js
import { Bibliography, referenceId } from 'sciastro/bibliography';

const bib = new Bibliography(`@book{example,
  author={Morgan, Alex}, title={Fictional Example}, year={2026}
}`, 'apa');
const inlineHtml = bib.citation(['example'], 'en');
const references = bib.references(['example'], 'en');
const metadata = bib.publication('example');
const anchor = referenceId('example');
```

| API | Result |
| --- | --- |
| `new Bibliography(bibtex: string, style?: 'apa' \| 'vancouver')` | Parses text locally; defaults to APA; duplicate/invalid keys throw |
| `.keys: string[]` | Keys in library order; treat as read-only |
| `.style` | Selected readonly style |
| `.has(key: string): boolean` | Whether the library contains the exact key |
| `.publication(key: string): PublicationMetadata` | Plain-text card metadata from the selected record; unknown keys throw; each call returns a new object |
| `.citation(keys: string[], locale: Locale): string` | Linked citation HTML; unknown keys throw |
| `.references(keys: string[], locale: Locale): Reference[]` | Deduplicated formatted references in requested order |
| `referenceId(key: string): string` | Stable page-anchor identifier |

`Reference` has `key`, `id`, sanitized `html` and optional `doi`/`url`.
`PublicationMetadata` has optional `title`, `authors`, `year`, `journal`, `citation`,
`doi` and `url` strings. Missing values stay absent. The method normalizes DOI
prefixes and discards non-HTTP(S) URLs; `loadSite` additionally validates the resolved
card's title, DOI and URL. Cards add an optional editorial `topic` and retain their
`bibtex` selector. See the [field mapping](../referencias.md#imported-fields).
Vancouver numbering follows global BibTeX order; APA disambiguation considers the
complete library. See [citation limitations](../referencias.md#formatting).

## Section helpers: `sciastro/sections`

Exports `sectionLinkSchema`, `figureSchema`, `sectionSchema`, `composedPageSchema`,
`buildSection`, and the types `Section`, `ComposedPage`, `BuiltLink`, `BuiltFigure`,
`BuiltEntry`, `BuiltSection`, and `BibtexSource` (`string` or `{ file: string; key: string }`).

`buildSection(section, locale, context, resolvePublication?): BuiltSection` resolves
text, Markdown, icons and figures. The optional fourth argument has type
`(source: BibtexSource) => PublicationMetadata`; it is required only for BibTeX
publication items. `loadSite` supplies it automatically, loading selected files
relative to `contentDir` and reusing each parsed library. Existing three-argument
calls continue to work for manual publications and other sections.

Its context is the package's internal Markdown context; most
consumers should obtain prepared sections through `loadSite`, which also validates
cross-file constraints. No supported public context factory is currently exported.

## Astro components and page entry points

| Import | Props / purpose |
| --- | --- |
| `sciastro/components/Layout.astro` | `{ site, page }` and default slot; wrap to retain built-in navigation/theme behavior |
| `sciastro/components/Section.astro` | `{ site, page, section }`; renders one prepared section |
| `sciastro/components/Figure.astro` | `{ image: BuiltFigure, base: string, priority?: boolean }` |
| `sciastro/components/Links.astro` | `{ links: BuiltLink[], base: string }` |
| `sciastro/page.astro` | Integration route entry point; normally injected automatically |
| `sciastro/404.astro` | Integration's static 404; normally injected automatically |

A custom layout also receives the 404 descriptor: it has the locale, path, title
and optional metadata but no normal page sections. Render `<slot />` to keep page
content. Theme CSS variables are the intended styling surface; internal classes
and unexported modules may change between releases.

This reference is maintained with the source. Automated tests check that every
public runtime export and root type export remains represented here, and execute
the documented tutorials against the package's content loader.
