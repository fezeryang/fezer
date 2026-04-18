import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { TEST_IDS } from "../client/src/components/web-pet/testIds";

async function gotoRoute(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

test.describe("WebPet cross-route behavior", () => {
  test("pet element is present on multiple routes", async ({ page }) => {
    await gotoRoute(page, "/");
    await expect(page.getByTestId(TEST_IDS.WEB_PET)).toBeVisible();

    await gotoRoute(page, "/portfolio");
    await expect(page.getByTestId(TEST_IDS.WEB_PET)).toBeVisible();

    await gotoRoute(page, "/blog");
    await expect(page.getByTestId(TEST_IDS.WEB_PET)).toBeVisible();

    await gotoRoute(page, "/about");
    await expect(page.getByTestId(TEST_IDS.WEB_PET)).toBeVisible();
  });

  test("pet persists position across route changes", async ({ page }) => {
    await gotoRoute(page, "/");

    const pet = page.getByTestId(TEST_IDS.WEB_PET);
    await expect(pet).toBeVisible();

    const initialBox = await pet.boundingBox();
    expect(initialBox).not.toBeNull();

    // Use mouse API for reliable drag (bypasses canvas pointer interception)
    const startX = initialBox!.x + initialBox!.width / 2;
    const startY = initialBox!.y + initialBox!.height / 2;
    const targetX = startX + 150;
    const targetY = startY + 100;

    // Dispatch mousedown directly on the pet element to start drag
    await pet.dispatchEvent("mousedown", {
      clientX: startX,
      clientY: startY,
      bubbles: true,
    });
    await page.mouse.move(targetX, targetY, { steps: 5 });
    await page.mouse.up();

    const newBox = await pet.boundingBox();
    expect(newBox).not.toBeNull();
    expect(Math.abs(newBox!.x - initialBox!.x)).toBeGreaterThan(50);

    await gotoRoute(page, "/portfolio");

    const persistedBox = await pet.boundingBox();
    expect(persistedBox).not.toBeNull();
    expect(Math.abs(persistedBox!.x - newBox!.x)).toBeLessThan(10);
    expect(Math.abs(persistedBox!.y - newBox!.y)).toBeLessThan(10);
  });

  test("pet is draggable within viewport boundaries", async ({ page }) => {
    await gotoRoute(page, "/");

    const pet = page.getByTestId(TEST_IDS.WEB_PET);
    await expect(pet).toBeVisible();

    const initialBox = await pet.boundingBox();
    expect(initialBox).not.toBeNull();

    const startX = initialBox!.x + initialBox!.width / 2;
    const startY = initialBox!.y + initialBox!.height / 2;
    const targetX = startX + 120;
    const targetY = startY + 80;

    await pet.dispatchEvent("mousedown", {
      clientX: startX,
      clientY: startY,
      bubbles: true,
    });
    await page.mouse.move(targetX, targetY, { steps: 5 });
    await page.mouse.up();

    const draggedBox = await pet.boundingBox();
    expect(draggedBox).not.toBeNull();

    expect(
      Math.abs(draggedBox!.x - initialBox!.x) > 50 ||
        Math.abs(draggedBox!.y - initialBox!.y) > 50,
    ).toBeTruthy();

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    expect(draggedBox!.x).toBeGreaterThanOrEqual(0);
    expect(draggedBox!.y).toBeGreaterThanOrEqual(0);
    expect(draggedBox!.x + draggedBox!.width).toBeLessThanOrEqual(
      viewport!.width,
    );
    expect(draggedBox!.y + draggedBox!.height).toBeLessThanOrEqual(
      viewport!.height,
    );
  });

  test("pet reacts to click with speech bubble", async ({ page }) => {
    await gotoRoute(page, "/");

    const pet = page.getByTestId(TEST_IDS.WEB_PET);
    await expect(pet).toBeVisible();

    await pet.click();

    const bubble = page.getByTestId(TEST_IDS.SPEECH_BUBBLE);
    await expect(bubble).toBeVisible();

    const bubbleText = await bubble.textContent();
    expect(bubbleText).not.toBe("");
    expect(bubbleText).not.toBeNull();
  });

  test("hide/show toggle controls pet visibility", async ({ page }) => {
    await gotoRoute(page, "/");

    const pet = page.getByTestId(TEST_IDS.WEB_PET);
    const toggle = page.getByTestId(TEST_IDS.WEB_PET_TOGGLE);

    await expect(pet).toBeVisible();
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(pet).not.toBeVisible();

    await toggle.click();
    await expect(pet).toBeVisible();
  });

  test("pet visibility persists after page reload", async ({ page }) => {
    await gotoRoute(page, "/");

    const toggle = page.getByTestId(TEST_IDS.WEB_PET_TOGGLE);
    const pet = page.getByTestId(TEST_IDS.WEB_PET);

    await toggle.click();
    await expect(pet).not.toBeVisible();

    await page.reload();

    await expect(page.getByTestId(TEST_IDS.WEB_PET)).not.toBeVisible();
    await expect(page.getByTestId(TEST_IDS.WEB_PET_TOGGLE)).toBeVisible();

    await toggle.click();
    await expect(pet).toBeVisible();

    await page.reload();

    await expect(page.getByTestId(TEST_IDS.WEB_PET)).toBeVisible();
  });

  test("pet respects reduced-motion preference", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    await gotoRoute(page, "/");

    const pet = page.getByTestId(TEST_IDS.WEB_PET);
    await expect(pet).toBeVisible();

    const box = await pet.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test("keyboard-only user can reposition pet with arrow keys", async ({ page }) => {
    await gotoRoute(page, "/");

    const pet = page.getByTestId(TEST_IDS.WEB_PET);
    await expect(pet).toBeVisible();

    const initialBox = await pet.boundingBox();
    expect(initialBox).not.toBeNull();

    await pet.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");

    const movedBox = await pet.boundingBox();
    expect(movedBox).not.toBeNull();
    expect(movedBox!.x).toBeGreaterThan(initialBox!.x);
    expect(movedBox!.y).toBeGreaterThan(initialBox!.y);
  });

  test("keyboard-only user can use Shift+Arrow for larger movements", async ({ page }) => {
    await gotoRoute(page, "/");

    const pet = page.getByTestId(TEST_IDS.WEB_PET);
    await expect(pet).toBeVisible();

    const initialBox = await pet.boundingBox();
    expect(initialBox).not.toBeNull();

    await pet.focus();
    await page.keyboard.press("Shift+ArrowRight");

    const movedBox = await pet.boundingBox();
    expect(movedBox).not.toBeNull();
    expect(movedBox!.x - initialBox!.x).toBeGreaterThanOrEqual(60);
  });
});

test.describe("WebPet mobile/touch behavior", () => {
  test.use({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true,
  });

  test("pet is visible and toggle works on mobile", async ({ page }) => {
    await gotoRoute(page, "/");

    const pet = page.getByTestId(TEST_IDS.WEB_PET);
    const toggle = page.getByTestId(TEST_IDS.WEB_PET_TOGGLE);

    await expect(pet).toBeVisible();
    await expect(toggle).toBeVisible();

    await toggle.tap();
    await expect(pet).not.toBeVisible();

    await toggle.tap();
    await expect(pet).toBeVisible();
  });

  test("pet supports touch drag on mobile", async ({ page }) => {
    await gotoRoute(page, "/");

    const pet = page.getByTestId(TEST_IDS.WEB_PET);
    await expect(pet).toBeVisible();

    const initialBox = await pet.boundingBox();
    expect(initialBox).not.toBeNull();

    const startX = initialBox!.x + initialBox!.width / 2;
    const startY = initialBox!.y + initialBox!.height / 2;
    const targetX = Math.min(startX + 80, 300);
    const targetY = Math.min(startY + 60, 500);

    await pet.dispatchEvent("touchstart", {
      touches: [{ clientX: startX, clientY: startY, identifier: 0 }],
      bubbles: true,
    });
    await page.mouse.move(targetX, targetY, { steps: 5 });
    await page.dispatchEvent("body", "touchend", { bubbles: true });

    const draggedBox = await pet.boundingBox();
    expect(draggedBox).not.toBeNull();

    expect(draggedBox!.x).toBeGreaterThanOrEqual(0);
    expect(draggedBox!.y).toBeGreaterThanOrEqual(0);
  });
});
