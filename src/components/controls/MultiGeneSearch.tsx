import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, Plus } from "lucide-react";
import Fuse from "fuse.js";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface MultiGeneSearchProps {
  genes: string[];
  selectedGenes: string[];
  onGenesSelect: (genes: string[]) => void;
  maxGenes?: number;
}

export function MultiGeneSearch({
  genes,
  selectedGenes,
  onGenesSelect,
  maxGenes = 20,
}: MultiGeneSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fuse = useMemo(
    () => new Fuse(genes, { threshold: 0.3, includeScore: true }),
    [genes]
  );

  const safeSelectedGenes = selectedGenes ?? [];

  const results = useMemo(() => {
    const filteredGenes = genes.filter((g) => !safeSelectedGenes.includes(g));
    if (!query.trim()) {
      return filteredGenes.slice(0, 10);
    }
    return fuse
      .search(query)
      .filter((r) => !safeSelectedGenes.includes(r.item))
      .slice(0, 10)
      .map((r) => r.item);
  }, [query, genes, fuse, safeSelectedGenes]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAdd = (gene: string) => {
    if (safeSelectedGenes.length < maxGenes && !safeSelectedGenes.includes(gene)) {
      onGenesSelect([...safeSelectedGenes, gene]);
      setQuery("");
    }
  };

  const handleRemove = (gene: string) => {
    onGenesSelect(safeSelectedGenes.filter((g) => g !== gene));
  };

  const handleClearAll = () => {
    onGenesSelect([]);
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
        placeholder={
            safeSelectedGenes.length >= maxGenes
              ? `Max ${maxGenes} genes`
              : "Add genes..."
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10 bg-card"
          disabled={safeSelectedGenes.length >= maxGenes}
        />
        {safeSelectedGenes.length > 0 && (
          <button
            onClick={handleClearAll}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Selected genes */}
      {safeSelectedGenes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {safeSelectedGenes.map((gene) => (
            <Badge
              key={gene}
              variant="default"
              className="text-xs cursor-pointer hover:bg-primary/80"
              onClick={() => handleRemove(gene)}
            >
              <span className="font-mono">{gene}</span>
              <X className="ml-1 h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && results.length > 0 && safeSelectedGenes.length < maxGenes && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto scrollbar-thin">
          {results.map((gene) => (
            <button
              key={gene}
              onClick={() => handleAdd(gene)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-secondary transition-colors flex items-center justify-between text-foreground"
            >
              <span className="font-mono">{gene}</span>
              <Plus className="h-3 w-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {/* Gene count */}
      <p className="text-xs text-muted-foreground">
        {safeSelectedGenes.length} of {maxGenes} genes selected
      </p>
    </div>
  );
}
