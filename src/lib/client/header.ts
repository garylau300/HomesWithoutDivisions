/**
 * Condenses the site header once the page has scrolled past the hero's top edge.
 *
 * Drives a 0→1 progress value that the CSS interpolates the logo size from, so
 * the lockup shrinks smoothly with the scroll rather than snapping between two
 * sizes. Reads are batched into a frame to keep them off the scroll thread.
 */
const RUNWAY = 220;

export function initHeader(): void {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!header) return;

  let queued = false;

  const apply = () => {
    queued = false;
    const progress = Math.min(1, Math.max(0, window.scrollY / RUNWAY));
    header.style.setProperty('--scroll-progress', progress.toFixed(4));
    header.classList.toggle('is-condensed', window.scrollY > 24);
  };

  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  };

  apply();
  window.addEventListener('scroll', onScroll, { passive: true });
}
