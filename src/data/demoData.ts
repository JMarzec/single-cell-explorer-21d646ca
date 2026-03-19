import { Cell, ClusterInfo, DifferentialExpression, SingleCellDataset } from "@/types/singleCell";

// Generate realistic demo scRNA-seq data
const CLUSTER_NAMES = [
  "Cardiomyocytes",
  "Endothelial",
  "Fibroblasts",
  "Smooth Muscle",
  "Macrophages",
  "T Cells",
  "Epicardial",
  "Endocardial",
  "Neural Crest",
  "Pericytes",
];

const CLUSTER_COLORS = [
  [52, 152, 165],   // cluster-0: teal
  [215, 95, 130],   // cluster-1: pink
  [210, 180, 60],   // cluster-2: gold
  [90, 165, 110],   // cluster-3: green
  [165, 105, 180],  // cluster-4: purple
  [215, 130, 65],   // cluster-5: orange
  [75, 170, 155],   // cluster-6: teal-green
  [190, 100, 165],  // cluster-7: magenta
  [130, 170, 85],   // cluster-8: lime
  [100, 140, 200],  // cluster-9: blue
];

// Cluster centers for UMAP-like distribution
const CLUSTER_CENTERS = [
  { x: 15, y: 25 },
  { x: -25, y: 35 },
  { x: -5, y: -15 },
  { x: 30, y: -5 },
  { x: -30, y: -25 },
  { x: 45, y: 15 },
  { x: -15, y: 10 },
  { x: 10, y: -35 },
  { x: -40, y: 5 },
  { x: 25, y: 40 },
];

// Gene lists with realistic names
const MARKER_GENES: Record<number, string[]> = {
  0: ["MYH7", "TNNT2", "MYL2", "ACTC1", "TNNC1"],
  1: ["EMCN", "PLVAP", "CDH5", "PECAM1", "VWF"],
  2: ["COL1A1", "DCN", "LUM", "POSTN", "COL3A1"],
  3: ["ACTA2", "TAGLN", "MYH11", "CNN1", "MYOCD"],
  4: ["CD68", "CD14", "CSF1R", "MARCO", "C1QA"],
  5: ["CD3E", "CD3D", "CD2", "IL7R", "TCF7"],
  6: ["WT1", "TBX18", "ALDH1A2", "UPK3B", "MSLN"],
  7: ["NPR3", "HAPLN1", "NFATC1", "SOX9", "NOTCH1"],
  8: ["SOX10", "TFAP2A", "FOXD3", "PAX3", "NGFR"],
  9: ["RGS5", "PDGFRB", "NOTCH3", "KCNJ8", "DES"],
};

const ALL_GENES = [
  ...new Set(Object.values(MARKER_GENES).flat()),
  "GAPDH", "ACTB", "RPL13A", "B2M", "HPRT1", "TBP", "PPIA", "RPLP0",
  "GUSB", "HMBS", "YWHAZ", "SDHA", "TFRC", "ATP5F1", "PGK1",
];

function gaussianRandom(mean: number, std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * std + mean;
}

function generateCells(count: number): Cell[] {
  const cells: Cell[] = [];
  const cellsPerCluster = Math.floor(count / CLUSTER_CENTERS.length);
  
  for (let clusterIdx = 0; clusterIdx < CLUSTER_CENTERS.length; clusterIdx++) {
    const center = CLUSTER_CENTERS[clusterIdx];
    const clusterSize = clusterIdx === CLUSTER_CENTERS.length - 1 
      ? count - cells.length 
      : cellsPerCluster + Math.floor(Math.random() * 200 - 100);
    
    for (let i = 0; i < clusterSize; i++) {
      const spreadX = gaussianRandom(0, 6 + Math.random() * 3);
      const spreadY = gaussianRandom(0, 6 + Math.random() * 3);
      
      cells.push({
        id: `cell_${cells.length}`,
        x: center.x + spreadX,
        y: center.y + spreadY,
        cluster: clusterIdx,
        metadata: {
          nCount_RNA: Math.floor(5000 + Math.random() * 15000),
          nFeature_RNA: Math.floor(1500 + Math.random() * 3500),
          percent_mt: Math.round((2 + Math.random() * 6) * 100) / 100,
          sample: `Sample_${Math.floor(Math.random() * 3) + 1}`,
          cell_type: CLUSTER_NAMES[clusterIdx],
        },
      });
    }
  }
  
  return cells;
}

