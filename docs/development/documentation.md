# Work on the documentation

The documentation uses MkDocs Material with a neutral blue-grey palette, system
fonts, search, code-copy controls and light/dark modes. It does not use the
ThermoPhase branding or require a font service.

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
- `docs/tutorials/`: end-to-end individual and group examples.
- `docs/guides/`: focused tasks and section recipes.
- `docs/reference/`: configuration, CLI and public API.
- `docs/development/`: documentation and release maintenance.
- `docs/hooks.py`: records the version from `package.json` in build metadata; it does
  not place numeric versions in the documentation text.
- `docs/site-readme.md`: README copied into generated websites, excluded from navigation.
- `docs/*-licenses.txt`: runtime attribution notices; keep these in the npm package.

The generated website is `site/`, ignored by Git. It is not part of the npm package.
The documentation sources remain in the repository; only the generated-site README
and required attribution notices under `docs/` are packaged for consumers.

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
