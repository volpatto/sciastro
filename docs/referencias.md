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

## Publication cards from a file and key

In a [composed page](customization.md), a `publications` section can select a work
using **only its BibTeX file and key**. Add this under the page's `sections`:

```yaml
- type: publications
  title:
    pt: Publicações selecionadas
    en: Selected publications
  items:
    - bibtex:
        file: references.bib
        key: silva2025
    - bibtex:
        file: thermodynamics.bib
        key: costa2024
      topic:
        pt: Geoquímica
        en: Geochemistry
```

Both files are relative to `contentDir` (normally `content/`). There is no need to
repeat the title, authors, year, journal, citation details or DOI in YAML. SciAstro
reads the selected records and generates those fields in the rendered HTML.
`topic` is an optional, freely chosen category; use a plain string or translations
as above. It does not change the imported bibliographic metadata.

An explicit `file`/`key` selection works without a `bibliography` setting in
`sciastro.yaml`. Multiple files may contain the same key: each card uses its own
selected file. Cards keep the order of `items`; other entries in those files are
not added automatically. Each file is parsed once per site load and reused across
cards and languages.

If `bibliography.file` is already configured, the shorter form selects from that
library:

```yaml
- type: publications
  items:
    - bibtex: silva2025
      topic: Numerical methods
```

### Imported fields

| Card field | BibTeX metadata |
| --- | --- |
| `title` | Work title; required after import |
| `authors` | Author names in source order, preserving particles, suffixes and institutional names |
| `year` | Publication year parsed by Citation.js |
| `journal` | Journal or proceedings title; publisher when no container title is present |
| `citation` | Volume, issue and pages, for example `42(2), 10–20`; article number when pages are absent |
| `doi` | DOI identifier; `doi:` and DOI resolver URL prefixes are removed |
| `url` | HTTP(S) URL, used as the publication link when no DOI is available |

DOI links take precedence over URL links. A record with neither renders a plain
title. Missing authors, dates, venue or citation details are omitted rather than
invented; an editor is not silently presented as an author. Names use the spelling
provided by the parser, separated by semicolons. Titles and other metadata are
rendered as text. These cards do not depend on the APA/Vancouver citation style.

All manual publication records remain supported and may be mixed with BibTeX
selections. Optional fields alongside `bibtex`, such as `title` or `authors`,
override imported values for that card only; they are **not required**. The source
`.bib` file and other cards using the same key remain unchanged. `topic` belongs
to the card, not to the reference library.

Missing files, unknown/case-mismatched keys, duplicate keys within a file, missing
titles and malformed DOI or HTTP(S) URL metadata fail validation. File paths must
stay inside `contentDir`. Non-web URL schemes are omitted, and no DOI lookup or
other network request is made.

Selecting a publication card does not add a duplicate entry to the page's reference
list. Inline `[@key]` citations and page `references` continue to use the library
configured by `bibliography.file`; selecting another file for a card does not merge
that file into the citation library. The existing `bibliography.publications`
setting controls the built-in Publications page when `pageFiles` is not used.

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

See the fictional [example bibliography](https://github.com/volpatto/sciastro/blob/main/starters/group/content/references.bib)
and the [Citation.js documentation](https://citation.js.org/).
