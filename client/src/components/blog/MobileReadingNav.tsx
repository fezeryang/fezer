import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { List } from "lucide-react";
import { getDocumentTop } from "@/components/ui/proximity-sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import type { TocSection } from "@/content/loaders/markdown";

type MobileReadingNavProps = {
  sections: TocSection[];
};

/** Same 40%-viewport anchor ProximitySidebar's scroll-spy uses. */
const ACTIVE_OFFSET = 0.4;
/** Top clearance when jumping to a section (mobile has no fixed header). */
const SCROLL_OFFSET = 80;

/**
 * Mobile-only reading navigation for blog posts: a 2px top progress bar
 * and a TOC drawer (FAB trigger). Mounts alongside the desktop
 * ProximitySidebar — useIsMobile's 768px edge is the exact complement of
 * the sidebar's `hidden md:flex`, so exactly one of the two exists at any
 * width. Below 768px DampedScrollView is off, so window.scrollY is exact
 * and no settle-loop scroll-spy is needed.
 */
export default function MobileReadingNav({ sections }: MobileReadingNavProps) {
  const isMobile = useIsMobile();
  const shouldReduceMotion = useReducedMotion();

  const barRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(sections[0]?.id);

  // headings only — body dashes (empty id) are minimap density markers
  const tocSections = sections.filter(
    section => section.id && (section.level === 2 || section.level === 3)
  );

  // Progress bar: rAF-coalesced passive scroll, written straight to the
  // node so scrolling never re-renders React. A scroll-driven indicator,
  // not an animation — fine under reduced motion.
  useEffect(() => {
    if (!isMobile) return;

    let rafId = 0;

    const update = () => {
      rafId = 0;
      const max = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const progress = Math.min(1, Math.max(0, window.scrollY / max));

      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${progress})`;
      }
    };

    const schedule = () => {
      if (!rafId) rafId = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isMobile]);

  // Lightweight scroll-spy: nearest-to-anchor math, no settle loop
  // (damping is off on mobile so positions are final on every event).
  useEffect(() => {
    if (!isMobile || !tocSections.length) return;

    const update = () => {
      const anchorY = window.innerHeight * ACTIVE_OFFSET;
      let nextActiveId = tocSections[0]?.id;
      let shortestDistance = Number.POSITIVE_INFINITY;

      for (const section of tocSections) {
        const element = document.getElementById(section.id);
        if (!element) continue;

        const rect = element.getBoundingClientRect();
        const containsAnchor = rect.top <= anchorY && rect.bottom >= anchorY;
        const distance = containsAnchor
          ? 0
          : Math.min(
              Math.abs(rect.top - anchorY),
              Math.abs(rect.bottom - anchorY)
            );

        if (distance < shortestDistance) {
          shortestDistance = distance;
          nextActiveId = section.id;
        }
      }

      setActiveId(nextActiveId);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isMobile, tocSections]);

  // Drawer open state: lock scroll, Esc to close, focus management.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    firstLinkRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      fabRef.current?.focus();
    };
  }, [open]);

  const jumpTo = useCallback(
    (id: string) => {
      const element = document.getElementById(id);
      if (element) {
        window.scrollTo({
          top: Math.max(0, getDocumentTop(element) - SCROLL_OFFSET),
          behavior: shouldReduceMotion ? "auto" : "smooth",
        });
        window.history.replaceState(null, "", `#${id}`);
      }

      setOpen(false);
    },
    [shouldReduceMotion]
  );

  if (!isMobile) return null;

  return (
    <>
      {/* reading progress bar */}
      <div
        className="fixed inset-x-0 top-0 z-40 h-[2px]"
        aria-hidden="true"
      >
        <div
          ref={barRef}
          className="h-full w-full origin-left bg-[#1c1b1a]"
          style={{ transform: "scaleX(0)" }}
        />
      </div>

      {/* drawer trigger */}
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="打开目录"
        aria-expanded={open}
        aria-controls="blog-toc-drawer"
        // bottom-20 (not bottom-5): the WebPet toggle is fixed at the
        // bottom-right corner (bottom/right 16px) and would cover a
        // corner-hugging FAB — sit just above it.
        className="fixed bottom-20 right-5 z-40 flex size-11 items-center justify-center rounded-full bg-[#f7f5f0] text-[#2a2a2a] ring-1 ring-[#1c1b1a]/10"
        style={{ boxShadow: "8px 8px 16px #d1cdc7, -8px -8px 16px #ffffff" }}
      >
        <List className="size-5" aria-hidden="true" />
      </button>

      {/* backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden={!open}
        className={`fixed inset-0 z-50 bg-[#1c1b1a]/25 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* TOC panel */}
      <div
        id="blog-toc-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="目录"
        inert={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-[82%] max-w-[320px] flex-col overflow-y-auto border-l border-[#e1dfda] bg-[#f7f5f0] px-6 pt-24 pb-8 transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <p className="mb-4 text-[11px] font-mono uppercase tracking-[0.25em] text-[#a19d96]">
          目录
        </p>

        <div className="flex flex-col">
          {tocSections.map((section, index) => (
            <button
              key={section.id}
              ref={index === 0 ? firstLinkRef : undefined}
              type="button"
              onClick={() => jumpTo(section.id)}
              aria-current={section.id === activeId ? "location" : undefined}
              className={`block w-full border-b border-[#e1dfda]/60 py-2.5 text-left transition-colors duration-150 ${
                section.level === 3
                  ? "pl-4 text-[13px] text-[#75706b]"
                  : "text-sm text-[#1c1b1a]"
              } ${
                section.id === activeId ? "bg-[#1c1b1a]/[0.04]" : ""
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
