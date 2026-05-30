import { test, expect } from "@playwright/test";
import { CHAT_REQUEST_BODY, LOCAL_API_BASE_URL } from "./support/constants";

// 测试前端 API 连接
test("API 连接测试", async ({ page }) => {
  const apiRequests: Array<{
    url: string;
    method: string;
    postData: string | null;
  }> = [];

  page.on("request", request => {
    if (request.url().includes("/api/chat")) {
      apiRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      });
    }
  });

  page.on("response", response => {
    if (response.url().includes("/api/chat")) {
      response
        .json()
        .then(data => {
          console.log("API 响应:", JSON.stringify(data).substring(0, 200));
        })
        .catch(() => {});
    }
  });

  const logs: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "error") {
      logs.push(msg.text());
    }
  });

  await page.goto("/");

  const apiResult = await page.evaluate(
    async ({ apiBaseURL, body }) => {
      const response = await fetch(`${apiBaseURL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { text?: string };

      return {
        success: response.ok,
        status: response.status,
        hasText: Boolean(data.text),
      };
    },
    { apiBaseURL: LOCAL_API_BASE_URL, body: CHAT_REQUEST_BODY }
  );

  console.log("API 请求数量:", apiRequests.length);
  console.log("控制台错误:", logs);

  expect(apiRequests.length).toBeGreaterThan(0);
  expect(apiResult.success).toBe(true);
  expect(apiResult.hasText).toBe(true);
});
