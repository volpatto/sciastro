/** The page relationships are also used by breadcrumbs and automatic listings. */
export interface NavigationPage {
  id: string;
  parent?: string;
  navigation?: boolean;
  date?: string;
}

export interface NavigationNode<T extends NavigationPage> {
  page: T;
  current: boolean;
  activeAncestor: boolean;
  children: NavigationNode<T>[];
}

/** Returns the ancestors in reading order, independently of menu visibility. */
export function pageAncestors<T extends NavigationPage>(
  pages: readonly T[],
  pageId: string,
): T[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const ancestors: T[] = [];
  const visited = new Set([pageId]);
  let parent = byId.get(pageId)?.parent;
  while (parent && !visited.has(parent)) {
    visited.add(parent);
    const page = byId.get(parent);
    if (!page) break;
    ancestors.unshift(page);
    parent = page.parent;
  }
  return ancestors;
}

/** Hidden parents hide their whole menu branch, but never remove page routes. */
export function navigationTree<T extends NavigationPage>(
  pages: readonly T[],
  currentId: string,
  maxDepth: number,
): NavigationNode<T>[] {
  const activeAncestors = new Set(
    pageAncestors(pages, currentId).map((page) => page.id),
  );
  const childrenByParent = new Map<string | undefined, T[]>();
  for (const page of pages) {
    if (page.navigation === false) continue;
    const siblings = childrenByParent.get(page.parent) ?? [];
    siblings.push(page);
    childrenByParent.set(page.parent, siblings);
  }
  function branch(
    parent: string | undefined,
    depth: number,
  ): NavigationNode<T>[] {
    if (depth > maxDepth) return [];
    return (childrenByParent.get(parent) ?? []).map((page) => ({
      page,
      current: page.id === currentId,
      activeAncestor: activeAncestors.has(page.id),
      children: branch(page.id, depth + 1),
    }));
  }
  return branch(undefined, 1);
}

/** Newest dated children first; equal dates and undated entries retain author order. */
export function childPages<T extends NavigationPage>(
  pages: readonly T[],
  parentId: string,
): T[] {
  return pages
    .filter((page) => page.parent === parentId)
    .sort((left, right) => (right.date ?? '').localeCompare(left.date ?? ''));
}

export function displayDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'pt' ? 'pt-BR' : 'en-GB', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
