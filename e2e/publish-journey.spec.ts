import { expect, test } from "@playwright/test";

type TrpcEnvelope = {
  result: {
    data: {
      json: unknown;
    };
  };
};

function asTrpcResponse(json: unknown): TrpcEnvelope[] {
  return [
    {
      result: {
        data: {
          json,
        },
      },
    },
  ];
}

test("shows static content on public pages without API stubs", async ({
  page,
}) => {
  await page.goto("/blog/surface", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", {
      name: "NUX：把 AI 金融研究终端做成一条证据链",
    })
  ).toBeVisible();

  await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "西藏之旅" })).toBeVisible();
});

test("blocks non-admin users from admin routes", async ({ page }) => {
  await page.route("**/api/trpc/auth.me*", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        asTrpcResponse({
          id: "user-1",
          role: "user",
          email: "user@example.com",
          name: "Regular User",
        })
      ),
    });
  });

  await page.goto("/admin/blog", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("admin-guard-forbidden")).toBeVisible();
});
