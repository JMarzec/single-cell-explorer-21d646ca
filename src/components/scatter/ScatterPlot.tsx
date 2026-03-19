import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Cell, CellFilterState, ColorPalette } from "@/types/singleCell";
import { getClusterColorRGBA } from "@/data/demoData";
import { expressionToColor } from "@/lib/colorPalettes";
import { CellTooltip } from "./CellTooltip";
import { ExportControls } from "./ExportControls";
import { SelectionTools, SelectionMode } from "./SelectionTools";

interface AnnotationData {
  values: string[];
  colorMap: Record<string, string>;
  getCellValue: (cell: Cell) => string;
}

interface ScatterPlotProps {
  cells: Cell[];
  expressionData?: Map<string, number>;
  selectedGene: string | null;
  pointSize: number;
  showClusters: boolean;
  showLabels: boolean;
  opacity: number;
  expressionScale?: number;
  usePercentileClipping?: boolean;
  percentileLow?: number;
  percentileHigh?: number;
  colorPalette?: ColorPalette;
  clusterNames: string[];
  cellFilter?: CellFilterState;
  annotationData?: AnnotationData;
  onCellHover?: (cell: Cell | null) => void;
  onCellClick?: (cell: Cell) => void;
  onCellsSelected?: (cells: Cell[]) => void;
}

// Parse color string to RGBA
function parseColorToRGBA(color: string, alpha: number = 1): [number, number, number, number] {
  // Handle rgb(r, g, b) format
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]), Math.floor(alpha * 255)];
  }
  
  // Handle hsl(h, s%, l%) format
  const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (hslMatch) {
    const h = parseInt(hslMatch[1]) / 360;
    const s = parseInt(hslMatch[2]) / 100;
    const l = parseInt(hslMatch[3]) / 100;
    
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), Math.floor(alpha * 255)];
  }
  
  // Default fallback
  return [100, 140, 200, Math.floor(alpha * 255)];
}

// expressionToColor is now imported from @/lib/colorPalettes

