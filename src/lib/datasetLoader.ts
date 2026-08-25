import { ExpressionMatrix, SingleCellDataset } from "@/types/singleCell";
import { parseSparseExpression, SparseGene } from "@/lib/msgpackSparse";
import { SparseExpressionMatrix, matrixFromRecord } from "@/lib/expressionMatrix";
import { startPhase, getPeakHeapMB, trackHeap } from "@/lib/perf";

/**
 * Remote URLs for the split compressed dataset files.
 * These are served from GitHub (media.* for LFS-backed binaries) with CORS support.
 * Update these URLs if you move the files to a different host.
 */
const REMOTE_CORE_URL =
  "https://raw.githubusercontent.com/JMarzec/single-cell-explorer-21d646ca/main/public/dataset_core.json";
const REMOTE_EXPR_URL =
  "https://media.githubusercontent.com/media/JMarzec/single-cell-explorer-21d646ca/main/public/dataset_expression.msgpack";

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
    cellTypeCount: new Set(cells.map((c) => c.metadata?.cell_type).filter(Boolean)).size || clusters.length,
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
    expression: rawExpression
      ? matrixFromRecord(rawExpression, cells.map((c) => c.id))
      : undefined,
    annotationOptions,
  };
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------
let corePromise: Promise<SingleCellDataset> | null = null;
let coreResult: SingleCellDataset | null = null;
let exprPromise: Promise<ExpressionMatrix> | null = null;
let exprResult: ExpressionMatrix | null = null;

/**
 * Fetch the small core dataset (cells, clusters, genes, DE results) without the
 * expression matrix. Cheap enough to block the first render on.
 */
export function fetchCoreDataset(
  onProgress?: (p: LoadProgress) => void
): Promise<SingleCellDataset> {
  if (coreResult) {
    onProgress?.({ phase: "done", percent: 100, message: "Loaded from cache" });
    return Promise.resolve(coreResult);
  }

  if (!corePromise) {
    corePromise = loadCoreDataset(onProgress);
    corePromise.catch(() => {
      corePromise = null;
    });
  }
  return corePromise;
}

/**
 * Fetch and decode the expression matrix. Streams the packed file and stores
 * values in typed arrays, so peak memory stays close to the packed size.
 * Pass a signal to allow the user to cancel a long download.
 */
export function fetchExpressionMatrix(
  cellIds: string[],
  onProgress?: (p: LoadProgress) => void,
  signal?: AbortSignal
): Promise<ExpressionMatrix> {
  if (exprResult) {
    onProgress?.({ phase: "done", percent: 100, message: "Loaded from cache" });
    return Promise.resolve(exprResult);
  }

  if (!exprPromise) {
    exprPromise = loadExpressionMatrix(cellIds, onProgress, signal);
    exprPromise.catch(() => {
      exprPromise = null;
    });
  }
  return exprPromise;
}

/** True when the expression matrix has already been decoded. */
export function isExpressionMatrixLoaded(): boolean {
  return exprResult !== null;
}

/** Convenience loader: core data plus the expression matrix. */
export async function fetchRemoteDataset(
  onProgress?: (p: LoadProgress) => void
): Promise<SingleCellDataset> {
  const core = await fetchCoreDataset(onProgress);
  const expression = await fetchExpressionMatrix(
    core.cells.map((c) => c.id),
    onProgress
  );
  onProgress?.({ phase: "done", percent: 100, message: "Dataset ready" });
  return { ...core, expression };
}

// ---------------------------------------------------------------------------
// Core dataset
// ---------------------------------------------------------------------------
async function loadCoreDataset(
  onProgress?: (p: LoadProgress) => void
): Promise<SingleCellDataset> {
  onProgress?.({ phase: "downloading", percent: 0, message: "Loading core data…" });
  const endPhase = startPhase("core dataset load");

  const coreData = await fetchJsonWithFallback(REMOTE_CORE_URL, LOCAL_CORE_URL);
  const dataset = normalizeDataset(coreData);
  coreResult = dataset;

  endPhase({ cells: dataset.cells.length, genes: dataset.genes.length });
  onProgress?.({ phase: "done", percent: 100, message: "Core data loaded" });
  return dataset;
}

