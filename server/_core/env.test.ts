import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function setBaseServerEnv() {
  process.env.DATABASE_URL = "mysql://user:pass@localhost:3306/app";
  process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";
  process.env.OAUTH_SERVER_URL = "https://oauth.example.com";
  process.env.OWNER_OPEN_ID = "owner-open-id";
}

async function expectAssertEnvFailure(): Promise<string> {
  const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
    throw new Error("process.exit");
  }) as never);
  const errorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  vi.resetModules();
  const { assertEnvValid } = await import("./env");

  expect(() => assertEnvValid()).toThrow("process.exit");
  expect(exitSpy).toHaveBeenCalledWith(1);
  return String(errorSpy.mock.calls[0]?.[0] ?? "");
}

describe("environment validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    setBaseServerEnv();
    delete process.env.E2E_MOCK_AGENT_API;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.BUILT_IN_FORGE_API_KEY;
    delete process.env.AI_PRIMARY_PROVIDER;
    delete process.env.AI_FALLBACK_PROVIDER;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it("requires the enabled DeepSeek provider key at startup", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_FALLBACK_PROVIDER = "deepseek";

    const errorOutput = await expectAssertEnvFailure();

    expect(errorOutput).toContain("DEEPSEEK_API_KEY");
    expect(errorOutput).not.toContain("BUILT_IN_FORGE_API_KEY");
  });

  it("requires the fallback provider key when fallback differs from primary", async () => {
    process.env.AI_PRIMARY_PROVIDER = "deepseek";
    process.env.AI_FALLBACK_PROVIDER = "forge";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";

    const errorOutput = await expectAssertEnvFailure();

    expect(errorOutput).toContain("BUILT_IN_FORGE_API_KEY");
  });

  it("does not require LLM keys for the non-production e2e agent mock", async () => {
    process.env.NODE_ENV = "development";
    process.env.E2E_MOCK_AGENT_API = "true";

    vi.resetModules();
    const { assertEnvValid } = await import("./env");

    expect(() => assertEnvValid()).not.toThrow();
  });
});
