# Analytics

Configure **Cloudflare Web Analytics** or **Umami** in `sciastro.yaml`.
Analytics is disabled by default and works with individual/group sites, all themes,
custom layouts, GitHub Pages and other static hosting. No additional package,
JavaScript file or pasted HTML snippet is needed. View statistics in your provider's dashboard.

## Choose a provider

| Provider | Supported measurements | Hosting |
| --- | --- | --- |
| Cloudflare Web Analytics | Page views, visits and performance | Free hosted service; no DNS or hosting change required |
| Umami | Page views and optional link events | Cloud has free/paid plans; self-hosting needs a server and database |

Check [Cloudflare](https://developers.cloudflare.com/web-analytics/about/) and
[Umami plans](https://umami.is/pricing) for current limits. SciAstro does not create
accounts or operate an analytics server. GitHub Pages can host your website, but
cannot run an Umami server/database.

## Cloudflare setup

1. In Cloudflare, open **Web Analytics**, choose **Add a site**, and register the
   hostname from your site's `url`, such as `example.org`.
2. Open **Manage site** and find the JavaScript snippet. Copy the 32-character
   `token` inside `data-cf-beacon`. This public site identifier is **not an API token**.
3. Add the following block, replacing the example token. Build and deploy as usual,
   visit the published address, and open the dashboard. Metrics may take a few minutes.

```yaml
analytics:
  provider: cloudflare
  token: "0123456789abcdef0123456789abcdef"
```

If your hosting already injects Cloudflare's tracker automatically, leave SciAstro
analytics disabled. Do not also paste the snippet into a custom layout.
Cloudflare has no custom events: its configuration rejects `events`, `websiteId`
and `scriptUrl`. See [Cloudflare setup](https://developers.cloudflare.com/web-analytics/get-started/).

## Umami Cloud setup

1. Create an [Umami Cloud account](https://cloud.umami.is/signup) and add your website.
2. In website settings, find **Tracking code** and copy `data-website-id`.
3. Replace the fictional ID below, build and deploy, then visit the published site
   and open Umami's dashboard.

```yaml
analytics:
  provider: umami
  websiteId: "94db1cb1-74f4-4a40-ad6c-962362670409"
```

The default script is `https://cloud.umami.is/script.js`. If your tracking code
specifies another address, set `scriptUrl` to that HTTPS URL. Configuration is
public: never put API keys, passwords or dashboard credentials here.
See [where to find the code](https://docs.umami.is/docs/collect-data).

## Self-hosted Umami and events

For your own [Umami installation](https://docs.umami.is/docs/installation), set
its tracker URL. The same event options also work with Umami Cloud:

```yaml
analytics:
  provider: umami
  websiteId: "94db1cb1-74f4-4a40-ad6c-962362670409"
  scriptUrl: https://stats.example.org/script.js
  events:
    downloads: true
    externalLinks: true
    custom: true
```

| Event option (default: `false`) | Behavior |
| --- | --- |
| `downloads` | `file_download` for links with `download: true` or a recognized extension |
| `externalLinks` | `external_link` for HTTP(S) destinations on another origin |
| `custom` | Enables a link's `analyticsEvent` name |

Automatic detection includes Markdown links and publication DOI links. Recognized
extensions are `.pdf`, `.zip`, `.gz`, `.tar`, `.tgz`, `.bz2`, `.xz`, `.7z`, `.csv`,
`.tsv`, `.xls`, `.xlsx`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.ipynb`, `.bib`, `.tex`
and `.epub` (case-insensitive). Set `download: true` for endpoints without an extension.
These are **clicks**, not confirmed downloads, readership or software installations.
File events take precedence over external-link events; one click emits at most
one SciAstro event. Internal navigation produces page views. Email/telephone links
are excluded.

## Name or exclude a link

Add `analyticsEvent` to a composed page's link:

```yaml
links:
  - label: { pt: Baixar currículo, en: Download CV }
    url: /files/cv.pdf
    icon: lucide:download
    download: true
    analyticsEvent: cv_download
  - label: GitHub
    url: https://github.com/example
    analyticsEvent: false
```

With `events.custom: true`, the first link emits `cv_download` instead of the file
event. Names start with a lowercase letter and contain up to 50 lowercase letters,
digits, underscores or hyphens (`false` is reserved for exclusion). Keep names consistent across languages. With
custom events off, a named link can still qualify for automatic events.

`analyticsEvent: false` excludes **all SciAstro click events** for that link, but
does not suppress page views. The field works on section, card, figure and logo
links, and on root profile `links` (whose labels remain plain strings).
Custom components can forward it as `data-sciastro-event`: stringify `false` to
`"false"`, and omit the attribute when unset. Markdown participates in automatic
detection; use composed links for names and per-link exclusions.

## Production, previews and data

- Development and disabled configurations inject no tracker.
- Production builds load the tracker only on the exact configured `url` origin
  and within `base`. Protocol and port must match. Localhost and loopback addresses
  are excluded even if configured as the site URL.
- Previews on another origin and local previews do not load it. If you override
  `SITE_URL` for a hosted preview, set `SCIASTRO_ANALYTICS=false` in that build's
  environment. This removes SciAstro's integration, not separately added scripts.
- Both providers respect browser **Do Not Track** before loading.
- Umami excludes page query strings and fragments. SciAstro events send the target
  origin/path (up to 500 characters) and page `locale`, without link labels, URL
  credentials, queries, fragments, form values or user IDs. The provider still
  processes its normal visit metadata.
- Providers record page views themselves; SciAstro never adds a duplicate manual
  page-view call. Events are best effort: blocked scripts, network errors or clicks
  before Umami loads may not be recorded. Navigation never waits for tracking.

Keep visitor-facing privacy information consistent with the service you enable.
SciAstro does not generate a privacy policy or determine legal compliance.
Tracking identifiers, event names and script URLs are public site configuration.
To disable analytics, remove the block or use:

```yaml
analytics: false
```

## Troubleshooting and verification

Check the published address against `url`/`base`, the provider's registered
hostname/identifier, Do Not Track and blocked network requests. Preview exclusion
is intentional. After a domain move, update both site and provider settings.
If you set a Content Security Policy, allow the tracker in `script-src` and its
ingestion endpoint in `connect-src`. For Cloudflare these are
`https://static.cloudflareinsights.com` and `https://cloudflareinsights.com`;
for Umami use the addresses from your installation.

Run `sciastro check` through the site's existing environment before building.
It validates configuration, not account access or delivery to a live service.
SciAstro's CI builds isolated sites and simulates providers, testing both languages,
custom layouts, preview exclusion, event counts, opt-outs and navigation/downloads
when trackers fail. No analytics credentials or real tracking requests are used.
