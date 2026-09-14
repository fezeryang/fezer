import { CameraControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/useMobile";
import { ROOMS } from "./assets/roomsConfig";

type CameraControllerProps = {
  activeRoomId?: string;
  /** 递增一次即回到当前房间视角（重置视角按钮） */
  resetToken?: number;
};

export function CameraController({
  activeRoomId,
  resetToken,
}: CameraControllerProps) {
  const controlsRef = useRef<CameraControls>(null);
  const isMobile = useIsMobile();

  // 唯一视角来源：房间切换与重置都走这里。
  // 挂载时 activeRoomId 已是初始房间，不再需要单独的初始视角 effect。
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
  }, [activeRoomId, resetToken]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minPolarAngle={Math.PI / 10}
      maxPolarAngle={Math.PI / 2.05}
      // 移动端视口小，收紧镜头范围避免迷路
      minDistance={isMobile ? 9 : 6}
      maxDistance={isMobile ? 34 : 45}
      smoothTime={0.5}
    />
  );
}
