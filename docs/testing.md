# Testing and contributing

Analytics tests cover disabled defaults, provider-specific validation, production
origin/base restrictions, Do Not Track and event precedence. Browser Tests build
isolated sites with simulated providers, including a custom layout, and check
PT/EN navigation, event counts, opt-outs, downloads and tracker failures. No real
analytics service or credentials are used. These tests run in the existing Unit
Tests and Browser Tests jobs, including release validation.

Run these commands from the SciAstro repository, not from a generated website.
Install [Pixi](https://pixi.prefix.dev/latest/installation/) first, then run
`pixi install --locked`. The tasks install the pnpm dependencies using the lockfile.

## Test layers

| Layer | Location | What it verifies |
| --- | --- | --- |
| Types and components | `pnpm check` | TypeScript contracts and Astro diagnostics |
| Composition and themes | `tests/composition.test.mjs` | Explicit routes, menu order, assets, strict fields, translations, tokens and section citations |
| Content and bibliography | `tests/*.test.mjs` | Translation requirements, routes, optional sections, team levels, BibTeX parsing, citation links and errors |
| Course scaffolding | `tests/course.test.mjs` | CLI generation, lesson hierarchy, portable paths and an explicitly unexecuted notebook across themes |
| Documentation gallery | `tests/gallery.test.mjs` | Build URL overrides, nested preview copying, output safety and preserving prior output after a build failure |
| Icons | `tests/icons.test.mjs` | Defaults, overrides, disabling, aliases, SVG IDs, invalid names and local files |
| Release preparation | `tests/changelog.test.mjs` | Actual git-cliff generation, main-only commit ranges, squash merges, regeneration and preservation of reviewed notes |
| People images | `tests/people.test.mjs` | Portrait/fallback fields, framing, symbol crops, translations and local assets in both site kinds and composition modes |
| Installed package | `scripts/test-package.mjs` | Actual archive installation, CLI entry points, generated sites, root/subdirectory deployment, links/assets/anchors and grouping |
| Browser interactions | `tests/browser/*.spec.mjs` | Themes and site profiles at desktop/mobile widths, navigation, article actions, languages, persistent themes, figures, citations, team sections and no-JavaScript behavior |

The browser tests use **Chromium**. Mobile tests use a 390 × 844 viewport; they do
not emulate a physical device or establish compatibility with Safari or Firefox.
The desktop viewport is 1280 × 800. Each test gets a fresh context, with no saved
preferences from another test. Unhandled page JavaScript exceptions fail the test.
People-image browser tests cover circular clipping, photo framing, individual/site
fallbacks, the built-in symbol, translations and rendering without JavaScript.
Installed Package Tests also exercise these assets under deployment subdirectories
and in a composed LNCC Theme page.

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

Browser tests serve the static example output on `127.0.0.1:4360`, `:4361`, `:4362`,
`:4363` (scientific writing) and `:4364` (course).
Playwright starts and stops those servers. If a port is occupied, the run fails
rather than reusing an unrelated process. Keep those ports available. The user's
development previews on `4340`/`4341`/`4342`/`4343`/`4344` are independent.

Navigation regressions exercise wrapped labels with equal-height link/disclosure
targets, open and closed submenus, keyboard interaction and no-JavaScript fallbacks.
Theme-control tests check sun/moon visibility, icon centering, translated action
labels, touch-target size, live system preferences and persistence across pages.

The writing tests cover scientific Markdown, saved notebook outputs, equation and
figure references, code copying, nested navigation and both color schemes at
desktop/mobile sizes. They also verify static mathematics and navigation with
JavaScript disabled. Content tests exercise both `individual` and `group` with
automatic and explicit pages, and installed-package tests build articles and
notebooks in generated consumers. The course adds coverage for lesson navigation,
article exports and interactive figures. Download tests distinguish the faithful
original `.ipynb` source from Markdown conversion; print controls are tested as
browser actions, not as server-generated PDF files.

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

[The workflow](https://github.com/volpatto/sciastro/blob/main/.github/workflows/ci.yml)
runs on pushes to `main`, pull requests targeting `main`, and manual dispatch.
Work branches are tested when their PR is opened or updated, including draft PRs;
their pushes do not start a duplicate run. Use manual dispatch to test a branch
before opening a PR. The release workflow also calls this workflow to test the
exact release commit.

The workflow includes:

1. **Package Tests (Linux/macOS/Windows)** installs the locked Pixi environment and runs
   separate type checks, builds, Unit Tests and Installed Package Tests on each platform.
2. **Browser Tests (Chromium)** installs the locked environment and Chromium/system
   dependencies on Linux, then runs `pixi run --locked test-browser`.
3. The browser job uploads `browser-test-report` even when tests fail, provided
   reports were generated and the job was not canceled. Artifacts are retained
   for 14 days.
4. **Documentation build and link checks** builds strict MkDocs output and the
   example gallery using both locked environments, then uploads the combined
   `docs-preview` artifact without deploying it.

A failed check fails the workflow. The workflow has read-only repository access
and does not publish packages or deploy sites. To **prevent merging** with failing
checks, a repository administrator must also make the workflow's jobs required in
GitHub branch protection or a ruleset; merely defining CI does not enforce that.

### Dependency updates

[Dependabot configuration](https://github.com/volpatto/sciastro/blob/main/.github/dependabot.yml)
checks npm dependencies in the root pnpm workspace (including examples) and the
GitHub Actions used by CI and releases every Monday at 09:00, America/Sao_Paulo.
Minor and patch updates are grouped by ecosystem; major updates get separate PRs.
The limits are five open version-update PRs for npm and three for GitHub Actions.
Their titles use `chore(deps)` or `ci(deps)`, compatible with the changelog workflow.

Merge the configuration into the repository's default branch to activate it.
GitHub manages the Dependabot update jobs; no additional scheduled workflow or
personal access token is needed. Its PRs run the existing **Tests** workflow.
Review the changes and checks before merging; this configuration does not enable
automatic merging. See [GitHub's Dependabot setup instructions](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuring-dependabot-version-updates)
for repository settings and manually requesting an update check. Dependabot
alerts and automatic security fixes are separate repository settings.

Dependencies in `pixi.toml` and `pixi.lock` remain manually maintained. In
particular, pnpm updates are excluded from Dependabot: change `packageManager` in
`package.json`, the pnpm pin in `pixi.toml`, `pixi.lock`, and the generated Pixi
configuration in `src/cli.ts` together. Action input values such as `pixi-version`
also require a deliberate toolchain update. When reviewing an Astro update,
keep the generated project's Astro version in `src/cli.ts` aligned with the root
manifest; the existing consumer tests check this consistency.

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
- Tests must work from a fresh Git checkout: an empty `public/` directory is
  optional, because Git does not track empty directories. Installed Package Tests
  create it when the LNCC example has no assets; required fixture directories still
  fail if missing.
- Modify YAML fixtures as parsed data instead of matching lines that assume Unix
  line endings. Translation validation is exercised with both LF and CRLF files
  on every platform, including when tests run outside Windows.
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

## Documentation and release tests

The unit suite also validates the complete file snippets from the individual and
group documentation tutorials, section recipes and public API export coverage.
Release regression tests cover version synchronization, invalid tags, hardcoded README/docs versions and mismatched
changelog versions, commits outside `main`, immutable tag checkouts,
registry errors and retries against an already published archive.

Changelog tests create temporary Git repositories and invoke the real git-cliff
binary from the locked Pixi environment. They cover arbitrary preparation-branch
names, excluded local commits, unrelated tags, annotated/lightweight tags,
prerelease ordering, main advancing during preparation, the next release after a
squash merge, repeatable generation and preservation of historical/manual notes.
Invalid versions, missing history and git-cliff failures must leave release files
unchanged. These tests run in the existing Unit Tests job on all three CI platforms;
their history is self-contained and needs no network or repository credentials.

To run only these tests:

```sh
pixi run --locked node --test tests/changelog.test.mjs
```

Run `pixi run --locked version-check` for version consistency and
`pixi run --locked -e docs docs-build` for a strict documentation build. Both are
required in CI. The [release workflow](development/releases.md) reuses the full
cross-platform suite and tests the exact archive before publishing it.
