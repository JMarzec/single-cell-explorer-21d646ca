export interface Cell {
  id: string;
  x: number; // UMAP/tSNE coordinate
  y: number;
  cluster: number;
  metadata: Record<string, string | number>;
}

export interface GeneExpression {
  geneId: string;
  geneName: string;
  values: Map<string, number>; // cellId -> expression value
}

export interface DifferentialExpression {
  gene: string;
  cluster: string;
  logFC: number;
  pValue: number;
  pAdj: number;
}

export interface ClusterInfo {
  id: number;
  name: string;
  cellCount: number;
  color: string;
}

export interface DatasetMetadata {
  name: string;
  description: string;
  cellCount: number;
  geneCount: number;
  clusterCount: number;
  organism?: string;
  tissue?: string;
  source?: string;
}

export interface SingleCellDataset {
  metadata: DatasetMetadata;
  cells: Cell[];
  genes: string[];
  clusters: ClusterInfo[];
  differentialExpression: DifferentialExpression[];
  // Expression matrix: gene -> (cellId -> expression value)
  expression?: Record<string, Record<string, number>>;
  // Metadata annotation options (e.g., cell_type, sample)
  annotationOptions?: string[];
}

export type ColorPalette = 'viridis' | 'magma' | 'plasma' | 'inferno' | 'grrd' | 'blues';

export interface CellFilterState {
  selectedSamples: string[];
  selectedClusters: number[];
}

export interface VisualizationSettings {
  pointSize: number;
  showClusters: boolean;
  showLabels: boolean;
  colorPalette: ColorPalette;
  selectedGene: string | null;
  selectedGenes: string[];
  opacity: number;
  cellFilter: CellFilterState;
  expressionScale: number; // 0.1 to 3.0, adjusts color intensity mapping
  usePercentileClipping: boolean; // Use percentile bounds instead of min/max
  percentileLow: number; // Lower percentile (default 5)
  percentileHigh: number; // Upper percentile (default 95)
  showAveragedExpression: boolean; // Show averaged expression when multiple genes selected
}
