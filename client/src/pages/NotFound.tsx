import { Link } from "wouter";
import notFoundHtml from "../../../mylogo/404.html?raw";

export default function NotFound() {
  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#e8e8e6]">
      <iframe title="404 - VOID GESTURE" srcDoc={notFoundHtml} className="block h-full w-full border-0" />

      <div className="pointer-events-none fixed left-4 top-4 z-[101] flex flex-wrap gap-2">
        <Link
          href="/"
          className="pointer-events-auto rounded-full border border-black/30 bg-white/75 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-black/75 shadow-sm backdrop-blur transition-colors hover:bg-black hover:text-white"
        >
          ← Home
        </Link>
        <Link
          href="/about"
          className="pointer-events-auto rounded-full border border-black/30 bg-white/75 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-black/75 shadow-sm backdrop-blur transition-colors hover:bg-black hover:text-white"
        >
          About
        </Link>
      </div>
    </div>
  );
}
