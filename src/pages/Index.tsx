import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { ScatterPlot } from "@/components/scatter/ScatterPlot";
import { CellFilter } from "@/components/controls/CellFilter";
import { DisplayOptions } from "@/components/controls/DisplayOptions";
import { GeneSelectionPanel } from "@/components/controls/GeneSelectionPanel";
import { ClusterAnnotationTool } from "@/components/controls/ClusterAnnotationTool";
import { DifferentialExpressionTable } from "@/components/table/DifferentialExpressionTable";
import { ViolinPlot } from "@/components/plots/ViolinPlot";
import { FeaturePlot } from "@/components/plots/FeaturePlot";
import { DotPlot } from "@/components/plots/DotPlot";
import { PathwayEnrichment } from "@/components/analysis/PathwayEnrichment";
import { TrajectoryAnalysis } from "@/components/analysis/TrajectoryAnalysis";
import { PseudotimeHeatmap } from "@/components/analysis/PseudotimeHeatmap";
import { calculatePseudotime } from "@/components/analysis/TrajectoryAnalysis";
import { DatasetUploader } from "@/components/upload/DatasetUploader";
import { generateDemoDataset } from "@/data/demoData";
import { fetchRemoteDataset } from "@/lib/datasetLoader";
import { getExpressionData, getMultiGeneExpression, getAveragedExpression, getAnnotationValues, getAnnotationColorMap, calculatePercentile } from "@/lib/expressionUtils";
import { getPaletteGradientCSS } from "@/lib/colorPalettes";
import { VisualizationSettings, SingleCellDataset, CellFilterState as CellFilterType, Cell, ClusterInfo, ColorPalette } from "@/types/singleCell";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductTour, TourStep } from "@/components/tour/ProductTour";

const tourSteps: TourStep[] = [
  {
    target: "[data-tour='header']",
    title: "Welcome to Single-Cell Explorer",
    description: "This dashboard lets you explore single-cell datasets interactively. The header shows your dataset summary — total cells, genes, and clusters at a glance.",
    position: "bottom",
  },
  {
    target: "[data-tour='upload']",
    title: "Upload Your Dataset",
    description: "Click here to load your own single-cell dataset (JSON format) or use the pre-loaded heart organoid data.",
    position: "bottom",
  },
  {
    target: "[data-tour='metadata-plot']",
    title: "Metadata Scatter Plot",
    description: "Cells are projected into 2D space (t-SNE / UMAP). Each colour represents a different cell type or cluster. Use the dropdown above to switch annotations.",
    position: "right",
  },
  {
    target: "[data-tour='expression-plot']",
    title: "Gene Expression Plot",
    description: "When you search for a gene, this plot colours cells by expression level — from low (grey) to high (red). Hover over cells to see exact values.",
    position: "left",
  },
  {
    target: "[data-tour='gene-selection']",
    title: "Gene Selection Panel",
    description: "Search and select genes here. Pick a single gene to colour the expression plot, or select multiple genes for dot plots and violin comparisons.",
    position: "top",
  },
  {
    target: "[data-tour='display-options']",
    title: "Display Options",
    description: "Fine-tune your visualisation — adjust point size, opacity, colour palette, and toggle cluster labels. Use percentile clipping to handle outliers.",
    position: "top",
  },
  {
    target: "[data-tour='analysis-tabs']",
    title: "Analysis Tabs",
    description: "Explore deeper with violin plots, feature plots, and dot plots. Select genes first, then switch between tabs to see different views of expression data.",
    position: "top",
  },
  {
    target: "[data-tour='de-table']",
    title: "Differential Expression Table",
    description: "Browse marker genes ranked by statistical significance. Click any gene name to instantly colour the expression scatter plot. Sort and filter columns as needed.",
    position: "top",
  },
];

// Generate demo dataset as fallback
const defaultDataset = generateDemoDataset(15000);

