import { test, expect } from "@playwright/test";
import { CHAT_REQUEST_BODY, LOCAL_API_BASE_URL } from "./support/constants";

test.describe("本地前端 API 简单测试", () => {
  test.use({
    timeout: 180000,
  });

  test("单次提问测试", async ({ page }) => {
    console.log("=== 导航到本地页面 ===");
    await page.goto("/jianli", { waitUntil: "domcontentloaded" });

    console.log("=== 测试 API 调用 ===");

    const result = await page.evaluate(
      async ({ apiBaseURL, body }) => {
        try {
          const response = await fetch(`${apiBaseURL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          console.log("HTTP status:", response.status);
          console.log("Response ok:", response.ok);

          const data = await response.json();
          console.log("Has text:", !!data.text);

          return {
            success: response.ok,
            status: response.status,
            hasText: !!data.text,
          };
        } catch (error) {
          console.log("Error:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      { apiBaseURL: LOCAL_API_BASE_URL, body: CHAT_REQUEST_BODY }
    );

    console.log("=== 结果 ===");
    console.log("Success:", result.success);
    console.log("Status:", result.status);
    console.log("Has text:", result.hasText);
    if (result.error) console.log("Error:", result.error);

    expect(result.success).toBe(true);
    expect(result.hasText).toBe(true);
  });
});
