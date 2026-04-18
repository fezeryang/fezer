import { Canvas } from "@react-three/fiber";
import { CameraController } from "./CameraController";
import { ModelInstance, Room } from "./Room";
import { Character, preloadCharacters } from "./Character";
import { Html } from "@react-three/drei";
import {
  CORRIDOR_MODULES,
  ROOMS,
  STRUCTURE_MODULES,
} from "./assets/roomsConfig";
import { CHARACTERS } from "./assets/characterConfig";
import { Fragment, Suspense, useEffect } from "react";

type SceneProps = {
  activeRoomId: string;
  onRoomSelect: (roomId: string) => void;
};

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="gray" />
    </mesh>
  );
}

export function Scene({ activeRoomId, onRoomSelect }: SceneProps) {
  // 预加载角色模型
  useEffect(() => {
    preloadCharacters();
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 10, 14], fov: 55 }}
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      {/* 光照 */}
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#f5fbff", "#7f8fa1", 0.35]} />
      <directionalLight position={[18, 24, 12]} intensity={1.1} castShadow />
      <pointLight position={[-12, 10, -18]} intensity={0.28} />

      {/* 相机控制 */}
      <CameraController activeRoomId={activeRoomId} />

      {/* 房间与结构模块 */}
      <Suspense fallback={<LoadingFallback />}>
        {Object.values(ROOMS).map(roomConfig => (
          <Fragment key={roomConfig.id}>
            <Room config={roomConfig} onClick={onRoomSelect} />
            <Html
              position={[roomConfig.position[0], 3.4, roomConfig.position[2]]}
              center
            >
              <button
                type="button"
                onClick={() => onRoomSelect(roomConfig.id)}
                className={`min-w-[108px] rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.12em] shadow-lg backdrop-blur transition ${
                  activeRoomId === roomConfig.id
                    ? "border-white/90 bg-slate-950 text-white"
                    : "border-slate-900/15 bg-white/78 text-slate-800 hover:bg-white"
                }`}
              >
                {roomConfig.name}
              </button>
            </Html>
          </Fragment>
        ))}

        {CORRIDOR_MODULES.map(moduleConfig => (
          <ModelInstance key={moduleConfig.id} config={moduleConfig} />
        ))}

        {STRUCTURE_MODULES.map(moduleConfig => (
          <ModelInstance key={moduleConfig.id} config={moduleConfig} />
        ))}

        {/* Fezer 角色群 - 分布在 Central Hub */}
        {CHARACTERS.map(characterConfig => (
          <Character key={characterConfig.id} config={characterConfig} />
        ))}
      </Suspense>

      {/* 地面 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.42, -10]}
        receiveShadow
      >
        <planeGeometry args={[130, 118]} />
        <meshStandardMaterial
          color="#74879c"
          roughness={0.92}
          metalness={0.06}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.44, -10]}>
        <planeGeometry args={[146, 134]} />
        <meshStandardMaterial color="#d4deea" roughness={1} metalness={0} />
      </mesh>
    </Canvas>
  );
}
