import { test, expect } from "@playwright/test";
import { CHAT_REQUEST_BODY, LOCAL_API_BASE_URL } from "./support/constants";

test.describe("简单调试", () => {
  test.use({ timeout: 60000 });

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
    const result = await page.evaluate(
      async ({ apiBaseURL, body }) => {
        const response = await fetch(`${apiBaseURL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        return {
          ok: response.ok,
          status: response.status,
          hasText: !!data.text,
        };
      },
      { apiBaseURL: LOCAL_API_BASE_URL, body: CHAT_REQUEST_BODY }
    );

    console.log("API 结果:", result);
    console.log("控制台错误:", errors);

    expect(result.ok).toBe(true);
  });
});
