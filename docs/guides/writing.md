# Articles, scientific Markdown and notebooks

These features work identically with `kind: individual` and `kind: group`.
Write a complete page in Markdown, or point its YAML record at a saved Jupyter
Notebook. SciAstro builds static HTML with locally rendered mathematics and code
highlighting. Readers need no notebook server, Python installation or math CDN.

## Start a section for posts

In an explicit-page website, add the files to `sciastro.yaml`:

```yaml
pageFiles:
  - pages/home.yaml       # your existing homepage
  - pages/news.yaml
  - pages/first-note.md
  - pages/notebook.yaml
navigation: [home, news]
navigationDepth: 2
```

Keep your existing page files and menu items as needed. Files are relative to
`contentDir`. Create the section index:

```yaml title="content/pages/news.yaml"
id: news
title: News
paths: {en: news/}
layout: listing
description: Research notes, tutorials and updates.
icon: lucide:newspaper
```

This example assumes `locales: [en]` and `defaultLocale: en`. A bilingual site
supplies both `pt` and `en` paths, including the secondary language's prefix.
An index lists its direct children automatically. Dated children appear newest
first; equal dates and undated children preserve their authored order.

## Write an entire Markdown page

The initial `---` block is YAML front matter: it contains the same fields as a
YAML page record. Everything after the closing delimiter is the page body.
No `.astro`, MDX or JavaScript file is required.

````markdown title="content/pages/first-note.md"
---
id: first-note
title: A computational research note
description: An example combining mathematical notation and code.
paths: {en: news/first-note/}
parent: news
layout: article
date: 2026-09-22
authors: [Alex Example]
tags: [Numerical methods, Reproducibility]
toc: true
---

An introduction to the result, its assumptions and its limitations.

## Formulation

The field $u$ satisfies

\begin{equation}
  -\nabla^2 u = f. \label{eq:model}
\end{equation}

Equation $\eqref{eq:model}$ defines the model.

## Implementation

```python filename="model.py"
def square(x):
    return x * x
```
````

Use `##` and `###` for the article's sections; the page title is already rendered
as its main heading. Headings receive stable anchors and an optional contents
list. Repeated headings receive numeric suffixes. Set an explicit anchor with
`## Convergence {#convergence}` when the URL should survive a title change.

`layout: article` displays the title, description, date, authors and tags. Use
`layout: page` for a full Markdown page without the article presentation. A
`layout: listing` page may also have introductory content. Set `draft: true` to
exclude a page from the generated site, including local previews; unset it to
preview/publish. A published child cannot point to a draft parent.

The fields `date`, `authors` and `tags` are optional. Dates use `YYYY-MM-DD` and
are displayed without timezone-dependent day shifts. `toc: false` hides the
contents list. Titles/descriptions support shared strings or localized values.

A Markdown page contains its own body, so omit `body` in its front matter.
Alternatively, keep metadata and prose separate:

```yaml
id: first-note
title: A computational research note
paths: {en: news/first-note/}
parent: news
layout: article
body: notes/first-note.md
```

The `body` path is relative to `contentDir`, **not** to the YAML file. For
translations, use `body: {pt: notes/note.pt.md, en: notes/note.en.md}`.

### Section numbering

Number article sections by adding this setting to `sciastro.yaml`:

```yaml
numberSections: true
```

An individual article can override the global setting in its YAML or Markdown
front matter:

```yaml
layout: article
numberSections: false
```

Conversely, use `numberSections: true` on one article to opt in while leaving
the global default off. This works with Markdown files and Markdown cells in
Jupyter notebooks, for every site profile and theme.

Headings `##` through `######` receive hierarchical numbers such as `1`, `1.1`
and `2`. Skipped heading levels do not introduce zero components or empty
sections: `## A`, `#### B`, `### C`, `## D` become `1 A`, `1.1 B`, `1.2 C`,
`2 D`. The page title and `#` headings remain unnumbered. Composed YAML section
titles, automatic card titles and the references list are not numbered.

The body and its contents list show the same prefixes. Existing heading IDs,
explicit anchors and links remain unchanged. PDFs include the rendered numbers;
downloaded notebooks retain their source without inserting these prefixes.

### Existing automatic websites

You do not have to switch to `pageFiles`. Add equivalent entries to `pages.yaml`:

```yaml title="content/pages.yaml"
- slug: news
  title: News
  layout: listing
- slug: first-note
  title: A computational research note
  layout: article
  parent: news
  paths: {en: news/first-note/}
  body: notes/first-note.md
  date: 2026-09-22
```

Automatic pages use `slug` as their identifier; explicit pages use `id`.
`paths` is optional in automatic mode; without it, the existing route rules apply.
The scientific renderer applies to these whole-page `body` files and explicit
Markdown pages. Small YAML section `text` fields, automatic research-area text,
and homepage `home.body` retain their existing basic Markdown renderer.

## Hierarchy and menu depth

`parent` refers to another page's ID (or automatic `slug`). It controls nesting,
breadcrumbs and index membership; it does not silently change published URLs.
Set `paths` explicitly when you want `/news/tutorials/example/`.

