import { CameraControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { ROOMS } from "./assets/roomsConfig";

type CameraControllerProps = {
  activeRoomId?: string;
};

export function CameraController({ activeRoomId }: CameraControllerProps) {
  const controlsRef = useRef<CameraControls>(null);

  useEffect(() => {
    // 初始视角：更贴近地图，俯视中央大厅
    controlsRef.current?.setLookAt(0, 10, 14, 0, 0, -8, true);
  }, []);

  useEffect(() => {
    if (!activeRoomId) {
      return;
    }

    const room = ROOMS[activeRoomId];
    if (!room) {
      return;
    }

    const [x, y, z] = room.position;
    controlsRef.current?.setLookAt(x, y + 8, z + 10, x, y + 1.6, z, true);
  }, [activeRoomId]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minPolarAngle={Math.PI / 10}
      maxPolarAngle={Math.PI / 2.05}
      minDistance={6}
      maxDistance={45}
      smoothTime={0.5}
    />
  );
}
