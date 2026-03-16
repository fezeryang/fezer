import { useEffect, useRef, useState } from "react";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";

declare global {
  interface Window {
    p5: any;
  }
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const p5InstanceRef = useRef<any>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCoords({ x: Math.floor(e.clientX), y: Math.floor(e.clientY) });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.p5) return;

    const p5 = window.p5 as any;
    let particles: any[] = [];
    let cols: number, rows: number;
    const scl = 25;
    let zoff = 0;
    let flowfield: any[] = [];

    const sketch = (p: any) => {
      p.setup = function () {
        const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
        canvas.parent("p5-container");
        
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
        let index = x + y * cols;
        let force = vectors[index];

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

    const instance = new p5(sketch);
    p5InstanceRef.current = instance;

    return () => {
      instance.remove();
    };
  }, []);

  return (
    <div className="w-full h-screen bg-sand-base overflow-hidden">
      <div id="p5-container" className="w-full h-full" />
      <Navigation />
      <GrainOverlay />
      <CustomCursor />

      {/* Hero Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <h1 className="text-7xl md:text-9xl font-bold text-center leading-none mb-4 mix-blend-difference text-white">
          KINETIC
        </h1>
        <h1 className="text-7xl md:text-9xl font-bold text-center leading-none text-accent-lava">
          SAND
        </h1>
      </div>

      {/* Bottom Stats */}
      <div className="absolute bottom-8 right-8 text-xs font-mono text-text-main pointer-events-none">
        <div>COORDINATES: {coords.x}, {coords.y}</div>
        <div>DENSITY: 88.42%</div>
        <div>STATUS: INTERACTIVE_FLOW</div>
      </div>
    </div>
  );
}
