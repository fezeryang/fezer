import { test, expect } from "@playwright/test";

test.use({ baseURL: "http://localhost:5173" });

test("检查环境变量", async ({ page }) => {
  await page.goto("/jianli");
  await page.waitForTimeout(2000);

  const envInfo = await page.evaluate(() => {
    return {
      VITE_API_URL:
        (window as any).import_meta?.env?.VITE_API_URL || "undefined",
      location: window.location.href,
    };
  });

  console.log("环境变量信息:", envInfo);

  if (envInfo.VITE_API_URL === "undefined") {
    console.log("尝试另一种方式检查...");

    const alternative = await page.evaluate(async () => {
      try {
        const response = await fetch("/@vite/client");
        const text = await response.text();
        return {
          hasViteClient: text.includes("vite"),
          clientLength: text.length,
        };
      } catch {
        return { error: "Cannot fetch @vite/client" };
      }
    });

    console.log("替代检查:", alternative);
  }

  expect(envInfo.VITE_API_URL).toBe("http://localhost:3000");
});
