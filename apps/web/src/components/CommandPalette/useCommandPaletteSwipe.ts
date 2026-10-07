import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { openCommandPalette } from "./commandPaletteEvents";
import {
  COMMAND_PALETTE_OPEN_DISTANCE,
  getCommandPaletteSwipeProgress,
  type SwipePoint,
} from "./commandPaletteSwipe";

const MAX_START_HEIGHT = 160;
const TITLE_PADDING = 16;
const CONTROL_SELECTOR = 'button, a, [role="button"], [aria-haspopup]';
const EDITOR_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function isSwipeStartRegion(target: Element, point: SwipePoint): boolean {
  if (point.y > MAX_START_HEIGHT || target.closest(EDITOR_SELECTOR))
    return false;
  const region = target.closest("[data-command-palette-swipe-region], header");
  if (region) {
    const bounds = region.getBoundingClientRect();
    return bounds.top >= 0 && bounds.top <= MAX_START_HEIGHT;
  }
  return [...document.querySelectorAll("h1")].some((heading) => {
    const bounds = heading.getBoundingClientRect();
    const row = heading.parentElement;
    const rowBounds = row?.getBoundingClientRect() ?? bounds;
    return (
      bounds.top >= 0 &&
      bounds.top <= MAX_START_HEIGHT &&
      point.y >= bounds.top - TITLE_PADDING &&
      point.y <= bounds.bottom + TITLE_PADDING &&
      point.x >= rowBounds.left &&
      point.x <= rowBounds.right &&
      row?.contains(target)
    );
  });
}

function touchPoint(touch: Touch): SwipePoint {
  return { x: touch.clientX, y: touch.clientY };
}

export function useCommandPaletteSwipe({
  disabled,
  pathname,
}: {
  disabled: boolean;
  pathname: string;
}) {
  const isMobile = useIsMobile();
  const reducedMotion = useReducedMotion();
  const distance = useMotionValue(0);
  const [phase, setPhase] = useState<"idle" | "dragging" | "closing">("idle");

  useEffect(() => {
    if (!isMobile || disabled) return;
    let gesture: {
      identifier: number;
      start: SwipePoint;
      pulling: boolean;
      control: boolean;
    } | null = null;
    let closingAnimation: ReturnType<typeof animate> | undefined;
    let suppressClick = false;
    let clickReset: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
      const wasPulling = gesture?.pulling;
      gesture = null;
      if (wasPulling) {
        setPhase("closing");
        closingAnimation = animate(distance, 0, {
          duration: reducedMotion ? 0 : 0.18,
          onComplete: () => setPhase("idle"),
        });
      }
    };
    const start = (event: TouchEvent) => {
      cancel();
      if (event.touches.length === 1) {
        suppressClick = false;
        clearTimeout(clickReset);
      }
      const touch = event.touches[0];
      const target = event.target;
      if (
        event.touches.length !== 1 ||
        !touch ||
        !(target instanceof Element) ||
        document.querySelector(
          '[role="dialog"]:not([aria-hidden="true"]), [role="alertdialog"], [role="menu"]',
        ) ||
        document.activeElement?.matches(EDITOR_SELECTOR)
      )
        return;
      const point = touchPoint(touch);
      if (isSwipeStartRegion(target, point)) {
        closingAnimation?.stop();
        distance.set(0);
        setPhase("idle");
        gesture = {
          identifier: touch.identifier,
          start: point,
          pulling: false,
          control: !!target.closest(CONTROL_SELECTOR),
        };
      }
    };
    const move = (event: TouchEvent) => {
      if (!gesture) return;
      const touch = event.touches[0];
      if (
        event.touches.length !== 1 ||
        !touch ||
        touch.identifier !== gesture.identifier
      ) {
        cancel();
        return;
      }
      const pull = getCommandPaletteSwipeProgress({
        start: gesture.start,
        current: touchPoint(touch),
        pulling: gesture.pulling,
      });
      if (pull.phase === "cancelled") {
        cancel();
        return;
      }
      // Reserve title touches before the browser can turn them into overscroll.
      if (event.cancelable && (pull.phase === "dragging" || !gesture.control))
        event.preventDefault();
      if (pull.phase === "dragging") {
        gesture.pulling = true;
        suppressClick = true;
        distance.set(pull.distance);
        setPhase("dragging");
      }
    };
    const end = (event: TouchEvent) => {
      const completed = gesture;
      if (!completed) return;
      if (completed.pulling && event.cancelable) event.preventDefault();
      const touch = [...event.changedTouches].find(
        (touch) => touch.identifier === completed.identifier,
      );
      if (
        completed.pulling &&
        touch &&
        event.touches.length === 0 &&
        Math.max(0, touch.clientY - completed.start.y) >=
          COMMAND_PALETTE_OPEN_DISTANCE
      ) {
        gesture = null;
        // eslint-disable-next-line react-dom/no-flush-sync -- Mobile keyboard focus needs the current touch activation.
        flushSync(() => {
          setPhase("idle");
          openCommandPalette();
        });
      } else {
        cancel();
      }
      clickReset = setTimeout(() => {
        suppressClick = false;
      }, 400);
    };
    const preventSwipeClick = (event: MouseEvent) => {
      if (!suppressClick || event.detail === 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
    };
    document.addEventListener("touchstart", start, {
      passive: true,
      capture: true,
    });
    document.addEventListener("touchmove", move, {
      passive: false,
      capture: true,
    });
    document.addEventListener("touchend", end, {
      passive: false,
      capture: true,
    });
    document.addEventListener("touchcancel", cancel, {
      passive: true,
      capture: true,
    });
    document.addEventListener("click", preventSwipeClick, true);
    window.addEventListener("blur", cancel);
    return () => {
      closingAnimation?.stop();
      gesture = null;
      clearTimeout(clickReset);
      setPhase("idle");
      document.removeEventListener("touchstart", start, true);
      document.removeEventListener("touchmove", move, true);
      document.removeEventListener("touchend", end, true);
      document.removeEventListener("touchcancel", cancel, true);
      document.removeEventListener("click", preventSwipeClick, true);
      window.removeEventListener("blur", cancel);
    };
  }, [disabled, distance, isMobile, pathname, reducedMotion]);

  return { phase, distance, isMobile };
}
