import React, { useMemo } from "react";
import { Cell, ClusterInfo } from "@/types/singleCell";

interface FeaturePlotProps {
  cells: Cell[];
  gene: string;
  clusters: ClusterInfo[];
  expressionData: Map<string, number>;
  height?: number;
}

export function FeaturePlot({ cells, gene, clusters, expressionData, height = 200 }: FeaturePlotProps) {
  const plotData = useMemo(() => {
    return clusters.map(cluster => {
      const clusterCells = cells.filter(c => c.cluster === cluster.id);
      const values = clusterCells.map(c => expressionData.get(c.id) ?? 0);
      const expressing = values.filter(v => v > 0.5);
      
      const meanExpr = values.length > 0 
        ? values.reduce((a, b) => a + b, 0) / values.length 
        : 0;
      const pctExpressing = values.length > 0 
        ? (expressing.length / values.length) * 100 
        : 0;
        
      return {
        clusterId: cluster.id,
        clusterName: cluster.name,
        color: cluster.color,
        meanExpression: meanExpr,
        pctExpressing,
        cellCount: clusterCells.length,
      };
    });
  }, [cells, clusters, expressionData]);

  const maxMean = useMemo(() => 
    Math.max(...plotData.map(d => d.meanExpression), 0.1), 
    [plotData]
  );

  const barWidth = 50;
  const padding = { top: 30, right: 20, bottom: 80, left: 60 };
  const plotWidth = padding.left + padding.right + plotData.length * barWidth;
  const plotHeight = height;
  const innerHeight = plotHeight - padding.top - padding.bottom;

  const yScale = (value: number) => 
    padding.top + innerHeight - (value / maxMean) * innerHeight;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Mean Expression of <span className="text-primary font-mono">{gene}</span>
      </h3>
      
      <div className="overflow-x-auto">
        <svg width={plotWidth} height={plotHeight}>
          {/* Y-axis */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + innerHeight}
            stroke="currentColor"
            strokeOpacity={0.3}
          />
          
          {/* Y-axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map(tick => (
            <g key={tick}>
              <line
                x1={padding.left - 5}
                y1={yScale(tick * maxMean)}
                x2={padding.left}
                y2={yScale(tick * maxMean)}
                stroke="currentColor"
                strokeOpacity={0.3}
              />
              <text
                x={padding.left - 10}
                y={yScale(tick * maxMean)}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-xs fill-muted-foreground"
              >
                {(tick * maxMean).toFixed(1)}
              </text>
            </g>
          ))}
          
          {/* Y-axis label */}
          <text
            x={15}
            y={padding.top + innerHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(-90, 15, ${padding.top + innerHeight / 2})`}
            className="text-xs fill-muted-foreground"
          >
            Mean Expression
          </text>
          
          {/* Bars */}
          {plotData.map((data, idx) => {
            const centerX = padding.left + idx * barWidth + barWidth / 2;
            const barHeight = (data.meanExpression / maxMean) * innerHeight;
            
            return (
              <g key={data.clusterId}>
                {/* Bar */}
                <rect
                  x={centerX - barWidth * 0.35}
                  y={padding.top + innerHeight - barHeight}
                  width={barWidth * 0.7}
                  height={barHeight}
                  fill={data.color}
                  fillOpacity={0.8}
                  rx={3}
                />
                
                {/* Percent expressing indicator */}
                <circle
                  cx={centerX}
                  cy={padding.top + innerHeight - barHeight - 10}
                  r={Math.max(2, data.pctExpressing / 10)}
                  fill={data.color}
                  fillOpacity={0.3}
                  stroke={data.color}
                  strokeWidth={1}
                />
                
                {/* Cluster label */}
                <text
                  x={centerX}
                  y={padding.top + innerHeight + 15}
                  textAnchor="middle"
                  className="text-xs fill-muted-foreground"
                >
                  {data.clusterId}
                </text>
                <text
                  x={centerX}
                  y={padding.top + innerHeight + 30}
                  textAnchor="middle"
                  className="text-[10px] fill-muted-foreground"
                >
                  {data.clusterName.length > 6 ? data.clusterName.slice(0, 6) + '…' : data.clusterName}
                </text>
                <text
                  x={centerX}
                  y={padding.top + innerHeight + 45}
                  textAnchor="middle"
                  className="text-[9px] fill-muted-foreground/60"
                >
                  {data.pctExpressing.toFixed(0)}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      
      <p className="text-xs text-muted-foreground mt-2">
        Circle size indicates % of cells expressing. Values below bars show % expressing.
      </p>
    </div>
  );
}
