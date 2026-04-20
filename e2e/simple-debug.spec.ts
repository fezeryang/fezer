import { test, expect } from "@playwright/test";

test.describe("简单调试", () => {
  test.use({ baseURL: "http://localhost:5173", timeout: 60000 });

  test("检查 API 调用", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", msg => {
      if (msg.type() === "error") {
        errors.push(msg.text());
        console.log(`[错误] ${msg.text()}`);
      }
    });

    await page.goto("/jianli");
    await page.waitForTimeout(2000);

    // 简单测试：直接用 fetch
    const result = await page.evaluate(async () => {
      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: "你好" }),
      });
      const data = await response.json();
      return { ok: response.ok, status: response.status, hasText: !!data.text };
    });

    console.log("API 结果:", result);
    console.log("控制台错误:", errors);

    expect(result.ok).toBe(true);
  });
});
