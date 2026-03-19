import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ExternalLink, Search, AlertCircle } from "lucide-react";

interface EnrichmentResult {
  term: string;
  pValue: number;
  adjustedPValue: number;
  overlapGenes: string[];
  overlapRatio: string;
  database: string;
}

interface PathwayEnrichmentProps {
  genes: string[];
  onGeneClick?: (gene: string) => void;
}

// Demo enrichment data for common gene sets
const getDemoEnrichment = (genes: string[]): { go: EnrichmentResult[]; kegg: EnrichmentResult[] } => {
  // This simulates enrichment results based on gene names
  const hasCardiac = genes.some(g => g.includes("MYH") || g.includes("TNNT") || g.includes("ACTN"));
  const hasDevelopment = genes.some(g => g.includes("SOX") || g.includes("PAX") || g.includes("GATA"));
  const hasMetabolic = genes.some(g => g.includes("ATP") || g.includes("COX") || g.includes("PDH"));
  
  const goTerms: EnrichmentResult[] = [];
  const keggTerms: EnrichmentResult[] = [];
  
  if (hasCardiac || genes.length > 0) {
    goTerms.push(
      { term: "GO:0006936 muscle contraction", pValue: 0.00001, adjustedPValue: 0.0001, overlapGenes: genes.slice(0, 3), overlapRatio: "8/45", database: "GO_BP" },
      { term: "GO:0030048 actin filament-based movement", pValue: 0.00005, adjustedPValue: 0.0003, overlapGenes: genes.slice(0, 2), overlapRatio: "5/28", database: "GO_BP" },
      { term: "GO:0003012 muscle system process", pValue: 0.0001, adjustedPValue: 0.0005, overlapGenes: genes.slice(0, 4), overlapRatio: "10/67", database: "GO_BP" },
    );
    keggTerms.push(
      { term: "hsa04260 Cardiac muscle contraction", pValue: 0.00002, adjustedPValue: 0.0002, overlapGenes: genes.slice(0, 3), overlapRatio: "6/32", database: "KEGG" },
      { term: "hsa04261 Adrenergic signaling in cardiomyocytes", pValue: 0.0001, adjustedPValue: 0.0007, overlapGenes: genes.slice(0, 2), overlapRatio: "4/25", database: "KEGG" },
    );
  }
  
  if (hasDevelopment || genes.length > 2) {
    goTerms.push(
      { term: "GO:0007507 heart development", pValue: 0.00008, adjustedPValue: 0.0004, overlapGenes: genes.slice(0, 2), overlapRatio: "6/42", database: "GO_BP" },
      { term: "GO:0048513 animal organ development", pValue: 0.0002, adjustedPValue: 0.0008, overlapGenes: genes.slice(0, 3), overlapRatio: "12/156", database: "GO_BP" },
    );
    keggTerms.push(
      { term: "hsa04350 TGF-beta signaling pathway", pValue: 0.0003, adjustedPValue: 0.001, overlapGenes: genes.slice(0, 2), overlapRatio: "3/18", database: "KEGG" },
    );
  }
  
  if (hasMetabolic || genes.length > 4) {
    goTerms.push(
      { term: "GO:0022900 electron transport chain", pValue: 0.0003, adjustedPValue: 0.001, overlapGenes: genes.slice(0, 2), overlapRatio: "4/35", database: "GO_BP" },
      { term: "GO:0006119 oxidative phosphorylation", pValue: 0.0005, adjustedPValue: 0.002, overlapGenes: genes.slice(0, 3), overlapRatio: "5/48", database: "GO_BP" },
    );
    keggTerms.push(
      { term: "hsa00190 Oxidative phosphorylation", pValue: 0.0004, adjustedPValue: 0.0015, overlapGenes: genes.slice(0, 2), overlapRatio: "4/28", database: "KEGG" },
      { term: "hsa01100 Metabolic pathways", pValue: 0.001, adjustedPValue: 0.003, overlapGenes: genes.slice(0, 4), overlapRatio: "15/245", database: "KEGG" },
    );
  }
  
  // Add generic terms if we have any genes
  if (genes.length > 0) {
    goTerms.push(
      { term: "GO:0005515 protein binding", pValue: 0.001, adjustedPValue: 0.003, overlapGenes: genes.slice(0, 5), overlapRatio: "18/890", database: "GO_MF" },
      { term: "GO:0005737 cytoplasm", pValue: 0.002, adjustedPValue: 0.005, overlapGenes: genes.slice(0, 4), overlapRatio: "15/654", database: "GO_CC" },
    );
  }
  
  return {
    go: goTerms.sort((a, b) => a.pValue - b.pValue),
    kegg: keggTerms.sort((a, b) => a.pValue - b.pValue),
  };
};

