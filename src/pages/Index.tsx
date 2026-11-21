import React, { useState, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { ChevronDown } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { DatasetSelector } from "@/components/layout/DatasetSelector";
import { DatasetScope } from "@/components/layout/DatasetScope";
import { ScatterPlot } from "@/components/scatter/ScatterPlot";
import { CellFilter } from "@/components/controls/CellFilter";
import { DisplayOptions } from "@/components/controls/DisplayOptions";
import { GeneSelectionPanel } from "@/components/controls/GeneSelectionPanel";
import { ClusterAnnotationTool } from "@/components/controls/ClusterAnnotationTool";
import { DifferentialExpressionTable } from "@/components/table/DifferentialExpressionTable";
import { ViolinPlot } from "@/components/plots/ViolinPlot";
import { FeaturePlot } from "@/components/plots/FeaturePlot";
import { DotPlot } from "@/components/plots/DotPlot";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { generateDemoDataset } from "@/data/demoData";
import { useDatasetLoading } from "@/hooks/useDatasetLoading";
import { filterCells, mergeCellGroups } from "@/lib/expressionSummary";
import { Button } from "@/components/ui/button";
import { getExpressionData, getMultiGeneExpression, getAveragedExpression, getAnnotationValues, getAnnotationColorMap, calculatePercentile, getUndetectedGenes, isGeneUndetected } from "@/lib/expressionUtils";
import { getPaletteGradientCSS } from "@/lib/colorPalettes";
import { VisualizationSettings, SingleCellDataset, CellFilterState as CellFilterType, Cell, ClusterInfo, ColorPalette } from "@/types/singleCell";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductTour, TourStep } from "@/components/tour/ProductTour";
import { Progress } from "@/components/ui/progress";


