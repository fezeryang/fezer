import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";
import DampedScrollView from "@/components/DampedScrollView";

export default function NotFound() {
  return (
    <div className="w-full min-h-screen bg-sand-base">
      <Navigation />
      <GrainOverlay />
      <CustomCursor />

      <DampedScrollView>
        <div className="flex min-h-screen w-full flex-col items-center justify-center">
          <h1 className="text-9xl font-bold text-text-main mb-4">404</h1>
          <p className="text-2xl text-text-main opacity-70 mb-8">Page Not Found</p>
          <Link href="/">
            <a className="pill-btn">RETURN HOME</a>
          </Link>
        </div>
      </DampedScrollView>
    </div>
  );
}
