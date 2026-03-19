import { SingleCellDataset } from "@/types/singleCell";

const REMOTE_DATASET_URL =
  "https://media.githubusercontent.com/media/JMarzec/single_cell_explorer/main/public/heart_organoid_S1_3_annot.json";

export function normalizeDataset(data: unknown): SingleCellDataset {
  const obj = data as Record<string, unknown>;

  const rawCells = (obj.cells as Record<string, unknown>[]) || [];
  const cells = rawCells.map((cell, idx) => ({
    id: String(cell.id || `cell_${idx}`),
    x: Number(cell.x),
    y: Number(cell.y),
    cluster: Number(cell.cluster),
    metadata: (cell.metadata as Record<string, string | number>) || {},
  }));

  const rawClusters = (obj.clusters as Record<string, unknown>[]) || [];
  const clusters = rawClusters.map((cluster, idx) => ({
    id: Number(cluster.id ?? idx),
    name: String(cluster.name || `Cluster ${idx}`),
    cellCount: Number(
      cluster.cellCount || cells.filter((c) => c.cluster === idx).length
    ),
    color: String(cluster.color || `hsl(${(idx * 36) % 360}, 70%, 50%)`),
  }));

  const rawMeta = (obj.metadata as Record<string, unknown>) || {};
  const metadata = {
    name: String(rawMeta.name || "Uploaded Dataset"),
    description: String(
      rawMeta.description || "User-uploaded single-cell dataset"
    ),
    cellCount: cells.length,
    geneCount: ((obj.genes as string[]) || []).length,
    clusterCount: clusters.length,
    organism: rawMeta.organism ? String(rawMeta.organism) : undefined,
    tissue: rawMeta.tissue ? String(rawMeta.tissue) : undefined,
    source: rawMeta.source ? String(rawMeta.source) : undefined,
  };

  const rawDE = (obj.differentialExpression as Record<string, unknown>[]) || [];
  const differentialExpression = rawDE.map((de) => ({
    gene: String(de.gene),
    cluster: String(de.cluster),
    logFC: Number(de.logFC),
    pValue: Number(de.pValue),
    pAdj: Number(de.pAdj),
  }));

  const rawExpression = obj.expression as
    | Record<string, Record<string, number>>
    | undefined;

  const annotationOptions =
    cells.length > 0
      ? Object.keys(cells[0].metadata).filter(
          (key) => typeof cells[0].metadata[key] === "string"
        )
      : [];

  return {
    metadata,
    cells,
    genes: (obj.genes as string[]) || [],
    clusters,
    differentialExpression,
    expression: rawExpression || undefined,
    annotationOptions,
  };
}

export async function fetchRemoteDataset(): Promise<SingleCellDataset> {
  const response = await fetch(REMOTE_DATASET_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset: ${response.status}`);
  }
  const data = await response.json();
  return normalizeDataset(data);
}
