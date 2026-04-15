import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export interface PhotoItem {
  url: string;
  caption: string;
}

interface ReverseScrollColumnsProps {
  photos: PhotoItem[];
  columns?: number;
  imageWidth?: string;
  aspectRatio?: string;
  gap?: string;
}

interface ColumnProps {
  photos: PhotoItem[];
  reverse: boolean;
  imageWidth: string;
  aspectRatio: string;
  gap: string;
}

function Column({
  photos,
  reverse,
  imageWidth,
  aspectRatio,
  gap,
}: ColumnProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reverse ? ["0%", "-50%"] : ["0%", "50%"]
  );

  return (
    <div
      ref={ref}
      className="relative flex-shrink-0"
      style={{ width: imageWidth }}
    >
      <motion.div style={{ y, gap }} className="flex flex-col">
        {photos.map((photo, index) => (
          <figure
            key={`${photo.url}-${index}`}
            className="relative overflow-hidden group"
            style={{ aspectRatio }}
          >
            <img
              src={photo.url}
              alt={photo.caption}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <figcaption className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <p className="text-white text-sm font-medium">{photo.caption}</p>
            </figcaption>
          </figure>
        ))}
      </motion.div>
    </div>
  );
}

export default function ReverseScrollColumns({
  photos,
  columns = 3,
  imageWidth = "25vw",
  aspectRatio = "6/7",
  gap = "2rem",
}: ReverseScrollColumnsProps) {
  // Distribute photos across columns
  const columnPhotos: PhotoItem[][] = Array.from({ length: columns }, () => []);

  photos.forEach((photo, index) => {
    const columnIndex = index % columns;
    columnPhotos[columnIndex].push(photo);
  });

  return (
    <div className="relative z-10 py-16">
      <div className="flex justify-center gap-8 overflow-hidden">
        {columnPhotos.map((photos, index) => (
          <Column
            key={index}
            photos={photos}
            reverse={index % 2 === 1}
            imageWidth={imageWidth}
            aspectRatio={aspectRatio}
            gap={gap}
          />
        ))}
      </div>
    </div>
  );
}
