import { Cell, SingleCellDataset } from "@/types/singleCell";
import { getGeneExpression as getDemoGeneExpression } from "@/data/demoData";

/**
 * Get gene expression data from the dataset.
 * Uses real expression data if available, falls back to demo data generation.
 */
export function getExpressionData(
  dataset: SingleCellDataset,
  gene: string
): Map<string, number> {
  // Check if dataset has real expression data
  if (dataset.expression && dataset.expression[gene]) {
    const exprData = dataset.expression[gene];
    return new Map(Object.entries(exprData));
  }
  
  // Fallback to demo data generation
  return getDemoGeneExpression(dataset.cells, gene);
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
