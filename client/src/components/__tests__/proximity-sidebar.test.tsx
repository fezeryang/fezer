/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// useReducedMotion snapshots a module-level global that survives
// vi.resetModules (framer-motion is externalised), so stub the hook
// explicitly instead of relying on matchMedia mocking.
vi.mock("framer-motion", async importOriginal => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

const stubRect = (el: HTMLElement, top: number, bottom: number) => {
  el.getBoundingClientRect = () =>
    ({
      top,
      bottom,
      left: 0,
      right: 0,
      width: 0,
      height: bottom - top,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
};

const stubOffsetTop = (el: HTMLElement, offsetTop: number) => {
  Object.defineProperty(el, "offsetTop", {
    configurable: true,
    value: offsetTop,
  });
};

const mountSectionElement = (
  id: string,
  top: number,
  bottom: number,
  offsetTop: number
) => {
  const el = document.createElement("div");
  el.id = id;
  stubRect(el, top, bottom);
  stubOffsetTop(el, offsetTop);
  document.body.appendChild(el);
  return el;
};

describe("ProximitySidebar", () => {
  let scrollToSpy: ReturnType<typeof vi.spyOn>;
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 768,
    });

    const framer = await import("framer-motion");
    vi.mocked(framer.useReducedMotion).mockReturnValue(false);

    scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    replaceStateSpy = vi
      .spyOn(window.history, "replaceState")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders nothing without sections", async () => {
    const { default: ProximitySidebar } = await import(
      "../ui/proximity-sidebar"
    );
    const { container } = render(<ProximitySidebar sections={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one dash button per section with labels", async () => {
    const { default: ProximitySidebar } = await import(
      "../ui/proximity-sidebar"
    );
    mountSectionElement("alpha", 100, 150, 100);
    mountSectionElement("beta", 200, 250, 200);

    render(
      <ProximitySidebar
        sections={[
          { id: "alpha", label: "Alpha", level: 2 },
          { id: "beta", label: "Beta", level: 3 },
        ]}
        side="right"
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute("aria-label")).toBe("Go to Alpha");
    expect(buttons[1].getAttribute("aria-label")).toBe("Go to Beta");
  });

  it("scrolls to the section layout offset minus scrollOffset on click", async () => {
    const { default: ProximitySidebar } = await import(
      "../ui/proximity-sidebar"
    );
    mountSectionElement("alpha", 100, 150, 500);

    render(
      <ProximitySidebar
        sections={[{ id: "alpha", label: "Alpha", level: 2 }]}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 404, // 500 layout offset − 96 default scrollOffset
      behavior: "smooth",
    });
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "#alpha");
  });

  it("jumps instantly when reduced motion is preferred", async () => {
    const framer = await import("framer-motion");
    vi.mocked(framer.useReducedMotion).mockReturnValue(true);

    const { default: ProximitySidebar } = await import(
      "../ui/proximity-sidebar"
    );
    mountSectionElement("alpha", 100, 150, 500);

    render(
      <ProximitySidebar
        sections={[{ id: "alpha", label: "Alpha", level: 2 }]}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 404, behavior: "auto" });
  });

  it("marks the section nearest the anchor line as current on scroll", async () => {
    const { default: ProximitySidebar } = await import(
      "../ui/proximity-sidebar"
    );
    // anchor at 0.4 * 768 = 307.2: "above" is far away, "current" wraps it
    mountSectionElement("above", 100, 150, 100);
    mountSectionElement("current", 300, 350, 300);

    render(
      <ProximitySidebar
        sections={[
          { id: "above", label: "Above", level: 2 },
          { id: "current", label: "Current", level: 2 },
        ]}
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0].getAttribute("aria-current")).toBeNull();
    expect(buttons[1].getAttribute("aria-current")).toBe("location");

    // scrolling keeps the same result (measure runs synchronously on scroll)
    fireEvent.scroll(window);
    expect(buttons[1].getAttribute("aria-current")).toBe("location");
  });
});
