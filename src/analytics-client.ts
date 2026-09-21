import type { AnalyticsConfig } from './analytics.js';

type EnabledAnalytics = Exclude<AnalyticsConfig, false>;
export interface AnalyticsRuntime {
  analytics: EnabledAnalytics;
  url: string;
  base: string;
}
type TrackedEvent = { name: string; data: Record<string, string> };
type AnalyticsWindow = Window & {
  sciastroAnalyticsStarted?: boolean;
  umami?: { track: (name: string, data: Record<string, string>) => unknown };
};

/** A built preview must not count as a visit to the published website. */
export function trackingAllowed(
  settings: Pick<AnalyticsRuntime, 'url' | 'base'>,
  current: URL,
  doNotTrack: string | null,
): boolean {
  const local =
    /^(?:localhost|.*\.localhost|127(?:\.\d+){3}|\[::1\]|0\.0\.0\.0)$/i;
  return (
    doNotTrack !== '1' &&
    doNotTrack !== 'yes' &&
    !local.test(current.hostname) &&
    current.origin === new URL(settings.url).origin &&
    (current.pathname.startsWith(settings.base) ||
      current.pathname === settings.base.slice(0, -1))
  );
}

/** A custom name takes precedence over download, then external-link detection. */
export function linkEvent(
  link: {
    href: string;
    download: boolean;
    custom?: string;
  },
  current: URL,
  events: Extract<EnabledAnalytics, { provider: 'umami' }>['events'],
  locale: string,
): TrackedEvent | undefined {
  if (link.custom === 'false') return;
  let target: URL;
  try {
    target = new URL(link.href, current);
  } catch {
    return;
  }
  if (!['http:', 'https:'].includes(target.protocol)) return;
  const custom =
    events.custom && link.custom && /^[a-z][a-z0-9_-]{0,49}$/.test(link.custom)
      ? link.custom
      : undefined;
  const file =
    link.download ||
    /\.(?:pdf|zip|gz|tar|tgz|bz2|xz|7z|csv|tsv|xlsx?|docx?|pptx?|ipynb|bib|tex|epub)$/i.test(
      target.pathname,
    );
  const name =
    custom ||
    (events.downloads && file
      ? 'file_download'
      : events.externalLinks && target.origin !== current.origin
        ? 'external_link'
        : undefined);
  if (!name) return;
  // Do not send link text, URL credentials, query strings, fragments or form data.
  return {
    name,
    data: {
      url: `${target.origin}${target.pathname}`.slice(0, 500),
      locale: locale.slice(0, 50),
    },
  };
}

/** Loaded by Astro only for enabled production builds; independent of themes. */
export function startAnalytics(settings: AnalyticsRuntime): void {
  const win = window as AnalyticsWindow;
  if (
    win.sciastroAnalyticsStarted ||
    !trackingAllowed(settings, new URL(location.href), navigator.doNotTrack)
  )
    return;
  win.sciastroAnalyticsStarted = true;
  const script = document.createElement('script');
  script.dataset.sciastroAnalytics = settings.analytics.provider;
  script.async = true;
  if (settings.analytics.provider === 'cloudflare') {
    script.type = 'module';
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    script.setAttribute(
      'data-cf-beacon',
      JSON.stringify({ token: settings.analytics.token }),
    );
  } else {
    const { websiteId, scriptUrl, events } = settings.analytics;
    script.src = scriptUrl;
    script.dataset.websiteId = websiteId;
    script.dataset.domains = new URL(settings.url).hostname;
    script.dataset.doNotTrack = 'true';
    script.dataset.excludeSearch = 'true';
    script.dataset.excludeHash = 'true';
    // Umami records page views itself. Calling track() here would count them twice.
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        (event.type === 'click' ? event.button !== 0 : event.button !== 1)
      )
        return;
      if (
        !trackingAllowed(settings, new URL(location.href), navigator.doNotTrack)
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const tracked = linkEvent(
        {
          href: link.href,
          download: link.hasAttribute('download'),
          custom: link.dataset.sciastroEvent,
        },
        new URL(location.href),
        events,
        document.documentElement.lang,
      );
      if (!tracked || !win.umami) return;
      // Tracking is best effort and must never delay or replace normal navigation.
      try {
        void Promise.resolve(win.umami.track(tracked.name, tracked.data)).catch(
          () => {},
        );
      } catch {
        /* A failing third-party tracker must not break the website. */
      }
    };
    if (events.downloads || events.externalLinks || events.custom) {
      document.addEventListener('click', click);
      document.addEventListener('auxclick', click);
    }
  }
  document.head.append(script);
}
