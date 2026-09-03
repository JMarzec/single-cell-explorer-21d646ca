/// <reference lib="webworker" />
/**
 * Dataset worker — downloads and decodes the core dataset and the sparse
 * expression matrix off the main thread, so the dashboard stays interactive
 * and animations never stutter while a few hundred MB stream in.
 *
 * Protocol (main -> worker):
 *   { type: "core" }
 *   { type: "expression" }
 * Protocol (worker -> main):
 *   { type: "progress", phase, percent, message }
 *   { type: "core-done", data }
 *   { type: "expression-done", genes, indices[], values[] }   (buffers transferred)
 *   { type: "error", message }
 */
import {
  REMOTE_CORE_URL,
  REMOTE_EXPR_URL,
  LOCAL_CORE_URL,
  LOCAL_EXPR_URL,
} from "@/lib/datasetConfig";
import { fetchJsonWithFallback, streamFetchBytes } from "@/lib/fetchStream";
import { parseSparseExpression } from "@/lib/msgpackSparse";

export type WorkerRequest = { type: "core" } | { type: "expression" };

export type WorkerResponse =
  | { type: "progress"; phase: "downloading" | "parsing"; percent: number; message: string }
  | { type: "core-done"; data: unknown }
  | {
      type: "expression-done";
      genes: string[];
      indices: Int32Array[];
      values: Float32Array[];
      decodeMs: number;
      bytes: number;
    }
  | { type: "error"; message: string };

const post = (msg: WorkerResponse, transfer?: Transferable[]) =>
  transfer ? self.postMessage(msg, transfer) : self.postMessage(msg);

const progress = (
  phase: "downloading" | "parsing",
  percent: number,
  message: string
) => post({ type: "progress", phase, percent, message });

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    if (event.data.type === "core") {
      progress("downloading", 0, "Loading core data…");
      const data = await fetchJsonWithFallback(REMOTE_CORE_URL, LOCAL_CORE_URL);
      progress("parsing", 100, "Core data loaded");
      post({ type: "core-done", data });
      return;
    }

    if (event.data.type === "expression") {
      const bytes = await streamFetchBytes(
        REMOTE_EXPR_URL,
        LOCAL_EXPR_URL,
        (pct, msg) => progress("downloading", pct, msg)
      );

      progress("parsing", 0, "Decoding expression matrix…");
      const startedAt = performance.now();
      const sparse = parseSparseExpression(bytes, (fraction) =>
        progress("parsing", Math.round(fraction * 100), "Decoding expression matrix…")
      );
      const decodeMs = performance.now() - startedAt;

      const genes: string[] = [];
      const indices: Int32Array[] = [];
      const values: Float32Array[] = [];
      const transfer: Transferable[] = [];
      for (const [gene, entry] of sparse) {
        genes.push(gene);
        indices.push(entry.indices);
        values.push(entry.values);
        transfer.push(entry.indices.buffer, entry.values.buffer);
      }
      sparse.clear();

      post(
        {
          type: "expression-done",
          genes,
          indices,
          values,
          decodeMs,
          bytes: bytes.byteLength,
        },
        transfer
      );
      return;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    post({ type: "error", message });
  }
};
