import { MODEL_PATHS } from "./modelPaths"
import type { RoomConfig, SceneModuleConfig } from "./types"

export const ROOMS: Record<string, RoomConfig> = {
  // 中央大厅 - 入口和导览
  central: {
    id: "central",
    model: MODEL_PATHS.ROOM_LARGE,
    position: [0, 0, 0],
    name: "Central Hub",
    description: "欢迎来到Fezer的互动档案馆",
    fezerType: "core",
    accent: "#f97316",
    summary: "入口中枢，负责导览整个 3D 简历空间和各个能力分区。",
    highlights: ["总览地图", "快速导览", "交互入口"],
  },

  // 环形第一圈：核心能力
  builder: {
    id: "builder",
    model: MODEL_PATHS.ROOM_SMALL_VARIATION,
    position: [-16, 0, -1],
    rotation: [0, Math.PI / 5, 0],
    name: "Builder Room",
    description: "项目与搭建能力",
    fezerType: "builder",
    accent: "#2563eb",
    summary: "聚焦前后端落地、工程结构、部署和产品原型实现能力。",
    highlights: ["React / TypeScript", "Node / API", "工程落地"],
  },
  ai: {
    id: "ai",
    model: MODEL_PATHS.ROOM_WIDE,
    position: [0, 0, -16],
    name: "AI Lab",
    description: "AI应用与自动化",
    fezerType: "ai",
    accent: "#7c3aed",
    summary: "展示 AI 应用设计、自动化工作流和模型能力集成实践。",
    highlights: ["Agent Workflow", "LLM Integration", "Automation"],
  },
  writer: {
    id: "writer",
    model: MODEL_PATHS.ROOM_SMALL,
    position: [16, 0, -1],
    rotation: [0, -Math.PI / 5, 0],
    name: "Writer Room",
    description: "写作与表达",
    fezerType: "writer",
    accent: "#0f766e",
    summary: "内容表达、文案组织、技术叙事和信息结构化能力。",
    highlights: ["写作表达", "信息架构", "叙事设计"],
  },

  // 环形第二圈：延伸兴趣
  reader: {
    id: "reader",
    model: MODEL_PATHS.ROOM_CORNER,
    position: [-17, 0, -16],
    rotation: [0, Math.PI / 2, 0],
    name: "Reader Nook",
    description: "阅读与思考",
    fezerType: "reader",
    accent: "#ca8a04",
    summary: "沉淀阅读、观察和系统化思考，作为长期输入来源。",
    highlights: ["长期阅读", "问题拆解", "知识沉淀"],
  },
  visual: {
    id: "visual",
    model: MODEL_PATHS.ROOM_LARGE_VARIATION,
    position: [0, 0, -30],
    name: "Visual Studio",
    description: "绘画、摄影、视觉表达",
    fezerType: "visual",
    accent: "#db2777",
    summary: "围绕图像、空间、网页视觉与 3D 表现的创意探索。",
    highlights: ["视觉设计", "3D 场景", "审美实验"],
  },
  wanderer: {
    id: "wanderer",
    model: MODEL_PATHS.ROOM_WIDE_VARIATION,
    position: [17, 0, -16],
    rotation: [0, -Math.PI / 2, 0],
    name: "Wanderer Base",
    description: "爬山、旅行、观察世界",
    fezerType: "wanderer",
    accent: "#059669",
    summary: "把旅行、徒步和环境观察转化为审美与判断力的来源。",
    highlights: ["旅行观察", "自然感知", "生活取样"],
  },
}

export const ROOM_IDS = Object.keys(ROOMS)

export const CORRIDOR_MODULES: SceneModuleConfig[] = [
  {
    id: "corridor-west-core",
    kind: "corridor",
    model: MODEL_PATHS.CORRIDOR,
    position: [-8, 0, 0],
  },
  {
    id: "corridor-east-core",
    kind: "corridor",
    model: MODEL_PATHS.CORRIDOR,
    position: [8, 0, 0],
  },
  {
    id: "corridor-north-core",
    kind: "corridor",
    model: MODEL_PATHS.CORRIDOR,
    position: [0, 0, -8],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "corridor-north-deep",
    kind: "corridor",
    model: MODEL_PATHS.CORRIDOR_WIDE,
    position: [0, 0, -22],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "corridor-west-branch",
    kind: "corridor",
    model: MODEL_PATHS.CORRIDOR_CORNER,
    position: [-12, 0, -10],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "corridor-east-branch",
    kind: "corridor",
    model: MODEL_PATHS.CORRIDOR_CORNER,
    position: [12, 0, -10],
    rotation: [0, -Math.PI / 2, 0],
  },
  {
    id: "corridor-reader-link",
    kind: "corridor",
    model: MODEL_PATHS.CORRIDOR_JUNCTION,
    position: [-12, 0, -16],
    rotation: [0, Math.PI, 0],
  },
  {
    id: "corridor-wanderer-link",
    kind: "corridor",
    model: MODEL_PATHS.CORRIDOR_JUNCTION,
    position: [12, 0, -16],
  },
  {
    id: "corridor-visual-hub",
    kind: "corridor",
    model: MODEL_PATHS.CORRIDOR_INTERSECTION,
    position: [0, 0, -16],
  },
]

export const STRUCTURE_MODULES: SceneModuleConfig[] = [
  {
    id: "gate-central",
    kind: "structure",
    model: MODEL_PATHS.GATE_DOOR,
    position: [0, 0, -5],
    scale: [1, 1, 1],
  },
  {
    id: "stairs-visual",
    kind: "structure",
    model: MODEL_PATHS.STAIRS,
    position: [0, 0, -24],
    rotation: [0, Math.PI, 0],
  },
  {
    id: "gate-reader",
    kind: "structure",
    model: MODEL_PATHS.GATE_DOOR,
    position: [-14, 0, -12],
    rotation: [0, Math.PI / 2, 0],
    scale: [0.9, 0.9, 0.9],
  },
  {
    id: "gate-wanderer",
    kind: "structure",
    model: MODEL_PATHS.GATE_DOOR,
    position: [14, 0, -12],
    rotation: [0, -Math.PI / 2, 0],
    scale: [0.9, 0.9, 0.9],
  },
]
