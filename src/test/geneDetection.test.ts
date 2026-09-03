import { describe, it, expect } from "vitest";
import { getUndetectedGenes, isGeneUndetected, getExpressionData } from "@/lib/expressionUtils";
import { matrixFromRecord } from "@/lib/expressionMatrix";
import type { SingleCellDataset } from "@/types/singleCell";

const cells = [
  { id: "c1", x: 0, y: 0, cluster: 0, metadata: {} },
  { id: "c2", x: 1, y: 1, cluster: 0, metadata: {} },
];

const dataset: SingleCellDataset = {
  metadata: {
    name: "t",
    description: "t",
    cellCount: 2,
    geneCount: 2,
    clusterCount: 1,
    cellTypeCount: 1,
  },
  cells,
  genes: ["A", "MISSING"],
  clusters: [{ id: 0, name: "c", cellCount: 2, color: "rgb(0,0,0)" }],
  differentialExpression: [],
  expression: matrixFromRecord({ A: { c1: 2, c2: 0 } }, ["c1", "c2"]),
  annotationOptions: [],
};

describe("gene detection state", () => {
  it("flags genes absent from the loaded matrix", () => {
    expect(getUndetectedGenes(dataset, ["A", "MISSING"])).toEqual(["MISSING"]);
    expect(isGeneUndetected(dataset, "MISSING")).toBe(true);
    expect(isGeneUndetected(dataset, "A")).toBe(false);
  });

  it("returns zeros (never invented values) for absent genes", () => {
    const values = getExpressionData(dataset, "MISSING");
    expect([...values.values()]).toEqual([0, 0]);
  });

  it("marks all genes unavailable and zeroed when a real dataset has no matrix", () => {
    const noMatrix = { ...dataset, expression: undefined };
    expect(getUndetectedGenes(noMatrix, ["A", "MISSING"])).toEqual(["A", "MISSING"]);
    expect(isGeneUndetected(noMatrix, "A")).toBe(true);
    expect([...getExpressionData(noMatrix, "A").values()]).toEqual([0, 0]);
  });

  it("still allows illustrative values for the built-in demo dataset", () => {
    const demo = { ...dataset, expression: undefined, syntheticExpression: true };
    expect(getUndetectedGenes(demo, ["MISSING"])).toEqual([]);
  });
});
