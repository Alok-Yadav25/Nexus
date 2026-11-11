import { test, expect, type Page } from "@playwright/test";

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      /hydrated|hydration|content security policy|refused to execute/i.test(
        message.text(),
      )
    )
      errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

async function account(page: Page) {
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page
    .getByLabel("Email address")
    .fill(
      `nexus3-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`,
    );
  await page
    .getByLabel("Password", { exact: false })
    .fill("Nexus-test-passphrase-2026");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("native search dialog traps focus, isolates the page and restores focus", async ({
  page,
}) => {
  await page.goto("/explore");
  const trigger = page.locator(".command-button");
  await trigger.focus();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Global search" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox")).toBeFocused();
  // Attempting to focus an outside control must fail while showModal makes it inert.
  await page
    .locator("#article-sort")
    .evaluate((el: HTMLSelectElement) => el.focus());
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Close search" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("autocomplete IDs are unique and Escape cannot submit an old selection", async ({
  page,
}) => {
  await page.goto("/search?q=lithium");
  await page
    .getByRole("button", { name: "Search anything", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Global search" }),
  ).toBeVisible();
  const inputs = page.getByRole("combobox", {
    name: "Search all knowledge",
    includeHidden: true,
  });
  const ids = await inputs.evaluateAll((elements) =>
    elements.map((el) => el.getAttribute("aria-controls")),
  );
  expect(ids.length).toBe(2);
  expect(new Set(ids).size).toBe(ids.length);
  const search = page.getByRole("dialog").getByRole("combobox");
  await search.fill("lith");
  await page.getByRole("option", { name: "Lithium", exact: true }).waitFor();
  await search.press("ArrowDown");
  const active = await search.getAttribute("aria-activedescendant");
  expect(active).toBeTruthy();
  await expect(page.locator(`[id="${active}"]`)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // Tab closes the suggestions without dismissing the dialog.
  await search.press("Tab");
  await search.focus();
  await search.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const mainSearch = page.getByRole("combobox", {
    name: "Search all knowledge",
  });
  await mainSearch.fill("lith");
  await page.getByRole("option", { name: "Lithium", exact: true }).waitFor();
  await mainSearch.press("ArrowDown");
  await mainSearch.press("Escape");
  await mainSearch.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=lith$/);
});

test("exploration filters survive reload and browser history", async ({
  page,
}) => {
  await page.goto("/explore?sort=title&ref=regression");
  await page.getByRole("button", { name: "Chemistry", exact: true }).click();
  await expect(page).toHaveURL(/domain=Chemistry/);
  expect(new URL(page.url()).searchParams.get("ref")).toBe("regression");
  await page.reload();
  await expect(page.getByLabel("Sort articles")).toHaveValue("title");
  await expect(
    page.getByRole("button", { name: "Chemistry", exact: true }),
  ).toHaveClass(/active/);
  await page
    .getByRole("button", { name: "All knowledge", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "All knowledge", exact: true }),
  ).toHaveClass(/active/);
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Chemistry", exact: true }),
  ).toHaveClass(/active/);
});

test("research sign-in retains topic, ontology and canonical disambiguation", async ({
  page,
}) => {
  await page.goto(
    "/research?topic=Mercury&ontology=Planet&canonical=wikidata%3AQ308",
  );
  await page.getByRole("link", { name: /Sign in to research/ }).click();
  await expect(page).toHaveURL(/\/auth\?next=/);
  const next = new URL(page.url()).searchParams.get("next")!;
  const destination = new URL(next, "https://nexus.test");
  expect(destination.searchParams.get("canonical")).toBe("wikidata:Q308");
  expect(destination.searchParams.get("ontology")).toBe("Planet");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page
    .getByLabel("Email address")
    .fill(`return-${Date.now()}-${Math.random()}@example.test`);
  await page
    .getByLabel("Password", { exact: false })
    .fill("Nexus-test-passphrase-2026");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/research\?/);
  await expect(page.getByLabel("Topic", { exact: true })).toHaveValue(
    "Mercury",
  );
  await expect(page.getByLabel("Proposed ontology")).toHaveValue("Planet");
  expect(new URL(page.url()).searchParams.get("canonical")).toBe(
    "wikidata:Q308",
  );
});

test("saved membership survives reload and unsaving updates the dashboard", async ({
  page,
}) => {
  await account(page);
  await page.goto("/article/lithium");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unsave article" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Unsave article" }).click();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Lithium", exact: true }),
  ).toHaveCount(0);
});

