import {useCallback, useEffect, useRef, type RefObject} from 'react';

/** How much one arrow press scrolls: half of what is visible. */
const STEP = 0.5;

function scrollerOf(element: HTMLElement | null, boundary: HTMLElement | null): HTMLElement | null {
  for (let node = element?.parentElement ?? null; node && node !== boundary; node = node.parentElement) {
    const {overflowY} = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

/** The scroller itself when it takes focus (ScrollView with tabIndex 0), else its nearest focusable ancestor. */
function focusOwnerOf(scroller: HTMLElement, boundary: HTMLElement | null): HTMLElement {
  for (let node: HTMLElement | null = scroller; node && node !== boundary; node = node.parentElement) {
    if (node.tabIndex >= 0) return node;
  }
  return scroller;
}

/** The top of the visible text: content scrolls under the header inset. */
function visibleTop(scroller: HTMLElement): number {
  return scroller.getBoundingClientRect().top + (parseFloat(getComputedStyle(scroller).paddingTop) || 0);
}

function fullyVisible(element: HTMLElement, scroller: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.top >= visibleTop(scroller) - 1 && rect.bottom <= scroller.getBoundingClientRect().bottom + 1;
}

function scrollTo(scroller: HTMLElement, top: number): void {
  scroller.scrollTo({top: Math.max(0, top), behavior: 'instant'});
}

/**
 * Reading a long event with the D-pad: Down and Up scroll the details (half a
 * screen per press) until their end, and only then does Down reach the actions
 * below. A link inside the details (`linkId`) takes the focus while it is in
 * view at the top, and `jumpTo` scrolls to a part of the details.
 *
 * `contentRef` is the details' own content; `shellRef` the route's shell, which
 * also holds the actions.
 */
export function useDetailScroll(contentRef: RefObject<HTMLElement | null>, shellRef: RefObject<HTMLElement | null>, linkId: string | null) {
  const linkPassed = useRef(false);

  const parts = useCallback(() => {
    const scroller = scrollerOf(contentRef.current, shellRef.current);
    if (!scroller) return null;
    return {scroller, owner: focusOwnerOf(scroller, shellRef.current), link: linkId ? document.getElementById(linkId) : null};
  }, [contentRef, linkId, shellRef]);

  useEffect(() => {
    // On the window, in the capture phase: before the focus navigation sees the arrow.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const found = parts();
      if (!found) return;
      const {scroller, owner, link} = found;
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !(active === owner || owner.contains(active))) return;
      const handled = () => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      const step = Math.max(1, Math.round(scroller.clientHeight * STEP));
      const remaining = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;

      if (event.key === 'ArrowDown') {
        if (active === owner && link && !linkPassed.current && fullyVisible(link, scroller)) {
          link.focus({preventScroll: true});
          handled();
          return;
        }
        if (remaining > 1) {
          if (active !== owner) owner.focus({preventScroll: true});
          if (link) linkPassed.current = true;
          scrollTo(scroller, scroller.scrollTop + Math.min(step, remaining));
          handled();
        }
        // At the end: the focus navigation moves on to the actions.
        return;
      }

      if (active === link) {
        owner.focus({preventScroll: true});
        handled();
        return;
      }
      if (scroller.scrollTop > 1) {
        scrollTo(scroller, scroller.scrollTop - step);
        if (scroller.scrollTop <= 1) linkPassed.current = false;
        handled();
        return;
      }
      linkPassed.current = false;
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [parts]);

  /** Scrolls so `element` is at the top of the visible details, the details keeping the focus. */
  const jumpTo = useCallback(
    (element: HTMLElement | null) => {
      const found = parts();
      if (!found || !element) return;
      const {scroller, owner} = found;
      scrollTo(scroller, scroller.scrollTop + element.getBoundingClientRect().top - visibleTop(scroller));
      linkPassed.current = true;
      owner.focus({preventScroll: true});
    },
    [parts],
  );

  return jumpTo;
}
