import { useEffect, useRef } from "react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";

declare global {
  interface Window {
    p5: any;
  }
}

type CreatureType = "fish" | "leaf" | "ant" | "sprout" | "butterfly";

type MorphParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  targetX: number;
  targetY: number;
  size: number;
  phase: number;
  noiseSeed: number;
  type: CreatureType;
  color: [number, number, number];
};

const FONT_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/topcoat/0.8.0/font/SourceCodePro-Bold.otf";

const LETTER_CONFIG: Array<{
  char: string;
  offsetX: number;
  type: CreatureType;
  color: [number, number, number];
}> = [
  { char: "F", offsetX: 0, type: "fish", color: [230, 100, 50] },
  { char: "e", offsetX: 110, type: "leaf", color: [100, 140, 80] },
  { char: "z", offsetX: 220, type: "ant", color: [45, 30, 25] },
  { char: "e", offsetX: 330, type: "sprout", color: [140, 190, 60] },
  { char: "r", offsetX: 440, type: "butterfly", color: [70, 130, 180] },
];

export default function AboutLogoTwo() {
  const p5InstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.p5) {
      return;
    }

    const p5 = window.p5;
    let particles: MorphParticle[] = [];
    let state: "wandering" | "forming" = "wandering";
    let stateStart = 0;
    let font: any = null;

    const resetSimulation = (p: any) => {
      if (!font) {
        return;
      }

      particles = [];

      const viewportScale = Math.min(1, p.width / 1280);
      const fontSize = Math.max(120, Math.floor(180 * viewportScale));
      const totalWidth = 500 * viewportScale;
      const startX = p.width / 2 - totalWidth / 2;
      const baselineY = p.height / 2 + fontSize * 0.24;

      LETTER_CONFIG.forEach((spec) => {
        const points = font.textToPoints(
          spec.char,
          startX + spec.offsetX * viewportScale,
          baselineY,
          fontSize,
          { sampleFactor: 0.13 }
        );

        points.forEach((point: { x: number; y: number }) => {
          particles.push({
            x: p.random(p.width),
            y: p.random(p.height),
            vx: p.random(-2, 2),
            vy: p.random(-2, 2),
            ax: 0,
            ay: 0,
            targetX: point.x,
            targetY: point.y,
            size: p.random(3.5, 7.5),
            phase: p.random(p.TWO_PI),
            noiseSeed: p.random(1000),
            type: spec.type,
            color: spec.color,
          });
        });
      });

      state = "wandering";
      stateStart = p.millis();
    };

    const limitMagnitude = (x: number, y: number, max: number) => {
      const magnitude = Math.hypot(x, y);
      if (magnitude <= max || magnitude === 0) {
        return { x, y };
      }
      const scale = max / magnitude;
      return { x: x * scale, y: y * scale };
    };

    const sketch = (p: any) => {
      p.preload = function () {
        font = p.loadFont(FONT_URL);
      };

      p.setup = function () {
        p.pixelDensity(1);
        const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
        canvas.parent("logo2-p5-container");
        resetSimulation(p);
      };

      p.draw = function () {
        p.background(252, 250, 247);

        if (state === "wandering" && p.millis() - stateStart > 2800) {
          state = "forming";
        }

        for (const particle of particles) {
          if (state === "wandering") {
            const flow = p.noise(particle.noiseSeed + p.frameCount * 0.01);
            const angle = p.map(flow, 0, 1, 0, p.TWO_PI * 2);
            particle.ax += p.cos(angle) * 0.1;
            particle.ay += p.sin(angle) * 0.1;

            if (particle.x < 0 || particle.x > p.width) {
              particle.vx *= -1;
            }
            if (particle.y < 0 || particle.y > p.height) {
              particle.vy *= -1;
            }
          } else {
            const dx = particle.targetX - particle.x;
            const dy = particle.targetY - particle.y;
            const distance = Math.hypot(dx, dy);
            const speed = p.map(Math.min(distance, 120), 0, 120, 0, 5.3);

            if (distance > 0.0001) {
              const desiredX = (dx / distance) * speed;
              const desiredY = (dy / distance) * speed;
              const steer = limitMagnitude(desiredX - particle.vx, desiredY - particle.vy, 0.22);
              particle.ax += steer.x;
              particle.ay += steer.y;
            }
          }

          particle.vx += particle.ax;
          particle.vy += particle.ay;

          const maxSpeed = state === "forming" ? 6 : 3;
          const limitedVelocity = limitMagnitude(particle.vx, particle.vy, maxSpeed);
          particle.vx = limitedVelocity.x;
          particle.vy = limitedVelocity.y;

          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.ax = 0;
          particle.ay = 0;

          p.push();
          p.translate(particle.x, particle.y);
          p.rotate(Math.atan2(particle.vy, particle.vx || 0.0001));
          p.noStroke();

          if (particle.type === "fish") {
            p.fill(230, 100, 50, 210);
            p.ellipse(0, 0, particle.size * 2, particle.size);
            const tailWiggle = p.sin(p.frameCount * 0.18 + particle.phase) * 2.4;
            p.triangle(
              -particle.size,
              0,
              -particle.size * 1.85,
              tailWiggle - 1.6,
              -particle.size * 1.85,
              tailWiggle + 1.6
            );
          } else if (particle.type === "leaf") {
            p.fill(100, 140, 80, 210);
            p.rotate(Math.PI / 4);
            p.beginShape();
            p.vertex(0, -particle.size);
            p.bezierVertex(
              particle.size * 0.8,
              -particle.size * 0.6,
              particle.size * 0.8,
              particle.size * 0.6,
              0,
              particle.size
            );
            p.bezierVertex(
              -particle.size * 0.8,
              particle.size * 0.6,
              -particle.size * 0.8,
              -particle.size * 0.6,
              0,
              -particle.size
            );
            p.endShape();
          } else if (particle.type === "ant") {
            p.fill(45, 30, 25, 220);
            p.ellipse(particle.size * 0.36, 0, particle.size * 0.6, particle.size * 0.45);
            p.ellipse(0, 0, particle.size * 0.72, particle.size * 0.5);
            p.ellipse(-particle.size * 0.72, 0, particle.size * 0.92, particle.size * 0.62);
            p.stroke(45, 30, 25, 210);
            const legMove = p.sin(p.frameCount * 0.42 + particle.phase) * 1.7;
            p.line(0, 0, legMove, particle.size * 0.8);
            p.line(0, 0, -legMove, -particle.size * 0.8);
            p.noStroke();
          } else if (particle.type === "sprout") {
            p.fill(140, 190, 60, 210);
            p.ellipse(0, 0, particle.size * 0.9, particle.size * 1.45);
            p.rotate(Math.PI / 3);
            p.ellipse(particle.size * 0.46, -particle.size * 0.46, particle.size * 0.72, particle.size * 1.2);
          } else {
            const flap = p.sin(p.frameCount * 0.26 + particle.phase) * 1;
            p.fill(70, 130, 180, 185);
            p.ellipse(-3 * flap, 0, 6 * Math.abs(flap), 10);
            p.ellipse(3 * flap, 0, 6 * Math.abs(flap), 10);
            p.fill(30, 30, 30, 210);
            p.ellipse(0, 0, 1.5, 7.5);
          }

          p.pop();
        }
      };

      p.mousePressed = function () {
        resetSimulation(p);
      };

      p.windowResized = function () {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
        resetSimulation(p);
      };
    };

    const instance = new p5(sketch);
    p5InstanceRef.current = instance;

    return () => {
      instance.remove();
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#fcfaf7]">
      <div id="logo2-p5-container" className="fixed inset-0 z-[2] h-screen w-full" />

      <Navigation />
      <GrainOverlay />
      <CustomCursor />

      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(252,250,247,0.35)_100%)]" />

      <div className="relative z-20 flex min-h-screen flex-col justify-between px-6 pb-8 pt-24 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-black/45">
              Logo Variant // 02
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-black/80 md:text-6xl">
              Biotic Choreography
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/about/logo"
              className="pointer-events-auto rounded-md border border-black/25 bg-white/75 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-black/70 backdrop-blur transition-colors hover:bg-black hover:text-white"
            >
              Logo Hub
            </Link>
            <Link
              href="/about/logo/logo1"
              className="pointer-events-auto rounded-md border border-black/25 bg-white/75 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-black/70 backdrop-blur transition-colors hover:bg-black hover:text-white"
            >
              Go Logo 01
            </Link>
            <Link
              href="/about"
              className="pointer-events-auto rounded-md border border-black/25 bg-white/75 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-black/70 backdrop-blur transition-colors hover:bg-black hover:text-white"
            >
              Back to About
            </Link>
          </div>
        </div>

        <p className="pointer-events-none self-center font-mono text-[11px] uppercase tracking-[0.2em] text-black/35">
          Click to replay procedural formation
        </p>
      </div>
    </div>
  );
}
