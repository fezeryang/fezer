/**
 * scene-bubbles 纯逻辑测试：归属链、合并优先级、流式截断、邻接线段
 */

import { describe, expect, it } from "vitest";
import {
  adjacencySegments,
  charactersInRoom,
  clipStreamText,
  leadCharacterIdOfRoom,
  mergeSceneBubbles,
  roomOfAgent,
  roomOfCharacter,
  pickChatterExchange,
} from "./scene-bubbles";
import { CHARACTERS } from "@/components/jianli/assets/characterConfig";
import { ROOMS } from "@/components/jianli/assets/roomsConfig";

describe("roomOfAgent", () => {
  it("房间与 agent 一一对应（ROOM_AGENT_IDS 反查）", () => {
    expect(roomOfAgent("core")).toBe("central");
    expect(roomOfAgent("ai")).toBe("ai");
    expect(roomOfAgent("wanderer")).toBe("wanderer");
  });
});

describe("roomOfCharacter", () => {
  it("fezer-NN 归属到正确的房间", () => {
    expect(roomOfCharacter("fezer-01")).toBe("central");
    expect(roomOfCharacter("fezer-03")).toBe("central");
    expect(roomOfCharacter("fezer-04")).toBe("builder");
    expect(roomOfCharacter("fezer-06")).toBe("ai");
    expect(roomOfCharacter("fezer-10")).toBe("writer");
    expect(roomOfCharacter("fezer-11")).toBe("reader");
    expect(roomOfCharacter("fezer-13")).toBe("visual");
    expect(roomOfCharacter("fezer-18")).toBe("wanderer");
  });

  it("无法解析的 characterId 返回 undefined", () => {
    expect(roomOfCharacter("fezer-99")).toBeUndefined();
    expect(roomOfCharacter("unknown")).toBeUndefined();
  });
});

describe("leadCharacterIdOfRoom / charactersInRoom", () => {
  it("首席角色 = 该房间在 CHARACTERS 里的第一个角色", () => {
    expect(leadCharacterIdOfRoom("central")).toBe("fezer-01");
    expect(leadCharacterIdOfRoom("builder")).toBe("fezer-04");
    expect(leadCharacterIdOfRoom("ai")).toBe("fezer-06");
    expect(leadCharacterIdOfRoom("visual")).toBe("fezer-13");
  });

  it("房间角色数量与 characterConfig 一致", () => {
    for (const roomId of Object.keys(ROOMS)) {
      const inRoom = charactersInRoom(roomId);
      expect(inRoom.length).toBeGreaterThan(0);
      for (const id of inRoom) {
        expect(CHARACTERS.some(c => c.id === id)).toBe(true);
      }
    }
    expect(charactersInRoom("builder")).toHaveLength(2);
  });
});

describe("clipStreamText", () => {
  it("正常累积短文本", () => {
    expect(clipStreamText("", "你好")).toBe("你好");
    expect(clipStreamText("你好", "，世界")).toBe("你好，世界");
  });

  it("超过 64 字符即截断加省略号", () => {
    const long = clipStreamText("", "a".repeat(80));
    expect(long).toHaveLength(65); // 64 + "…"
    expect(long.endsWith("…")).toBe(true);
  });

  it("已截断后不再追加", () => {
    const clipped = clipStreamText("", "a".repeat(80));
    expect(clipStreamText(clipped, "more")).toBe(clipped);
  });
});

describe("mergeSceneBubbles 优先级", () => {
  it("agent 气泡挂到对应房间首席角色", () => {
    const merged = mergeSceneBubbles({
      agentBubbles: {
        ai: { kind: "thinking", speaker: "AI", text: "正在思考…" },
      },
    });
    expect(merged[leadCharacterIdOfRoom("ai")!]).toMatchObject({
      kind: "thinking",
      speaker: "AI",
    });
  });

  it("agent 活动优先于同房间的招呼（招呼让位）", () => {
    const merged = mergeSceneBubbles({
      agentBubbles: {
        central: { kind: "thinking", speaker: "Fezer", text: "…" },
      },
      greeting: { roomId: "central", text: "欢迎来到 Central Hub" },
    });
    const lead = leadCharacterIdOfRoom("central")!;
    expect(merged[lead].kind).toBe("thinking");
  });

  it("无冲突时招呼挂首席角色并带上房间名", () => {
    const merged = mergeSceneBubbles({
      agentBubbles: {},
      greeting: { roomId: "builder", text: "这里是 Builder Room" },
    });
    const lead = leadCharacterIdOfRoom("builder")!;
    expect(merged[lead]).toMatchObject({
      kind: "greeting",
      text: "这里是 Builder Room",
    });
    expect(merged[lead].speaker).toBe(ROOMS.builder.name);
  });

  it("闲聊角色被占用时丢弃，空闲时挂上", () => {
    const busy = leadCharacterIdOfRoom("writer")!;
    expect(
      mergeSceneBubbles({
        agentBubbles: { writer: { kind: "speaking", text: "…" } },
        chatter: { characterId: busy, text: "闲聊" },
      })[busy].kind
    ).toBe("speaking");

    const idle = "fezer-10"; // writer 房间的第二个角色
    expect(
      mergeSceneBubbles({
        agentBubbles: { writer: { kind: "speaking", text: "…" } },
        chatter: { characterId: idle, text: "闲聊" },
      })[idle]
    ).toMatchObject({ kind: "chatter", text: "闲聊" });
  });
});

describe("pickChatterExchange", () => {
  it("未知房间或无角色返回 null", () => {
    expect(pickChatterExchange("nope")).toBeNull();
  });

  it("台词来自房间对话池，角色属于该房间且尽量不同", () => {
    const pool = new Set(ROOMS.central.chatter.flat());
    for (let i = 0; i < 20; i++) {
      const exchange = pickChatterExchange("central")!;
      const chars = charactersInRoom("central");
      expect(chars).toContain(exchange.a);
      expect(chars).toContain(exchange.b);
      // 3 个角色的房间里 A/B 应尽量不同
      expect(exchange.a).not.toBe(exchange.b);
      expect(pool.has(exchange.lines[0])).toBe(true);
      expect(pool.has(exchange.lines[1])).toBe(true);
    }
  });
});

describe("adjacencySegments", () => {
  it("边数与 ROOM_ADJACENCY 去重后一致（9 条）", () => {
    expect(adjacencySegments()).toHaveLength(9);
  });

  it("包含 central↔builder 且线段端点是真实房间坐标", () => {
    const segments = adjacencySegments();
    const positions = new Set(
      Object.values(ROOMS).map(r => `${r.position[0]},${r.position[2]}`)
    );
    const hasCentralBuilder = segments.some(
      s =>
        (s.a.join(",") === "0,0" && s.b.join(",") === "-16,-1") ||
        (s.a.join(",") === "-16,-1" && s.b.join(",") === "0,0")
    );
    expect(hasCentralBuilder).toBe(true);
    for (const s of segments) {
      expect(positions.has(s.a.join(","))).toBe(true);
      expect(positions.has(s.b.join(","))).toBe(true);
    }
  });
});
