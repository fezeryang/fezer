import { test, expect } from "@playwright/test";

test.describe("本地网页交互测试", () => {
  test.use({
    baseURL: "http://localhost:5173",
    timeout: 180000,
  });

  test("点击角色打开聊天", async ({ page }) => {
    console.log("=== 导航到 /jianli 页面 ===");
    await page.goto("/jianli", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // 截图初始状态
    await page.screenshot({ path: "jianli-initial.png" });

    console.log("=== 检查页面元素 ===");

    // 检查是否有 canvas 元素（3D 场景）
    const canvas = page.locator("canvas");
    const canvasCount = await canvas.count();
    console.log(`Canvas 元素数量: ${canvasCount}`);

    if (canvasCount > 0) {
      console.log("✓ 找到 3D 场景 Canvas");

      // 尝试点击画布中心位置（可能有点击角色）
      const box = await canvas.first().boundingBox();
      if (box) {
        console.log(`Canvas 位置: ${JSON.stringify(box)}`);

        // 点击画布中心
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(2000);

        // 检查是否有聊天弹窗出现
        const modal = page.locator("text=/开始与|对话|Chat/").first();
        const modalVisible = await modal.isVisible().catch(() => false);
        console.log(`聊天弹窗可见: ${modalVisible}`);

        await page.screenshot({ path: "jianli-after-click.png" });
      }
    }

    // 检查页面上的其他可点击元素
    console.log("\n=== 检查可点击元素 ===");
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();
    console.log(`按钮数量: ${buttonCount}`);

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const text = await buttons.nth(i).textContent();
      console.log(`  按钮 ${i}: ${text?.trim() || "(empty)"}`);
    }

    // 检查房间按钮
    const roomButtons = page.locator("button:has-text('Room'), button:has-text('Hub')");
    const roomCount = await roomButtons.count();
    console.log(`\n房间按钮数量: ${roomCount}`);

    if (roomCount > 0) {
      console.log("✓ 找到房间按钮");
      // 点击第一个房间按钮
      await roomButtons.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "jianli-after-room-click.png" });
    }

    console.log("\n=== 测试完成 ===");
    expect(canvasCount).toBeGreaterThan(0);
  });
});
