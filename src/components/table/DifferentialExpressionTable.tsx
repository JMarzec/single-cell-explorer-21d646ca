import React, { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";
import { DifferentialExpression } from "@/types/singleCell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowUpDown, Search } from "lucide-react";

interface DifferentialExpressionTableProps {
  data: DifferentialExpression[];
  onGeneClick?: (gene: string) => void;
}

const columnHelper = createColumnHelper<DifferentialExpression>();

export function DifferentialExpressionTable({
  data,
  onGeneClick,
}: DifferentialExpressionTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "logFC", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");

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
    [onGeneClick]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-foreground">
            Differential Expression
          </h3>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search genes..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10 h-8 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border bg-muted/50">
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
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-secondary/50 transition-colors"
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
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-border flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Showing {table.getState().pagination.pageIndex * 10 + 1} to{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * 10,
            table.getFilteredRowModel().rows.length
          )}{" "}
          of {table.getFilteredRowModel().rows.length.toLocaleString()} entries
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
