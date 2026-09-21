# BibTeX references and citations

SciAstro uses Citation.js to parse BibTeX and format references with CSL. Processing
happens during the build. Visitors receive static HTML without external lookups
or bibliography processing in the browser.

## Configuration

In `sciastro.yaml`:

```yaml
bibliography:
  file: references.bib
  style: apa
  publications: [silva2025, costa2024]
```

The file path is relative to `contentDir`. `publications` selects the entries shown
on the **Publications** page, in the specified order. The `.bib` file can also contain
other authors' work cited in your text; adding an entry does not automatically
claim it as your own publication. Omit `publications` or use `[]` to hide that
page while keeping citations available.

## Cite in Markdown

```markdown
This method was described in [@silva2025].

A comparison can cite several studies [@silva2025; @costa2024].
```

Each key becomes a link to the corresponding reference on the current page.
Repeated citations produce only one bibliography entry per page. All Research
sections share one bibliography.

Keys are case-sensitive. Missing citation keys or repeated BibTeX keys stop
validation with an explicit error. Inside inline code or fenced code blocks,
`[@key]` remains literal and does not create a citation.

No Astro changes are needed. The same syntax works in introductions and additional
pages, including software, teaching and projects.

## Formatting

- `apa`: author–year citations and CSL APA references. Disambiguation such as
  `2025a`/`2025b` considers the complete library, keeping labels consistent across pages.
- `vancouver`: numeric citations and CSL Vancouver references. **Numbers follow
  the order of the `.bib` file globally**, rather than the first citation on each
  page. This differs from a typical Vancouver manuscript. Reordering the file
  may change citation numbers.

The parser handles names, dates, institutional authors, BibTeX macros and LaTeX
escapes in metadata. Reference language follows the page language. DOI and URL
fields receive their own links when present.

This release supports `[@key]` and `[@a; @b]`. Page locators, narrative citations,
LaTeX `\cite{...}` commands and external CSL styles do not yet have a configuration
interface. A valid citation key does not establish the accuracy of its metadata
or the claim it supports.

See the fictional [example bibliography](../starters/group/content/references.bib)
and the [Citation.js documentation](https://citation.js.org/).
