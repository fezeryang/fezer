/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

describe("useWebPet hook", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("module exports", () => {
    it("exports useWebPet function", async () => {
      const hookModule = await import("../useWebPet");
      expect(hookModule).toHaveProperty("useWebPet");
      expect(typeof hookModule.useWebPet).toBe("function");
    });
  });

  describe("return value contract", () => {
    it("returns object with isVisible boolean property", async () => {
      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());
      
      expect(result.current).toHaveProperty("isVisible");
      expect(typeof result.current.isVisible).toBe("boolean");
    });

    it("returns object with toggleVisibility function property", async () => {
      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());
      
      expect(result.current).toHaveProperty("toggleVisibility");
      expect(typeof result.current.toggleVisibility).toBe("function");
    });

    it("returns exactly two properties", async () => {
      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());
      
      const keys = Object.keys(result.current);
      expect(keys.length).toBe(2);
      expect(keys).toContain("isVisible");
      expect(keys).toContain("toggleVisibility");
    });
  });

  describe("initial state", () => {
    it("isVisible defaults to true when no localStorage", async () => {
      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());
      
      expect(result.current.isVisible).toBe(true);
    });

    it("isVisible reads true from localStorage", async () => {
      localStorage.setItem("webPet:visible", "true");
      
      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());
      
      expect(result.current.isVisible).toBe(true);
    });

    it("isVisible reads false from localStorage", async () => {
      localStorage.setItem("webPet:visible", "false");
      
      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());
      
      expect(result.current.isVisible).toBe(false);
    });

    it("falls back to default visibility for malformed stored value", async () => {
      localStorage.setItem("webPet:visible", "not-a-boolean");

      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());

      expect(result.current.isVisible).toBe(true);
    });

    it("falls back to default visibility when storage read throws", async () => {
      const getItemSpy = vi
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation(() => {
          throw new Error("Storage unavailable");
        });

      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());

      expect(result.current.isVisible).toBe(true);
      getItemSpy.mockRestore();
    });
  });

  describe("toggleVisibility behavior", () => {
    it("toggleVisibility switches from true to false", async () => {
      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());
      
      expect(result.current.isVisible).toBe(true);
      
      act(() => {
        result.current.toggleVisibility();
      });
      
      expect(result.current.isVisible).toBe(false);
    });

    it("toggleVisibility switches from false to true", async () => {
      localStorage.setItem("webPet:visible", "false");
      
      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());
      
      expect(result.current.isVisible).toBe(false);
      
      act(() => {
        result.current.toggleVisibility();
      });
      
      expect(result.current.isVisible).toBe(true);
    });
  });

  describe("localStorage persistence", () => {
    it("persists false to localStorage after toggle from true", async () => {
      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());
      
      act(() => {
        result.current.toggleVisibility();
      });
      
      expect(localStorage.getItem("webPet:visible")).toBe("false");
    });

    it("persists true to localStorage after toggle from false", async () => {
      localStorage.setItem("webPet:visible", "false");
      
      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());
      
      act(() => {
        result.current.toggleVisibility();
      });
      
      expect(localStorage.getItem("webPet:visible")).toBe("true");
    });

    it("uses exact localStorage key 'webPet:visible'", async () => {
      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());
      
      act(() => {
        result.current.toggleVisibility();
      });
      
      expect(localStorage.getItem("webPet:visible")).toBeDefined();
      expect(localStorage.getItem("web-pet:visible")).toBeNull();
    });

    it("keeps toggle functional when storage write throws", async () => {
      const setItemSpy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new Error("Write failed");
        });

      const { useWebPet } = await import("../useWebPet");
      const { result } = renderHook(() => useWebPet());

      act(() => {
        result.current.toggleVisibility();
      });

      expect(result.current.isVisible).toBe(false);
      setItemSpy.mockRestore();
    });
  });
});
