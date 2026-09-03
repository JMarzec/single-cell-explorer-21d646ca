/**
 * Dataset registry — lets the app switch between datasets at runtime instead of
 * editing `src/lib/datasetConfig.ts`.
 *
 * Three kinds of sources:
 *  - built-in   : the bundled heart organoid dataset (URLs from datasetConfig)
 *  - remote     : user-registered core/expression URLs (persisted in localStorage)
 *  - uploaded   : a Seurat/Scanpy JSON parsed in the browser (session only)
 */
import {
  REMOTE_CORE_URL,
  REMOTE_EXPR_URL,
  LOCAL_CORE_URL,
  LOCAL_EXPR_URL,
} from "@/lib/datasetConfig";
import type { SingleCellDataset } from "@/types/singleCell";

export type DatasetSourceKind = "built-in" | "remote" | "uploaded";

export interface DatasetSource {
  id: string;
  name: string;
  description?: string;
  kind: DatasetSourceKind;
  /** Core JSON URL (remote / built-in only) */
  coreUrl?: string;
  /** Sparse MessagePack expression URL (remote / built-in only) */
  exprUrl?: string;
  /** Optional local fallbacks, used when the remote URL fails */
  localCoreUrl?: string;
  localExprUrl?: string;
}

const CUSTOM_KEY = "scx.customDatasetSources";
const ACTIVE_KEY = "scx.activeDatasetSource";

export const BUILT_IN_SOURCE: DatasetSource = {
  id: "built-in",
  name: "Heart organoid (built-in)",
  description: "Pre-processed heart organoid dataset shipped with the app.",
  kind: "built-in",
  coreUrl: REMOTE_CORE_URL,
  exprUrl: REMOTE_EXPR_URL,
  localCoreUrl: LOCAL_CORE_URL,
  localExprUrl: LOCAL_EXPR_URL,
};

/** Uploaded datasets live in memory only — they disappear on reload. */
const uploadedDatasets = new Map<string, SingleCellDataset>();
const uploadedSources: DatasetSource[] = [];

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function subscribeToSources(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readCustomSources(): DatasetSource[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DatasetSource[]) : [];
  } catch {
    return [];
  }
}

function writeCustomSources(sources: DatasetSource[]) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(sources));
  } catch {
    /* storage unavailable — keep going with in-memory state only */
  }
}

/** All selectable sources: built-in, saved remote URLs, session uploads. */
export function listDatasetSources(): DatasetSource[] {
  return [BUILT_IN_SOURCE, ...readCustomSources(), ...uploadedSources];
}

export function getDatasetSource(id: string): DatasetSource | undefined {
  return listDatasetSources().find((s) => s.id === id);
}

export function getActiveSourceId(): string {
  try {
    const id = localStorage.getItem(ACTIVE_KEY);
    if (id && getDatasetSource(id)) return id;
  } catch {
    /* ignore */
  }
  return BUILT_IN_SOURCE.id;
}

export function getActiveSource(): DatasetSource {
  return getDatasetSource(getActiveSourceId()) ?? BUILT_IN_SOURCE;
}

/** Persist the active choice. Uploads are session-only, so they are not saved. */
export function setActiveSourceId(id: string) {
  const source = getDatasetSource(id);
  try {
    if (source && source.kind === "uploaded") localStorage.removeItem(ACTIVE_KEY);
    else localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* ignore */
  }
  activeOverride = source?.kind === "uploaded" ? id : null;
  notify();
}

/** Session-only pointer used when an uploaded dataset is active. */
let activeOverride: string | null = null;

export function getEffectiveSourceId(): string {
  if (activeOverride && getDatasetSource(activeOverride)) return activeOverride;
  return getActiveSourceId();
}

export function addRemoteSource(input: {
  name: string;
  coreUrl: string;
  exprUrl?: string;
  description?: string;
}): DatasetSource {
  const source: DatasetSource = {
    id: `remote-${Date.now().toString(36)}`,
    name: input.name.trim() || "Custom dataset",
    description: input.description?.trim() || undefined,
    kind: "remote",
    coreUrl: input.coreUrl.trim(),
    exprUrl: input.exprUrl?.trim() || undefined,
  };
  writeCustomSources([...readCustomSources(), source]);
  notify();
  return source;
}

export function removeSource(id: string) {
  writeCustomSources(readCustomSources().filter((s) => s.id !== id));
  const uploadIdx = uploadedSources.findIndex((s) => s.id === id);
  if (uploadIdx >= 0) uploadedSources.splice(uploadIdx, 1);
  uploadedDatasets.delete(id);
  if (getEffectiveSourceId() === id) setActiveSourceId(BUILT_IN_SOURCE.id);
  notify();
}

export function addUploadedDataset(
  name: string,
  dataset: SingleCellDataset
): DatasetSource {
  const source: DatasetSource = {
    id: `upload-${Date.now().toString(36)}`,
    name,
    description: `Uploaded this session — ${dataset.cells.length.toLocaleString()} cells, ${dataset.genes.length.toLocaleString()} genes.`,
    kind: "uploaded",
  };
  uploadedSources.push(source);
  uploadedDatasets.set(source.id, dataset);
  notify();
  return source;
}

export function getUploadedDataset(id: string): SingleCellDataset | undefined {
  return uploadedDatasets.get(id);
}
