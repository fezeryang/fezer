import { useEffect, useRef, useState } from "react";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";

declare global {
  interface Window {
    p5: any;
  }
}

export default function Lab() {
  const [scrollT, setScrollT] = useState(0);
  const p5InstanceRef = useRef<any>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const scrollHeight = document.body.scrollHeight - window.innerHeight;
      const t = scrollHeight > 0 ? scrollY / scrollHeight : 0;
      setScrollT(t);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.p5) return;

    const p5 = window.p5 as any;
    let cubeTex: any[] = [];

    const sketch = (p: any) => {
      p.setup = function () {
        const canvas = p.createCanvas(window.innerWidth, window.innerHeight, p.WEBGL);
        canvas.parent("p5-container");

        for (let i = 0; i < 6; i++) {
          let pg = p.createGraphics(400, 400);
          drawProceduralTexture(pg, i, p);
          cubeTex.push(pg);
        }

        p.pixelDensity(1);
      };

      p.draw = function () {
        const scrollY = window.scrollY;
        const scrollHeight = document.body.scrollHeight - window.innerHeight;
        const scrollT = scrollHeight > 0 ? scrollY / scrollHeight : 0;

        let camZ = (p.height / 2) / p.tan(p.PI / 6);
        p.camera(0, 0, camZ + scrollT * 500, 0, 0, 0, 0, 1, 0);

        p.clear();
        p.background(245, 245, 247, 0);

        p.ambientLight(150);
        p.pointLight(255, 255, 255, 200, -200, 300);

        if (scrollT < 0.6) {
          renderCube(scrollT, p);
        } else if (scrollT < 0.85) {
          renderUnfolding(scrollT, p);
        } else {
          renderTape(scrollT, p);
        }

        if (p.random() > 0.95) {
          drawGlitch(p);
        }
      };

      p.windowResized = function () {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
      };
    };

    const drawProceduralTexture = (pg: any, index: number, p: any) => {
      pg.background(255);
      pg.noStroke();
      const colors = ["#ff0055", "#00ff99", "#0066ff", "#f3ff00", "#080808", "#ffffff"];

      pg.fill(colors[index]);
      pg.rect(0, 0, pg.width, pg.height);

      pg.fill(0, 50);
      for (let i = 0; i < 10; i++) {
        pg.ellipse(pg.random(pg.width), pg.random(pg.height), pg.random(50, 200));
      }

      pg.fill(255);
      pg.textSize(40);
      pg.textAlign(pg.CENTER, pg.CENTER);
      pg.text("DATA_IMG_" + index, pg.width / 2, pg.height / 2);

      pg.stroke(0, 30);
      for (let i = 0; i < pg.width; i += 4) {
        for (let j = 0; j < pg.height; j += 4) {
          if (pg.random() > 0.8) pg.point(i, j);
        }
      }
    };

    const renderCube = (t: number, p: any) => {
      p.push();
      let rotateVal = t * p.PI * 4;
      p.rotateX(rotateVal * 0.5);
      p.rotateY(rotateVal);
      p.rotateZ(rotateVal * 0.2);

      let size = 220 + p.sin(p.frameCount * 0.05) * 10;

      const faces = [
        [0, 0, size / 2],
        [0, 0, -size / 2],
        [size / 2, 0, 0],
        [-size / 2, 0, 0],
        [0, -size / 2, 0],
        [0, size / 2, 0],
      ];

      const rotations = [
        () => {},
        () => {},
        () => p.rotateY(p.HALF_PI),
        () => p.rotateY(-p.HALF_PI),
        () => p.rotateX(p.HALF_PI),
        () => p.rotateX(-p.HALF_PI),
      ];

      faces.forEach((face, i) => {
        p.push();
        p.translate(face[0], face[1], face[2]);
        rotations[i]();
        p.texture(cubeTex[i]);
        p.plane(size);
        p.pop();
      });

      p.pop();
    };

    const renderUnfolding = (t: number, p: any) => {
      let localT = p.map(t, 0.6, 0.85, 0, 1);
      let size = 220;

      p.push();
      p.rotateY(t * p.PI);
      p.rotateX(p.sin(t * p.PI) * 0.2);

      for (let i = 0; i < 6; i++) {
        p.push();
        let targetX = (i - 2.5) * (size + 20);
        let curX = p.lerp(0, targetX, localT);
        let curZ = p.lerp(0, p.sin(i * 0.5) * 100, localT);
        let curRotY = p.lerp(i * p.HALF_PI, 0, localT);

        p.translate(curX, 0, curZ);
        p.rotateY(curRotY);
        p.texture(cubeTex[i % 6]);
        p.plane(size);
        p.pop();
      }
      p.pop();
    };

    const renderTape = (t: number, p: any) => {
      let localT = p.map(t, 0.85, 1, 0, 1);
      let size = 350;

      p.push();
      p.translate(-localT * 1000 + 500, 0, 0);

      for (let i = 0; i < 15; i++) {
        p.push();
        p.translate(i * (size + 40), 0, 0);

        p.fill(8);
        p.rect(-size / 2 - 20, -size / 2 - 40, size + 40, size + 80);

        p.fill(245);
        for (let j = 0; j < 10; j++) {
          p.rect(-size / 2 - 10, -size / 2 - 30 + j * 45, 15, 25);
          p.rect(size / 2 - 5, -size / 2 - 30 + j * 45, 15, 25);
        }

        if (i % 2 === 0) {
          drawVideoPlayback(size, p);
        } else {
          p.texture(cubeTex[i % 6]);
          p.plane(size);
        }
        p.pop();
      }
      p.pop();
    };

    const drawVideoPlayback = (size: number, p: any) => {
      p.push();
      p.noStroke();
      p.fill(0);
      p.rect(-size / 2, -size / 2, size, size);

      let time = p.frameCount * 0.1;
      for (let i = 0; i < 5; i++) {
        p.fill(i % 2 === 0 ? "#00ff99" : "#ff0055");
        let h = p.noise(i, time) * size;
        p.rect(-size / 2 + (i * size) / 5, size / 2 - h, size / 5, h);
      }

      p.stroke(255, 150);
      p.strokeWeight(2);
      let lineY = (p.frameCount * 5) % size - size / 2;
      p.line(-size / 2, lineY, size / 2, lineY);
      p.pop();
    };

    const drawGlitch = (p: any) => {
      p.push();
      p.resetMatrix();
      p.translate(-p.width / 2, -p.height / 2);
      p.noFill();
      p.stroke("#f3ff00");
      p.strokeWeight(p.random(1, 10));
      let y = p.random(p.height);
      p.line(0, y, p.width, y);

      p.fill(255, 0, 85, 100);
      p.rect(p.random(p.width), p.random(p.height), p.random(100, 300), p.random(5, 20));
      p.pop();
    };

    const instance = new p5(sketch);
    p5InstanceRef.current = instance;

    return () => {
      instance.remove();
    };
  }, []);

  return (
    <div className="w-full bg-white overflow-x-hidden" style={{ height: "600vh" }}>
      <div id="p5-container" className="fixed inset-0 w-full h-screen" />
      <Navigation />
      <GrainOverlay />
      <CustomCursor />

      {/* UI Layer */}
      <div className="fixed inset-0 z-10 flex flex-col justify-between p-8 pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-6xl md:text-8xl font-bold text-white mix-blend-difference">
            Hyper<br />Static
          </h1>
        </div>

        <div className="text-right text-sm font-mono pointer-events-auto">
          <div>FRAME_RATE: <span id="fps">60</span></div>
          <div>SCROLL_POS: <span id="scrollVal">{Math.round(scrollT * 100)}%</span></div>
          <div>PHASE: {scrollT < 0.6 ? "01" : scrollT < 0.85 ? "02" : "03"}</div>
        </div>
      </div>
    </div>
  );
}
