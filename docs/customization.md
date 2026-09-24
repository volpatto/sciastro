# Pages, themes and extensions

SciAstro provides two authoring modes. Existing `home`, `research.yaml`,
`team.yaml` and `pages.yaml` configurations continue to work. For complete control
over a site's pages, set `pageFiles`. This explicitly lists **all** page files and
replaces automatic page generation. Do not maintain both sets of page definitions.
`team.yaml` (or the file selected by `people.file`) and the BibTeX library remain
reusable data sources in either mode.

## A composed site

```yaml
schemaVersion: 1
kind: individual
name: Example Researcher
description: Research and teaching
url: https://example.org
locales: [en]
defaultLocale: en
theme: lncc
contentDir: content
pageFiles:
  - pages/about.yaml
  - pages/software.yaml
navigation: [home, software]
```

In `content/pages/about.yaml`:

```yaml
id: home
title: About
paths: { en: '' }
header: false
sections:
  - type: profile
    title: Example Researcher
    eyebrow: Scientific computing
    text: |
      I work on numerical methods and scientific software.

      More information is available on the [software page](/software/).
  - type: prose
    title: Background
    text: Edit this text without changing a component.
```

In `content/pages/software.yaml`:

```yaml
id: software
title: Software
paths: { en: software/ }
icon: lucide:code-xml
sections:
  - type: prose
    tone: note
    title: Development practices
    text: Document the actual testing and distribution practices of your projects.
  - type: cards
    layout: rows
    items:
      - title: Example solver
        eyebrow: Python
        text: A description of the project and its intended applications.
        links:
          - label: Repository
            url: https://github.com/example/project
            icon: lucide:code-xml
```

For bilingual pages, translate each text field with `pt` and `en`. Plain strings
are shared by all enabled languages. Paths include the language prefix but exclude
the deployment base: `paths: { pt: pesquisa/, en: en/research/ }`. Paths end in `/`;
the primary home path is empty. This preserves custom URLs during migrations.
Only Portuguese and English are currently built in; other locales need a future
interface/bibliography localization extension.

## Page fields

| Field | Meaning |
| --- | --- |
| `id` | Stable identifier, independent of language and URL |
| `title` | Menu label and document title |
| `heading` | Optional longer visible heading; defaults to `title` |
| `paths` | Explicit URL path for each enabled language |
| `description` | Optional per-page search/social metadata |
| `icon` | Catalog icon, local file, or `false` |
| `navigation` | `false` keeps the page reachable but hides it from the menu |
| `header` | Default `true`; in `layout: page`, use `false` with exactly one `profile` section; article/listing layouts always provide their own title |
| `body` | Optional `.md` or `.ipynb` filename, relative to `contentDir` |
| `layout` | `page` (default), `article` (post metadata and contents list), or `listing` (child-page cards) |
| `parent` | Optional parent page identifier; determines breadcrumbs, menu hierarchy and listing membership |
| `date`, `authors`, `tags` | Optional `YYYY-MM-DD` publication date and lists of author names / tags |
| `toc` | `true` (default); show H2/H3 contents in article layout |
| `draft` | `false` (default); `true` excludes the page from previews and builds |
| `notebook` | Optional `showCode` (default `true`) and `collapseCode` (default `false`) |
| `sections` | Ordered sections; adding/reordering them requires no Astro code |
| `references` | Optional list of BibTeX keys to list on this page, even if not cited |

The `navigation` array in `sciastro.yaml` sets the menu order and selects top-level pages to
show. Omit it to use page-file order. Unknown identifiers, duplicate paths and
missing translations fail the build. A configured page with `navigation: false`
remains hidden even if its ID appears in the menu list.

`pageFiles` also accepts `.md` files with these fields in YAML front matter.
See [Articles, Markdown and notebooks](guides/writing.md) for complete examples,
scientific formatting and menu depth. Article/listing pages may include composed
sections after their body; `profile` remains specific to the ordinary page layout.

## Section types

