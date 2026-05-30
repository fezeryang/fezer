import { test, expect } from "@playwright/test";
import {
  CHAT_REQUEST_BODY,
  EXPECTED_E2E_CHAT_TEXT,
  LOCAL_API_BASE_URL,
  LOCAL_FRONTEND_BASE_URL,
} from "./support/constants";

test("检查本地 e2e API 配置", async ({ page }) => {
  await page.goto("/jianli");

  const apiResult = await page.evaluate(
    async ({ apiBaseURL, body }) => {
      const response = await fetch(`${apiBaseURL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { text?: string };
      return {
        location: window.location.href,
        success: response.ok,
        status: response.status,
        hasText: Boolean(data.text),
        text: data.text,
      };
    },
    { apiBaseURL: LOCAL_API_BASE_URL, body: CHAT_REQUEST_BODY }
  );

  console.log("本地 e2e API 配置:", apiResult);

  expect(LOCAL_API_BASE_URL).toBe("http://127.0.0.1:4300");
  expect(apiResult.location).toContain(new URL(LOCAL_FRONTEND_BASE_URL).host);
  expect(apiResult.success).toBe(true);
  expect(apiResult.hasText).toBe(true);
  expect(apiResult.text).toBe(EXPECTED_E2E_CHAT_TEXT);
});
