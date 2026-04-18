// Vite base path (支持 GitHub Pages 子路径部署)
const BASE = import.meta.env.BASE_URL ?? "/";

// 地图资源路径常量
export const MODEL_PATHS = {
  ROOM_LARGE: `${BASE}models/room-large.glb`,
  ROOM_LARGE_VARIATION: `${BASE}models/room-large-variation.glb`,
  ROOM_SMALL: `${BASE}models/room-small.glb`,
  ROOM_SMALL_VARIATION: `${BASE}models/room-small-variation.glb`,
  ROOM_WIDE: `${BASE}models/room-wide.glb`,
  ROOM_WIDE_VARIATION: `${BASE}models/room-wide-variation.glb`,
  ROOM_CORNER: `${BASE}models/room-corner.glb`,
  CORRIDOR: `${BASE}models/corridor.glb`,
  CORRIDOR_CORNER: `${BASE}models/corridor-corner.glb`,
  CORRIDOR_WIDE: `${BASE}models/corridor-wide.glb`,
  CORRIDOR_INTERSECTION: `${BASE}models/corridor-intersection.glb`,
  CORRIDOR_JUNCTION: `${BASE}models/corridor-junction.glb`,
  GATE_DOOR: `${BASE}models/gate-door.glb`,
  STAIRS: `${BASE}models/stairs.glb`,
  CHARACTER_A: `${BASE}models/character-a.glb`,
  CHARACTER_B: `${BASE}models/character-b.glb`,
  CHARACTER_C: `${BASE}models/character-c.glb`,
  CHARACTER_D: `${BASE}models/character-d.glb`,
  CHARACTER_E: `${BASE}models/character-e.glb`,
  CHARACTER_F: `${BASE}models/character-f.glb`,
  CHARACTER_G: `${BASE}models/character-g.glb`,
  CHARACTER_H: `${BASE}models/character-h.glb`,
} as const;

export const MAP_PRELOAD_MODELS: string[] = [
  MODEL_PATHS.ROOM_LARGE,
  MODEL_PATHS.ROOM_LARGE_VARIATION,
  MODEL_PATHS.ROOM_SMALL,
  MODEL_PATHS.ROOM_SMALL_VARIATION,
  MODEL_PATHS.ROOM_WIDE,
  MODEL_PATHS.ROOM_WIDE_VARIATION,
  MODEL_PATHS.ROOM_CORNER,
  MODEL_PATHS.CORRIDOR,
  MODEL_PATHS.CORRIDOR_CORNER,
  MODEL_PATHS.CORRIDOR_WIDE,
  MODEL_PATHS.CORRIDOR_INTERSECTION,
  MODEL_PATHS.CORRIDOR_JUNCTION,
  MODEL_PATHS.GATE_DOOR,
  MODEL_PATHS.STAIRS,
];
