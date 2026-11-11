export type Provenance = {
  provider: string;
  url: string;
  retrievedAt: string;
  revision?: string;
  attribution?: string;
  terms?: string;
};
export type Quantity = {
  value: number;
  unit: string;
  sourceExcerpt: string;
  uncertainty?: number;
};
export type Ring = {
  name: string;
  innerRadiusKm: number;
  outerRadiusKm: number;
  sourceUrl: string;
  retrievedAt: string;
};
export type PlanetModel = {
  kind: "planet";
  id: string;
  title: string;
  bodyType: string;
  properties: Record<string, Quantity>;
  rings: Ring[];
  source: Provenance;
  warnings: string[];
  stale?: boolean;
  physicalReport: string;
  orbitalElements: null | {
    eccentricity: number;
    inclinationDegrees: number;
    meanAnomalyDegrees: number;
    semiMajorAxisAu: number;
    periodDays: number;
    epoch: string;
    model: string;
    sourceUrl: string;
  };
};
export type MolecularAtom = {
  id: number;
  atomicNumber: number;
  symbol: string;
  position: [number, number, number];
};
export type MolecularModel = {
  kind: "molecule";
  id: string;
  title: string;
  formula?: string;
  molecularWeight?: string;
  massUnit: string;
  atoms: MolecularAtom[];
  bonds: { from: number; to: number; order: number }[];
  coordinateUnit?: string;
  conformer?: string;
  computed: boolean;
  source: Provenance;
  warnings: string[];
  stale?: boolean;
};
export type ScientificModel = PlanetModel | MolecularModel;
export const atomColor = (z: number) =>
  (
    ({
      1: "#d9e5ef",
      6: "#66788d",
      7: "#6595ed",
      8: "#eb787f",
      9: "#63d6b0",
      15: "#e8a963",
      16: "#e1cf70",
      17: "#78bda0",
    }) as Record<number, string>
  )[z] || "#bca1ed";
export function orbitPosition(
  model: NonNullable<PlanetModel["orbitalElements"]>,
  days: number,
) {
  const mean =
    (model.meanAnomalyDegrees * Math.PI) / 180 +
    (2 * Math.PI * days) / model.periodDays;
  let anomaly = mean;
  for (let i = 0; i < 20; i++)
    anomaly -=
      (anomaly - model.eccentricity * Math.sin(anomaly) - mean) /
      (1 - model.eccentricity * Math.cos(anomaly));
  const x = model.semiMajorAxisAu * (Math.cos(anomaly) - model.eccentricity),
    y =
      model.semiMajorAxisAu *
      Math.sqrt(1 - model.eccentricity ** 2) *
      Math.sin(anomaly);
  return { x, y, distance: Math.hypot(x, y) };
}
