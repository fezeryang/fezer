import { useEffect, useRef } from "react";
import { marked } from "marked";
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
  const profile = getDefaultProfile();

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

      <DampedScrollView>
      {/* Content Wrapper */}
      <div className="relative z-10 grid grid-cols-3 gap-10 min-h-screen p-16">
        {/* Left Navigation */}
        <div className="flex flex-col justify-between border-l border-text-main border-opacity-10 pl-8">
          <div className="writing-mode-vertical text-xs font-bold tracking-widest text-text-main opacity-60 space-y-8">
            <span>归档索引 — 2024</span>
            <span>个人叙事</span>
            <span>技术探索</span>
          </div>
        </div>

        {/* Main Content */}
        <main className="col-span-1 pt-32">
          <header className="mb-32">
            <h1 className="text-6xl md:text-7xl font-bold mb-8 leading-tight">
              {profile?.name ?? "待补充"}
            </h1>
            <p className="text-lg text-text-main opacity-70 max-w-md">
              {profile?.bio ?? "待补充"}
            </p>
          </header>

          {/* Profile Sections */}
          <section className="space-y-16">
            <article className="grid grid-cols-2 gap-10">
              <div className="text-sm font-mono text-text-main opacity-60">
                简介
              </div>
              <div className="text-lg text-text-main opacity-70">
                {profile?.body ? (
                  <div 
                    className="prose max-w-none text-inherit"
                    dangerouslySetInnerHTML={{ __html: marked.parse(profile.body) as string }}
                  />
                ) : (
                  "待补充"
                )}
              </div>
            </article>

            {/* Skills Section */}
            <article className="grid grid-cols-2 gap-10">
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
                      <li key={idx} className="text-lg text-text-main opacity-70">
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
            <article className="grid grid-cols-2 gap-10">
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
                      <li key={idx} className="text-lg text-text-main opacity-70">
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
            <article className="grid grid-cols-2 gap-10">
              <div className="text-sm font-mono text-text-main opacity-60">
                联系方式
              </div>
              <div>
                <span className="text-xs font-bold tracking-widest text-text-main opacity-50 block mb-3">
                  联系方式
                </span>
                {profile?.contact && Object.keys(profile.contact).length > 0 ? (
                  <ul className="space-y-2">
                    {Object.entries(profile.contact).map(([platform, link]) => (
                      <li key={platform} className="text-lg text-text-main opacity-70">
                        <a 
                          href={link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:opacity-100 transition-opacity"
                        >
                          {platform}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-lg text-text-main opacity-50">待补充</p>
                )}
              </div>
            </article>
          </section>
        </main>

        {/* Right Info Panel */}
        <aside className="flex flex-col justify-end border-l border-text-main border-opacity-10 pl-8">
          <div className="glass-card p-8">
            <div className="space-y-4 text-xs font-mono text-text-main opacity-70 mb-6">
              <div className="flex justify-between pb-2 border-b border-text-main border-opacity-10">
                <span>姓名</span>
                <span>{profile?.name ?? "待补充"}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-text-main border-opacity-10">
                <span>地区</span>
                <span>{profile?.locale ?? "待补充"}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-text-main border-opacity-10">
                <span>技能</span>
                <span>{profile?.skills.length ?? 0} 项</span>
              </div>
              <div className="flex justify-between">
                <span>项目</span>
                <span>{profile?.projects.length ?? 0} 个</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-text-main opacity-60">
              个人简介与项目信息。缺失的内容将显示「待补充」标记。
            </p>
          </div>
        </aside>
      </div>
      </DampedScrollView>
    </div>
  );
}
