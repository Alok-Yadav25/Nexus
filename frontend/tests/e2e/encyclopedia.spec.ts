import { test, expect } from "@playwright/test";

test.setTimeout(90000);

test("live encyclopedia covers unrelated subjects and paginates results", async ({
  page,
  request,
}) => {
  // Seven real provider lookups plus a cold browser search can exceed one minute.
  test.setTimeout(180000);
  for (const q of [
    "granite",
    "Internet",
    "Shah Rukh Khan",
    "MrBeast",
    "Breaking Bad",
    "Roman Empire",
    "quartz",
  ]) {
    const response = await request.get(
      "/api/v1/encyclopedia/search?q=" + encodeURIComponent(q),
    );
    expect(response.ok(), q).toBe(true);
    const data = await response.json();
    expect(data.items.length, q).toBeGreaterThan(0);
    expect(data.items[0].title.toLowerCase()).toBe(q.toLowerCase());
  }
  await page.goto("/search?q=granite");
  const results = page.getByRole("region", {
    name: "Wikipedia search results",
  });
  await expect(
    results.getByRole("heading", { name: "Granite", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    results.locator('a[href="/read/wikipedia?title=Granite"]'),
  ).toHaveAttribute("href", "/read/wikipedia?title=Granite");
  await results.getByRole("link", { name: /More results/ }).click();
  await expect(page).toHaveURL(/offset=12/);
  await expect(page.getByText(/Results 13–/)).toBeVisible({ timeout: 60000 });
  await page.getByRole("link", { name: "Previous results" }).click();
  await expect(page).toHaveURL(/offset=0/);
});

for (const theme of ["light", "dark"]) {
  test(`full Wikipedia article has working references and responsive ${theme} layout`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        /hydration|In HTML|content security policy|refused to execute/i.test(
          message.text(),
        )
      )
        errors.push(message.text());
    });
    await page.addInitScript(
      (value) => localStorage.setItem("nexus-theme", value),
      theme,
    );
    await page.goto("/read/wikipedia?title=Granite");
    await expect(
      page.getByRole("heading", { name: "Granite", level: 1 }),
    ).toBeVisible({ timeout: 60000 });
    await expect(
      page.getByText("Wikipedia contributors", { exact: true }).first(),
    ).toBeVisible();
    const article = page.getByRole("article", { name: "Granite article" });
    await expect(article).toContainText("igneous");
    expect(await article.locator("p").count()).toBeGreaterThan(20);
    const reference = article.locator('sup a[href^="#wiki-cite_note"]').first();
    const href = (await reference.getAttribute("href"))!;
    const target = page.locator(
      '[id="' + decodeURIComponent(href.slice(1)) + '"]',
    );
    await expect(target).toHaveCount(1);
    await reference.click();
    await expect.poll(() => new URL(page.url()).hash).toBe(href);
    await expect(target).toBeInViewport();
    await expect(
      article.locator('a[href^="https://"]').first(),
    ).toHaveAttribute("rel", /noopener/);
    expect(await article.locator("script,iframe,style,img").count()).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto("/read/wikipedia?title=Granite");
    await expect(
      page.getByRole("heading", { name: "Granite", level: 1 }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`reader-${theme}.png`),
      fullPage: false,
    });
    expect(errors).toEqual([]);
  });
}

test("topic directory and carousel browse beyond the original five subjects", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/v1/encyclopedia/topics");
  expect(response.ok()).toBe(true);
  const directory = await response.json();
  expect(directory.items.length).toBeGreaterThan(20);
  await page.goto("/");
  const fan = page.getByRole("group", { name: "Explore knowledge domains" });
  await fan.scrollIntoViewIfNeeded();
  await expect(fan.getByRole("link")).toHaveCount(5);
  const hrefs = new Set<string>();
  for (let i = 0; i < 8; i++) {
    hrefs.add(
      (await fan.locator('[data-active="true"]').getAttribute("href"))!,
    );
    await fan.getByRole("button", { name: "Next knowledge domain" }).click();
  }
  expect(hrefs.size).toBe(8);
  await fan.locator('[data-active="true"]').click();
  await expect(page).toHaveURL(/\/explore\?category=/);
  await expect(
    page
      .getByRole("region", { name: "Browse Wikipedia subjects" })
      .getByRole("heading", { level: 2 }),
  ).toBeVisible();
});

test("live results appear even when NEXUS already has a matching article", async ({
  page,
}) => {
  await page.goto("/search?q=lithium");
  await expect(
    page
      .getByRole("region", { name: "Wikipedia search results" })
      .getByRole("heading", { name: "Lithium", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page
      .getByRole("region", { name: "NEXUS reviewed library results" })
      .locator(".article-card")
      .first(),
  ).toContainText("Lithium");
});