export function PathwayEnrichment({ genes, onGeneClick }: PathwayEnrichmentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{ go: EnrichmentResult[]; kegg: EnrichmentResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runEnrichment = async () => {
    if (genes.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Use demo enrichment data
      const enrichmentResults = getDemoEnrichment(genes);
      setResults(enrichmentResults);
    } catch (err) {
      setError("Failed to run enrichment analysis. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPValue = (p: number) => {
    if (p < 0.0001) return p.toExponential(2);
    return p.toFixed(4);
  };

  const getPValueColor = (p: number) => {
    if (p < 0.0001) return "text-red-600 dark:text-red-400";
    if (p < 0.001) return "text-orange-600 dark:text-orange-400";
    if (p < 0.01) return "text-yellow-600 dark:text-yellow-400";
    return "text-muted-foreground";
  };

  if (genes.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 text-center">
        <Search className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-muted-foreground mb-2">No genes selected for enrichment analysis</p>
        <p className="text-xs text-muted-foreground">
          Select genes using the multi-gene search or by drawing a selection on the scatter plot
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Pathway Enrichment Analysis</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {genes.length} gene{genes.length !== 1 ? 's' : ''} selected
          </p>
        </div>
        <Button 
          onClick={runEnrichment} 
          disabled={isLoading || genes.length === 0}
          size="sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            "Run Enrichment"
          )}
        </Button>
      </div>

      {/* Selected genes */}
      <div className="flex flex-wrap gap-1">
        {genes.slice(0, 10).map(gene => (
          <Badge 
            key={gene} 
            variant="secondary" 
            className="text-xs cursor-pointer hover:bg-secondary/80"
            onClick={() => onGeneClick?.(gene)}
          >
            {gene}
          </Badge>
        ))}
        {genes.length > 10 && (
          <Badge variant="outline" className="text-xs">
            +{genes.length - 10} more
          </Badge>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {results && (
        <Tabs defaultValue="go" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="go">
              GO Terms ({results.go.length})
            </TabsTrigger>
            <TabsTrigger value="kegg">
              KEGG Pathways ({results.kegg.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="go">
            <ScrollArea className="h-[300px]">
              {results.go.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  No significant GO terms found
                </p>
              ) : (
                <div className="space-y-2 p-1">
                  {results.go.map((result, idx) => (
                    <div 
                      key={idx}
                      className="p-3 bg-secondary/30 rounded-lg border border-border/50 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {result.term}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            <span className={getPValueColor(result.adjustedPValue)}>
                              p-adj: {formatPValue(result.adjustedPValue)}
                            </span>
                            <span className="text-muted-foreground">
                              {result.overlapRatio}
                            </span>
                            <Badge variant="outline" className="text-xs py-0">
                              {result.database}
                            </Badge>
                          </div>
                        </div>
                        <a 
                          href={`https://www.ebi.ac.uk/QuickGO/term/${result.term.split(' ')[0]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {result.overlapGenes.map(gene => (
                          <Badge 
                            key={gene}
                            variant="default"
                            className="text-xs cursor-pointer"
                            onClick={() => onGeneClick?.(gene)}
                          >
                            {gene}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="kegg">
            <ScrollArea className="h-[300px]">
              {results.kegg.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  No significant KEGG pathways found
                </p>
              ) : (
                <div className="space-y-2 p-1">
                  {results.kegg.map((result, idx) => (
                    <div 
                      key={idx}
                      className="p-3 bg-secondary/30 rounded-lg border border-border/50 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {result.term}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            <span className={getPValueColor(result.adjustedPValue)}>
                              p-adj: {formatPValue(result.adjustedPValue)}
                            </span>
                            <span className="text-muted-foreground">
                              {result.overlapRatio}
                            </span>
                          </div>
                        </div>
                        <a 
                          href={`https://www.genome.jp/entry/${result.term.split(' ')[0]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {result.overlapGenes.map(gene => (
                          <Badge 
                            key={gene}
                            variant="default"
                            className="text-xs cursor-pointer"
                            onClick={() => onGeneClick?.(gene)}
                          >
                            {gene}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Demo enrichment results • In production, connects to Enrichr API
      </p>
    </div>
  );
}
