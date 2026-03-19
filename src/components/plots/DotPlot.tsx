import React, { useMemo } from "react";
import { Cell, ClusterInfo } from "@/types/singleCell";

interface DotPlotProps {
  cells: Cell[];
  genes: string[];
  clusters: ClusterInfo[];
  expressionDataMap: Record<string, Map<string, number>>;
}

interface DotData {
  gene: string;
  cluster: ClusterInfo;
  meanExpression: number;
  percentExpressing: number;
}

export function DotPlot({ cells, genes, clusters, expressionDataMap }: DotPlotProps) {
  const dotData = useMemo(() => {
    const data: DotData[] = [];

    genes.forEach((gene) => {
      const expression = expressionDataMap[gene] || new Map();

      clusters.forEach((cluster) => {
        const clusterCells = cells.filter((c) => c.cluster === cluster.id);
        const expressionValues = clusterCells.map(
          (c) => expression.get(c.id) ?? 0
        );

        const expressing = expressionValues.filter((v) => v > 0.1);
        const percentExpressing =
          clusterCells.length > 0
            ? (expressing.length / clusterCells.length) * 100
            : 0;
        const meanExpression =
          expressing.length > 0
            ? expressing.reduce((a, b) => a + b, 0) / expressing.length
            : 0;

        data.push({
          gene,
          cluster,
          meanExpression,
          percentExpressing,
        });
      });
    });

    return data;
  }, [cells, genes, clusters, expressionDataMap]);

  // Calculate scales
  const maxMean = useMemo(
    () => Math.max(...dotData.map((d) => d.meanExpression), 1),
    [dotData]
  );
  const maxPercent = useMemo(
    () => Math.max(...dotData.map((d) => d.percentExpressing), 1),
    [dotData]
  );

  const dotSize = (percent: number) => {
    const normalized = percent / maxPercent;
    return 4 + normalized * 20; // 4px to 24px
  };

  const dotColor = (meanExpr: number) => {
    const normalized = meanExpr / maxMean;
    // Gray to red color scale
    const r = Math.round(180 + normalized * 75);
    const g = Math.round(180 - normalized * 120);
    const b = Math.round(180 - normalized * 140);
    return `rgb(${r}, ${g}, ${b})`;
  };

  if (genes.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">
          Select genes to display dot plot
        </p>
      </div>
    );
  }

  const cellWidth = 60;
  const cellHeight = 50;
  const labelWidth = 100;
  const labelHeight = 80;

  return (
    <div className="bg-card border border-border rounded-lg p-4 overflow-auto">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Dot Plot - Gene Expression by Cluster
      </h3>

      <div className="relative">
        {/* Main plot area */}
        <svg
          width={labelWidth + clusters.length * cellWidth + 100}
          height={labelHeight + genes.length * cellHeight + 60}
          className="block"
        >
          {/* Cluster labels (top) */}
          {clusters.map((cluster, idx) => (
            <g key={cluster.id}>
              <text
                x={labelWidth + idx * cellWidth + cellWidth / 2}
                y={labelHeight - 10}
                textAnchor="end"
                transform={`rotate(-45, ${labelWidth + idx * cellWidth + cellWidth / 2}, ${labelHeight - 10})`}
                className="text-xs fill-foreground"
                style={{ fontSize: "10px" }}
              >
                {cluster.name}
              </text>
            </g>
          ))}

          {/* Gene labels (left) */}
          {genes.map((gene, idx) => (
            <text
              key={gene}
              x={labelWidth - 10}
              y={labelHeight + idx * cellHeight + cellHeight / 2 + 4}
              textAnchor="end"
              className="text-xs fill-foreground font-mono"
              style={{ fontSize: "11px" }}
            >
              {gene}
            </text>
          ))}

          {/* Dots */}
          {dotData.map((d, idx) => {
            const geneIdx = genes.indexOf(d.gene);
            const clusterIdx = clusters.findIndex((c) => c.id === d.cluster.id);

            return (
              <g key={idx}>
                <circle
                  cx={labelWidth + clusterIdx * cellWidth + cellWidth / 2}
                  cy={labelHeight + geneIdx * cellHeight + cellHeight / 2}
                  r={dotSize(d.percentExpressing) / 2}
                  fill={dotColor(d.meanExpression)}
                  stroke="hsl(var(--border))"
                  strokeWidth={0.5}
                />
              </g>
            );
          })}

          {/* Legend - Size */}
          <g transform={`translate(${labelWidth + clusters.length * cellWidth + 20}, ${labelHeight})`}>
            <text
              x={0}
              y={0}
              className="text-xs fill-foreground font-medium"
              style={{ fontSize: "10px" }}
            >
              % Expressing
            </text>
            {[25, 50, 75, 100].map((pct, idx) => (
              <g key={pct} transform={`translate(20, ${20 + idx * 25})`}>
                <circle
                  cx={0}
                  cy={0}
                  r={dotSize(pct) / 2}
                  fill="hsl(var(--muted-foreground))"
                  opacity={0.5}
                />
                <text
                  x={20}
                  y={4}
                  className="text-xs fill-muted-foreground"
                  style={{ fontSize: "10px" }}
                >
                  {pct}%
                </text>
              </g>
            ))}
          </g>

          {/* Legend - Color */}
          <g transform={`translate(${labelWidth + clusters.length * cellWidth + 20}, ${labelHeight + 130})`}>
            <text
              x={0}
              y={0}
              className="text-xs fill-foreground font-medium"
              style={{ fontSize: "10px" }}
            >
              Mean Expr.
            </text>
            <defs>
              <linearGradient id="dotplot-color-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgb(180, 180, 180)" />
                <stop offset="100%" stopColor="rgb(255, 60, 40)" />
              </linearGradient>
            </defs>
            <rect
              x={0}
              y={15}
              width={50}
              height={10}
              fill="url(#dotplot-color-gradient)"
              rx={2}
            />
            <text
              x={0}
              y={38}
              className="text-xs fill-muted-foreground"
              style={{ fontSize: "9px" }}
            >
              Low
            </text>
            <text
              x={35}
              y={38}
              className="text-xs fill-muted-foreground"
              style={{ fontSize: "9px" }}
            >
              High
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
