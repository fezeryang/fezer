import { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";
import DampedScrollView from "@/components/DampedScrollView";
import { getDefaultProfile } from "@/content/loaders";

declare global {
  interface Window {
    p5: any;
  }
}

export default function About() {
  const p5InstanceRef = useRef<any>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bubbleMenuRef = useRef<HTMLDivElement>(null);
  const [isBubbleOpen, setIsBubbleOpen] = useState(false);
  const profile = getDefaultProfile();

  const scrollToSection = (sectionId: string) => {
    setIsBubbleOpen(false);
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !window.p5) return;

    const p5 = window.p5 as any;
    let prisms: any[] = [];
    let hasWebGL = false;

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
        let canvas;
        try {
          canvas = p.createCanvas(
            window.innerWidth,
            window.innerHeight,
            p.WEBGL
          );
        } catch (error) {
          console.warn("About WebGL unavailable; skipping p5 canvas.", error);
          p.noLoop();
          return;
        }
        canvas.parent("p5-container");
        hasWebGL = Boolean(p._renderer?.isP3D);
        if (!hasWebGL) {
          console.warn("About WebGL unavailable; skipping p5 canvas.");
          p.noLoop();
          return;
        }

        for (let i = 0; i < 8; i++) {
          prisms.push(new Prism(p));
        }
      };

      p.draw = function () {
        if (!hasWebGL) {
          p.clear();
          return;
        }

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

        prisms.forEach(prism => {
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

  useEffect(() => {
    if (!isBubbleOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const clickedTrigger = triggerRef.current?.contains(target);
      const clickedMenu = bubbleMenuRef.current?.contains(target);

      if (!clickedTrigger && !clickedMenu) {
        setIsBubbleOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsBubbleOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isBubbleOpen]);

  return (
    <div className="w-full min-h-screen bg-sand-base overflow-x-hidden font-huiwen-zhengkai">
      <div id="p5-container" className="fixed inset-0 w-full h-screen" />
      <Navigation />
      <GrainOverlay />
      <CustomCursor />

      <DampedScrollView>
        {/* Content Wrapper */}
        <div className="relative z-10 grid grid-cols-12 gap-6 min-h-screen p-12">
          {/* Left Navigation - narrow */}
          <div className="col-span-1 flex flex-col justify-between border-l border-text-main border-opacity-10 pl-4">
            <div className="writing-mode-vertical text-xs font-bold tracking-widest text-text-main opacity-60 space-y-8">
              <span>归档 — 2024</span>
              <span>叙事</span>
              <span>探索</span>
            </div>
          </div>

          {/* Main Content - wider */}
          <main className="col-span-9 pt-24 px-8">
            <header className="mb-32">
              <div className="relative mb-8 inline-flex flex-col">
                <div
                  ref={bubbleMenuRef}
                  className={`absolute -top-4 left-1/2 z-30 w-[280px] -translate-x-1/2 -translate-y-full border border-black bg-[#d1d5db] p-1 shadow-[inset_1px_1px_0px_#ffffff,inset_-1px_-1px_0px_#8e949e,10px_10px_0px_rgba(0,0,0,0.2)] transition-all duration-300 [transform-style:preserve-3d] ${
                    isBubbleOpen
                      ? "visible translate-y-0 opacity-100"
                      : "invisible translate-y-4 opacity-0"
                  }`}
                  role="menu"
                  aria-label="FEZER bubble menu"
                >
                  <div className="mb-1 flex items-center justify-between bg-gradient-to-r from-[#000080] to-[#1084d0] px-2 py-1 font-mono text-[11px] text-white">
                    <span>ABOUT_MENU.EXE</span>
                    <div className="flex gap-0.5">
                      <span className="flex h-3.5 w-3.5 items-center justify-center border border-black bg-[#d1d5db] text-[9px] text-black shadow-[inset_1px_1px_0px_#fff]">
                        _
                      </span>
                      <span className="flex h-3.5 w-3.5 items-center justify-center border border-black bg-[#d1d5db] text-[9px] text-black shadow-[inset_1px_1px_0px_#fff]">
                        ×
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => scrollToSection("about-intro")}
                      className="group flex items-center gap-3 border border-transparent px-3 py-2.5 text-[13px] font-medium transition-all hover:border-dotted hover:border-white hover:bg-[#0046ff] hover:text-white"
                    >
                      <span className="h-4 w-4 shrink-0 bg-white shadow-[inset_1px_1px_#888,inset_-1px_-1px_#eee] transition-colors group-hover:bg-[#a3e635]" />
                      <span className="uppercase">intro</span>
                      <span className="ml-auto font-mono text-[10px] opacity-70">
                        F1
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => scrollToSection("about-projects")}
                      className="group flex items-center gap-3 border border-transparent px-3 py-2.5 text-[13px] font-medium transition-all hover:border-dotted hover:border-white hover:bg-[#0046ff] hover:text-white"
                    >
                      <span className="h-4 w-4 shrink-0 bg-white shadow-[inset_1px_1px_#888,inset_-1px_-1px_#eee] transition-colors group-hover:bg-[#a3e635]" />
                      <span className="uppercase">projects</span>
                      <span className="ml-auto font-mono text-[10px] opacity-70">
                        F5
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => scrollToSection("about-contact")}
                      className="group flex items-center gap-3 border border-transparent px-3 py-2.5 text-[13px] font-medium transition-all hover:border-dotted hover:border-white hover:bg-[#0046ff] hover:text-white"
                    >
                      <span className="h-4 w-4 shrink-0 bg-white shadow-[inset_1px_1px_#888,inset_-1px_-1px_#eee] transition-colors group-hover:bg-[#a3e635]" />
                      <span className="uppercase">contact</span>
                      <span className="ml-auto font-mono text-[10px] opacity-70">
                        CTRL+C
                      </span>
                    </button>

                    <div className="mx-1 my-0.5 h-px bg-[#888] shadow-[0_1px_0_#fff]" />

                    <Link
                      href="/jianli"
                      role="menuitem"
                      onClick={() => setIsBubbleOpen(false)}
                      className="group flex items-center gap-3 border border-transparent px-3 py-2.5 text-[13px] font-medium transition-all hover:border-dotted hover:border-white hover:bg-[#0046ff] hover:text-white"
                    >
                      <span className="h-4 w-4 shrink-0 bg-white shadow-[inset_1px_1px_#888,inset_-1px_-1px_#eee] transition-colors group-hover:bg-[#a3e635]" />
                      <span className="uppercase">3D简历</span>
                      <span className="ml-auto font-mono text-[10px] opacity-70">
                        F3
                      </span>
                    </Link>

                    <Link
                      href="/lab/logo"
                      role="menuitem"
                      onClick={() => setIsBubbleOpen(false)}
                      className="group flex items-center gap-3 border border-transparent px-3 py-2.5 text-[13px] font-medium transition-all hover:border-dotted hover:border-white hover:bg-[#0046ff] hover:text-white"
                    >
                      <span className="h-4 w-4 shrink-0 bg-white shadow-[inset_1px_1px_#888,inset_-1px_-1px_#eee] transition-colors group-hover:bg-[#a3e635]" />
                      <span className="uppercase">logo</span>
                      <span className="ml-auto font-mono text-[10px] opacity-70">
                        ENTER
                      </span>
                    </Link>
                  </div>

                  <div className="absolute -bottom-[15px] left-1/2 h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[15px] border-l-transparent border-r-transparent border-t-black" />
                </div>

                <button
                  ref={triggerRef}
                  onClick={() => setIsBubbleOpen(current => !current)}
                  className="cursor-pointer border-none bg-[#d1d5db] px-10 py-4 text-left text-6xl font-extrabold uppercase leading-tight tracking-[0.2rem] text-[#374151] shadow-[inset_3px_3px_0px_#ffffff,inset_-3px_-3px_0px_#8e949e,6px_6px_15px_rgba(0,0,0,0.4)] transition-transform duration-100 [clip-path:polygon(10%_0,100%_0,90%_100%,0_100%)] md:text-7xl"
                  aria-expanded={isBubbleOpen}
                  aria-haspopup="menu"
                >
                  {profile?.name ?? "FEZER"}
                </button>
              </div>
              <p className="text-lg text-text-main opacity-70 max-w-md">
                {profile?.bio ?? "待补充"}
              </p>
            </header>

            {/* Profile Sections */}
            <section className="space-y-16">
              <article id="about-intro" className="grid grid-cols-2 gap-10">
                <div className="text-sm font-mono text-text-main opacity-60">
                  简介
                </div>
                <div className="text-lg text-text-main opacity-70">
                  {profile?.body ? (
                    <div
                      className="prose max-w-none text-inherit"
                      dangerouslySetInnerHTML={{
                        __html: marked.parse(profile.body) as string,
                      }}
                    />
                  ) : (
                    "待补充"
                  )}
                </div>
              </article>

              {/* Skills Section */}
              <article id="about-skills" className="grid grid-cols-2 gap-10">
                <div className="text-sm font-mono text-text-main opacity-60">
                  技能与兴趣
                </div>
                <div>
                  <span className="text-xs font-bold tracking-widest text-text-main opacity-50 block mb-3">
                    技能与兴趣
                  </span>
                  {profile?.skills && profile.skills.length > 0 ? (
                    <ul className="space-y-2">
                      {profile.skills.map((skill, idx) => (
                        <li
                          key={idx}
                          className="text-lg text-text-main opacity-70"
                        >
                          • {skill}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-lg text-text-main opacity-50">待补充</p>
                  )}
                </div>
              </article>

              {/* Projects Section */}
              <article id="about-projects" className="grid grid-cols-2 gap-10">
                <div className="text-sm font-mono text-text-main opacity-60">
                  项目
                </div>
                <div>
                  <span className="text-xs font-bold tracking-widest text-text-main opacity-50 block mb-3">
                    项目
                  </span>
                  {profile?.projects && profile.projects.length > 0 ? (
                    <ul className="space-y-2">
                      {profile.projects.map((project, idx) => (
                        <li
                          key={idx}
                          className="text-lg text-text-main opacity-70"
                        >
                          <a
                            href={project.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:opacity-100 transition-opacity"
                          >
                            {project.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-lg text-text-main opacity-50">待补充</p>
                  )}
                </div>
              </article>

              {/* Contact Section */}
              <article id="about-contact" className="grid grid-cols-2 gap-10">
                <div className="text-sm font-mono text-text-main opacity-60">
                  联系方式
                </div>
                <div>
                  <span className="text-xs font-bold tracking-widest text-text-main opacity-50 block mb-3">
                    联系方式
                  </span>
                  {profile?.contact &&
                  Object.keys(profile.contact).length > 0 ? (
                    <ul className="space-y-2">
                      {Object.entries(profile.contact).map(
                        ([platform, link]) => (
                          <li
                            key={platform}
                            className="text-lg text-text-main opacity-70"
                          >
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:opacity-100 transition-opacity"
                            >
                              {platform}
                            </a>
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="text-lg text-text-main opacity-50">待补充</p>
                  )}
                </div>
              </article>
            </section>
          </main>

          {/* Right Info Panel - narrow */}
          <aside className="col-span-2 flex flex-col justify-end border-l border-text-main border-opacity-10 pl-3">
            <div className="glass-card p-4">
              <div className="space-y-2 text-[10px] font-mono text-text-main opacity-70 mb-3">
                <div className="flex justify-between pb-1 border-b border-text-main border-opacity-10">
                  <span>姓名</span>
                  <span className="truncate ml-1">{profile?.name ?? "—"}</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-text-main border-opacity-10">
                  <span>地区</span>
                  <span className="truncate ml-1">
                    {profile?.locale ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between pb-1 border-b border-text-main border-opacity-10">
                  <span>技能</span>
                  <span>{profile?.skills.length ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>项目</span>
                  <span>{profile?.projects.length ?? 0}</span>
                </div>
              </div>
              <p className="text-[10px] leading-tight text-text-main opacity-50">
                数字桌面 · 思考碎片 · 实验场
              </p>
            </div>
          </aside>
        </div>
      </DampedScrollView>
    </div>
  );
}
