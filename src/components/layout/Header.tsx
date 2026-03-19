import React, { useState } from "react";
import { Info, Search, MousePointer2, Palette, BarChart3, GitCompareArrows, Play, Presentation } from "lucide-react";
import { Link } from "react-router-dom";
import { DatasetMetadata } from "@/types/singleCell";
import accelBioLogo from "@/assets/AccelBio_logo.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface HeaderProps {
  metadata: DatasetMetadata;
  onStartTour?: () => void;
}

const guideItems = [
  {
    icon: MousePointer2,
    title: "Scatter Plot",
    description:
      "Explore cells in a 2D embedding (e.g. t-SNE / UMAP). Hover over points to see cell details. Use the lasso or box selection tools to select subsets of cells.",
  },
  {
    icon: Search,
    title: "Gene Search",
    description:
      "Type a gene name to colour the scatter plot by its expression level. Use the multi-gene search to compare several genes at once.",
  },
  {
    icon: Palette,
    title: "Colour By & Display Options",
    description:
      "Switch between colouring cells by cluster, gene expression, or other metadata fields. Adjust point size, opacity, and toggle the legend.",
  },
  {
    icon: BarChart3,
    title: "Violin & Dot Plots",
    description:
      "Select one or more genes and view their expression distribution across clusters with violin plots or summarised dot plots.",
  },
  {
    icon: GitCompareArrows,
    title: "Differential Expression",
    description:
      "After selecting cells with the lasso tool, run a differential expression analysis to find marker genes for the selected population.",
  },
];

export function Header({ metadata, onStartTour }: HeaderProps) {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <header className="border-b border-border bg-card" data-tour="header">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={accelBioLogo}
              alt="AccelBio Logo"
              className="h-12 w-auto"
            />

            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-lg font-bold text-muted-foreground">
                Single-Cell Explorer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6">
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground">
                  {metadata.cellCount.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Cells</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground">
                  {metadata.geneCount.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Genes</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground">
                  {metadata.clusterCount}
                </div>
                <div className="text-xs text-muted-foreground">Clusters</div>
              </div>
            </div>

            <Link
              to="/showcase"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent-foreground text-sm font-medium transition-colors"
              title="Feature showcase"
            >
              <Presentation className="h-3.5 w-3.5" />
              Showcase
            </Link>

            {onStartTour && (
              <button
                onClick={onStartTour}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
                title="Start guided tour"
              >
                <Play className="h-3.5 w-3.5" />
                Tour
              </button>
            )}

            <button
              onClick={() => setGuideOpen(true)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <Info className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>How to use the Explorer</DialogTitle>
            <DialogDescription>
              A quick guide to the main features of the single-cell explorer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {guideItems.map((item) => (
              <div key={item.title} className="flex gap-3">
                <div className="mt-0.5 shrink-0 rounded-md bg-primary/10 p-2">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {item.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
