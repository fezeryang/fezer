export type FezerType =
  | "core"
  | "builder"
  | "ai"
  | "writer"
  | "reader"
  | "visual"
  | "wanderer"

export type Vec3 = [number, number, number]

export interface TransformConfig {
  id: string
  model: string
  position: Vec3
  rotation?: Vec3
  scale?: Vec3
}

export interface RoomConfig extends TransformConfig {
  name: string
  description: string
  fezerType: FezerType
  accent: string
  summary: string
  highlights: string[]
}

export interface SceneModuleConfig extends TransformConfig {
  kind: "corridor" | "structure"
}

export interface ModelInstanceProps {
  config: TransformConfig
  onClick?: (id: string) => void
}

export interface RoomProps {
  config: RoomConfig
  onClick?: (roomId: string) => void
}
