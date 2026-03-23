import type { PetDimensions, Position, SpeechBubbleMessage } from "./types";

export const DEFAULT_POSITION: Position = {
  x: 100,
  y: 100,
};

export const DEFAULT_VISIBILITY = true;

export const VIEWPORT_PADDING = 16;

export const MIN_X = 0;
export const MIN_Y = 0;

export const PET_SIZE_MULTIPLIER = 2;
export const PET_MIN_SIZE = 96 * PET_SIZE_MULTIPLIER;
export const PET_MAX_SIZE = 156 * PET_SIZE_MULTIPLIER;
export const PET_VIEWPORT_RATIO = 0.12 * PET_SIZE_MULTIPLIER;

export const DEFAULT_VIEWPORT_WIDTH = 1024;
export const DEFAULT_VIEWPORT_HEIGHT = 768;

export function calculatePetDimensions(
  viewportWidth: number,
  viewportHeight: number
): PetDimensions {
  const safeWidth = Number.isFinite(viewportWidth) && viewportWidth > 0
    ? viewportWidth
    : DEFAULT_VIEWPORT_WIDTH;
  const safeHeight = Number.isFinite(viewportHeight) && viewportHeight > 0
    ? viewportHeight
    : DEFAULT_VIEWPORT_HEIGHT;

  const adaptiveSize = Math.round(Math.min(safeWidth, safeHeight) * PET_VIEWPORT_RATIO);
  const size = Math.min(PET_MAX_SIZE, Math.max(PET_MIN_SIZE, adaptiveSize));

  return {
    width: size,
    height: size,
  };
}

export const SPEECH_BUBBLE_MESSAGES: readonly string[] = [
  "Hi there! 👋",
  "I'm your web pet! 🐱",
  "Click me again! 😺",
  "Let's be friends! 💕",
  "Meow! 🎵",
];

export const SPEECH_BUBBLE_DISPLAY_DURATION_MS = 3000;

export const RANDOM_ACTION_INTERVAL_MIN_MS = 5000;
export const RANDOM_ACTION_INTERVAL_MAX_MS = 15000;

// Keyboard repositioning - non-drag alternative for accessibility
export const KEYBOARD_MOVE_STEP = 20;
export const KEYBOARD_MOVE_STEP_LARGE = 80;

export const SPEECH_BUBBLE_INITIAL_MESSAGE: SpeechBubbleMessage = {
  id: "",
  text: "",
  timestamp: 0,
};
