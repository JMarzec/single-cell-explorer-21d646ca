import React, { useState, useMemo, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DifferentialExpression, ClusterInfo } from "@/types/singleCell";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, Search } from "lucide-react";

interface DifferentialExpressionTableProps {
  data: DifferentialExpression[];
  clusters?: ClusterInfo[];
  onGeneClick?: (gene: string) => void;
}

const ROW_HEIGHT = 36;
const columnHelper = createColumnHelper<DifferentialExpression>();

export function DifferentialExpressionTable({
  data,
  clusters,
  onGeneClick,
}: DifferentialExpressionTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "logFC", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const clusterNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (clusters) {
      clusters.forEach((c) => {
        map.set(`Cl_${c.id}`, c.name);
        map.set(String(c.id), c.name);
        map.set(c.name, c.name);
      });
    }
    return map;
  }, [clusters]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("gene", {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-primary transition-colors"
            onClick={() => column.toggleSorting()}
          >
            Gene
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: (info) => (
          <button
            onClick={() => onGeneClick?.(info.getValue())}
            className="font-mono text-primary hover:underline"
          >
            {info.getValue()}
          </button>
        ),
      }),
      columnHelper.accessor("cluster", {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-primary transition-colors"
            onClick={() => column.toggleSorting()}
          >
            Cluster
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: (info) => (
          <span className="px-2 py-0.5 bg-secondary rounded text-xs font-medium">
            {info.getValue()}
          </span>
        ),
      }),
      {
        id: "cellType",
        accessorFn: (row: DifferentialExpression) => clusterNameMap.get(row.cluster) || "",
        header: ({ column }: any) => (
          <button
            className="flex items-center gap-1 hover:text-primary transition-colors"
            onClick={() => column.toggleSorting()}
          >
            Cell Type
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: (info: any) => (
          <span className="text-xs text-muted-foreground">
            {(info.getValue() as string) || "—"}
          </span>
        ),
      },
      columnHelper.accessor("logFC", {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-primary transition-colors"
            onClick={() => column.toggleSorting()}
          >
            logFC
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: (info) => (
          <span
            className={`font-mono ${
              info.getValue() > 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {info.getValue().toFixed(2)}
          </span>
        ),
      }),
      columnHelper.accessor("pAdj", {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-primary transition-colors"
            onClick={() => column.toggleSorting()}
          >
            p.adj
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className="font-mono text-xs">
              {value === 0 ? "0" : value.toExponential(2)}
            </span>
          );
        },
      }),
    ],
    [onGeneClick, clusterNameMap]
  );

  const globalFilterFn = useMemo(() => {
    return (row: any, _columnId: string, filterValue: string) => {
      const search = filterValue.toLowerCase();
      const gene = String(row.original.gene).toLowerCase();
      const cluster = String(row.original.cluster).toLowerCase();
      const cellType = (clusterNameMap.get(row.original.cluster) || "").toLowerCase();
      return gene.includes(search) || cluster.includes(search) || cellType.includes(search);
    };
  }, [clusterNameMap]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden max-h-[600px] flex flex-col">
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-foreground">
            Differential Expression
          </h3>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search genes, clusters, cell types..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10 h-8 text-sm"
            />
          </div>
        </div>
      </div>

      <div ref={scrollContainerRef} className="overflow-auto flex-1">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {virtualizer.getVirtualItems().length > 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ height: virtualizer.getVirtualItems()[0].start, padding: 0 }}
                />
              </tr>
            )}
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  className="hover:bg-secondary/50 transition-colors border-b border-border"
                  style={{ height: ROW_HEIGHT }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-2 text-sm text-foreground"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {virtualizer.getVirtualItems().length > 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    height:
                      virtualizer.getTotalSize() -
                      (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                    padding: 0,
                  }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 border-t border-border shrink-0">
        <span className="text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length.toLocaleString()} entries
        </span>
      </div>
    </div>
  );
}