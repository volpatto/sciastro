# Languages and navigation

## Choose the languages

```yaml
locales: [pt, en]
defaultLocale: pt
```

The default language is at the site root; other languages use a prefix.
With this example, Research is `/pesquisa/` and `/en/research/`. With
`locales: [en]` and `defaultLocale: en`, it is `/research/`.
The individual site's Supervision page uses the Team route (`/team/` in English).

A plain string is shared across languages. A mapping must supply every enabled
language; SciAstro does not silently fall back to a different language:

```yaml
title: { pt: Pesquisa, en: Research }
```

Body fields contain **filenames**, not prose. Translate the filenames and create
each corresponding file. In composed sections, `text` contains Markdown directly.
Only `pt` and `en` are supported in this release. Flags are presentation choices,
not additional locale support; see [icons](../icones.md).

## Change menu order

For automatic pages, built-in identifiers are `home`, `research`, `team` and
`publications`; extra pages use their `slug`. For composed pages, use the page `id`.

```yaml
navigation: [home, research, software, team, contact]
```

This selects and orders **existing top-level** pages; it does not create a page. Omit the
array for the normal automatic order or `pageFiles` order. In a composed page,
`navigation: false` hides it even when its ID is in the site-wide list. This is
useful for credits or detailed project pages linked from content.

Set a page's `parent` to create a nested menu. The root `navigationDepth` controls
how many levels are displayed (default `2`); deeper pages remain available through
their URLs, breadcrumbs and `layout: listing` indexes. Hidden parents hide their
menu branch, while `draft: true` excludes a page entirely. See
[Articles, Markdown and notebooks](writing.md#hierarchy-and-menu-depth).

## Preserve URLs

Automatic pages support explicit route overrides, including language prefixes:

```yaml
routes:
  team: { pt: orientacoes/, en: en/supervision/ }
```

Composed pages set `paths` inside each page file instead:

```yaml
paths: { pt: pesquisa/, en: en/research/ }
```

These paths exclude the deployment `base`, use no initial slash, and end in `/`.
The default-language home path is `''`; a secondary homepage might be `en/`.
All composed pages require a path for each enabled language. Avoid changing
published URLs without configuring redirects on your host.

## Interface labels

The `ui` mapping overrides existing interface labels, for example:

```yaml
ui:
  faculty: { pt: Docentes, en: Faculty members }
  students: { pt: Estudantes, en: Students }
```

Available keys are listed in the [configuration reference](../reference/configuration.md).
To change a composed page's menu label, edit its `title` instead. To give it a longer
visible heading, set `heading` while keeping a short `title`.