// Check if point is inside polygon (ray casting)
function pointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
  if (polygon.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Check if point is inside rectangle
function pointInRect(x: number, y: number, rect: { x1: number; y1: number; x2: number; y2: number }): boolean {
  const minX = Math.min(rect.x1, rect.x2);
  const maxX = Math.max(rect.x1, rect.x2);
  const minY = Math.min(rect.y1, rect.y2);
  const maxY = Math.max(rect.y1, rect.y2);
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

export function ScatterPlot({
  cells,
  expressionData,
  selectedGene,
  pointSize,
  showClusters,
  showLabels,
  opacity,
  expressionScale = 1,
  usePercentileClipping = false,
  percentileLow = 5,
  percentileHigh = 95,
  colorPalette = "grrd",
  clusterNames,
  cellFilter,
  annotationData,
  onCellHover,
  onCellClick,
  onCellsSelected,
}: ScatterPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredCell, setHoveredCell] = useState<Cell | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Selection state
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("none");
  const [isSelecting, setIsSelecting] = useState(false);
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);
  const [rectSelection, setRectSelection] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  // Filter cells based on cellFilter
  const filteredCells = useMemo(() => {
    if (!cellFilter) return cells;
    
    return cells.filter((cell) => {
      const sampleMatch =
        cellFilter.selectedSamples.length === 0 ||
        cellFilter.selectedSamples.includes(cell.metadata.sample as string);
      const clusterMatch =
        cellFilter.selectedClusters.length === 0 ||
        cellFilter.selectedClusters.includes(cell.cluster);
      return sampleMatch && clusterMatch;
    });
  }, [cells, cellFilter]);

  // Calculate data bounds (use all cells for consistent view)
  const bounds = useMemo(() => {
    if (cells.length === 0) return { minX: -50, maxX: 50, minY: -50, maxY: 50 };
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    cells.forEach(cell => {
      if (cell.x < minX) minX = cell.x;
      if (cell.x > maxX) maxX = cell.x;
      if (cell.y < minY) minY = cell.y;
      if (cell.y > maxY) maxY = cell.y;
    });
    
    const padding = 0.1;
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    
    return {
      minX: minX - rangeX * padding,
      maxX: maxX + rangeX * padding,
      minY: minY - rangeY * padding,
      maxY: maxY + rangeY * padding,
    };
  }, [cells]);

  // Expression bounds - support percentile clipping
  const expressionBounds = useMemo(() => {
    if (!expressionData || expressionData.size === 0) return { min: 0, max: 1 };
    
    const values = Array.from(expressionData.values());
    
    if (usePercentileClipping && values.length > 10) {
      // Sort values and compute percentiles
      const sorted = [...values].sort((a, b) => a - b);
      const lowIdx = Math.floor((percentileLow / 100) * (sorted.length - 1));
      const highIdx = Math.ceil((percentileHigh / 100) * (sorted.length - 1));
      return { 
        min: sorted[lowIdx], 
        max: sorted[highIdx] 
      };
    }
    
    // Standard min/max
    let min = Infinity, max = -Infinity;
    values.forEach(value => {
      if (value < min) min = value;
      if (value > max) max = value;
    });
    
    return { min, max };
  }, [expressionData, usePercentileClipping, percentileLow, percentileHigh]);

  // Cluster centers for labels (use filtered cells)
  const clusterCenters = useMemo(() => {
    const centers: Record<number, { x: number; y: number; count: number }> = {};
    
    filteredCells.forEach(cell => {
      if (!centers[cell.cluster]) {
        centers[cell.cluster] = { x: 0, y: 0, count: 0 };
      }
      centers[cell.cluster].x += cell.x;
      centers[cell.cluster].y += cell.y;
      centers[cell.cluster].count++;
    });
    
    Object.keys(centers).forEach(key => {
      const k = parseInt(key);
      centers[k].x /= centers[k].count;
      centers[k].y /= centers[k].count;
    });
    
    return centers;
  }, [filteredCells]);

  // Convert data coordinates to canvas coordinates
  const dataToCanvas = useCallback((x: number, y: number) => {
    const { width, height } = dimensions;
    const padding = 50;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    
    const scaleX = plotWidth / (bounds.maxX - bounds.minX);
    const scaleY = plotHeight / (bounds.maxY - bounds.minY);
    
    const canvasX = padding + (x - bounds.minX) * scaleX;
    const canvasY = height - padding - (y - bounds.minY) * scaleY;
    
    // Apply transform
    return {
      x: (canvasX - width / 2) * transform.scale + width / 2 + transform.x,
      y: (canvasY - height / 2) * transform.scale + height / 2 + transform.y,
    };
  }, [dimensions, bounds, transform]);

  // Canvas to data coordinates (inverse of dataToCanvas)
  const canvasToData = useCallback((canvasX: number, canvasY: number) => {
    const { width, height } = dimensions;
    const padding = 50;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    
    const scaleX = plotWidth / (bounds.maxX - bounds.minX);
    const scaleY = plotHeight / (bounds.maxY - bounds.minY);
    
    // Reverse transform
    const untransformedX = (canvasX - transform.x - width / 2) / transform.scale + width / 2;
    const untransformedY = (canvasY - transform.y - height / 2) / transform.scale + height / 2;
    
    const dataX = (untransformedX - padding) / scaleX + bounds.minX;
    const dataY = bounds.maxY - (untransformedY - padding) / scaleY;
    
    return { x: dataX, y: dataY };
  }, [dimensions, bounds, transform]);

  // Draw the plot
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    
    // Draw grid
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    
    const gridSpacing = 20;
    const { minX, maxX, minY, maxY } = bounds;
    
    for (let x = Math.ceil(minX / gridSpacing) * gridSpacing; x <= maxX; x += gridSpacing) {
      const start = dataToCanvas(x, minY);
      const end = dataToCanvas(x, maxY);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    
    for (let y = Math.ceil(minY / gridSpacing) * gridSpacing; y <= maxY; y += gridSpacing) {
      const start = dataToCanvas(minX, y);
      const end = dataToCanvas(maxX, y);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    
    // Draw cells (use filtered cells)
    const scaledPointSize = pointSize * transform.scale;
    
    filteredCells.forEach(cell => {
      const pos = dataToCanvas(cell.x, cell.y);
      
      // Skip if outside viewport
      if (pos.x < -10 || pos.x > dimensions.width + 10 ||
          pos.y < -10 || pos.y > dimensions.height + 10) {
        return;
      }
      
      let color: [number, number, number, number];
      const isSelected = selectedCells.has(cell.id);
      
      if (selectedGene && expressionData) {
        const expr = expressionData.get(cell.id) ?? 0;
        const baseColor = expressionToColor(expr, expressionBounds.min, expressionBounds.max, expressionScale, colorPalette);
        color = [baseColor[0], baseColor[1], baseColor[2], Math.floor(opacity * 255)];
      } else if (annotationData) {
        // Use annotation-based coloring
        const annotationValue = annotationData.getCellValue(cell);
        const annotationColor = annotationData.colorMap[annotationValue];
        color = parseColorToRGBA(annotationColor || 'rgb(100, 140, 200)', opacity);
      } else if (showClusters) {
        color = getClusterColorRGBA(cell.cluster, opacity);
      } else {
        color = [100, 140, 200, Math.floor(opacity * 255)];
      }
      
      // Highlight selected cells
      if (isSelected) {
        ctx.fillStyle = `rgba(255, 200, 0, 0.9)`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, scaledPointSize + 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, scaledPointSize, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw cluster labels - show even when gene expression is displayed
    if (showLabels) {
      ctx.font = "bold 12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      Object.entries(clusterCenters).forEach(([clusterId, center]) => {
        const id = parseInt(clusterId);
        const pos = dataToCanvas(center.x, center.y);
        
        // Draw label background with higher opacity when expression is shown
        const bgOpacity = selectedGene ? 0.95 : 0.9;
        ctx.fillStyle = `rgba(255, 255, 255, ${bgOpacity})`;
        ctx.strokeStyle = selectedGene ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.3)";
        ctx.lineWidth = selectedGene ? 1.5 : 1;
        
        const labelText = id.toString();
        const metrics = ctx.measureText(labelText);
        const padding = 6;
        const boxWidth = metrics.width + padding * 2;
        const boxHeight = 20;
        
        ctx.beginPath();
        ctx.roundRect(pos.x - boxWidth / 2, pos.y - boxHeight / 2, boxWidth, boxHeight, 4);
        ctx.fill();
        ctx.stroke();
        
        // Draw label text
        ctx.fillStyle = "#1f2937";
        ctx.fillText(labelText, pos.x, pos.y);
      });
    }
    
    // Draw selection overlay
    if (isSelecting) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      if (selectionMode === "lasso" && lassoPoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
        lassoPoints.forEach((pt, i) => {
          if (i > 0) ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (selectionMode === "rectangle" && rectSelection) {
        const width = rectSelection.x2 - rectSelection.x1;
        const height = rectSelection.y2 - rectSelection.y1;
        ctx.beginPath();
        ctx.rect(rectSelection.x1, rectSelection.y1, width, height);
        ctx.fill();
        ctx.stroke();
      }
      
      ctx.setLineDash([]);
    }
    
    // Draw axes labels
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("tSNE1", dimensions.width / 2, dimensions.height - 10);
    
    ctx.save();
    ctx.translate(15, dimensions.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("tSNE2", 0, 0);
    ctx.restore();
    
  }, [filteredCells, expressionData, selectedGene, pointSize, showClusters, showLabels, opacity, expressionScale, colorPalette, dimensions, bounds, expressionBounds, clusterCenters, transform, dataToCanvas, selectedCells, isSelecting, selectionMode, lassoPoints, rectSelection]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: Math.max(300, width), height: Math.max(300, height) });
      }
    });
    
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Mouse handlers for pan/zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(10, prev.scale * delta)),
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    if (selectionMode === "none") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    } else if (selectionMode === "lasso") {
      setIsSelecting(true);
      setLassoPoints([{ x: canvasX, y: canvasY }]);
    } else if (selectionMode === "rectangle") {
      setIsSelecting(true);
      setRectSelection({ x1: canvasX, y1: canvasY, x2: canvasX, y2: canvasY });
    }
  }, [selectionMode, transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    setMousePos({ x: canvasX, y: canvasY });
    
    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    } else if (isSelecting) {
      if (selectionMode === "lasso") {
        setLassoPoints(prev => [...prev, { x: canvasX, y: canvasY }]);
      } else if (selectionMode === "rectangle") {
        setRectSelection(prev => prev ? { ...prev, x2: canvasX, y2: canvasY } : null);
      }
    } else if (selectionMode === "none") {
      // Find cell under cursor
      const dataPos = canvasToData(canvasX, canvasY);
      const threshold = 2 / transform.scale;
      
      let closestCell: Cell | null = null;
      let closestDist = Infinity;
      
      for (const cell of filteredCells) {
        const dist = Math.sqrt(
          Math.pow(cell.x - dataPos.x, 2) + Math.pow(cell.y - dataPos.y, 2)
        );
        if (dist < threshold && dist < closestDist) {
          closestDist = dist;
          closestCell = cell;
        }
      }
      
      setHoveredCell(closestCell);
      onCellHover?.(closestCell);
    }
  }, [isPanning, isSelecting, panStart, canvasToData, transform.scale, filteredCells, onCellHover, selectionMode]);

  const handleMouseUp = useCallback(() => {
    if (isSelecting) {
      // Process selection
      const newSelectedCells = new Set<string>();
      
      filteredCells.forEach(cell => {
        const pos = dataToCanvas(cell.x, cell.y);
        
        if (selectionMode === "lasso" && lassoPoints.length > 2) {
          if (pointInPolygon(pos.x, pos.y, lassoPoints)) {
            newSelectedCells.add(cell.id);
          }
        } else if (selectionMode === "rectangle" && rectSelection) {
          if (pointInRect(pos.x, pos.y, rectSelection)) {
            newSelectedCells.add(cell.id);
          }
        }
      });
      
      setSelectedCells(newSelectedCells);
      
      // Notify parent of selected cells
      if (onCellsSelected) {
        const selected = filteredCells.filter(c => newSelectedCells.has(c.id));
        onCellsSelected(selected);
      }
    }
    
    setIsPanning(false);
    setIsSelecting(false);
    setLassoPoints([]);
    setRectSelection(null);
  }, [isSelecting, filteredCells, dataToCanvas, selectionMode, lassoPoints, rectSelection, onCellsSelected]);

  const handleClick = useCallback(() => {
    if (selectionMode === "none" && hoveredCell && onCellClick) {
      onCellClick(hoveredCell);
    }
  }, [selectionMode, hoveredCell, onCellClick]);

  const handleDoubleClick = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedCells(new Set());
    onCellsSelected?.([]);
  }, [onCellsSelected]);

  const getCursor = () => {
    if (selectionMode === "lasso") return "crosshair";
    if (selectionMode === "rectangle") return "crosshair";
    if (hoveredCell) return "pointer";
    return isPanning ? "grabbing" : "grab";
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full min-h-[400px] bg-card rounded-lg overflow-hidden border border-border"
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ cursor: getCursor() }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          setHoveredCell(null);
        }}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
      />
      
      {/* Top toolbar */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <SelectionTools
          mode={selectionMode}
          onModeChange={setSelectionMode}
          selectedCount={selectedCells.size}
          onClearSelection={handleClearSelection}
        />
      </div>
      
      {/* Export button */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ExportControls canvasRef={canvasRef} filename={`scatter-${selectedGene || 'clusters'}`} />
      </div>
      
      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(10, prev.scale * 1.2) }))}
          className="w-8 h-8 rounded bg-card border border-border flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
        >
          +
        </button>
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.5, prev.scale / 1.2) }))}
          className="w-8 h-8 rounded bg-card border border-border flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
        >
          −
        </button>
        <button
          onClick={handleDoubleClick}
          className="px-2 h-8 rounded bg-card border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors text-xs gap-1"
          title="Reset view"
        >
          ⌂ Reset
        </button>
      </div>

      {/* Cell tooltip */}
      <CellTooltip
        cell={hoveredCell}
        position={mousePos}
        clusterName={hoveredCell ? clusterNames[hoveredCell.cluster] : undefined}
        expressionValue={
          hoveredCell && expressionData
            ? expressionData.get(hoveredCell.id)
            : undefined
        }
        geneName={selectedGene ?? undefined}
      />
    </div>
  );
}
