import Navigation from "@/components/Navigation";
import GrainOverlay from "@/components/GrainOverlay";
import CustomCursor from "@/components/CustomCursor";
import ReverseScrollColumns from "@/components/ReverseScrollColumns";
import { xizangPhotos } from "@/data/xizang-photos";

export default function Xizang() {
  return (
    <div className="w-full min-h-screen bg-sand-base overflow-x-hidden">
      <Navigation />
      <GrainOverlay />
      <CustomCursor />

      {/* Page Header */}
      <div className="relative z-10 pt-32 pb-16">
        <div className="container">
          <h1 className="text-6xl md:text-8xl font-bold mb-4 text-text-main">
            西藏之旅
          </h1>
          <p className="text-xl text-text-secondary">
            Tibet Travel Diary
          </p>
        </div>
      </div>

      {/* Reverse Scroll Columns */}
      <ReverseScrollColumns photos={xizangPhotos} />
    </div>
  );
}
