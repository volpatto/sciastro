# SciAstro architecture

This repository produces an npm package. Consumer websites keep their content
separate and load the integration with `import sciastro from 'sciastro'`.

| Path | Responsibility |
| --- | --- |
| `src/index.ts` | Astro integration: configuration, routes and virtual content module |
| `src/sections.ts` | Composed-page schemas and localized section preparation |
| `src/schema.ts` | Configuration, research, team and page contracts |
| `src/content.ts` | Reading, validation and preparation of localized pages |
| `src/markdown.ts` | Markdown, base-aware links and citation syntax |
| `src/bibliography.ts` | BibTeX parsing, CSL formatting and stable reference identifiers |
| `src/i18n.ts` | Interface labels, translations and paths |
| `src/icons.ts` | Local icon resolution and menu/language defaults |
| `src/social.ts` | Sharing-image selection and absolute URLs, independent of people and favicon settings |
| `src/components/` | Layout, bibliography, icons and member presentation |
| `src/pages/` | Routes injected into consumer websites |
| `src/styles/` | Shared styling, sections and LNCC Theme |
| `src/cli.ts` | Project generation and content validation |
| `starters/` | Initial files shipped with the package |
| `examples/` | Local consumers using the workspace dependency |
| `tests/*.test.mjs` | Content, bibliography and icon regression tests |
| `scripts/test-package.mjs` | Isolated archive installation and consumer build checks |
| `tests/browser/` | Static test servers and browser interaction tests |
| `playwright.config.mjs` | Site/viewport matrix and browser reports |
| `.github/workflows/ci.yml` | Package and browser CI jobs |

## Build flow

1. The integration reads `sciastro.yaml` from the consumer's root.
2. Zod validates the configuration and content; enabled languages are resolved.
3. Markdown and BibTeX become page data and HTML during generation.
4. A virtual module supplies that data to the package's Astro pages.
5. Astro emits static pages. The browser receives HTML, CSS, and theme/menu JavaScript.

Lucide and Circle Flags are resolved from locally installed catalogs at build time.
`BuiltPage.icon` and `BuiltSite.languageIcons` contain only the selected drawings.
`Icon.astro` renders a decorative SVG or a local image. License notices live in
`docs/icon-licenses.txt` and are included in the HTML. Unknown icons, unknown page
keys and missing files fail validation.

Deployment settings come from YAML or `SITE_URL`/`BASE_PATH`. Consumer images and
PDFs belong in its `public/`. During development, YAML/Markdown/BibTeX changes
restart Vite so that configuration and routes also refresh.

## Distribution

TypeScript compiles to JavaScript and type declarations. Astro components and CSS
are copied into `dist/` and compiled by the consumer's Astro build. The package
includes `starters/` and documentation. The small LNCC example is included as a customization reference; other development examples and tests are not shipped.

`pixi run --locked pack` builds before creating the `.tgz`. It passes
`--skip-manifest-obfuscation` to pnpm to retain `packageManager`, which the CLI
uses when creating consumer projects. Distribution tests install that
archive in temporary directories outside the workspace and build both site kinds.
This detects missing package files and dependencies that only work because they
happen to be present in the development checkout.

When changing configuration contracts, maintain `schemaVersion` and document
migrations. SciAstro does not provide automatic migration. Keep an individual
researcher's content out of the generic package implementation.

## Verification boundaries

The build checks structure, translations, declared images/icons, bibliography keys,
identifiers and student-level relationships. Consumer tests additionally check local
links and anchors in generated HTML. `sciastro check` does not check external websites
or establish the scientific accuracy of text and references.

CI runs package verification on Linux, macOS and Windows, and browser interaction
tests on Linux/Chromium. Browser tests exercise both example themes at desktop and
mobile viewport sizes, including navigation without JavaScript. They are not a
complete accessibility audit or a substitute for checking other browser engines.
See [Testing and contributing](testing.md) for commands, reports and expectations.

## Extension boundaries

`pageFiles` opts into explicit, composed pages. The integration exposes a virtual
component registry populated only from the consumer Astro configuration. Renderer
overrides and CSS remain executable project code, separate from editorial YAML.
See [the public customization contract](customization.md).

The development server keeps Fontsource CSS in the Vite pipeline; installed-package
tests exercise this as well as production builds. See [Astro styling guidance](https://docs.astro.build/en/guides/styling/).
