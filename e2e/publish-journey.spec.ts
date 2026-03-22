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
  await page.goto("/blog");
  await expect(page.getByText("Architectural Sonics")).toBeVisible();

  await page.goto("/portfolio");
  await expect(page.getByText("Kinetic Typography Engine")).toBeVisible();
});

test("blocks non-admin users from admin routes", async ({ page }) => {
  await page.route("**/api/trpc/auth.me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        asTrpcResponse({
          id: "user-1",
          role: "user",
          email: "user@example.com",
          name: "Regular User",
        }),
      ),
    });
  });

  await page.goto("/admin/blog");
  await expect(page.getByTestId("admin-guard-forbidden")).toBeVisible();
});
