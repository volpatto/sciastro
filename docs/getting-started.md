# Installation

You need **Git** and **Pixi 0.72.2 or newer** for the reproducible path below.
Pixi installs Node.js 24 and pnpm 11.19.0 in the project environment; no global
Node.js, pnpm or Python installation is required.

## Install Pixi

Use the [official installation instructions](https://pixi.prefix.dev/latest/installation/)
or [download a release](https://github.com/prefix-dev/pixi/releases).

=== "Linux / macOS"

    ```sh
    curl -fsSL https://pixi.sh/install.sh | sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -c "irm -useb https://pixi.sh/install.ps1 | iex"
    ```

Reopen your terminal and run `pixi --version`. Install Git from
[git-scm.com](https://git-scm.com/downloads/) if it is not already available.
All remaining commands work from a terminal in the indicated project directory.

## Create a site from npm

This path requires a **published** SciAstro version. Until the first npm release,
use [the local archive path below](#create-a-site-before-the-first-npm-release).
A checkout of the framework is not needed for npm installations.

Create a temporary tool environment in a new directory:

```sh
mkdir academic-sites
cd academic-sites
pixi init
pixi add "nodejs=24.*" "pnpm==11.19.0"
pixi run pnpm dlx sciastro@next init my-site --kind individual --theme modern
cd my-site
pixi install
pixi run pnpm install
pixi run dev
```

`@next` selects the alpha/prerelease channel. After a stable release is available,
use `sciastro@latest`; for a reproducible initial scaffold use an exact published
version using `sciastro@VERSION` (replace `VERSION` with that release). The generated site's dependency
is pinned to the generator's version, regardless of the channel used to invoke it.
Choose `--kind group` for a group. `--theme classic`, `modern` or `lncc` sets the
initial theme; you can change it later in YAML.

The generator requires a new or empty destination. It creates files but does not
install dependencies. Open the URL printed by the preview, normally
`http://127.0.0.1:4321/`.

If you already have Node.js 24 and pnpm 11.19.0, run `pnpm dlx ...` directly, then
`pnpm install` and `pnpm dev` in the generated directory. Pixi is optional for consumers.

## Create a site before the first npm release

Clone and build the source, then scaffold and install its archive:

```sh
git clone https://github.com/volpatto/sciastro.git
cd sciastro
pixi install --locked
pixi run --locked pack
pixi run --locked node dist/cli.js init ../my-site --kind individual --theme modern
cd ../my-site
pixi install
pixi run pnpm add sciastro@file:../sciastro/artifacts/sciastro-VERSION.tgz --save-exact
pixi run dev
```

Replace `VERSION` with the version in the archive filename printed by `pack`.
The paths assume `sciastro` and `my-site` are siblings. Use `--kind group` for the
group tutorial. The site consumes the archive, not the framework's source files.
For deployment on another machine, copy the archive into `my-site/vendor/`, run
`pixi run pnpm add sciastro@file:vendor/sciastro-VERSION.tgz --save-exact`,
and commit that file with the website. Otherwise a sibling-directory reference
will not be available on a clean runner. Once published, switch to the exact npm
version with `pixi run pnpm add sciastro@VERSION --save-exact`.

## Reproducible daily work

The first installation creates `pixi.lock` and `pnpm-lock.yaml`. Commit both with
`pixi.toml`, `package.json`, content and assets. On another machine:

```sh
pixi install --locked
pixi run --locked dev
```

After editing, validate and build:

```sh
pixi run --locked build
```

This runs the content check and generates `dist/`. To stop the development preview:

```sh
pixi run --locked dev-stop
```

These are **website** tasks. The framework repository has separate tasks for its
examples, tests and MkDocs documentation; see [development](testing.md).

Continue with [an individual website](tutorials/individual.md) or
[a research-group website](tutorials/group.md).
