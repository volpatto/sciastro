# Example gallery

These complete websites demonstrate SciAstro's profiles, themes and authoring
options. Open a preview to try its navigation, language switch, light/dark mode
and content. Each example is built from the same release as these docs and has
a corresponding source directory in the SciAstro repository.

Names, institutions and research records in the examples are fictional unless
explicitly identified otherwise. Replace sample content and assets before
publishing your own site.

## Research group

A bilingual group site with a concise overview, research areas, a team organized
by role and student level, and bibliographic references. It uses the Classic
theme and the automatic page conventions.

Its appearance recipe pairs Ocean colors with Editorial typography, accent-colored
navigation icons and a subtle linear gradient behind the home introduction. It
keeps solid navigation and the Classic layout while demonstrating that colors and
fonts are independent of the theme.

<a href="../examples/group/">Open the group preview</a> ·
[View the source](https://github.com/volpatto/sciastro/tree/main/examples/group) ·
[Follow the group tutorial](tutorials/group.md)

## Individual researcher

A bilingual individual site with About, Research and Supervision. It shows how
the same configuration and people data adapt to an individual academic profile.

The Modern theme uses a Slate base with a Violet accent, Humanist typography and
soft navigation icons. A mesh gradient decorates introductory areas and main page
titles, while long body text keeps an ordinary reading surface. Its optional glass
top menu stays near the viewport top while scrolling and uses a solid fallback
when transparency is unavailable or reduced.

<a href="../examples/individual/">Open the individual preview</a> ·
[View the source](https://github.com/volpatto/sciastro/tree/main/examples/individual) ·
[Follow the individual tutorial](tutorials/individual.md)

Compare these two recipes in light and dark modes. The
[appearance guide](guides/appearance.md) explains how to mix five bases and five
accents, select typography and keep gradients limited to the intended areas.
These gallery choices are opt-in; starter templates keep their existing defaults.

## LNCC theme and composed pages

An example of explicit YAML sections, custom page routes and components. The
LNCC theme demonstrates the more restrained sidebar presentation. The fictional
example does not imply institutional endorsement.

<a href="../examples/lncc/">Open the LNCC preview</a> ·
[View the source](https://github.com/volpatto/sciastro/tree/main/examples/lncc) ·
[Learn about composed pages](customization.md)

## Scientific writing

Scientific Markdown and saved Jupyter outputs with equations, figures, tables,
code, citations and nested posts. The example includes an executed quadrature
notebook; the website reads its saved results without executing Python.

<a href="../examples/writing/">Open the writing preview</a> ·
[View the source](https://github.com/volpatto/sciastro/tree/main/examples/writing) ·
[Read the writing guide](guides/writing.md)

## Course

A numerical-methods course with an overview, syllabus, lesson index, Markdown
notes, an interactive Plotly figure and an unexecuted notebook exercise. It uses
top navigation, a contextual right panel, subtle motion and opt-in article
downloads. The notebook's expected values are explained analytically; no output
is claimed for the unexecuted cells.

<a href="../examples/course/">Open the course preview</a> ·
[View the source](https://github.com/volpatto/sciastro/tree/main/examples/course) ·
[Follow the course tutorial](tutorials/course.md)

## Build the gallery locally

The gallery is part of this repository and its documentation deployment. It
does not require another GitHub repository or organization. From a SciAstro
checkout with the [development environment](testing.md) installed:

```sh
pixi run --locked -e docs docs-build
pixi run --locked docs-gallery
```

The second command builds all example sites and adds their static output to
`site/examples/`. Intermediate builds use `.test-output/gallery-build/`, preserving
each example's normal `dist/` and its local preview paths. It never publishes
anything. Run it **after** MkDocs: a later
MkDocs build replaces the output directory and removes those generated previews.

The destination URL defaults to `site_url` in `mkdocs.yml`. To target another
documentation address, set `DOCS_SITE_URL` to its complete URL before running
the gallery task. Each example receives the matching origin and a base such as
`/sciastro/examples/course/`; local links, assets and downloads use that base.
The deployment must expose the `site/` contents at the same documentation path.

For everyday editing, use an example's development task (such as
`pixi run --locked dev-course`) instead of rebuilding every preview. The live
gallery links require the combined static documentation build; `mkdocs serve`
alone does not build or serve the generated examples.