Every section accepts an optional `id`, `title`, Markdown `text` and `links`.
IDs provide stable anchors for cards and shared links. Avoid reusing an ID on the
same page. `text` is inline YAML content; use page `body` for a Markdown file.

| `type` | Additional fields |
| --- | --- |
| `prose` | `tone: plain` or `note` |
| `profile` | Required `title`; optional `eyebrow` and `image`; supplies the page's H1 |
| `figure` | Required `image`; useful for a research topic with text, figure and credits |
| `cards` | `layout: grid` or `rows`; required `items` |
| `list` | Required `items`; optional `collapsible: true` and `open: true/false` |
| `timeline` | Required `items`, each with `period` |
| `logos` | Required `items`, each with an `image` and optional `link` |
| `publications` | `items` with `bibtex: { file, key }` to fill metadata automatically, or full manual records; optional `topic` category |
| `team` | Reads validated `people.file` (default `team.yaml`); separates faculty, researchers, active student levels and alumni |
| `custom` | Required `component`; optional `props`; requires a registered local Astro component |

Cards, lists and timelines share the same item fields: required `title`, optional
`id`, `eyebrow`, `subtitle`, `text`, `meta`, `images` and `links`. Timelines also
require `period`. This lets you use the same presentation for software, courses,
collaborations, projects and professional appointments.

A link has `label`, `url`, optional `icon`, and optional `download: true`.
It also accepts `analyticsEvent` (an event name or `false` to exclude the link).
See [analytics](guides/analytics.md) to enable a provider and click events.
Labels and URLs can be translated. Supported destinations are `http(s)`, `mailto`,
`tel`, `page:id#anchor`, `#anchors`, and site-root-relative `/paths/`. Root-relative paths are
adjusted automatically for `BASE_PATH`.

An image has `src` (a `/path` inside `public/`), `alt`, optional `width`, `height`,
`caption`, `captionAlign`, `links` and `enlarge: true`. Captions and their source/license links
remain visible beneath the figure. Optional `viewBox: 'x y width height'` displays
a window onto an original image using SVG; provide its original pixel dimensions.
It does not modify the image file. Logos in linked logo rows should not themselves
contain links or use `enlarge`.

