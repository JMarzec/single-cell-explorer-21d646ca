import React, { useState, useCallback } from "react";
import { ClusterInfo } from "@/types/singleCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tags, Merge, Palette, Undo2 } from "lucide-react";
import { toast } from "sonner";

interface ClusterAnnotationToolProps {
  clusters: ClusterInfo[];
  onRenameCluster: (clusterId: number, newName: string) => void;
  onMergeClusters: (sourceIds: number[], targetId: number, mergedName: string) => void;
  onChangeClusterColor: (clusterId: number, newColor: string) => void;
  onResetClusters: () => void;
}

const PRESET_COLORS = [
  "#3498db", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#34495e", "#d35400", "#c0392b",
  "#27ae60", "#2980b9", "#8e44ad", "#f1c40f", "#16a085",
  "#7f8c8d", "#e84393", "#00cec9", "#6c5ce7", "#fdcb6e",
];

export function ClusterAnnotationTool({
  clusters,
  onRenameCluster,
  onMergeClusters,
  onChangeClusterColor,
  onResetClusters,
}: ClusterAnnotationToolProps) {
  const [open, setOpen] = useState(false);

  // Rename state
  const [renameClusterId, setRenameClusterId] = useState<number | null>(null);
  const [renameTo, setRenameTo] = useState("");

  // Merge state
  const [mergeSourceIds, setMergeSourceIds] = useState<number[]>([]);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [mergedName, setMergedName] = useState("");

  // Color state
  const [colorClusterId, setColorClusterId] = useState<number | null>(null);
  const [selectedColor, setSelectedColor] = useState("#3498db");

  const handleRename = useCallback(() => {
    if (renameClusterId === null || !renameTo.trim()) {
      toast.error("Select a cluster and provide a new name");
      return;
    }
    onRenameCluster(renameClusterId, renameTo.trim());
    toast.success(`Cluster renamed to "${renameTo.trim()}"`);
    setRenameTo("");
    setRenameClusterId(null);
  }, [renameClusterId, renameTo, onRenameCluster]);

  const handleMerge = useCallback(() => {
    if (mergeSourceIds.length === 0 || mergeTargetId === null) {
      toast.error("Select source and target clusters");
      return;
    }
    if (mergeSourceIds.includes(mergeTargetId)) {
      toast.error("Target cluster cannot be one of the source clusters");
      return;
    }
    const name = mergedName.trim() || clusters.find(c => c.id === mergeTargetId)?.name || "Merged";
    onMergeClusters(mergeSourceIds, mergeTargetId, name);
    toast.success(`Merged ${mergeSourceIds.length} cluster(s) into "${name}"`);
    setMergeSourceIds([]);
    setMergeTargetId(null);
    setMergedName("");
  }, [mergeSourceIds, mergeTargetId, mergedName, clusters, onMergeClusters]);

  const handleColorChange = useCallback(() => {
    if (colorClusterId === null) {
      toast.error("Select a cluster first");
      return;
    }
    onChangeClusterColor(colorClusterId, selectedColor);
    toast.success("Cluster color updated");
  }, [colorClusterId, selectedColor, onChangeClusterColor]);

  const toggleMergeSource = (id: number) => {
    setMergeSourceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 w-full">
          <Tags className="h-4 w-4" />
          Annotate Clusters
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cluster Annotation Tool</DialogTitle>
          <DialogDescription>
            Rename, merge, or recolor clusters to customize your analysis.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="rename" className="w-full mt-2">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="rename" className="gap-1.5 text-xs">
              <Tags className="h-3.5 w-3.5" />
              Rename
            </TabsTrigger>
            <TabsTrigger value="merge" className="gap-1.5 text-xs">
              <Merge className="h-3.5 w-3.5" />
              Merge
            </TabsTrigger>
            <TabsTrigger value="color" className="gap-1.5 text-xs">
              <Palette className="h-3.5 w-3.5" />
              Color
            </TabsTrigger>
          </TabsList>

          {/* RENAME TAB */}
          <TabsContent value="rename" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-sm">Select Cluster</Label>
              <Select
                value={renameClusterId !== null ? String(renameClusterId) : ""}
                onValueChange={(val) => {
                  const id = parseInt(val);
                  setRenameClusterId(id);
                  setRenameTo(clusters.find(c => c.id === id)?.name || "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a cluster..." />
                </SelectTrigger>
                <SelectContent>
                  {clusters.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <span>{c.name}</span>
                        <span className="text-muted-foreground text-xs ml-auto">
                          ({c.cellCount.toLocaleString()} cells)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">New Name</Label>
              <Input
                value={renameTo}
                onChange={(e) => setRenameTo(e.target.value)}
                placeholder="Enter new cluster name..."
              />
            </div>
            <Button onClick={handleRename} size="sm" className="w-full">
              Rename Cluster
            </Button>
          </TabsContent>

          {/* MERGE TAB */}
          <TabsContent value="merge" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-sm">Source Clusters (to merge)</Label>
              <p className="text-xs text-muted-foreground">
                Click to select clusters that will be absorbed into the target.
              </p>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                {clusters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleMergeSource(c.id)}
                    className={`flex items-center gap-2 p-2 rounded border text-left text-sm transition-colors ${
                      mergeSourceIds.includes(c.id)
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Target Cluster (merge into)</Label>
              <Select
                value={mergeTargetId !== null ? String(mergeTargetId) : ""}
                onValueChange={(val) => setMergeTargetId(parseInt(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose target..." />
                </SelectTrigger>
                <SelectContent>
                  {clusters
                    .filter((c) => !mergeSourceIds.includes(c.id))
                    .map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          <span>{c.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Merged Cluster Name (optional)</Label>
              <Input
                value={mergedName}
                onChange={(e) => setMergedName(e.target.value)}
                placeholder="Leave blank to keep target name..."
              />
            </div>
            <Button onClick={handleMerge} size="sm" className="w-full" variant="default">
              Merge Clusters
            </Button>
          </TabsContent>

          {/* COLOR TAB */}
          <TabsContent value="color" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-sm">Select Cluster</Label>
              <Select
                value={colorClusterId !== null ? String(colorClusterId) : ""}
                onValueChange={(val) => {
                  const id = parseInt(val);
                  setColorClusterId(id);
                  const current = clusters.find(c => c.id === id);
                  if (current) setSelectedColor(current.color);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a cluster..." />
                </SelectTrigger>
                <SelectContent>
                  {clusters.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <span>{c.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Pick Color</Label>
              <div className="grid grid-cols-10 gap-1.5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-7 h-7 rounded-md border-2 transition-all ${
                      selectedColor === color
                        ? "border-foreground scale-110"
                        : "border-transparent hover:border-muted-foreground/50"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-xs text-muted-foreground">Custom:</Label>
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-border"
                />
                <Input
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-28 h-8 text-xs font-mono"
                  placeholder="#000000"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
              <div
                className="w-6 h-6 rounded-full border border-border"
                style={{ backgroundColor: selectedColor }}
              />
              <span className="text-sm text-foreground">
                {colorClusterId !== null
                  ? clusters.find(c => c.id === colorClusterId)?.name
                  : "No cluster selected"}
              </span>
            </div>
            <Button onClick={handleColorChange} size="sm" className="w-full">
              Apply Color
            </Button>
          </TabsContent>
        </Tabs>

        {/* Reset button */}
        <div className="pt-2 border-t border-border mt-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => {
              onResetClusters();
              toast.success("Clusters reset to original state");
            }}
          >
            <Undo2 className="h-3.5 w-3.5" />
            Reset to Original
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
