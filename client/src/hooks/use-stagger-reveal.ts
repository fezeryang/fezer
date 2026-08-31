import { useEffect, useState } from "react";

/**
 * Plays the transitions-dev texts-reveal entrance (.is-shown on a
 * .t-stagger container) after mount. Entrance-only: the recipe's
 * .is-hiding exit path is not needed here. The double rAF guarantees
 * the initial translated/blurred state has painted before the reveal
 * class flips it, so the transition always plays.
 */
export function useStaggerReveal(): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let outer = 0;
    let inner = 0;

    outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => setShown(true));
    });

    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, []);

  return shown;
}
