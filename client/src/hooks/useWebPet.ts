import { useState, useCallback } from "react";
import type { WebPetHookReturn } from "../components/web-pet/types";
import {
  getStoredVisibility,
  setStoredVisibility,
} from "../components/web-pet/storage";

export function useWebPet(): WebPetHookReturn {
  // Lazy initializer prevents repeated storage reads on re-renders
  const [isVisible, setIsVisible] = useState<boolean>(() => getStoredVisibility());

  const toggleVisibility = useCallback(() => {
    setIsVisible((prev) => {
      const next = !prev;
      setStoredVisibility(next);
      return next;
    });
  }, []);

  return {
    isVisible,
    toggleVisibility,
  };
}
