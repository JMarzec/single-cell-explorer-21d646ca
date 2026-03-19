import React, { useMemo } from "react";
import { Cell, ClusterInfo } from "@/types/singleCell";

interface ViolinPlotProps {
  cells: Cell[];
  gene: string;
  clusters: ClusterInfo[];
  expressionData: Map<string, number>;
  height?: number;
}

interface ViolinData {
  clusterId: number;
  clusterName: string;
  color: string;
  values: number[];
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

function calculatePercentile(sortedValues: number[], percentile: number): number {
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (index - lower) * (sortedValues[upper] - sortedValues[lower]);
}

function kernelDensityEstimator(values: number[], bandwidth: number, points: number[]): number[] {
  return points.map(x => {
    const sum = values.reduce((acc, v) => {
      const u = (x - v) / bandwidth;
      return acc + Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
    }, 0);
    return sum / (values.length * bandwidth);
  });
}

export function ViolinPlot({ cells, gene, clusters, expressionData, height = 300 }: ViolinPlotProps) {
  const violinData = useMemo(() => {
    const data: ViolinData[] = clusters.map(cluster => {
      const clusterCells = cells.filter(c => c.cluster === cluster.id);
      const values = clusterCells.map(c => expressionData.get(c.id) ?? 0).sort((a, b) => a - b);
      
      return {
        clusterId: cluster.id,
        clusterName: cluster.name,
        color: cluster.color,
        values,
        median: values.length > 0 ? calculatePercentile(values, 50) : 0,
        q1: values.length > 0 ? calculatePercentile(values, 25) : 0,
        q3: values.length > 0 ? calculatePercentile(values, 75) : 0,
        min: values.length > 0 ? values[0] : 0,
        max: values.length > 0 ? values[values.length - 1] : 0,
      };
    });
    
    return data;
  }, [cells, clusters, expressionData]);

  const globalMax = useMemo(() => {
    return Math.max(...violinData.map(d => d.max), 0.1);
  }, [violinData]);

  const violinWidth = 60;
  const padding = { top: 30, right: 20, bottom: 60, left: 50 };
  const plotWidth = padding.left + padding.right + violinData.length * violinWidth;
  const plotHeight = height;
  const innerHeight = plotHeight - padding.top - padding.bottom;

  const yScale = (value: number) => 
    padding.top + innerHeight - (value / globalMax) * innerHeight;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Expression of <span className="text-primary font-mono">{gene}</span>
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
                y1={yScale(tick * globalMax)}
                x2={padding.left}
                y2={yScale(tick * globalMax)}
                stroke="currentColor"
                strokeOpacity={0.3}
              />
              <text
                x={padding.left - 10}
                y={yScale(tick * globalMax)}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-xs fill-muted-foreground"
              >
                {(tick * globalMax).toFixed(1)}
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
            Expression
          </text>
          
          {/* Violins */}
          {violinData.map((data, idx) => {
            const centerX = padding.left + idx * violinWidth + violinWidth / 2;
            
            if (data.values.length < 2) {
              return (
                <g key={data.clusterId}>
                  <circle
                    cx={centerX}
                    cy={yScale(data.median)}
                    r={3}
                    fill={data.color}
                  />
                </g>
              );
            }
            
            // Calculate kernel density
            const nPoints = 50;
            const points = Array.from({ length: nPoints }, (_, i) => 
              data.min + (i / (nPoints - 1)) * (data.max - data.min)
            );
            const bandwidth = (data.max - data.min) / 10 || 0.1;
            const density = kernelDensityEstimator(data.values, bandwidth, points);
            const maxDensity = Math.max(...density);
            
            // Create violin path
            const violinMaxWidth = violinWidth * 0.4;
            const pathPoints = points.map((val, i) => ({
              x: (density[i] / maxDensity) * violinMaxWidth,
              y: yScale(val),
            }));
            
            const leftPath = pathPoints.map((p, i) => 
              `${i === 0 ? 'M' : 'L'} ${centerX - p.x} ${p.y}`
            ).join(' ');
            
            const rightPath = pathPoints.slice().reverse().map((p, i) => 
              `${i === 0 ? '' : 'L'} ${centerX + p.x} ${p.y}`
            ).join(' ');
            
            const fullPath = `${leftPath} ${rightPath} Z`;
            
            return (
              <g key={data.clusterId}>
                {/* Violin shape */}
                <path
                  d={fullPath}
                  fill={data.color}
                  fillOpacity={0.6}
                  stroke={data.color}
                  strokeWidth={1}
                />
                
                {/* Box plot overlay */}
                <line
                  x1={centerX}
                  y1={yScale(data.min)}
                  x2={centerX}
                  y2={yScale(data.max)}
                  stroke="currentColor"
                  strokeOpacity={0.4}
                  strokeWidth={1}
                />
                
                {/* IQR box */}
                <rect
                  x={centerX - 4}
                  y={yScale(data.q3)}
                  width={8}
                  height={yScale(data.q1) - yScale(data.q3)}
                  fill="white"
                  stroke="currentColor"
                  strokeOpacity={0.6}
                  strokeWidth={1}
                />
                
                {/* Median line */}
                <line
                  x1={centerX - 4}
                  y1={yScale(data.median)}
                  x2={centerX + 4}
                  y2={yScale(data.median)}
                  stroke="currentColor"
                  strokeWidth={2}
                />
                
                {/* Cluster label */}
                <text
                  x={centerX}
                  y={padding.top + innerHeight + 20}
                  textAnchor="middle"
                  className="text-xs fill-muted-foreground"
                >
                  {data.clusterId}
                </text>
                <text
                  x={centerX}
                  y={padding.top + innerHeight + 35}
                  textAnchor="middle"
                  className="text-[10px] fill-muted-foreground"
                >
                  {data.clusterName.length > 8 ? data.clusterName.slice(0, 8) + '…' : data.clusterName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
