import { test, expect } from "@playwright/test";

// Owner authentication is server-enforced (Auth.js Google sign-in), so these
// checks hit the real built server: unauthenticated visitors see the Google
// sign-in gate, denied accounts see access-denied, and private APIs stay 401.
// Authenticated owner UI flows need a real Google session and are verified
// manually against a preview (see OWNER_WORKSPACE.md); fixtures cannot mint
// Auth.js sessions.
test("dashboard shows Google sign-in when unauthenticated", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("button", { name: "Sign in with Google" }),
  ).toBeVisible();
  await expect(
    page.getByText("Owner-only. Sign in with Google to manage your portfolio."),
  ).toBeVisible();
  // No private UI leaks before sign-in.
  await expect(
    page.getByRole("heading", { name: "Private workspace" }),
  ).toHaveCount(0);
});
test("denied Google accounts see the access-denied state", async ({
  page,
}) => {
  await page.goto("/dashboard?error=AccessDenied");
  await expect(
    page.getByRole("heading", { name: "Access denied" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try a different account" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});
test("personal portfolio exposes no portal and rejects unauthenticated workspace access", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/dashboard/workspace")).status()).toBe(401);
  expect(
    (
      await request.post("/api/data", {
        data: { operation: "getDoc", args: { path: "Settings/MCP" } },
      })
    ).status(),
  ).toBe(401);
  expect((await request.get("/portal")).status()).toBe(404);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Book a call/ })).toBeVisible();
  // Location pill renders once visibly (animated/duplicate nodes exist for the
  // hero effect), so assert on the first match instead of strict single-match.
  await expect(page.getByText("Alexandria, Egypt").first()).toBeVisible();
  expect(await page.locator('a[href^="/portal"]').count()).toBe(0);
  await expect(page.locator(".mh-pills")).toHaveCSS("opacity", "1");
  const hero = page.getByRole("region", { name: "Introduction" });
  for (const target of [
    hero.getByRole("button", { name: /Book a call/ }),
  ]) {
    expect(
      await target.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        return !!top && el.contains(top);
      }),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/portfolio-mobile.png",
    fullPage: true,
  });
});
