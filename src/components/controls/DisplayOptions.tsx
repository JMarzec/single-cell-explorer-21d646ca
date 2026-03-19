import React from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClusterInfo, VisualizationSettings, ColorPalette } from "@/types/singleCell";
import { PALETTE_LABELS, getPaletteGradientCSS } from "@/lib/colorPalettes";

interface DisplayOptionsProps {
  clusters: ClusterInfo[];
  settings: VisualizationSettings;
  onSettingsChange: (settings: Partial<VisualizationSettings>) => void;
}

export function DisplayOptions({
  clusters,
  settings,
  onSettingsChange,
}: DisplayOptionsProps) {
  return (
    <div className="space-y-6 p-4 bg-card border border-border rounded-lg">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Display Options</h3>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Point Size</Label>
          <Slider
            value={[settings.pointSize]}
            min={0.5}
            max={5}
            step={0.1}
            onValueChange={([value]) => onSettingsChange({ pointSize: value })}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.5</span>
            <span className="font-mono">{settings.pointSize.toFixed(1)}</span>
            <span>5</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Opacity</Label>
          <Slider
            value={[settings.opacity]}
            min={0.1}
            max={1}
            step={0.05}
            onValueChange={([value]) => onSettingsChange({ opacity: value })}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>10%</span>
            <span className="font-mono">{Math.round(settings.opacity * 100)}%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Color Palette</Label>
          <Select
            value={settings.colorPalette}
            onValueChange={(value) => onSettingsChange({ colorPalette: value as ColorPalette })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PALETTE_LABELS) as ColorPalette[]).map((key) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-16 h-3 rounded-sm border border-border"
                      style={{ background: getPaletteGradientCSS(key) }}
                    />
                    <span>{PALETTE_LABELS[key]}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Expression Scale {settings.selectedGene ? `(${settings.selectedGene})` : ''}
          </Label>
          <Slider
            value={[settings.expressionScale]}
            min={0.1}
            max={3}
            step={0.1}
            onValueChange={([value]) => onSettingsChange({ expressionScale: value })}
            disabled={!settings.selectedGene && settings.selectedGenes.length === 0}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Low</span>
            <span className="font-mono">{settings.expressionScale.toFixed(1)}x</span>
            <span>High</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="percentile-clipping" className="text-sm">
              Percentile Clipping
            </Label>
            <p className="text-xs text-muted-foreground">Clip outliers for better contrast</p>
          </div>
          <Switch
            id="percentile-clipping"
            checked={settings.usePercentileClipping}
            onCheckedChange={(checked) => onSettingsChange({ usePercentileClipping: checked })}
            disabled={!settings.selectedGene && settings.selectedGenes.length === 0}
          />
        </div>

        {settings.usePercentileClipping && (
          <div className="space-y-2 pl-2 border-l-2 border-primary/20">
            <Label className="text-xs text-muted-foreground">
              Percentile Range ({settings.percentileLow}% - {settings.percentileHigh}%)
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-xs w-8">{settings.percentileLow}%</span>
              <Slider
                value={[settings.percentileLow, settings.percentileHigh]}
                min={0}
                max={100}
                step={1}
                onValueChange={([low, high]) => {
                  if (low < high) {
                    onSettingsChange({ percentileLow: low, percentileHigh: high });
                  }
                }}
              />
              <span className="text-xs w-8">{settings.percentileHigh}%</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="show-clusters" className="text-sm">
            Show Clusters
          </Label>
          <Switch
            id="show-clusters"
            checked={settings.showClusters}
            onCheckedChange={(checked) => onSettingsChange({ showClusters: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-labels" className="text-sm">
            Show Labels
          </Label>
          <Switch
            id="show-labels"
            checked={settings.showLabels}
            onCheckedChange={(checked) => onSettingsChange({ showLabels: checked })}
          />
        </div>
      </div>
    </div>
  );
}
