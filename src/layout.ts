import type { BuiltPage } from './content.js';
import { childPages, pageAncestors } from './navigation.js';

/** Contextual links stay local to a section, including beyond main-menu depth. */
export function pageContext(pages: readonly BuiltPage[], page: BuiltPage) {
  const localized = pages.filter((entry) => entry.locale === page.locale);
  const visible = (entry: BuiltPage) =>
    entry.navigation !== false &&
    pageAncestors(localized, entry.id).every(
      (ancestor) => ancestor.navigation !== false,
    );
  const currentVisible = visible(page);
  const children = currentVisible
    ? childPages(localized, page.id).filter(visible)
    : [];
  const siblings =
    currentVisible && page.parent
      ? childPages(localized, page.parent).filter(
          (entry) => entry.id !== page.id && visible(entry),
        )
      : [];
  const parent = currentVisible
    ? localized.find((entry) => entry.id === page.parent && visible(entry))
    : undefined;
  const headings =
    page.toc === false
      ? []
      : (page.headings ?? []).filter(
          (heading) => heading.depth === 2 || heading.depth === 3,
        );
  return { parent, children, siblings, headings };
}
