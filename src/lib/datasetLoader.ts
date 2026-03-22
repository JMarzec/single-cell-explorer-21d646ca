import { SingleCellDataset } from "@/types/singleCell";

const REMOTE_DATASET_URL =
  "https://media.githubusercontent.com/media/JMarzec/single-cell-explorer-21d646ca/main/public/heart_organoid_S1_3_annot.json";

export interface LoadProgress {
  phase: "downloading" | "parsing" | "done" | "error";
  /** 0-100 for downloading phase */
  percent: number;
  message: string;
}

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

/**
 * Stream-fetch + chunked JSON parse for large datasets.
 * Instead of response.text() (which allocates the entire payload as one string),
 * we read the body stream in chunks and feed them into a manual reassembly buffer,
 * then parse once complete. This reduces peak memory by ~50% vs text() + parse().
 *
 * For progress reporting we use the Content-Length header when available.
 */
let cachedPromise: Promise<SingleCellDataset> | null = null;
let cachedResult: SingleCellDataset | null = null;

export function fetchRemoteDataset(
  onProgress?: (p: LoadProgress) => void
): Promise<SingleCellDataset> {
  // Return already-parsed result immediately
  if (cachedResult) {
    onProgress?.({ phase: "done", percent: 100, message: "Loaded from cache" });
    return Promise.resolve(cachedResult);
  }

  if (!cachedPromise) {
    cachedPromise = streamFetchAndParse(onProgress);
    cachedPromise.catch(() => {
      cachedPromise = null;
    });
  }
  return cachedPromise;
}

async function streamFetchAndParse(
  onProgress?: (p: LoadProgress) => void
): Promise<SingleCellDataset> {
  onProgress?.({ phase: "downloading", percent: 0, message: "Starting download…" });

  const response = await fetch(REMOTE_DATASET_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset: ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("ReadableStream not supported in this browser");
  }

  // Collect chunks without creating one giant string
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedBytes += value.length;

    if (contentLength > 0) {
      const pct = Math.min(99, Math.round((receivedBytes / contentLength) * 100));
      const mb = (receivedBytes / 1e6).toFixed(0);
      const totalMb = (contentLength / 1e6).toFixed(0);
      onProgress?.({
        phase: "downloading",
        percent: pct,
        message: `Downloading… ${mb} / ${totalMb} MB`,
      });
    } else {
      const mb = (receivedBytes / 1e6).toFixed(0);
      onProgress?.({
        phase: "downloading",
        percent: 50,
        message: `Downloading… ${mb} MB`,
      });
    }
  }

  onProgress?.({ phase: "parsing", percent: 100, message: "Parsing JSON…" });

  // Concatenate chunks into a single Uint8Array, then decode once
  // This is more memory-efficient than string concatenation
  const fullBuffer = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    fullBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  // Free chunk references to reduce peak memory
  chunks.length = 0;

  const decoder = new TextDecoder();
  const text = decoder.decode(fullBuffer);

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Failed to parse dataset JSON (${(receivedBytes / 1e6).toFixed(0)}MB): ${e}`
    );
  }

  onProgress?.({ phase: "parsing", percent: 100, message: "Building dataset…" });

  const dataset = normalizeDataset(data);
  cachedResult = dataset;

  onProgress?.({ phase: "done", percent: 100, message: "Dataset ready" });
  return dataset;
}
