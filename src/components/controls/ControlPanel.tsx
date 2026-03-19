import React from "react";
import { GeneSearch } from "./GeneSearch";
import { MultiGeneSearch } from "./MultiGeneSearch";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ClusterInfo, VisualizationSettings } from "@/types/singleCell";

interface ControlPanelProps {
  genes: string[];
  clusters: ClusterInfo[];
  settings: VisualizationSettings;
  onSettingsChange: (settings: Partial<VisualizationSettings>) => void;
}

export function ControlPanel({
  genes,
  clusters,
  settings,
  onSettingsChange,
}: ControlPanelProps) {
  return (
    <div className="space-y-6 p-4 bg-card border border-border rounded-lg">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Gene Expression (Scatter)</h3>
        <GeneSearch
          genes={genes}
          selectedGene={settings.selectedGene}
          onGeneSelect={(gene) => onSettingsChange({ selectedGene: gene })}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Multi-Gene Selection</h3>
        <MultiGeneSearch
          genes={genes}
          selectedGenes={settings.selectedGenes}
          onGenesSelect={(selectedGenes) => onSettingsChange({ selectedGenes })}
          maxGenes={20}
        />
        {settings.selectedGenes.length > 0 && (
          <div className="flex items-center justify-between mt-3">
            <div>
              <Label htmlFor="show-averaged" className="text-sm">
                Show Averaged Expression
              </Label>
              <p className="text-xs text-muted-foreground">Display on scatter plot</p>
            </div>
            <Switch
              id="show-averaged"
              checked={settings.showAveragedExpression}
              onCheckedChange={(checked) => onSettingsChange({ showAveragedExpression: checked })}
            />
          </div>
        )}
      </div>

    </div>
  );
}
