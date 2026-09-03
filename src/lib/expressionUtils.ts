import { Cell, SingleCellDataset } from "@/types/singleCell";
import { getGeneExpression as getDemoGeneExpression } from "@/data/demoData";

/**
 * Get gene expression data from the dataset.
 * Uses real expression data when an expression matrix is present.
 * If the matrix exists but the gene has no entries, the gene is not expressed
 * (sparse encoding omits all-zero genes) so zeros are returned — never synthetic values.
 * Synthetic demo values are only used for the built-in demo dataset (no matrix at all).
 */
export function getExpressionData(
  dataset: SingleCellDataset,
  gene: string
): Map<string, number> {
  const matrix = dataset.expression;
  if (matrix) {
    const values = matrix.getValues(gene);
    const result = new Map<string, number>();
    const cellIds = matrix.cellIds;
    for (let i = 0; i < cellIds.length; i++) {
      // Gene absent from the matrix => no expression detected
      result.set(cellIds[i], values ? values[i] : 0);
    }
    return result;
  }

  // Demo dataset only: generated illustrative values
  if (dataset.syntheticExpression) {
    return getDemoGeneExpression(dataset.cells, gene);
  }

  // Real dataset without a loaded matrix: no expression data available
  const result = new Map<string, number>();
  for (const cell of dataset.cells) result.set(cell.id, 0);
  return result;
}

/**
 * Genes that have no expression data available.
 * When no matrix is loaded for a real dataset, every requested gene is
 * unavailable — never fall back to fabricated values.
 */
export function getUndetectedGenes(
  dataset: SingleCellDataset,
  genes: string[]
): string[] {
  const matrix = dataset.expression;
  if (!matrix) {
    if (dataset.syntheticExpression) return [];
    return genes.filter(Boolean);
  }
  return genes.filter((g) => g && !matrix.hasGene(g));
}

/** True when the gene has no expression data available. */
export function isGeneUndetected(
  dataset: SingleCellDataset,
  gene: string | null
): boolean {
  if (!gene) return false;
  return getUndetectedGenes(dataset, [gene]).length === 1;
}



/**
 * Get expression values for multiple genes.
 */
export function getMultiGeneExpression(
  dataset: SingleCellDataset,
  genes: string[]
): Record<string, Map<string, number>> {
  const result: Record<string, Map<string, number>> = {};
  
  for (const gene of genes) {
    result[gene] = getExpressionData(dataset, gene);
  }
  
  return result;
}

/**
 * Get averaged expression across multiple genes.
 */
export function getAveragedExpression(
  dataset: SingleCellDataset,
  genes: string[]
): Map<string, number> {
  if (genes.length === 0) return new Map();
  
  const geneMaps = genes.map(gene => getExpressionData(dataset, gene));
  const cellIds = new Set<string>();
  
  // Collect all cell IDs
  geneMaps.forEach(map => map.forEach((_, cellId) => cellIds.add(cellId)));
  
  const result = new Map<string, number>();
  cellIds.forEach(cellId => {
    let sum = 0;
    let count = 0;
    geneMaps.forEach(map => {
      const val = map.get(cellId);
      if (val !== undefined) {
        sum += val;
        count++;
      }
    });
    result.set(cellId, count > 0 ? sum / count : 0);
  });
  
  return result;
}

/**
 * Calculate percentile value from sorted array.
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]);
}

/**
 * Get unique values for a metadata annotation.
 */
export function getAnnotationValues(
  cells: Cell[],
  annotation: string
): string[] {
  const values = new Set<string>();
  cells.forEach(cell => {
    const value = cell.metadata[annotation];
    if (value !== undefined && value !== null) {
      values.add(String(value));
    }
  });
  return Array.from(values).sort();
}

/**
 * Create a color mapping for annotation values.
 */
export function getAnnotationColorMap(
  values: string[]
): Record<string, string> {
  const colors: Record<string, string> = {};
  const palette = [
    [52, 152, 165],   // teal
    [215, 95, 130],   // pink
    [210, 180, 60],   // gold
    [90, 165, 110],   // green
    [165, 105, 180],  // purple
    [215, 130, 65],   // orange
    [75, 170, 155],   // teal-green
    [190, 100, 165],  // magenta
    [130, 170, 85],   // lime
    [100, 140, 200],  // blue
    [180, 80, 80],    // red
    [120, 100, 160],  // lavender
  ];
  
  values.forEach((value, idx) => {
    const color = palette[idx % palette.length];
    colors[value] = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  });
  
  return colors;
}
