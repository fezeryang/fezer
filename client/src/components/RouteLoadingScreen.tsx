import Lottie from "lottie-react";
import loadingAnimation from "../../../thecat/cat Mark loading.json";

type RouteLoadingScreenProps = {
  title?: string;
  subtitle?: string;
};

export default function RouteLoadingScreen({
  title = "Loading...",
  subtitle = "Please wait while we prepare the experience.",
}: RouteLoadingScreenProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f4ef] px-6">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.9),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(0,0,0,0.05),transparent_38%)]" />

      <div className="relative z-10 flex max-w-md flex-col items-center rounded-3xl border border-black/10 bg-white/70 px-10 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-sm">
        <div className="h-40 w-40">
          <Lottie animationData={loadingAnimation} loop autoplay style={{ width: "100%", height: "100%" }} />
        </div>

        <p className="mt-2 font-mono text-xs uppercase tracking-[0.24em] text-black/45">Kinetic Portfolio</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-black/80">{title}</h2>
        <p className="mt-2 text-center text-sm text-black/60">{subtitle}</p>
      </div>
    </div>
  );
}
