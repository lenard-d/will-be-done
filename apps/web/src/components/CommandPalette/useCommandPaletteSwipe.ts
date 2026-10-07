import { useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { openCommandPalette } from "./commandPaletteEvents";
import {
  getCommandPaletteSwipeProgress,
  type SwipePoint,
} from "./commandPaletteSwipe";

const MAX_START_HEIGHT = 160;
const TITLE_PADDING = 16;
const CONTROL_SELECTOR =
  'button, a, input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="combobox"], [data-focusable-key], [data-focus-placeholder], [aria-haspopup]';
const EDITOR_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function isSwipeStartRegion(target: Element, point: SwipePoint): boolean {
  if (point.y > MAX_START_HEIGHT || target.closest(CONTROL_SELECTOR)) {
    return false;
  }

  const region = target.closest("[data-command-palette-swipe-region], header");
  if (region) {
    const bounds = region.getBoundingClientRect();
    return bounds.top >= 0 && bounds.top <= MAX_START_HEIGHT;
  }

  return [...document.querySelectorAll("h1")].some((heading) => {
    const bounds = heading.getBoundingClientRect();
    const rowBounds = heading.parentElement?.getBoundingClientRect() ?? bounds;
    return (
      bounds.top >= 0 &&
      bounds.top <= MAX_START_HEIGHT &&
      point.y >= bounds.top - TITLE_PADDING &&
      point.y <= bounds.bottom + TITLE_PADDING &&
      point.x >= rowBounds.left &&
      point.x <= rowBounds.right &&
      heading.parentElement?.contains(target)
    );
  });
}

function touchPoint(touch: Touch, event: TouchEvent): SwipePoint {
  return { x: touch.clientX, y: touch.clientY, time: event.timeStamp };
}

export function useCommandPaletteSwipe({
  disabled,
  pathname,
}: {
  disabled: boolean;
  pathname: string;
}): void {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile || disabled) return;

    let gesture: { identifier: number; start: SwipePoint } | null = null;
    const cancel = () => {
      gesture = null;
    };
    const start = (event: TouchEvent) => {
      cancel();
      const touch = event.touches[0];
      const target = event.target;
      if (
        event.touches.length !== 1 ||
        !touch ||
        !(target instanceof Element) ||
        document.querySelector(
          '[role="dialog"], [role="alertdialog"], [role="menu"]',
        ) ||
        document.activeElement?.matches(EDITOR_SELECTOR)
      ) {
        return;
      }

      const point = touchPoint(touch, event);
      if (isSwipeStartRegion(target, point)) {
        gesture = { identifier: touch.identifier, start: point };
      }
    };
    const move = (event: TouchEvent) => {
      if (!gesture) return;
      const touch = event.touches[0];
      if (
        event.touches.length !== 1 ||
        !touch ||
        touch.identifier !== gesture.identifier ||
        getCommandPaletteSwipeProgress(
          gesture.start,
          touchPoint(touch, event),
        ) === "cancelled"
      ) {
        cancel();
        return;
      }

      // Reserve title movement before native overscroll can cancel the gesture.
      if (event.cancelable) event.preventDefault();
    };
    const end = (event: TouchEvent) => {
      const completed = gesture;
      cancel();
      if (!completed || event.touches.length !== 0) return;
      const touch = [...event.changedTouches].find(
        (touch) => touch.identifier === completed.identifier,
      );
      if (
        touch &&
        getCommandPaletteSwipeProgress(
          completed.start,
          touchPoint(touch, event),
        ) === "ready"
      ) {
        openCommandPalette();
      }
    };

    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", cancel, { passive: true });
    window.addEventListener("blur", cancel);
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, [disabled, isMobile, pathname]);
}
