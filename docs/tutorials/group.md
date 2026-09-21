# Create a research-group website

This tutorial builds a bilingual group website. The Portuguese homepage is
**Início** and the English homepage is **Home**. It has a brief overview and cards
leading to detailed Research sections, plus faculty, students and alumni.
All names below are fictional.

## 1. Create the project

Follow [installation](../getting-started.md), using `--kind group --theme classic`.
Open the generated directory and start `pixi run --locked dev`.

## 2. Configure the group

Replace `sciastro.yaml`:

```yaml title="sciastro.yaml"
schemaVersion: 1
kind: group
name: Applied Modelling Group
description:
  pt: Pesquisa em modelos matemáticos e computação científica.
  en: Research in mathematical models and scientific computing.
affiliation:
  pt: Universidade Exemplo e Instituto Exemplo
  en: Example University and Example Institute
url: https://example.org
base: /
locales: [pt, en]
defaultLocale: pt
theme: classic
home:
  body: { pt: home.pt.md, en: home.en.md }
bibliography:
  file: references.bib
  style: apa
  publications: []
footer:
  pt: Grupo fictício para o tutorial do SciAstro.
  en: Fictional group for the SciAstro tutorial.
```

The shared `affiliation` can name multiple institutions; individual affiliations
belong to people records. A logo is optional: place an authorized file in
`public/images/` and set `logo.src` and translated `logo.alt`.

## 3. Keep the homepage brief

```markdown title="content/home.pt.md"
Somos um grupo multi-institucional de pesquisa em modelagem matemática e
computação científica. Reunimos pesquisadores da Universidade Exemplo e do
Instituto Exemplo.

Nossas áreas de atuação estão resumidas abaixo. Cada card leva à descrição
completa da linha de pesquisa.
```

```markdown title="content/home.en.md"
We are a multi-institutional research group in mathematical modelling and
scientific computing, with members at Example University and Example Institute.

The cards below introduce our research areas and link to their full descriptions.
```

## 4. Add an area and a citation

Replace `content/research.yaml`:

```yaml title="content/research.yaml"
- id: scientific-computing
  title: { pt: Computação científica, en: Scientific computing }
  summary:
    pt: Métodos numéricos e software para modelos matemáticos.
    en: Numerical methods and software for mathematical models.
  body:
    pt: research/computing.pt.md
    en: research/computing.en.md
```

```markdown title="content/research/computing.pt.md"
Estudamos a formulação, a discretização e a verificação de modelos matemáticos.
A referência [@example2026] demonstra a sintaxe de citações; não é um artigo real.
```

```markdown title="content/research/computing.en.md"
We study the formulation, discretization and verification of mathematical models.
The reference [@example2026] demonstrates citation syntax; it is not a real paper.
```

Replace `content/references.bib`:

```bibtex title="content/references.bib"
@article{example2026,
  author = {Morgan, Alex and Lee, Jamie},
  title = {A fictional reference for a website tutorial},
  journal = {Example Journal},
  year = {2026}
}
```

The reference appears beneath the research page, once per language. It does not
appear as a group publication until you select its key in
`bibliography.publications`. Use only real publications belonging to your group
in the published site's selection. See [BibTeX](../referencias.md).

## 5. Organize the team

Replace `content/team.yaml`:

```yaml title="content/team.yaml"
- id: alex-morgan
  name: Alex Morgan
  role: faculty
  status: active
  affiliation: Example University
- id: robin-santos
  name: Robin Santos
  role: researcher
  status: active
  affiliation: Example Institute
- id: jamie-lee
  name: Jamie Lee
  role: student
  status: active
  level: masters
  startYear: 2026
  topic: { pt: Métodos conservativos, en: Conservative methods }
- id: sam-costa
  name: Sam Costa
  role: student
  status: active
  level: undergraduate
  startYear: 2026
- id: casey-lima
  name: Casey Lima
  role: student
  status: alumni
  level: phd
  startYear: 2021
  endYear: 2025
```

The Team page separates faculty, researchers, active students by level, and alumni.
Unused categories are omitted. Default student levels are undergraduate research,
master's, doctorate and postdoctoral research; [customize them](../conteudo.md#team-and-supervision)
when needed. A postdoctoral member can instead use `role: researcher`.

To keep this first site to its three main pages, replace `content/pages.yaml`:

```yaml title="content/pages.yaml"
[]
```

Add Software, Projects and Contact later with the
[additional-page guide](../conteudo.md#additional-pages), or use
[composed pages](../customization.md) for partnership logos and project cards.

## 6. Review both languages

```sh
pixi run --locked build
```

Expect six localized pages plus `404.html`. Visit `/`, `/pesquisa/`, `/equipe/`
and their English versions. Click a homepage card, follow a citation and check
the active/alumni separation. BR and GB flags are the defaults; labels remain
visible. The tutorial's complete file snippets are exercised by automated tests.

Changing `locales` affects what is built. If both languages remain enabled, fill
both sides of every translated field. See [language configuration](../guides/languages.md),
then [deploy](../guides/deployment.md).
