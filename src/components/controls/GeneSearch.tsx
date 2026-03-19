import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import Fuse from "fuse.js";
import { Input } from "@/components/ui/input";

interface GeneSearchProps {
  genes: string[];
  selectedGene: string | null;
  onGeneSelect: (gene: string | null) => void;
}

export function GeneSearch({ genes, selectedGene, onGeneSelect }: GeneSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fuse = useMemo(
    () => new Fuse(genes, { threshold: 0.3, includeScore: true }),
    [genes]
  );

  const results = useMemo(() => {
    if (!query.trim()) {
      return genes.slice(0, 10);
    }
    return fuse.search(query).slice(0, 10).map((r) => r.item);
  }, [query, genes, fuse]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (gene: string) => {
    onGeneSelect(gene);
    setQuery(gene);
    setIsOpen(false);
  };

  const handleClear = () => {
    onGeneSelect(null);
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search genes..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10 bg-card"
        />
        {(query || selectedGene) && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto scrollbar-thin">
          {results.map((gene) => (
            <button
              key={gene}
              onClick={() => handleSelect(gene)}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-secondary transition-colors ${
                selectedGene === gene
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground"
              }`}
            >
              <span className="font-mono">{gene}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
