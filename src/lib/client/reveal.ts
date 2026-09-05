/**
 * Scroll reveal.
 *
 * Elements marked `data-reveal` are visible by default in CSS; the `.js` class
 * on <html> is what makes them start hidden, so a reader without JavaScript
 * never loses anything. This only adds the reveal once they are near the
 * viewport.
 *
 * Hiding content in anticipation of revealing it means every failure here costs
 * the reader the page, so there are two nets under it. This function never
 * throws without first showing everything, and it only reports itself ready
 * once the observer is genuinely watching — the bootstrap in BaseLayout shows
 * the page anyway if that report never comes.
 */
export function initReveal(): void {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
  const showAll = () => targets.forEach((el) => el.classList.add('is-revealed'));

  try {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (reduced.matches || !('IntersectionObserver' in window)) {
      showAll();
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
      );

      targets.forEach((el) => observer.observe(el));
    }

    /*
     * Last, not first: reported only once the content is either shown or under
     * observation. Announcing earlier would disarm the failsafe on the way to
     * throwing, which is the one case it exists for.
     */
    document.documentElement.classList.add('reveal-ready');
  } catch {
    showAll();
  }
}
