/**
 * 地图和房间配置
 */

import type { RoomId } from "../schemas/character";

/**
 * 房间信息
 */
export interface RoomInfo {
  id: RoomId;
  name: string;
  description: string;
  position: [number, number, number];
  fezerType: string;
  accent: string;
}

/**
 * 所有房间信息
 */
export const ROOMS: Record<RoomId, RoomInfo> = {
  central: {
    id: "central",
    name: "Central Hub",
    description: "欢迎来到Fezer的互动档案馆，这是入口和总览区域",
    position: [0, 0, 0],
    fezerType: "core",
    accent: "#f97316",
  },
  builder: {
    id: "builder",
    name: "Builder Room",
    description: "项目与搭建能力，聚焦前后端落地、工程结构、部署和产品原型实现",
    position: [-16, 0, -1],
    fezerType: "builder",
    accent: "#2563eb",
  },
  ai: {
    id: "ai",
    name: "AI Lab",
    description: "AI应用与自动化，展示 AI 应用设计、自动化工作流和模型能力集成实践",
    position: [0, 0, -16],
    fezerType: "ai",
    accent: "#7c3aed",
  },
  writer: {
    id: "writer",
    name: "Writer Room",
    description: "写作与表达，内容表达、文案组织、技术叙事和信息结构化能力",
    position: [16, 0, -1],
    fezerType: "writer",
    accent: "#0f766e",
  },
  reader: {
    id: "reader",
    name: "Reader Nook",
    description: "阅读与思考，沉淀阅读、观察和系统化思考，作为长期输入来源",
    position: [-17, 0, -16],
    fezerType: "reader",
    accent: "#ca8a04",
  },
  visual: {
    id: "visual",
    name: "Visual Studio",
    description: "绘画、摄影、视觉表达，围绕图像、空间、网页视觉与 3D 表现的创意探索",
    position: [0, 0, -30],
    fezerType: "visual",
    accent: "#db2777",
  },
  wanderer: {
    id: "wanderer",
    name: "Wanderer Base",
    description: "爬山、旅行、观察世界，把旅行、徒步和环境观察转化为审美与判断力的来源",
    position: [17, 0, -16],
    fezerType: "wanderer",
    accent: "#059669",
  },
};

/**
 * 房间邻接关系 (用于路径规划)
 */
export const ROOM_ADJACENCY: Record<RoomId, RoomId[]> = {
  central: ["builder", "ai", "writer"],
  builder: ["central", "ai"],
  ai: ["central", "builder", "writer", "visual"],
  writer: ["central", "ai", "reader"],
  reader: ["writer", "wanderer"],
  visual: ["ai", "wanderer"],
  wanderer: ["reader", "visual"],
};

/**
 * 获取房间信息
 */
export function getRoomInfo(roomId: string): RoomInfo | null {
  return ROOMS[roomId as RoomId] ?? null;
}

/**
 * 获取相邻房间
 */
export function getAdjacentRooms(roomId: string): RoomId[] {
  return ROOM_ADJACENCY[roomId as RoomId] ?? [];
}
