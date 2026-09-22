---
title: Overview
---

# SciAstro {.sciastro-visually-hidden}

<div class="sciastro-hero">
  <picture class="sciastro-banner sciastro-banner--light">
    <source media="(max-width: 40rem)" srcset="assets/brand/sciastro-banner-compact-light.svg" width="900" height="460">
    <img src="assets/brand/sciastro-banner-light.svg" alt="SciAstro — Academic websites as easy as Markdown and YAML" width="1600" height="480" fetchpriority="high">
  </picture>
  <picture class="sciastro-banner sciastro-banner--dark">
    <source media="(max-width: 40rem)" srcset="assets/brand/sciastro-banner-compact-dark.svg" width="900" height="460">
    <img src="assets/brand/sciastro-banner-dark.svg" alt="SciAstro — Academic websites as easy as Markdown and YAML" width="1600" height="480" fetchpriority="high">
  </picture>
</div>

SciAstro is a package for academic websites **built on [Astro](https://astro.build/)**,
for individual researchers and research groups. Maintain your content in
**Markdown, YAML and BibTeX**; Astro generates a static website, with the structure,
themes and content validation supplied by SciAstro.

Install regular releases from npm using `sciastro@latest`. Review the changelog
and any migration instructions when upgrading. The public documentation is deployed with releases,
so unreleased changes on `main` appear only in local previews and CI artifacts.

<div class="grid cards" markdown>

-   :material-account-outline: **An individual website**

    Biography, research, supervision, teaching, software and a downloadable CV.

    [Follow the individual tutorial](tutorials/individual.md)

-   :material-account-group-outline: **A research-group website**

    A brief overview, research areas, faculty, active students and alumni.

    [Follow the group tutorial](tutorials/group.md)

-   :material-palette-outline: **Your own presentation**

    Three themes, bilingual content, icons, composed pages and component extensions.

    [Explore customization](customization.md)

-   :material-code-braces: **Integrate and extend**

    CLI commands, configuration fields, TypeScript exports and Astro components.

    [Read the API reference](reference/api.md)

</div>

## What is included

| Need | SciAstro provides |
| --- | --- |
| Academic structure | Automatic Home/About, Research, Team/Supervision and selected Publications pages |
| Additional content | Markdown pages or explicit pages composed from ten section types |
| Presentation | `classic`, `modern`, `lncc`; responsive navigation; persistent light/dark preference |
| Languages | Portuguese and English, individually or together; translated content is checked |
| People | Faculty, researchers, students by configurable level, separate alumni |
| Citations | Local BibTeX, APA or Vancouver, linked citations and page bibliographies |
| Visual identity | Logo, favicon, navigation icons, BR/GB flags, colors and typography |
| Distribution | npm-compatible package, CLI, static output, root or subdirectory hosting |
| Quality checks | Content validation, automated package tests, installed-consumer tests and browser tests |

## Two ways to author

**Automatic pages** are the shortest path. Edit `research.yaml`, `team.yaml`,
`pages.yaml` and their Markdown files. The same research record creates a short
homepage card and a detailed research section, avoiding repeated text.

**Composed pages** give you control over every page and section. Set `pageFiles`
and write YAML pages containing profiles, cards, timelines, figures, logos and
other sections. This replaces automatic pages; the team and bibliography data
remain reusable. See [the composition guide](customization.md).

## Scope

SciAstro is a static-site package, not an online content editor or a hosting service.
It does not fetch ORCID/Lattes records, generate a CV PDF, manage user accounts,
receive contact forms or establish the scientific accuracy of a publication.
Bring your own images, PDFs and metadata. Only Portuguese and English currently
have built-in interface and bibliography localization. Examples contain fictional
people and institutions.

Start with [installation](getting-started.md), then choose a tutorial. If you
already have a website, use the [migration recipe](guides/recipes.md#migrate-an-existing-website).

## Licenses

SciAstro's code, documentation and fictional example content are released under
the [MIT License](https://github.com/volpatto/sciastro/blob/main/LICENSE),
copyright Diego Tavares Volpatto. The license text includes the required notices
and terms for reuse and redistribution.

Third-party dependencies and bundled resources retain their own licenses:

| Resource | License and notices |
| --- | --- |
| Astro, Citation.js, markdown-it, Zod and sanitize-html | MIT; see each dependency's license file |
| YAML parser | ISC; see the dependency's license file |
| Lucide icons | ISC, with MIT notices for icons derived from Feather; see [icon notices](icon-licenses.txt) |
| Circle Flags | MIT; see [icon notices](icon-licenses.txt) |
| Manrope and Newsreader fonts; STIX Two Math outlines in the SciAstro identity | SIL Open Font License 1.1; see [font notices](font-licenses.txt) |

Your website's texts, photographs, publications, institutional logos and other
supplied materials retain their own licensing conditions. Using SciAstro does
not automatically place those materials under MIT or grant permission to reuse
third-party content.
