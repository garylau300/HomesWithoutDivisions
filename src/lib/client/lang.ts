/** Remembers the reader's language choice so the root URL can honour it next visit. */
export function initLangMemory(): void {
  document.querySelectorAll<HTMLAnchorElement>('.lang-toggle__option').forEach((link) => {
    link.addEventListener('click', () => {
      try {
        localStorage.setItem('hwd-lang', link.dataset.lang ?? '');
      } catch {
        // Private mode or blocked storage: the site works the same without it.
      }
    });
  });
}