```yaml
id: tutorials
title: Tutorials
paths: {en: news/tutorials/}
parent: news
layout: listing
```

An article with `parent: tutorials` is now a third-level page. In `sciastro.yaml`:

```yaml
navigation: [home, news]
navigationDepth: 2
```

`navigation` selects and orders **top-level pages**; their children retain their
own order. `navigationDepth: 1` shows roots only, `2` adds their children, and so
on up to `10`. Deeper pages still exist and are linked from their index and
breadcrumbs. A page with `navigation: false` hides its menu branch while keeping
its URL and listing entry. Use `draft: true` to exclude it from the site entirely.

Submenus use native controls and remain usable with a keyboard and without
JavaScript. Invalid parents, cycles, duplicate IDs and conflicting URLs fail the
build with an error naming the affected page.

## Link to pages and sections

Ordinary Markdown links work as expected. For links that should follow a page's
identifier across URL changes, languages and deployment directories, use:

```markdown
[All news](page:news)
[Read the formulation](page:first-note#formulation)
[Jump within this page](#implementation)
```

The `page:` form resolves the target's path in the current language, including the
configured `base`. It works in Markdown bodies, notebook Markdown cells, existing
homepage/research/section Markdown, and YAML section links:

```yaml
links:
  - label: Formulation
    url: page:first-note#formulation
```

Use the target's heading anchor (or an explicit `{#anchor}`), a composed section
`id`, a research-area `id`, or a figure/table label. For a stable cross-page section
link, an explicit heading anchor is preferable to one derived from translated text.
`page:` links are checked at build time: missing pages, draft targets and unknown
anchors produce an error. Anchors generated inside custom Astro components cannot
be checked before those components render; use a normal URL for those targets.
Normal external links and manually specified `/paths/#anchors` remain available.

## Code blocks

