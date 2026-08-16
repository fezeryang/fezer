import { useEffect, useRef, useState } from "react";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";
import DampedScrollView from "@/components/DampedScrollView";
import logoPreviewUrl from "@/data/fezer_logo_square_1024.png";
import { Link } from "wouter";

const labImageUrls = Array.from(
  { length: 6 },
  (_, index) =>
    `${import.meta.env.BASE_URL}studioimage/catlogo-${String(index + 1).padStart(2, "0")}.png`
);

declare global {
  interface Window {
    p5: any;
  }
}

export default function Lab() {
  const [scrollT, setScrollT] = useState(0);
  const p5InstanceRef = useRef<any>(null);
  const tapeLocalT = Math.max(0, Math.min(1, (scrollT - 0.85) / 0.15));
  const logoFrameLeft = `calc(50% + ${-tapeLocalT * 1000 + 500 + 390 - 175}px)`;

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
    if (typeof window === "undefined" || !window.p5) return;

    const p5 = window.p5 as any;
    let cubeTex: any[] = [];
    let logoPreviewImage: any = null;
    let hasWebGL = false;

    const sketch = (p: any) => {
      p.preload = function () {
        logoPreviewImage = p.loadImage(logoPreviewUrl);
        cubeTex = labImageUrls.map(imageUrl => p.loadImage(imageUrl));
      };

      p.setup = function () {
        let canvas;
        try {
          canvas = p.createCanvas(
            window.innerWidth,
            window.innerHeight,
            p.WEBGL
          );
        } catch (error) {
          console.warn("Lab WebGL unavailable; skipping p5 canvas.", error);
          p.noLoop();
          return;
        }
        canvas.parent("p5-container");
        hasWebGL = Boolean(p._renderer?.isP3D);
        if (!hasWebGL) {
          console.warn("Lab WebGL unavailable; skipping p5 canvas.");
          p.noLoop();
          return;
        }

        p.pixelDensity(1);
      };

      p.draw = function () {
        if (!hasWebGL) {
          p.clear();
          return;
        }

        const scrollY = window.scrollY;
        const scrollHeight = document.body.scrollHeight - window.innerHeight;
        const scrollT = scrollHeight > 0 ? scrollY / scrollHeight : 0;

        let camZ = p.height / 2 / p.tan(p.PI / 6);
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

        drawWaveField(scrollT, p);

        if (p.random() > 0.95) {
          drawGlitch(p);
        }
      };

      p.windowResized = function () {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
      };
    };

    const renderCube = (t: number, p: any) => {
      p.push();
      let rotateVal = t * p.PI * 4;
      p.rotateX(rotateVal * 0.5);
      p.rotateY(rotateVal);
      p.rotateZ(rotateVal * 0.2);

      let size = 220 + p.sin(p.frameCount * 0.05) * 10;
      let wavePhase = p.frameCount * 0.045 + t * p.TWO_PI;

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
        const wave = p.sin(wavePhase + i * 0.85);
        const secondaryWave = p.sin(wavePhase * 0.62 - i * 0.45);

        p.push();
        p.translate(
          face[0] + wave * 5,
          face[1] + secondaryWave * 5,
          face[2] + wave * 3
        );
        rotations[i]();
        p.rotateZ(wave * 0.025);
        p.rotateX(secondaryWave * 0.02);
        p.scale(1 + wave * 0.022, 1 - wave * 0.018);
        p.texture(cubeTex[i]);
        p.plane(size);
        p.pop();
      });

      p.push();
      p.noFill();
      p.stroke(42, 42, 42, 28);
      p.strokeWeight(1);
      p.rotateX(p.HALF_PI);
      for (let i = 0; i < 3; i++) {
        const ringWave = p.sin(wavePhase * 0.8 + i) * 14;
        p.ellipse(0, 0, size * (1.4 + i * 0.28) + ringWave);
      }
      p.pop();

      p.pop();
    };

    const drawWaveField = (t: number, p: any) => {
      if (t >= 0.85) {
        return;
      }

      p.push();
      p.resetMatrix();
      p.noFill();
      p.stroke(42, 42, 42, 18);
      p.strokeWeight(1);

      const centerY = p.height * 0.5;
      const waveTime = p.frameCount * 0.032 + t * p.TWO_PI;

      for (let band = 0; band < 6; band++) {
        p.beginShape();
        for (let x = -p.width / 2; x <= p.width / 2; x += 32) {
          const wave =
            p.sin(x * 0.012 + waveTime + band * 0.7) * (8 + band * 1.5) +
            p.sin(x * 0.026 - waveTime * 0.7) * 4;
          const y = centerY - p.height / 2 + (band - 2.5) * 78 + wave;
          p.vertex(x, y, -520);
        }
        p.endShape();
      }

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
        } else if (i === 1 && logoPreviewImage) {
          p.texture(logoPreviewImage);
          p.plane(size);
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
      let lineY = ((p.frameCount * 5) % size) - size / 2;
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
      p.rect(
        p.random(p.width),
        p.random(p.height),
        p.random(100, 300),
        p.random(5, 20)
      );
      p.pop();
    };

    const instance = new p5(sketch);
    p5InstanceRef.current = instance;

    return () => {
      instance.remove();
    };
  }, []);

  return (
    <div className="w-full bg-white overflow-x-hidden">
      <div
        id="p5-container"
        data-testid="lab-canvas"
        className="pointer-events-none fixed inset-0 z-[1] h-screen w-full"
      />
      <Navigation />
      <GrainOverlay />
      <CustomCursor />

      {scrollT >= 0.85 ? (
        <Link
          href="/lab/logo"
          aria-label="Open logo lab"
          className="fixed z-20 block"
          style={{
            left: logoFrameLeft,
            top: "calc(50% - 175px)",
            width: "350px",
            height: "350px",
          }}
        >
          <span className="sr-only">Open logo lab</span>
        </Link>
      ) : null}

      <DampedScrollView>
        <div className="relative w-full" style={{ height: "600vh" }}>
          <div className="absolute inset-0 z-10 flex flex-col justify-between p-8 pointer-events-none">
            <div className="pointer-events-auto">
              <h1 className="text-6xl md:text-8xl font-bold text-white mix-blend-difference">
                Fezer
                <br />
                实验室
              </h1>
            </div>

            <div className="text-right text-sm font-mono pointer-events-auto">
              <div>
                帧率: <span id="fps">60</span>
              </div>
              <div>
                滚动位置:{" "}
                <span id="scrollVal">{Math.round(scrollT * 100)}%</span>
              </div>
              <div>
                阶段: {scrollT < 0.6 ? "01" : scrollT < 0.85 ? "02" : "03"}
              </div>
            </div>
          </div>
        </div>
      </DampedScrollView>
    </div>
  );
}
