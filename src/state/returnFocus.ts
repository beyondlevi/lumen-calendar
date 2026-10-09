// Where the focus goes when the pager comes back from Review: Edit returns to
// the event text, Save and Discard to the next event of today, instead of the
// control that was focused when Review opened.

export type FocusRequest = 'field' | 'next-event';

let pending: FocusRequest | null = null;

export function requestFocus(target: FocusRequest): void {
  pending = target;
}

/** True once after requestFocus(target). */
export function takeFocus(target: FocusRequest): boolean {
  if (pending !== target) return false;
  pending = null;
  return true;
}

/** Focuses the element found by `find` after the page transition has settled. */
export function focusAfterTransition(find: () => HTMLElement | null): () => void {
  let second = 0;
  const first = requestAnimationFrame(() => {
    second = requestAnimationFrame(() => find()?.focus({preventScroll: false}));
  });
  return () => {
    cancelAnimationFrame(first);
    cancelAnimationFrame(second);
  };
}

/** About a second and a half at 30 to 60 frames a second. */
const SETTLE_FRAMES = 60;

/**
 * Keeps the focus on `find()` while the page transition settles: the
 * transition applies its own initial focus (top-left, or where a previous
 * visit left it) more than once after the route mounts. Stops at the first key
 * the wearer presses, or after about a second.
 */
export function focusWhenSettled(region: () => HTMLElement | null, find: () => HTMLElement | null): () => void {
  let frame = 0;
  let count = 0;
  let done = false;
  const stop = () => {
    done = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('keydown', stop, true);
  };
  const step = () => {
    if (done) return;
    const root = region();
    const target = find();
    const active = document.activeElement;
    if (root && target && active instanceof HTMLElement && root.contains(active) && active !== target) {
      target.focus({preventScroll: false});
    }
    count += 1;
    if (count < SETTLE_FRAMES) frame = requestAnimationFrame(step);
    else stop();
  };
  window.addEventListener('keydown', stop, true);
  frame = requestAnimationFrame(step);
  return stop;
}
