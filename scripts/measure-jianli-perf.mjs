/**
 * /jianli 3D 场景的加载体积基线测量
 *
 * 为什么不用 FPS 做基线：headless chromium 走 SwiftShader 软件渲染，帧率既慢
 * 又不代表真机，拿它当指标只会误导。加载体积则完全可复现，也正是 B1 的验收口径。
 *
 * 用法：
 *   node scripts/measure-jianli-perf.mjs            # 测量并打印
 *   node scripts/measure-jianli-perf.mjs --write    # 同时写入 docs/perf-baseline.md
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.PERF_PORT || 4399);
const BASE = `http://127.0.0.1:${PORT}`;
const WRITE = process.argv.includes("--write");
const SETTLE_MS = 2000;
const MODEL_WAIT_MS = 30_000;
const MODEL_STABLE_MS = 2500;

/**
 * 等模型请求停止增长。
 *
 * 不能用 `networkidle`：Vite dev 常驻 HMR websocket，永远不会 idle。
 */
async function waitForModelsToSettle(count, deadline) {
  let last = -1;
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    const current = count();
    if (current !== last) {
      last = current;
      stableSince = Date.now();
    } else if (Date.now() - stableSince > MODEL_STABLE_MS) {
      return;
    }
    await sleep(250);
  }
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  throw new Error(`dev server 未在 ${timeoutMs}ms 内就绪: ${url}`);
}

function startVite() {
  const child = spawn(
    "pnpm",
    [
      "exec",
      "vite",
      "--host",
      "127.0.0.1",
      "--port",
      String(PORT),
      "--strictPort",
    ],
    { stdio: "ignore" }
  );
  return child;
}

async function main() {
  const vite = startVite();
  const stop = () => {
    if (!vite.killed) vite.kill("SIGTERM");
  };
  process.on("exit", stop);

  try {
    await waitForServer(BASE);

    const browser = await chromium.launch({
      // WSL/容器下 /dev/shm 偏小时 chromium 会崩，禁用共享内存减少这种噪音
      args: ["--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();

    const models = [];
    const scripts = [];
    const failed = [];
    page.on("response", async response => {
      const url = response.url();
      const type = response.request().resourceType();
      const length = Number(response.headers()["content-length"] ?? 0);
      if (url.endsWith(".glb")) {
        if (response.status() >= 400) {
          failed.push({ url, status: response.status() });
        } else {
          models.push({ url, length });
        }
      }
      if (type === "script" || url.includes("/@vite/"))
        scripts.push({ url, length });
    });

    await page.goto(`${BASE}/jianli`, { waitUntil: "load" });
    await waitForModelsToSettle(
      () => models.length,
      Date.now() + MODEL_WAIT_MS
    );
    await sleep(SETTLE_MS);

    let fcpMs = null;
    try {
      const paints = await page.evaluate(() => {
        const entry = performance.getEntriesByType("paint");
        const fcp = entry.find(e => e.name === "first-contentful-paint");
        return { fcpMs: fcp ? Math.round(fcp.startTime) : null };
      });
      fcpMs = paints.fcpMs;
    } catch {
      // 渲染进程崩了就只报体积，不把整次测量丢掉
    }

    await browser.close();

    const modelBytes = models.reduce((sum, m) => sum + m.length, 0);
    const uniqueModels = new Set(models.map(m => m.url));
    const report = {
      measuredAt: new Date().toISOString().slice(0, 10),
      url: `${BASE}/jianli`,
      modelRequests: models.length,
      uniqueModelFiles: uniqueModels.size,
      modelBytes,
      modelMiB: +(modelBytes / 1024 / 1024).toFixed(2),
      failedModelRequests: failed.length,
      scriptRequests: scripts.length,
      fcpMs,
    };

    console.log(JSON.stringify(report, null, 2));

    if (WRITE) {
      const markdown = [
        "# /jianli 加载体积基线",
        "",
        `> 由 \`node scripts/measure-jianli-perf.mjs --write\` 生成，测量日期 ${report.measuredAt}。`,
        "> headless chromium（SwiftShader）—— 只用于体积基线，帧率请在真机手测。",
        "",
        "| 指标 | 数值 |",
        "| --- | --- |",
        `| glb 请求数 | ${report.modelRequests} |`,
        `| 唯一 glb 文件数 | ${report.uniqueModelFiles} |`,
        `| glb 总字节 | ${report.modelBytes}（${report.modelMiB} MiB） |`,
        `| glb 失败请求（≥400） | ${report.failedModelRequests} |`,
        `| script/模块请求数 | ${report.scriptRequests} |`,
        `| First Contentful Paint | ${report.fcpMs ?? "n/a"} ms |`,
        "",
        "目标（计划 §6）：首屏模型字节 < 1.5MB。当前一次性挂载全部房间/走廊/结构与 18 个角色，",
        "因此基线等于全部模型体积。",
        "",
      ].join("\n");
      writeFileSync("docs/perf-baseline.md", markdown, "utf8");
      console.log("已写入 docs/perf-baseline.md");
    }
  } finally {
    stop();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
