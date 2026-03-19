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
- **JSON Data Import**: Upload your own datasets exported from Seurat/Scanpy
- **R Export Script**: Downloadable template script for exporting Seurat objects
- **Cell Filtering**: Subset cells by sample, cluster, or other metadata
- **Demo Dataset**: Pre-loaded developmental heart data for exploration

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

### Uploading Custom Data

Export your Seurat or Scanpy object to JSON using the provided R template script. The expected format:

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

Download the R export template from the app to convert your Seurat object:

```r
Rscript export_template.R seurat_object.rds output.json
```

## Technology Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Scatter Plots**: Canvas-based with deck.gl
- **State Management**: React hooks
- **Search**: Fuse.js for fuzzy gene search

## Project Structure

```
src/
├── components/
│   ├── controls/      # Gene search, filters, settings
│   ├── layout/        # Header, navigation
│   ├── plots/         # Violin, Feature, Dot plots
│   ├── scatter/       # UMAP scatter plot components
│   ├── table/         # Differential expression table
│   └── upload/        # Dataset uploader
├── data/              # Demo data generation
├── lib/               # Utility functions
├── pages/             # Page components
└── types/             # TypeScript interfaces
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is proprietary software developed by AccelBio.

---

**Powered by [AccelBio](https://accelbio.pt/)**