Markdown citations such as `[@key]` work in section text and page bodies. Cited
references and explicitly listed page `references` share one deduplicated
bibliography. `publications` sections support [automatic cards selected by BibTeX
file and key](referencias.md#publication-cards-from-a-file-and-key). A `topic`
category can be added without repeating any bibliographic fields. Fully manual
records still use `title`, `authors`, `year`, `journal`, `citation` and `doi`;
they do not automatically create BibTeX keys.

## Profile photographs

About pages can display a circular or rectangular portrait in every built-in
theme, in light and dark modes and on mobile. Put the original file in
`public/images/portrait.jpg`; no image editor or custom CSS is needed.

For **automatic pages**, add `photo` alongside the existing `home.body` in
`sciastro.yaml`:

```yaml
home:
  body:
    pt: home.pt.md
    en: home.en.md
  photo:
    src: /images/portrait.jpg
    alt:
      pt: Retrato de Ana Silva
      en: Portrait of Ana Silva
    shape: circle
    position: [50, 35]
```

For **composed pages** (`pageFiles`), configure the `image` of the `profile`
section instead. `home.photo` does not change a composed page:

```yaml
sections:
  - type: profile
    title: Ana Silva
    text: I work on numerical methods and scientific computing.
    image:
      src: /images/portrait.jpg
      alt: Portrait of Ana Silva
      shape: circle
      position: [50, 35]
      caption: Photograph by Example Photographer
```

| Field | Behavior |
| --- | --- |
| `src` | Required path from `public/`, starting with `/`; the deployment base is added automatically |
| `alt` | Required description; use `pt`/`en` when it should change with the language |
| `shape` | `circle` fills a square frame and clips its corners; `rectangle` (default) preserves the original aspect ratio |
| `position` | Optional `[horizontal, vertical]` percentages from 0 to 100; default `[50, 50]`. Adjusts framing within a circle, like CSS `object-position` |
| `width`, `height` | Optional positive integer dimensions of the original file, not the displayed circle's size |

For a tall photograph, a lower vertical percentage such as `[50, 35]` keeps more
of its upper portion visible. Framing only moves along an axis if some of the
image overflows the frame. The original file is never changed or stretched.

Omit `photo` to keep the automatic page's existing illustration, or omit `image`
for a composed profile without a photograph. Omit `shape` (or set `rectangle`)
to retain the existing rectangular presentation. The individual example shows
a circular portrait using a fictional illustration; starters still omit the photo.

Composed images also support `caption`, source `links`, and `enlarge: true` as
described above. Captions and credits stay outside the circle; enlargement opens
the original file. The same optional `shape` and `position` fields are available
on other composed figures. When using `viewBox`, adjust the crop through that
window instead of `position`; a circular SVG window is centered and fills the
frame. Profile photographs are independent of [team portraits and their fallback
symbols](conteudo.md#portraits-and-fallback-symbols).

## LNCC Theme

Select `theme: lncc`, or start with `sciastro init my-site --kind individual --theme lncc`. This theme adapts Diego Volpatto's MIT-licensed website design:
Manrope body text, Newsreader headings, restrained violet colors, a desktop sidebar,
responsive menu and light/dark modes. The default fonts are served locally.

The theme contains **no institutional logos, personal data or scientific figures**.
The name identifies the design example, not an institutional endorsement. Supply
your own authorized logo through `logo: { src: /images/logo.svg, alt: Institution }`.
The logo supports `viewBox`, original `width`/`height`, and `monochrome: true` for
white rendering in dark mode. `favicon` is configured separately.

The fictional [LNCC example](https://github.com/volpatto/sciastro/tree/main/examples/lncc) includes page composition, custom
routes, a custom section and CSS. Preview it from the source checkout:

```sh
pixi run --locked dev-lncc
```

Its default address is `http://127.0.0.1:4342/`. Existing themes `classic` and
`modern` remain available, including with composed pages.

## Colors, typography and width

Theme, layout, palette and typography are independent choices. All appearance
profiles work with Classic, Modern and LNCC and with individual, group and course
sites. Omit the new options to retain the selected theme's existing appearance.

```yaml
theme: lncc
layout:
  navigation: sidebar
  subnavigation: right
appearance:
  palette: { base: slate, accent: violet }
  typography: editorial
  icons: { style: accent, weight: regular }
```

Five named palettes (`violet`, `ocean`, `forest`, `amber`, `slate`) can be used
whole or combined as separate `base` and `accent` selections, giving 25
combinations. Typography profiles are `editorial` (Newsreader headings, Manrope
body), `humanist` (Manrope throughout), and `technical` (system UI fonts with
monospace metadata). For recipes, icon treatment and opt-in gradients, see
[palettes, typography and decorative accents](guides/appearance.md).

Top navigation can also opt into `appearance.navigation: glass` for a translucent
menu that stays near the top while scrolling. It does not change a sidebar; see
the [top-menu recipe and fallbacks](guides/appearance.md#use-a-translucent-top-menu).

Existing fine-grained overrides remain available:

```yaml
appearance:
  contentWidth: 1160
  light:
    accent: '#5146a5'
    paper: '#fcfcfe'
  dark:
    accent: '#b6abed'
    paper: '#141827'
  bodyFont: "'Manrope Variable', sans-serif"
  headingFont: "'Newsreader Variable', Georgia, serif"
```

The `light` and `dark` mappings accept `paper`, `surface`, `ink`, `muted`, `accent`
and `line`, using six-digit hexadecimal colors. Explicit values override the named
palette; omitted values inherit it, or the theme when no palette is selected.
Explicit `bodyFont` and `headingFont` override the corresponding typography profile.
`contentWidth` is in pixels (720–1600). Setting a font family does not download that
font: load additional local fonts through your CSS entry point. Check both modes
and text contrast after changing colors.

## Caption alignment

Configure figure and table captions independently in `sciastro.yaml`:

```yaml
appearance:
  captions:
    figures: center
    tables: left
```

Both settings accept `left`, `center`, `right` or `justify`, and default to
`center` when omitted. They apply in every theme, to individual and group sites.
The figure setting covers composed images, Markdown figures and notebook image
outputs; the table setting covers Markdown table captions and saved HTML table
captions in notebooks.

For a composed image, `captionAlign` overrides the figure default:

```yaml
image:
  src: /images/convergence.svg
  alt: Error decreases under mesh refinement
  caption: Absolute error at successive mesh resolutions.
  captionAlign: left
```

This field also works on profile images, card images and logos. Source and
license links follow the caption's left, center or right alignment; `justify`
keeps those links left-aligned. Caption alignment does not move or crop the image.

Markdown `figure` and `table` directives use `caption-align="left"`; notebook
image outputs use `metadata.sciastro.captionAlign`. See the
[writing guide](guides/writing.md#figures-plots-and-captions) for examples and
notebook limitations.

Additional site settings include Markdown `copyright` and `footer`, optional `structuredData`
(JSON-LD), `favicon`, and `ui` (translated overrides for existing interface labels).
`themeStorageKey` defaults to `sciastro-theme`; keep an existing site's key during a
migration if you want returning visitors' light/dark choices to remain active.

## Footer

Use `copyright` for the first row, opposite the **Built with SciAstro** link.
It replaces the repeated site name. Use `footer` for licensing or other notes
below that row; both fields accept Markdown and translations:

```yaml
copyright: © 2026 Researcher Name · [Institute](https://example.org)
footer:
  pt: 'Textos: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). [Créditos](/creditos/).'
  en: 'Text: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). [Credits](/en/credits/).'
```

Without `copyright`, the first row shows `name`. License notes use the full footer
width, with natural wrapping on narrow screens. There is no need for HTML or CSS
to align the copyright and framework credit.

## Advanced extensions

Register code in `astro.config.mjs`; editorial YAML does not import executable code.

```js
import { defineConfig } from 'astro/config';
import sciastro from 'sciastro';

export default defineConfig({
  integrations: [sciastro({
    styles: ['./src/styles/custom.css'],
    components: {
      sections: { 'project-note': './src/components/ProjectNote.astro' },
      // layout: './src/layouts/MyLayout.astro',
    },
  })],
});
```

Use `{ type: custom, component: project-note, title: ..., text: ... }` in a page.
A component receives `{ site, page, section }`. Text translations, Markdown HTML
and icons have already been prepared. `section.props` is an optional opaque object;
custom components are responsible for validating/interpreting their own props.
Never render arbitrary prop HTML without sanitizing it.

```astro
---
import type { BuiltSection } from 'sciastro';
interface Props { section: BuiltSection }
const { section } = Astro.props;
---
<aside class="project-note" id={section.id}>
  <h2>{section.title}</h2>
  <div class="prose" set:html={section.html} />
</aside>
```

Registering an existing section name, such as `cards`, replaces that renderer for
composed pages. A custom layout receives `{ site, page }` and the default slot;
render the slot to retain page content. Layout extensions are also used on the 404
page, which has a smaller page descriptor and no section collection.

Public extension imports:

- `sciastro`: integration, schemas and `BuiltSite`, `BuiltPage`, `BuiltSection` types.
- `sciastro/sections`: section/page schemas and the section builder.
- `sciastro/components/Layout.astro`: default layout, usable as a wrapper.
- `sciastro/components/Section.astro`: default section renderer.
- `sciastro/components/Figure.astro` and `sciastro/components/Links.astro`.

Theme CSS variables are the stable styling surface. Internal DOM classes and
unexported files are not an extension API. Do not edit `node_modules/sciastro`.
Additive configuration fields use `schemaVersion: 1`;
future incompatible contracts require a version change and migration instructions.
