import React from "react";
import { Cell } from "@/types/singleCell";

interface CellTooltipProps {
  cell: Cell | null;
  position: { x: number; y: number };
  clusterName?: string;
  expressionValue?: number;
  geneName?: string;
}

export function CellTooltip({
  cell,
  position,
  clusterName,
  expressionValue,
  geneName,
}: CellTooltipProps) {
  if (!cell) return null;

  return (
    <div
      className="absolute z-50 pointer-events-none bg-card/95 border border-border rounded-lg shadow-lg p-3 text-sm min-w-[200px]"
      style={{
        left: position.x + 15,
        top: position.y + 15,
        transform: "translateY(-50%)",
      }}
    >
      <div className="space-y-2">
        {/* Cell ID */}
        <div className="font-medium text-foreground border-b border-border pb-1">
          {cell.id}
        </div>

        {/* Cluster */}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Cluster:</span>
          <span className="font-medium text-foreground">
            {clusterName ?? `Cluster ${cell.cluster}`}
          </span>
        </div>

        {/* Coordinates */}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Coordinates:</span>
          <span className="font-mono text-xs text-foreground">
            ({cell.x.toFixed(2)}, {cell.y.toFixed(2)})
          </span>
        </div>

        {/* Gene expression if available */}
        {geneName && expressionValue !== undefined && (
          <div className="flex justify-between border-t border-border pt-1">
            <span className="text-muted-foreground">{geneName}:</span>
            <span className="font-mono font-medium text-primary">
              {expressionValue.toFixed(3)}
            </span>
          </div>
        )}

        {/* Metadata */}
        {Object.entries(cell.metadata).length > 0 && (
          <div className="border-t border-border pt-2 space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Metadata
            </div>
            {Object.entries(cell.metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{key}:</span>
                <span className="font-mono text-foreground">
                  {typeof value === "number" ? value.toLocaleString() : value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
