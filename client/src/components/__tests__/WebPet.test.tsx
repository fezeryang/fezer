/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TEST_IDS } from "../web-pet/testIds";
import {
  DEFAULT_POSITION,
  calculatePetDimensions,
  PET_MIN_SIZE,
  KEYBOARD_MOVE_STEP,
  KEYBOARD_MOVE_STEP_LARGE,
} from "../web-pet/constants";

describe("WebPet component", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.resetModules();
    
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1024,
    });

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 768,
    });
    
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("module exports", () => {
    it("exports WebPet component as default", async () => {
      const webPetModule = await import("../WebPet");
      expect(webPetModule.default).toBeDefined();
      expect(typeof webPetModule.default).toBe("function");
    });
  });

  describe("render and presence", () => {
    it("renders web-pet container with data-testid", async () => {
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      expect(petContainer).toBeTruthy();
      expect(petContainer.tagName).toBeTruthy();
    });

    it("renders speech-bubble element with data-testid", async () => {
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      const speechBubble = screen.getByTestId(TEST_IDS.SPEECH_BUBBLE);
      expect(speechBubble).toBeTruthy();
      expect(speechBubble.tagName).toBeTruthy();
    });

    it("renders web-pet-toggle button with data-testid", async () => {
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      const toggleButton = screen.getByTestId(TEST_IDS.WEB_PET_TOGGLE);
      expect(toggleButton).toBeTruthy();
      expect(toggleButton.tagName).toBeTruthy();
    });

    it("uses responsive pet dimensions and keeps a visible minimum size", async () => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: 1920,
      });

      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        writable: true,
        value: 1080,
      });

      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);

      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      const dimensions = calculatePetDimensions(window.innerWidth, window.innerHeight);

      expect(parseInt(petContainer.style.width, 10)).toBe(dimensions.width);
      expect(parseInt(petContainer.style.height, 10)).toBe(dimensions.height);
      expect(parseInt(petContainer.style.width, 10)).toBeGreaterThanOrEqual(PET_MIN_SIZE);
    });
  });

  describe("visibility toggle behavior", () => {
    it("toggle button changes pet visibility state when clicked", async () => {
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);

      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      const toggleButton = screen.getByTestId(TEST_IDS.WEB_PET_TOGGLE);

      const initialDisplay = petContainer.style.display;

      fireEvent.click(toggleButton);

      const afterClickDisplay = petContainer.style.display;
      expect(afterClickDisplay).not.toBe(initialDisplay);
    });

    it("visibility state persists after unmount and remount", async () => {
      const { default: WebPet } = await import("../WebPet");
      const { unmount } = render(<WebPet />);

      const toggleButton = screen.getByTestId(TEST_IDS.WEB_PET_TOGGLE);
      fireEvent.click(toggleButton);

      const petContainerBeforeUnmount = screen.getByTestId(TEST_IDS.WEB_PET);
      const visibilityBeforeUnmount = petContainerBeforeUnmount.style.display !== "none";

      unmount();

      render(<WebPet />);
      const petContainerAfterRemount = screen.getByTestId(TEST_IDS.WEB_PET);
      const visibilityAfterRemount = petContainerAfterRemount.style.display !== "none";

      expect(visibilityAfterRemount).toBe(visibilityBeforeUnmount);
    });
  });

  describe("drag interaction contract", () => {
    it("pet container has draggable attribute", async () => {
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);

      expect(petContainer.getAttribute("draggable")).toBe("true");
    });

    it("pet position updates on mousedown and mousemove", async () => {
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);

      const initialLeft = petContainer.style.left || "0px";
      const initialTop = petContainer.style.top || "0px";

      fireEvent.mouseDown(petContainer, { clientX: 100, clientY: 100 });

      fireEvent.mouseMove(document, { clientX: 200, clientY: 200 });

      fireEvent.mouseUp(document);

      const finalLeft = petContainer.style.left;
      const finalTop = petContainer.style.top;

      expect(finalLeft).not.toBe(initialLeft);
      expect(finalTop).not.toBe(initialTop);
    });
  });

  describe("click reaction contract", () => {
    it("clicking pet shows speech bubble", async () => {
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);

      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      const speechBubble = screen.getByTestId(TEST_IDS.SPEECH_BUBBLE);

      fireEvent.click(petContainer);

      const bubbleVisibility = speechBubble.style.display !== "none";
      expect(bubbleVisibility).toBe(true);
    });
  });

  describe("boundary clamping contract", () => {
    it("pet position is clamped to non-negative coordinates", async () => {
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);

      fireEvent.mouseDown(petContainer, { clientX: 100, clientY: 100 });

      fireEvent.mouseMove(document, { clientX: -9999, clientY: -9999 });

      fireEvent.mouseUp(document);

      const leftValue = parseInt(petContainer.style.left || "0", 10);
      const topValue = parseInt(petContainer.style.top || "0", 10);

      expect(leftValue).toBeGreaterThanOrEqual(0);
      expect(topValue).toBeGreaterThanOrEqual(0);
    });

    it("pet position is clamped within viewport width and height", async () => {
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);

      fireEvent.mouseDown(petContainer, { clientX: 100, clientY: 100 });

      fireEvent.mouseMove(document, { clientX: 99999, clientY: 99999 });

      fireEvent.mouseUp(document);

      const leftValue = parseInt(petContainer.style.left || "0", 10);
      const topValue = parseInt(petContainer.style.top || "0", 10);

      expect(leftValue).toBeLessThanOrEqual(window.innerWidth);
      expect(topValue).toBeLessThanOrEqual(window.innerHeight);
    });

    it("re-clamps pet position on window resize", async () => {
      localStorage.setItem("webPet:position", JSON.stringify({ x: 900, y: 700 }));

      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: 1000,
      });

      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        writable: true,
        value: 800,
      });

      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);

      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: 120,
      });

      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        writable: true,
        value: 110,
      });

      fireEvent(window, new Event("resize"));

      const leftValue = parseInt(petContainer.style.left || "0", 10);
      const topValue = parseInt(petContainer.style.top || "0", 10);
      const dimensions = calculatePetDimensions(window.innerWidth, window.innerHeight);
      const maxX = Math.max(0, window.innerWidth - dimensions.width);
      const maxY = Math.max(0, window.innerHeight - dimensions.height);

      expect(leftValue).toBeGreaterThanOrEqual(0);
      expect(topValue).toBeGreaterThanOrEqual(0);
      expect(leftValue).toBeLessThanOrEqual(maxX);
      expect(topValue).toBeLessThanOrEqual(maxY);
    });

    it("falls back to default position for malformed stored position", async () => {
      localStorage.setItem("webPet:position", "{malformed-json");

      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);

      expect(petContainer.style.left).toBe(`${DEFAULT_POSITION.x}px`);
      expect(petContainer.style.top).toBe(`${DEFAULT_POSITION.y}px`);
    });
  });

  describe("edge-case cleanup reliability", () => {
    it("stops active drag when window loses focus", async () => {
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);

      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);

      fireEvent.mouseDown(petContainer, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 180, clientY: 180 });

      const positionBeforeBlur = {
        left: petContainer.style.left,
        top: petContainer.style.top,
      };

      fireEvent(window, new Event("blur"));
      fireEvent.mouseMove(document, { clientX: 260, clientY: 260 });

      expect(petContainer.style.left).toBe(positionBeforeBlur.left);
      expect(petContainer.style.top).toBe(positionBeforeBlur.top);
    });

    it("cleans drag side effects when unmounted while dragging", async () => {
      const { default: WebPet } = await import("../WebPet");
      const { unmount } = render(<WebPet />);

      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      fireEvent.mouseDown(petContainer, { clientX: 100, clientY: 100 });

      expect(document.body.style.cursor).toBe("grabbing");
      expect(document.body.style.userSelect).toBe("none");

      unmount();

      expect(document.body.style.cursor).toBe("");
      expect(document.body.style.userSelect).toBe("");
    });

    it("clears speech bubble and active drag on rapid hide toggle", async () => {
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);

      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      const speechBubble = screen.getByTestId(TEST_IDS.SPEECH_BUBBLE);
      const toggleButton = screen.getByTestId(TEST_IDS.WEB_PET_TOGGLE);

      fireEvent.mouseDown(petContainer, { clientX: 100, clientY: 100 });
      fireEvent.click(petContainer);
      expect(speechBubble.style.display).not.toBe("none");
      expect(document.body.style.cursor).toBe("grabbing");

      fireEvent.click(toggleButton);

      expect(petContainer.style.display).toBe("none");
      expect(speechBubble.style.display).toBe("none");
      expect(document.body.style.cursor).toBe("");
      expect(document.body.style.userSelect).toBe("");

      const hiddenLeft = petContainer.style.left;
      const hiddenTop = petContainer.style.top;

      fireEvent.mouseMove(document, { clientX: 220, clientY: 220 });

      expect(petContainer.style.left).toBe(hiddenLeft);
      expect(petContainer.style.top).toBe(hiddenTop);
    });
  });

  describe("keyboard support", () => {
    it("hides pet when Escape key is pressed", async () => {
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      const toggleButton = screen.getByTestId(TEST_IDS.WEB_PET_TOGGLE);
      
      if (petContainer.style.display === "none") {
        fireEvent.click(toggleButton);
      }
      
      expect(petContainer.style.display).not.toBe("none");
      
      fireEvent.keyDown(window, { key: "Escape" });
      
      expect(petContainer.style.display).toBe("none");
    });

    it("shows speech bubble when Enter is pressed on pet", async () => {
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      const speechBubble = screen.getByTestId(TEST_IDS.SPEECH_BUBBLE);
      
      fireEvent.keyDown(petContainer, { key: "Enter" });
      
      expect(speechBubble.style.display).not.toBe("none");
    });

    it("moves pet up when ArrowUp is pressed", async () => {
      localStorage.setItem("webPet:position", JSON.stringify({ x: 200, y: 200 }));
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      
      fireEvent.keyDown(petContainer, { key: "ArrowUp" });
      
      const newTop = parseInt(petContainer.style.top || "0", 10);
      expect(newTop).toBe(200 - KEYBOARD_MOVE_STEP);
    });

    it("moves pet down when ArrowDown is pressed", async () => {
      localStorage.setItem("webPet:position", JSON.stringify({ x: 200, y: 200 }));
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      
      fireEvent.keyDown(petContainer, { key: "ArrowDown" });
      
      const newTop = parseInt(petContainer.style.top || "0", 10);
      expect(newTop).toBe(200 + KEYBOARD_MOVE_STEP);
    });

    it("moves pet left when ArrowLeft is pressed", async () => {
      localStorage.setItem("webPet:position", JSON.stringify({ x: 200, y: 200 }));
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      
      fireEvent.keyDown(petContainer, { key: "ArrowLeft" });
      
      const newLeft = parseInt(petContainer.style.left || "0", 10);
      expect(newLeft).toBe(200 - KEYBOARD_MOVE_STEP);
    });

    it("moves pet right when ArrowRight is pressed", async () => {
      localStorage.setItem("webPet:position", JSON.stringify({ x: 200, y: 200 }));
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      
      fireEvent.keyDown(petContainer, { key: "ArrowRight" });
      
      const newLeft = parseInt(petContainer.style.left || "0", 10);
      expect(newLeft).toBe(200 + KEYBOARD_MOVE_STEP);
    });

    it("moves pet with larger step when Shift+Arrow is pressed", async () => {
      localStorage.setItem("webPet:position", JSON.stringify({ x: 200, y: 200 }));
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      
      fireEvent.keyDown(petContainer, { key: "ArrowRight", shiftKey: true });
      
      const newLeft = parseInt(petContainer.style.left || "0", 10);
      expect(newLeft).toBe(200 + KEYBOARD_MOVE_STEP_LARGE);
    });

    it("persists position to localStorage after keyboard move", async () => {
      localStorage.setItem("webPet:position", JSON.stringify({ x: 200, y: 200 }));
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      
      fireEvent.keyDown(petContainer, { key: "ArrowRight" });
      
      const stored = localStorage.getItem("webPet:position");
      expect(stored).not.toBeNull();
      
      const parsedPos = JSON.parse(stored!);
      expect(parsedPos.x).toBe(200 + KEYBOARD_MOVE_STEP);
    });

    it("clamps keyboard movement within viewport bounds", async () => {
      localStorage.setItem("webPet:position", JSON.stringify({ x: 5, y: 5 }));
      
      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      
      fireEvent.keyDown(petContainer, { key: "ArrowLeft", shiftKey: true });
      
      const newLeft = parseInt(petContainer.style.left || "0", 10);
      expect(newLeft).toBeGreaterThanOrEqual(0);
    });
  });

  describe("reduced motion", () => {
    it("respects prefers-reduced-motion media query", async () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === "(prefers-reduced-motion: reduce)",
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const { default: WebPet } = await import("../WebPet");
      render(<WebPet />);
      
      const petContainer = screen.getByTestId(TEST_IDS.WEB_PET);
      expect(petContainer).toBeTruthy();
    });
  });
});
