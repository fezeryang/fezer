import { expect, test } from "@playwright/test";

const BLOG_POST_SLUG = "/blog/nux-ai-financial-research-terminal";
const BLOG_POST_TITLE = "NUX：把 AI 金融研究终端做成一条证据链";
const BLOG_POST_EXCERPT =
  "一次对 NUX 当前代码库的产品和架构梳理";

test.describe("Blog detail page", () => {
  test("renders the latest post in editorial layout", async ({ page }) => {
    await page.goto(BLOG_POST_SLUG, { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: BLOG_POST_TITLE }),
    ).toBeVisible();
    await expect(page.getByText(BLOG_POST_EXCERPT)).toBeVisible();
    await expect(page.getByText("2026.05.26")).toBeVisible();
    await expect(
      page.getByText("金融研究不是让 AI 给一句答案。"),
    ).toBeVisible();
  });

  test("navigates back to blog surface and cover from detail page", async ({
    page,
  }) => {
    await page.goto(BLOG_POST_SLUG, { waitUntil: "domcontentloaded" });

    await page.getByRole("link", { name: "← 返回展示页" }).click();
    await expect(page).toHaveURL(/\/blog\/surface$/);

    await page.goto(BLOG_POST_SLUG, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "返回封面页 →" }).click();
    await expect(page).toHaveURL(/\/blog$/);
  });
});
