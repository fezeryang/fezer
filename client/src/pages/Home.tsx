import { Link } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";
import DampedScrollView from "@/components/DampedScrollView";
import { loadPosts, loadWorks } from "@/content/loaders";

declare global {
  interface Window {
    p5: any;
  }
}

function ShutterItem({
  index,
  title,
  tag,
  href,
  imageUrl,
  isProject = false,
}: {
  index: string;
  title: string;
  tag: string;
  href: string;
  imageUrl?: string;
  isProject?: boolean;
}) {
  const itemRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const item = itemRef.current;
    const preview = previewRef.current;
    if (!item || !preview) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { left, top, width, height } = item.getBoundingClientRect();
      const x = (clientX - left) / width;
      const y = (clientY - top) / height;

      preview.style.transform = `translate(${(x - 0.5) * 30}px, ${(y - 0.5) * 10}px) scale(1.05)`;
    };

    const handleMouseLeave = () => {
      preview.style.transform = `translateX(40px) scale(1.1)`;
    };

    if (window.matchMedia("(hover: hover)").matches) {
      item.addEventListener("mousemove", handleMouseMove);
      item.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      item.removeEventListener("mousemove", handleMouseMove);
      item.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div className="reveal opacity-0 translate-y-8 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]">
      <Link
        href={href}
        className={`group block w-full cursor-pointer overflow-hidden border-b border-black/10 bg-transparent transition-[height] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] h-[80px] hover:h-[180px] ${
          isProject ? "border-l-4 border-l-transparent hover:border-l-accent-lava" : ""
        }`}
      >
        <div ref={itemRef} className="relative flex h-full w-full items-center">
          <div className="absolute inset-0 z-[1] origin-top bg-white/60 backdrop-blur-md transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-full" />

          <div
            ref={previewRef}
            className="pointer-events-none absolute right-0 top-0 z-0 h-full w-2/5 translate-x-10 scale-110 opacity-0 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-100 group-hover:translate-x-0 group-hover:opacity-15"
            style={{ filter: "grayscale(1) contrast(1.1)" }}
          >
            {imageUrl ? (
              <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-black/20" />
            )}
          </div>

          <div className="relative z-[2] flex w-full items-center justify-between px-4 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:px-8">
            <div className="flex items-center gap-8 md:gap-16">
              <span className="font-mono text-xs text-black/40">{index}</span>
              <h2 className={`text-xl md:text-2xl font-normal tracking-tight transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-5 ${!isProject ? "group-hover:text-black/60" : ""}`}>
                {title}
              </h2>
            </div>
            <span
              className="font-chill-huofangsong rounded-full border border-black/10 px-3 py-1 text-[10px] md:text-[11px] text-black/40 opacity-50 transition-all duration-400 group-hover:border-accent-lava group-hover:bg-accent-lava group-hover:text-white group-hover:opacity-100"
            >
              {tag}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

function TimePrismSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<any>(null);
  const visibleRef = useRef(false);
  const [clockNow, setClockNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(new Date());
    }, 100);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sectionRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        visibleRef.current = visible;

        if (p5InstanceRef.current) {
          if (visible) {
            p5InstanceRef.current.loop?.();
          } else {
            p5InstanceRef.current.noLoop?.();
          }
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(sectionRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !canvasContainerRef.current) {
      return;
    }
    let disposed = false;
    let retryId: number | null = null;
    let instance: any = null;

    const mountSketch = () => {
      if (disposed || !canvasContainerRef.current) {
        return;
      }

      const p5 = window.p5;
      if (!p5) {
        retryId = window.setTimeout(mountSketch, 120);
        return;
      }

      const sketch = (p: any) => {
      const getCanvasSize = () => {
        const width = Math.min(500, Math.max(280, window.innerWidth * 0.44));
        return Math.floor(width);
      };

      const drawTimeRing = (
        val: number,
        maxVal: number,
        radius: number,
        color: [number, number, number, number]
      ) => {
        const segments = 24;
        const step = p.TWO_PI / segments;
        const activeAngle = p.map(val, 0, maxVal, 0, p.TWO_PI);

        for (let i = 0; i < segments; i++) {
          const angle = i * step;
          const x = p.cos(angle) * radius;
          const y = p.sin(angle) * radius;

          p.push();
          p.translate(x, y, 0);
          p.rotateZ(angle);

          const isActive = angle < activeAngle;
          if (isActive) {
            p.fill(color[0], color[1], color[2], 180);
            p.stroke(color[0], color[1], color[2], 255);
            p.strokeWeight(2);
          } else {
            p.noFill();
            p.stroke(0, 15);
            p.strokeWeight(1);
          }

          p.box(10, 30, 10);

          if (isActive && i % 4 === 0) {
            p.strokeWeight(0.5);
            p.line(0, 0, 0, -x, -y, -50);
          }

          p.pop();
        }
      };

      p.setup = function () {
        p.pixelDensity(1);
        p.disableFriendlyErrors = true;
        const size = getCanvasSize();
        const canvas = p.createCanvas(size, size, p.WEBGL);
        canvas.parent(canvasContainerRef.current);
        canvas.elt.style.pointerEvents = "none";
        p.smooth();
        if (!visibleRef.current) {
          p.noLoop();
        }
      };

      p.draw = function () {
        if (!visibleRef.current) {
          p.clear();
          return;
        }

        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes();
        const s = now.getSeconds();
        const ms = now.getMilliseconds();

        p.clear();
        p.ambientLight(200);
        p.pointLight(255, 255, 255, 200, -200, 300);

        p.rotateX(p.frameCount * 0.005);
        p.rotateY(p.frameCount * 0.008);

        drawTimeRing(s + ms / 1000, 60, 180, [0, 200, 255, 100]);

        p.push();
        p.rotateZ(p.PI / 3);
        drawTimeRing(m + s / 60, 60, 140, [255, 0, 150, 100]);
        p.pop();

        p.push();
        p.rotateX(p.PI / 4);
        drawTimeRing(h + m / 60, 24, 100, [255, 200, 0, 100]);
        p.pop();

        p.push();
        p.noFill();
        p.stroke(0, 40);
        p.strokeWeight(0.5);
        p.sphere(40 + p.sin(p.frameCount * 0.05) * 5);
        p.pop();
      };

      p.windowResized = function () {
        const size = getCanvasSize();
        p.resizeCanvas(size, size);
      };
      };

      instance = new p5(sketch);
      p5InstanceRef.current = instance;
    };

    mountSketch();

    return () => {
      disposed = true;
      if (retryId) {
        window.clearTimeout(retryId);
      }
      instance?.remove();
      p5InstanceRef.current = null;
    };
  }, []);

  const siteCreatedAt: number =
    (typeof __VITE_SITE_CREATED_AT__ !== "undefined" ? __VITE_SITE_CREATED_AT__ : Date.now());

  const creationDate = useMemo(() => {
    return siteCreatedAt;
  }, [siteCreatedAt]);

  const diff = Math.max(0, clockNow.getTime() - creationDate);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  const clockText = `${pad(clockNow.getHours())}:${pad(clockNow.getMinutes())}:${pad(
    clockNow.getSeconds()
  )}`;
  const uptimeText = `${pad(days)}天 ${pad(hours)}时 ${pad(minutes)}分 ${pad(seconds)}秒`;

  return (
    <section
      ref={sectionRef}
      className="reveal relative z-20 w-full overflow-hidden px-6 py-20 opacity-0 translate-y-8 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] md:px-10 md:py-24"
    >
      <div className="pointer-events-none absolute inset-0 opacity-25 [background:radial-gradient(circle_at_15%_20%,rgba(255,0,150,0.08),transparent_38%),radial-gradient(circle_at_85%_22%,rgba(0,200,255,0.08),transparent_40%),radial-gradient(circle_at_50%_88%,rgba(255,255,0,0.08),transparent_42%)]" />

      <div className="relative mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">

        <main className="relative flex items-center justify-center md:pr-6">
          <div ref={canvasContainerRef} className="relative z-10 flex h-[320px] w-[320px] items-center justify-center mix-blend-multiply md:h-[500px] md:w-[500px]" />
        </main>

        <section className="flex flex-col justify-center md:pl-8">
          <div className="mb-10">
            <div
              className="mb-1 text-[17px] uppercase tracking-[0.2em] text-black/45"
              style={{ fontFamily: "'Gravitas One', serif" }}
            >
              Now
            </div>
            <div
              className="text-5xl font-bold leading-none tracking-[-0.05em] text-black/90 md:text-7xl"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              {clockText}
            </div>
            <div className="mt-3 text-sm">
              <div className="font-mono font-bold text-black/80">{pad(clockNow.getMilliseconds(), 3)}毫秒</div>
            </div>
          </div>

          <div>
            <div
              className="font-chill-huofangsong mb-1 text-[17px] uppercase tracking-[0.2em] text-black/45"
            >
              已经运行
            </div>
            <div
              className="bg-gradient-to-r from-black to-black/50 bg-clip-text text-xl font-bold text-transparent md:text-2xl"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              {uptimeText}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

export default function Home() {
  const heroEnglishChars = useMemo(() => Array.from("All is coming into being."), []);
  const heroTibetanChars = useMemo(() => Array.from("ཐམས་ཅད་རིམ་གྱིས་ཁ་ཕྱེ་བཞིན་འདུག།"), []);
  const [typingIndex, setTypingIndex] = useState(0);
  const p5InstanceRef = useRef<any>(null);
  const coordsRef = useRef({ x: 0, y: 0 });
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const maxTypingLength = Math.max(heroEnglishChars.length, heroTibetanChars.length);
  const typedEnglish = heroEnglishChars.slice(0, Math.min(typingIndex, heroEnglishChars.length)).join("");
  const typedTibetan = heroTibetanChars.slice(0, Math.min(typingIndex, heroTibetanChars.length)).join("");
  const isTyping = typingIndex < maxTypingLength;

  const { latestWorks, latestPosts, loadError } = useMemo(() => {
    try {
      const works = loadWorks().slice(0, 3);
      const posts = loadPosts().slice(0, 3);
      return {
        latestWorks: works,
        latestPosts: posts,
        loadError: null as string | null,
      };
    } catch (error) {
      console.error("[Home] Failed to load latest previews:", error);
      return {
        latestWorks: [],
        latestPosts: [],
        loadError: "内容加载失败，请稍后重试。",
      };
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (typingIndex < maxTypingLength) {
        setTypingIndex((prev) => prev + 1);
      } else {
        setTypingIndex(0);
      }
    }, typingIndex < maxTypingLength ? 95 : 5000);

    return () => window.clearTimeout(timer);
  }, [maxTypingLength, typingIndex]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      coordsRef.current = { x: Math.floor(e.clientX), y: Math.floor(e.clientY) };
    };

    const displayTick = window.setInterval(() => {
      setCoords(coordsRef.current);
    }, 120);

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.clearInterval(displayTick);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let disposed = false;
    let retryId: number | null = null;
    let instance: any = null;

    const mountSketch = () => {
      if (disposed) {
        return;
      }

      const p5 = window.p5 as any;
      if (!p5) {
        retryId = window.setTimeout(mountSketch, 120);
        return;
      }

    let particles: any[] = [];
    let cols: number, rows: number;
    const scl = 25;
    let zoff = 0;
    let flowfield: any[] = [];

    const sketch = (p: any) => {
      p.setup = function () {
        const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
        canvas.parent("p5-container");
        canvas.elt.style.pointerEvents = "none";
        p.pixelDensity(1);
        p.disableFriendlyErrors = true;
        
        cols = p.floor(p.width / scl);
        rows = p.floor(p.height / scl);
        flowfield = new Array(cols * rows);

        for (let i = 0; i < 1200; i++) {
          particles.push(new Particle(p));
        }
        p.background("#e9e5d9");
      };

      p.draw = function () {
        p.fill(233, 229, 217, 15);
        p.noStroke();
        p.rect(0, 0, p.width, p.height);

        let yoff = 0;
        for (let y = 0; y < rows; y++) {
          let xoff = 0;
          for (let x = 0; x < cols; x++) {
            let index = x + y * cols;
            let angle = p.noise(xoff, yoff, zoff) * p.TWO_PI * 4;
            let v = p5.Vector.fromAngle(angle);
            v.setMag(1);
            flowfield[index] = v;
            xoff += 0.1;
          }
          yoff += 0.1;
        }
        zoff += 0.003;

        for (let i = 0; i < particles.length; i++) {
          particles[i].follow(flowfield);
          particles[i].update();
          particles[i].edges();
          particles[i].show();
        }
      };

      p.windowResized = function () {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
        cols = p.floor(p.width / scl);
        rows = p.floor(p.height / scl);
      };
    };

    class Particle {
      pos: any;
      vel: any;
      acc: any;
      maxspeed: number;
      prevPos: any;
      color: any;
      p: any;

      constructor(pInstance: any) {
        this.p = pInstance;
        this.pos = pInstance.createVector(pInstance.random(pInstance.width), pInstance.random(pInstance.height));
        this.vel = pInstance.createVector(0, 0);
        this.acc = pInstance.createVector(0, 0);
        this.maxspeed = 2;
        this.prevPos = this.pos.copy();
        this.color =
          pInstance.floor(pInstance.random(100)) > 95
            ? pInstance.color(255, 77, 0)
            : pInstance.color(42, 42, 42, 120);
      }

      update() {
        this.vel.add(this.acc);
        this.vel.limit(this.maxspeed);
        this.pos.add(this.vel);
        this.acc.mult(0);
      }

      follow(vectors: any[]) {
        let x = Math.floor(this.pos.x / scl);
        let y = Math.floor(this.pos.y / scl);

        if (x < 0 || x >= cols || y < 0 || y >= rows) {
          return;
        }

        let index = x + y * cols;
        let force = vectors[index];

        if (!force) {
          return;
        }

        let m = this.p.createVector(this.p.mouseX, this.p.mouseY);
        let d = this.p.dist(this.pos.x, this.pos.y, this.p.mouseX, this.p.mouseY);
        if (d < 150) {
          let push = p5.Vector.sub(this.pos, m);
          push.setMag(0.5);
          this.applyForce(push);
        }

        this.applyForce(force);
      }

      applyForce(force: any) {
        this.acc.add(force);
      }

      show() {
        this.p.stroke(this.color);
        this.p.strokeWeight(1);
        this.p.line(
          this.pos.x,
          this.pos.y,
          this.prevPos.x,
          this.prevPos.y
        );
        this.updatePrev();
      }

      updatePrev() {
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;
      }

      edges() {
        if (this.pos.x > this.p.width) {
          this.pos.x = 0;
          this.updatePrev();
        }
        if (this.pos.x < 0) {
          this.pos.x = this.p.width;
          this.updatePrev();
        }
        if (this.pos.y > this.p.height) {
          this.pos.y = 0;
          this.updatePrev();
        }
        if (this.pos.y < 0) {
          this.pos.y = this.p.height;
          this.updatePrev();
        }
      }
    }

    instance = new p5(sketch);
    p5InstanceRef.current = instance;
    };

    mountSketch();

    return () => {
      disposed = true;
      if (retryId) {
        window.clearTimeout(retryId);
      }
      instance?.remove();
      p5InstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("opacity-100", "translate-y-0");
          entry.target.classList.remove("opacity-0", "translate-y-8");
        }
      });
    }, observerOptions);

    setTimeout(() => {
      document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    }, 100);

    return () => observer.disconnect();
  }, [latestWorks, latestPosts]);

  return (
    <div className="relative min-h-screen w-full bg-sand-base overflow-x-hidden">
      <div id="p5-container" className="pointer-events-none fixed inset-0 z-[1] h-screen w-full" />
      <Navigation />
      <GrainOverlay />
      <CustomCursor />

      <DampedScrollView>

      <section className="relative z-10 flex h-screen w-full flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-4 text-7xl font-bold leading-none text-black transition-colors duration-300 hover:text-transparent md:text-9xl">
          FEZER
        </h1>

        <div className="mt-4 flex flex-col items-center gap-2">
          <h2 className="font-caveat-hand text-3xl font-semibold leading-none tracking-[0.04em] text-black md:text-5xl">
            {typedEnglish}
            <span
              className={`ml-1 inline-block text-black transition-opacity duration-300 ${isTyping ? "animate-pulse-custom opacity-100" : "opacity-0"}`}
              aria-hidden="true"
            >
              |
            </span>
          </h2>

          <p className="font-zsft-hs text-xl leading-tight text-black/90 md:text-3xl">
            {typedTibetan}
            <span
              className={`ml-1 inline-block text-black/80 transition-opacity duration-300 ${isTyping ? "animate-pulse-custom opacity-100" : "opacity-0"}`}
              aria-hidden="true"
            >
              |
            </span>
          </p>
        </div>

        <div className="absolute bottom-8 right-8 text-right font-mono text-xs text-text-main">
          <div>坐标: {coords.x}, {coords.y}</div>
          <div>状态: 活跃</div>
        </div>
      </section>

      <div className="relative z-20 w-full bg-gradient-to-b from-transparent via-[#e9e5d9]/28 to-[#e9e5d9]/38 pt-32 pb-20 backdrop-blur-[1px]">
        <section className="mx-auto mb-32 w-full max-w-[1400px] px-6 md:px-10">
          <div className="mb-12 flex items-center gap-4">
            <p
              className="font-chill-huofangsong text-sm tracking-[0.14em] text-black/45"
            >
              最新项目 / 近期作品
            </p>
            <div className="h-px flex-grow bg-black/10" />
          </div>

          {loadError ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-100/70 px-4 py-3 text-sm text-red-900">
              {loadError}
            </div>
          ) : (
            <div className="flex flex-col">
              {latestWorks.map((work, i) => (
                <ShutterItem
                  key={work.slug}
                  index={String(i + 1).padStart(2, "0")}
                  title={work.title}
                  tag="项目"
                  href={`/portfolio#${work.slug}`}
                  imageUrl={work.imageUrl}
                  isProject={true}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mx-auto mb-20 w-full max-w-[1400px] px-6 md:px-10">
          <div className="mb-12 flex items-center gap-4">
            <p
              className="font-chill-huofangsong text-sm tracking-[0.14em] text-black/45"
            >
              最新文章 / 日志
            </p>
            <div className="h-px flex-grow bg-black/10" />
          </div>

          {loadError ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-100/70 px-4 py-3 text-sm text-red-900">
              {loadError}
            </div>
          ) : (
            <div className="flex flex-col">
              {latestPosts.map((post) => {
                const date = new Date(post.date);
                const month = date.getMonth() + 1;
                const day = date.getDate();
                return (
                  <ShutterItem
                    key={post.slug}
                    index={`${month}月${day}日`}
                    title={post.title}
                    tag="文章"
                    href={`/blog/${post.slug}`}
                    isProject={false}
                  />
                );
              })}
            </div>
          )}
        </section>

      </div>

      <div className="relative z-20 h-24 w-full bg-gradient-to-b from-transparent via-[#e9e5d9]/26 to-transparent" />

      <TimePrismSection />
      </DampedScrollView>
    </div>
  );
}
