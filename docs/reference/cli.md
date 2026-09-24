# CLI reference

The package installs a `sciastro` executable. In a website managed by Pixi, use
`pixi run pnpm exec sciastro ...`; outside Pixi, use `pnpm exec sciastro ...`.
For unpublished local changes, build the source and invoke `node dist/cli.js`
in its development environment.

## `sciastro init`

```text
sciastro init <directory> --kind group|individual|course --theme classic|modern|lncc
```

| Argument | Default | Meaning |
| --- | --- | --- |
| `<directory>` | Required | New or empty destination directory |
| `--kind` | `group` | `group`, `individual` or `course`; selects the initial content and site profile |
| `--theme` | `classic` | Initial theme |

Copies starter content and creates `package.json`, `astro.config.mjs`, `pixi.toml`,
a workspace configuration, `.gitignore`, README and `public/`. The consumer is
private and pins SciAstro to the generator's version. It does not overwrite a
nonempty directory, install dependencies, initialize Git or publish a website.
See [installation](../getting-started.md) for the required first install.

The course starter uses explicit `pageFiles`: an overview, syllabus, lesson
index, Markdown lesson and notebook page. It starts with top navigation and a
contextual right panel. These layout settings can be used by other site kinds
as well. See the [course tutorial](../tutorials/course.md).

## `sciastro check`

```text
sciastro check --config sciastro.yaml
```

`--config` defaults to `sciastro.yaml` relative to the current directory.
The command validates content and prints a summary of localized pages, people,
BibTeX entries and editorial publications. A validation failure exits nonzero.
The command does not produce static HTML; use the website's `build` task for that.
`SITE_URL` and `BASE_PATH` are optional deployment overrides.

## Help and messages

```sh
pixi run pnpm exec sciastro --help
```

`-h` is an alias. The CLI currently contains a mix of Portuguese and English
messages. The documentation is English; interface translations in generated
websites are selected independently using `locales` and `defaultLocale`.
