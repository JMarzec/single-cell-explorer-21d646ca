import React, { useMemo, useRef, useEffect, useState } from "react";
import { Cell, ClusterInfo, ColorPalette } from "@/types/singleCell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { expressionToColor } from "@/lib/colorPalettes";

interface PseudotimeHeatmapProps {
  cells: Cell[];
  clusters: ClusterInfo[];
  genes: string[];
  expressionDataMap: Record<string, Map<string, number>>;
  pseudotimeMap: Map<string, number>;
  colorPalette: ColorPalette;
}

interface BinnedRow {
  gene: string;
  values: number[]; // one per bin, smoothed mean expression
}

function buildHeatmapData(
  cells: Cell[],
  genes: string[],
  expressionDataMap: Record<string, Map<string, number>>,
  pseudotimeMap: Map<string, number>,
  numBins: number
): { rows: BinnedRow[]; globalMin: number; globalMax: number } {
  // Sort cells by pseudotime
  const sortedCells = [...cells]
    .filter((c) => pseudotimeMap.has(c.id))
    .sort((a, b) => (pseudotimeMap.get(a.id) || 0) - (pseudotimeMap.get(b.id) || 0));

  if (sortedCells.length === 0 || genes.length === 0) {
    return { rows: [], globalMin: 0, globalMax: 1 };
  }

  const binSize = Math.max(1, Math.floor(sortedCells.length / numBins));
  let globalMin = Infinity;
  let globalMax = -Infinity;

  const rows: BinnedRow[] = genes.map((gene) => {
    const exprMap = expressionDataMap[gene];
    const values: number[] = [];

    for (let b = 0; b < numBins; b++) {
      const start = b * binSize;
      const end = b === numBins - 1 ? sortedCells.length : (b + 1) * binSize;
      let sum = 0;
      let count = 0;

      for (let i = start; i < end; i++) {
        const val = exprMap?.get(sortedCells[i].id) ?? 0;
        sum += val;
        count++;
      }

      const mean = count > 0 ? sum / count : 0;
      values.push(mean);
      if (mean < globalMin) globalMin = mean;
      if (mean > globalMax) globalMax = mean;
    }

    return { gene, values };
  });

  // Per-row z-score normalization for better contrast
  const normalizedRows = rows.map((row) => {
    const rowMin = Math.min(...row.values);
    const rowMax = Math.max(...row.values);
    const range = rowMax - rowMin || 1;
    return {
      ...row,
      values: row.values.map((v) => (v - rowMin) / range),
    };
  });

  return { rows: normalizedRows, globalMin: 0, globalMax: 1 };
}

export const PseudotimeHeatmap: React.FC<PseudotimeHeatmapProps> = ({
  cells,
  clusters,
  genes,
  expressionDataMap,
  pseudotimeMap,
  colorPalette,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [numBins, setNumBins] = useState([50]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDimensions((prev) => ({ ...prev, width }));
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Build heatmap data
  const heatmapData = useMemo(
    () => buildHeatmapData(cells, genes, expressionDataMap, pseudotimeMap, numBins[0]),
    [cells, genes, expressionDataMap, pseudotimeMap, numBins]
  );

  // Compute dynamic height based on number of genes
  const rowHeight = 24;
  const topPadding = 30;
  const bottomPadding = 40;
  const labelWidth = 90;
  const legendWidth = 20;
  const rightPadding = 50;

  const canvasHeight = useMemo(
    () => topPadding + genes.length * rowHeight + bottomPadding,
    [genes.length]
  );

  // Draw heatmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || heatmapData.rows.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width } = dimensions;
    const height = canvasHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const plotWidth = width - labelWidth - rightPadding;
    const plotHeight = genes.length * rowHeight;
    const bins = numBins[0];
    const cellWidth = plotWidth / bins;

    // Draw heatmap cells
    heatmapData.rows.forEach((row, rowIdx) => {
      const y = topPadding + rowIdx * rowHeight;

      row.values.forEach((val, colIdx) => {
        const x = labelWidth + colIdx * cellWidth;
        const [r, g, b] = expressionToColor(val, 0, 1, 1, colorPalette);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y, Math.ceil(cellWidth) + 1, rowHeight - 1);
      });

      // Gene label
      ctx.fillStyle = "#374151";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(
        row.gene.length > 12 ? row.gene.slice(0, 11) + "…" : row.gene,
        labelWidth - 6,
        y + rowHeight / 2
      );
    });

    // Draw pseudotime axis
    const axisY = topPadding + plotHeight + 4;
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(labelWidth, axisY);
    ctx.lineTo(labelWidth + plotWidth, axisY);
    ctx.stroke();

    // Tick marks
    const ticks = [0, 0.25, 0.5, 0.75, 1];
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ticks.forEach((t) => {
      const tx = labelWidth + t * plotWidth;
      ctx.beginPath();
      ctx.moveTo(tx, axisY);
      ctx.lineTo(tx, axisY + 4);
      ctx.stroke();
      ctx.fillText(t.toFixed(2), tx, axisY + 6);
    });

    // Axis label
    ctx.fillStyle = "#374151";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pseudotime →", labelWidth + plotWidth / 2, axisY + 20);

    // Color legend (vertical bar on the right)
    const legendX = labelWidth + plotWidth + 12;
    const legendH = Math.min(plotHeight, 120);
    const legendY = topPadding + (plotHeight - legendH) / 2;

    for (let i = 0; i < legendH; i++) {
      const t = 1 - i / legendH;
      const [r, g, b] = expressionToColor(t, 0, 1, 1, colorPalette);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(legendX, legendY + i, legendWidth, 1);
    }

    ctx.strokeStyle = "#d1d5db";
    ctx.strokeRect(legendX, legendY, legendWidth, legendH);

    ctx.fillStyle = "#6b7280";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("High", legendX + legendWidth + 3, legendY + 8);
    ctx.textBaseline = "top";
    ctx.fillText("Low", legendX + legendWidth + 3, legendY + legendH - 4);
  }, [heatmapData, dimensions, canvasHeight, numBins, colorPalette, genes.length]);

  if (genes.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Pseudotime Gene Expression Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-8 text-center text-muted-foreground">
            Select genes using the Multi-Gene Search to display the pseudotime heatmap.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Pseudotime Gene Expression Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <Label className="text-sm whitespace-nowrap">Bins:</Label>
          <Slider
            value={numBins}
            onValueChange={setNumBins}
            min={20}
            max={100}
            step={5}
            className="w-32"
          />
          <span className="text-xs text-muted-foreground w-8">{numBins[0]}</span>
        </div>

        <div ref={containerRef} className="w-full overflow-x-auto border border-border rounded-lg">
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: `${canvasHeight}px` }}
          />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Each row shows a gene's expression level across pseudotime (left = early, right = late). 
          Values are row-normalized for better contrast across genes with different expression ranges.
        </p>
      </CardContent>
    </Card>
  );
};