const tourSteps: TourStep[] = [
  {
    target: "[data-tour='header']",
    title: "Welcome to Single-Cell Explorer",
    description: "This dashboard lets you explore single-cell datasets interactively. The header shows your dataset summary — total cells, genes, and clusters at a glance.",
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

const defaultCellFilter: CellFilterType = {
  selectedSamples: [],
  selectedClusters: [],
};

const Index = () => {
  const { dataset, setDataset, isLoadingRemote, loadProgress, exprProgress, exprReady, exprCancelled,
    remoteError, errorScope, originalDatasetRef, handleCancelExpression, handleRetryExpression } = useDatasetLoading(defaultDataset);
  const [tourOpen, setTourOpen] = useState(false);
  const [displayOptionsOpen, setDisplayOptionsOpen] = useState(false);

  // The demo fallback carries synthetic expression, so gene selection stays
  // usable when the core dataset itself failed to download.
  const geneSelectionUsable =
    exprReady || (errorScope === "core" && dataset.syntheticExpression === true);





  // Selected cells from lasso/rectangle selection
  const [, setSelectedCells] = useState<Cell[]>([]);
  
  // Annotation selection for left plot
  const [selectedAnnotation, setSelectedAnnotation] = useState<string>("cell_type");
  
  // Settings for visualization
  const [settings, setSettings] = useState<VisualizationSettings>({
    pointSize: 2,
    showClusters: true,
    showLabels: false,
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

  // Genes that are absent from the loaded expression matrix ("not detected")
  const undetectedGenes = useMemo(() => {
    const genes = [
      ...(settings.selectedGene ? [settings.selectedGene] : []),
      ...(settings.selectedGenes || []),
    ];
    return getUndetectedGenes(dataset, Array.from(new Set(genes)));
  }, [settings.selectedGene, settings.selectedGenes, dataset]);

  const plotGeneUndetected = useMemo(() => {
    if (settings.selectedGene) return isGeneUndetected(dataset, settings.selectedGene);
    const genes = settings.selectedGenes || [];
    if (!settings.showAveragedExpression || genes.length === 0) return false;
    return getUndetectedGenes(dataset, genes).length === genes.length;
  }, [settings.selectedGene, settings.selectedGenes, settings.showAveragedExpression, dataset]);



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
    setDataset(prev => mergeCellGroups(prev, sourceIds, targetId, mergedName));
    setSettings(prev => ({ ...prev, cellFilter: { ...prev.cellFilter, selectedClusters: [] } }));
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
    () => Object.fromEntries(dataset.clusters.map(c => [c.id, c.name])),
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
    if (selectedAnnotation === "cell_type") dataset.clusters.forEach(c => { colorMap[c.name] = c.color; });
    
    return {
      values,
      colorMap,
      getCellValue: (cell: Cell) => String(cell.metadata[selectedAnnotation] ?? "Unknown"),
    };
  }, [dataset, selectedAnnotation]);

  const analysisCells = useMemo(() => filterCells(dataset.cells, settings.cellFilter), [dataset.cells, settings.cellFilter]);
  const analysisClusters = useMemo(() => dataset.clusters.filter(c => analysisCells.some(cell => cell.cluster === c.id)), [dataset.clusters, analysisCells]);
  const clusterAnnotation = useMemo(() => ({ values: dataset.clusters.map(c => c.name),
    colorMap: Object.fromEntries(dataset.clusters.map(c => [String(c.id), c.color])),
    getCellValue: (cell: Cell) => String(cell.cluster) }), [dataset.clusters]);

  const handleCellsSelected = useCallback((cells: Cell[]) => {
    setSelectedCells(cells);
  }, []);

  if (isLoadingRemote) {
    const isDownloading = loadProgress.phase === "downloading";
    const showPercent = isDownloading && loadProgress.percent > 0;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary" />
        <div className="text-center space-y-2">
          <p className="text-foreground font-medium">Loading dataset…</p>
          <p className="text-muted-foreground text-sm" role="status" aria-live="polite">
            {loadProgress.message}
          </p>
        </div>
        <div className="w-64 max-w-full px-2">
          <DatasetSelector />
        </div>
        <div className="w-64">
          <Progress value={showPercent ? loadProgress.percent : undefined} className="h-2" />
          {showPercent && (
            <p className="text-xs text-muted-foreground text-center mt-1">{loadProgress.percent}%</p>
          )}
        </div>
        <Button variant="link"
          onClick={handleCancelExpression}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Cancel download
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {remoteError && (
        <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-3 text-center">
          <p className="text-sm text-destructive font-medium">
            ⚠{" "}
            {errorScope === "core"
              ? `Failed to load the selected dataset: ${remoteError}`
              : `Failed to load the expression matrix: ${remoteError}`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {errorScope === "core"
              ? "Showing the built-in demo dataset instead — the cells, annotations and expression values below are illustrative demo data, not your dataset."
              : "Cells and annotations are shown from the real dataset, but gene expression is unavailable — no expression values are displayed."}
          </p>

          <Button variant="link"
            onClick={handleRetryExpression}
            className="mt-2 text-xs font-medium text-primary underline hover:no-underline"
          >
            Retry
          </Button>
        </div>
      )}
      {exprProgress && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
          <div className="container mx-auto flex items-center gap-3">
            <p
              className="text-xs text-muted-foreground whitespace-nowrap"
              role="status"
              aria-live="polite"
            >
              {exprProgress.message}
            </p>
            <Progress
              value={exprProgress.percent > 0 ? exprProgress.percent : undefined}
              className="h-1.5 flex-1"
            />
            <p className="text-xs text-muted-foreground w-10 text-right">
              {exprProgress.percent}%
            </p>
            <Button variant="link"
              onClick={handleCancelExpression}
              className="text-xs text-muted-foreground underline hover:text-foreground whitespace-nowrap"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {exprCancelled && !exprReady && (
        <div className="bg-muted border-b border-border px-4 py-2">
          <div className="container mx-auto flex items-center justify-center gap-3">
            <p className="text-xs text-muted-foreground">
              {errorScope === "core" ? "Dataset download cancelled — showing illustrative demo data." : "Expression matrix download cancelled — gene expression features are unavailable."}
            </p>
            <Button variant="link"
              onClick={handleRetryExpression}
              className="text-xs font-medium text-primary underline hover:no-underline"
            >
              Resume download
            </Button>
          </div>
        </div>
      )}

      <Header metadata={dataset.metadata} onStartTour={() => setTourOpen(true)} />
      <ProductTour steps={tourSteps} isOpen={tourOpen} onClose={() => setTourOpen(false)} />

      <main className="flex-1 container mx-auto px-4 py-6">
        <Helmet>
          <title>Single-Cell Explorer Dashboard — Interactive scRNA-seq</title>
          <meta name="description" content="Explore single-cell RNA-seq datasets interactively: t-SNE/UMAP embeddings, gene expression overlays, violin and dot plots, and differential expression." />
          <link rel="canonical" href="https://accelbio-single-cell-explorer.lovable.app/" />
          <meta property="og:title" content="Single-Cell Explorer Dashboard" />
          <meta property="og:description" content="Interactive browser-based exploration of single-cell datasets — embeddings, gene search, and differential expression." />
          <meta property="og:url" content="https://accelbio-single-cell-explorer.lovable.app/" />
        </Helmet>
        <h1 className="sr-only">Single-Cell Explorer Dashboard</h1>


        {/* Dual Plot Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
          {/* Left Plot - Metadata Annotation */}
          <div className="flex flex-col gap-4" data-tour="metadata-plot">
            <div className="flex items-center justify-between p-3 min-h-[66px] bg-card border border-border rounded-lg">
              <h2 className="font-semibold text-foreground text-base">Metadata Annotation</h2>
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
            
            {/* Left controls stacked directly under the plot */}
            <div className="space-y-4">
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

              <CellFilter
                cells={dataset.cells}
                clusters={dataset.clusters}
                filter={settings.cellFilter}
                onFilterChange={(filter) => handleSettingsChange({ cellFilter: filter })}
              />

              <ClusterAnnotationTool
                clusters={dataset.clusters}
                onRenameCluster={handleRenameCluster}
                onMergeClusters={handleMergeClusters}
                onChangeClusterColor={handleChangeClusterColor}
                onResetClusters={handleResetClusters}
              />
            </div>
          </div>

          {/* Right Plot - Gene Expression */}
          <div className="flex flex-col gap-4" data-tour="expression-plot">
            <div className="p-3 min-h-[66px] bg-card border border-border rounded-lg">
              <h2 className="font-semibold text-foreground text-base">
                Gene Expression
                {effectiveGeneLabel && (
                  <span className="ml-2 text-primary font-mono text-sm">({effectiveGeneLabel})</span>
                )}
                {plotGeneUndetected && (
                  <span className="ml-2 text-xs font-medium uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    Not detected
                  </span>
                )}
              </h2>
              {plotGeneUndetected && (
                <p className="text-xs text-muted-foreground mt-1" role="status">
                  No expression recorded for {undetectedGenes.join(", ")} in this dataset — all cells are zero.
                </p>
              )}
            </div>
            
            <div className="h-[450px]">
              <ScatterPlot
                cells={dataset.cells}
                expressionData={expressionData}
                selectedGene={effectiveGeneLabel}
                expressionNotDetected={plotGeneUndetected}
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
                annotationData={clusterAnnotation}
                onCellsSelected={handleCellsSelected}
              />
            </div>

            {/* Right controls stacked directly under the plot */}
            <div className="space-y-4">
              {/* Gene Selection */}
              <div
                data-tour="gene-selection"
                className={!geneSelectionUsable ? "opacity-60 pointer-events-none" : undefined}
                aria-busy={!exprReady && !remoteError && !exprCancelled}
              >
                <GeneSelectionPanel
                  genes={dataset.genes}
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                />
                {!exprReady && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {geneSelectionUsable
                      ? "Showing demo expression values — your dataset could not be loaded."
                      : remoteError || exprCancelled
                        ? "Gene expression is unavailable — the expression matrix could not be loaded."
                        : "Gene expression becomes available once the expression matrix finishes loading."}
                  </p>
                )}
              </div>

              {/* Expression Level Legend */}
              {effectiveGeneLabel && !plotGeneUndetected && (
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

              {/* Display Options - expandable */}
              <Collapsible
                open={displayOptionsOpen}
                onOpenChange={setDisplayOptionsOpen}
                data-tour="display-options"
              >
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="h-auto w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors">
                      <h3 className="text-sm font-semibold text-foreground">Display Options</h3>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${displayOptionsOpen ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3">
                      <DisplayOptions
                        noCard
                        clusters={dataset.clusters}
                        settings={settings}
                        onSettingsChange={handleSettingsChange}
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </div>
          </div>
        </div>


        {/* Analysis Tabs */}
        <div className="space-y-6 mt-6" data-tour="analysis-tabs">
            {undetectedGenes.length > 0 && (
              <div className="bg-muted border border-border rounded-lg px-4 py-2" role="status">
                <p className="text-xs text-muted-foreground">
                  Not detected in this dataset:{" "}
                  <span className="font-mono text-foreground">{undetectedGenes.join(", ")}</span>. Plots
                  below show zero expression for {undetectedGenes.length > 1 ? "these genes" : "this gene"}.
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Expression summaries: {analysisCells.length.toLocaleString()} filtered cells. Mean includes zeros; detection &gt; 0.1 in supplied expression units.</p>
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
              </TabsList>
              <TabsContent value="violin">
                {effectiveGeneLabel && expressionData ? (
                  <ViolinPlot 
                    cells={analysisCells} 
                    gene={effectiveGeneLabel} 
                    clusters={analysisClusters}
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
                    cells={analysisCells} 
                    gene={effectiveGeneLabel} 
                    clusters={analysisClusters}
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
                  cells={analysisCells}
                  genes={settings.selectedGenes || []}
                  clusters={analysisClusters}
                  expressionDataMap={multiGeneExpressionData}
                />
              </TabsContent>
            </Tabs>

            {/* Differential Expression Table */}
            <div data-tour="de-table">
              {dataset.differentialExpressionInvalidated ? (
                <p role="status" className="text-sm text-muted-foreground">Differential expression is unavailable after merging cell types. Recompute results in Seurat or Scanpy and reload the dataset.</p>
              ) : <><p className="text-xs text-muted-foreground mb-2">Imported differential-expression statistics from the original dataset; not recalculated for cell filters.</p>
              <DifferentialExpressionTable
                data={dataset.differentialExpression}
                clusters={dataset.clusters}
                onGeneClick={handleGeneClick}
              /></>}
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

export default function DatasetExplorer() {
  return <DatasetScope><Index /></DatasetScope>;
}
