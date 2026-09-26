# My SciAstro website

Edit `sciastro.yaml` and the files in `content/`. Put public images and downloads
in `public/`. If configured, references live in `content/references.bib`; cite them with `[@key]`.
Generated pages and styles are provided by the SciAstro package.

Analytics is optional and off by default. Configure Cloudflare Web Analytics or
Umami following the [analytics guide](https://volpatto.github.io/sciastro/guides/analytics/).
Set the provider and public site identifier in `sciastro.yaml`; no custom
JavaScript is needed. Local previews are excluded from tracking.

## Set up the environment

Install [Pixi](https://pixi.prefix.dev/latest/installation/). Pixi installs Node.js
24 and pnpm 11.19.0 for this project, so you do not need global installations.

In this website's directory:

```sh
pixi install
```

Install the dependencies pinned by the generated project:

```sh
pixi run pnpm install
```

For unpublished framework changes, install a local package archive instead.
Assuming sibling `sciastro` and website directories:

```sh
pixi run pnpm add sciastro@file:../sciastro/artifacts/sciastro-VERSION.tgz --save-exact
```

The archive is created with `pixi run --locked pack` in the SciAstro repository.
Replace `VERSION` with the archive version printed by `pack` and adjust the path.

Start the preview:

```sh
pixi run dev
```

Open the address printed in the terminal, usually `http://127.0.0.1:4321/`.
Commit `pixi.lock` and `pnpm-lock.yaml` after the first successful installation.
For future installations use `pixi install --locked` and `pixi run --locked dev`.

The preview can remain running after you close the terminal. Stop it with:

```sh
pixi run --locked dev-stop
```

## Language and content

The individual/group starters include Portuguese and English, with Portuguese as the default.
Use `locales: [en]` and `defaultLocale: en` for an English-only site, or keep both
languages and set `defaultLocale: en` for English at the root URL. Existing English
content files are ready to edit; research/person names in the starter are fictional.
The course starter is Portuguese-only. To change its language, update `locales`,
`defaultLocale`, page paths and text together; adding a language requires a path
and translation for every page.

- `sciastro.yaml`: site identity, languages, theme, icons and bibliography settings.
- `content/home.*.md`: introduction.
- `content/research.yaml` and `content/research/`: research cards and details.
- `content/team.yaml`: faculty, researchers, active students and alumni. To use a
  different name, set `people.file` in `sciastro.yaml` (relative to `contentDir`)
  and move this file to the selected path.
- `content/pages.yaml`: additional pages and their Markdown paths.
- `content/references.bib`: available citations; select your own work separately
  in `bibliography.publications`.

The course uses an explicit `pageFiles` list instead: edit `content/pages/*.md`
and `.yaml`, `content/notebooks/*.ipynb` and `content/plots/*.json`. These files
define the overview, syllabus, lesson index and computational materials.
See the [course tutorial](https://volpatto.github.io/sciastro/tutorials/course/).

Use `layout` in `sciastro.yaml` to choose top/sidebar navigation and an optional
right-side context panel. Article notebook/PDF actions are controlled by
`downloads`; PDF opens the browser print dialog. The notebook example contains
no executed cells or saved outputs: run it in your own Jupyter environment to
produce results. See [layouts](https://volpatto.github.io/sciastro/guides/layouts/)
and [downloads](https://volpatto.github.io/sciastro/guides/downloads/).

## Validate, build and deploy

Check content without producing a website:

```sh
pixi run pnpm check
```

Before deployment, set `url` and `base` in `sciastro.yaml`. For a site hosted at
`https://example.org/my-group/`, use `url: https://example.org` and `base: /my-group/`.
For a university personal page at `https://institute.example/~username/`, use:

```yaml
url: https://institute.example
base: /~username/
```

`SITE_URL` and `BASE_PATH` can also override the destination. SciAstro reads them
from the process environment; placing them in `.env` alone does not configure the
build. For example, in a POSIX shell:

```sh
SITE_URL='https://institute.example' BASE_PATH='/~username/' pixi run --locked build
```

With the destination saved in `sciastro.yaml`, run:

```sh
pixi run --locked build
```

This checks the content and generates `dist/`. Preview it with
`pixi run --locked pnpm preview`, using the printed URL including `/~username/`
when configured. If you built with environment overrides, pass the same values
to the preview command. Stop it with `pixi run --locked pnpm preview:stop`.

Build locally and publish only the **contents** of `dist/`, preserving its
directories. For a server that maps your public address to `~/htdocs/`, upload
`dist/index.html` as `~/htdocs/index.html`, alongside `_astro/` and the generated
page directories. Do not nest the enclosing `dist/` folder or create a
`~username/` directory there. Confirm the public directory with your institution
and preserve existing server files such as `.htaccess`.

The production server only needs to serve static files, including `index.html`
for directories and `404.html` with HTTP 404 for missing pages. It does not need
Node.js, Pixi, pnpm or Chromium. Rebuild whenever the public origin or base changes.
See the [deployment guide](https://volpatto.github.io/sciastro/guides/deployment/)
for the complete university hosting workflow, optional Apache UTF-8 settings,
and explanations of NFS cache warnings and browser-test dependencies.

For package development, installation details and configuration guides, see the
[SciAstro README](https://github.com/volpatto/sciastro#readme).
