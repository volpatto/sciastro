# Releases and npm

npm is the distribution channel for SciAstro's JavaScript, TypeScript declarations,
Astro components, styles and CLI. Consumers install a version instead of copying
the framework repository. MkDocs is a development dependency and is not needed
to build a consumer website.

The prepared workflow is `.github/workflows/release.yml`. It publishes only on
**a pushed tag matching `v*`**, after validating the version and commit. PR titles
and ordinary pushes to `main` do not publish or deploy documentation.

## One-time account and repository setup

1. Create/sign in to an [npm account](https://www.npmjs.com/signup), verify the
   email address and configure two-factor authentication. Confirm ownership or
   availability of the `sciastro` package name immediately before first publication.
   A registry 404 is not a name reservation.
2. Check that `package.json` has the intended name and
   `repository.url: https://github.com/volpatto/sciastro.git`. If publishing from
   another repository, update metadata, documentation URLs and badges first.
3. Configure GitHub Pages with **Settings → Pages → Build and deployment →
   Source: GitHub Actions**. The expected docs URL is
   `https://volpatto.github.io/sciastro/`; it is available after deployment.
4. Create the GitHub environments **`npm`** and **`github-pages`**. If deployment
   branch/tag restrictions are enabled, allow **tags matching `v*`**, not only the
   `main` branch: the release workflow runs on a tag. Avoid required human
   reviewers if fully automatic publication is desired.
5. Configure the npm package's **Trusted Publisher** for GitHub Actions with:

   | Setting | Value |
   | --- | --- |
   | Organization or user | `volpatto` |
   | Repository | `sciastro` |
   | Workflow filename | `release.yml` |
   | Environment | `npm` |
   | Allowed action | Direct **`npm publish`** |

   The workflow uses OIDC, not an `NPM_TOKEN` secret. New trusted publishers may
   default to stage-only publishing; direct publishing must be allowed for this
   automatic workflow. Node.js/npm come from the locked Pixi environment and
   meet npm's trusted-publishing requirements. See the
   [official npm setup](https://docs.npmjs.com/trusted-publishers/).

Trusted publishing is configured in a package's settings. If `sciastro` does not
yet exist under your account, first create it with the manual bootstrap below,
then configure the publisher. No npm credentials are committed to this repository.
Public-repository/public-package OIDC releases can receive automatic provenance;
a private source repository does not qualify for that provenance.

## Bootstrap the first npm publication

This is a one-time manual account operation, not performed by the setup scripts.
Use the **same tagged commit and tested archive** as the release pipeline. First
merge the release preparation into `main`, create/push its version tag as described
below, and wait for all checks. Without trusted publishing, the publication job
may fail; its `npm-release` artifact contains the already tested `.tgz`.

Download that workflow artifact from GitHub Actions and extract it into an
`artifacts/` directory in a checkout of the tag. For the initial alpha:

```sh
pixi install --locked
pixi run --locked node scripts/version.mjs check --tag vVERSION --archive artifacts/sciastro-VERSION.tgz
pixi run --locked npm login
pixi run --locked npm publish ./artifacts/sciastro-VERSION.tgz --access public --tag next --ignore-scripts
```

Replace `VERSION` with the version in the downloaded artifact filename.
The final command is a real public publication and may prompt for 2FA. Use
`--tag latest` for a stable version. Afterward, add the trusted publisher in npm
settings and rerun the failed workflow jobs. The publication step compares the
registry's archive integrity and continues only if the existing version is the
**identical** tested artifact; then GitHub release creation and docs deployment run.
Do not rebuild a different artifact for the same version or use placeholder
package contents merely to reserve the name.

## Prepare a release

From a development branch in the SciAstro repository:

```sh
pixi install --locked
pixi run --locked version-set VERSION
```

Replace `VERSION` with the version intended for the next release. This task updates
`package.json` and inserts a new `CHANGELOG.md` heading;
replace the TODO with changes and migration instructions. It does not commit,
create a tag, update dependencies or publish anything.

```sh
pixi run --locked version-check
pixi run --locked browser-install
pixi run --locked verify-all
pixi run --locked -e docs docs-build
```

Review the diff, commit and open a PR into `main`. Merge only after CI is green.
Protect `main` with required checks for the package matrix, browser tests and docs
checks. The release workflow repeats those checks on the tagged commit, so a
previous green PR alone is not sufficient to publish.

### Push the tag

Once the version change is on `main`:

```sh
git switch main
git pull --ff-only origin main
pixi run --locked version-check
pixi run --locked node scripts/version.mjs check --tag vVERSION
git tag -a vVERSION -m "Release vVERSION"
git push origin vVERSION
```

Replace `VERSION` in **all three** tag-related commands with the package version. Push one release
tag at a time and wait for the release to finish before pushing another.
Git tags do not belong to branches, so the workflow explicitly verifies that the
tag's commit is already an ancestor of `origin/main`. A tag pointing only to an
unmerged feature branch is rejected. Annotated tags are recommended; lightweight
tags are also accepted. Do not move tags after publication.

## What the workflow guarantees

1. **Validate:** strict `vX.Y.Z` or `vX.Y.Z-prerelease` format, package/tag equality,
   the absence of hardcoded package versions in documentation, completed changelog,
   repository URL and main ancestry.
2. **Tests:** reuse the complete CI workflow on the immutable commit. Type checks,
   unit/tutorial/release tests and installed-consumer tests run on Linux, macOS and
   Windows; Chromium tests and a strict docs build also pass.
3. **Artifacts:** build the npm archive once, install/test that exact archive,
   build MkDocs from the same commit, verify both versions and save their metadata.
4. **Publish:** upload that archive through npm OIDC. Prereleases use `next`;
   stable releases use `latest`. Publication cannot begin if a preceding job fails.
5. **GitHub release:** use the matching changelog entry; attach the archive and
   integrity/commit metadata. Prereleases are marked as such.
6. **Docs:** deploy the already built Pages artifact only after publication and
   GitHub release creation succeed. No publication is triggered by editing docs alone.

The public docs represent the last deployed release, including alpha releases.
There is currently one docs site, not a multi-version selector. The deployment
includes `release.json` with version and commit for diagnostics.

## Version consistency checker

```sh
pixi run --locked version-check
pixi run --locked node scripts/version.mjs check --tag vVERSION
pixi run --locked node scripts/version.mjs check --archive artifacts/sciastro-VERSION.tgz --docs site
```

The checker covers canonical SemVer (without build metadata), the absence of
hardcoded SciAstro versions in README/docs, the current changelog and the
workspace dependency declarations. Archive checking additionally compares its
manifest against the source; docs checking reads generated version metadata.
Tutorial tests also verify that the CLI pins a new site's dependency to the package
version. The root package is the version authority; example projects remain private
consumers; their own versions are not SciAstro release versions.

Dependency versions, lockfile formats and `schemaVersion: 1` are separate contracts
and must not be replaced with the package version. Frozen dependency installation
checks manifest/lockfile consistency. MkDocs records the package version dynamically in build metadata, without displaying
a numeric version in the documentation prose.

## Recover a failed release

- **Version mismatch or missing notes:** fix on `main` before issuing a correct,
  unused version tag. A `v*` tag with malformed syntax fails validation.
- **Tests/build failure:** fix the code or environment, rerun checks and prepare a
  new tag/commit. Do not skip release checks to publish.
- **OIDC authentication failure:** verify npm publisher fields, the `npm`
  environment and direct-publish permission. The workflow filename is exactly
  `release.yml`. If the package does not yet exist, follow the bootstrap procedure.
- **npm succeeded but a later job failed:** rerun failed jobs from the **same
  workflow run** while artifacts are still retained. Docs deployment does not
  require republishing; an identical existing npm version can also be recognized
  if the publication job runs again.
- **The same npm version has different contents:** the workflow fails rather than
  overwrite it. Bump the version and release again.
- **Artifacts expired, or a newer release is already deployed:** prepare a new
  version. Do not replay old deployments over newer docs or repoint an old tag.

npm publication and Pages deployment are separate services, so they are not an
atomic transaction. A docs failure can leave a published package with the previous
docs until the failed deployment is retried. No package is unpublished automatically.

See [GitHub's Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
and [npm's publishing guide](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/)
for account/platform requirements.
