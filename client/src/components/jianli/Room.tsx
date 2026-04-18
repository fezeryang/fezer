import { useGLTF } from "@react-three/drei"
import { useEffect, useRef } from "react"
import { MAP_PRELOAD_MODELS } from "./assets/modelPaths"
import type { ModelInstanceProps, RoomProps } from "./assets/types"

export function ModelInstance({ config, onClick }: ModelInstanceProps) {
  const groupRef = useRef<any>(null)
  const { scene } = useGLTF(config.model)

  useEffect(() => {
    if (groupRef.current) {
      // 克隆 scene 以避免多个房间共享同一个对象
      groupRef.current.clear()
      groupRef.current.add(scene.clone())
    }
  }, [scene])

  return (
    <group
      ref={groupRef}
      position={config.position}
      rotation={config.rotation || [0, 0, 0]}
      scale={config.scale || [1, 1, 1]}
      onClick={() => onClick?.(config.id)}
    />
  )
}

export function Room({ config, onClick }: RoomProps) {
  return <ModelInstance config={config} onClick={onClick} />
}

// 预加载地图常用模型
MAP_PRELOAD_MODELS.forEach((modelPath) => {
  useGLTF.preload(modelPath)
})
