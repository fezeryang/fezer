import { test, expect } from "@playwright/test";
import { LOCAL_API_BASE_URL } from "./support/constants";

const questions = [
  "你好",
  "今天天气怎么样？",
  "解释一下量子计算",
  "用Python写一个快速排序",
];

test.describe("本地前端 API 连续测试", () => {
  test.use({
    timeout: 120000, // 2 分钟超时
  });

  test("连续提问测试", async ({ page }) => {
    const results: Array<{
      question: string;
      success: boolean;
      status?: number;
      hasText?: boolean;
      error?: string;
    }> = [];

    // 监听请求
    page.on("request", request => {
      const url = request.url();
      if (url.includes("/api/")) {
        console.log(`[请求] ${request.method()} ${url}`);
      }
    });

    // 监听响应
    page.on("response", async response => {
      const url = response.url();
      if (url.includes("/api/")) {
        const status = response.status();
        const ok = response.ok();
        console.log(`[响应] HTTP ${status} ${ok ? "✓" : "✗"}`);
      }
    });

    // 监听控制台
    page.on("console", msg => {
      if (msg.type() === "error") {
        console.log(`[控制台错误] ${msg.text()}`);
      }
    });

    console.log("=== 导航到本地页面 ===");
    await page.goto("/jianli", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    console.log("页面已加载");

    console.log("\n=== 开始连续提问测试 ===");

    // 在浏览器上下文中执行 API 调用
    const testResults = await page.evaluate(
      async ({ qs, apiBaseURL }) => {
        const results: typeof results = [];

        for (const q of qs) {
          try {
            const response = await fetch(`${apiBaseURL}/api/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userInput: q }),
            });

            const data = await response.json();

            results.push({
              question: q,
              success: response.ok,
              status: response.status,
              hasText: !!(data as { text?: string }).text,
            });

            console.log(`✓ [${q}] HTTP ${response.status}`);
          } catch (error) {
            results.push({
              question: q,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
            console.log(`✗ [${q}] ${error}`);
          }
        }

        return results;
      },
      { qs: questions, apiBaseURL: LOCAL_API_BASE_URL }
    );

    // 输出结果
    console.log("\n=== 测试结果汇总 ===");
    let successCount = 0;
    let failCount = 0;

    testResults.forEach((r, i) => {
      const status = r.success ? "✓ 成功" : "✗ 失败";
      console.log(`${i + 1}. [${r.question}] ${status} ${r.status || ""}`);
      if (r.error) console.log(`   错误: ${r.error}`);
      if (r.success) successCount++;
      else failCount++;
    });

    console.log(`\n总计: ${successCount} 成功, ${failCount} 失败`);

    // 断言
    expect(successCount).toBeGreaterThan(0);

    // 如果有失败，至少有一半应该成功
    if (failCount > 0) {
      expect(successCount / (successCount + failCount)).toBeGreaterThanOrEqual(
        0.5
      );
    }
  });
});
