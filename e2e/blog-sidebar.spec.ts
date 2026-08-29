import { expect, test } from "@playwright/test";

const BLOG_POST_SLUG = "/blog/deploy-ollama-on-school-ai-platform";
const SIDEBAR_NAV = 'nav[aria-label="Page sections"]';
// 11 h2 + 10 h3 headings in this post
const EXPECTED_DASHES = 21;
const CLICK_TARGET_INDEX = 6;

const waitForSidebar = (page: import("@playwright/test").Page) =>
  expect(page.locator(`${SIDEBAR_NAV} button`)).toHaveCount(EXPECTED_DASHES);

const getHeadingIds = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll("article h2[id], article h3[id]")).map(
      el => el.id
    )
  );

test.describe("Blog post ProximitySidebar", () => {
  test("renders one dash per h2/h3 heading on desktop", async ({ page }) => {
    await page.goto(BLOG_POST_SLUG, { waitUntil: "domcontentloaded" });

    const dashes = page.locator(`${SIDEBAR_NAV} button`);
    await expect(dashes).toHaveCount(EXPECTED_DASHES);

    const ids = await getHeadingIds(page);
    expect(ids).toHaveLength(EXPECTED_DASHES);
    // every dash targets an existing heading id
    for (const id of ids) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
  });

  test("clicking a dash scrolls the heading under the fixed nav and updates the hash", async ({
    page,
  }) => {
    await page.goto(BLOG_POST_SLUG, { waitUntil: "domcontentloaded" });
    // wait for React to mount before reading the DOM
    await waitForSidebar(page);
    const ids = await getHeadingIds(page);
    const targetId = ids[CLICK_TARGET_INDEX];

    // scroll away first so the jump covers real distance mid-damped-scroll
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(600);

    await page.locator(`${SIDEBAR_NAV} button`).nth(CLICK_TARGET_INDEX).click();

    // smooth window scroll + DampedScrollView's .3s transition tail
    await page.waitForTimeout(1200);

    const info = await page.evaluate(id => {
      const el = document.getElementById(id);
      return {
        hash: decodeURIComponent(window.location.hash.slice(1)),
        top: el ? el.getBoundingClientRect().top : null,
      };
    }, targetId);

    expect(info.hash).toBe(targetId);
    // heading should land at the scrollOffset clearance (~96px), allowing
    // for prose margins — not at the viewport top (0) nor off-screen
    expect(info.top).not.toBeNull();
    expect(info.top!).toBeGreaterThan(40);
    expect(info.top!).toBeLessThan(200);

    // the anchor line (40% viewport) sits in the body FOLLOWING the jumped
    // heading, so the spy legitimately marks a later section as current —
    // but never one before the jump target (exact anchor math is covered
    // by the "tracks the active section" test below)
    const currentIndex = await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll('nav[aria-label="Page sections"] button')
      );
      return buttons.findIndex(
        b => b.getAttribute("aria-current") === "location"
      );
    });
    expect(currentIndex).toBeGreaterThanOrEqual(CLICK_TARGET_INDEX);
  });

  test("tracks the active section while scrolling", async ({ page }) => {
    await page.goto(BLOG_POST_SLUG, { waitUntil: "domcontentloaded" });

    await page.mouse.wheel(0, 3000);
    // wait past the damped transition so measurement has settled
    await page.waitForTimeout(900);

    // the dash marked current must be the heading nearest the 40% anchor
    // line — the same metric the scroll-spy uses
    const state = await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll('nav[aria-label="Page sections"] button')
      );
      const activeIndex = buttons.findIndex(
        b => b.getAttribute("aria-current") === "location"
      );
      const headings = Array.from(
        document.querySelectorAll("article h2[id], article h3[id]")
      );
      const anchorY = window.innerHeight * 0.4;
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      headings.forEach((heading, index) => {
        const rect = heading.getBoundingClientRect();
        const contains = rect.top <= anchorY && rect.bottom >= anchorY;
        const distance = contains
          ? 0
          : Math.min(
              Math.abs(rect.top - anchorY),
              Math.abs(rect.bottom - anchorY)
            );
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      return { activeIndex, bestIndex };
    });

    expect(state.activeIndex).toBeGreaterThanOrEqual(0);
    expect(state.activeIndex).toBe(state.bestIndex);
  });

  test("hides the sidebar on mobile-width viewports", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 });
    await page.goto(BLOG_POST_SLUG, { waitUntil: "domcontentloaded" });

    await expect(page.locator(SIDEBAR_NAV)).toBeHidden();
  });
});
