import React from "react";
import { VisualizationSettings } from "@/types/singleCell";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dna } from "lucide-react";
import { GeneSearch } from "./GeneSearch";
import { MultiGeneSearch } from "./MultiGeneSearch";

interface GeneSelectionPanelProps {
  genes: string[];
  settings: VisualizationSettings;
  onSettingsChange: (settings: Partial<VisualizationSettings>) => void;
}

export function GeneSelectionPanel({ genes, settings, onSettingsChange }: GeneSelectionPanelProps) {
  return (
    <div className="space-y-4 p-4 bg-card border border-border rounded-lg">
      <div className="flex items-center gap-2">
        <Dna className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Gene Selection</h3>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Gene Expression (Scatter)</Label>
        <GeneSearch
          genes={genes}
          selectedGene={settings.selectedGene}
          onGeneSelect={(gene) => onSettingsChange({ selectedGene: gene })}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Multi-Gene Selection</Label>
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
