import { test, expect } from "@playwright/test";

test("content reveals and card interactions stay outside the hero", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const hero = page.getByRole("region", {
    name: "Explore the NEXUS knowledge universe",
  });
  const card = page.locator(".landing-content .article-card").first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute("data-revealed", "true");
  await expect(card).toHaveAttribute("data-motion-card", "");
  await expect(
    hero.locator("[data-revealed], [data-motion-card], [data-ambient-motion]"),
  ).toHaveCount(0);
  if (testInfo.project.name === "desktop") {
    await card.hover({ position: { x: 30, y: 30 } });
    await expect
      .poll(() =>
        card.evaluate((element) => element.style.getPropertyValue("--tilt-x")),
      )
      .not.toBe("");
    await page.mouse.move(0, 0);
    await expect
      .poll(() =>
        card.evaluate((element) => element.style.getPropertyValue("--tilt-x")),
      )
      .toBe("");
  } else {
    await expect
      .poll(() =>
        card.evaluate((element) => element.style.getPropertyValue("--tilt-x")),
      )
      .toBe("");
  }
  await card.click();
  await expect(page).toHaveURL(/\/article\//);
  await expect(page.locator(".article-title-row")).toHaveAttribute(
    "data-revealed",
    "true",
  );
});

for (const theme of ["dark", "light"] as const) {
  test(`domain fan uses real records and themed motion in ${theme} mode`, async ({
    page,
    request,
  }, testInfo) => {
    await page.addInitScript(
      (value) => localStorage.setItem("nexus-theme", value),
      theme,
    );
    const { items } = await (
      await request.get("/api/v1/encyclopedia/topics")
    ).json();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const fan = page.getByRole("group", { name: "Explore knowledge domains" });
    await fan.scrollIntoViewIfNeeded();
    await expect(fan).toHaveAttribute("data-in-view", "true");
    await expect(fan.getByRole("link")).toHaveCount(Math.min(items.length, 5));
    const active = fan.locator('[data-active="true"]');
    const first = await active.getAttribute("href");
    await fan.getByRole("button", { name: "Next knowledge domain" }).click();
    await expect(active).not.toHaveAttribute("href", first!);
    await fan
      .getByRole("button", { name: "Previous knowledge domain" })
      .click();
    await expect(active).toHaveAttribute("href", first!);
    await page.evaluate(() => document.fonts.ready);
    for (const [name, selector] of [
      ["domains", ".domain-section"],
      ["discovery", ".discovery-banner"],
      ["knowledge", ".how-section"],
    ]) {
      const section = page.locator(selector);
      await section.scrollIntoViewIfNeeded();
      await section.screenshot({
        path: testInfo.outputPath(`${theme}-${name}.png`),
        animations: "disabled",
      });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await fan.scrollIntoViewIfNeeded();
    await active.click();
    const expectedDomain = decodeURIComponent(first!.split("=")[1]);
    await expect(page).toHaveURL(
      new RegExp(`category=${encodeURIComponent(expectedDomain)}`),
    );
    await expect(
      page
        .getByRole("region", { name: "Browse Wikipedia subjects" })
        .getByRole("heading", { name: expectedDomain, exact: true }),
    ).toBeVisible();
  });
}

test("reduced motion keeps all content usable without running effects", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute(
    "data-content-motion",
    "reduced",
  );
  await page.locator(".how-section").scrollIntoViewIfNeeded();
  const preview = page.locator(".how-grid [data-ambient-motion]").first();
  await expect(preview).toHaveAttribute("data-in-view", "true");
  expect(
    await page
      .locator("main")
      .evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
  ).toBe(0);
  await page
    .getByRole("group", { name: "Explore knowledge domains" })
    .scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Next knowledge domain" }).click();
  await expect(
    page.locator('.domain-section [data-active="true"]'),
  ).toBeVisible();
});
