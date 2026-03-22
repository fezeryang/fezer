import { useEffect, useRef, useState } from "react";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";
import { loadWorks } from "@/content/loaders";

declare global {
  interface Window {
    p5: any;
  }
}

export default function Portfolio() {
  const [scrollY, setScrollY] = useState(0);
  const p5InstanceRef = useRef<any>(null);
  const works = loadWorks();

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.p5) return;

    const p5 = window.p5 as any;
    let pieces: any[] = [];
    let gravity: any;
    let wind: any;
    const colors = [
      "#e63946",
      "#f1faee",
      "#a8dadc",
      "#457b9d",
      "#1d3557",
      "#ffb703",
      "#fb8500",
    ];

    class PaperPiece {
      pos: any;
      vel: any;
      acc: any;
      angle: number;
      angVel: number;
      w: number;
      h: number;
      color: any;
      type: number;
      p: any;

      constructor(pInstance: any, x?: number, y?: number) {
        this.p = pInstance;
        this.pos = pInstance.createVector(
          x || pInstance.random(pInstance.width),
          y || pInstance.random(-pInstance.height, 0)
        );
        this.vel = pInstance.createVector(
          pInstance.random(-1, 1),
          pInstance.random(-1, 1)
        );
        this.acc = pInstance.createVector(0, 0);
        this.angle = pInstance.random(pInstance.TWO_PI);
        this.angVel = pInstance.random(-0.05, 0.05);
        this.w = pInstance.random(60, 180);
        this.h = pInstance.random(80, 240);
        this.color = pInstance.color(pInstance.random(colors));
        this.type = pInstance.floor(pInstance.random(3));
      }

      applyForce(force: any) {
        this.acc.add(force);
      }

      reactToMouse(mx: number, my: number) {
        let d = this.p.dist(mx, my, this.pos.x, this.pos.y);
        if (d < 250) {
          let push = p5.Vector.sub(this.pos, this.p.createVector(mx, my));
          push.normalize();
          push.mult(2);
          this.applyForce(push);
          this.angVel += this.p.random(-0.02, 0.02);
        }
      }

      update() {
        this.vel.add(this.acc);
        this.vel.limit(6);
        this.pos.add(this.vel);
        this.acc.mult(0);
        this.angle += this.angVel;
        this.angVel *= 0.98;
      }

      edges() {
        if (this.pos.y > this.p.height + this.h) {
          this.pos.y = -this.h;
          this.vel.y = this.p.random(1, 3);
        }
        if (this.pos.x > this.p.width + this.w) this.pos.x = -this.w;
        if (this.pos.x < -this.w) this.pos.x = this.p.width + this.w;
      }

      display() {
        this.p.push();
        this.p.translate(this.pos.x, this.pos.y);
        this.p.rotate(this.angle);

        this.p.noStroke();
        this.p.fill(0, 20);
        this.p.rect(5, 5, this.w, this.h);

        this.p.fill(this.color);
        this.p.beginShape();
        for (let i = 0; i <= 10; i++) {
          let x = this.p.lerp(-this.w / 2, this.w / 2, i / 10);
          this.p.vertex(x, -this.h / 2 + this.p.random(-2, 2));
        }
        for (let i = 0; i <= 10; i++) {
          let y = this.p.lerp(-this.h / 2, this.h / 2, i / 10);
          this.p.vertex(this.w / 2 + this.p.random(-2, 2), y);
        }
        for (let i = 10; i >= 0; i--) {
          let x = this.p.lerp(-this.w / 2, this.w / 2, i / 10);
          this.p.vertex(x, this.h / 2 + this.p.random(-2, 2));
        }
        for (let i = 10; i >= 0; i--) {
          let y = this.p.lerp(-this.h / 2, this.h / 2, i / 10);
          this.p.vertex(-this.w / 2 + this.p.random(-2, 2), y);
        }
        this.p.endShape(this.p.CLOSE);

        this.p.stroke(0, 30);
        this.p.line(-this.w / 3, -this.h / 4, this.w / 3, -this.h / 4);
        this.p.line(-this.w / 3, -this.h / 4 + 10, 0, -this.h / 4 + 10);

        this.p.pop();
      }
    }

    const sketch = (p: any) => {
      p.setup = function () {
        const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
        canvas.parent("p5-container");
        gravity = p.createVector(0, 0.15);

        for (let i = 0; i < 25; i++) {
          pieces.push(new PaperPiece(p));
        }

        p.rectMode(p.CENTER);
      };

      p.draw = function () {
        p.clear();

        let scrollY = window.scrollY;
        let gravY = p.map(p.sin(scrollY * 0.01), -1, 1, 0.05, 0.5);
        gravity.y = gravY;

        wind = p.createVector(
          (p.mouseX - p.pmouseX) * 0.05,
          (p.mouseY - p.pmouseY) * 0.05
        );

        for (let piece of pieces) {
          piece.applyForce(gravity);
          if (p.mouseIsPressed || p.abs(p.mouseX - p.pmouseX) > 1) {
            piece.reactToMouse(p.mouseX, p.mouseY);
          }
          piece.applyForce(wind);
          piece.update();
          piece.edges();
          piece.display();
        }
      };

      p.mousePressed = function () {
        for (let piece of pieces) {
          let d = p.dist(p.mouseX, p.mouseY, piece.pos.x, piece.pos.y);
          if (d < 300) {
            let force = p5.Vector.sub(piece.pos, p.createVector(p.mouseX, p.mouseY));
            force.normalize();
            force.mult(15);
            piece.applyForce(force);
          }
        }

        if (pieces.length < 50) {
          pieces.push(new PaperPiece(p, p.mouseX, p.mouseY));
        }
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

      {/* Content Section */}
      <div className="relative z-10 pt-32 pb-96">
        <div className="container">
          <h1 className="text-6xl md:text-8xl font-bold mb-12 text-text-main">
            作品集
          </h1>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-32 max-w-md">
            <div className="stat-box">
              <p className="text-xs opacity-50 mb-2">拼贴引擎</p>
              <p className="font-mono font-bold">运行中</p>
            </div>
            <div className="stat-box">
              <p className="text-xs opacity-50 mb-2">重力</p>
              <p className="font-mono font-bold">9.81 m/s²</p>
            </div>
          </div>

          {/* Bio Section */}
          <div className="max-w-2xl mb-32">
            <p className="text-2xl leading-relaxed">
              <strong>Fezer</strong> — AI 爱好者，研究生在读。{" "}
              <strong>作品集</strong> 记录了我在人工智能应用与创意技术探索中的实践。
            </p>
          </div>

          {/* Works Grid */}
          <div className="max-w-4xl">
            <h2 className="text-3xl font-bold mb-8 text-text-main">精选作品</h2>
            
            {works.length === 0 ? (
              <div className="stat-box p-6 text-text-secondary font-mono text-sm">
                内容待补充
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {works.map((work) => (
                  <div
                    key={work.slug}
                    className="stat-box p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  >
                    <h3 className="text-xl font-bold mb-3 text-text-main">
                      {work.title}
                    </h3>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {work.description || "内容待补充"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
