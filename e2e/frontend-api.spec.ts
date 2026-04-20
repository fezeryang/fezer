import { test, expect } from "@playwright/test";

test("Frontend API connection test", async ({ page, context }) => {
  // Enable request interception
  const apiRequests: string[] = [];

  context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/")) {
      apiRequests.push(url);
      console.log("API Request:", url);
    }
    route.continue();
  });

  // Navigate to the jianli route
  console.log("Navigating to https://fezeryang.github.io/fezer/jianli");
  await page.goto("https://fezeryang.github.io/fezer/jianli", {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  // Take a screenshot
  await page.screenshot({ path: "jianli-page.png" });
  console.log("Screenshot saved to jianli-page.png");

  // Wait for page to load
  await page.waitForTimeout(3000);

  // Check for chat-related elements
  const chatModal = page.locator("text=/聊天|Chat|发送|Send|message/i").first();
  const isVisible = await chatModal.isVisible().catch(() => false);
  console.log("Chat element visible:", isVisible);

  // Try to find input field
  const input = page.locator("input[type='text'], textarea").first();
  const inputExists = await input.count();
  console.log("Input fields found:", inputExists);

  // If input exists, try to send a message
  if (inputExists > 0) {
    console.log("Sending test message...");
    await input.first().fill("你好");
    await page.waitForTimeout(1000);

    // Look for send button
    const sendButton = page.locator("button:has-text('发送'), button:has-text('Send')").first();
    if (await sendButton.isVisible().catch(() => false)) {
      await sendButton.click();
      await page.waitForTimeout(5000);
    }

    // Take another screenshot after interaction
    await page.screenshot({ path: "jianli-after-input.png" });
  }

  // Log all API requests
  console.log("API Requests made:", apiRequests);

  // Check console for any errors
  const logs: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "error") {
      logs.push(msg.text());
      console.log("Console error:", msg.text());
    }
  });

  // Wait a bit more to catch any delayed requests
  await page.waitForTimeout(5000);

  // Output results
  console.log("=== Test Results ===");
  console.log("API Requests:", apiRequests.length);
  console.log("Console Errors:", logs.length);

  if (apiRequests.length > 0) {
    console.log("SUCCESS: Frontend is making API requests");
    apiRequests.forEach(req => console.log("  -", req));
  } else {
    console.log("INFO: No API requests detected");
  }
});
