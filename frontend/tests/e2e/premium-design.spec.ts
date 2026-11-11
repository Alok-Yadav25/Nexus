import { test, expect } from "@playwright/test";

for (const theme of ["dark", "light"] as const) {
  test(`shared ${theme} design reaches the hero, search, articles and labs`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (/hydration|In HTML|refused to execute/i.test(message.text()))
        errors.push(message.text());
    });
    await page.addInitScript(
      (value) => localStorage.setItem("nexus-theme", value),
      theme,
    );
    if (testInfo.project.name === "desktop")
      await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const hero = page.getByRole("region", {
      name: "Explore the NEXUS knowledge universe",
    });
    await expect(
      hero.getByRole("heading", { name: /Explore everything/ }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const styles = await hero.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
      theme: getComputedStyle(document.documentElement).colorScheme,
      headingFont: getComputedStyle(element.querySelector("h1")!).fontFamily,
      bodyFont: getComputedStyle(document.body).fontFamily,
      cardTiming: getComputedStyle(
        element.querySelector('[data-slot="center"]')!,
      ).transitionDuration,
      fontsReady:
        document.fonts.check('500 48px "Manrope Variable"') &&
        document.fonts.check('400 16px "Geist Variable"'),
    }));
    expect(styles.background).toBe(styles.body);
    expect(styles.theme).toBe(theme);
    expect(styles.headingFont).toContain("Manrope");
    expect(styles.bodyFont).toContain("Geist");
    expect(styles.fontsReady).toBe(true);
    expect(
      Math.max(...styles.cardTiming.split(",").map(Number.parseFloat)),
    ).toBeLessThanOrEqual(0.6);
    await hero.getByRole("button", { name: "Pause hero animation" }).click();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: testInfo.outputPath(`home-${theme}.png`),
      animations: "disabled",
    });
    const library = page.locator(".landing-content");
    await library.locator(".learning-entries").scrollIntoViewIfNeeded();
    await library.locator(".learning-entries").screenshot({
      path: testInfo.outputPath(`learning-${theme}.png`),
      animations: "disabled",
    });
    await hero.getByRole("button", { name: "Toggle color theme" }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      theme === "dark" ? "light" : "dark",
    );
    await expect
      .poll(() =>
        hero.evaluate((element) => getComputedStyle(element).backgroundColor),
      )
      .not.toBe(styles.background);
    await hero.getByRole("button", { name: "Toggle color theme" }).click();
    for (const route of [
      "/search?q=granite",
      "/article/lithium",
      "/labs/molecule",
    ]) {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (route.startsWith("/search")) {
        await expect(
          page
            .getByRole("region", { name: "Wikipedia search results" })
            .getByRole("heading", { name: "Granite", exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.screenshot({
          path: testInfo.outputPath(`search-${theme}.png`),
          animations: "disabled",
        });
      }
    }
    expect(errors).toEqual([]);
  });
}

test("hero selection settles promptly after a direct interaction", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const hero = page.getByRole("region", {
    name: "Explore the NEXUS knowledge universe",
  });
  const card = hero.getByRole("article", { name: "Featured article card" });
  await hero
    .getByRole("button", { name: "Show Featured article card" })
    .click();
  await expect(card).toHaveAttribute("data-slot", "center");
  // Keep the product's duration budget explicit, while allowing a shared CI
  // runner extra wall time to present frames and finish its CSS transitions.
  const durations = await card.evaluate((element) =>
    getComputedStyle(element)
      .transitionDuration.split(",")
      .map((duration) => parseFloat(duration) * 1000),
  );
  expect(Math.max(...durations)).toBeLessThanOrEqual(560);
  // Chrome can retain a "running" compositor transition after the card has
  // visually settled. Compare its rendered box with the unanimated destination.
  const destination = await card.evaluate((element) => {
    const target = element.cloneNode(false) as HTMLElement;
    target.style.transition = "none";
    target.style.animation = "none";
    target.style.visibility = "hidden";
    element.parentElement!.append(target);
    const { x, y, width, height } = target.getBoundingClientRect();
    target.remove();
    return { x, y, width, height };
  });
  await expect
    .poll(
      () =>
        card.evaluate((element, expected) => {
          const actual = element.getBoundingClientRect();
          return Math.max(
            Math.abs(actual.x - expected.x),
            Math.abs(actual.y - expected.y),
            Math.abs(actual.width - expected.width),
            Math.abs(actual.height - expected.height),
          );
        }, destination),
      { timeout: 3000, intervals: [32] },
    )
    .toBeLessThan(1);
});
