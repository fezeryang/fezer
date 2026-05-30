import { describe, expect, it } from "vitest";
import {
  resolveAgentByCharacterId,
  resolvePreferredAgent,
} from "./agent-resolution";

describe("agent spatial resolution", () => {
  it("resolves 3D character ids to their room agent", () => {
    expect(resolveAgentByCharacterId("fezer-13")).toBe("visual");
    expect(resolveAgentByCharacterId("c4")).toBe("builder");
  });

  it("accepts agent ids as direct character targets for UI handoff buttons", () => {
    expect(resolveAgentByCharacterId("writer")).toBe("writer");
    expect(
      resolvePreferredAgent({
        characterId: "ai",
        interactionType: "click",
        fallback: "core",
      })
    ).toBe("ai");
  });
});
