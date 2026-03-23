import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";

const LOGO_ENTRIES = [
  {
    key: "logo1",
    title: "Logo 01 · Tactile Terrestrial Assemblage",
    description: "参考 mylogo/logo1.html：纸感底色 + 生物粒子逐步汇聚 FEZER 字形。",
    href: "/about/logo/logo1",
    tag: "logo1.html",
  },
  {
    key: "logo2",
    title: "Logo 02 · Biotic Choreography",
    description: "参考 mylogo/logo2.html：游走到成形的双阶段编舞，点击可重播。",
    href: "/about/logo/logo2",
    tag: "logo2.html",
  },
];

export default function AboutLogo() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#f7f5f1] text-[#1f1f1f]">
      <Navigation />
      <GrainOverlay />
      <CustomCursor />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.9),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(0,70,255,0.08),transparent_45%)]" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-16 pt-28 md:px-10">
        <header className="mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-black/45">
            FEZER / Logo Index
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] md:text-6xl">
            Logo 子页面集合
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-black/60 md:text-base">
            这里是 `/about/logo` 的父页面。下面每个卡片都是一个独立的 logo 子页面，满足“logo
            会存在多个页面”的结构。
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {LOGO_ENTRIES.map((entry) => (
            <Link key={entry.key} href={entry.href}>
              <a className="group rounded-2xl border border-black/10 bg-white/80 p-6 shadow-[0_20px_45px_rgba(0,0,0,0.06)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-black/25 hover:shadow-[0_28px_55px_rgba(0,0,0,0.12)]">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/45">
                  {entry.tag}
                </p>
                <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-black/85">
                  {entry.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-black/60">{entry.description}</p>
                <p className="mt-6 font-mono text-xs uppercase tracking-[0.16em] text-black/60 transition-colors group-hover:text-[#0046ff]">
                  Open Variant ↗
                </p>
              </a>
            </Link>
          ))}
        </section>

        <div className="mt-auto flex flex-wrap gap-3 pt-10">
          <Link href="/about">
            <a className="rounded-md border border-black/20 bg-white/70 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] text-black/70 transition-colors hover:bg-black hover:text-white">
              Back to About
            </a>
          </Link>
        </div>
      </main>
    </div>
  );
}
