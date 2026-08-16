import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUpRight, Github, Mail, MapPin } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";
import DampedScrollView from "@/components/DampedScrollView";
import { getDefaultProfile } from "@/content/loaders";
import "./About.css";

declare global {
  interface Window {
    p5: any;
  }
}

type Prism = {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotation: number;
  phase: number;
  color: [number, number, number];
};

function AboutPrismCanvas() {
  const canvasHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.p5 || !canvasHostRef.current) {
      return;
    }

    const host = canvasHostRef.current;
    let hasWebGL = false;
    let prisms: Prism[] = [];

    const sketch = (p: any) => {
      const getCanvasSize = () => ({
        width: Math.max(window.innerWidth, 300),
        height: Math.max(window.innerHeight, 260),
      });

      p.setup = () => {
        const { width, height } = getCanvasSize();
        let canvas;

        try {
          canvas = p.createCanvas(width, height, p.WEBGL);
        } catch (error) {
          console.warn(
            "About WebGL unavailable; skipping prism canvas.",
            error
          );
          p.noLoop();
          return;
        }

        canvas.parent(host);
        canvas.style("display", "block");
        hasWebGL = Boolean(p._renderer?.isP3D);

        if (!hasWebGL) {
          console.warn("About WebGL unavailable; skipping prism canvas.");
          p.noLoop();
          return;
        }

        const scale = Math.min(width, height) / 720;
        prisms = [
          {
            x: -150 * scale,
            y: -20 * scale,
            z: -30 * scale,
            width: 210 * scale,
            height: 18 * scale,
            depth: 320 * scale,
            rotation: -0.2,
            phase: 0.2,
            color: [194, 211, 207],
          },
          {
            x: 105 * scale,
            y: 50 * scale,
            z: -80 * scale,
            width: 150 * scale,
            height: 16 * scale,
            depth: 250 * scale,
            rotation: 0.34,
            phase: 1.8,
            color: [211, 202, 225],
          },
          {
            x: 10 * scale,
            y: -120 * scale,
            z: 36 * scale,
            width: 240 * scale,
            height: 14 * scale,
            depth: 120 * scale,
            rotation: -0.08,
            phase: 3.2,
            color: [202, 216, 219],
          },
          {
            x: -40 * scale,
            y: 135 * scale,
            z: 55 * scale,
            width: 180 * scale,
            height: 12 * scale,
            depth: 92 * scale,
            rotation: 0.18,
            phase: 4.6,
            color: [221, 211, 228],
          },
        ];
        p.noStroke();
      };

      p.draw = () => {
        if (!hasWebGL) {
          return;
        }

        p.clear();
        p.ambientLight(220, 224, 230);
        p.directionalLight(255, 255, 255, -0.3, -0.5, -1);

        const maxScroll = Math.max(
          document.documentElement.scrollHeight - window.innerHeight,
          1
        );
        const targetScrollProgress = Math.min(
          Math.max(window.scrollY / maxScroll, 0),
          1
        );
        const scrollProgress =
          (p as any).__scrollProgress === undefined
            ? targetScrollProgress
            : p.lerp((p as any).__scrollProgress, targetScrollProgress, 0.08);
        (p as any).__scrollProgress = scrollProgress;

        const pointerX = (p.mouseX - p.width / 2) * 0.00018;
        const pointerY = (p.mouseY - p.height / 2) * 0.00012;
        const scrollTurn = scrollProgress * Math.PI * 0.72;
        const scrollLift = (scrollProgress - 0.5) * 180;

        p.push();
        p.translate(
          Math.sin(scrollProgress * Math.PI) * 42,
          scrollLift,
          Math.sin(scrollProgress * Math.PI * 2) * 80
        );
        p.rotateX(scrollProgress * 0.42 + pointerY);
        p.rotateY(scrollTurn + pointerX);
        p.rotateZ(Math.sin(scrollProgress * Math.PI) * 0.12);

        prisms.forEach((prism, index) => {
          p.push();
          const phase =
            prism.phase + scrollProgress * Math.PI * (index % 2 ? -0.8 : 0.55);
          p.translate(
            prism.x + Math.sin(phase) * scrollProgress * 34,
            prism.y + Math.cos(phase) * scrollProgress * 22,
            prism.z
          );
          p.rotateZ(
            prism.rotation + Math.sin(p.frameCount * 0.006 + phase) * 0.025
          );
          p.rotateY(Math.sin(scrollProgress * Math.PI + phase) * 0.16);
          p.stroke(...prism.color, 68);
          p.strokeWeight(0.75);
          p.fill(...prism.color, 15);
          p.box(prism.width, prism.height, prism.depth);
          p.pop();
        });

        p.pop();
      };

      p.windowResized = () => {
        const { width, height } = getCanvasSize();
        p.resizeCanvas(width, height);
      };
    };

    const instance = new window.p5(sketch);

    return () => {
      instance.remove();
    };
  }, []);

  return (
    <div
      ref={canvasHostRef}
      className="about-geometry-layer"
      data-testid="about-geometry"
      aria-hidden="true"
    />
  );
}

