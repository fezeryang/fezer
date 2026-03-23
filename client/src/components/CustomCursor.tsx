import { useEffect } from "react";

export default function CustomCursor() {
  useEffect(() => {
    const root = document.documentElement;

    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const hoverQuery = window.matchMedia("(any-hover: hover)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateCursorMode = () => {
      const shouldEnableCursor =
        hoverQuery.matches &&
        !coarsePointerQuery.matches &&
        !reducedMotionQuery.matches;

      root.classList.toggle("rue-cursor-enabled", shouldEnableCursor);
    };

    updateCursorMode();

    const addListener = (query: MediaQueryList) => {
      if (query.addEventListener) {
        query.addEventListener("change", updateCursorMode);
        return;
      }

      query.addListener(updateCursorMode);
    };

    const removeListener = (query: MediaQueryList) => {
      if (query.removeEventListener) {
        query.removeEventListener("change", updateCursorMode);
        return;
      }

      query.removeListener(updateCursorMode);
    };

    addListener(coarsePointerQuery);
    addListener(hoverQuery);
    addListener(reducedMotionQuery);

    return () => {
      removeListener(coarsePointerQuery);
      removeListener(hoverQuery);
      removeListener(reducedMotionQuery);
      root.classList.remove("rue-cursor-enabled");
    };
  }, []);

  return null;
}
