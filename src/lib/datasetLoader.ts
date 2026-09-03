import { ExpressionMatrix, SingleCellDataset } from "@/types/singleCell";
import { parseSparseExpression, SparseGene } from "@/lib/msgpackSparse";
import { SparseExpressionMatrix, matrixFromRecord } from "@/lib/expressionMatrix";
import { startPhase, getPeakHeapMB, trackHeap } from "@/lib/perf";
import {
  getActiveSource,
  getEffectiveSourceId,
  getUploadedDataset,
  BUILT_IN_SOURCE,
} from "@/lib/datasetRegistry";
import { fetchJsonWithFallback, streamFetchBytes } from "@/lib/fetchStream";
import type { WorkerRequest, WorkerResponse } from "@/workers/datasetWorker";

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
    name: String(rawMeta.name || "Single-Cell Dataset"),
    description: String(
      rawMeta.description || "Single-cell dataset"
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
// Caching (per active dataset source)
// ---------------------------------------------------------------------------
let corePromise: Promise<SingleCellDataset> | null = null;
let coreResult: SingleCellDataset | null = null;
let exprPromise: Promise<ExpressionMatrix> | null = null;
let exprResult: ExpressionMatrix | null = null;
let cachedSourceId: string | null = null;

/** Drop cached data when the user switches to another dataset. */
function resetCachesIfSourceChanged() {
  const id = getEffectiveSourceId();
  if (cachedSourceId !== id) {
    cachedSourceId = id;
    corePromise = null;
    coreResult = null;
    exprPromise = null;
    exprResult = null;
  }
}

/** Explicitly clear every cached dataset (used after a dataset swap). */
export function clearDatasetCaches() {
  cachedSourceId = null;
  corePromise = null;
  coreResult = null;
  exprPromise = null;
  exprResult = null;
}

/**
 * Fetch the small core dataset (cells, clusters, genes, DE results) without the
 * expression matrix. Cheap enough to block the first render on.
 */
export function fetchCoreDataset(
  onProgress?: (p: LoadProgress) => void
): Promise<SingleCellDataset> {
  resetCachesIfSourceChanged();

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
  resetCachesIfSourceChanged();

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
// Worker plumbing
// ---------------------------------------------------------------------------
/**
 * Runs one worker request (core or expression) and resolves with the worker's
 * terminal message. The worker is created per request and terminated after,
 * so cancelling a huge download frees its memory immediately.
 */
function runInWorker(
  request: WorkerRequest,
  onProgress?: (p: LoadProgress) => void,
  signal?: AbortSignal
): Promise<Extract<WorkerResponse, { type: "core-done" | "expression-done" }>> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("../workers/datasetWorker.ts", import.meta.url), {
        type: "module",
      });
    } catch (e) {
      reject(e);
      return;
    }

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
    };

    function onAbort() {
      cleanup();
      reject(new DOMException("Download cancelled", "AbortError"));
    }

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "progress") {
        trackHeap();
        onProgress?.({ phase: msg.phase, percent: msg.percent, message: msg.message });
        return;
      }
      if (msg.type === "error") {
        cleanup();
        reject(new Error(msg.message));
        return;
      }
      cleanup();
      resolve(msg);
    };

    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || "Dataset worker failed"));
    };

    worker.postMessage(request);
  });
}

// ---------------------------------------------------------------------------
// Core dataset
// ---------------------------------------------------------------------------
async function loadCoreDataset(
  onProgress?: (p: LoadProgress) => void
): Promise<SingleCellDataset> {
  onProgress?.({ phase: "downloading", percent: 0, message: "Loading core data…" });
  const endPhase = startPhase("core dataset load");

  const source = getActiveSource();

  // Uploaded datasets are already parsed and live in memory.
  if (source.kind === "uploaded") {
    const uploaded = getUploadedDataset(getEffectiveSourceId());
    if (!uploaded) {
      throw new Error(
        "The uploaded dataset is no longer in memory (uploads are session-only). Upload it again from the Dataset Swap page."
      );
    }
    coreResult = uploaded;
    exprResult = uploaded.expression ?? null;
    endPhase({ cells: uploaded.cells.length, genes: uploaded.genes.length });
    onProgress?.({ phase: "done", percent: 100, message: "Uploaded dataset ready" });
    return uploaded;
  }

  const coreUrl = source.coreUrl ?? BUILT_IN_SOURCE.coreUrl!;
  const localCoreUrl = source.localCoreUrl;

  let coreData: unknown;
  try {
    const msg = await runInWorker(
      { type: "core", url: coreUrl, localUrl: localCoreUrl },
      onProgress
    );
    if (msg.type !== "core-done") throw new Error("Unexpected worker response");
    coreData = msg.data;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    // Workers unavailable (or blocked): fall back to the main thread.
    console.warn("Dataset worker unavailable, loading core data on main thread:", e);
    coreData = await fetchJsonWithFallback(coreUrl, localCoreUrl);
  }

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
  const source = getActiveSource();

  if (source.kind === "uploaded") {
    const uploaded = getUploadedDataset(getEffectiveSourceId());
    const matrix =
      uploaded?.expression ?? new SparseExpressionMatrix(new Map(), cellIds);
    exprResult = matrix;
    onProgress?.({ phase: "done", percent: 100, message: "Expression matrix ready" });
    return matrix;
  }

  const exprUrl = source.exprUrl;
  if (!exprUrl) {
    throw new Error(
      `No expression matrix URL is configured for "${source.name}". Add one on the Dataset Swap page.`
    );
  }

  onProgress?.({
    phase: "downloading",
    percent: 0,
    message: "Downloading expression matrix…",
  });

  const endPhase = startPhase("expression matrix (worker)");
  let sparse: Map<string, SparseGene>;

  try {
    const msg = await runInWorker(
      { type: "expression", url: exprUrl, localUrl: source.localExprUrl },
      onProgress,
      signal
    );
    if (msg.type !== "expression-done") throw new Error("Unexpected worker response");
    sparse = new Map<string, SparseGene>();
    for (let i = 0; i < msg.genes.length; i++) {
      sparse.set(msg.genes[i], { indices: msg.indices[i], values: msg.values[i] });
    }
    endPhase({
      genes: sparse.size,
      bytes: msg.bytes,
      decodeMs: Math.round(msg.decodeMs),
      peakHeapMB: Number(getPeakHeapMB().toFixed(1)),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    console.warn("Dataset worker unavailable, decoding expression on main thread:", e);
    sparse = await loadExpressionOnMainThread(
      exprUrl,
      source.localExprUrl,
      onProgress,
      signal
    );
    endPhase({ genes: sparse.size, peakHeapMB: Number(getPeakHeapMB().toFixed(1)) });
  }

  const matrix = new SparseExpressionMatrix(sparse, cellIds);
  exprResult = matrix;
  onProgress?.({ phase: "done", percent: 100, message: "Expression matrix ready" });
  return matrix;
}

/** Fallback path for browsers without module workers. */
async function loadExpressionOnMainThread(
  exprUrl: string,
  localExprUrl: string | undefined,
  onProgress?: (p: LoadProgress) => void,
  signal?: AbortSignal
): Promise<Map<string, SparseGene>> {
  const bytes = await streamFetchBytes(
    exprUrl,
    localExprUrl,
    (pct, msg) => {
      trackHeap();
      onProgress?.({ phase: "downloading", percent: pct, message: msg });
    },
    signal
  );

  onProgress?.({ phase: "parsing", percent: 0, message: "Decoding expression matrix…" });
  try {
    return parseSparseExpression(bytes, (fraction) => {
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
}
