import { useCursor, useGLTF } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { MAP_PRELOAD_MODELS } from "./assets/modelPaths";
import type { ModelInstanceProps, RoomProps } from "./assets/types";

// Vite base path 用于纹理资源路径修正
const BASE_URL = import.meta.env.BASE_URL ?? "/";
const MODEL_RESOURCE_PATH = `${BASE_URL}models/`;

function configureModelLoader(loader: any) {
  // GitHub Pages 部署在子路径时，需要显式告诉 GLTFLoader 贴图所在目录。
  loader.setResourcePath(MODEL_RESOURCE_PATH);
}

export function ModelInstance({
  config,
  onClick,
  onHoverChange,
}: ModelInstanceProps) {
  const groupRef = useRef<any>(null);
  const { scene } = useGLTF(
    config.model,
    undefined,
    undefined,
    configureModelLoader
  );

  useEffect(() => {
    if (groupRef.current) {
      // 克隆 scene 以避免多个房间共享同一个对象
      groupRef.current.clear();
      groupRef.current.add(scene.clone());
    }
  }, [scene]);

  return (
    <group
      ref={groupRef}
      position={config.position}
      rotation={config.rotation || [0, 0, 0]}
      scale={config.scale || [1, 1, 1]}
      onPointerOver={event => {
        // 停止冒泡：悬停在房间上时，不触发后方角色的交互
        event.stopPropagation();
        onHoverChange?.(true);
      }}
      onPointerOut={() => onHoverChange?.(false)}
      onClick={event => {
        // 点击命中优先级：房间 > 后方角色
        event.stopPropagation();
        onClick?.(config.id);
      }}
    />
  );
}

export function Room({ config, onClick }: RoomProps) {
  const [hovered, setHovered] = useState(false);
  // 悬停房间时把光标切为手型，告诉访客这里可交互
  useCursor(hovered);

  return (
    <ModelInstance
      config={config}
      onClick={onClick}
      onHoverChange={setHovered}
    />
  );
}

// 预加载地图常用模型
MAP_PRELOAD_MODELS.forEach(modelPath => {
  useGLTF.preload(modelPath, undefined, undefined, configureModelLoader);
});