// Wrapper that computes pseudotime for the heatmap using the first cluster as root
const PseudotimeHeatmapWrapper: React.FC<{
  cells: Cell[];
  clusters: ClusterInfo[];
  genes: string[];
  dataset: SingleCellDataset;
  colorPalette: ColorPalette;
}> = ({ cells, clusters, genes, dataset, colorPalette }) => {
  const pseudotimeMap = useMemo(() => calculatePseudotime(cells, 0), [cells]);
  const expressionDataMap = useMemo(
    () => getMultiGeneExpression(dataset, genes),
    [dataset, genes]
  );

  return (
    <PseudotimeHeatmap
      cells={cells}
      clusters={clusters}
      genes={genes}
      expressionDataMap={expressionDataMap}
      pseudotimeMap={pseudotimeMap}
      colorPalette={colorPalette}
    />
  );
};

const defaultCellFilter: CellFilterType = {
  selectedSamples: [],
  selectedClusters: [],
};

const Index = () => {
  const [dataset, setDataset] = useState<SingleCellDataset>(defaultDataset);
  const [isLoadingRemote, setIsLoadingRemote] = useState(true);
  const [tourOpen, setTourOpen] = useState(false);
  const originalDatasetRef = useRef<SingleCellDataset>(defaultDataset);

  // Fetch remote dataset on mount
  useEffect(() => {
    fetchRemoteDataset()
      .then((remoteDataset) => {
        console.log("Remote dataset loaded:", remoteDataset.metadata.name, remoteDataset.cells.length, "cells");
        setDataset(remoteDataset);
        originalDatasetRef.current = remoteDataset;
      })
      .catch((err) => {
        console.warn("Failed to load remote dataset, using demo data:", err);
      })
      .finally(() => setIsLoadingRemote(false));
  }, []);

  // Selected cells from lasso/rectangle selection
  const [selectedCells, setSelectedCells] = useState<Cell[]>([]);
  
  // Annotation selection for left plot
  const [selectedAnnotation, setSelectedAnnotation] = useState<string>("cell_type");
  
  // Settings for visualization
  const [settings, setSettings] = useState<VisualizationSettings>({
    pointSize: 2,
    showClusters: true,
    showLabels: true,
    colorPalette: "grrd",
    selectedGene: null,
    selectedGenes: [],
    opacity: 0.8,
    cellFilter: defaultCellFilter,
    expressionScale: 1.0,
    usePercentileClipping: true,
    percentileLow: 5,
    percentileHigh: 95,
    showAveragedExpression: true,
  });

  const handleSettingsChange = useCallback(
    (updates: Partial<VisualizationSettings>) => {
      setSettings((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  // Get expression data for selected gene or averaged expression for multiple genes
  const expressionData = useMemo(() => {
    // If single gene selected, use it
    if (settings.selectedGene) {
      return getExpressionData(dataset, settings.selectedGene);
    }
    // If multiple genes selected and averaging is enabled, compute average
    if (settings.showAveragedExpression && settings.selectedGenes && settings.selectedGenes.length > 0) {
      return getAveragedExpression(dataset, settings.selectedGenes);
    }
    return undefined;
  }, [settings.selectedGene, settings.selectedGenes, settings.showAveragedExpression, dataset]);

  // Effective gene label for display
  const effectiveGeneLabel = useMemo(() => {
    if (settings.selectedGene) return settings.selectedGene;
    if (settings.showAveragedExpression && settings.selectedGenes && settings.selectedGenes.length > 0) {
      return `Avg(${settings.selectedGenes.slice(0, 3).join(', ')}${settings.selectedGenes.length > 3 ? '...' : ''})`;
    }
    return null;
  }, [settings.selectedGene, settings.selectedGenes, settings.showAveragedExpression]);

  // Get expression data for all selected genes (for dot plot)
  const multiGeneExpressionData = useMemo(() => {
    const genes = settings.selectedGenes || [];
    if (genes.length === 0) return {};
    return getMultiGeneExpression(dataset, genes);
  }, [settings.selectedGenes, dataset]);

  const handleDatasetLoad = useCallback((newDataset: SingleCellDataset) => {
    setDataset(newDataset);
    originalDatasetRef.current = newDataset;
    setSettings(prev => ({ ...prev, selectedGene: null, selectedGenes: [], cellFilter: defaultCellFilter }));
    // Set default annotation if cell_type exists
    const annotations = newDataset.annotationOptions || [];
    if (annotations.includes("cell_type")) {
      setSelectedAnnotation("cell_type");
    } else if (annotations.length > 0) {
      setSelectedAnnotation(annotations[0]);
    }
  }, []);

  // Cluster annotation handlers
  const handleRenameCluster = useCallback((clusterId: number, newName: string) => {
    setDataset(prev => ({
      ...prev,
      clusters: prev.clusters.map(c =>
        c.id === clusterId ? { ...c, name: newName } : c
      ),
      cells: prev.cells.map(cell =>
        cell.cluster === clusterId
          ? { ...cell, metadata: { ...cell.metadata, cell_type: newName } }
          : cell
      ),
    }));
  }, []);

  const handleMergeClusters = useCallback((sourceIds: number[], targetId: number, mergedName: string) => {
    setDataset(prev => {
      // Reassign cells from source clusters to target
      const newCells = prev.cells.map(cell =>
        sourceIds.includes(cell.cluster)
          ? { ...cell, cluster: targetId, metadata: { ...cell.metadata, cell_type: mergedName } }
          : cell
      );

      // Update target cluster name and remove source clusters
      const targetCluster = prev.clusters.find(c => c.id === targetId);
      const mergedCellCount = newCells.filter(c => c.cluster === targetId).length;
      
      const newClusters = prev.clusters
        .filter(c => !sourceIds.includes(c.id))
        .map(c =>
          c.id === targetId
            ? { ...c, name: mergedName, cellCount: mergedCellCount }
            : c
        );

      return {
        ...prev,
        cells: newCells,
        clusters: newClusters,
        metadata: { ...prev.metadata, clusterCount: newClusters.length },
      };
    });
  }, []);

  const handleChangeClusterColor = useCallback((clusterId: number, newColor: string) => {
    setDataset(prev => ({
      ...prev,
      clusters: prev.clusters.map(c =>
        c.id === clusterId ? { ...c, color: newColor } : c
      ),
    }));
  }, []);

  const handleResetClusters = useCallback(() => {
    setDataset(originalDatasetRef.current);
  }, []);

  const handleGeneClick = useCallback((gene: string) => {
    setSettings((prev) => ({ ...prev, selectedGene: gene }));
  }, []);

  const clusterNames = useMemo(
    () => dataset.clusters.map((c) => c.name),
    [dataset.clusters]
  );

  // Get annotation options for the left plot
  const annotationOptions = useMemo(() => {
    const options = dataset.annotationOptions || [];
    // Always include cluster as an option
    if (!options.includes("cluster")) {
      return ["cluster", ...options];
    }
    return options;
  }, [dataset.annotationOptions]);

  // Get annotation values and colors for current selection
  const annotationData = useMemo(() => {
    if (selectedAnnotation === "cluster") {
      // Show cluster numbers (0, 1, 2, ...) not cell type names
      const clusterIds = dataset.clusters.map(c => `Cluster ${c.id}`);
      return {
        values: clusterIds,
        colorMap: Object.fromEntries(dataset.clusters.map(c => [`Cluster ${c.id}`, c.color])),
        getCellValue: (cell: Cell) => `Cluster ${cell.cluster}`,
      };
    }
    
    const values = getAnnotationValues(dataset.cells, selectedAnnotation);
    const colorMap = getAnnotationColorMap(values);
    
    return {
      values,
      colorMap,
      getCellValue: (cell: Cell) => String(cell.metadata[selectedAnnotation] || "Unknown"),
    };
  }, [dataset, selectedAnnotation]);

  // Get genes from selected cells for pathway analysis
  const selectedCellGenes = useMemo(() => {
    if (selectedCells.length === 0) return settings.selectedGenes || [];
    return settings.selectedGenes || [];
  }, [selectedCells.length, settings.selectedGenes]);

  const handleCellsSelected = useCallback((cells: Cell[]) => {
    setSelectedCells(cells);
  }, []);

  if (isLoadingRemote) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary" />
        <p className="text-muted-foreground text-sm">Loading heart organoid dataset…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header metadata={dataset.metadata} onStartTour={() => setTourOpen(true)} />
      <ProductTour steps={tourSteps} isOpen={tourOpen} onClose={() => setTourOpen(false)} />

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Controls row */}
        <div className="mb-4 flex flex-wrap items-center gap-4" data-tour="upload">
          <DatasetUploader 
            onDatasetLoad={handleDatasetLoad} 
            buttonVariant="outline"
          />
          
          <Button variant="ghost" size="sm" asChild>
            <a href="/export_template.R" download className="gap-2">
              <Download className="h-4 w-4" />
              R Export Script
            </a>
          </Button>
        </div>

        {/* Dual Plot Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Plot - Metadata Annotation */}
          <div className="space-y-4" data-tour="metadata-plot">
            <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
              <h3 className="font-semibold text-foreground">Metadata Annotation</h3>
              <Select value={selectedAnnotation} onValueChange={setSelectedAnnotation}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select annotation" />
                </SelectTrigger>
                <SelectContent>
                  {annotationOptions.map(opt => (
                    <SelectItem key={opt} value={opt}>
                      {opt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="h-[450px]">
              <ScatterPlot
                cells={dataset.cells}
                selectedGene={null}
                pointSize={settings.pointSize}
                showClusters={true}
                showLabels={settings.showLabels}
                opacity={settings.opacity}
                clusterNames={clusterNames}
                cellFilter={settings.cellFilter}
                annotationData={annotationData}
                onCellsSelected={handleCellsSelected}
              />
            </div>
            
            {/* Annotation Legend */}
            {(() => {
              const cellCounts: Record<string, number> = {};
              dataset.cells.forEach(cell => {
                const val = annotationData.getCellValue(cell);
                cellCounts[val] = (cellCounts[val] || 0) + 1;
              });
              return (
                <div className="bg-card border border-border rounded-lg p-3">
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    {selectedAnnotation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h4>
                  <div className="max-h-32 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-1">
                      {annotationData.values.slice(0, 20).map((value, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: annotationData.colorMap[value] }}
                          />
                          <span className="text-muted-foreground truncate">
                            {value} ({cellCounts[value] || 0})
                          </span>
                        </div>
                      ))}
                      {annotationData.values.length > 20 && (
                        <div className="text-xs text-muted-foreground col-span-2">
                          +{annotationData.values.length - 20} more...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right Plot - Gene Expression */}
          <div className="space-y-4" data-tour="expression-plot">
            <div className="p-3 bg-card border border-border rounded-lg">
              <h3 className="font-semibold text-foreground">
                Gene Expression
                {effectiveGeneLabel && (
                  <span className="ml-2 text-primary font-mono text-sm">({effectiveGeneLabel})</span>
                )}
              </h3>
            </div>
            
            <div className="h-[450px]">
              <ScatterPlot
                cells={dataset.cells}
                expressionData={expressionData}
                selectedGene={effectiveGeneLabel}
                pointSize={settings.pointSize}
                showClusters={!effectiveGeneLabel}
                showLabels={settings.showLabels}
                opacity={settings.opacity}
                expressionScale={settings.expressionScale}
                usePercentileClipping={settings.usePercentileClipping}
                percentileLow={settings.percentileLow}
                percentileHigh={settings.percentileHigh}
                colorPalette={settings.colorPalette}
                clusterNames={clusterNames}
                cellFilter={settings.cellFilter}
                onCellsSelected={handleCellsSelected}
              />
            </div>
            
            {/* Expression Level Legend */}
            {effectiveGeneLabel && (
              <div className="bg-card border border-border rounded-lg p-3">
                <h4 className="text-sm font-medium text-foreground mb-2">Expression Level</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Low</span>
                  <div
                    className="flex-1 h-3 rounded"
                    style={{ background: getPaletteGradientCSS(settings.colorPalette) }}
                  />
                  <span className="text-xs text-muted-foreground">High</span>
                </div>
                {settings.usePercentileClipping && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Clipped to {settings.percentileLow}–{settings.percentileHigh} percentile
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Filters, Gene Selection & Display Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <CellFilter
              cells={dataset.cells}
              clusters={dataset.clusters}
              filter={settings.cellFilter}
              onFilterChange={(filter) => handleSettingsChange({ cellFilter: filter })}
            />
            <div data-tour="gene-selection">
              <GeneSelectionPanel
                genes={dataset.genes}
                settings={settings}
                onSettingsChange={handleSettingsChange}
              />
            </div>
            <ClusterAnnotationTool
              clusters={dataset.clusters}
              onRenameCluster={handleRenameCluster}
              onMergeClusters={handleMergeClusters}
              onChangeClusterColor={handleChangeClusterColor}
              onResetClusters={handleResetClusters}
            />
          </div>
          <div data-tour="display-options">
            <DisplayOptions
              clusters={dataset.clusters}
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          </div>
        </div>

        {/* Analysis Tabs */}
        <div className="space-y-6 mt-6" data-tour="analysis-tabs">
            <Tabs defaultValue="violin" className="w-full">
              <TabsList>
                <TabsTrigger value="violin" disabled={!effectiveGeneLabel}>
                  Violin Plot
                </TabsTrigger>
                <TabsTrigger value="feature" disabled={!effectiveGeneLabel}>
                  Feature Plot
                </TabsTrigger>
                <TabsTrigger value="dotplot">
                  Dot Plot
                </TabsTrigger>
                {/* <TabsTrigger value="enrichment">
                  Pathway Enrichment
                </TabsTrigger>
                <TabsTrigger value="trajectory">
                  Trajectory
                </TabsTrigger> */}
              </TabsList>
              <TabsContent value="violin">
                {effectiveGeneLabel && expressionData ? (
                  <ViolinPlot 
                    cells={dataset.cells} 
                    gene={effectiveGeneLabel} 
                    clusters={dataset.clusters}
                    expressionData={expressionData}
                  />
                ) : (
                  <div className="bg-card border border-border rounded-lg p-8 text-center">
                    <p className="text-muted-foreground">Select a gene to display violin plot</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="feature">
                {effectiveGeneLabel && expressionData ? (
                  <FeaturePlot 
                    cells={dataset.cells} 
                    gene={effectiveGeneLabel} 
                    clusters={dataset.clusters}
                    expressionData={expressionData}
                  />
                ) : (
                  <div className="bg-card border border-border rounded-lg p-8 text-center">
                    <p className="text-muted-foreground">Select a gene to display feature plot</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="dotplot">
                <DotPlot
                  cells={dataset.cells}
                  genes={settings.selectedGenes || []}
                  clusters={dataset.clusters}
                  expressionDataMap={multiGeneExpressionData}
                />
              </TabsContent>
              <TabsContent value="enrichment">
                <PathwayEnrichment
                  genes={selectedCellGenes}
                  onGeneClick={handleGeneClick}
                />
              </TabsContent>
              <TabsContent value="trajectory">
                <div className="space-y-6">
                  <TrajectoryAnalysis
                    cells={dataset.cells}
                    clusters={dataset.clusters}
                  />
                  <PseudotimeHeatmapWrapper
                    cells={dataset.cells}
                    clusters={dataset.clusters}
                    genes={settings.selectedGenes || []}
                    dataset={dataset}
                    colorPalette={settings.colorPalette}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Differential Expression Table */}
            <div data-tour="de-table">
              <DifferentialExpressionTable
                data={dataset.differentialExpression}
                onGeneClick={handleGeneClick}
              />
            </div>
          </div>

      </main>

      <footer className="border-t border-border bg-card py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Single-cell explorer • Powered by{" "}
          <a 
            href="https://accelbio.pt/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            AccelBio
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Index;
