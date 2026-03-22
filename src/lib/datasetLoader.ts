import { SingleCellDataset } from "@/types/singleCell";
import { decode } from "@msgpack/msgpack";

/**
 * Remote URLs for the split compressed dataset files.
 * These are served from GitHub via media.githubusercontent.com for CORS + LFS support.
 * Update these URLs if you move the files to a different host.
 */
const REMOTE_CORE_URL =
  "https://raw.githubusercontent.com/JMarzec/single-cell-explorer-21d646ca/main/public/dataset_core.json";
const REMOTE_EXPR_URL =
  "https://media.githubusercontent.com/media/JMarzec/single-cell-explorer-21d646ca/main/public/dataset_expression.msgpack";

/** Fallback: original monolithic JSON */
const REMOTE_DATASET_URL =
  "https://media.githubusercontent.com/media/JMarzec/single-cell-explorer-21d646ca/main/public/heart_organoid_S1_3_annot.json";

/** Local paths (served from public/ in dev and production) */
const LOCAL_CORE_URL = "/dataset_core.json";
const LOCAL_EXPR_URL = "/dataset_expression.msgpack";

export interface LoadProgress {
  phase: "downloading" | "parsing" | "done" | "error";
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

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------
let cachedPromise: Promise<SingleCellDataset> | null = null;
let cachedResult: SingleCellDataset | null = null;

export function fetchRemoteDataset(
  onProgress?: (p: LoadProgress) => void
): Promise<SingleCellDataset> {
  if (cachedResult) {
    onProgress?.({ phase: "done", percent: 100, message: "Loaded from cache" });
    return Promise.resolve(cachedResult);
  }

  if (!cachedPromise) {
    cachedPromise = loadDataset(onProgress);
    cachedPromise.catch(() => {
      cachedPromise = null;
    });
  }
  return cachedPromise;
}

// ---------------------------------------------------------------------------
// Main loader: tries split files first, falls back to monolithic JSON
// ---------------------------------------------------------------------------
async function loadDataset(
  onProgress?: (p: LoadProgress) => void
): Promise<SingleCellDataset> {
  // Try loading split compressed files first
  try {
    const dataset = await loadSplitDataset(onProgress);
    cachedResult = dataset;
    onProgress?.({ phase: "done", percent: 100, message: "Dataset ready" });
    return dataset;
  } catch (splitError) {
    console.warn("Split dataset not available, falling back to monolithic JSON:", splitError);
  }

  // Fallback: stream the original 1GB JSON
  const dataset = await streamFetchAndParse(onProgress);
  cachedResult = dataset;
  onProgress?.({ phase: "done", percent: 100, message: "Dataset ready" });
  return dataset;
}

// ---------------------------------------------------------------------------
// Split loader: core JSON + expression MessagePack
// ---------------------------------------------------------------------------
async function loadSplitDataset(
  onProgress?: (p: LoadProgress) => void
): Promise<SingleCellDataset> {
  onProgress?.({ phase: "downloading", percent: 0, message: "Loading core data…" });

  // 1. Fetch core JSON (small, fast)
  const coreData = await fetchJsonWithFallback(REMOTE_CORE_URL, LOCAL_CORE_URL);

  const dataset = normalizeDataset(coreData);

  onProgress?.({ phase: "downloading", percent: 5, message: "Core data loaded. Downloading expression matrix…" });

  // 2. Stream-fetch the expression MessagePack
  const exprBytes = await streamFetchBytes(
    REMOTE_EXPR_URL,
    LOCAL_EXPR_URL,
    (pct, msg) => {
      onProgress?.({ phase: "downloading", percent: 5 + Math.round(pct * 0.9), message: msg });
    }
  );

  onProgress?.({ phase: "parsing", percent: 96, message: "Decoding expression matrix…" });

  // 3. Decode MessagePack -> sparse -> dense
  const sparseExpression = decode(exprBytes) as Record<string, [number, number][]>;

  onProgress?.({ phase: "parsing", percent: 98, message: "Reconstructing expression data…" });

  const cellIds = dataset.cells.map((c) => c.id);
  dataset.expression = sparseToDense(sparseExpression, cellIds);
  dataset.metadata.geneCount = Object.keys(dataset.expression).length;

  // Update genes list from expression keys if core didn't have it
  if (dataset.genes.length === 0) {
    dataset.genes = Object.keys(dataset.expression);
  }

  return dataset;
}

/** Convert sparse indexed format back to dense: gene -> {cellId: value} */
function sparseToDense(
  sparse: Record<string, [number, number][]>,
  cellIds: string[]
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const [gene, entries] of Object.entries(sparse)) {
    const cellMap: Record<string, number> = {};
    for (const [cellIdx, value] of entries) {
      if (cellIdx < cellIds.length) {
        cellMap[cellIds[cellIdx]] = value;
      }
    }
    result[gene] = cellMap;
  }
  return result;
}

/** Try remote URL first, fall back to local */
async function fetchJsonWithFallback(remoteUrl: string, localUrl: string): Promise<unknown> {
  try {
    const resp = await fetch(remoteUrl);
    if (resp.ok) return await resp.json();
  } catch { /* fall through */ }

  const resp = await fetch(localUrl);
  if (!resp.ok) throw new Error(`Failed to fetch from both remote and local: ${localUrl}`);
  return resp.json();
}

/** Stream-fetch binary data with progress, trying remote then local */
async function streamFetchBytes(
  remoteUrl: string,
  localUrl: string,
  onProgress: (pct: number, msg: string) => void
): Promise<Uint8Array> {
  let response: Response | null = null;

  try {
    const resp = await fetch(remoteUrl);
    if (resp.ok) response = resp;
  } catch { /* fall through */ }

  if (!response) {
    const resp = await fetch(localUrl);
    if (!resp.ok) throw new Error(`Failed to fetch expression data`);
    response = resp;
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("ReadableStream not supported");

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedBytes += value.length;

    const pct = contentLength > 0
      ? Math.min(99, Math.round((receivedBytes / contentLength) * 100))
      : 50;
    const mb = (receivedBytes / 1e6).toFixed(0);
    const totalMb = contentLength > 0 ? ` / ${(contentLength / 1e6).toFixed(0)}` : "";
    onProgress(pct, `Downloading expression… ${mb}${totalMb} MB`);
  }

  const fullBuffer = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    fullBuffer.set(chunk, offset);
    offset += chunk.length;
  }
  chunks.length = 0;

  return fullBuffer;
}

// ---------------------------------------------------------------------------
// Fallback: stream-fetch the monolithic 1GB JSON
// ---------------------------------------------------------------------------
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

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

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

  const fullBuffer = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    fullBuffer.set(chunk, offset);
    offset += chunk.length;
  }
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
  return normalizeDataset(data);
}
