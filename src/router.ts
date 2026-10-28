import { useEffect, useState } from 'react';

export type Page =
  | 'schedule'
  | 'academics'
  | 'opportunities'
  | 'analysis'
  | 'aboutme'
  | 'parent'
  | 'teacher'
  | 'publish'
  | 'admin'
  | 'notfound';

/** Every page owns a URL, so a link or a bookmark opens exactly that view. */
export const PATHS: Record<Exclude<Page, 'notfound'>, string> = {
  schedule: '/student',
  academics: '/daalgwar',
  opportunities: '/bolomj',
  analysis: '/shinjelgee',
  aboutme: '/taniltsuulga',
  parent: '/parent',
  teacher: '/teacher',
  publish: '/niitleh',
  admin: '/admin',
};

const PAGES: Record<string, Page> = {};
for (const [page, path] of Object.entries(PATHS)) PAGES[path] = page as Page;

function currentPath(): string {
  const trimmed = window.location.pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed.toLowerCase();
}

/** `null` is the site root — the URL the login screen lives on. */
function currentPage(): Page | null {
  const path = currentPath();
  if (path === '/') return null;
  return PAGES[path] ?? 'notfound';
}

const listeners = new Set<() => void>();

/** pushState fires no popstate, so this module tells its own subscribers instead. */
export function navigate(page: Page | null, replace = false) {
  const to = page === null || page === 'notfound' ? '/' : PATHS[page];
  if (to === currentPath()) return;
  if (replace) window.history.replaceState({}, '', to);
  else window.history.pushState({}, '', to);
  listeners.forEach((l) => l());
}

window.addEventListener('popstate', () => listeners.forEach((l) => l()));

export function usePage(): Page | null {
  const [page, setPage] = useState<Page | null>(currentPage);
  useEffect(() => {
    const read = () => setPage(currentPage());
    listeners.add(read);
    read();
    return () => {
      listeners.delete(read);
    };
  }, []);
  return page;
}
