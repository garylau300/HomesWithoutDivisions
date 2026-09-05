/**
 * Fills the approach section's reading spine as the reader moves through it.
 *
 * The spine is drawn complete by default, so this only ever takes something
 * away and gives it back with the scroll — without it, nothing is missing.
 */
export function initSpine(): void {
  const approach = document.querySelector<HTMLElement>('[data-approach]');
  if (!approach) return;

  const steps = Array.from(approach.querySelectorAll<HTMLElement>('[data-approach-step]'));

  /** The spine complete: what a reader sees without scripting, too. */
  const settle = () => {
    approach.style.setProperty('--read-progress', '1');
    for (const step of steps) step.classList.add('is-reached');
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    settle();
    return;
  }

  let queued = false;

  const apply = () => {
    queued = false;
    const rect = approach.getBoundingClientRect();
    if (rect.height === 0) return;

    /*
     * Progress is measured against a line a little below the middle of the
     * viewport rather than its top edge: the rail should fill roughly where the
     * eye is, not a screen ahead of it.
     */
    const line = window.innerHeight * 0.62;
    const progress = Math.min(1, Math.max(0, (line - rect.top) / rect.height));
    approach.style.setProperty('--read-progress', progress.toFixed(4));

    for (const step of steps) {
      step.classList.toggle('is-reached', step.getBoundingClientRect().top <= line);
    }
  };

  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  };

  apply();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}
