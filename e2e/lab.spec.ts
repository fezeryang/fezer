import { expect, test } from "@playwright/test";

test.describe("Lab image cube", () => {
  test("loads the six studio images without blocking the page", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];

    page.on("console", message => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/lab", { waitUntil: "networkidle" });
    await expect(page.getByTestId("lab-canvas")).toBeAttached();

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              new Set(
                performance
                  .getEntriesByType("resource")
                  .map(entry => entry.name)
                  .filter(name => name.includes("/studioimage/catlogo-"))
              ).size
          ),
        { timeout: 10_000 }
      )
      .toBe(6);

    const metrics = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      pointerEvents: getComputedStyle(
        document.querySelector("[data-testid=lab-canvas]")!
      ).pointerEvents,
    }));

    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.pointerEvents).toBe("none");
    expect(consoleErrors).toEqual([]);
  });
});
