import { test, expect } from "@playwright/test";

test("Mixed content diagnostic test", async ({ page }) => {
  const consoleMessages: string[] = [];

  // Capture all console messages
  page.on("console", msg => {
    const text = msg.text();
    if (
      text.includes("mixed") ||
      text.includes("CORS") ||
      text.includes("block") ||
      text.includes("API") ||
      msg.type() === "error"
    ) {
      consoleMessages.push(`[${msg.type()}] ${text}`);
      console.log(`Console [${msg.type()}]:`, text);
    }
  });

  // Navigate to the page
  await page.goto("https://fezeryang.github.io/fezer/jianli", {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  // Wait a bit for console messages
  await page.waitForTimeout(3000);

  // Test different API URLs
  const testResults = await page.evaluate(async () => {
    const results: Record<string, unknown> = {};

    // Test 1: HTTP API (will be blocked by mixed content)
    try {
      const response = await fetch("http://4.188.113.194/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: "你好" }),
        mode: "cors",
      });
      results.httpApi = {
        status: response.status,
        ok: response.ok,
      };
    } catch (error) {
      results.httpApi = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Test 2: HTTPS API (if available)
    try {
      const response = await fetch("https://4.188.113.194/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: "你好" }),
        mode: "cors",
      });
      results.httpsApi = {
        status: response.status,
        ok: response.ok,
      };
    } catch (error) {
      results.httpsApi = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Test 3: Current page protocol
    results.pageProtocol = window.location.protocol;
    results.pageURL = window.location.href;

    return results;
  });

  console.log("=== Test Results ===");
  console.log(JSON.stringify(testResults, null, 2));
  console.log("\n=== Console Messages ===");
  consoleMessages.forEach(msg => console.log(msg));

  // Take screenshot
  await page.screenshot({ path: "mixed-content-test.png" });

  // Output summary
  console.log("\n=== Summary ===");
  console.log("Page Protocol:", testResults.pageProtocol);
  console.log("HTTP API Result:", testResults.httpApi);
  console.log("HTTPS API Result:", testResults.httpsApi);
});
