import React, { useState, useRef, useEffect, useCallback } from "react";
import Lottie from "lottie-react";
import catAnimation from "../../../thecat/cat.json";
import { useWebPet } from "../hooks/useWebPet";
import { TEST_IDS } from "./web-pet/testIds";
import {
  MIN_X,
  MIN_Y,
  VIEWPORT_PADDING,
  calculatePetDimensions,
  SPEECH_BUBBLE_MESSAGES,
  SPEECH_BUBBLE_DISPLAY_DURATION_MS,
  RANDOM_ACTION_INTERVAL_MIN_MS,
  RANDOM_ACTION_INTERVAL_MAX_MS,
  KEYBOARD_MOVE_STEP,
  KEYBOARD_MOVE_STEP_LARGE,
} from "./web-pet/constants";
import {
  getStoredPosition,
  setStoredPosition,
  STORAGE_KEYS,
} from "./web-pet/storage";
import type { PetDimensions, Position } from "./web-pet/types";

export default function WebPet() {
  const { isVisible, toggleVisibility } = useWebPet();

  const [position, setPosition] = useState<Position>(() => {
    let hasStoredPosition = false;

    try {
      hasStoredPosition = localStorage.getItem(STORAGE_KEYS.POSITION) !== null;
    } catch {}

    if (hasStoredPosition) {
      return getStoredPosition();
    }

    const dimensions = calculatePetDimensions(
      window.innerWidth,
      window.innerHeight
    );

    return {
      x: VIEWPORT_PADDING,
      y: Math.max(
        VIEWPORT_PADDING,
        window.innerHeight - dimensions.height - VIEWPORT_PADDING * 1.5
      ),
    };
  });
  const [petDimensions, setPetDimensions] = useState<PetDimensions>(() =>
    calculatePetDimensions(window.innerWidth, window.innerHeight)
  );

  const [isSpeechBubbleVisible, setIsSpeechBubbleVisible] = useState(false);
  const [speechBubbleText, setSpeechBubbleText] = useState("");
  const speechBubbleTimeoutRef = useRef<number | null>(null);
  const randomActionTimeoutRef = useRef<number | null>(null);
  const messageIndexRef = useRef(0);
  const isMountedRef = useRef(true);
  const isVisibleRef = useRef(isVisible);

  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVisible) {
        toggleVisibility();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, toggleVisibility]);

  const clampPosition = useCallback(
    (pos: Position, dimensions: PetDimensions = petDimensions): Position => {
      const maxX = Math.max(
        MIN_X,
        window.innerWidth - dimensions.width - VIEWPORT_PADDING
      );
      const maxY = Math.max(
        MIN_Y,
        window.innerHeight - dimensions.height - VIEWPORT_PADDING
      );

      return {
        x: Math.max(MIN_X, Math.min(pos.x, maxX)),
        y: Math.max(MIN_Y, Math.min(pos.y, maxY)),
      };
    },
    [petDimensions]
  );

  const endDrag = useCallback(() => {
    setIsDragging(false);
    document.documentElement.classList.remove("rue-cursor-dragging");
    document.body.style.userSelect = "";
  }, []);

  // Show speech bubble with auto-hide timer
  const showSpeechBubble = useCallback((text: string) => {
    setSpeechBubbleText(text);
    setIsSpeechBubbleVisible(true);

    if (speechBubbleTimeoutRef.current !== null) {
      clearTimeout(speechBubbleTimeoutRef.current);
    }

    speechBubbleTimeoutRef.current = window.setTimeout(() => {
      setIsSpeechBubbleVisible(false);
      speechBubbleTimeoutRef.current = null;
    }, SPEECH_BUBBLE_DISPLAY_DURATION_MS);
  }, []);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible && isDragging) {
      endDrag();
    }
  }, [isVisible, isDragging, endDrag]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setPosition(currentPos => {
      const clamped = clampPosition(currentPos);
      if (clamped.x === currentPos.x && clamped.y === currentPos.y) {
        return currentPos;
      }
      setStoredPosition(clamped);
      return clamped;
    });
  }, [clampPosition]);

  useEffect(() => {
    const handleResize = () => {
      const nextDimensions = calculatePetDimensions(
        window.innerWidth,
        window.innerHeight
      );

      setPetDimensions(currentDimensions => {
        if (
          currentDimensions.width === nextDimensions.width &&
          currentDimensions.height === nextDimensions.height
        ) {
          return currentDimensions;
        }

        return nextDimensions;
      });

      setPosition(currentPos => {
        const clamped = clampPosition(currentPos, nextDimensions);
        if (clamped.x === currentPos.x && clamped.y === currentPos.y) {
          return currentPos;
        }
        setStoredPosition(clamped);
        return clamped;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [clampPosition]);

  // Extract pointer coordinates from mouse or touch event
  const getPointerCoords = (
    e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent
  ) => {
    if ("touches" in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return {
      x: (e as MouseEvent | React.MouseEvent).clientX,
      y: (e as MouseEvent | React.MouseEvent).clientY,
    };
  };

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isVisible) {
        return;
      }

      if ("touches" in e && e.touches.length === 0) {
        return;
      }

      setIsDragging(true);
      hasDraggedRef.current = false;

      const { x: clientX, y: clientY } = getPointerCoords(e);

      dragOffsetRef.current = {
        x: clientX - position.x,
        y: clientY - position.y,
      };
    },
    [isVisible, position]
  );

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;

      if ("touches" in e && e.touches.length === 0) {
        return;
      }

      hasDraggedRef.current = true;

      const { x: clientX, y: clientY } = getPointerCoords(e);

      const newPosition: Position = {
        x: clientX - dragOffsetRef.current.x,
        y: clientY - dragOffsetRef.current.y,
      };

      const clampedPosition = clampPosition(newPosition);
      setPosition(clampedPosition);
    };

    const handlePointerUp = () => {
      if (isDragging) {
        endDrag();
        setPosition(currentPos => {
          setStoredPosition(currentPos);
          return currentPos;
        });
      }
    };

    const handlePointerCancel = () => {
      if (isDragging) {
        endDrag();
      }
    };

    if (isDragging) {
      document.addEventListener("mousemove", handlePointerMove);
      document.addEventListener("mouseup", handlePointerUp);
      document.addEventListener("touchmove", handlePointerMove, {
        passive: false,
      });
      document.addEventListener("touchend", handlePointerUp);
      document.addEventListener("touchcancel", handlePointerCancel);
      window.addEventListener("blur", handlePointerCancel);
      document.documentElement.classList.add("rue-cursor-dragging");
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handlePointerMove);
      document.removeEventListener("mouseup", handlePointerUp);
      document.removeEventListener("touchmove", handlePointerMove);
      document.removeEventListener("touchend", handlePointerUp);
      document.removeEventListener("touchcancel", handlePointerCancel);
      window.removeEventListener("blur", handlePointerCancel);
      document.documentElement.classList.remove("rue-cursor-dragging");
      document.body.style.userSelect = "";
    };
  }, [isDragging, clampPosition, endDrag]);

  const scheduleRandomAction = useCallback(() => {
    if (randomActionTimeoutRef.current !== null) {
      clearTimeout(randomActionTimeoutRef.current);
    }

    if (prefersReducedMotion) {
      return;
    }

    const delay =
      Math.random() *
        (RANDOM_ACTION_INTERVAL_MAX_MS - RANDOM_ACTION_INTERVAL_MIN_MS) +
      RANDOM_ACTION_INTERVAL_MIN_MS;

    randomActionTimeoutRef.current = window.setTimeout(() => {
      if (!isMountedRef.current || !isVisibleRef.current) {
        randomActionTimeoutRef.current = null;
        return;
      }

      const randomMessage =
        SPEECH_BUBBLE_MESSAGES[
          Math.floor(Math.random() * SPEECH_BUBBLE_MESSAGES.length)
        ];
      showSpeechBubble(randomMessage);
      scheduleRandomAction();
    }, delay);
  }, [prefersReducedMotion, showSpeechBubble]);

  useEffect(() => {
    if (isVisible && !prefersReducedMotion) {
      scheduleRandomAction();
    } else {
      if (randomActionTimeoutRef.current !== null) {
        clearTimeout(randomActionTimeoutRef.current);
        randomActionTimeoutRef.current = null;
      }
      if (speechBubbleTimeoutRef.current !== null) {
        clearTimeout(speechBubbleTimeoutRef.current);
        speechBubbleTimeoutRef.current = null;
      }
      setIsSpeechBubbleVisible(false);
    }

    return () => {
      if (randomActionTimeoutRef.current !== null) {
        clearTimeout(randomActionTimeoutRef.current);
        randomActionTimeoutRef.current = null;
      }
      if (speechBubbleTimeoutRef.current !== null) {
        clearTimeout(speechBubbleTimeoutRef.current);
        speechBubbleTimeoutRef.current = null;
      }
    };
  }, [isVisible, prefersReducedMotion, scheduleRandomAction]);

  const handleClick = useCallback(() => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }

    const message = SPEECH_BUBBLE_MESSAGES[messageIndexRef.current];
    messageIndexRef.current =
      (messageIndexRef.current + 1) % SPEECH_BUBBLE_MESSAGES.length;

    showSpeechBubble(message);

    if (!prefersReducedMotion) {
      scheduleRandomAction();
    }
  }, [prefersReducedMotion, scheduleRandomAction, showSpeechBubble]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
        return;
      }

      const step = e.shiftKey ? KEYBOARD_MOVE_STEP_LARGE : KEYBOARD_MOVE_STEP;
      let delta: Position | null = null;

      switch (e.key) {
        case "ArrowUp":
          delta = { x: 0, y: -step };
          break;
        case "ArrowDown":
          delta = { x: 0, y: step };
          break;
        case "ArrowLeft":
          delta = { x: -step, y: 0 };
          break;
        case "ArrowRight":
          delta = { x: step, y: 0 };
          break;
      }

      if (delta) {
        e.preventDefault();
        setPosition(currentPos => {
          const newPos = clampPosition({
            x: currentPos.x + delta.x,
            y: currentPos.y + delta.y,
          });
          setStoredPosition(newPos);
          return newPos;
        });
      }
    },
    [handleClick, clampPosition]
  );

  return (
    <>
      <div
        data-testid={TEST_IDS.WEB_PET}
        draggable="true"
        onDragStart={e => e.preventDefault()}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={isVisible ? 0 : -1}
        role="button"
        aria-label="Web Pet"
        style={{
          position: "fixed",
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${petDimensions.width}px`,
          height: `${petDimensions.height}px`,
          userSelect: "none",
          display: isVisible ? "block" : "none",
          zIndex: 9999,
        }}
      >
        <Lottie
          animationData={catAnimation}
          loop={!prefersReducedMotion}
          autoplay={!prefersReducedMotion}
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      </div>

      <div
        data-testid={TEST_IDS.SPEECH_BUBBLE}
        aria-live="polite"
        style={{
          position: "fixed",
          left: `${position.x + petDimensions.width + 10}px`,
          top: `${position.y - 20}px`,
          padding: "8px 12px",
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          display: isSpeechBubbleVisible ? "block" : "none",
          zIndex: 9998,
        }}
      >
        {speechBubbleText}
      </div>

      <button
        data-testid={TEST_IDS.WEB_PET_TOGGLE}
        onClick={toggleVisibility}
        aria-label={isVisible ? "Hide Web Pet" : "Show Web Pet"}
        style={{
          position: "fixed",
          bottom: "16px",
          right: "16px",
          padding: "8px 16px",
          zIndex: 9999,
        }}
      >
        {isVisible ? "Hide Pet" : "Show Pet"}
      </button>
    </>
  );
}
