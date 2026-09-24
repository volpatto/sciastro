# Interactive plots from Python

SciAstro renders saved **Plotly** figures inside Markdown articles and Jupyter
notebooks. Readers can inspect values, zoom, pan, toggle traces in the legend and
save a chart image. This works for individual, group and course sites.

The figure is computed by the author. SciAstro does **not** execute Python, start a
Jupyter kernel or provide Dash callbacks. Publish data you intend readers to access:
the figure's complete JSON is included in the page.

## In a Markdown page

Export a figure with Python's [Plotly `write_json`](https://plotly.com/python-api-reference/generated/plotly.io.write_json.html):

```python
from pathlib import Path
import plotly.graph_objects as go

x = [i / 20 for i in range(21)]
fig = go.Figure(go.Scatter(x=x, y=[value**2 for value in x], name="x²"))
fig.update_layout(xaxis_title="x", yaxis_title="f(x)")
Path("content/plots").mkdir(parents=True, exist_ok=True)
fig.write_json("content/plots/function.json")
```

Reference that file from a Markdown **page body**:

```markdown
::: plotly src="plots/function.json" caption="The function x² on [0,1]." label="fig:function" numbered=true
:::

See @ref(fig:function) for the curve.
```

`src` is relative to `contentDir`, even when the Markdown file lives in a deeper
folder. The file must be local JSON inside that directory. SciAstro reads and
validates it at build time; the reader does not fetch a separate JSON resource.
Changes to the JSON refresh the development preview.

The directive accepts the same `caption`, `label`, `numbered`, `align`,
`caption-align` and `width` options as a Markdown figure. Its body is empty.
Captions participate in the page's figure numbering and cross-references. It is
available in full Markdown/notebook page bodies, not the shorter Markdown strings
inside YAML cards.

## Saved Jupyter outputs

Use the [Plotly MIME renderer](https://plotly.com/python/renderers/#plotly_mimetype),
execute the notebook yourself and save its outputs:

```python
import plotly.graph_objects as go

fig = go.Figure(go.Scatter(x=[0, 1, 2], y=[0, 1, 4], name="x²"))
fig.show(renderer="plotly_mimetype")
```

SciAstro recognizes `application/vnd.plotly.v1+json` and displays the interactive
figure. HTML-only Plotly outputs are not executed. If necessary, rerun the notebook
with the renderer above before building your site. Scientific values are not
recomputed or verified by SciAstro.

A saved PNG/JPEG/SVG in the same output bundle is retained as a fallback. You can
produce such bundles with `renderer="plotly_mimetype+png"` when your Python
installation supports Plotly static image export. That Python-side export may
require Kaleido; it is not a SciAstro build dependency.

Notebook `metadata.sciastro` figure settings work as for static images: a caption,
label, width, placement, numbering and caption alignment can be provided on the
cell or output. See [notebook figures](writing.md#publish-a-jupyter-notebook).

## Presentation and printing

The chart fits its content column, including narrow screens. Site typography and
light/dark colors are applied as defaults; explicit author figure colors are
preserved. Prefer short chart titles on mobile; put detailed explanations in the
numbered figure caption, which wraps with the page. The plotting library is bundled locally and loaded only on pages
containing charts. It is a substantial JavaScript asset, so prefer static figures
when interaction adds little value.

The [PDF action](downloads.md) waits for chart rendering and creates a high-resolution,
white-background image for printing. Printed/PDF plots represent the saved initial
figure, not a reader's temporary zoom or trace selection. Interactive controls are
omitted from print. Other page text, links and rendered equations remain part of
the print document. Without JavaScript, use a saved static fallback when available.

## Supported scope

Use self-contained scientific plots, including Cartesian, statistical, polar,
ternary, hierarchical and 3D figures, and validated animation frames. Standard
JSON arrays and Plotly Python's typed-array representation are supported.

Remote maps, external image/data URLs, arbitrary HTML/JavaScript, widgets,
server callbacks and unvalidated plot-control commands are not accepted. These
constraints keep a static website independent of remote execution and data services.
Use a static image or a separately hosted application for those use cases.

LaTeX inside a Plotly title, axis or annotation needs a separate browser-side
[MathJax integration](https://plotly.com/python/LaTeX/), which SciAstro does not
currently enable for charts. Use Unicode or supported inline formatting for those
labels, or provide a static figure. LaTeX equations in the surrounding Markdown
and notebook text continue to use SciAstro's built-in math rendering.

Different Plotly.py/Plotly.js releases can support different attributes. Preview
your actual saved figures before publishing. JSON validation checks supported
structure and unsafe resources; it does not establish the scientific correctness
of plotted data or implement Plotly's entire schema.