function generateDifferentialExpression(): DifferentialExpression[] {
  const deResults: DifferentialExpression[] = [];
  
  for (const [clusterStr, genes] of Object.entries(MARKER_GENES)) {
    const cluster = parseInt(clusterStr);
    genes.forEach((gene, idx) => {
      deResults.push({
        gene,
        cluster: `Cl_${cluster}`,
        logFC: Math.round((2.5 - idx * 0.15 + Math.random() * 0.3) * 100) / 100,
        pValue: Math.pow(10, -(280 + Math.random() * 20)),
        pAdj: Math.pow(10, -(250 + Math.random() * 20)),
      });
    });
    
    // Add some weaker markers
    for (let i = 0; i < 3; i++) {
      const randomGene = ALL_GENES[Math.floor(Math.random() * ALL_GENES.length)];
      if (!genes.includes(randomGene)) {
        deResults.push({
          gene: randomGene,
          cluster: `Cl_${cluster}`,
          logFC: Math.round((0.5 + Math.random() * 0.8) * 100) / 100,
          pValue: Math.pow(10, -(50 + Math.random() * 100)),
          pAdj: Math.pow(10, -(40 + Math.random() * 80)),
        });
      }
    }
  }
  
  return deResults.sort((a, b) => b.logFC - a.logFC);
}

function generateClusterInfo(): ClusterInfo[] {
  return CLUSTER_NAMES.map((name, idx) => ({
    id: idx,
    name,
    cellCount: 0, // Will be calculated after cells are generated
    color: `rgb(${CLUSTER_COLORS[idx].join(",")})`,
  }));
}

export function generateDemoDataset(cellCount: number = 15000): SingleCellDataset {
  const cells = generateCells(cellCount);
  const clusters = generateClusterInfo();
  
  // Update cluster cell counts
  cells.forEach(cell => {
    clusters[cell.cluster].cellCount++;
  });
  
  return {
    metadata: {
      name: "Heart organoids single-cell data",
      description: "Single-cell RNA-seq data from heart organoids.",
      cellCount: cells.length,
      geneCount: ALL_GENES.length,
      clusterCount: clusters.length,
      organism: "Homo sapiens",
      tissue: "Heart",
      source: "Demo data",
    },
    cells,
    genes: ALL_GENES.sort(),
    clusters,
    differentialExpression: generateDifferentialExpression(),
    annotationOptions: ["cell_type", "sample"],
  };
}

// Generate expression values for a specific gene
export function getGeneExpression(
  cells: Cell[],
  gene: string,
  markerGenes: Record<number, string[]> = MARKER_GENES
): Map<string, number> {
  const expression = new Map<string, number>();
  
  // Find which cluster this gene is a marker for
  let markerCluster = -1;
  for (const [cluster, genes] of Object.entries(markerGenes)) {
    if (genes.includes(gene)) {
      markerCluster = parseInt(cluster);
      break;
    }
  }
  
  cells.forEach(cell => {
    let value: number;
    
    if (markerCluster >= 0 && cell.cluster === markerCluster) {
      // High expression in marker cluster
      value = 2 + Math.random() * 2.5;
    } else if (markerCluster >= 0) {
      // Low expression in other clusters
      value = Math.random() * 0.8;
    } else {
      // Housekeeping gene - moderate expression everywhere
      value = 1 + gaussianRandom(0, 0.5);
    }
    
    expression.set(cell.id, Math.max(0, value));
  });
  
  return expression;
}

export function getClusterColors(): string[] {
  return CLUSTER_COLORS.map(c => `rgb(${c.join(",")})`);
}

export function getClusterColorRGBA(clusterId: number, alpha: number = 1): [number, number, number, number] {
  const color = CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
  return [color[0], color[1], color[2], Math.floor(alpha * 255)];
}
