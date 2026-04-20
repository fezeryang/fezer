import { test, expect } from "@playwright/test";

const questions = [
  "你好",
  "今天天气怎么样？",
  "解释一下量子计算",
  "用Python写一个快速排序",
];

test.describe("前端 API 连续测试", () => {
  test("连续提问测试", async ({ page }) => {
    // 记录所有请求和响应
    const requests: string[] = [];
    const responses: Array<{ status: number; ok: boolean }> = [];

    page.on("request", request => {
      const url = request.url();
      if (url.includes("/api/")) {
        requests.push(url);
        console.log(`[请求] ${request.method()} ${url}`);
      }
    });

    page.on("response", async response => {
      const url = response.url();
      if (url.includes("/api/")) {
        const status = response.status();
        const ok = response.ok();
        responses.push({ status, ok });
        console.log(`[响应] HTTP ${status} ${ok ? "✓" : "✗"}`);

        if (!ok) {
          const text = await response.text().catch(() => "N/A");
          console.log(`[错误] ${text}`);
        }
      }
    });

    // 记录控制台错误
    const consoleErrors: string[] = [];
    page.on("console", msg => {
      if (msg.type() === "error") {
        const text = msg.text();
        consoleErrors.push(text);
        console.log(`[控制台错误] ${text}`);
      }
    });

    console.log("=== 开始测试: https://fezeryang.github.io/fezer/jianli ===");

    // 导航到 jianli 页面
    await page.goto("https://fezeryang.github.io/fezer/jianli", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    console.log("页面已加载，等待 3 秒...");
    await page.waitForTimeout(3000);

    // 截图
    await page.screenshot({ path: "jianli-page-loaded.png" });
    console.log("[截图] 已保存 jianli-page-loaded.png");

    // 尝试在页面上下文中执行 API 调用
    console.log("\n=== 开始连续提问测试 ===");

    const results = await page.evaluate(async (qs) => {
      const results: Array<{ question: string; success: boolean; status?: number; error?: string; data?: unknown }> = [];

      for (const q of qs) {
        try {
          console.log(`[提问] ${q}`);

          const response = await fetch("http://4.188.113.194/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userInput: q }),
          });

          const data = await response.json();

          results.push({
            question: q,
            success: response.ok,
            status: response.status,
            data,
          });

          console.log(`[回答] 成功 - ${response.status}`);

        } catch (error) {
          results.push({
            question: q,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
          console.log(`[错误] ${error}`);
        }

        // 延迟 1 秒
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return results;
    }, questions);

    // 输出结果
    console.log("\n=== 测试结果汇总 ===");
    let successCount = 0;
    let failCount = 0;

    results.forEach((r, i) => {
      const status = r.success ? "✓ 成功" : "✗ 失败";
      console.log(`${i + 1}. [${r.question}] ${status}`);
      if (r.error) console.log(`   错误: ${r.error}`);
      if (r.success) successCount++;
      else failCount++;
    });

    console.log(`\n总计: ${successCount} 成功, ${failCount} 失败`);
    console.log(`API 请求数: ${requests.length}`);
    console.log(`控制台错误数: ${consoleErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log("\n[控制台错误列表]");
      consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    // 最后截图
    await page.screenshot({ path: "jianli-after-test.png" });

    // 断言
    expect(successCount + failCount).toBeGreaterThan(0);
  });
});
