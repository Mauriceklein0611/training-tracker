import { useEffect, useState } from 'react';

/**
 * Whether an element is currently inside the viewport.
 *
 * Used to keep the running rest visible exactly once (#44): the rest timer sits
 * in the exercise, and the workout header only repeats it once the exercise has
 * been scrolled away. A mounted element counts as visible until the observer
 * says otherwise, so nothing flashes twice on the first frame and the behaviour
 * stays sane where IntersectionObserver is unavailable (older browsers, tests).
 *
 * `topOffsetPx` shrinks the observed area at the top, so an element hidden
 * *behind* the sticky header is correctly treated as not visible.
 */
export function useInViewport(
  topOffsetPx = 0,
): [(node: HTMLElement | null) => void, boolean] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!node) {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setVisible(entry.isIntersecting);
      },
      { rootMargin: `-${topOffsetPx}px 0px 0px 0px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, topOffsetPx]);

  return [setNode, visible];
}
