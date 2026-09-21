# Deploy a website

SciAstro produces a static website. The build environment needs Node.js and the
package dependencies; the production server only serves the generated files.
This guide deploys a **consumer website**, not the SciAstro documentation.

## Set the final address

| Public address | `url` | `base` |
| --- | --- | --- |
| `https://username.github.io/` | `https://username.github.io` | `/` |
| `https://username.github.io/lab/` | `https://username.github.io` | `/lab/` |
| `https://institute.example/research/group/` | `https://institute.example` | `/research/group/` |

Set these fields in `sciastro.yaml`. In content, write `/images/logo.svg` and
`/research/` without the base prefix; SciAstro adds it. You can override the origin
and base with `SITE_URL` and `BASE_PATH` during a build, which is useful when
publishing the same content at a second destination.

## Build and preview

From a generated website with both lockfiles committed:

```sh
pixi install --locked
pixi run --locked build
pixi run --locked pnpm preview
```

The preview shows the production build; use the URL printed by Astro, including
any base path. Stop it with `pixi run --locked pnpm preview:stop`.
Inspect mobile navigation, both languages, references, images and PDF downloads.

## GitHub Pages

For a user site, name the repository `username.github.io` and use `base: /`.
A project repository such as `lab` normally uses `base: /lab/`.
In the repository's **Settings → Pages**, choose **GitHub Actions** as the source.
Add `.github/workflows/pages.yml` to the **website** repository:

```yaml
name: Build and deploy website
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: website-pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: prefix-dev/setup-pixi@v0.10.2
        with:
          pixi-version: v0.72.2
          locked: true
      - run: pixi run --locked build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/
  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

This consumer workflow updates the personal/group site on `main`. The framework's
own [release workflow](../development/releases.md) separately updates its MkDocs
site **only** after a version tag passes checks and publication succeeds.

## Other static hosting

Copy the **contents** of `dist/` to the configured document root/subdirectory,
preserving filenames and directories. Configure the server to serve `index.html`
for directory requests and `404.html` with a 404 response for missing pages.
Do not publish `node_modules/`, `.pixi/`, source configuration or private files.
No running Node.js process, Python service or database is required in production.

Changing the deployment path requires rebuilding with the new `url`/`base`.
Configure HTTPS and any redirects/custom domain on the hosting platform.

## Update SciAstro

Use an exact available version and keep the lockfile change with your website:

```sh
pixi run pnpm add sciastro@VERSION --save-exact
pixi run --locked build
```

Replace `VERSION` with the release you reviewed. Follow migration notes, then test
before deploying. To roll back a consumer site, restore its previous dependency,
lockfile and content and rebuild; npm versions are not overwritten.
