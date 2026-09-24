# Notebook downloads and PDF printing

Article pages can offer a notebook download and a PDF action. Both are opt-in,
work for every site profile and use YAML configuration. SciAstro does not
execute notebook cells or require a Python server to serve the site.

## Enable actions globally

Add to `sciastro.yaml`:

```yaml
downloads:
  notebook: true
  pdf: true
```

Both defaults are `false`. Actions appear on eligible pages with
`layout: article`; enabling them does not turn ordinary pages or listing indexes
into articles. Notebook downloads require a nonempty Markdown or notebook body.
The PDF action also supports an article composed from sections.

## Override one article

Use `downloads` in a YAML page record or in Markdown front matter:

```yaml
id: introduction
title: Introduction
paths: {en: notes/introduction/}
layout: article
body: notes/introduction.md
downloads:
  notebook: false
  pdf: true
```

Only fields explicitly set on the page override the global values. For example,
`downloads: {notebook: false}` leaves the global PDF choice unchanged.

## What the notebook contains

### A page backed by `.ipynb`

The download is the **original notebook source**, including its metadata and
saved outputs. It is not reconstructed from the rendered webpage. Cell display
options, hidden-output tags and HTML sanitization affect the webpage; they do
not redact the original file. Review what the notebook contains before enabling
its download.

### A page written in Markdown

SciAstro creates a valid, unexecuted Python notebook from the page body:

- A first Markdown cell contains the page title, description and source link.
- Top-level fenced `python`, `python3` and `py` blocks become code cells.
- Prose and other language blocks remain Markdown cells.
- Code cells have no execution count or outputs.
- YAML front matter and separately composed YAML sections are not included.

The export preserves source text. SciAstro-specific cards, callouts, citations,
`page:` links, Plotly directives and numbered references may need adaptation in
Jupyter; they are not converted into equivalent notebook extensions. Local
images, data and Plotly JSON files are not bundled with the download. Keep the
required files alongside the notebook or update their paths.

The download therefore provides an editable starting point for computation,
not an offline copy of the fully rendered website. Its metadata records these
limitations.

## Save an article as PDF

Click the article's PDF action, then choose **Save as PDF** in your browser's
print dialog. The print stylesheet removes the main and contextual navigation,
interactive controls and decorative framing, and prepares the article content
for printing. You can also use your browser's normal Print command.

There is no prebuilt `.pdf` URL, server-side PDF job or automatic file download.
Paper size, margins, headers, page breaks and font handling can vary by browser
and print settings. Review the preview before saving, especially for wide
tables, large plots and long equations. Interactive graphics cannot retain
their controls in a PDF.

## Deployment and examples

Notebook URLs are generated beneath the configured `base`, so they remain
portable on GitHub project Pages and institutional subdirectories. They are
ordinary static files; visitors do not need a SciAstro or Python installation
to download them.

The [course tutorial](../tutorials/course.md) demonstrates both source types.
For mathematical notation, code, figures and notebook display settings, see
[scientific Markdown and notebooks](writing.md).
