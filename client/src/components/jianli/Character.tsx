import { useGLTF } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useRef, useState } from "react"
import type { CharacterProps, CharacterState, Vec3 } from "./assets/types"
import { CHARACTER_MODELS } from "./assets/characterConfig"

// Vite base path 用于纹理资源路径修正
const BASE_URL = import.meta.env.BASE_URL ?? "/"

// 角色地面Y坐标（根据模型调整）
const GROUND_Y = 0

// 辅助函数：在圆内生成随机点
function randomPointInCircle(center: Vec3, radius: number): Vec3 {
  const angle = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random()) * radius
  return [
    center[0] + Math.cos(angle) * r,
    center[1],
    center[2] + Math.sin(angle) * r,
  ]
}

// 辅助函数：计算两点距离
function distance(a: Vec3, b: Vec3): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2)
}

// 辅助函数：两点向量
function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function Character({ config, onClick }: CharacterProps) {
  const groupRef = useRef<any>(null)
  const { scene } = useGLTF(config.model, undefined, undefined, {
    resourcePath: `${BASE_URL}models/`,
  })

  // 状态机：idle | walking | waiting
  const [state, setState] = useState<CharacterState>("idle")
  const [target, setTarget] = useState<Vec3>(config.position)
  const [waitEndTime, setWaitEndTime] = useState<number>(0)

  // 当前位置（可变引用）
  const currentPosition = useRef<Vec3>([...config.position])
  const currentRotation = useRef<number>(0)

  // 游走逻辑
  useFrame(({ clock }) => {
    if (!groupRef.current) return

    const now = clock.elapsedTime * 1000 // 转换为毫秒

    if (state === "idle") {
      // 选择新的随机目标点
      const newTarget = randomPointInCircle(config.position, config.patrolRadius ?? 1.5)
      setTarget(newTarget)
      setState("walking")
    } else if (state === "walking") {
      // 移动向目标
      const speed = config.walkSpeed ?? 0.3
      const delta = 0.016 // 约60fps的delta

      const dir = subtract(target, currentPosition.current)
      const dist = distance(currentPosition.current, target)

      if (dist < 0.1) {
        // 到达目标，开始等待
        setState("waiting")
        setWaitEndTime(now + (config.waitTime ?? 1500))
      } else {
        // 移动
        const moveDist = Math.min(dist, speed * delta)
        const normDir: Vec3 = [dir[0] / dist, 0, dir[2] / dist]
        currentPosition.current = [
          currentPosition.current[0] + normDir[0] * moveDist,
          GROUND_Y,
          currentPosition.current[2] + normDir[2] * moveDist,
        ]

        // 更新朝向（面向移动方向）
        currentRotation.current = Math.atan2(normDir[0], normDir[2])
      }

      // 应用位置和旋转
      groupRef.current.position.set(
        currentPosition.current[0],
        currentPosition.current[1],
        currentPosition.current[2]
      )
      groupRef.current.rotation.y = currentRotation.current
    } else if (state === "waiting") {
      // 等待结束后进入idle状态
      if (now >= waitEndTime) {
        setState("idle")
      }
    }
  })

  return (
    <group
      ref={groupRef}
      position={config.position}
      scale={config.scale || [0.3, 0.3, 0.3]}
      onClick={() => onClick?.(config.id)}
    >
      <primitive object={scene.clone()} />
    </group>
  )
}

// 预加载所有角色模型
export function preloadCharacters() {
  CHARACTER_MODELS.forEach(model => useGLTF.preload(model))
}
