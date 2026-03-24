import { useEffect, useRef, useState, type ReactNode } from "react";

type DampedScrollViewProps = {
  children: ReactNode;
};

export default function DampedScrollView({ children }: DampedScrollViewProps) {
  const scrollboxRef = useRef<HTMLDivElement>(null);
  const [isDampingEnabled, setIsDampingEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleMode = () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setIsDampingEnabled(document.body.clientWidth >= 768 && !reduceMotion);
    };

    handleMode();
    window.addEventListener("resize", handleMode);

    return () => {
      window.removeEventListener("resize", handleMode);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !scrollboxRef.current) {
      return;
    }

    const scrollbox = scrollboxRef.current;
    const previousBodyHeight = document.body.style.height;
    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    const previousBodyScrollBehavior = document.body.style.scrollBehavior;
    let resizeObserver: ResizeObserver | null = null;

    const updateBodyHeight = () => {
      document.body.style.height = `${scrollbox.offsetHeight}px`;
    };

    const syncScroll = () => {
      scrollbox.style.transform = `translateY(${-window.scrollY}px)`;
    };

    const syncOnResize = () => {
      updateBodyHeight();
      syncScroll();
    };

    if (isDampingEnabled) {
      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.scrollBehavior = "auto";
      scrollbox.style.willChange = "transform";
      scrollbox.style.transition = ".3s ease-out";

      updateBodyHeight();
      syncScroll();

      window.addEventListener("scroll", syncScroll, { passive: true });
      window.addEventListener("resize", syncOnResize);

      resizeObserver = new ResizeObserver(updateBodyHeight);
      resizeObserver.observe(scrollbox);
    } else {
      document.documentElement.style.scrollBehavior = "smooth";
      document.body.style.scrollBehavior = "smooth";
      document.body.style.height = "";
      scrollbox.style.transform = "";
      scrollbox.style.transition = "";
      scrollbox.style.willChange = "";
    }

    return () => {
      window.removeEventListener("scroll", syncScroll);
      window.removeEventListener("resize", syncOnResize);
      resizeObserver?.disconnect();

      document.body.style.height = previousBodyHeight;
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
      document.body.style.scrollBehavior = previousBodyScrollBehavior;
      scrollbox.style.transform = "";
      scrollbox.style.transition = "";
      scrollbox.style.willChange = "";
    };
  }, [isDampingEnabled]);

  return (
    <div
      className={
        isDampingEnabled
          ? "viewbox fixed inset-0 z-10 flex h-screen w-full items-start overflow-hidden"
          : "relative z-10 w-full"
      }
    >
      <div
        ref={scrollboxRef}
        className={
          isDampingEnabled
            ? "scrollbox relative flex w-full shrink-0 flex-col items-center"
            : "w-full"
        }
      >
        {children}
      </div>
    </div>
  );
}
