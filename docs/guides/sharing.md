# Link previews and sharing images

SciAstro writes sharing metadata into the generated HTML, so preview crawlers do
not need JavaScript. The default layout includes the page title, description,
canonical URL, site name and language, along with Open Graph and `twitter:*`
image tags when an image is available. See the [Open Graph specification](https://ogp.me/)
for the meaning of these fields.

These settings work with individual and group sites, automatic and composed
pages, and all built-in themes. They do not change images displayed in the page
or replace the browser's favicon.

## Choose an image

Save a PNG or JPEG in `public/images/sharing.png`, then add this to `sciastro.yaml`:

```yaml
social:
  image:
    src: /images/sharing.png
    alt:
      pt: Apresentação do grupo de pesquisa
      en: Research group overview
    width: 1200
    height: 630
```

`width` and `height` are optional and must describe the original file's pixel
dimensions. They do not resize it. A 1200 × 630 composition with the important
content near the center is a useful starting point, not a required size. Each
sharing application controls its own cropping and preview layout.

The same image is used on every page. Titles and descriptions still follow the
current page and language. `alt` may be a shared string or include all enabled
languages; the image file itself is shared between languages.

## Independent fallback

The default policy is `social.fallback: logo`. If `social.image` is absent,
SciAstro uses the explicitly configured site `logo`. No configuration is needed
when that logo is already a PNG or JPEG.

To choose a separate fallback specifically for sharing:

```yaml
social:
  fallback:
    src: /images/institution-symbol.png
    alt:
      pt: Símbolo da instituição
      en: Institution symbol
```

Selection follows these rules:

1. Use `social.image` when provided.
2. Otherwise, use `social.fallback`: a dedicated image, `logo` (the default), or
   `false` to omit an image.
3. If the policy is `logo` and no compatible logo is configured, emit text
   metadata without an image. No generic symbol is substituted.

An explicit fallback replaces the logo fallback; it does not add another step.
Sharing never reads `people.avatarFallback`, member photographs, `home.photo`,
favicons or the theme's built-in marks.

To disable automatic logo reuse:

```yaml
social:
  fallback: false
```

An explicit `social.image` still takes priority over `fallback: false`. To omit
all sharing images, remove `social.image` as well. Titles and descriptions remain.

## Supported files and validation

`social.image` and image-valued `social.fallback` accept:

| Field | Meaning |
| --- | --- |
| `src` | Required `/path` to a `.png`, `.jpg` or `.jpeg` file in `public/` |
| `alt` | Required nonempty description, optionally localized |
| `width`, `height` | Optional positive integer dimensions of the original file |

Explicit paths cannot be remote URLs, query strings or fragments. SciAstro
checks paths, extensions, file existence, dimensions supplied in YAML and
translations. It does not decode files or verify that their bytes match the
extension or their declared dimensions. A missing explicitly configured image
fails validation, including an unused fallback; it is not silently replaced.

This initial implementation supports PNG/JPEG sharing images. If the site logo
uses SVG, WebP, AVIF, GIF or another extension, the Astro integration warns and
omits the image tags. Configure a PNG/JPEG sharing image or use
`social.fallback: false`. The visible logo continues to work as before.

The original file is used **in full**. Logo `viewBox`, `monochrome`, CSS filters
and page image shapes do not apply to sharing. SciAstro does not crop, recolor,
resize, rasterize or generate a substitute image. Prepare a separate PNG/JPEG
if you want a different composition. Existing HTTP(S) PNG/JPEG logo URLs are
passed through without downloading or checking the remote image.

## Deployment and verification

Local image URLs are made absolute using `url` and `base`, including
`SITE_URL`/`BASE_PATH` overrides. For example, `/images/sharing.png` with
`url: https://example.org` and `base: /lab/` becomes
`https://example.org/lab/images/sharing.png`. Do not include `/lab/` in `src`.

After building and deploying:

1. Inspect a page's HTML source for `og:image` and `og:image:alt`.
2. Open the exact image URL and confirm the file is publicly accessible.
3. Share the deployed page in the target application to check the actual preview.

A local preview address is not accessible to external crawlers. Correct metadata
does not guarantee a particular preview layout or when a sharing service will
refresh a previously fetched page.

The default layout implements these tags. A completely replaced layout must
render its own metadata using `site.socialImage`; see the [API reference](../reference/api.md).
