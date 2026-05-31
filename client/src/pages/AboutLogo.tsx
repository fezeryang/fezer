import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";

declare global {
  interface Window {
    p5: any;
  }
}

type HubItem = {
  id: string;
  meta: string;
  title: string;
  description: string;
  accent: string;
  href: string;
};

type Bubble = {
  x: number;
  y: number;
  radius: number;
  xOff: number;
  yOff: number;
  color: [number, number, number, number];
};

const HUB_ITEMS: HubItem[] = [
  {
    id: "logo1",
    meta: "Project 01",
    title: "LOGO1",
    description: "Strict reference variant from mylogo/logo1.html.",
    accent: "var(--accent-1)",
    href: "/lab/logo/logo1",
  },
  {
    id: "logo2",
    meta: "Project 02",
    title: "LOGO2",
    description: "Biotic choreography variant with staged formation.",
    accent: "var(--accent-2)",
    href: "/lab/logo/logo2",
  },
];

export default function AboutLogo() {
  const [, setLocation] = useLocation();
  const clusterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.p5) {
      return;
    }

    const p5 = window.p5;
    let bubbles: Bubble[] = [];

    const sketch = (p: any) => {
      p.setup = function () {
        p.pixelDensity(1);
        const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
        canvas.parent("logo-hub-canvas-container");

        bubbles = Array.from({ length: 8 }, () => ({
          x: p.random(p.width),
          y: p.random(p.height),
          radius: p.random(100, 300),
          xOff: p.random(1000),
          yOff: p.random(1000),
          color: [p.random(200, 255), p.random(200, 255), p.random(200, 255), 150],
        }));
      };

      p.draw = function () {
        p.clear();

        for (const bubble of bubbles) {
          bubble.x = p.noise(bubble.xOff) * p.width;
          bubble.y = p.noise(bubble.yOff) * p.height;
          bubble.xOff += 0.002;
          bubble.yOff += 0.002;

          p.noStroke();
          p.fill(bubble.color[0], bubble.color[1], bubble.color[2], bubble.color[3]);
          p.ellipse(bubble.x, bubble.y, bubble.radius * 2);
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
    const handleMouseMove = (event: MouseEvent) => {
      if (!clusterRef.current) {
        return;
      }

      const moveX = (event.clientX - window.innerWidth / 2) * 0.05;
      const moveY = (event.clientY - window.innerHeight / 2) * 0.05;
      clusterRef.current.style.transform = `translate(${moveX}px, ${moveY}px)`;
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="logo-hub-root">
      <style>{`
        .logo-hub-root {
          --bg-primary: #fcfdfa;
          --accent-1: #e0f2f1;
          --accent-2: #fff9c4;
          --accent-3: #fce4ec;
          --text-main: #1a1a1a;
          --text-mono: #5a5a5a;
          --transition-speed: 0.8s;
          --bezier: cubic-bezier(0.85, 0, 0.15, 1);
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          font-family: Inter, sans-serif;
          background-color: var(--bg-primary);
          color: var(--text-main);
        }

        .logo-hub-canvas {
          position: fixed;
          top: 0;
          left: 0;
          z-index: 1;
          opacity: 0.6;
          pointer-events: none;
        }

        .logo-hub-view {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          transition: transform var(--transition-speed) var(--bezier), opacity var(--transition-speed) ease;
          z-index: 20;
        }

        .logo-hub-container {
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          filter: url('#logo-hub-gooey');
        }

        .logo-hub-cluster {
          position: relative;
          width: min(800px, calc(100vw - 80px));
          height: min(420px, calc(100vh - 160px));
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 40px;
          padding: 50px;
          transition: transform 0.24s ease-out;
        }

        .logo-hub-item {
          position: relative;
          border-radius: 45% 55% 70% 30% / 30% 40% 60% 70%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          transition: all 0.6s var(--bezier);
          animation: logo-hub-morphing 15s infinite alternate ease-in-out;
          border: 1px solid rgba(255, 255, 255, 0.8);
          box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.5);
          overflow: hidden;
          pointer-events: auto;
        }

        .logo-hub-item:hover {
          transform: scale(1.1) rotate(2deg);
          z-index: 50;
          background: #fff;
        }

        .logo-hub-item:nth-child(2) {
          animation-delay: -2s;
          border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
        }

        .logo-hub-item-content {
          text-align: center;
          padding: 20px;
          z-index: 2;
        }

        .logo-hub-meta {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--text-mono);
          letter-spacing: 0.1em;
        }

        .logo-hub-title {
          font-size: 1.4rem;
          font-weight: 800;
          margin-top: 0.5rem;
          color: #222;
        }

        .logo-hub-desc {
          margin-top: 0.45rem;
          font-size: 0.76rem;
          line-height: 1.45;
          color: rgba(0, 0, 0, 0.62);
          font-family: "JetBrains Mono", monospace;
          letter-spacing: 0.02em;
        }

        .logo-hub-open-hint {
          margin-top: 0.7rem;
          font-size: 0.7rem;
          font-family: "JetBrains Mono", monospace;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(0, 0, 0, 0.6);
        }

        @keyframes logo-hub-morphing {
          0% {
            border-radius: 45% 55% 70% 30% / 30% 40% 60% 70%;
          }
          50% {
            border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
          }
          100% {
            border-radius: 45% 55% 70% 30% / 30% 40% 60% 70%;
          }
        }

        @media (max-width: 980px) {
          .logo-hub-cluster {
            gap: 18px;
            padding: 24px;
          }

          .logo-hub-title {
            font-size: 1.05rem;
          }

          .logo-hub-desc {
            font-size: 0.68rem;
          }

        }
      `}</style>

      <svg className="absolute h-0 w-0 opacity-0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="logo-hub-gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div id="logo-hub-canvas-container" className="logo-hub-canvas" />

      <Navigation />
      <GrainOverlay />
      <CustomCursor />

      <section className="logo-hub-view">
        <div className="logo-hub-container">
          <div ref={clusterRef} className="logo-hub-cluster">
            {HUB_ITEMS.map((item) => (
              <button
                key={item.id}
                className="logo-hub-item"
                style={{ background: item.accent }}
                onClick={() => {
                  setLocation(item.href);
                }}
              >
                <div className="logo-hub-item-content">
                  <div className="logo-hub-meta">{item.meta}</div>
                  <div className="logo-hub-title">{item.title}</div>
                  <div className="logo-hub-desc">{item.description}</div>
                  <div className="logo-hub-open-hint">open page ↗</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
