import { describe, expect, it } from "vitest";
import { isWorkspaceParent } from "./workspace-embed";

describe("trusted workspace parent", () => {
  it("permits only the exact production origin and development loopback origins", () => {
    expect(isWorkspaceParent("https://todou-six.vercel.app", false)).toBe(true);
    expect(isWorkspaceParent("https://todou-six.vercel.app.attacker.test", true)).toBe(false);
    expect(isWorkspaceParent("http://127.0.0.1:5173", true)).toBe(true);
    expect(isWorkspaceParent("http://127.0.0.1:5173", false)).toBe(false);
    expect(isWorkspaceParent("null", true)).toBe(false);
    expect(isWorkspaceParent("http://other.test:5173", true)).toBe(false);
  });
});
