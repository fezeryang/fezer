import { Link } from "wouter";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";
import DampedScrollView from "@/components/DampedScrollView";
// Submodule import (not the @/content/loaders barrel): the barrel
// re-exports renderBlogMarkdown, which would pull marked + sanitize-html
// into this page's client graph for nothing.
import { loadPosts } from "@/content/loaders/posts";
import { bindWorkspaceAnimation } from "@/lib/workspace-embed";

declare global {
  interface Window {
    p5: any;
  }
}

type BlogExperienceProps = {
  initialSection?: "cover" | "surface";
};

// Swap scenes only while the opaque fluid completely covers the viewport.
const SCENE_HANDOFF = 0.4;
const MASK_RETREAT_START = 0.44;
const MASK_RETREAT_END = 0.97;

const KINETIC_TYPES = ["perlin", "orbit", "wave", "particles", "grid"] as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const normalized = clamp01((value - edge0) / (edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
};

function formatDate(dateString?: string | Date | null) {
  if (!dateString) return "未知日期";

  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "未知日期";
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${year}.${month}.${day}`;
  } catch {
    return "未知日期";
  }
}

function BlogSurfaceThumbnail({ type }: { type: string }) {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.p5 || !canvasRef.current) {
      return;
    }

    const p5 = window.p5 as any;
    let t = 0;

    const getSize = () => {
      const width = canvasRef.current?.clientWidth ?? 120;
      return Math.max(64, width);
    };

    const sketch = (p: any) => {
      p.setup = () => {
        const size = getSize();
        p.createCanvas(size, size).parent(canvasRef.current);
        p.noFill();
      };

      p.draw = () => {
        const size = p.width;
        p.clear();
        p.strokeWeight(1.5);

        if (type === "perlin") {
          p.stroke(42, 42, 42, 180);
          for (let i = 0; i < 5; i++) {
            p.beginShape();
            for (let x = 0; x < size; x += 5) {
              const y = p.noise(x * 0.01, t + i * 0.1) * size;
              p.vertex(x, y);
            }
            p.endShape();
          }
        } else if (type === "orbit") {
          p.stroke(42, 42, 42, 150);
          p.translate(size / 2, size / 2);
          for (let i = 0; i < 8; i++) {
            p.rotate(t + i);
            p.rect(-size * 0.16, -size * 0.16, size * 0.32, size * 0.32, 4);
          }
        } else if (type === "wave") {
          p.stroke(42, 42, 42, 200);
          for (let i = 0; i < 10; i++) {
            const y = size * 0.16 + i * (size * 0.065);
            p.line(
              size * 0.08,
              y + p.sin(t + i) * (size * 0.08),
              size * 0.92,
              y + p.sin(t + i + 1) * (size * 0.08)
            );
          }
        } else {
          p.stroke(42, 42, 42, 100);
          for (let i = 0; i < 20; i++) {
            p.point(p.random(size), p.random(size));
          }
        }

        t += 0.02;
      };
    };

    const instance = new p5(sketch);
    const disconnectWorkspace = bindWorkspaceAnimation(instance);

    const handleResize = () => {
      const size = getSize();
      instance.resizeCanvas(size, size);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      disconnectWorkspace();
      instance.remove();
    };
  }, [type]);

  return (
    <div
      ref={canvasRef}
      className="h-24 w-24 overflow-hidden rounded-2xl bg-[#ece8e2] shadow-[inset_2px_2px_5px_#d1cdc7] md:h-[120px] md:w-[120px]"
    />
  );
}

export default function BlogExperience({ initialSection = "cover" }: BlogExperienceProps) {
  const [entryVisible, setEntryVisible] = useState<boolean[]>([]);
  const [activeDotIndex, setActiveDotIndex] = useState(0);

  const visualContainerRef = useRef<HTMLDivElement>(null);
  const maskContainerRef = useRef<HTMLDivElement>(null);
  const contentSectionRef = useRef<HTMLElement>(null);
  const surfaceEntryRefs = useRef<Array<HTMLDivElement | null>>([]);
  const progressRef = useRef(0);
  const reducedMotionRef = useRef(false);

  const { posts, loadError } = useMemo(() => {
    try {
      return { posts: loadPosts(), loadError: null as string | null };
    } catch (error) {
      console.error("[Blog] Failed to load static posts:", error);
      return { posts: [], loadError: "文章加载失败，请稍后重试。" };
    }
  }, []);

  useEffect(() => {
    setEntryVisible(Array.from({ length: posts.length }, () => false));
  }, [posts]);

  const applyTransitionStyles = useCallback((rawProgress: number) => {
    const progress = clamp01(rawProgress);
    const reducedMotion = reducedMotionRef.current;
    const showCover = progress < SCENE_HANDOFF;
    const showContent = !showCover;
    const maskLayerOpacity = reducedMotion ? 0 :
      smoothstep(0.08, 0.26, progress) * (1 - smoothstep(0.92, 0.98, progress));

    if (visualContainerRef.current) {
      visualContainerRef.current.style.opacity = showCover ? "1" : "0";
      visualContainerRef.current.style.visibility = showCover ? "visible" : "hidden";
    }

    if (maskContainerRef.current) {
      maskContainerRef.current.style.opacity = maskLayerOpacity.toFixed(3);
      maskContainerRef.current.style.visibility = maskLayerOpacity > 0 ? "visible" : "hidden";
    }

    if (contentSectionRef.current) {
      // Never crossfade the article scene with the 3D scene. The fluid above
      // both layers hides this swap, then uncovers fully opaque, readable cards.
      contentSectionRef.current.style.opacity = showContent ? "1" : "0";
      contentSectionRef.current.style.visibility = showContent ? "visible" : "hidden";
      contentSectionRef.current.style.transform = "none";
      contentSectionRef.current.inert = !showContent;
    }
  }, []);

  useEffect(() => {
    const initialProgress = window.innerHeight > 0 ? window.scrollY / window.innerHeight : 0;
    progressRef.current = clamp01(initialProgress);
    applyTransitionStyles(progressRef.current);
  }, [applyTransitionStyles]);

  useEffect(() => {
    let rafId = 0;
    let scheduled = false;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncByScroll = () => {
      scheduled = false;
      const nextProgress = window.innerHeight > 0 ? clamp01(window.scrollY / window.innerHeight) : 0;
      progressRef.current = nextProgress;
      applyTransitionStyles(nextProgress);
    };

    const scheduleSync = () => {
      if (scheduled) {
        return;
      }

      scheduled = true;
      rafId = window.requestAnimationFrame(syncByScroll);
    };

    const syncMotionPreference = () => {
      reducedMotionRef.current = motionPreference.matches;
      scheduleSync();
    };

    syncMotionPreference();
    motionPreference.addEventListener("change", syncMotionPreference);
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);

    return () => {
      motionPreference.removeEventListener("change", syncMotionPreference);
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [applyTransitionStyles]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.p5) {
      return;
    }

    const p5 = window.p5 as any;
    const monoliths: Array<Array<{ h: number; baseH: number }>> = [];
    const isCompactViewport = window.innerWidth < 1024;
    const cols = isCompactViewport ? 10 : 12;
    const rows = isCompactViewport ? 10 : 12;
    const spacing = isCompactViewport ? 56 : 60;
    let rotX = -Math.PI / 6;
    let rotY = Math.PI / 4;
    const targetRotX = -Math.PI / 6;
    const targetRotY = Math.PI / 4;
    let hasWebGL = false;

    const sketch = (p: any) => {
      p.setup = function () {
        p.pixelDensity(1);
        let canvas;
        try {
          canvas = p.createCanvas(window.innerWidth, window.innerHeight, p.WEBGL);
        } catch (error) {
          console.warn("Blog cover WebGL unavailable; skipping p5 canvas.", error);
          p.noLoop();
          return;
        }
        canvas.parent("p5-cover-canvas");
        canvas.elt.style.pointerEvents = "none";
        hasWebGL = Boolean(p._renderer?.isP3D);
        if (!hasWebGL) {
          console.warn("Blog cover WebGL unavailable; skipping p5 canvas.");
          p.noLoop();
          return;
        }

        for (let i = 0; i < cols; i++) {
          monoliths[i] = [];
          for (let j = 0; j < rows; j++) {
            monoliths[i][j] = {
              h: p.random(20, 200),
              baseH: p.random(20, 200),
            };
          }
        }
      };

      p.draw = function () {
        if (!hasWebGL) {
          p.clear();
          return;
        }

        const progress = progressRef.current;

        if (progress >= SCENE_HANDOFF) {
          p.clear();
          return;
        }

        const bgDark = p.lerp(8, 26, progress * 0.64);
        p.background(bgDark, bgDark + 8, bgDark + 18);

        const mouseXNorm = (p.mouseX - p.width / 2) / p.width;
        const mouseYNorm = (p.mouseY - p.height / 2) / p.height;
        rotX = p.lerp(rotX, targetRotX + mouseYNorm * 0.44, 0.045);
        rotY = p.lerp(rotY, targetRotY + mouseXNorm * 0.44, 0.045);

        p.rotateX(rotX);
        p.rotateY(rotY);
        p.ambientLight(18, 36, 86);
        p.pointLight(0, 209, 255, 200, -200, 300);
        p.strokeWeight(1);
        p.translate(-(cols * spacing) / 2, 0, -(rows * spacing) / 2);

        const sceneOpacity = 1 - progress * 0.9;

        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const monolith = monoliths[i][j];
            const noiseVal = p.noise(i * 0.2, j * 0.2, p.frameCount * 0.01);
            monolith.h = p.lerp(monolith.h, monolith.baseH + noiseVal * 150, 0.1);

            p.push();
            p.translate(i * spacing, -monolith.h / 2, j * spacing);
            p.fill(0, 71, 255, 24 * sceneOpacity);
            p.stroke(0, 209, 255, 170 * sceneOpacity);

            const dx = p.mouseX - p.width / 2 - (i - cols / 2) * spacing;
            const dy = p.mouseY - p.height / 2 - (j - rows / 2) * spacing;

            if (dx * dx + dy * dy < 95 * 95) {
              p.stroke(255, 255, 255, 240 * sceneOpacity);
              p.fill(0, 209, 255, 64 * sceneOpacity);
            }

            p.box(spacing * 0.8, monolith.h, spacing * 0.8);
            p.pop();
          }
        }

      };

      p.windowResized = function () {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
      };
    };

    const instance = new p5(sketch);
    const disconnectWorkspace = bindWorkspaceAnimation(instance);

    return () => {
      disconnectWorkspace();
      instance.remove();
    };
  }, [applyTransitionStyles]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.p5) {
      return;
    }

    const p5 = window.p5 as any;
    const particles: Array<{ x: number; y: number; size: number; speed: number; phase: number }> = [];
    const particleCount = window.innerWidth < 768 ? 56 : 84;
    let lastProgress = -1;
    let lastWidth = 0;
    let lastHeight = 0;
    let lastReducedMotion = false;

    const sketch = (p: any) => {
      p.setup = function () {
        p.pixelDensity(Math.min(window.devicePixelRatio || 1, 1.5));
        p.randomSeed(417);
        p.noiseSeed(417);
        const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
        canvas.parent("p5-transition-mask");
        canvas.elt.style.pointerEvents = "none";
        canvas.elt.style.filter = "url(#blog-mask-fusion)";

        for (let i = 0; i < particleCount; i++) {
          particles.push({
            x: p.random(),
            y: p.random(),
            size: p.random(80, 220),
            speed: p.random(0.5, 2),
            phase: p.random(p.TWO_PI),
          });
        }
      };

      p.draw = function () {
        // Use the same progress as the cover and DOM fade: no separate lag.
        const progress = progressRef.current;
        const reducedMotion = reducedMotionRef.current;
        if (progress === lastProgress && p.width === lastWidth &&
            p.height === lastHeight && reducedMotion === lastReducedMotion) return;
        lastProgress = progress;
        lastWidth = p.width;
        lastHeight = p.height;
        lastReducedMotion = reducedMotion;
        p.clear();
        if (reducedMotion || progress <= 0.08 || progress >= 0.98) return;

        const scale = Math.min(1, p.width / 900);
        const segments = 48;
        const retreat = smoothstep(MASK_RETREAT_START, MASK_RETREAT_END, progress);
        const approach = smoothstep(0.08, 0.28, progress);
        // Hold beyond the bottom edge during the scene handoff. Even the
        // highest part of the curved contour stays outside the viewport.
        const baseHeight = p.height * (-0.22 + approach * 1.5 - retreat * 1.78);
        const edge: Array<{ x: number; y: number }> = [];
        for (let i = 0; i <= segments; i++) {
          const x = i * p.width / segments;
          // Broad noise and continuous lobes replace the old pointed, every-fourth-vertex drips.
          const noise = p.noise(i * 0.1, retreat * 2.8);
          const wave = (noise * 2 - 1) * 90 * (1 - retreat * 0.55);
          const lobe = Math.pow((Math.sin(i * 0.26 + retreat * 4) + 1) / 2, 3);
          const drip = lobe * 105 * retreat;
          edge.push({ x, y: baseHeight + (wave + drip) * Math.max(0.55, scale) });
        }

        const ctx = p.drawingContext as CanvasRenderingContext2D;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(p.width, 0);
        ctx.lineTo(edge[segments].x, edge[segments].y);
        // Quadratic joins maintain a smooth contour through each liquid lobe.
        for (let i = segments - 1; i > 0; i--) {
          ctx.quadraticCurveTo(edge[i].x, edge[i].y,
            (edge[i].x + edge[i - 1].x) / 2, (edge[i].y + edge[i - 1].y) / 2);
        }
        ctx.lineTo(edge[0].x, edge[0].y);
        ctx.closePath();

        const particleScale = 1 - retreat * 0.88;
        const separation = smoothstep(0.08, 0.2, progress);
        for (const particle of particles) {
          const x = particle.x * p.width + Math.sin(particle.phase + progress * 2.5) * 12 * scale;
          const y = particle.y * p.height - retreat * p.height * particle.speed * 0.9;
          const radius = particle.size * 0.5 * particleScale * separation * Math.max(0.55, scale);
          if (radius < 0.5 || y + radius < 0 || y - radius > p.height) continue;
          // Slight, continuous deformation retains the original dark blobs without rigid circles.
          const stretch = 1 + Math.sin(particle.phase + progress * 5) * 0.09;
          ctx.moveTo(x + radius * stretch, y);
          ctx.ellipse(x, y, radius * stretch, radius / stretch, 0, 0, Math.PI * 2);
          ctx.closePath();
        }
        // Fill the whole silhouette once so overlapping blobs merge, rather than stack opacity.
        ctx.fillStyle = "#0a0a0a";
        ctx.fill();
        ctx.restore();
      };

      p.windowResized = function () {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
      };
    };

    const instance = new p5(sketch);
    const disconnectWorkspace = bindWorkspaceAnimation(instance);

    return () => {
      disconnectWorkspace();
      instance.remove();
    };
  }, []);

  useEffect(() => {
    if (initialSection !== "surface") {
      return;
    }

    // scrollIntoView() scrolls DampedScrollView's overflow-hidden viewbox
    // instead of the window (same mis-land ProximitySidebar documents), so
    // scroll the window to the element's untransformed layout offset.
    // Retried every frame until it sticks (bounded, ~2s): the document is
    // not scrollable until DampedScrollView publishes the body height, and
    // scrollTo transiently no-ops while the route reveal transition runs
    // (~1.6s). Only fights the user during that entry window.
    let rafId = 0;
    let attempts = 0;
    const MAX_ATTEMPTS = 120;

    const tryScroll = () => {
      attempts += 1;
      const element = contentSectionRef.current;

      if (element) {
        let top = 0;
        let node: HTMLElement | null = element;
        while (node) {
          top += node.offsetTop;
          node = node.offsetParent as HTMLElement | null;
        }

        const maxScroll =
          document.documentElement.scrollHeight - window.innerHeight;
        const canReach = maxScroll >= top - 1;
        const target = Math.min(top, Math.max(0, maxScroll));

        if (
          attempts >= MAX_ATTEMPTS ||
          (canReach && Math.abs(window.scrollY - target) < 2)
        ) {
          const nextProgress =
            window.innerHeight > 0 ? clamp01(window.scrollY / window.innerHeight) : 0;
          progressRef.current = nextProgress;
          applyTransitionStyles(nextProgress);
          return;
        }

        if (canReach) {
          window.scrollTo({ top: target, behavior: "auto" });
        }
      }

      rafId = window.requestAnimationFrame(tryScroll);
    };

    rafId = window.requestAnimationFrame(tryScroll);

    return () => window.cancelAnimationFrame(rafId);
  }, [applyTransitionStyles, initialSection]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number((entry.target as HTMLElement).dataset.entryIndex || "0");
          if (entry.isIntersecting) {
            setEntryVisible((current) => {
              if (current[index]) return current;
              const next = [...current];
              next[index] = true;
              return next;
            });
            setActiveDotIndex(index);
          }
        });
      },
      { threshold: 0.2 }
    );

    surfaceEntryRefs.current.forEach((element) => {
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [posts]);

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden bg-[#f5f5f5] text-[#0a0a0a]"
      style={{ touchAction: "pan-y" }}
    >

      <div
        ref={visualContainerRef}
        className="pointer-events-none fixed inset-0 z-[5]"
        style={{
          opacity: 1,
          visibility: "visible",
        }}
      >
        <div id="p5-cover-canvas" className="h-full w-full" />
      </div>

      <div
        ref={maskContainerRef}
        className="pointer-events-none fixed inset-0 z-30"
        style={{
          visibility: "visible",
          opacity: 0,
        }}
      >
        <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
          <defs>
            <filter id="blog-mask-fusion" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" edgeMode="duplicate" />
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
            </filter>
          </defs>
        </svg>
        <div id="p5-transition-mask" className="h-full w-full" aria-hidden="true" />
      </div>

      <DampedScrollView>
        <section className="relative z-10 h-screen w-full bg-transparent px-6 py-[10vh] md:px-10 xl:w-[60vw] xl:max-w-[60vw]">
          <div className="mx-auto min-h-[80vh] w-full" aria-hidden="true" />
        </section>

        <section
          ref={contentSectionRef}
          className="relative z-20 w-full min-h-screen bg-transparent px-6 pb-16 pt-[10vh] text-[#3e3c3a] md:px-10 xl:w-[60vw] xl:max-w-[60vw]"
          style={{
            opacity: 0,
            visibility: "hidden",
          }}
        >
          <div className="mx-auto flex w-full flex-col gap-8" id="blog-feed-surface">
            {loadError ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-100/70 p-4 text-sm text-red-900">
                {loadError}
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-2xl border border-[#d1cdc7] bg-[#f9f8f6] p-4 text-sm text-[#6a6560]">
                暂无文章
              </div>
            ) : (
              posts.map((post, index) => {
                const kineticType = KINETIC_TYPES[index % KINETIC_TYPES.length];
                const isVisible = entryVisible[index];

                return (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className={`group block w-full rounded-[28px] transition-[opacity,translate,scale] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                      isVisible
                        ? "translate-y-0 scale-100 opacity-100"
                        : "translate-y-3 scale-[0.99] opacity-0"
                    }`}
                    // One-shot reveal delay (IntersectionObserver only ever
                    // flips isVisible to true), so the cascade never affects
                    // anything else — hover lives on the inner card below.
                    style={{
                      transitionDelay: `${Math.min(index, 3) * 60}ms`,
                    }}
                  >
                    <div
                      ref={(el) => {
                        surfaceEntryRefs.current[index] = el;
                      }}
                      data-entry-index={index}
                      className="relative grid w-full items-center gap-4 rounded-[28px] bg-[#f9f8f6] p-4 shadow-[12px_12px_24px_#d1cdc7,-12px_-12px_24px_#ffffff,inset_0_0_0_1px_rgba(255,255,255,0.55)] ring-1 ring-black/[0.03] transition-[translate,box-shadow] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:-translate-y-1 group-hover:shadow-[20px_20px_40px_#d1cdc7,-20px_-20px_40px_#ffffff,inset_0_0_0_1px_rgba(255,255,255,0.55)] sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:gap-6 sm:p-6"
                    >
                      <BlogSurfaceThumbnail type={kineticType} />

                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="font-mono text-xs uppercase tracking-[0.12em] text-[#8e8a85]">
                          {formatDate(post.date)} — ISSUE #{(100 - index).toString().padStart(3, "0")}
                        </span>
                        <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#2a2a2a] md:text-[1.65rem] md:leading-tight">
                          {post.title}
                        </h2>
                        <p className="max-w-[760px] text-[0.95rem] leading-relaxed text-[#8e8a85] line-clamp-2">
                          {post.excerpt || "暂无预览..."}
                        </p>
                      </div>

                      <span
                        className="hidden h-12 w-12 items-center justify-center rounded-full text-[#2a2a2a] transition-[background-color,color] duration-[250ms] group-hover:bg-[#2a2a2a] group-hover:text-white md:flex"
                        style={{
                          boxShadow:
                            "3px 3px 6px #d1cdc7, -3px -3px 6px #ffffff",
                        }}
                        aria-hidden="true"
                      >
                        ↗
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <div className="pointer-events-none fixed right-10 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-5 md:flex">
            {posts.map((post, index) => (
              <div
                key={`dot-${post.slug}`}
                className={`h-6 w-1.5 origin-top rounded-full transition-[scale,background-color] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                  activeDotIndex === index
                    ? "scale-y-100 bg-[#2a2a2a]"
                    : "scale-y-[0.25] bg-[#d1cdc7]"
                }`}
              />
            ))}
          </div>
        </section>
      </DampedScrollView>

      <Navigation />
      <GrainOverlay />
      <CustomCursor />
    </div>
  );
}
