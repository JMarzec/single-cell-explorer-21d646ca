import React from "react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import accelBioLogo from "@/assets/AccelBio_logo.png";
import {
  MousePointer2,
  Search,
  BarChart3,
  GitCompareArrows,
  Layers,
  Palette,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Animated section wrapper                                           */
/* ------------------------------------------------------------------ */
function RevealSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, isVisible } = useScrollReveal(0.12);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-12"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature card with screenshot placeholder                           */
/* ------------------------------------------------------------------ */
interface FeatureSection {
  icon: React.ElementType;
  id: string;
  title: string;
  description: string;
  details: string[];
  screenshotAlt: string;
  imageUrl: string;
  reverse?: boolean;
}

const features: FeatureSection[] = [
  {
    icon: MousePointer2,
    id: "scatter",
    title: "Interactive Scatter Plot",
    description:
      "Explore thousands of cells in a 2D t-SNE or UMAP embedding. Each point is a cell — hover for details, lasso-select subsets, and zoom with the scroll wheel.",
    details: [
      "Pan & zoom with mouse or trackpad",
      "Lasso and rectangle selection tools",
      "Cluster labels with automatic positioning",
      "Export plot as SVG or PNG",
    ],
    screenshotAlt: "Scatter plot showing cell clusters",
    imageUrl: "/showcase/scatter.png",
  },
  {
    icon: Search,
    id: "gene-search",
    title: "Gene Expression Search",
    description:
      "Type any gene name to instantly overlay its expression on the scatter plot. The colour gradient highlights where the gene is expressed across all clusters.",
    details: [
      "Fuzzy search across 900+ genes",
      "Real-time expression overlay",
      "Adjustable colour scale & percentile clipping",
      "Multi-gene comparison mode",
    ],
    screenshotAlt: "Gene expression overlay on scatter plot",
    imageUrl: "/showcase/gene-search.png",
    reverse: true,
  },
  {
    icon: BarChart3,
    id: "plots",
    title: "Violin & Dot Plots",
    description:
      "Compare gene expression distributions across clusters with publication-ready violin plots, feature plots, and dot plots.",
    details: [
      "Violin plots with box-plot overlays",
      "Dot plots showing percent expressing & mean",
      "Feature bar charts per cluster",
      "Select multiple genes at once",
    ],
    screenshotAlt: "Violin and dot plot analysis",
    imageUrl: "/showcase/plots.png",
  },
  {
    icon: GitCompareArrows,
    id: "de",
    title: "Differential Expression",
    description:
      "Select a group of cells and instantly find their marker genes. Sort by log-fold change or adjusted p-value to identify the most significant differences.",
    details: [
      "Lasso-select cells to define groups",
      "Sortable results table",
      "Search & filter genes",
      "Paginated results for large datasets",
    ],
    screenshotAlt: "Differential expression analysis table",
    imageUrl: "/showcase/de-table.png",
    reverse: true,
  },
  {
    icon: Palette,
    id: "display",
    title: "Display Customisation",
    description:
      "Fine-tune the visualisation with adjustable point size, expression scale, percentile clipping, and toggle cluster labels or legend visibility.",
    details: [
      "Point size & opacity sliders",
      "Expression colour scale control",
      "Percentile clipping for outlier handling",
      "Toggle clusters, labels, and legends",
    ],
    screenshotAlt: "Display options panel",
    imageUrl: "/showcase/display.png",
  },
  {
    icon: Layers,
    id: "upload",
    title: "Upload Your Own Data",
    description:
      "Bring your own single-cell dataset in JSON format. The explorer instantly loads your data — no server required, everything runs in the browser.",
    details: [
      "JSON format with embeddings & expression",
      "Client-side processing — no data leaves your machine",
      "Automatic cluster detection",
      "Works with any t-SNE / UMAP output",
    ],
    screenshotAlt: "Dataset upload interface",
    imageUrl: "/showcase/upload.png",
    reverse: true,
  },
];

