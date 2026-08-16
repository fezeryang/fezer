import { test, expect } from "@playwright/test";

test.describe("About page", () => {
  test("renders the concise three-section editorial layout", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];

    page.on("console", message => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/about", { waitUntil: "networkidle" });

    await expect(page.getByTestId("about-hero")).toBeVisible();
    await expect(page.getByTestId("about-geometry")).toBeAttached();
    await expect(page.getByTestId("about-intro")).toBeAttached();
    await expect(page.getByTestId("about-contact")).toBeAttached();
    await expect(
      page.locator(".navigation--editorial .nav-link--active")
    ).toHaveText("关于");

    await expect(page.getByText("FEZER").first()).toBeVisible();
    await expect(page.getByText("Hi there!", { exact: false })).toHaveCount(0);
    await expect(page.getByText("About Me")).toBeVisible();
    await expect(page.getByText("Say Hi.")).toBeAttached();
    await expect(
      page.getByRole("link", { name: /See what I'm building/ })
    ).toHaveAttribute("href", "/portfolio");
    await expect(page.getByTestId("about-email-link")).toHaveAttribute(
      "href",
      "mailto:cookfezer@gmail.com"
    );
    await expect(page.getByTestId("about-github-link")).toHaveAttribute(
      "href",
      "https://github.com/fezeryang/fezer"
    );

    const pageText = await page.locator("body").innerText();
    expect(pageText).not.toContain("AI 回答规则");
    expect(pageText).not.toContain("Pinecone");
    expect(pageText).not.toContain("项目 0");
    expect(await page.locator(".about-interests").count()).toBe(0);

    const geometryStyle = await page
      .getByTestId("about-geometry")
      .evaluate(element => getComputedStyle(element).pointerEvents);
    expect(geometryStyle).toBe("none");

    const metrics = await page.evaluate(() => ({
      bodyHeight: document.body.scrollHeight,
      viewportHeight: window.innerHeight,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
    }));

    expect(metrics.bodyHeight).toBeLessThanOrEqual(
      metrics.viewportHeight * 3.6
    );
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(consoleErrors).toEqual([]);
  });

  test("keeps the layout usable on a narrow mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/about", { waitUntil: "networkidle" });

    await expect(page.locator(".navigation--editorial")).toBeVisible();
    await expect(page.getByTestId("about-hero")).toBeVisible();
    await expect(page.getByTestId("about-geometry")).toBeAttached();

    const initialMetrics = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(initialMetrics.bodyWidth).toBeLessThanOrEqual(
      initialMetrics.viewportWidth
    );

    await page.getByText("Say Hi.").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("about-contact")).toBeVisible();
    await expect(page.getByTestId("about-email-link")).toBeVisible();
    await expect(page.getByTestId("about-github-link")).toBeVisible();
  });
});
