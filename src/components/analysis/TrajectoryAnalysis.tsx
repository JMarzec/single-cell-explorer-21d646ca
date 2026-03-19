import React, { useMemo, useRef, useEffect, useState } from "react";
import { Cell, ClusterInfo } from "@/types/singleCell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface TrajectoryAnalysisProps {
  cells: Cell[];
  clusters: ClusterInfo[];
}

interface TrajectoryNode {
  id: string;
  x: number;
  y: number;
  pseudotime: number;
  cluster: number;
  isBranch: boolean;
}

interface TrajectoryEdge {
  source: string;
  target: string;
  weight: number;
}

// Calculate pseudotime based on distance from root
export function calculatePseudotime(cells: Cell[], rootCluster: number): Map<string, number> {
  const pseudotimeMap = new Map<string, number>();
  
  // Find cluster centers
  const clusterCenters = new Map<number, { x: number; y: number; count: number }>();
  cells.forEach(cell => {
    const center = clusterCenters.get(cell.cluster) || { x: 0, y: 0, count: 0 };
    center.x += cell.x;
    center.y += cell.y;
    center.count++;
    clusterCenters.set(cell.cluster, center);
  });
  
  // Normalize centers
  clusterCenters.forEach((center, cluster) => {
    center.x /= center.count;
    center.y /= center.count;
  });
  
  const rootCenter = clusterCenters.get(rootCluster);
  if (!rootCenter) return pseudotimeMap;
  
  // Calculate pseudotime as distance from root center weighted by cluster progression
  const maxDist = Math.max(...cells.map(cell => 
    Math.sqrt(Math.pow(cell.x - rootCenter.x, 2) + Math.pow(cell.y - rootCenter.y, 2))
  ));
  
  cells.forEach(cell => {
    const dist = Math.sqrt(Math.pow(cell.x - rootCenter.x, 2) + Math.pow(cell.y - rootCenter.y, 2));
    const normalizedDist = dist / maxDist;
    // Add some noise for realism
    const noise = (Math.random() - 0.5) * 0.1;
    pseudotimeMap.set(cell.id, Math.max(0, Math.min(1, normalizedDist + noise)));
  });
  
  return pseudotimeMap;
}

// Build trajectory graph using simplified MST-like approach
function buildTrajectoryGraph(
  cells: Cell[], 
  clusters: ClusterInfo[],
  pseudotimeMap: Map<string, number>
): { nodes: TrajectoryNode[]; edges: TrajectoryEdge[] } {
  // Calculate cluster centers with pseudotime
  const clusterData = new Map<number, { x: number; y: number; count: number; pseudotime: number }>();
  
  cells.forEach(cell => {
    const data = clusterData.get(cell.cluster) || { x: 0, y: 0, count: 0, pseudotime: 0 };
    data.x += cell.x;
    data.y += cell.y;
    data.count++;
    data.pseudotime += pseudotimeMap.get(cell.id) || 0;
    clusterData.set(cell.cluster, data);
  });
  
  // Normalize
  clusterData.forEach((data, cluster) => {
    data.x /= data.count;
    data.y /= data.count;
    data.pseudotime /= data.count;
  });
  
  // Create nodes
  const nodes: TrajectoryNode[] = [];
  clusterData.forEach((data, clusterId) => {
    nodes.push({
      id: `cluster_${clusterId}`,
      x: data.x,
      y: data.y,
      pseudotime: data.pseudotime,
      cluster: clusterId,
      isBranch: false,
    });
  });
  
  // Sort by pseudotime
  nodes.sort((a, b) => a.pseudotime - b.pseudotime);
  
  // Build edges connecting clusters by pseudotime proximity
  const edges: TrajectoryEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i];
    
    // Find nearest neighbors with higher pseudotime
    const candidates = nodes.filter(n => n.pseudotime > current.pseudotime);
    if (candidates.length === 0) continue;
    
    // Connect to 1-2 nearest neighbors (creating branches)
    const distances = candidates.map(c => ({
      node: c,
      dist: Math.sqrt(Math.pow(c.x - current.x, 2) + Math.pow(c.y - current.y, 2))
    })).sort((a, b) => a.dist - b.dist);
    
    // Primary connection
    edges.push({
      source: current.id,
      target: distances[0].node.id,
      weight: 1
    });
    
    // Secondary branch if distance is similar and pseudotime difference is significant
    if (distances.length > 1 && 
        distances[1].dist < distances[0].dist * 1.5 &&
        Math.abs(distances[1].node.pseudotime - current.pseudotime) > 0.15) {
      edges.push({
        source: current.id,
        target: distances[1].node.id,
        weight: 0.5
      });
      current.isBranch = true;
    }
  }
  
  return { nodes, edges };
}

