import { test, expect } from "@playwright/test";
test("home uses actual API statistics and responsive layout", async ({
  page,
  request,
}) => {
  const stats = await (await request.get("/api/v1/stats")).json();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Explore everything/ }),
  ).toBeVisible();
  await expect(page.locator(".stat").first().locator("strong")).toHaveText(
    String(stats.articles),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("autocomplete navigates to a persisted article and opens evidence", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search all knowledge" });
  await search.fill("lith");
  await page.getByRole("option", { name: "Lithium", exact: true }).click();
  await expect(page).toHaveURL(/\/article\/lithium$/);
  await expect(
    page.getByRole("heading", { name: "Lithium", exact: true, level: 1 }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Inspect evidence: Lithium has atomic number 3.",
    })
    .click();
  const dialog = page.getByRole("dialog", { name: "Evidence inspector" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("Royal Society of Chemistry", { exact: false }),
  ).toBeVisible();
  await dialog.getByLabel("Filter evidence").selectOption("CONTRADICTS");
  await expect(
    dialog.getByText(/does not establish that none exists/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close evidence" }).click();
  await expect(dialog).not.toBeVisible();
});
test("search explains retrieval and unknown topics do not auto-research", async ({
  page,
}) => {
  await page.goto("/search?q=lithium");
  await expect(page.locator(".retrieval").first()).toContainText(
    "Exact title or alias",
  );
  await page.goto("/search?q=unindexed-test-concept-xyz");
  await expect(
    page.getByRole("heading", { name: /isn't in the NEXUS library/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Research this topic/ }),
  ).toBeVisible();
});
test("fictional material is explicitly labeled", async ({ page }) => {
  await page.goto("/article/vibranium");
  await expect(page.locator(".ontology-notice")).toContainText(
    "Fictional canon",
  );
  await expect(page.locator(".ontology-notice")).toContainText(
    "not established material science",
  );
});
test("discovery finds a real path and refuses a disconnected one", async ({
  page,
  request,
}) => {
  const graph = await (await request.get("/api/v1/graph/explore")).json();
  const id = (slug: string) =>
    graph.nodes.find((n: { slug: string }) => n.slug === slug).id;
  await page.goto("/discover/path");
  await page.getByLabel("Starting concept").selectOption(id("alkali-metals"));
  await page
    .getByLabel("Destination concept")
    .selectOption(id("lithium-ion-batteries"));
  await page.getByRole("button", { name: /Find connection/ }).click();
  await expect(
    page.getByRole("heading", { name: "Shortest verified path" }),
  ).toBeVisible();
  await expect(page.locator(".path-nodes")).toContainText("Lithium");
  await page.getByLabel("Destination concept").selectOption(id("vibranium"));
  await page.getByRole("button", { name: /Find connection/ }).click();
  await expect(
    page.getByRole("heading", { name: "No verified path found" }),
  ).toBeVisible();
});
test("timeline exposes sourced year precision", async ({ page, request }) => {
  const article = await (await request.get("/api/v1/articles/lithium")).json();
  await page.goto("/timeline/" + article.entity_id);
  await expect(page.locator(".timeline-year").first()).toHaveText("1817");
  await expect(page.locator(".timeline-row").first()).toContainText(
    "YEAR PRECISION",
  );
  await page.getByRole("spinbutton").first().fill("1850");
  await expect(page.locator(".timeline-year").first()).toHaveText("1855");
});
test("theme switches and persists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("research, administration and collections have honest access states", async ({
  page,
}) => {
  await page.goto("/research");
  await expect(
    page.getByRole("link", { name: /Sign in to research/ }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Reviewer access required" }),
  ).toBeVisible();
  await page.goto("/collections");
  await expect(
    page.getByRole("heading", { name: "Your workspace is waiting." }),
  ).toBeVisible();
});
test("comparison shows evidence links and explicit missing values", async ({
  page,
  request,
}) => {
  const graph = await (await request.get("/api/v1/graph/explore")).json();
  const id = (slug: string) =>
    graph.nodes.find((n: { slug: string }) => n.slug === slug).id;
  await page.goto("/compare");
  await page.getByLabel("Concept 1").selectOption(id("lithium"));
  await page.getByLabel("Concept 2").selectOption(id("dyson-sphere"));
  await page
    .getByRole("button", { name: "Compare concepts", exact: true })
    .click();
  await expect(page.locator(".comparison-table")).toBeVisible();
  await expect(page.locator(".comparison-table")).toContainText(
    "Not documented in indexed evidence",
  );
  await expect(
    page.locator(".comparison-table").getByRole("link", { name: "3 ↗" }),
  ).toBeVisible();
});
test("account can save a real article into a persistent collection", async ({
  page,
}) => {
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page
    .getByLabel("Email address")
    .fill(
      `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`,
    );
  await page
    .getByLabel("Password", { exact: false })
    .fill("Nexus-e2e-password-2026");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Keep your curiosity connected." }),
  ).toBeVisible();
  await page.goto("/collections");
  await page.getByLabel("Collection name").fill("Research reading");
  await page
    .getByLabel("Description")
    .fill("Disposable end-to-end test collection");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(
    page.getByRole("heading", { name: "Research reading" }),
  ).toBeVisible();
  await page.goto("/article/lithium");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unsave article", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to collection" }).click();
  await page
    .getByRole("combobox", { name: "Collection", exact: true })
    .selectOption({ label: "Research reading" });
  await page.getByRole("button", { name: "Add article", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add article", exact: true }),
  ).not.toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Lithium", exact: true }),
  ).toBeVisible();
  await page.goto("/collections");
  await page.getByRole("link", { name: /Research reading/ }).click();
  await expect(
    page.getByRole("heading", { name: "Lithium", exact: true }),
  ).toBeVisible();
});
