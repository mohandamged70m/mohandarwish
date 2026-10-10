import { test, expect, type Page } from "@playwright/test";

const project = {
  _id: "project-1",
  title: "Product launch",
  clientName: "Demo client",
  clientEmail: "client@example.com",
  summary: "Deliver a focused MVP",
  status: "active",
  paymentStatus: "unpaid",
  invoiceUrl: "",
  dueDate: "2026-12-01",
  createdAt: 1,
  updatedAt: 1,
};
async function ownerFixture(page: Page) {
  const writes: { operation: string; args: Record<string, unknown> }[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = { data: null };
    if (url.pathname === "/api/auth/owner") body = { authenticated: true };
    if (url.pathname === "/api/data") {
      const args = route.request().postDataJSON();
      body = {
        data:
          args.operation === "listCollection"
            ? []
            : args.args.path === "Settings/MCP"
              ? { assistantEnabled: false }
              : null,
      };
    }
    if (url.pathname === "/api/dashboard/workspace") {
      if (route.request().method() === "POST") {
        writes.push(route.request().postDataJSON());
        body = { data: null };
      } else if (url.searchParams.has("projectId")) {
        body = {
          data: writes
            .filter((w) => w.operation === "addNote")
            .map((w, i) => ({
              _id: String(i),
              projectId: project._id,
              body: w.args.body,
              createdAt: Date.now(),
            })),
        };
      } else
        body = { data: { projects: [project], leads: [], milestones: [] } };
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return writes;
}
test("owner workspace saves a private project note", async ({ page }) => {
  const writes = await ownerFixture(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Private workspace" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Product launch/ }).click();
  await page.getByLabel("New note").fill("Approve launch checklist");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByText("Approve launch checklist", { exact: true }),
  ).toBeVisible();
  expect(writes).toContainEqual({
    operation: "addNote",
    args: { projectId: project._id, body: "Approve launch checklist" },
  });
  await page.screenshot({
    path: "test-results/owner-workspace.png",
    fullPage: true,
  });
});
test("workspace fits a narrow mobile screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await ownerFixture(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Private workspace" }),
  ).toBeVisible();
  const overflow = await page
    .locator("main")
    .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({
    path: "test-results/owner-mobile.png",
    fullPage: true,
  });
});
test("case-study metrics can be edited without rewriting unfinished input", async ({
  page,
}) => {
  await ownerFixture(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Add Project", exact: true }).click();
  const metrics = page.getByLabel("Results / metrics", { exact: true });
  await metrics.fill("Latency");
  await expect(metrics).toHaveValue("Latency");
  await metrics.fill("Latency: 120ms\nTime saved: 4h/week");
  await expect(metrics).toHaveValue("Latency: 120ms\nTime saved: 4h/week");
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
  await expect(page.getByRole("link", { name: "View my work" })).toBeVisible();
  await expect(
    page.getByText(
      "I build SaaS MVPs, AI features and automation that turn business problems into working products.",
    ),
  ).toBeVisible();
  expect(await page.locator('a[href^="/portal"]').count()).toBe(0);
  await expect(page.locator(".mh-pills")).toHaveCSS("opacity", "1");
  const hero = page.getByRole("region", { name: "Introduction" });
  for (const target of [
    hero.getByRole("link", { name: "View my work" }),
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
