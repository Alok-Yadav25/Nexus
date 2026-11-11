import { describe, expect, it } from "vitest";
import { safeReturnPath } from "../lib/navigation";
import { orbitPosition } from "../lib/scientific";

describe("authentication destinations", () => {
  it("preserves the encoded topic, ontology, and canonical identity", () => {
    const path =
      "/research?topic=Mercury+%26+its+moons&ontology=Planet&canonical=wikidata%3AQ308";
    expect(safeReturnPath(path)).toBe(path);
  });
  it.each([
    "https://evil.test",
    "//evil.test",
    "/%2fevil.test",
    "/\\evil.test",
    "/%0aevil",
    "/auth?next=/auth",
    "%",
    null,
  ])("rejects unsafe or looping destination %s", (path) => {
    expect(safeReturnPath(path)).toBe("/dashboard");
  });
});

describe("educational orbital calculation", () => {
  const orbit = {
    eccentricity: 0.2,
    inclinationDegrees: 0,
    meanAnomalyDegrees: 0,
    semiMajorAxisAu: 2,
    periodDays: 100,
    epoch: "test epoch",
    model: "two-body test",
    sourceUrl: "https://ssd.jpl.nasa.gov",
  };
  it("reaches periapsis and apoapsis at the correct distances", () => {
    expect(orbitPosition(orbit, 0).distance).toBeCloseTo(1.6, 8);
    expect(orbitPosition(orbit, 50).distance).toBeCloseTo(2.4, 8);
    expect(orbitPosition(orbit, 100).distance).toBeCloseTo(1.6, 8);
  });
  it("keeps circular orbits at the supplied radius", () => {
    expect(
      orbitPosition({ ...orbit, eccentricity: 0 }, 32).distance,
    ).toBeCloseTo(2, 8);
  });
});
