/**
 * Dataset source configuration — the ONLY place you need to edit to swap in
 * your own dataset.
 *
 * Produce the two files with `scripts/compress_dataset.py` from your exported
 * Seurat/Scanpy JSON, drop them in `public/`, and (optionally) point the remote
 * URLs at wherever you host them. Local paths are tried when the remote fails.
 *
 * See DATASET.md for the full step-by-step walkthrough.
 */

/** Core data: cells, coordinates, metadata, clusters, gene list, DE results. */
export const REMOTE_CORE_URL =
  "https://raw.githubusercontent.com/JMarzec/single-cell-explorer-21d646ca/main/public/dataset_core.json";

/** Sparse expression matrix (MessagePack, Git-LFS backed on GitHub). */
export const REMOTE_EXPR_URL =
  "https://media.githubusercontent.com/media/JMarzec/single-cell-explorer-21d646ca/main/public/dataset_expression.msgpack";

/** Local fallbacks, served from public/ in dev and production. */
export const LOCAL_CORE_URL = "/dataset_core.json";
export const LOCAL_EXPR_URL = "/dataset_expression.msgpack";
