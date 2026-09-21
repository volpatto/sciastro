# Section recipes

These recipes use [composed pages](../customization.md): list **all** pages in
`pageFiles`, then add the snippets below under a page's `sections`. Strings are
English-only for brevity; use `{ pt: ..., en: ... }` for bilingual text.
Examples describe fictional work. Replace URLs, people, logos and publication
metadata with your own material.

## Software with distribution and reproducibility

```yaml
- type: cards
  id: software
  title: Scientific software
  layout: rows
  items:
    - title: Example solver
      eyebrow: Python package
      text: |
        A solver for transport models. Releases include installation instructions,
        verification examples and automated regression tests.
      meta: MIT license
      links:
        - label: Repository
          url: https://github.com/example/solver
          icon: lucide:code-xml
        - label: Documentation
          url: https://example.org/solver/
          icon: lucide:book-open
```

Describe actual practices rather than assuming every project has the same test or
release coverage. To show a logo, add an `images` item with `src` and `alt`.

## Short courses and recordings

```yaml
- type: cards
  id: short-courses
  title: Short courses and talks
  items:
    - title: Finite element methods with Firedrake
      meta: Short course · 2026
      text: Course outline, notebooks and recordings.
      links:
        - label: YouTube playlist
          url: https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID
          icon: lucide:youtube
```

Separate regular courses into another `cards` or `list` section. A recording link
is an ordinary outbound link; SciAstro does not embed a video tracker.

## Research figure with credits

```yaml
- type: figure
  id: transport
  title: Transport models
  text: Explain the scientific question and the scope of this particular result.
  image:
    src: /images/transport.png
    alt: Describe the plotted variables and visible trends.
    width: 1200
    height: 800
    enlarge: true
    caption: Explain the conditions and identify the original source.
    links:
      - label: Source and license
        url: https://example.org/research/source
```

Create the image in `public/images/transport.png`. Use alt text that communicates
the figure's purpose; retain captions and credits. A citation does not by itself
permit redistributing a figure. For a cropped display window, use `viewBox` with
the original dimensions; see [image fields](../customization.md#section-types).

## Multi-institutional partnerships

```yaml
- type: prose
  title: Academic collaborations
  text: |
    Our group includes researchers at Example University and Example Institute.
    Joint work includes postgraduate supervision and collaborative projects.
- type: logos
  title: Partner institutions
  items:
    - image:
        src: /images/example-university.svg
        alt: Example University
      link:
        label: Example University website
        url: https://example.org
```

Keep institutional affiliation, collaborations and prior employment distinct.
Use a separate `logos` section for industrial partners where appropriate.
Logos retain their owners' rights; the package's MIT license does not relicense them.

## Career or education timeline

```yaml
- type: timeline
  title: Professional experience
  items:
    - title: Researcher
      period: 2026–present
      subtitle: Example Institute
      text: Research in numerical models and scientific computing.
    - title: Senior scientific software developer
      period: 2022–2026
      text: Development and maintenance of scientific software for industrial use.
```

A CV can name previous employers if appropriate; other pages can describe prior
software-industry experience without attributing current projects to an employer.

## Team inside a composed site

```yaml
- type: team
  id: people
  title: Our team
```

This section reads `content/team.yaml` and uses the same active/alumni grouping as
the automatic Team page. The homepage can remain a short overview with research
cards. Card links can point to `/research/#transport`, or their translated paths.

## Migrate an existing website

1. Create a branch and inventory existing URLs, language variants, downloads and
   reference keys. Keep the current website as the comparison point.
2. Install a pinned SciAstro release or archive. Keep the content and `public/`
   directory in the website repository.
3. Use automatic pages for a conventional structure, or `pageFiles` to preserve
   existing page order, routes and sections. Do not retain duplicate page definitions.
4. Select a theme. For a sidebar and academic typography, start with `lncc`.
   Transfer colors, logo, favicon, footer and `themeStorageKey` through configuration.
5. Replace repeated markup with cards, lists, timelines, figures and logo sections.
   Keep truly specialized rendering in registered Astro components.
6. Run content validation and a production build. Check every language, internal
   link, download, citation, mobile menu and theme before replacing the old site.

The [LNCC example](https://github.com/volpatto/sciastro/tree/main/examples/lncc)
shows composed pages, a custom component and CSS. An update to the framework does
not overwrite a consumer's content; it takes effect when that consumer updates
its dependency and rebuilds.
