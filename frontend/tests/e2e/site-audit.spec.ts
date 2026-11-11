import { test, expect } from "@playwright/test";

test.setTimeout(90000);

test("search keeps the query through navigation, supports clearing, and does not retry missing articles", async ({
  page,
}) => {
  await page.goto("/search?q=granite");
  const input = page.getByRole("combobox", { name: "Search all knowledge" });
  await expect(input).toHaveValue("granite");
  await input.fill("quartz");
  await input.press("Enter");
  await expect(page).toHaveURL(/q=quartz/);
  await expect(input).toHaveValue("quartz");
  await page.goBack();
  await expect(input).toHaveValue("granite");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(input).toBeEmpty();
  await expect(input).toBeFocused();
  let calls = 0;
  await page.route("**/api/v1/encyclopedia/article?*", (route) => {
    calls++;
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "This article does not exist." }),
    });
  });
  await page.goto("/read/wikipedia?title=Missing-audit-page");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Unable to load this workspace" }),
  ).toContainText("This article does not exist.");
  await page.waitForTimeout(1600);
  expect(calls).toBe(1);
});

test("saved articles resume, text preferences persist and citation copying has an accessible fallback", async ({
  page,
}, testInfo) => {
  await page.goto("/read/wikipedia?title=Granite");
  await expect(
    page.getByRole("heading", { name: "Granite", level: 1 }),
  ).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Save for later", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved for later", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Larger article text" }).click();
  await expect(
    page.getByRole("article", { name: "Granite article" }),
  ).toHaveCSS("font-size", "18px");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("Denied")) },
    }),
  );
  await page.getByRole("button", { name: "Copy citation" }).click();
  await expect(page.getByLabel("Copy this citation")).toHaveValue(
    /Wikipedia contributors.*Granite.*oldid=/,
  );
  await page.locator("#wiki-Description").scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .getByRole("progressbar", { name: "Article reading progress" })
        .getAttribute("value"),
    )
    .not.toBe("0");
  await page.goto("/reading-list");
  const saved = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Granite", exact: true }),
  });
  await expect(saved).toBeVisible();
  await expect(saved.getByRole("progressbar")).not.toHaveAttribute(
    "value",
    "0",
  );
  await saved.getByRole("link", { name: "Resume reading" }).click();
  await expect(
    page.getByRole("heading", { name: "Granite", level: 1 }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByRole("article", { name: "Granite article" }),
  ).toHaveCSS("font-size", "18px");
  await expect(page.locator("#wiki-Description")).toBeInViewport();
  await page.goto("/reading-list");
  await expect(page.locator(".page-heading")).toHaveAttribute("data-revealed", "true");
  await expect(page.locator(".page-heading")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: testInfo.outputPath("reading-list.png"),
    fullPage: false,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Remove Granite from reading list" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Keep your next discovery close" }),
  ).toBeVisible();
});

test("blocked browser storage leaves the reader usable and never claims an article was saved", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    }),
  );
  await page.goto("/read/wikipedia?title=Granite");
  await expect(
    page.getByRole("heading", { name: "Granite", level: 1 }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByRole("button", { name: "Save for later", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("region", { name: "Reading tools" }),
  ).toContainText("Browser storage is unavailable");
  await page.getByRole("button", { name: "Larger article text" }).click();
  await expect(
    page.getByRole("article", { name: "Granite article" }),
  ).toHaveCSS("font-size", "18px");
});

test("keyboard users can skip navigation and mobile navigation isolates background controls", async ({
  page,
}, testInfo) => {
  await page.goto("/explore");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  if (testInfo.project.name === "mobile") {
    const trigger = page.locator(".mobile-menu");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".main-shell")).toHaveAttribute("inert", "");
    await expect(page.locator("#workspace-navigation")).not.toHaveAttribute(
      "inert",
      "",
    );
    await expect(
      page
        .locator("#workspace-navigation")
        .getByRole("link", { name: "NEXUS home" }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("button", { name: "Close sidebar" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page.locator("#workspace-navigation")).toHaveAttribute(
      "inert",
      "",
    );
    await trigger.click();
    await page
      .locator("#workspace-navigation")
      .getByRole("link", { name: "Explore knowledge", exact: true })
      .click();
    await expect(page.locator("#workspace-navigation")).toHaveAttribute(
      "inert",
      "",
    );
  }
});
