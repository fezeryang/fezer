import { Link } from "wouter";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";
import DampedScrollView from "@/components/DampedScrollView";
import { loadPosts } from "@/content/loaders";

declare global {
  interface Window {
    p5: any;
  }
}

type BlogExperienceProps = {
  initialSection?: "cover" | "surface";
};

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

    const handleResize = () => {
      const size = getSize();
      instance.resizeCanvas(size, size);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
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
  const surfaceEntryRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const progressRef = useRef(0);

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
    const revealProgress = smoothstep(0.52, 0.9, progress);
    const contentOpacity = revealProgress;
    const contentTranslateY = 50 * (1 - revealProgress);
    const canvasOpacity = 1 - smoothstep(0.66, 0.92, progress);
    const maskLayerOpacity =
      smoothstep(0.08, 0.34, progress) * (1 - smoothstep(0.84, 0.97, progress));
    const showMask = progress < 0.97;

    if (visualContainerRef.current) {
      visualContainerRef.current.style.opacity = canvasOpacity.toFixed(3);
      visualContainerRef.current.style.visibility = canvasOpacity < 0.01 ? "hidden" : "visible";
    }

    if (maskContainerRef.current) {
      maskContainerRef.current.style.opacity = maskLayerOpacity.toFixed(3);
      maskContainerRef.current.style.visibility = showMask ? "visible" : "hidden";
    }

    if (contentSectionRef.current) {
      contentSectionRef.current.style.opacity = contentOpacity.toFixed(3);
      contentSectionRef.current.style.transform = `translate3d(0, ${contentTranslateY.toFixed(2)}px, 0)`;
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

    scheduleSync();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);

    return () => {
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
    let smoothedScrollY = 0;
    const monoliths: Array<Array<{ h: number; baseH: number }>> = [];
    const isCompactViewport = window.innerWidth < 1024;
    const cols = isCompactViewport ? 10 : 12;
    const rows = isCompactViewport ? 10 : 12;
    const spacing = isCompactViewport ? 56 : 60;
    let rotX = -Math.PI / 6;
    let rotY = Math.PI / 4;
    const targetRotX = -Math.PI / 6;
    const targetRotY = Math.PI / 4;

    const sketch = (p: any) => {
      p.setup = function () {
        p.pixelDensity(1);
        const canvas = p.createCanvas(window.innerWidth, window.innerHeight, p.WEBGL);
        canvas.parent("p5-cover-canvas");
        canvas.elt.style.pointerEvents = "none";

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
        const targetScrollY = window.scrollY;
        smoothedScrollY = p.lerp(smoothedScrollY, targetScrollY, 0.08);
        const progress = p.constrain(smoothedScrollY / p.height, 0, 1);

        if (progress > 0.93) {
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

    return () => {
      instance.remove();
    };
  }, [applyTransitionStyles]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.p5) {
      return;
    }

    const p5 = window.p5 as any;
    let smoothedScrollY = 0;
    const particles: Array<{ x: number; y: number; size: number; speed: number }> = [];
    const particleCount = window.innerWidth < 768 ? 56 : 84;

    const sketch = (p: any) => {
      p.setup = function () {
        p.pixelDensity(1);
        const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
        canvas.parent("p5-transition-mask");
        canvas.elt.style.pointerEvents = "none";

        for (let i = 0; i < particleCount; i++) {
            particles.push({
              x: p.random(p.width),
              y: p.random(p.height),
              size: p.random(80, 220),
              speed: p.random(0.5, 2),
            });
          }
      };

      p.draw = function () {
        const targetScrollY = window.scrollY;
        smoothedScrollY = p.lerp(smoothedScrollY, targetScrollY, 0.08);
        const progress = p.constrain(smoothedScrollY / p.height, 0, 1);

        const maskStrength =
          p.lerp(0.16, 0.88, smoothstep(0.12, 0.58, progress)) *
          (1 - smoothstep(0.8, 0.97, progress));

        if (maskStrength < 0.01) {
          p.clear();
          return;
        }

        p.clear();
        p.noStroke();
        p.fill(10, 10, 10, maskStrength * 255);

        p.beginShape();
        p.vertex(0, 0);

        const segments = 24;
        const step = p.width / segments;
        const baseHeight = p.height * (1.08 - progress * 1.58);

        for (let i = 0; i <= segments; i++) {
          const x = i * step;
          const noiseValue = p.noise(i * 0.2, smoothedScrollY * 0.005);
          const wave = p.map(noiseValue, 0, 1, -90, 90) * (1 - progress * 0.55);
          const drip = p.sin(i * 0.52 + smoothedScrollY * 0.01) * 34 * progress;

          let y = baseHeight + wave + drip;
          if (i % 4 === 0) {
            y += 130 * progress * p.noise(i, smoothedScrollY * 0.0012);
          }

          p.vertex(x, y);
        }

        p.vertex(p.width, 0);
        p.endShape(p.CLOSE);

        const particleScale = 1 - progress * 0.88;

        if (progress > 0.08 && progress < 0.9 && particleScale > 0.03) {
          p.fill(10, 10, 10, particleScale * maskStrength * 255);

          for (const particle of particles) {
            let driftY = particle.y - smoothedScrollY * particle.speed * 0.9;
            if (driftY < -200) {
              driftY = p.height + 200;
            }

            p.ellipse(particle.x, driftY, particle.size * particleScale);
          }
        }
      };

      p.windowResized = function () {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
      };
    };

    const instance = new p5(sketch);

    return () => {
      instance.remove();
    };
  }, []);

  useEffect(() => {
    if (initialSection !== "surface") {
      return;
    }

    const id = window.setTimeout(() => {
      contentSectionRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
      const nextProgress = window.innerHeight > 0 ? clamp01(window.scrollY / window.innerHeight) : 0;
      progressRef.current = nextProgress;
      applyTransitionStyles(nextProgress);
    }, 0);

    return () => window.clearTimeout(id);
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
        className="pointer-events-none fixed inset-0 z-[6]"
        style={{
          visibility: "visible",
          opacity: 0,
        }}
      >
        <div id="p5-transition-mask" className="h-full w-full" />
      </div>

      <DampedScrollView>
        <section className="relative z-10 h-screen w-full bg-transparent px-6 py-[10vh] md:px-10 xl:w-[60vw] xl:max-w-[60vw]">
          <div className="mx-auto min-h-[80vh] w-full" aria-hidden="true" />
        </section>

        <section
          ref={contentSectionRef}
          className="relative z-20 w-full min-h-screen bg-[#f5f5f5] px-6 pb-16 pt-[10vh] text-[#3e3c3a] md:px-10 xl:w-[60vw] xl:max-w-[60vw]"
          style={{
            opacity: 0,
            transform: "translate3d(0, 50px, 0)",
            willChange: "opacity, transform",
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-transparent via-[#f2f0ed]/72 to-[#f2f0ed]" />

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
                  <Link key={post.slug} href={`/blog/${post.slug}`}>
                    <a
                      ref={(el) => {
                        surfaceEntryRefs.current[index] = el;
                      }}
                      data-entry-index={index}
                      className={`group relative grid w-full cursor-pointer items-center gap-4 rounded-[28px] bg-[#f9f8f6] p-4 ring-1 ring-black/[0.03] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:shadow-[20px_20px_40px_#d1cdc7,-20px_-20px_40px_#ffffff] sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:gap-6 sm:p-6 ${
                        isVisible
                          ? "translate-y-0 scale-100 opacity-100"
                          : "translate-y-4 scale-[0.99] opacity-0"
                      }`}
                      style={{
                        boxShadow:
                          "12px 12px 24px #d1cdc7, -12px -12px 24px #ffffff, inset 0 0 0 1px rgba(255,255,255,0.55)",
                      }}
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
                        className="hidden h-12 w-12 items-center justify-center rounded-full text-[#2a2a2a] transition-all duration-300 group-hover:bg-[#2a2a2a] group-hover:text-white md:flex"
                        style={{
                          boxShadow:
                            "3px 3px 6px #d1cdc7, -3px -3px 6px #ffffff",
                        }}
                        aria-hidden="true"
                      >
                        ↗
                      </span>
                    </a>
                  </Link>
                );
              })
            )}
          </div>

          <div className="pointer-events-none fixed right-10 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-5 md:flex">
            {posts.map((post, index) => (
              <div
                key={`dot-${post.slug}`}
                className={`w-1.5 rounded-full transition-all duration-300 ${
                  activeDotIndex === index ? "h-6 bg-[#2a2a2a]" : "h-1.5 bg-[#d1cdc7]"
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
