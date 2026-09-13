import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const AGENTS_ROOT = path.resolve("server/agents");
const LEGACY_ROOT = path.resolve("server/agents/legacy");
const SERVER_ROOT = path.resolve("server");
const CORE_ROOT = path.resolve("server/_core");

function listTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result: string[] = [];

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listTsFiles(abs));
      continue;
    }
    if (entry.isFile() && abs.endsWith(".ts")) {
      result.push(abs);
    }
  }

  return result;
}

/** 只检查会被打包进服务的源码：跳过测试与 legacy 参考实现 */
function isProductionSource(file: string): boolean {
  return (
    !file.endsWith(".test.ts") &&
    !file.endsWith(".spec.ts") &&
    !file.includes(`${path.sep}legacy${path.sep}`)
  );
}

function importersOf(modulePattern: RegExp, excludeDir: string): string[] {
  return listTsFiles(SERVER_ROOT)
    .filter(isProductionSource)
    .filter(file => !file.includes(`${path.sep}${excludeDir}${path.sep}`))
    .filter(file => modulePattern.test(fs.readFileSync(file, "utf8")));
}

describe("agents structure boundary", () => {
  it("keeps previous orchestrator implementation under legacy", () => {
    expect(
      fs.existsSync(path.join(LEGACY_ROOT, "orchestrator-v1", "nodes.ts"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(LEGACY_ROOT, "orchestrator-v1", "state.ts"))
    ).toBe(true);
  });

  it("removes active duplicate orchestrator v1 files", () => {
    expect(
      fs.existsSync(path.resolve("server/agents/orchestrator/nodes.ts"))
    ).toBe(false);
    expect(
      fs.existsSync(path.resolve("server/agents/orchestrator/state.ts"))
    ).toBe(false);
  });

  it("does not keep empty character placeholder in active path", () => {
    expect(fs.existsSync(path.resolve("server/agents/character"))).toBe(false);
  });

  it("active modules do not import from legacy", () => {
    const files = listTsFiles(AGENTS_ROOT).filter(
      file => !file.includes(`${path.sep}legacy${path.sep}`)
    );

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      expect(content).not.toMatch(/from\s+["'][^"']*legacy[^"']*["']/);
      expect(content).not.toMatch(
        /import\s*\(\s*["'][^"']*legacy[^"']*["']\s*\)/
      );
    }
  });
});

describe("harness is the single entry point", () => {
  it("only the harness imports the orchestrator graph", () => {
    expect(
      importersOf(/from\s+["'][^"']*orchestrator\/graph["']/, "harness")
    ).toEqual([]);
  });

  it("only the orchestrator imports the supervisor graph", () => {
    expect(
      importersOf(/from\s+["'][^"']*supervisor\/graph["']/, "orchestrator")
    ).toEqual([]);
  });
});

describe("core layer stays below the agent layer", () => {
  it("_core 不得 import agents（入口 index.ts 是组装根）", () => {
    const offenders = listTsFiles(CORE_ROOT)
      .filter(isProductionSource)
      .filter(file => path.basename(file) !== "index.ts")
      .filter(file =>
        /from\s+["'][^"']*\bagents\//.test(fs.readFileSync(file, "utf8"))
      );

    expect(offenders).toEqual([]);
  });
});
