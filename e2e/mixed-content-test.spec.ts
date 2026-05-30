import { test, expect } from "@playwright/test";
import { CHAT_REQUEST_BODY, LOCAL_API_BASE_URL } from "./support/constants";

test("Local API protocol diagnostic test", async ({ page }) => {
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

  await page.goto("/jianli", { waitUntil: "domcontentloaded" });

  const testResults = await page.evaluate(
    async ({ apiBaseURL, body }) => {
      try {
        const response = await fetch(`${apiBaseURL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await response.json()) as { text?: string };
        return {
          api: {
            status: response.status,
            ok: response.ok,
            hasText: Boolean(data.text),
          },
          pageProtocol: window.location.protocol,
          pageURL: window.location.href,
        };
      } catch (error) {
        return {
          api: {
            error: error instanceof Error ? error.message : String(error),
          },
          pageProtocol: window.location.protocol,
          pageURL: window.location.href,
        };
      }
    },
    { apiBaseURL: LOCAL_API_BASE_URL, body: CHAT_REQUEST_BODY }
  );

  console.log("=== Test Results ===");
  console.log(JSON.stringify(testResults, null, 2));
  console.log("\n=== Console Messages ===");
  consoleMessages.forEach(msg => console.log(msg));

  // Output summary
  console.log("\n=== Summary ===");
  console.log("Page Protocol:", testResults.pageProtocol);
  console.log("Local API Result:", testResults.api);

  expect(testResults.pageProtocol).toBe("http:");
  expect(testResults.api.ok).toBe(true);
  expect(testResults.api.hasText).toBe(true);
});
