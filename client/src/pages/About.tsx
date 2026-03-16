import { useEffect, useRef } from "react";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";

declare global {
  interface Window {
    p5: any;
  }
}

export default function About() {
  const p5InstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.p5) return;

    const p5 = window.p5 as any;
    let prisms: any[] = [];

    class Prism {
      pos: any;
      size: number;
      rotSpeed: number;
      color: any;

      constructor(pInstance: any) {
        this.pos = pInstance.createVector(
          pInstance.random(-300, 300),
          pInstance.random(-300, 300),
          pInstance.random(-300, 300)
        );
        this.size = pInstance.random(50, 200);
        this.rotSpeed = pInstance.random(0.01, 0.02);
        this.color = pInstance.color(
          pInstance.random(200, 255),
          pInstance.random(200, 255),
          pInstance.random(230, 255),
          40
        );
      }

      update(pInstance: any) {
        let m = pInstance.createVector(
          pInstance.mouseX - pInstance.width / 2,
          pInstance.mouseY - pInstance.height / 2,
          0
        );
        let diff = p5.Vector.sub(m, this.pos);
        this.pos.add(diff.mult(0.01));
      }

      display(pInstance: any) {
        pInstance.push();
        pInstance.translate(this.pos.x, this.pos.y, this.pos.z);
        pInstance.rotateX(pInstance.frameCount * this.rotSpeed);
        pInstance.rotateZ(pInstance.frameCount * this.rotSpeed * 0.5);

        pInstance.stroke(0, 0, 0, 15);
        pInstance.fill(this.color);

        pInstance.box(this.size, this.size * 0.1, this.size * 1.5);
        pInstance.pop();
      }
    }

    const sketch = (p: any) => {
      p.setup = function () {
        const canvas = p.createCanvas(window.innerWidth, window.innerHeight, p.WEBGL);
        canvas.parent("p5-container");

        for (let i = 0; i < 8; i++) {
          prisms.push(new Prism(p));
        }
      };

      p.draw = function () {
        p.background(252, 252, 252);

        p.ambientLight(200);
        p.pointLight(
          255,
          255,
          255,
          p.mouseX - p.width / 2,
          p.mouseY - p.height / 2,
          500
        );

        p.push();
        p.rotateX(p.frameCount * 0.002);
        p.rotateY(p.frameCount * 0.001);

        prisms.forEach((prism) => {
          prism.update(p);
          prism.display(p);
        });

        p.pop();
      };

      p.windowResized = function () {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
      };
    };

    const instance = new p5(sketch);
    p5InstanceRef.current = instance;

    return () => {
      instance.remove();
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-sand-base overflow-x-hidden">
      <div id="p5-container" className="fixed inset-0 w-full h-screen" />
      <Navigation />
      <GrainOverlay />
      <CustomCursor />

      {/* Content Wrapper */}
      <div className="relative z-10 grid grid-cols-3 gap-10 min-h-screen p-16">
        {/* Left Navigation */}
        <div className="flex flex-col justify-between border-l border-text-main border-opacity-10 pl-8">
          <div className="writing-mode-vertical text-xs font-bold tracking-widest text-text-main opacity-60 space-y-8">
            <span>Archive Index — 2024</span>
            <span>Refractive Studies</span>
            <span>Architectural Echo</span>
          </div>
        </div>

        {/* Main Content */}
        <main className="col-span-1 pt-32">
          <header className="mb-32">
            <h1 className="text-6xl md:text-7xl font-bold mb-8 leading-tight">
              Prismatic<br />Alabaster.
            </h1>
            <p className="text-lg text-text-main opacity-70 max-w-md">
              A repository of spatial observations, sonic architecture, and the
              intersection of light and text.
            </p>
          </header>

          {/* Record Feed */}
          <section className="space-y-32">
            <article className="grid grid-cols-2 gap-10">
              <div className="text-sm font-mono text-text-main opacity-60">
                001 / JUN
              </div>
              <div>
                <span className="text-xs font-bold tracking-widest text-text-main opacity-50 block mb-3">
                  Acoustic Geometry
                </span>
                <h2 className="text-3xl font-light mb-6 leading-tight">
                  The weight of silence in brutalist concrete voids.
                </h2>
                <p className="text-lg leading-relaxed text-text-main opacity-70">
                  Architecture is frozen music, but what happens when the music
                  is purely ambient? Observations on how sound reflects off raw
                  aggregate surfaces in the afternoon sun.
                </p>
              </div>
            </article>

            <article className="grid grid-cols-2 gap-10">
              <div className="text-sm font-mono text-text-main opacity-60">
                002 / MAY
              </div>
              <div>
                <span className="text-xs font-bold tracking-widest text-text-main opacity-50 block mb-3">
                  Refraction Theory
                </span>
                <h2 className="text-3xl font-light mb-6 leading-tight">
                  Light as a structural load-bearing element.
                </h2>
                <p className="text-lg leading-relaxed text-text-main opacity-70">
                  If we treat photon density as a physical weight, our glass
                  structures would collapse under the noon sun. Exploring the
                  visual metaphor of structural transparency.
                </p>
              </div>
            </article>

            <article className="grid grid-cols-2 gap-10">
              <div className="text-sm font-mono text-text-main opacity-60">
                003 / MAY
              </div>
              <div>
                <span className="text-xs font-bold tracking-widest text-text-main opacity-50 block mb-3">
                  Harmonic Grid
                </span>
                <h2 className="text-3xl font-light mb-6 leading-tight">
                  Twelve-tone rows applied to urban planning.
                </h2>
                <p className="text-lg leading-relaxed text-text-main opacity-70">
                  Designing a city block where the zoning height is determined
                  by the frequency of a Schoenberg composition. Rhythmic
                  dissonance in the skyline.
                </p>
              </div>
            </article>
          </section>
        </main>

        {/* Right Info Panel */}
        <aside className="flex flex-col justify-end border-l border-text-main border-opacity-10 pl-8">
          <div className="glass-card p-8">
            <div className="space-y-4 text-xs font-mono text-text-main opacity-70 mb-6">
              <div className="flex justify-between pb-2 border-b border-text-main border-opacity-10">
                <span>LATITUDE</span>
                <span>40.7128 N</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-text-main border-opacity-10">
                <span>REFRACTION</span>
                <span>1.458 η</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-text-main border-opacity-10">
                <span>FREQUENCY</span>
                <span>440 Hz</span>
              </div>
              <div className="flex justify-between">
                <span>OPACITY</span>
                <span>82%</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-text-main opacity-60">
              The interaction between mouse movement and the background prism
              simulates the modulation of light through architectural glass.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
