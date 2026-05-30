import { test, expect } from "@playwright/test";
import {
  CHAT_REQUEST_BODY,
  EXPECTED_E2E_CHAT_TEXT,
  LOCAL_API_BASE_URL,
} from "./support/constants";

test("Direct API call test", async ({ page }) => {
  // Track all requests
  const requests: string[] = [];
  page.on("request", request => {
    const url = request.url();
    if (url.includes("/api/")) {
      requests.push(url);
      console.log("API Request:", request.method(), url);
    }
  });

  // Track all responses
  page.on("response", async response => {
    const url = response.url();
    if (url.includes("/api/")) {
      const status = response.status();
      console.log("API Response:", status, url);
      if (status >= 400) {
        const text = await response
          .text()
          .catch(() => "Unable to read response");
        console.log("Error body:", text);
      }
    }
  });

  console.log("Testing direct API call to local e2e backend...");

  await page.goto("/jianli", { waitUntil: "domcontentloaded" });

  // Execute a direct API call from the browser context
  const apiResult = await page.evaluate(
    async ({ apiBaseURL, body }) => {
      try {
        const response = await fetch(`${apiBaseURL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        return {
          success: response.ok,
          status: response.status,
          data,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    { apiBaseURL: LOCAL_API_BASE_URL, body: CHAT_REQUEST_BODY }
  );

  console.log("Direct API call result:", JSON.stringify(apiResult, null, 2));

  // Verify the result
  expect(apiResult).toBeDefined();
  expect(apiResult.success).toBe(true);
  expect(apiResult.data.text).toBe(EXPECTED_E2E_CHAT_TEXT);
});