// ---------------------------------------------------------------------------
// Expression matrix
// ---------------------------------------------------------------------------
async function loadExpressionMatrix(
  cellIds: string[],
  onProgress?: (p: LoadProgress) => void,
  signal?: AbortSignal
): Promise<ExpressionMatrix> {
  onProgress?.({
    phase: "downloading",
    percent: 0,
    message: "Downloading expression matrix…",
  });

  const endDownload = startPhase("expression matrix download");
  const bytes = await streamFetchBytes(
    REMOTE_EXPR_URL,
    LOCAL_EXPR_URL,
    (pct, msg) => {
      onProgress?.({ phase: "downloading", percent: pct, message: msg });
    },
    signal
  );
  endDownload({ bytes: bytes.byteLength });

  onProgress?.({ phase: "parsing", percent: 0, message: "Decoding expression matrix…" });

  const endDecode = startPhase("expression matrix decode");
  let sparse: Map<string, SparseGene>;
  try {
    sparse = parseSparseExpression(bytes, (fraction) => {
      onProgress?.({
        phase: "parsing",
        percent: Math.round(fraction * 100),
        message: "Decoding expression matrix…",
      });
    });
  } catch (e) {
    throw new Error(
      `Could not decode the expression matrix (${(bytes.byteLength / 1e6).toFixed(0)} MB). ` +
        `Regenerate the split files with scripts/compress_dataset.py. Details: ${e}`
    );
  }
  endDecode({ genes: sparse.size, peakHeapMB: Number(getPeakHeapMB().toFixed(1)) });

  const matrix = new SparseExpressionMatrix(sparse, cellIds);
  exprResult = matrix;
  onProgress?.({ phase: "done", percent: 100, message: "Expression matrix ready" });
  return matrix;
}


/** Try remote URL first, fall back to local */
async function fetchJsonWithFallback(remoteUrl: string, localUrl: string): Promise<unknown> {
  try {
    const resp = await fetch(remoteUrl);
    if (resp.ok) return await resp.json();
  } catch { /* fall through */ }

  const resp = await fetch(localUrl);
  if (!resp.ok) {
    throw new Error(
      `Could not load the core dataset from either ${remoteUrl} or ${localUrl}`
    );
  }
  return resp.json();
}

/**
 * Stream-fetch binary data with progress, trying remote then local.
 * Writes directly into a single preallocated buffer when the server reports a
 * content length, avoiding a second full copy of the payload.
 */
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
    if (!resp.ok) {
      throw new Error(
        `Could not load the expression matrix from either ${remoteUrl} or ${localUrl}`
      );
    }
    response = resp;
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming downloads are not supported in this browser");

  const totalMb = contentLength > 0 ? ` / ${(contentLength / 1e6).toFixed(0)}` : "";
  let receivedBytes = 0;

  const report = () => {
    const pct = contentLength > 0
      ? Math.min(99, Math.round((receivedBytes / contentLength) * 100))
      : 50;
    onProgress(pct, `Downloading expression… ${(receivedBytes / 1e6).toFixed(0)}${totalMb} MB`);
  };

  // Fast path: single preallocated buffer (no second copy)
  if (contentLength > 0) {
    const buffer = new Uint8Array(contentLength);
    let overflow: Uint8Array[] | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (receivedBytes + value.length <= contentLength) {
        buffer.set(value, receivedBytes);
      } else {
        // Server under-reported the size; keep the tail separately
        (overflow ||= []).push(value);
      }
      receivedBytes += value.length;
      report();
    }

    if (!overflow && receivedBytes === contentLength) return buffer;
    if (!overflow) return buffer.subarray(0, receivedBytes);

    const merged = new Uint8Array(receivedBytes);
    merged.set(buffer.subarray(0, contentLength), 0);
    let offset = contentLength;
    for (const chunk of overflow) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }

  // Unknown length: collect chunks, then concatenate once
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedBytes += value.length;
    report();
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