export default function About() {
  const profile = getDefaultProfile();

  return (
    <div className="about-page">
      <AboutPrismCanvas />
      <Navigation variant="editorial" />
      <GrainOverlay />
      <CustomCursor />

      <DampedScrollView>
        <main className="about-page__content">
          <section
            id="about-hero"
            data-testid="about-hero"
            className="about-section about-hero"
          >
            <div className="about-hero__archive" aria-label="Archive">
              <span>归档 — 2026</span>
              <span>数字探索者</span>
            </div>

            <div className="about-hero__copy about-reveal">
              <p className="about-section__eyebrow">01 / ABOUT</p>
              <h1>{profile?.name?.toUpperCase() ?? "FEZER"}</h1>
              <p className="about-hero__roles">
                AI Product <span>·</span> Agent <span>·</span> Human-AI Workflow
              </p>
              <p className="about-hero__intro">
                最近总在折腾 AI、Agent，还有那些不做出来就不肯消失的小想法。
              </p>
            </div>

            <div className="about-hero__footer">
              <span>Personal / Experimental / In progress</span>
              <span className="about-scroll-cue">
                SCROLL <ArrowDown size={14} strokeWidth={1.2} />
              </span>
            </div>
          </section>

          <section
            id="about-intro"
            data-testid="about-intro"
            className="about-section about-intro"
          >
            <div className="about-section__frame">
              <div className="about-section__index">
                <span>02 / ABOUT</span>
                <span className="about-section__index-line" />
              </div>

              <div className="about-intro__copy about-reveal">
                <h2>About Me</h2>
                <p className="about-intro__body">
                  我是 Fezer。最近大部分时间在和 AI、Agent
                  以及各种还没想明白的问题打交道。
                  比起只讨论它们能不能做，我更喜欢先做出来，再看看好不好用。有时候是产品，
                  有时候是小工具，有时候只是一个突然想试试的念头。
                </p>
                <p className="about-intro__education">
                  M.S. Candidate · Central University of Finance and Economics
                </p>
                <p className="about-intro__location">
                  <MapPin size={15} strokeWidth={1.4} /> Beijing, China
                </p>
                <Link className="about-text-link" href="/portfolio">
                  See what I&apos;m building <ArrowUpRight size={15} />
                </Link>
              </div>
            </div>
          </section>

          <section
            id="about-contact"
            data-testid="about-contact"
            className="about-section about-contact"
          >
            <div className="about-contact__frame">
              <div className="about-section__index">
                <span>03 / CONTACT</span>
                <span className="about-section__index-line" />
              </div>

              <div className="about-contact__copy about-reveal">
                <h2>Say Hi.</h2>
                <p>如果你最近也在做点有意思的事，欢迎来打个招呼。</p>

                <div className="about-contact__links">
                  <a
                    className="about-contact__link about-contact__link--wide"
                    href="mailto:cookfezer@gmail.com"
                    data-testid="about-email-link"
                  >
                    <Mail size={22} strokeWidth={1.25} />
                    <span>cookfezer@gmail.com</span>
                    <ArrowUpRight size={15} />
                  </a>
                  <a
                    className="about-contact__link"
                    href="https://github.com/fezeryang/fezer"
                    target="_blank"
                    rel="noreferrer"
                    data-testid="about-github-link"
                  >
                    <Github size={21} strokeWidth={1.25} />
                    <span>GitHub</span>
                    <ArrowUpRight size={15} />
                  </a>
                </div>
              </div>
            </div>

            <footer className="about-footer">
              <span>FEZER © 2026</span>
              <span>Beijing / Internet</span>
            </footer>
          </section>
        </main>
      </DampedScrollView>
    </div>
  );
}
