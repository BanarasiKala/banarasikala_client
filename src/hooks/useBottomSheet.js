import { useEffect, useRef, useState } from "react";

/**
 * The three things a bottom sheet always needs: drag-to-dismiss, Escape to close, and the
 * page behind frozen while the sheet is up.
 *
 * Drag matters more than it looks. A grab handle is a promise that the sheet can be pulled
 * down — a handle that doesn't drag is worse than no handle at all, because the customer
 * tries it, nothing happens, and now they distrust the control.
 *
 * `onClose` is read through a ref rather than listed as a dependency: every caller passes
 * an inline arrow (`onClose={() => setOpen(false)}`), which is a new function on every
 * render, so a dependency array would tear down and re-register the key listener — and
 * re-stamp document.body.style.overflow — on each one. The ref keeps the effect mount-only
 * while still calling the current handler.
 *
 * @param {() => void} onClose Called on Escape, or when a drag passes the dismiss threshold.
 * @returns {{sheetRef, grabHandlers, sheetStyle}} Spread `grabHandlers` onto the grab area,
 *          put `sheetRef`/`sheetStyle` on the sheet itself.
 */
export default function useBottomSheet(onClose) {
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef(null);
  const sheetRef = useRef(null);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") closeRef.current?.();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const onDragStart = (event) => {
    dragStart.current = event.touches?.[0]?.clientY ?? event.clientY;
  };

  const onDragMove = (event) => {
    if (dragStart.current == null) return;
    const y = event.touches?.[0]?.clientY ?? event.clientY;
    // Downward only — dragging up must not lift the sheet off the bottom edge.
    setDragY(Math.max(0, y - dragStart.current));
  };

  const onDragEnd = () => {
    if (dragStart.current == null) return;
    dragStart.current = null;
    // Past a quarter of the sheet's height reads as intent to dismiss; anything less
    // springs back, so a stray scroll doesn't close a sheet the customer is reading.
    const threshold = (sheetRef.current?.offsetHeight || 400) * 0.25;
    if (dragY > threshold) closeRef.current?.();
    else setDragY(0);
  };

  return {
    sheetRef,
    grabHandlers: {
      onTouchStart: onDragStart,
      onTouchMove: onDragMove,
      onTouchEnd: onDragEnd,
      onMouseDown: onDragStart,
      onMouseMove: onDragMove,
      onMouseUp: onDragEnd,
      // A mouse drag that leaves the handle would otherwise stay "held" forever.
      onMouseLeave: onDragEnd,
    },
    // Transition is suppressed mid-drag so the sheet tracks the finger instead of easing
    // toward it; on release the style drops away and the CSS transition animates the spring-back.
    sheetStyle: dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined,
  };
}
