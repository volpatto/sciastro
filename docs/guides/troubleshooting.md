# Troubleshooting

## Another Astro dev server is already running

Open the URL Astro reports, or stop the existing preview before starting another.
In a generated website, run `pixi run --locked dev-stop`. In the SciAstro repository,
use `dev-stop`, `dev-individual-stop` or `dev-lncc-stop` for the relevant example.
Do not terminate an unrelated site's preview.

## Connection refused

Start the appropriate preview and read the printed address. Consumer websites
usually use port 4321; framework examples use 4340, 4341 and 4342; MkDocs uses 8000.
A generated `dist/` directory by itself does not start a web server.

## Frozen lockfile failure on first install

A newly generated site has no lockfiles yet. Run `pixi install` and
`pixi run pnpm install` once (or install the local archive), then commit both
lockfiles. Use locked commands afterward. In the framework checkout, the lockfiles
already exist: keep `--locked` and fix any mismatch rather than silently updating CI.

## Package not found on npm

For regular releases, use `sciastro@latest` or an exact published version. Older
instructions using `sciastro@next` select a separate prerelease channel, which may
still point to an older release. For unpublished changes, use the
[archive installation](../getting-started.md#create-a-site-from-a-local-archive).
A `file:../...`
dependency also fails on another machine when its referenced archive is missing;
use an npm version or a committed archive inside the consumer repository.

## Missing translation, image or reference

Run `pixi run --locked pnpm check` in the website. Fill every enabled translation,
check case-sensitive filenames under `content/` or `public/`, and confirm that each
citation key occurs exactly once in the configured BibTeX library. On Linux,
`Logo.svg` and `logo.svg` are different files.

## A page or research card disappeared

Automatic pages depend on their content. Empty research/team/publication lists
omit those pages. `pageFiles` replaces all automatic page definitions, and
`navigation` selects existing pages for the menu. Check the relevant mode and
identifiers before adding duplicate definitions.

## Styles or links break after deployment

Check the origin and trailing-slash `base` in the [deployment guide](deployment.md).
Do not include the base a second time in content paths. Rebuild after changing the
hosting destination; copying an old build to a new subdirectory is insufficient.

## Docs build fails

Run `pixi run --locked -e docs docs-build` from the framework root. Strict mode
reports missing pages and broken internal anchors as errors. Python dependencies
belong in the `docs` Pixi feature; they are not installed in the default environment.
See [documentation development](../development/documentation.md).

## Release authentication or partial publication fails

See [release recovery](../development/releases.md#recover-a-failed-release).
Do not move a published tag or reuse its version for different contents.
