import { describe, expect, it } from "vitest";
import {
  buildCharacterPrompt,
  getCharacterConfig,
} from "@fezer/shared/characters";
import type { FezerType } from "@fezer/shared/schemas/character";

const AGENTS: FezerType[] = [
  "core",
  "builder",
  "ai",
  "writer",
  "reader",
  "visual",
  "wanderer",
];

const MODES = ["core-routing", "expert-answering"] as const;

describe("character prompt builder", () => {
  for (const agent of AGENTS) {
    for (const mode of MODES) {
      it(`renders 6-layer prompt structure for ${agent} (${mode})`, () => {
        const prompt = buildCharacterPrompt(getCharacterConfig(agent), {
          interactionMode: mode,
        });

        expect(prompt).toContain("## Role & Mission");
        expect(prompt).toContain("## Context");
        expect(prompt).toContain("## Behavior");
        expect(prompt).toContain("## Boundaries");
        expect(prompt).toContain("## Tool/Collaboration Policy");
        expect(prompt).toContain("## Output Contract");

        expect(prompt).toContain(
          "回答优先顺序固定为：先结论，再给依据或方法，最后给下一步建议。"
        );
        expect(prompt).toContain("我目前没有足够依据确认这点");
        expect(prompt).toContain("禁止声称");
        expect(prompt).toContain(
          "默认按三段结构输出：1) 直接回答 2) 依据或方法 3) 可继续追问。"
        );
      });
    }
  }

  it("supports responseDepth and enforceOutputContract options", () => {
    const config = getCharacterConfig("ai");
    const briefPrompt = buildCharacterPrompt(config, {
      interactionMode: "expert-answering",
      responseDepth: "brief",
      enforceOutputContract: false,
    });
    const deepPrompt = buildCharacterPrompt(config, {
      interactionMode: "expert-answering",
      responseDepth: "deep",
      enforceOutputContract: true,
    });

    expect(briefPrompt).toContain("使用更短回答，优先 1-3 句直接结论");
    expect(briefPrompt).toContain("输出结构可适度灵活");
    expect(deepPrompt).toContain("补充关键权衡、失败模式或替代路径");
    expect(deepPrompt).toContain(
      "默认按三段结构输出：1) 直接回答 2) 依据或方法 3) 可继续追问。"
    );
  });

  it("anchors each expert to its own identity and prevents role takeover", () => {
    const prompt = buildCharacterPrompt(getCharacterConfig("builder"), {
      interactionMode: "expert-answering",
    });

    expect(prompt).toContain("## Identity Anchor");
    expect(prompt).toContain("你只能以 Gemini · Builder 的身份回答");
    expect(prompt).toContain("不得自称 Aries · Core");
    expect(prompt).toContain("不要接管其他房间角色的专长");
  });
});