/* ------------------------------------------------------------------ */
/*  Stat counter                                                       */
/* ------------------------------------------------------------------ */
function StatCounter({ value, label }: { value: string; label: string }) {
  const { ref, isVisible } = useScrollReveal(0.3);

  return (
    <div ref={ref} className="text-center">
      <div
        className={`text-4xl md:text-5xl font-bold text-primary transition-all duration-700 ${
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
      >
        {value}
      </div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function Showcase() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={accelBioLogo} alt="AccelBio" className="h-10 w-auto" />
            <span className="font-semibold text-foreground">
              Single-Cell Explorer
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4">
              {features.map((f) => (
                <a
                  key={f.id}
                  href={`#${f.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(f.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {f.title}
                </a>
              ))}
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Open Explorer
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-brand opacity-[0.07]" />
        <div className="container mx-auto px-4 py-24 md:py-36 text-center relative">
          <RevealSection>
            <p className="text-sm font-medium tracking-widest uppercase text-primary mb-4">
              Browser-Based Single-Cell Analysis
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl mx-auto">
              Explore your single-cell data{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                interactively
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
              Visualise t-SNE & UMAP embeddings, search genes, compare
              expression across clusters, and run differential expression — all
              in your browser.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-lg"
              >
                Try it now
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </RevealSection>

          <div className="mt-12 max-w-5xl mx-auto">
            <div className="rounded-xl overflow-hidden shadow-2xl border border-border ring-1 ring-primary/10">
              <img
                src="/showcase/dashboard-hero.png"
                alt="Single-Cell Explorer full dashboard showing scatter plots, cell type legend, and analysis controls"
                className="w-full h-auto"
                loading="eager"
              />
            </div>
          </div>

          <div className="mt-8 animate-bounce text-muted-foreground">
            <ChevronDown className="h-6 w-6 mx-auto" />
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-border bg-card">
        <div className="container mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCounter value="19,024" label="Cells in demo dataset" />
          <StatCounter value="926" label="Genes available" />
          <StatCounter value="9" label="Cell clusters" />
          <StatCounter value="0 s" label="Server setup needed" />
        </div>
      </section>

      {/* ── Features ── */}
      <section className="container mx-auto px-4 py-20 space-y-32">
        {features.map((feat, i) => (
          <div
            id={feat.id}
            key={feat.title}
            style={{ scrollMarginTop: "5rem" }}
            className={`flex flex-col ${
              feat.reverse ? "lg:flex-row-reverse" : "lg:flex-row"
            } items-center gap-12 lg:gap-20`}
          >
            {/* Screenshot / placeholder */}
            <RevealSection className="flex-1 w-full" delay={100}>
              <div className="rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 flex items-center gap-2 border-b border-border">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-accent/60" />
                  <div className="w-3 h-3 rounded-full bg-primary/40" />
                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                    Single-Cell Explorer
                  </span>
                </div>
                <div className="aspect-video bg-muted/30 overflow-hidden">
                  <img
                    src={feat.imageUrl}
                    alt={feat.screenshotAlt}
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
              </div>
            </RevealSection>

            {/* Text */}
            <RevealSection className="flex-1 w-full" delay={250}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <feat.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Feature {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                {feat.title}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                {feat.description}
              </p>
              <ul className="space-y-2">
                {feat.details.map((d) => (
                  <li
                    key={d}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </RevealSection>
          </div>
        ))}
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-border">
        <div className="container mx-auto px-4 py-20 text-center">
          <RevealSection>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to explore?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8">
              No installation, no sign-up. Load the demo dataset or upload your
              own — start analysing in seconds.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-lg"
            >
              Launch Explorer
              <ArrowRight className="h-4 w-4" />
            </Link>
          </RevealSection>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          Single-Cell Explorer • Powered by{" "}
          <a
            href="https://accelbio.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            AccelBio
          </a>
        </div>
      </footer>
    </div>
  );
}
