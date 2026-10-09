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
