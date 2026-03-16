import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";

export default function NotFound() {
  return (
    <div className="w-full h-screen bg-sand-base flex flex-col items-center justify-center">
      <Navigation />
      <GrainOverlay />
      <CustomCursor />
      
      <h1 className="text-9xl font-bold text-text-main mb-4">404</h1>
      <p className="text-2xl text-text-main opacity-70 mb-8">Page Not Found</p>
      <Link href="/">
        <a className="pill-btn">RETURN HOME</a>
      </Link>
    </div>
  );
}
