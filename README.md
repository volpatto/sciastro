# SciPages

[![CI](https://github.com/volpatto/scipages/actions/workflows/ci.yml/badge.svg)](https://github.com/volpatto/scipages/actions/workflows/ci.yml)
[![Astro](https://img.shields.io/badge/Astro-BC52EE?logo=astro&logoColor=white)](https://astro.build/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Pixi](https://img.shields.io/badge/Pixi-41B3A3)](https://pixi.sh/)

Academic websites for researchers and research groups, maintained through **YAML,
Markdown and BibTeX**. SciPages supplies the pages, themes and validation as a
package; each website owns its content and public assets. The output is a static
site suitable for GitHub Pages or any static web server.

**Current version: `0.1.0-alpha.0`.** The package can be built and installed locally
as a `.tgz` archive. It has not been published to npm. Configuration may change
during the alpha period; incompatible changes should include migration instructions.

The package documentation is in English. The example websites intentionally keep
Portuguese as their default language and include English translations. You can
build a Portuguese-only, English-only or bilingual site.

## Features

- **Research groups:** a Home page with a brief overview and research cards linking
  to the corresponding sections on the Research page.
- **Individual researchers:** an About page and a Supervision page.
- **People:** faculty, researchers, active students grouped by level, and alumni.
- **Research:** short card summaries and detailed Markdown, with optional figures.
- **References:** local BibTeX files, `[@key]` citations, per-page bibliographies,
  and an explicitly selected list of the site's own publications.
- **Additional pages:** software, teaching, projects, CV and contact, defined in YAML.
- **Themes:** `classic` (violet, serif headings) and `modern` (green, sans-serif),
  with light/dark modes and responsive layouts.
- **Languages:** Portuguese and English, together or separately, with translation validation.
- **Icons:** menu icons and Brazilian/British language flags by default; replace
  them with catalog icons or local images, or hide them through YAML.
- **CLI:** create a project and validate its content with `scipages`.

The examples contain **fictional people, institutions and publications**, clearly
identified in the footer. They are demonstration websites, not real academic profiles.

## Install the development environment

Install Git and **Pixi 0.72.2 or newer**. The project environment supplies Node.js 24
and pnpm 11.19.0, so neither needs to be installed globally.

- [Download Pixi](https://github.com/prefix-dev/pixi/releases).
- [Official Pixi installation instructions](https://pixi.prefix.dev/latest/installation/).
- [Download Git](https://git-scm.com/downloads/).

On Linux or macOS:

```sh
curl -fsSL https://pixi.sh/install.sh | sh
```

On Windows, in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -c "irm -useb https://pixi.sh/install.ps1 | iex"
```

Reopen your terminal and check `pixi --version`. If you have not cloned the repository:

```sh
git clone https://github.com/volpatto/scipages.git
cd scipages
```

From the SciPages repository directory:

```sh
pixi install --locked
pixi run --locked dev
```

Open `http://127.0.0.1:4340/` for the research-group example. This task installs
locked dependencies, compiles the package and starts the preview. For the individual example:

```sh
pixi run --locked dev-individual
```

Open `http://127.0.0.1:4341/`. With the bundled Astro version, preview processes
continue in the background after the terminal closes. Stop them explicitly:

```sh
pixi run --locked dev-stop
pixi run --locked dev-individual-stop
```

If you see `Another astro dev server is already running`, open the reported URL
or stop that example before starting it again. A connection-refused page usually
means its preview server is not running.

| Command | Purpose |
| --- | --- |
| `pixi run --locked setup` | Install package dependencies using the lockfile |
| `pixi run --locked build` | Compile the SciPages package into `dist/` |
| `pixi run --locked test` | Compile and run content, bibliography and icon tests |
| `pixi run --locked verify` | Check types, tests, examples and independently installed consumers |
| `pixi run --locked browser-install` | Download the Chromium version used by browser tests |
| `pixi run --locked test-browser` | Build the examples and run browser tests |
| `pixi run --locked verify-all` | Run all package and browser checks; install Chromium first |
| `pixi run --locked dev` | Preview the group example |
| `pixi run --locked dev-individual` | Preview the individual example |
| `pixi run --locked pack` | Create an installable `.tgz` archive in `artifacts/` |

The Pixi lockfile covers Linux x86-64, Windows x86-64, and Intel/Apple Silicon macOS.
Package CI targets Linux, macOS and Windows; browser CI runs Chromium on Linux.
Local validation does not replace an actual run on those CI runners.

## Create an independent website from the local package

From the SciPages repository:

```sh
pixi run --locked pack
pixi run --locked node dist/cli.js init ../my-group --kind group
```

Use `--kind individual` for a personal website. The generator accepts a new or
empty directory only; it does not overwrite an existing project, install dependencies
or publish anything.

In the generated project:

```sh
cd ../my-group
pixi install
pixi run pnpm add scipages@file:../scipages/artifacts/scipages-0.1.0-alpha.0.tgz --save-exact
pixi run dev
```

The archive path assumes `scipages` and `my-group` are sibling directories. Adjust
it to match your filesystem. The generated site consumes the packaged artifact;
it does not depend on the SciPages source checkout.

The first installation creates `pixi.lock` and `pnpm-lock.yaml`. Commit both to
version control. Subsequent installations can use `pixi install --locked` and
`pixi run --locked dev`. Generated websites use port `4321` unless the terminal
reports another address.

Pixi is optional if you already have Node.js 24 and pnpm 11.19.0. The generated
project also provides `pnpm dev`, `pnpm check` and `pnpm build`.

## Files you edit

```text
scipages.yaml              Identity, site kind, languages, theme, icons and bibliography
content/
  home.pt.md               Portuguese introduction
  home.en.md               English introduction
  research.yaml            Research cards and paths to detailed text
  research/*.md            Full research descriptions
  team.yaml                People, student levels and membership status
  references.bib           References available for citation
  pages.yaml               Additional pages, in navigation order
  *.md                     Additional page content
public/                    Images, PDFs and other public files
astro.config.mjs           Connection to the package; normally unchanged
```

Components and styles belong to the installed package. Editing content or switching
the theme or site kind does not require TypeScript or Astro knowledge.

For example, an English-only site can use:

```yaml
schemaVersion: 1
kind: group
name: My research group
description: Research in applied mathematics.
url: https://example.org
base: /
locales: [en]
defaultLocale: en
theme: classic
home:
  body: home.en.md
bibliography:
  file: references.bib
  style: apa
  publications: [silva2025]
```

A shared string can be written directly. Translated text uses `pt` and `en` fields;
every enabled language needs a value. For a bilingual site use `locales: [pt, en]`
and choose either `defaultLocale: pt` or `defaultLocale: en`. The default language
lives at the root URL; the other uses its language prefix.

Empty sections are omitted from navigation. `research.yaml`, `team.yaml` and
`pages.yaml` are optional. Bibliography configuration is also optional when no
references or publications are needed.

### Customize icons

Menu icons and the Brazil (PT) / United Kingdom (EN) flags are enabled by default.
Override only the items you want to change in `scipages.yaml`:

```yaml
icons:
  navigation:
    research: lucide:microscope
    publications: false
  languages:
    pt: circle-flags:br
    en: circle-flags:gb
```

`false` hides an icon while preserving its text label. Additional pages accept an
`icon` field in `content/pages.yaml`. See the [icon guide](docs/icones.md) for
catalogs, custom images, configuration keys and disabling options.

See the complete [group](starters/group) and [individual](starters/individual)
starters, the [content guide](docs/conteudo.md), and the
[reference guide](docs/referencias.md).

## Build and deploy a website

**Inside the generated website**, run:

```sh
pixi run --locked build
```

This validates its files and generates the website in `dist/`. Copy the **contents**
of that directory into the hosting server's public directory, preserving its
subdirectories. Production only needs a static file server: there is no database
or Node.js application process to maintain.

For a destination such as `https://www.example.org/groups/horizon/`, configure:

```yaml
url: https://www.example.org
base: /groups/horizon/
```

The `SITE_URL` and `BASE_PATH` environment variables can override these values at
build time. Canonical URLs and internal links use them. Rebuild when changing the
deployment address instead of moving output generated for another destination.

Configure directory requests to serve `index.html`, and missing URLs to serve
`404.html` with HTTP status 404. Do not use a single-page-app fallback that returns
the homepage for every unknown URL.

For GitHub Pages, select **Settings → Pages → Source → GitHub Actions**, build your
consumer website and deploy its `dist/`. This repository's workflow checks the
**package**; it does not deploy the examples or publish to npm.

**There are two different `dist/` directories:** at the SciPages root it contains
the compiled package; inside a consumer or `examples/group/` it contains the
publishable website.

## Automated testing and CI

Run the package checks without installing a browser:

```sh
pixi run --locked verify
```

This checks TypeScript/Astro, runs automated content/BibTeX/icon tests, builds both
examples, and installs the actual `.tgz` into independent temporary projects. The
consumer checks cover CLI execution, configuration overrides, assets, links,
anchors, citations and team grouping, including deployment under a subdirectory.

For the complete suite, install Chromium once, then run:

```sh
pixi run --locked browser-install
pixi run --locked verify-all
```

On Linux, browser system libraries may also be required:

```sh
pixi run --locked pnpm exec playwright install --with-deps chromium
```

The browser suite tests both site kinds on desktop and mobile: navigation, icons,
language switching, persistent themes, research/citation anchors, team sections,
404 recovery and navigation with JavaScript disabled. It serves the generated
static sites on ports `4360` and `4361`; it does not use or stop the previews on
`4340`/`4341`. Browser binaries are needed only for testing, not for building or hosting.

[GitHub Actions](.github/workflows/ci.yml) runs on pushes, pull requests and manual
dispatch. It performs package verification on Linux, macOS and Windows, plus
browser verification on Linux. Failures fail the corresponding job. The
`browser-test-report` artifact contains an HTML report, JUnit results and traces /
screenshots for failed browser tests. The README badge reflects this workflow.

See [Testing and contributing](docs/testing.md) for focused commands, reports and
regression-test guidelines. Automated checks do not establish the scientific
correctness of text, data or bibliography metadata supplied by website authors.

After changing package source, rebuild with `pixi run --locked build` and restart
the relevant preview. YAML/Markdown/BibTeX edits in an example reload automatically.
Keep `starters/` and `examples/` synchronized when changing starter content.

The [architecture guide](docs/arquitetura.md) explains the implementation. To update
a consumer, install the new package and rebuild; preserve its content and do not
run `init` over the existing website.

## Scope and licenses

This alpha supports file-based configuration and two built-in themes. Lattes/ORCID
importers, a visual editor, external themes and automatic configuration migrations
are not implemented. Only Portuguese and English UI labels are currently supported.
BibTeX processing is local and does not fetch references at runtime.

Package code, documentation and fictional example content: [MIT](LICENSE).
User-provided materials retain their own licensing conditions. Dependencies retain
their licenses: [Astro](https://astro.build/), [Citation.js](https://citation.js.org/),
[markdown-it](https://github.com/markdown-it/markdown-it), [YAML](https://eemeli.org/yaml/),
[Zod](https://zod.dev/), [sanitize-html](https://github.com/apostrophecms/sanitize-html),
and the [icon collections](docs/icon-licenses.txt). Browser testing uses
[Playwright](https://playwright.dev/).
