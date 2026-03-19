import React, { useMemo } from "react";
import { Cell, ClusterInfo } from "@/types/singleCell";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CellFilterState {
  selectedSamples: string[];
  selectedClusters: number[];
}

interface CellFilterProps {
  cells: Cell[];
  clusters: ClusterInfo[];
  filter: CellFilterState;
  onFilterChange: (filter: CellFilterState) => void;
}

export function CellFilter({
  cells,
  clusters,
  filter,
  onFilterChange,
}: CellFilterProps) {
  // Extract unique samples from cells
  const samples = useMemo(() => {
    const sampleSet = new Set<string>();
    cells.forEach((cell) => {
      const sample = cell.metadata.sample;
      if (typeof sample === "string") {
        sampleSet.add(sample);
      }
    });
    return Array.from(sampleSet).sort();
  }, [cells]);

  // Count filtered cells
  const filteredCount = useMemo(() => {
    return cells.filter((cell) => {
      const sampleMatch =
        filter.selectedSamples.length === 0 ||
        filter.selectedSamples.includes(cell.metadata.sample as string);
      const clusterMatch =
        filter.selectedClusters.length === 0 ||
        filter.selectedClusters.includes(cell.cluster);
      return sampleMatch && clusterMatch;
    }).length;
  }, [cells, filter]);

  const handleSampleAdd = (sample: string) => {
    if (!filter.selectedSamples.includes(sample)) {
      onFilterChange({
        ...filter,
        selectedSamples: [...filter.selectedSamples, sample],
      });
    }
  };

  const handleSampleRemove = (sample: string) => {
    onFilterChange({
      ...filter,
      selectedSamples: filter.selectedSamples.filter((s) => s !== sample),
    });
  };

  const handleClusterAdd = (clusterId: number) => {
    if (!filter.selectedClusters.includes(clusterId)) {
      onFilterChange({
        ...filter,
        selectedClusters: [...filter.selectedClusters, clusterId],
      });
    }
  };

  const handleClusterRemove = (clusterId: number) => {
    onFilterChange({
      ...filter,
      selectedClusters: filter.selectedClusters.filter((c) => c !== clusterId),
    });
  };

  const handleClearAll = () => {
    onFilterChange({ selectedSamples: [], selectedClusters: [] });
  };

  const hasFilters =
    filter.selectedSamples.length > 0 || filter.selectedClusters.length > 0;

  return (
    <div className="space-y-4 p-4 bg-card border border-border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Cell Filter</h3>
        </div>
        {hasFilters && (
          <button
            onClick={handleClearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Sample filter */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Filter by Sample</Label>
        <Select onValueChange={handleSampleAdd}>
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Select sample..." />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border z-50">
            {samples.map((sample) => (
              <SelectItem
                key={sample}
                value={sample}
                disabled={filter.selectedSamples.includes(sample)}
              >
                {sample}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filter.selectedSamples.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {filter.selectedSamples.map((sample) => (
              <Badge
                key={sample}
                variant="secondary"
                className="text-xs cursor-pointer hover:bg-destructive/20"
                onClick={() => handleSampleRemove(sample)}
              >
                {sample}
                <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Cluster filter */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Filter by Cluster</Label>
        <Select onValueChange={(val) => handleClusterAdd(parseInt(val))}>
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Select cluster..." />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border z-50 max-h-60">
            {clusters.map((cluster) => (
              <SelectItem
                key={cluster.id}
                value={cluster.id.toString()}
                disabled={filter.selectedClusters.includes(cluster.id)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cluster.color }}
                  />
                  {cluster.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filter.selectedClusters.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {filter.selectedClusters.map((clusterId) => {
              const cluster = clusters.find((c) => c.id === clusterId);
              return (
                <Badge
                  key={clusterId}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-destructive/20"
                  onClick={() => handleClusterRemove(clusterId)}
                >
                  <div
                    className="w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: cluster?.color }}
                  />
                  {cluster?.name ?? `Cluster ${clusterId}`}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter summary */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-semibold text-foreground">
            {filteredCount.toLocaleString()}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-foreground">
            {cells.length.toLocaleString()}
          </span>{" "}
          cells
        </p>
      </div>
    </div>
  );
}
