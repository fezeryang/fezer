import { test, expect } from "@playwright/test";

test.describe("调试聊天功能", () => {
  test.use({
    baseURL: "http://localhost:5173",
    timeout: 180000,
  });

  test("捕获网络请求和控制台错误", async ({ page }) => {
    const logs: string[] = [];
    const errors: string[] = [];
    const requests: Array<{ method: string; url: string; status?: number }> = [];

    // 监听所有控制台消息
    page.on("console", msg => {
      const text = msg.text();
      logs.push(`[${msg.type()}] ${text}`);
      console.log(`[控制台] ${msg.type()}: ${text}`);
    });

    // 监听所有网络请求
    page.on("request", request => {
      const url = request.url();
      if (url.includes("/api/") || url.includes("localhost:3000")) {
        console.log(`[请求] ${request.method()} ${url}`);
        requests.push({ method: request.method(), url });
      }
    });

    // 监听所有响应
    page.on("response", async response => {
      const url = response.url();
      if (url.includes("/api/") || url.includes("localhost:3000")) {
        const status = response.status();
        const ok = response.ok();
        console.log(`[响应] ${status} ${ok ? "OK" : "FAIL"} - ${url}`);

        const req = requests.find(r => r.url === url);
        if (req) req.status = status;

        if (!ok) {
          const text = await response.text().catch(() => "N/A");
          console.log(`[响应错误] ${text}`);
        }
      }
    });

    // 监听页面错误
    page.on("pageerror", error => {
      console.log(`[页面错误] ${error.message}`);
      errors.push(error.message);
    });

    console.log("=== 导航到 /jianli 页面 ===");
    await page.goto("/jianli", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    console.log("\n=== 尝试直接调用 API ===");

    const apiResult = await page.evaluate(async () => {
      console.log("[浏览器] 开始 API 调用");

      try {
        // 检查环境变量
        const envImport = import.meta.env;
        console.log("[浏览器] VITE_API_URL:", envImport.VITE_API_URL);

        const apiUrl = envImport.VITE_API_URL || "/api";
        const fullUrl = apiUrl.startsWith("http") ? `${apiUrl}/chat` : `http://localhost:3000/api/chat`;

        console.log("[浏览器] 请求 URL:", fullUrl);

        const response = await fetch(fullUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userInput: "你好" }),
        });

        console.log("[浏览器] 响应状态:", response.status);
        console.log("[浏览器] 响应 OK:", response.ok);

        const text = await response.text();
        console.log("[浏览器] 响应文本长度:", text.length);
        console.log("[浏览器] 响应文本前100字符:", text.substring(0, 100));

        try {
          const data = JSON.parse(text);
          console.log("[浏览器] 解析 JSON 成功");
          console.log("[浏览器] 有 text 字段:", !!data.text);
          return { success: true, status: response.status, hasText: !!data.text };
        } catch (e) {
          console.log("[浏览器] JSON 解析失败:", e);
          return { success: false, status: response.status, error: "JSON parse failed" };
        }
      } catch (error) {
        console.log("[浏览器] 请求失败:", error);
        return { success: false, error: String(error) };
      }
    });

    console.log("\n=== API 调用结果 ===");
    console.log(JSON.stringify(apiResult, null, 2));

    console.log("\n=== 网络请求汇总 ===");
    requests.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.method} ${r.url} -> ${r.status || "pending"}`);
    });

    console.log("\n=== 控制台错误汇总 ===");
    errors.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e}`);
    });

    await page.screenshot({ path: "debug-chat.png" });

    // 输出结果
    expect(apiResult).toBeDefined();
  });
});
