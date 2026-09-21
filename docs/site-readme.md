# My SciAstro website

Edit `sciastro.yaml` and the files in `content/`. Put public images and downloads
in `public/`. References live in `content/references.bib`; cite them with `[@key]`.
Generated pages and styles are provided by the SciAstro package.

## Set up the environment

Install [Pixi](https://pixi.prefix.dev/latest/installation/). Pixi installs Node.js
24 and pnpm 11.19.0 for this project, so you do not need global installations.

In this website's directory:

```sh
pixi install
```

**If SciAstro is not published on npm yet**, install a local package archive before
running the normal installation. Assuming sibling `sciastro` and website directories:

```sh
pixi run pnpm add sciastro@file:../sciastro/artifacts/sciastro-VERSION.tgz --save-exact
```

The archive is created with `pixi run --locked pack` in the SciAstro repository.
Replace `VERSION` with the archive version printed by `pack` and adjust the path. If you have a version already
published to npm, use `pixi run pnpm install` instead.

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

The starter includes Portuguese and English, with Portuguese as the default.
Use `locales: [en]` and `defaultLocale: en` for an English-only site, or keep both
languages and set `defaultLocale: en` for English at the root URL. Existing English
content files are ready to edit; research/person names in the starter are fictional.

- `sciastro.yaml`: site identity, languages, theme, icons and bibliography settings.
- `content/home.*.md`: introduction.
- `content/research.yaml` and `content/research/`: research cards and details.
- `content/team.yaml`: faculty, researchers, active students and alumni.
- `content/pages.yaml`: additional pages and their Markdown paths.
- `content/references.bib`: available citations; select your own work separately
  in `bibliography.publications`.

## Validate, build and deploy

Check content without producing a website:

```sh
pixi run pnpm check
```

Before deployment, set `url` and `base` in `sciastro.yaml`. For a site hosted at
`https://example.org/my-group/`, use `url: https://example.org` and `base: /my-group/`.
`SITE_URL` and `BASE_PATH` can also override the destination during the build.

```sh
pixi run --locked build
```

This checks the content and generates `dist/`. Publish only the contents of
`dist/`, preserving its directories. The production server only needs to serve
static files, including `index.html` for directories and `404.html` with HTTP 404
for missing pages. No Node.js process is needed on the hosting server.

For package development, installation details and configuration guides, see the
[SciAstro README](https://github.com/volpatto/sciastro#readme).
