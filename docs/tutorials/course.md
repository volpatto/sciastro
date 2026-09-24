# Create a course website

This tutorial creates a course with an overview, syllabus, lesson index,
Markdown notes and a Jupyter notebook. The supplied numerical-methods course is
fictional and written in Portuguese; the authoring workflow is the same for
English and bilingual sites. No JavaScript editing is required.

## 1. Generate the starter

Install [Pixi and the prerequisites](../getting-started.md). In a new working
directory, create the temporary generator environment and your course:

```sh
mkdir teaching-sites
cd teaching-sites
pixi init
pixi add "nodejs=24.*" "pnpm==11.19.0"
pixi run pnpm dlx sciastro@latest init numerical-methods --kind course --theme modern
cd numerical-methods
pixi install
pixi run pnpm install
pixi run dev
```

Open the URL printed by the preview. Keep it running while editing. Commit the
generated `pixi.lock` and `pnpm-lock.yaml`; on subsequent checkouts, use
`pixi install --locked` and `pixi run --locked dev`.

If you already have the supported Node.js and pnpm versions, you can run the
generator directly with `pnpm dlx` instead. The starter uses the published
SciAstro package; a copy of the framework repository is unnecessary.

## 2. Choose the course identity and layout

Edit these entries in `sciastro.yaml`, retaining the generated `pageFiles`:

```yaml
kind: course
name: Métodos Numéricos
description: Notas de aula, exercícios e experimentos computacionais.
url: https://teaching.example.org
base: /numerical-methods/
theme: modern
layout:
  navigation: top
  subnavigation: right
appearance:
  motion: subtle
downloads:
  notebook: true
  pdf: true
```

Replace the example domain with your actual hosting origin. `base` is the
subdirectory under that origin, or `/` for its root. Layout settings work with
all themes and site profiles; `kind: course` does not lock the visual design.

The top menu selects the main sections. A contextual panel shows the parent,
related lessons and headings when space permits. On narrow screens it moves into
the reading flow. See [layouts and motion](../guides/layouts.md).

## 3. Edit the supplied pages

| File under `content/` | Purpose |
| --- | --- |
| `pages/home.md` | Course overview and links to the program and lessons |
| `pages/syllabus.md` | Objectives, prerequisites, activities and assessment |
| `pages/lessons.yaml` | Automatic index of its child pages |
| `pages/integration.md` | A complete lesson in Markdown with Python, equations and exercises |
| `pages/notebook.yaml` | Page metadata pointing to the notebook below |
| `notebooks/trapezoid.ipynb` | A small Python notebook with analytic verification exercises |
| `plots/integration.json` | Interactive Plotly figure used in the Markdown lesson |

Use `##` and `###` for sections and subsections in Markdown; the page title is
already its main heading. The supplied notebook has **not been executed** and
contains no saved outputs. Its text states expected analytic results; students
can execute it locally using Python 3 and Jupyter. SciAstro does not execute code.

## 4. Add a lesson

Create `content/pages/linear-systems.md`:

````markdown
---
id: linear-systems
title: Sistemas lineares
description: Resolução de sistemas e verificação do resíduo.
paths: {pt: aulas/sistemas-lineares/}
parent: lessons
layout: article
tags: [Álgebra linear, Python]
---

## Objetivo {#objetivo}

Vamos verificar uma solução de $A x=b$ calculando o resíduo $r=b-Ax$.

::: note title="Antes de começar"
Um resíduo pequeno, sozinho, não garante erro pequeno em um sistema mal condicionado.
:::

## Atividade

Construa um sistema com solução conhecida e compare a solução calculada.

[Voltar às aulas](page:lessons)
````

Append `pages/linear-systems.md` to `pageFiles` in `sciastro.yaml`. Its
`parent: lessons` places it in the lesson index and contextual navigation.
Undated lessons keep their order in `pageFiles`. Use stable IDs and anchors:
`[Activity](page:linear-systems#objetivo)` remains valid when a deployment base
or localized route changes.

## 5. Control downloads

The starter enables article actions globally. A Markdown article can be
downloaded as an unexecuted Python notebook, and a notebook page offers its
original `.ipynb`. The PDF action opens the browser print dialog; choose **Save
as PDF**. It does not create a PDF file on the server.

For a lesson that should only offer PDF, add to its front matter:

```yaml
downloads:
  notebook: false
```

Per-page values override global defaults independently. These actions apply to
`layout: article`, not the overview or listing pages. Read
[downloads and printing](../guides/downloads.md) before sharing notebook sources,
especially when they contain saved outputs or metadata.

## 6. Validate and publish

```sh
pixi run --locked build
```

The initial starter produces five pages and a 404 page. Check the lesson menu,
heading links, notebook download and print layout. Then follow
[deployment](../guides/deployment.md) to publish `dist/` on GitHub Pages or another
static host.

For a live example, visit the [gallery](../gallery.md). To preview the framework's
course example from a SciAstro checkout, run `pixi run --locked dev-course`.