Fenced code uses [Shiki](https://shiki.style/) at build time, with independent
light/dark colors, a filename or language label, and a copy control. The code
remains readable with JavaScript disabled. Copying uses the browser Clipboard
API, available on HTTPS and localhost.

````markdown
```python filename="solver.py"
from math import exp
value = exp(-1)
```
````

`title="Example"` is also supported. Omitted or unknown languages render as plain
text. Long lines scroll within the code frame rather than widening the page.

## Callouts, details and cards

Directives use an opening line and a matching `:::` closing line. Their contents
are normal Markdown, including lists, code, mathematics and citations.

```markdown
::: note title="Assumptions"
State the assumptions under which the result holds.
:::

::: tip title="Reproduce the result"
Link the data and scripts needed to repeat the analysis.
:::

::: warning title="Numerical limitation"
Convergence in one benchmark does not establish accuracy in every regime.
:::

::: danger title="Invalid parameter range"
Explain why this input is outside the model's domain.
:::

::: details title="Derivation"
An expandable explanation with equations and intermediate steps.
:::
```

Cards can be placed on their own or grouped into a responsive grid:

```markdown
::: cards
::: card title="Formulation"
[Read the assumptions](#formulation).
:::
::: card title="Implementation"
[Inspect the code](#implementation).
:::
:::
```

Unknown directive attributes fail validation instead of being inserted as HTML.
Raw HTML in Markdown is escaped. Use these directives for portable presentation.

## Mathematics and equation numbering

[MathJax](https://docs.mathjax.org/en/latest/input/tex/eqnumbers.html) renders TeX
as SVG during the build. Use `$...$` or `\(...\)` for inline formulas, and `$$...$$`
or `\[...\]` for unnumbered display formulas.

```latex
\begin{align}
  a &= b + c, \label{eq:first} \\
  d &= e + f. \label{eq:second}
\end{align}
```

`equation`, `align`, `gather`, `multline` and `eqnarray` follow AMS numbering rules;
the starred forms are unnumbered. `\notag`/`\nonumber` suppress a number and
`\tag{A}` sets an explicit tag. `\label{eq:first}` defines a label and
`$\eqref{eq:first}$` inserts a linked reference, including references written
before the equation. Numbering restarts on each page and continues across notebook
cells. Duplicate labels, unknown references and invalid TeX fail the build.

This is mathematical TeX, not an arbitrary LaTeX document compiler. The renderer
enables the base, AMS, newcommand and boldsymbol packages; external package loading,
HTML macros and executable commands are not enabled. Large formulas scroll within
the content area. TeX inside a code block stays literal.

## Figures, plots and captions

Put a static plot in `public/images/` and reference it with a root-relative path.
SciAstro prefixes the configured deployment `base` automatically.

```markdown
The convergence result is shown in @ref(fig:convergence).

::: figure caption="Absolute error under mesh refinement." label="fig:convergence" width="80%" align="center" caption-align="left" numbered=true
![Error decreases quadratically as the mesh is refined](/images/convergence.svg)
:::
```

Captioned figures are numbered automatically. `numbered=false` retains the caption
without incrementing the counter. `align` positions the figure block and accepts
`left`, `center` or `right`;
`width` accepts a percentage from `1%` to `100%`, or a positive integer in `px` or
`rem`. Images stay constrained to the viewport on small screens. Captions support
inline Markdown and mathematics; image descriptions remain important for accessibility.
Figure/table references use `@ref(label)` and can appear before their target.

`caption-align` controls the caption text independently of the block position.
It accepts `left`, `center`, `right` or `justify`, overriding
`appearance.captions.figures` in `sciastro.yaml`. The default is `center` when
neither setting is provided. For example, the figure above is centered at 80%
width while its caption is left-aligned within that width.

## Tables

Standard pipe tables support text alignment and horizontal scrolling. Wrap a table
to provide a numbered caption and reference label:

```markdown
::: table caption="Errors at successive resolutions." label="tab:errors" caption-align="left"
| Mesh | Error | Observed order |
| --- | ---: | ---: |
| Coarse | 0.0040 | — |
| Fine | 0.0010 | 2.0 |
:::

See @ref(tab:errors) for the comparison.
```

Figures and tables have separate counters. Tables use native HTML semantics;
notebook HTML tables also receive the site's typography and scroll treatment.
Table directives accept the same `caption-align` values as figures, overriding
`appearance.captions.tables` (default `center`). This does not change the text
alignment of the table's cells. See [global caption settings](../customization.md#caption-alignment).

## Publish a Jupyter Notebook

Create and execute the notebook in Jupyter, VS Code or your preferred environment.
Save the `.ipynb` **with its outputs**, then select it as a page body:

```yaml title="content/pages/notebook.yaml"
id: quadrature
title: Convergence of a quadrature rule
paths: {en: news/quadrature/}
parent: news
layout: article
body: notebooks/quadrature.ipynb
notebook:
  showCode: true
  collapseCode: false
```

SciAstro reads [nbformat 4](https://nbformat.readthedocs.io/en/latest/format_description.html).
It preserves cell order, execution counts, Markdown, TeX, code and supported saved
outputs. It **does not execute cells** and needs no Python environment to build
the website. Reexecute and save the notebook when its results change; stale or
missing results cannot be recomputed by the site builder.

| Saved output | Rendering |
| --- | --- |
| Standard output / errors | Styled output frames; terminal control sequences removed |
| PNG / JPEG / SVG | Responsive images; SVG plot geometry sanitized |
| HTML tables and text | Sanitized HTML with site styling |
| LaTeX | The same numbered MathJax pipeline as Markdown cells |
| Plotly MIME JSON | Local interactive charts, with saved static image fallback when available; see [interactive plots](plots.md) |
| JSON / plain text | Readable preformatted output |
| Markdown attachments | Embedded PNG/JPEG/SVG images |
| JavaScript widgets / unsupported MIME types | An explanatory fallback and saved plain text when available |

For unsupported interactive tools such as ipywidgets, save a static PNG/SVG output
if you want a faithful plot in the published article. Plotly has dedicated
[JSON/MIME support](plots.md); arbitrary Plotly HTML exports are not executed. Arbitrary notebook scripts,
iframes, event handlers and external SVG resources are not executed. Output HTML
is sanitized; embedded stylesheets and interactive behavior are not preserved.
Permitted inline styles, such as table-caption text alignment, may remain.

`showCode: false` hides code inputs while keeping results. `collapseCode: true`
places inputs in expandable frames. These settings affect presentation, not cell
execution. For image output captions, optional cell/output metadata under
`sciastro` can set `caption`, `label`, `numbered`, `width`, `align` and `captionAlign`:

```json
{
  "sciastro": {
    "caption": "Absolute error at successive resolutions.",
    "label": "fig:notebook-error",
    "numbered": true,
    "width": "80%",
    "align": "center",
    "captionAlign": "left"
  }
}
```

Place this object inside a cell's or output's `metadata`. Output metadata
overrides cell metadata for the same field. Cell-level figure metadata applies
only to the first image output; configure later images through their own output
metadata. `captionAlign` accepts `left`,
`center`, `right` or `justify` and overrides `appearance.captions.figures`;
`align` continues to position the image block independently.

For saved HTML tables, existing `<caption>` elements follow
`appearance.captions.tables`, unless their saved inline styles set another
alignment. Image metadata does not generate or number table captions. Add a
table caption in the notebook's HTML output or use a Markdown `table` directive
in a Markdown cell when a numbered, referenceable table caption is needed.

## Complete runnable example

The repository's `examples/writing/` includes a homepage, a News index, a nested
Tutorials index, a Markdown article and an executed quadrature notebook. It uses
LNCC Theme and a non-root deployment base to exercise portable links. Change
`kind` to `group` to use the same content in a research-group site.

```sh
pixi run --locked dev-writing
```

Open `http://127.0.0.1:4343/caderno/`. From the repository root, build and test with
`pixi run --locked verify-all`; stop the preview with
`pixi run --locked dev-writing-stop`. The notebook contains its Python dependencies
and a small analytic verification; running the example website itself needs only
the regular SciAstro environment.
