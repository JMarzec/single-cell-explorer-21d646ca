import React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lasso, Square, MousePointer, X } from "lucide-react";

export type SelectionMode = "none" | "lasso" | "rectangle";

interface SelectionToolsProps {
  mode: SelectionMode;
  onModeChange: (mode: SelectionMode) => void;
  selectedCount: number;
  onClearSelection: () => void;
}

export function SelectionTools({
  mode,
  onModeChange,
  selectedCount,
  onClearSelection,
}: SelectionToolsProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 p-1 bg-card/95 border border-border rounded-lg shadow-sm">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === "none" ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onModeChange("none")}
            >
              <MousePointer className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Pan & Zoom</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === "lasso" ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onModeChange("lasso")}
            >
              <Lasso className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Lasso Selection</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === "rectangle" ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onModeChange("rectangle")}
            >
              <Square className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Rectangle Selection</p>
          </TooltipContent>
        </Tooltip>

        {selectedCount > 0 && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <span className="text-xs text-muted-foreground px-1">
              {selectedCount.toLocaleString()} cells
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={onClearSelection}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Clear Selection</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
