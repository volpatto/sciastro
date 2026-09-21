# Testing and contributing

Run these commands from the SciAstro repository, not from a generated website.
Install [Pixi](https://pixi.prefix.dev/latest/installation/) first, then run
`pixi install --locked`. The tasks install the pnpm dependencies using the lockfile.

## Test layers

| Layer | Location | What it verifies |
| --- | --- | --- |
| Types and components | `pnpm check` | TypeScript contracts and Astro diagnostics |
| Composition and themes | `tests/composition.test.mjs` | Explicit routes, menu order, assets, strict fields, translations, tokens and section citations |
| Content and bibliography | `tests/*.test.mjs` | Translation requirements, routes, optional sections, team levels, BibTeX parsing, citation links and errors |
| Icons | `tests/icons.test.mjs` | Defaults, overrides, disabling, aliases, SVG IDs, invalid names and local files |
| Installed package | `scripts/test-package.mjs` | Actual archive installation, CLI entry points, generated sites, root/subdirectory deployment, links/assets/anchors and grouping |
| Browser interactions | `tests/browser/*.spec.mjs` | All three themes and both site kinds at desktop/mobile widths, navigation, languages, theme persistence, icons, citations, team sections, 404 and no-JavaScript behavior |

The browser tests use **Chromium**. Mobile tests use a 390 × 844 viewport; they do
not emulate a physical device or establish compatibility with Safari or Firefox.
The desktop viewport is 1280 × 800. Each test gets a fresh context, with no saved
preferences from another test. Unhandled page JavaScript exceptions fail the test.

## Run checks locally

Content, bibliography and icon tests (includes compilation):

```sh
pixi run --locked test
```

Types, unit/content tests, example builds and isolated package installations:

```sh
pixi run --locked verify
```

Install the matching browser once, or after updating Playwright:

```sh
pixi run --locked browser-install
```

On Linux, install required browser system libraries if needed:

```sh
pixi run --locked pnpm exec playwright install --with-deps chromium
```

Browser tests, including compilation and example builds:

```sh
pixi run --locked test-browser
```

All checks, without repeating the example builds:

```sh
pixi run --locked verify-all
```

For focused debugging **after building the current source and examples**:

```sh
pixi run --locked pnpm exec node --test tests/icons.test.mjs
pixi run --locked pnpm exec playwright test --project=group-mobile
pixi run --locked pnpm exec playwright test --grep "language switch"
```

Browser tests serve the static example output on `127.0.0.1:4360`, `:4361` and `:4362`.
Playwright starts and stops those servers. If a port is occupied, the run fails
rather than reusing an unrelated process. Keep those ports available. The user's
development previews on `4340`/`4341`/`4342` are independent.

## Reports and failures

Results are written under `.test-output/`, which is ignored by Git:

- `playwright-report/`: HTML report.
- `junit.xml`: machine-readable browser test results.
- `browser/`: failure screenshots and execution traces.

Open the HTML report locally:

```sh
pixi run --locked pnpm exec playwright show-report .test-output/playwright-report
```

The report lists assertions and can open a trace for a failed test. There are no
automatic retries: a failing or intermittent test needs investigation. CI also
rejects committed `test.only` calls instead of silently skipping other tests.

## Continuous integration

[The workflow](../.github/workflows/ci.yml) runs on pushes to every branch, pull
requests and manual dispatch:

1. **Package Tests (Linux/macOS/Windows)** installs the locked Pixi environment and runs
   separate type checks, builds, Unit Tests and Installed Package Tests on each platform.
2. **Browser Tests (Chromium)** installs the locked environment and Chromium/system
   dependencies on Linux, then runs `pixi run --locked test-browser`.
3. The browser job uploads `browser-test-report` even when tests fail, provided
   reports were generated and the job was not canceled. Artifacts are retained
   for 14 days.

A failed check fails the workflow. The workflow has read-only repository access
and does not publish packages or deploy sites. To **prevent merging** with failing
checks, a repository administrator must also make the workflow's jobs required in
GitHub branch protection or a ruleset; merely defining CI does not enforce that.

## Adding or changing behavior

- Add a focused regression test when fixing a bug; it should fail for the original
  behavior and pass with the fix.
- Test public behavior and error messages useful to authors, rather than copying
  implementation details into assertions.
- Cover configuration changes in the content/icon tests; cover interaction changes
  in browser tests. Changes to package exports, files or scaffolding should also
  exercise the installed-consumer checks.
- Keep fixtures fictional and self-contained. Do not add credentials or rely on
  third-party websites for a test to pass.
- Update both starters and examples when changing their shared configuration.
- Keep documentation in English. Portuguese and English example content can
  remain bilingual, with Portuguese as the default.
- Run `pixi run --locked verify-all` before submitting changes. Review the diff
  and the generated site when visual presentation changes.

Test success is not a numerical or scientific validation of content. The suite
also does not claim exhaustive accessibility coverage, full code coverage, or
visual equivalence across all browsers. Add tests as behavior and supported
platforms evolve.

The **Tests** badge and workflow explicitly identify software tests. `verify` and
`verify-all` are aggregate local tasks that also include non-test type checks and
builds. Installed Package Tests launch real development servers to detect errors
that static builds cannot reveal, including stylesheet externalization. They also
build the composed LNCC example with local extensions under a nested base path.
