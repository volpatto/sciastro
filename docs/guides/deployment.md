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
| `https://institute.example/~username/` | `https://institute.example` | `/~username/` |

Set these fields in `sciastro.yaml`. In content, write `/images/logo.svg` and
`/research/` without the base prefix; SciAstro adds it. You can override the origin
and base with `SITE_URL` and `BASE_PATH` during a build, which is useful when
publishing the same content at a second destination.

The origin contains no path. The base starts and ends with `/`; a literal `~`
is supported for university personal pages. Keep it literal rather than encoding
it as `%7E`. Changing either value requires a new build.

SciAstro reads overrides from the process environment; it does not load a `.env`
file automatically. Set them in your shell or CI environment before running the
command. For example, in a POSIX shell:

```sh
SITE_URL='https://institute.example' BASE_PATH='/~username/' pixi run --locked build
```

## Build and preview

From a generated website with both lockfiles committed:

```sh
pixi install --locked
pixi run --locked build
pixi run --locked pnpm preview
```

The preview shows the production build; use the URL printed by Astro, including
any base path. If the build used environment overrides, pass the same values to
`pixi run --locked pnpm preview`. Stop it with `pixi run --locked pnpm preview:stop`.
Inspect mobile navigation, both languages, references, images and PDF downloads.

## University personal pages

For a shared server that publishes `https://institute.example/~username/`, build
on your own computer and upload the result. The server needs only the static
files; installing Pixi, Node.js, pnpm or a test browser there is unnecessary.

1. In the generated website, set the public destination in `sciastro.yaml`:

    ```yaml
    url: https://institute.example
    base: /~username/
    ```

2. With the website's lockfiles present, install and build locally:

    ```sh
    pixi install --locked
    pixi run --locked build
    ```

    For a newly generated site without lockfiles, complete the
    [initial installation](../getting-started.md) first. This is the website's
    build command; the same command in the SciAstro framework repository builds
    the package instead.

3. Run `pixi run --locked pnpm preview` and inspect the address ending in
   `/~username/`, including an internal page, an image and the language switch.
   Stop the preview with `pixi run --locked pnpm preview:stop`.

4. Upload the **contents** of the website's `dist/` using your institution's file
   transfer method. If its public directory is `~/htdocs/`, the result should
   include `~/htdocs/index.html` and `~/htdocs/_astro/`, alongside the generated
   page directories. Do not create `~/htdocs/dist/` or `~/htdocs/~username/`:
   the server already maps `/~username/` to your public directory. The actual
   directory name is institution-specific; confirm it with the hosting service.
   Preserve any existing `.htaccess` and unrelated files.

5. Open the public address and verify internal links, assets, accented text and
   a missing page. An unknown URL should return HTTP 404. Keep the source and
   lockfiles locally for future updates; repeat the build and upload when content
   changes.

The URL prefix does not create an extra `~username` directory inside `dist/`.
It is included in generated links so they resolve under the server's mapping.

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

## Shared-server troubleshooting

### Accented characters display incorrectly

If the local preview is correct but the hosted page shows broken accents, check
the response's `Content-Type` in the browser's network tools. A server-supplied
legacy charset can override the HTML's UTF-8 declaration. Keep the generated
files in UTF-8 and correct the server's response encoding.

On Apache, if the hosting service permits this directive in `.htaccess`, add or
update the following line in the site's public directory:

```apache
AddDefaultCharset UTF-8
```

Preserve the rest of an existing `.htaccess`; the directive applies to HTML and
plain-text responses, so those files in its scope must use UTF-8. It requires
the host to allow the `FileInfo` override category or explicitly permit the
directive. If overrides are disabled or the change causes an HTTP 500 error,
restore the prior file and ask the administrator to set the charset. See
[Apache's AddDefaultCharset documentation](https://httpd.apache.org/docs/2.4/mod/core.html#adddefaultcharset).
SciAstro does not create this server configuration automatically.

### Styles or links are missing after upload

Verify that `base` matches the complete public prefix, that `url` contains only
the origin, and that the uploaded files come from a fresh build with those values.
Upload all of `dist/`, including `_astro/`; a page copied alone cannot load its
styles. Check for an accidentally nested `dist/` directory on the server.
If the browser reports a Content Security Policy violation, discuss the specific
blocked resource with the hosting administrator before changing the site's policy.

### Pixi reports an NFS cache or pnpm prints an update notice

A Pixi warning that a cache on NFS was redirected to a local temporary directory
reports the chosen cache location; by itself it is not an installation or build
failure. Look for the command's final result and any subsequent error. See
[Pixi's network-filesystem cache settings](https://pixi.prefix.dev/latest/reference/pixi_configuration/#netfs-redirect)
if the automatic location is unsuitable for your account.

A pnpm update notice does not require an upgrade to deploy. Use the versions
declared by the project and retain its lockfiles. Building locally also avoids
depending on the shared server's development environment.

### Browser tests cannot start on Linux

The framework's browser tests need Chromium and its operating-system libraries.
Run these checks on a development machine or CI runner with the required
[Playwright browser dependencies](https://playwright.dev/docs/browsers#install-system-dependencies).
They are not part of a generated website's `build` task and are not required on
the static hosting server. See the framework's
[testing instructions](https://github.com/volpatto/sciastro#automated-testing-and-ci)
when contributing to SciAstro.

## Update SciAstro

Use an exact available version and keep the lockfile change with your website:

```sh
pixi run pnpm add sciastro@VERSION --save-exact
pixi run --locked build
```

Replace `VERSION` with the release you reviewed. Follow migration notes, then test
before deploying. To roll back a consumer site, restore its previous dependency,
lockfile and content and rebuild; npm versions are not overwritten.
