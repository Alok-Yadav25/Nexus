import { test, expect } from "@playwright/test";

test("hero card controls pause playback and open the real library", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const hero = page.getByRole("region", {
    name: "Explore the NEXUS knowledge universe",
  });
  await hero.getByRole("button", { name: "Pause hero animation" }).click();
  await expect(
    hero.getByRole("button", { name: "Play hero animation" }),
  ).toBeVisible();
  await hero
    .getByRole("button", { name: "Show Featured article card" })
    .click();
  await expect(
    hero.getByRole("article", { name: "Featured article card" }),
  ).toHaveAttribute("data-slot", "center");
  await expect(
    hero.getByRole("button", { name: "Show Featured article card" }),
  ).toHaveAttribute("aria-pressed", "true");
  await hero
    .getByRole("button", { name: "Show Knowledge universe card" })
    .click();
  await expect(
    hero.getByRole("article", { name: "Knowledge universe card" }),
  ).toHaveAttribute("data-slot", "center");
  await hero.getByRole("button", { name: "Show NEXUS core card" }).click();
  await expect(
    hero.getByRole("article", { name: "NEXUS core card" }),
  ).toHaveAttribute("data-slot", "center");
  await page.evaluate(() => document.fonts.ready);
  await hero.screenshot({
    path: testInfo.outputPath("hero.png"),
    animations: "disabled",
  });
  await hero.getByRole("link", { name: "Enter the encyclopedia" }).click();
  await expect(
    page.getByRole("heading", {
      name: "A starting point for every curiosity.",
    }),
  ).toBeVisible();
  if (testInfo.project.name === "desktop")
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
});

test("landing navigation opens mobile menu and focuses live search", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", {
    name: "Landing navigation",
  });
  if (testInfo.project.name === "mobile") {
    await navigation.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      navigation.getByRole("button", { name: "Close navigation" }),
    ).toHaveAttribute("aria-expanded", "true");
  }
  await navigation.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Search all knowledge" }),
  ).toBeFocused();
  if (testInfo.project.name === "mobile")
    await expect(
      navigation.getByRole("button", { name: "Open navigation" }),
    ).toHaveAttribute("aria-expanded", "false");
  for (const width of testInfo.project.name === "mobile"
    ? [320, 700]
    : [1280]) {
    await page.setViewportSize({ width, height: 800 });
    if (width < 780)
      await expect(
        navigation.getByRole("button", { name: "Open navigation" }),
      ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("hero respects reduced motion and works without WebGL", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof getContext>
    ) {
      if (String(args[0]).startsWith("webgl")) return null;
      return getContext.apply(this, args);
    } as typeof getContext;
  });
  await page.goto("/");
  const hero = page.getByRole("region", {
    name: "Explore the NEXUS knowledge universe",
  });
  await expect(hero.locator("[data-paused]")).toHaveAttribute(
    "data-paused",
    "true",
  );
  await expect(hero.locator("canvas")).toHaveCount(0);
  await expect(
    hero
      .getByRole("article", { name: "NEXUS core card" })
      .locator("svg")
      .first(),
  ).toBeVisible();
  await hero
    .getByRole("button", { name: "Show Featured article card" })
    .click();
  await expect(
    hero.getByRole("article", { name: "Featured article card" }),
  ).toHaveAttribute("data-slot", "center");
});