test("cancelled research stops automatic polling and event subscriptions", async ({
  page,
}) => {
  await account(page);
  const { token } = await (await page.request.get("/api/v1/auth/csrf")).json();
  const headers = { "X-CSRF-TOKEN": token };
  const created = await page.request.post("/api/v1/research", {
    headers,
    data: {
      topic: `Private lifecycle regression ${Date.now()}`,
      ontology: "UNCLASSIFIED",
    },
  });
  expect(created.ok()).toBe(true);
  const job = await created.json();
  const cancelled = await page.request.post(
    `/api/v1/research/${job.id}/cancel`,
    { headers },
  );
  expect(cancelled.ok()).toBe(true);
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().includes(`/api/v1/research/${job.id}`)) requests++;
  });
  await page.goto(`/research/${job.id}`);
  await expect(
    page.getByText(
      "Research paused at a review or final state · updates stopped",
    ),
  ).toBeVisible();
  const count = requests;
  await page.waitForTimeout(11000); // Exceeds the removed ten-second polling interval.
  expect(requests).toBe(count);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => requests).toBe(count + 1);
});

test("collection add and remove refresh cached list counts during navigation", async ({
  page,
}) => {
  async function navigate(name: string) {
    const menu = page.getByRole("button", {
      name: "Open navigation",
      exact: true,
    });
    if (await menu.isVisible()) await menu.click();
    await page
      .locator("aside.sidebar")
      .getByRole("link", { name, exact: true })
      .click();
  }
  await account(page);
  await navigate("Collections");
  await page.getByLabel("Collection name").fill("Cache consistency");
  await page
    .getByRole("button", { name: "Create collection", exact: true })
    .click();
  await page.getByRole("link", { name: /Cache consistency/ }).click();
  await page
    .getByRole("link", { name: "All collections", exact: true })
    .click();
  await navigate("Explore knowledge");
  await page
    .locator(".article-card")
    .filter({
      has: page.getByRole("heading", { name: "Lithium", exact: true }),
    })
    .click();
  await page
    .getByRole("button", { name: "Add to collection", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Collection", exact: true })
    .selectOption({ label: "Cache consistency" });
  await page.getByRole("button", { name: "Add article", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add article", exact: true }),
  ).not.toBeVisible();
  await navigate("Collections");
  const collection = page.getByRole("link", { name: /Cache consistency/ });
  await expect(collection).toContainText("1 articles");
  await collection.click();
  await page
    .getByRole("button", { name: "Remove Lithium", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove Lithium", exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("link", { name: "All collections", exact: true })
    .click();
  await expect(collection).toContainText("0 articles");
});

test("evidence summary distinguishes retrieval, verification and absent conflicts", async ({
  page,
}) => {
  await page.goto("/article/lithium");
  const summary = page.getByRole("region", {
    name: "Article evidence and freshness",
  });
  await expect(summary).toContainText("Last claim verification");
  await expect(summary).toContainText("Not recorded");
  await expect(summary).toContainText("Latest source retrieval");
  await expect(summary).toContainText(
    "does not establish independent agreement",
  );
  await summary.getByRole("button", { name: "Inspect a claim" }).click();
  await expect(
    page.getByRole("dialog", { name: "Evidence inspector" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    summary.getByRole("button", { name: "Inspect a claim" }),
  ).toBeFocused();
});

test("light theme renders from its cookie even with storage blocked", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: "nexus-theme", value: "light", url: baseURL! },
  ]);
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  const response = await page.goto("/graph");
  expect(await response!.text()).toContain('data-theme="light"');
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".react-flow.light")).toBeVisible();
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("published article SEO, missing status, sitemap and security headers are real", async ({
  request,
}) => {
  const response = await request.get("/article/lithium");
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("'nonce-");
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["x-content-type-options"]).toBe("nosniff");
  const html = await response.text();
  expect(html).toContain("application/ld+json");
  expect(html).toContain('rel="canonical"');
  expect(html).toContain('property="og:title"');
  expect(
    (await request.get("/article/missing-article-regression-xyz")).status(),
  ).toBe(404);
  const index = await request.get("/sitemap-index.xml");
  expect(index.status()).toBe(200);
  const xml = await index.text();
  expect(xml).toContain("sitemap/0.xml");
  const sitemap = await request.get("/sitemap/0.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("/article/lithium");
});

test("a saved journey explains each relationship and persists explored steps", async ({
  page,
  request,
}) => {
  const graph = await (await request.get("/api/v1/graph/explore")).json();
  const id = (slug: string) =>
    graph.nodes.find((n: { slug: string }) => n.slug === slug).id;
  await account(page);
  await page.goto("/journeys");
  await page
    .getByLabel("Journey starting concept")
    .selectOption(id("alkali-metals"));
  await page
    .getByLabel("Journey destination")
    .selectOption(id("lithium-ion-batteries"));
  await page.getByRole("button", { name: "Create my journey" }).click();
  await expect(
    page.getByRole("heading", { name: "Why this connects to the next idea" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Inspect the original relationship evidence",
    }),
  ).toHaveAttribute("href", /\/evidence\//);
  await page
    .getByRole("button", { name: "Mark this concept explored", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark as not explored", exact: true }),
  ).toBeVisible();
  await page.reload();
  const resume = page.getByRole("button", {
    name: /Alkali metals → Lithium-ion batteries/,
  });
  await expect(resume).toContainText("1/3 concepts explored");
  await resume.click();
  await expect(
    page.getByRole("button", { name: "Step 2: Lithium", exact: true }),
  ).toHaveAttribute("aria-current", "step");
});

test("real PubChem conformer supports measurements and a WebGL-free alternative", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (/webgl/i.test(type)) return null;
      return (original as Function).apply(this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/labs/molecule?q=CID%3A962");
  await expect(page.getByText("PubChem CID 962", { exact: true })).toBeVisible({
    timeout: 90000,
  });
  await expect(
    page.getByText("3 atoms · 2 bonds", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /H2O projection/ })).toBeVisible();
  await page
    .getByRole("slider", { name: "Model rotation", exact: true })
    .fill("80");
  await expect(
    page
      .getByRole("img", { name: /H2O projection/ })
      .locator("g")
      .first(),
  ).toHaveAttribute("transform", /rotate\(80\)/);
  const distance = page.locator("output");
  const first = await distance.textContent();
  await page
    .getByRole("combobox", { name: "First atom", exact: true })
    .selectOption("1");
  await page
    .getByRole("combobox", { name: "Second atom", exact: true })
    .selectOption("2");
  await expect(distance).not.toHaveText(first!);
  await expect(distance).toContainText("Å");
  await expect(
    page.getByRole("link", { name: "PubChem", exact: true }),
  ).toHaveAttribute("href", "https://pubchem.ncbi.nlm.nih.gov/compound/962");
  await page
    .getByRole("group", { name: "Scientific model and controls" })
    .screenshot({
      path: testInfo.outputPath("molecule.png"),
      animations: "disabled",
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("WebGL model zoom changes the rendered geometry and releases its offscreen canvas", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await page.goto("/labs/molecule?q=CID%3A962");
  const model = page.getByRole("group", {
    name: "Scientific model and controls",
  });
  const canvas = model.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 60000 });
  const before = await canvas.screenshot();
  await page
    .getByRole("slider", { name: "Model zoom", exact: true })
    .fill("1.8");
  await expect
    .poll(async () => before.equals(await canvas.screenshot()))
    .toBe(false);
  await canvas.screenshot({ path: testInfo.outputPath("molecule-3d.png") });
  await page.setViewportSize({
    width: page.viewportSize()!.width,
    height: 360,
  });
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect(canvas).toHaveCount(0);
  await model.locator(":scope > div").first().scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible();
});

test("NASA-backed planetary geometry and orbital time remain usable in light mode", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  await page.goto("/labs/planet?q=Saturn");
  await expect(
    page.getByRole("heading", { name: "Saturn", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await page
    .getByRole("group", { name: "Scientific model and controls" })
    .locator("canvas")
    .screenshot({ path: testInfo.outputPath("planet-3d.png") });
  await page.getByLabel("Use the 2D alternative").check();
  await expect(
    page.getByRole("img", { name: /Saturn schematic/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("table").filter({ hasText: "Cataloged ring boundaries" }),
  ).toContainText("B Ring");
  const orbit = page.getByRole("slider", { name: "Elapsed orbital period" });
  const panel = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Change the time. Follow the orbit.",
    }),
  });
  const before = await panel.locator("p strong").textContent();
  await orbit.fill("0.5");
  await expect(panel.locator("p strong")).not.toHaveText(before!);
  await page.getByLabel("Comparison body", { exact: true }).fill("Earth");
  await page.getByRole("button", { name: "Compare measurements" }).click();
  await expect(
    page.getByRole("table", { name: "Planet measurements comparison" }),
  ).toContainText("Earth", { timeout: 60000 });
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("group", { name: "Scientific model and controls" })
    .screenshot({
      path: testInfo.outputPath("planet-light.png"),
      animations: "disabled",
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("knowledge pages fit narrow and tablet widths with usable critical controls", async ({
  page,
}, testInfo) => {
  for (const width of [320, 360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/labs/molecule?q=CID%3A962");
    await expect(
      page.getByText("PubChem CID 962", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const button = await page
      .getByRole("button", { name: "Explore subject", exact: true })
      .boundingBox();
    expect(button!.height).toBeGreaterThanOrEqual(44);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Explore everything/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 320)
      await page.screenshot({
        path: testInfo.outputPath("home-320.png"),
        animations: "disabled",
      });
  }
});
