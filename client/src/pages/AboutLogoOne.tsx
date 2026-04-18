import { Link } from "wouter";
import logo1Html from "../../../mylogo/logo1.html?raw";

export default function AboutLogoOne() {
  return (
    <div className="fixed inset-0 z-[10000] h-screen w-screen overflow-hidden bg-white">
      <iframe
        title="Logo 01 - Strict Reference"
        srcDoc={logo1Html}
        className="block h-full w-full border-0"
      />

      <div className="pointer-events-none fixed left-4 top-4 z-[10001] flex flex-wrap gap-2">
        <Link
          href="/about/logo"
          className="pointer-events-auto rounded-full border border-black/25 bg-white/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-black/75 shadow-sm backdrop-blur transition-colors hover:bg-black hover:text-white"
        >
          ← Back to Hub
        </Link>

        <Link
          href="/about/logo/logo2"
          className="pointer-events-auto rounded-full border border-black/25 bg-white/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-black/75 shadow-sm backdrop-blur transition-colors hover:bg-black hover:text-white"
        >
          Go Logo2
        </Link>

        <Link
          href="/about"
          className="pointer-events-auto rounded-full border border-black/25 bg-white/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-black/75 shadow-sm backdrop-blur transition-colors hover:bg-black hover:text-white"
        >
          About
        </Link>
      </div>
    </div>
  );
}
