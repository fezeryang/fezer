import type { Position } from "./types";
import { DEFAULT_POSITION, DEFAULT_VISIBILITY } from "./constants";

export const STORAGE_KEYS = {
  VISIBILITY: "webPet:visible",
  POSITION: "webPet:position",
} as const;

export function getStoredVisibility(): boolean {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEYS.VISIBILITY);
  } catch {
    return DEFAULT_VISIBILITY;
  }

  if (stored === null) {
    return DEFAULT_VISIBILITY;
  }

  if (stored === "true") {
    return true;
  }

  if (stored === "false") {
    return false;
  }

  return DEFAULT_VISIBILITY;
}

export function setStoredVisibility(visible: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.VISIBILITY, String(visible));
  } catch {}
}

export function getStoredPosition(): Position {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEYS.POSITION);
  } catch {
    return DEFAULT_POSITION;
  }

  if (stored === null) {
    return DEFAULT_POSITION;
  }
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "x" in parsed &&
      "y" in parsed &&
      typeof parsed.x === "number" &&
      typeof parsed.y === "number"
    ) {
      return { x: parsed.x, y: parsed.y };
    }
    return DEFAULT_POSITION;
  } catch {
    return DEFAULT_POSITION;
  }
}

export function setStoredPosition(position: Position): void {
  try {
    localStorage.setItem(STORAGE_KEYS.POSITION, JSON.stringify(position));
  } catch {}
}