export const TrajectoryAnalysis: React.FC<TrajectoryAnalysisProps> = ({
  cells,
  clusters,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [rootCluster, setRootCluster] = useState<number>(0);
  const [showCells, setShowCells] = useState(true);
  const [lineWidth, setLineWidth] = useState([3]);

  // Calculate pseudotime
  const pseudotimeMap = useMemo(() => 
    calculatePseudotime(cells, rootCluster), 
    [cells, rootCluster]
  );

  // Build trajectory graph
  const trajectory = useMemo(() => 
    buildTrajectoryGraph(cells, clusters, pseudotimeMap),
    [cells, clusters, pseudotimeMap]
  );

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height: Math.max(350, height) });
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Calculate data bounds
  const bounds = useMemo(() => {
    if (cells.length === 0) return { minX: -50, maxX: 50, minY: -50, maxY: 50 };
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    cells.forEach(cell => {
      minX = Math.min(minX, cell.x);
      maxX = Math.max(maxX, cell.x);
      minY = Math.min(minY, cell.y);
      maxY = Math.max(maxY, cell.y);
    });
    
    const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
    return { 
      minX: minX - padding, 
      maxX: maxX + padding, 
      minY: minY - padding, 
      maxY: maxY + padding 
    };
  }, [cells]);

  // Draw trajectory
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    // Clear with white/transparent background
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const padding = 40;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;

    // Transform function
    const toCanvas = (x: number, y: number) => ({
      x: padding + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * plotWidth,
      y: padding + (1 - (y - bounds.minY) / (bounds.maxY - bounds.minY)) * plotHeight
    });

    // Draw cells colored by pseudotime
    if (showCells) {
      cells.forEach(cell => {
        const pos = toCanvas(cell.x, cell.y);
        const pt = pseudotimeMap.get(cell.id) || 0;
        
        // Color gradient: blue (early) -> green -> yellow -> red (late)
        const hue = (1 - pt) * 240; // 240 = blue, 0 = red
        ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.4)`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw trajectory edges
    trajectory.edges.forEach(edge => {
      const sourceNode = trajectory.nodes.find(n => n.id === edge.source);
      const targetNode = trajectory.nodes.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      const sourcePos = toCanvas(sourceNode.x, sourceNode.y);
      const targetPos = toCanvas(targetNode.x, targetNode.y);

      ctx.strokeStyle = edge.weight === 1 
        ? 'hsl(var(--primary))' 
        : 'hsl(var(--muted-foreground))';
      ctx.lineWidth = lineWidth[0] * edge.weight;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(sourcePos.x, sourcePos.y);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.stroke();

      // Draw arrow
      const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x);
      const arrowLen = 8;
      ctx.beginPath();
      ctx.moveTo(targetPos.x, targetPos.y);
      ctx.lineTo(
        targetPos.x - arrowLen * Math.cos(angle - Math.PI / 6),
        targetPos.y - arrowLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(targetPos.x, targetPos.y);
      ctx.lineTo(
        targetPos.x - arrowLen * Math.cos(angle + Math.PI / 6),
        targetPos.y - arrowLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    });

    // Draw trajectory nodes
    trajectory.nodes.forEach(node => {
      const pos = toCanvas(node.x, node.y);
      const cluster = clusters[node.cluster];
      
      // Node circle
      ctx.fillStyle = cluster?.color || 'hsl(var(--primary))';
      ctx.strokeStyle = 'hsl(var(--background))';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, node.isBranch ? 12 : 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Cluster label
      ctx.fillStyle = 'hsl(var(--foreground))';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(node.cluster), pos.x, pos.y);
    });

    // Draw pseudotime colorbar
    const barWidth = 150;
    const barHeight = 12;
    const barX = width - padding - barWidth;
    const barY = padding - 25;

    const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
    gradient.addColorStop(0, 'hsl(240, 70%, 50%)');
    gradient.addColorStop(0.5, 'hsl(120, 70%, 50%)');
    gradient.addColorStop(1, 'hsl(0, 70%, 50%)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    ctx.strokeStyle = 'hsl(var(--border))';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = 'hsl(var(--muted-foreground))';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Early', barX, barY + barHeight + 12);
    ctx.textAlign = 'right';
    ctx.fillText('Late', barX + barWidth, barY + barHeight + 12);
    ctx.textAlign = 'center';
    ctx.fillText('Pseudotime', barX + barWidth / 2, barY - 5);

  }, [cells, clusters, trajectory, pseudotimeMap, dimensions, bounds, showCells, lineWidth]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Trajectory / Pseudotime Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="root-cluster" className="text-sm whitespace-nowrap">Root Cluster:</Label>
            <Select 
              value={String(rootCluster)} 
              onValueChange={(v) => setRootCluster(parseInt(v))}
            >
              <SelectTrigger id="root-cluster" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clusters.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    Cluster {c.id} ({c.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch 
              id="show-cells" 
              checked={showCells} 
              onCheckedChange={setShowCells}
            />
            <Label htmlFor="show-cells" className="text-sm">Show cells</Label>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Line width:</Label>
            <Slider
              value={lineWidth}
              onValueChange={setLineWidth}
              min={1}
              max={6}
              step={0.5}
              className="w-24"
            />
          </div>
        </div>

        <div ref={containerRef} className="w-full h-[400px] border border-border rounded-lg overflow-hidden">
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>
            <strong>Trajectory analysis</strong> infers developmental lineages by computing pseudotime 
            (cell progression from root) and connecting cluster centroids. Branching points indicate 
            potential cell fate decisions. Select a root cluster representing the earliest developmental stage.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
