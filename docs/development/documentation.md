# Work on the documentation

The documentation uses MkDocs Material with SciAstro's blue and purple Monogram
identity, locally hosted Manrope, search, code-copy controls and light/dark modes.
The banner follows the theme selected in the documentation, including manual
choices. Narrow screens use a compact banner with the complete tagline.

## Dedicated Pixi environment

From the SciAstro repository root, after [installing Pixi](../getting-started.md#install-pixi):

```sh
pixi install --locked -e docs
pixi run --locked -e docs docs-serve
```

Open `http://127.0.0.1:8000/`. Stop MkDocs with Ctrl+C. Unlike Astro's detached
preview behavior, this server remains attached to the terminal.

For the production build:

```sh
pixi run --locked -e docs docs-build
```

The `docs` environment contains Python, MkDocs and Material and excludes the
default Node.js/pnpm feature. The shared `pixi.lock` locks both environments for
all supported platforms. Updating a documentation dependency requires updating
that lockfile; CI always installs with `--locked`.

## Organization

- `mkdocs.yml`: navigation, theme and strict link validation.
- `docs/assets/brand/`: approved banners, monogram, favicon and sharing image.
  The repository README uses these same banners; keep their paths stable.
- `docs/assets/fonts/`: the locally hosted Manrope file, so building and reading
  the docs do not require a font service or the Node.js environment.
- `docs/stylesheets/docs.css`: brand colors for both schemes, typography and
  responsive banner styling. Theme selection remains controlled by Material.
- `docs/overrides/main.html`: link-preview metadata using the configured
  `site_url` and the branded PNG. Templates are excluded from the built content.
- `docs/tutorials/`: end-to-end individual and group examples.
- `docs/guides/`: focused tasks and section recipes.
- `docs/reference/`: configuration, CLI and public API.
- `docs/development/`: documentation and release maintenance.
- `docs/hooks.py`: records the version from `package.json` in build metadata; it does
  not place numeric versions in the documentation text.
- `docs/site-readme.md`: README copied into generated websites, excluded from navigation.
- `docs/*-licenses.txt`: runtime attribution notices; keep these in the npm package.

The generated website is `site/`, ignored by Git. It is not part of the npm package.
The documentation sources remain in the repository. Under `docs/`, the npm package
includes the generated-site README, required attribution notices and the brand
assets referenced by the repository README.

## Visual identity

Use `sciastro-banner-light.svg` and `sciastro-banner-dark.svg` for wide headers;
their compact counterparts keep the tagline legible on narrow screens. The
full-color monogram uses blue `#3859C8` and purple `#7542BC`; dark surfaces use
`#93ADFF` and `#C7A2F6`. The logo lettering is outlined, so the images need no fonts.
Font attribution for STIX Two Math and Manrope is in [the notices](../font-licenses.txt).

The docs favicon adapts to the browser's color-scheme preference independently of
the documentation's manual theme switch. Check the homepage, a content-heavy page
and a narrow viewport in both themes when changing these assets or styles.

The package's built-in header mark and SciAstro footer credit use a monochrome
version that follows the consumer theme. A website's configured logo continues
to take precedence, and portrait fallback symbols remain independent.

## Checks

Strict MkDocs builds fail on missing navigation targets, broken internal links and
missing anchors. The unit suite also reconstructs the two tutorial sites from their
named code blocks and validates their content. A public-export coverage test helps
keep the API page aligned with the implementation; it is not a proof that prose is
correct, so review behavioral descriptions when changing the API.

Use relative `.md` links inside the documentation. Link to source examples with a
full repository URL instead of a relative path outside `docs/`. Keep examples
fictional and avoid adding a dependency on private scientific assets.

## Deployment policy

CI builds and checks the documentation on every push and PR. It does **not** deploy
it then. The [release workflow](releases.md) deploys the built site only after the
same version has passed all tests and reached npm. There is no separate manual
docs-deploy workflow. The public URL shows the most recently deployed release,
including prereleases; this first implementation does not retain a version selector.
