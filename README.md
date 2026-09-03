# Single-Cell RNA-seq Explorer

An interactive web portal for exploring and visualizing single-cell RNA sequencing (scRNA-seq) data. Built with React, TypeScript, and modern visualization libraries.

🔗 **Live Demo:** [accelbio-single-cell-explorer.lovable.app](https://accelbio-single-cell-explorer.lovable.app)

## Features

### Visualization
- **Dual UMAP/tSNE Plots**: Side-by-side scatter plots for comparing metadata annotations and gene expression
- **Metadata Annotation Plot**: Color cells by cluster, cell type, sample, or any categorical metadata
- **Gene Expression Overlay**: Visualize expression levels across cells with continuous color gradients
- **Interactive Controls**: Zoom, pan, lasso selection, and rectangular selection tools

### Analysis Tools
- **Violin Plots**: Distribution of gene expression across clusters with KDE overlay
- **Feature Plots**: Bar charts showing mean expression and percentage of expressing cells per cluster
- **Dot Plots**: Multi-gene expression comparison across clusters (size = % expressing, color = mean expression)
- **Differential Expression Table**: Sortable, filterable table of marker genes per cluster
- **Pathway Enrichment**: GO term and pathway analysis for selected genes
- **Trajectory Analysis**: Pseudotime visualization for developmental lineages with branching paths

### Data Handling
- **Cell Filtering**: Subset cells by sample, cluster, or other metadata
- **Bundled Dataset**: A pre-processed heart organoid dataset loads automatically (progressive loading with a cancellable progress indicator)
- **Explicit "not detected" state**: Genes absent from the expression matrix are reported as not detected (zeroed plots, tooltips say "not detected") — values are never invented

> Datasets can be swapped at runtime on the **/dataset-swap** page: upload a Seurat/Scanpy JSON
> (parsed in your browser, session-only) or register hosted `dataset_core.json` /
> `dataset_expression.msgpack` URLs. Changing the *default* dataset is still a build-time edit.


## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd accelbio-single-cell-explorer

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Data Format

### Swapping in your own dataset

Use **/dataset-swap** for ad-hoc swaps (upload or URL). To change the shipped default, export
your Seurat/Scanpy object to the JSON format below, then split and compress it for the browser:



```bash
python scripts/compress_dataset.py my_dataset.json public/
# -> public/dataset_core.json (small, loaded first)
# -> public/dataset_expression.msgpack (sparse expression, streamed in background)
```

Set the URLs in `src/lib/datasetConfig.ts` if you host the files elsewhere. Both files are
downloaded and decoded in a Web Worker (`src/workers/datasetWorker.ts`) with a progress bar,
so the dashboard stays responsive. Full step-by-step guide: [DATASET.md](./DATASET.md).
The expected input format:



```json
{
  "metadata": {
    "name": "Dataset Name",
    "description": "Dataset description",
    "cellCount": 10000,
    "geneCount": 5000,
    "clusterCount": 10,
    "organism": "Homo sapiens",
    "tissue": "Heart"
  },
  "cells": [
    {
      "id": "cell_1",
      "x": 1.23,
      "y": -4.56,
      "cluster": 0,
      "metadata": {
        "cell_type": "Cardiomyocyte",
        "sample": "Sample_1",
        "nCount_RNA": 15000
      }
    }
  ],
  "genes": ["GENE1", "GENE2", "..."],
  "clusters": [
    {
      "id": 0,
      "name": "Cardiomyocytes",
      "color": "rgb(52, 152, 165)"
    }
  ],
  "expression": {
    "GENE1": {
      "cell_1": 2.5,
      "cell_2": 0.0
    }
  },
  "annotationOptions": ["cell_type", "sample"]
}
```

### R Export Script

A Seurat export template lives in the repository (not downloadable from the app):

```r
Rscript scripts/SC_dashboard_export_template.R seurat_object.rds output.json
```

## Technology Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Scatter Plots**: Canvas-based with deck.gl
- **State Management**: React hooks
- **Search**: Fuse.js for fuzzy gene search
- **Expression storage**: sparse typed arrays decoded from MessagePack

## QA instrumentation

Dataset download and decode phases are timed and logged to the browser console
(`[perf] …`), including used/peak JS heap where the browser exposes it
(`src/lib/perf.ts`). Use these logs to catch hangs or memory blow-ups.

## Project Structure

```
src/
├── components/
│   ├── controls/      # Gene search, filters, settings
│   ├── layout/        # Header, navigation
│   ├── plots/         # Violin, Feature, Dot plots
│   ├── scatter/       # UMAP scatter plot components
│   └── table/         # Differential expression table
├── data/              # Fallback demo data generation
├── lib/               # Dataset loading, sparse matrix, perf instrumentation
├── pages/             # Page components
└── types/             # TypeScript interfaces
```


## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is proprietary software developed by AccelBio.

---

**Powered by [AccelBio](https://accelbio.pt/)**
