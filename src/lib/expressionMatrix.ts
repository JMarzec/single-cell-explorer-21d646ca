import { ExpressionMatrix } from "@/types/singleCell";
import { SparseGene } from "@/lib/msgpackSparse";

/**
 * Memory-efficient expression matrix backed by typed arrays.
 * Values are stored sparsely (only non-zero entries) per gene and expanded
 * to a dense per-cell array only on demand for the requested gene.
 */
export class SparseExpressionMatrix implements ExpressionMatrix {
  readonly cellIds: string[];
  readonly genes: string[];
  private data: Map<string, SparseGene>;
  private cache = new Map<string, Float32Array>();
  private cacheOrder: string[] = [];
  private static MAX_CACHE = 12;

  constructor(data: Map<string, SparseGene>, cellIds: string[]) {
    this.data = data;
    this.cellIds = cellIds;
    this.genes = Array.from(data.keys());
  }

  hasGene(gene: string): boolean {
    return this.data.has(gene);
  }

  getValues(gene: string): Float32Array | undefined {
    const cached = this.cache.get(gene);
    if (cached) return cached;

    const sparse = this.data.get(gene);
    if (!sparse) return undefined;

    const dense = new Float32Array(this.cellIds.length);
    const { indices, values } = sparse;
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      if (idx >= 0 && idx < dense.length) dense[idx] = values[i];
    }

    this.cache.set(gene, dense);
    this.cacheOrder.push(gene);
    if (this.cacheOrder.length > SparseExpressionMatrix.MAX_CACHE) {
      const evicted = this.cacheOrder.shift();
      if (evicted) this.cache.delete(evicted);
    }

    return dense;
  }
}

/**
 * Wrap a plain `gene -> { cellId: value }` object (demo datasets)
 * in the same interface.
 */
export function matrixFromRecord(
  record: Record<string, Record<string, number>>,
  cellIds: string[]
): ExpressionMatrix {
  const cellIndex = new Map<string, number>();
  cellIds.forEach((id, i) => cellIndex.set(id, i));

  const data = new Map<string, SparseGene>();
  for (const [gene, cellMap] of Object.entries(record)) {
    const entries = Object.entries(cellMap).filter(([, v]) => v !== 0);
    const indices = new Int32Array(entries.length);
    const values = new Float32Array(entries.length);
    entries.forEach(([cellId, value], i) => {
      indices[i] = cellIndex.get(cellId) ?? -1;
      values[i] = value;
    });
    data.set(gene, { indices, values });
  }

  return new SparseExpressionMatrix(data, cellIds);
}
