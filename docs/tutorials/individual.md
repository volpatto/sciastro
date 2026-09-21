# Create an individual website

This tutorial creates a small English-language academic website with About,
Research, Supervision, Teaching and Contact pages. The people and institution are
fictional. Replace them with your own information before publishing.

## 1. Generate and run the starter

Follow [installation](../getting-started.md), using `--kind individual --theme modern`.
Run all following commands in the generated website directory. Keep
`pixi run --locked dev` running while you edit; content changes refresh the preview.

## 2. Set your identity

Replace `sciastro.yaml` with:

```yaml title="sciastro.yaml"
schemaVersion: 1
kind: individual
name: Alex Morgan
description: Numerical methods, teaching and scientific software.
affiliation: Example University
url: https://example.org
base: /
locales: [en]
defaultLocale: en
theme: modern
home:
  body: home.en.md
copyright: © 2026 Alex Morgan
footer: Fictional profile for the SciAstro tutorial.
```

The `url` is an origin, without a subdirectory. Replace it with your final domain
before deployment. `base` sets a hosting subdirectory if needed. Omitting the
bibliography here removes the starter's fictional publication list.

## 3. Write the introduction

Replace `content/home.en.md`:

```markdown title="content/home.en.md"
I am a researcher at Example University, working on numerical methods for
transport models and reproducible scientific software.

This website collects my research interests, teaching and supervision activities.
```

## 4. Define research once

Replace `content/research.yaml`:

```yaml title="content/research.yaml"
- id: transport
  title: Numerical transport models
  summary: Discretization and verification of transport equations.
  body: research/transport.en.md
```

Create `content/research/transport.en.md`:

```markdown title="content/research/transport.en.md"
We study discretizations for advection and diffusion equations. Current questions
include conservation, stability and the effect of mesh resolution.

## Computational work

Software accompanies our studies with documented environments and verification
examples. Links to actual repositories and publications can be added here.
```

The brief summary becomes a card on About; the detailed text appears at
`/research/#transport`. Keep `id` stable so shared links remain valid.

## 5. Add supervision

Replace `content/team.yaml`:

```yaml title="content/team.yaml"
- id: jamie-lee
  name: Jamie Lee
  role: student
  status: active
  level: masters
  startYear: 2026
  topic: Conservative methods for transport equations
```

For individual sites, the page is titled **Supervision**. `level` must match one
of the configured [student levels](../conteudo.md#team-and-supervision). When a
student graduates, change `status: alumni` and add `endYear`.

## 6. Add teaching and contact pages

Replace `content/pages.yaml`:

```yaml title="content/pages.yaml"
- slug: teaching
  title: Teaching
  icon: lucide:graduation-cap
  body: teaching.en.md
- slug: contact
  title: Contact
  icon: lucide:mail
  body: contact.en.md
```

Create or replace these Markdown files:

```markdown title="content/teaching.en.md"
## Courses

**Introduction to numerical methods** — Example University, 2026.

Topics include interpolation, linear systems and numerical integration.

## Short courses and talks

Add course materials, slides and recording links here as they become available.
```

```markdown title="content/contact.en.md"
Department of Applied Mathematics, Example University.

Room A-12. [Email](mailto:alex@example.org).
```

For a CV, put a PDF in `public/files/cv.pdf`, add another page record and link to
`[Download CV](/files/cv.pdf)` in its Markdown. SciAstro serves the supplied PDF;
it does not generate or synchronize CV files.

## 7. Check and build

```sh
pixi run --locked build
```

You should have five pages plus `404.html`. Open About, follow the research card,
check Supervision and switch between light and dark mode. The complete YAML and
Markdown snippets in this tutorial are loaded by automated documentation tests.

Then [deploy the website](../guides/deployment.md). For richer layouts, use
[composed sections](../guides/recipes.md) to add software cards, course cards,
professional history or partnership logos without duplicating Astro templates.
