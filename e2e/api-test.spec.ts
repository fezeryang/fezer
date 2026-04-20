import { test, expect } from "@playwright/test";

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
        const text = await response.text().catch(() => "Unable to read response");
        console.log("Error body:", text);
      }
    }
  });

  console.log("Testing direct API call to Azure VM backend...");

  // Try direct API call via JavaScript
  await page.goto("https://fezeryang.github.io/fezer/jianli", {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  // Execute a direct API call from the browser context
  const apiResult = await page.evaluate(async () => {
    try {
      const response = await fetch("http://4.188.113.194/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: "你好" }),
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
  });

  console.log("Direct API call result:", JSON.stringify(apiResult, null, 2));

  // Take screenshot
  await page.screenshot({ path: "jianli-api-test.png" });

  // Verify the result
  expect(apiResult).toBeDefined();
});
