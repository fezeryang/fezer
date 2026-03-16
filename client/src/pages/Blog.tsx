import { useEffect, useRef, useState } from "react";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";

declare global {
  interface Window {
    p5: any;
  }
}

export default function Blog() {
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [activeEntry, setActiveEntry] = useState(1);
  const p5InstanceRef = useRef<any>(null);

  const blogEntries = [
    {
      id: 1,
      date: "MAR. 24 / 2024",
      title: "The Brutalist Resonance",
      preview:
        "Exploring the intersection of raw concrete forms and low-frequency synthesis...",
    },
    {
      id: 2,
      date: "FEB. 12 / 2024",
      title: "Parametric Rhythms",
      preview:
        "Applying Voronoi tessellation to rhythmic structures. Each cell represents...",
    },
    {
      id: 3,
      date: "JAN. 05 / 2024",
      title: "Extruded Blueprints",
      preview:
        "A study on the verticality of technical drawings. When the 2D plan becomes...",
    },
    {
      id: 4,
      date: "DEC. 18 / 2023",
      title: "Void & Silence",
      preview:
        "Negative space in architecture is the visual equivalent of silence...",
    },
  ];

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.p5) return;

    const p5 = window.p5 as any;
    let monoliths: any[][] = [];
    const cols = 12;
    const rows = 12;
    const spacing = 60;
    let rotX = -Math.PI / 6;
    let rotY = Math.PI / 4;
    let targetRotX = -Math.PI / 6;
    let targetRotY = Math.PI / 4;

    const sketch = (p: any) => {
      p.setup = function () {
        const canvas = p.createCanvas(
          window.innerWidth - 450,
          window.innerHeight,
          p.WEBGL
        );
        canvas.parent("p5-container");

        for (let i = 0; i < cols; i++) {
          monoliths[i] = [];
          for (let j = 0; j < rows; j++) {
            monoliths[i][j] = {
              h: p.random(20, 200),
              baseH: p.random(20, 200),
              offset: p.random(1000),
            };
          }
        }
      };

      p.draw = function () {
        p.background(2, 8, 18);

        let mouseXNorm = (p.mouseX - p.width / 2) / p.width;
        let mouseYNorm = (p.mouseY - p.height / 2) / p.height;

        rotX = p.lerp(rotX, targetRotX + mouseYNorm * 0.5, 0.05);
        rotY = p.lerp(rotY, targetRotY + mouseXNorm * 0.5, 0.05);

        p.rotateX(rotX);
        p.rotateY(rotY);

        p.ambientLight(20, 40, 100);
        p.pointLight(0, 209, 255, 200, -200, 300);

        p.strokeWeight(1);

        p.translate(-(cols * spacing) / 2, 0, -(rows * spacing) / 2);

        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            let m = monoliths[i][j];

            let noiseVal = p.noise(i * 0.2, j * 0.2, p.frameCount * 0.01);
            m.h = p.lerp(m.h, m.baseH + noiseVal * 150, 0.1);

            p.push();
            p.translate(i * spacing, -m.h / 2, j * spacing);

            p.fill(0, 71, 255, 20);
            p.stroke(0, 209, 255, 150);

            let d = p.dist(
              p.mouseX - p.width / 2,
              p.mouseY - p.height / 2,
              (i - cols / 2) * spacing,
              (j - rows / 2) * spacing
            );
            if (d < 100) {
              p.stroke(255, 255, 255, 255);
              p.fill(0, 209, 255, 60);
            }

            p.box(spacing * 0.8, m.h, spacing * 0.8);

            if (m.h > 150) {
              p.push();
              p.noFill();
              p.stroke(0, 209, 255, 50);
              p.translate(0, -m.h / 2 - 20, 0);
              p.ellipse(0, 0, 40, 40);
              p.line(0, -10, 0, 10);
              p.pop();
            }

            p.pop();
          }
        }

        p.push();
        p.rotateX(p.HALF_PI);
        p.noFill();
        p.stroke(0, 71, 255, 30);
        p.rect(-500, -500, 1000, 1000);
        p.pop();
      };

      p.windowResized = function () {
        p.resizeCanvas(window.innerWidth - 450, window.innerHeight);
      };
    };

    const instance = new p5(sketch);
    p5InstanceRef.current = instance;

    return () => {
      instance.remove();
    };
  }, []);

  return (
    <div className="w-full h-screen bg-blueprint-dark flex overflow-hidden">
      {/* Grid Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 71, 255, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 71, 255, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Sidebar */}
      <aside className="w-[450px] bg-blueprint-dark bg-opacity-80 backdrop-blur border-r border-blueprint-blue border-opacity-15 overflow-y-auto p-16 z-10">
        <div className="mb-20">
          <h2 className="text-xs font-mono tracking-widest text-blueprint-cyan mb-2">
            Archive / V.04
          </h2>
          <h1 className="text-5xl font-bold text-white">
            Architectural<br />Sonics
          </h1>
        </div>

        {blogEntries.map((entry) => (
          <div
            key={entry.id}
            className={`log-entry cursor-pointer mb-12 ${
              activeEntry === entry.id ? "active" : ""
            }`}
            onClick={() => setActiveEntry(entry.id)}
          >
            <span className="text-xs font-mono text-blue-300 opacity-60 block mb-2">
              {entry.date}
            </span>
            <h3 className="text-lg font-semibold text-white mb-3">
              {entry.title}
            </h3>
            <p className="text-sm text-blue-200 opacity-70 line-clamp-3">
              {entry.preview}
            </p>
          </div>
        ))}
      </aside>

      {/* Canvas Container */}
      <div className="flex-1 relative overflow-hidden">
        <div id="p5-container" className="w-full h-full" />
      </div>

      {/* Coordinate Readout */}
      <div className="fixed bottom-8 right-8 text-xs font-mono text-blueprint-cyan opacity-60 pointer-events-none">
        <div>X: {(cursorPos.x / 100).toFixed(3)}</div>
        <div>Y: {(cursorPos.y / 100).toFixed(3)}</div>
      </div>

      <Navigation />
      <GrainOverlay />
      <CustomCursor />
    </div>
  );
}
