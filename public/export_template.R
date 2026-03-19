#!/usr/bin/env Rscript
# ============================================================================
# Single-Cell RNA-seq Data Export Template for AccelBio Portal
# ============================================================================
# 
# This script exports Seurat or SingleCellExperiment objects to JSON format
# compatible with the AccelBio single-cell data portal.
#
# Usage:
#   Rscript export_template.R --input your_data.rds --output portal_data.json
#
# Or source in R/RStudio and call the export functions directly.
# ============================================================================

suppressPackageStartupMessages({
  library(jsonlite)
})

# ============================================================================
# MAIN EXPORT FUNCTION
# ============================================================================

#' Export single-cell data to portal-compatible JSON
#'
#' @param object A Seurat or SingleCellExperiment object
#' @param output_path Path for the output JSON file
#' @param reduction Name of the dimensionality reduction to use (default: "umap")
#' @param cluster_col Name of the metadata column containing cluster assignments
#' @param include_de Whether to include differential expression results
#' @param de_results Optional pre-computed DE results (data.frame)
#' @param metadata_cols Character vector of metadata columns to include
#' @param max_genes Maximum number of genes to include (for performance)
#' @param include_expression Whether to include gene expression matrix
#' @param expression_genes Genes to include in expression matrix (NULL = use variable features)
#' @param max_expression_genes Maximum genes for expression export (default: 500)
#' @return Invisibly returns the exported data list
#'
export_for_portal <- function(
  object,
  output_path,
  reduction = "umap",
  cluster_col = "seurat_clusters",
  include_de = TRUE,
  de_results = NULL,
  metadata_cols = c("nCount_RNA", "nFeature_RNA", "percent.mt", "cell_type", "sample"),
  max_genes = 5000,
  include_expression = TRUE,
  expression_genes = NULL,
  max_expression_genes = 500
) {
  
  cat("Starting export for AccelBio Portal...\n")
  
  # Detect object type
  obj_type <- detect_object_type(object)
  cat(sprintf("Detected object type: %s\n", obj_type))
  
  # Extract data based on object type
  if (obj_type == "Seurat") {
    export_data <- extract_seurat_data(
      object, reduction, cluster_col, metadata_cols, max_genes,
      include_expression, expression_genes, max_expression_genes
    )
  } else if (obj_type == "SingleCellExperiment") {
    export_data <- extract_sce_data(
      object, reduction, cluster_col, metadata_cols, max_genes,
      include_expression, expression_genes, max_expression_genes
    )
  } else {
    stop("Unsupported object type. Please provide a Seurat or SingleCellExperiment object.")
  }
  
  # Add differential expression if requested
  if (include_de) {
    if (!is.null(de_results)) {
      export_data$differentialExpression <- format_de_results(de_results)
    } else {
      cat("Computing differential expression (this may take a while)...\n")
      export_data$differentialExpression <- compute_de(object, obj_type, cluster_col)
    }
  }
  
  # Write JSON
  cat(sprintf("Writing to %s...\n", output_path))
  write_json(
    export_data, 
    output_path, 
    auto_unbox = TRUE, 
    pretty = TRUE,
    digits = 4
  )
  
  expr_count <- if (!is.null(export_data$expression)) length(export_data$expression) else 0
  
  cat(sprintf(
    "Export complete!\n  Cells: %d\n  Clusters: %d\n  Genes (list): %d\n  Expression genes: %d\n",
    length(export_data$cells),
    length(export_data$clusters),
    length(export_data$genes),
    expr_count
  ))
  
  invisible(export_data)
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

detect_object_type <- function(object) {
  if (inherits(object, "Seurat")) {
    return("Seurat")
  } else if (inherits(object, "SingleCellExperiment")) {
    return("SingleCellExperiment")
  } else {
    return("Unknown")
  }
}

#' Extract expression matrix for specified genes
#' @param expr_matrix Expression matrix (genes x cells)
#' @param genes Genes to extract
#' @param cell_names Cell identifiers
#' @return Named list: gene -> (cell_id -> expression value)
extract_expression_matrix <- function(expr_matrix, genes, cell_names) {
  
  cat(sprintf("Extracting expression for %d genes...\n", length(genes)))
  
  # Filter to genes present in matrix
  available_genes <- intersect(genes, rownames(expr_matrix))
  if (length(available_genes) == 0) {
    warning("No requested genes found in expression matrix")
    return(list())
  }
  
  if (length(available_genes) < length(genes)) {
    cat(sprintf("  Note: %d of %d genes found in matrix\n", 
                length(available_genes), length(genes)))
  }
  
  # Extract and format expression data
  expression <- list()
  
  for (gene in available_genes) {
    # Get expression values for this gene
    gene_expr <- expr_matrix[gene, ]
    
    # Convert to named list (cell_id -> value)
    # Only include non-zero values to reduce file size
    non_zero_idx <- which(gene_expr > 0)
    
    if (length(non_zero_idx) > 0) {
      expr_values <- as.list(gene_expr[non_zero_idx])
      names(expr_values) <- cell_names[non_zero_idx]
      expression[[gene]] <- expr_values
    } else {
      # Include empty object for genes with no expression
      expression[[gene]] <- list()
    }
    
    # Progress indicator for large exports
    if (which(available_genes == gene) %% 100 == 0) {
      cat(sprintf("  Processed %d / %d genes\n", 
                  which(available_genes == gene), length(available_genes)))
    }
  }
  
  return(expression)
}

#' Extract data from Seurat object
extract_seurat_data <- function(
  object, reduction, cluster_col, metadata_cols, max_genes,
  include_expression, expression_genes, max_expression_genes
) {
  
  # Check if Seurat is available
  if (!requireNamespace("Seurat", quietly = TRUE)) {
    stop("Seurat package is required but not installed.")
  }
  
  # Get embeddings
  if (!reduction %in% names(object@reductions)) {
    available <- names(object@reductions)
    stop(sprintf(
      "Reduction '%s' not found. Available: %s",
      reduction, paste(available, collapse = ", ")
    ))
  }
  
  embeddings <- Seurat::Embeddings(object, reduction = reduction)
  
  # Get clusters
  if (!cluster_col %in% colnames(object@meta.data)) {
    stop(sprintf("Cluster column '%s' not found in metadata.", cluster_col))
  }
  clusters <- object@meta.data[[cluster_col]]
  
  # Get metadata - include all available columns from the requested list
  meta_available <- intersect(metadata_cols, colnames(object@meta.data))
  metadata_df <- object@meta.data[, meta_available, drop = FALSE]
  
  # Identify string columns for annotation options
  annotation_options <- character(0)
  for (col in meta_available) {
    col_data <- metadata_df[[col]]
    if (is.character(col_data) || is.factor(col_data)) {
      annotation_options <- c(annotation_options, col)
    }
  }
  
  # Format cells
  cell_names <- colnames(object)
  cells <- lapply(seq_len(ncol(object)), function(i) {
    meta_list <- as.list(metadata_df[i, ])
    # Convert factors to character
    meta_list <- lapply(meta_list, function(x) {
      if (is.factor(x)) as.character(x) else x
    })
    list(
      id = cell_names[i],
      x = unname(embeddings[i, 1]),
      y = unname(embeddings[i, 2]),
      cluster = as.integer(clusters[i]) - 1L,  # 0-indexed
      metadata = meta_list
    )
  })
  
  # Get cluster info
  cluster_ids <- sort(unique(as.integer(clusters)))
  cluster_colors <- generate_cluster_colors(length(cluster_ids))
  
  # Try to get cluster names from cell_type if available
  cluster_names <- NULL
  if ("cell_type" %in% colnames(object@meta.data)) {
    # Map cluster to most common cell_type
    cluster_names <- sapply(cluster_ids, function(cid) {
      cell_types <- object@meta.data$cell_type[as.integer(clusters) == cid]
      if (length(cell_types) > 0) {
        names(sort(table(cell_types), decreasing = TRUE))[1]
      } else {
        sprintf("Cluster %d", cid)
      }
    })
  }
  
  cluster_info <- lapply(seq_along(cluster_ids), function(i) {
    id <- cluster_ids[i]
    list(
      id = id - 1L,  # 0-indexed
      name = if (!is.null(cluster_names)) cluster_names[i] else sprintf("Cluster %d", id),
      cellCount = sum(as.integer(clusters) == id),
      color = cluster_colors[i]
    )
  })
  
  # Get variable genes (limited for performance)
  var_features <- character(0)
  if ("RNA" %in% names(object@assays)) {
    var_features <- Seurat::VariableFeatures(object)
    if (length(var_features) == 0) {
      genes <- head(rownames(object), max_genes)
    } else {
      genes <- head(var_features, max_genes)
    }
  } else {
    genes <- head(rownames(object), max_genes)
  }
  
  # Extract expression matrix if requested
  expression <- NULL
  if (include_expression) {
    # Determine which genes to export expression for
    if (!is.null(expression_genes)) {
      expr_genes <- expression_genes
    } else if (length(var_features) > 0) {
      expr_genes <- head(var_features, max_expression_genes)
    } else {
      expr_genes <- head(rownames(object), max_expression_genes)
    }
    
    # Get normalized expression data
    expr_matrix <- tryCatch({
      Seurat::GetAssayData(object, slot = "data", assay = "RNA")
    }, error = function(e) {
      Seurat::GetAssayData(object, layer = "data", assay = "RNA")
    })
    
    expression <- extract_expression_matrix(
      as.matrix(expr_matrix[intersect(expr_genes, rownames(expr_matrix)), ]),
      expr_genes,
      cell_names
    )
  }
  
  # Build export object
  result <- list(
    metadata = list(
      name = "Exported Dataset",
      description = sprintf("Seurat object exported for portal visualization (%s reduction)", reduction),
      cellCount = ncol(object),
      geneCount = length(genes),
      clusterCount = length(cluster_ids),
      source = "Seurat export"
    ),
    cells = cells,
    genes = genes,
    clusters = cluster_info,
    differentialExpression = list(),
    annotationOptions = annotation_options
  )
  
  if (!is.null(expression) && length(expression) > 0) {
    result$expression <- expression
  }
  
  return(result)
}

#' Extract data from SingleCellExperiment object
extract_sce_data <- function(
  object, reduction, cluster_col, metadata_cols, max_genes,
  include_expression, expression_genes, max_expression_genes
) {
  
  if (!requireNamespace("SingleCellExperiment", quietly = TRUE)) {
    stop("SingleCellExperiment package is required but not installed.")
  }
  
  # Get embeddings
  red_names <- SingleCellExperiment::reducedDimNames(object)
  reduction_upper <- toupper(reduction)
  
  if (!reduction_upper %in% red_names) {
    stop(sprintf(
      "Reduction '%s' not found. Available: %s",
      reduction, paste(red_names, collapse = ", ")
    ))
  }
  
  embeddings <- SingleCellExperiment::reducedDim(object, reduction_upper)
  
  # Get clusters
  col_data <- SummarizedExperiment::colData(object)
  if (!cluster_col %in% colnames(col_data)) {
    stop(sprintf("Cluster column '%s' not found in colData.", cluster_col))
  }
  clusters <- col_data[[cluster_col]]
  
  # Get metadata
  meta_available <- intersect(metadata_cols, colnames(col_data))
  metadata_df <- as.data.frame(col_data[, meta_available, drop = FALSE])
  
  # Identify string columns for annotation options
  annotation_options <- character(0)
  for (col in meta_available) {
    col_data_col <- metadata_df[[col]]
    if (is.character(col_data_col) || is.factor(col_data_col)) {
      annotation_options <- c(annotation_options, col)
    }
  }
  
  # Format cells
  cell_names <- colnames(object)
  cells <- lapply(seq_len(ncol(object)), function(i) {
    meta_list <- as.list(metadata_df[i, ])
    meta_list <- lapply(meta_list, function(x) {
      if (is.factor(x)) as.character(x) else x
    })
    list(
      id = cell_names[i],
      x = unname(embeddings[i, 1]),
      y = unname(embeddings[i, 2]),
      cluster = as.integer(factor(clusters[i])) - 1L,
      metadata = meta_list
    )
  })
  
  # Get cluster info
  unique_clusters <- sort(unique(clusters))
  cluster_colors <- generate_cluster_colors(length(unique_clusters))
  
  cluster_info <- lapply(seq_along(unique_clusters), function(i) {
    cl <- unique_clusters[i]
    list(
      id = i - 1L,
      name = as.character(cl),
      cellCount = sum(clusters == cl),
      color = cluster_colors[i]
    )
  })
  
  # Get genes
  genes <- head(rownames(object), max_genes)
  
  # Extract expression matrix if requested
  expression <- NULL
  if (include_expression) {
    if (!is.null(expression_genes)) {
      expr_genes <- expression_genes
    } else {
      expr_genes <- head(rownames(object), max_expression_genes)
    }
    
    # Get logcounts or normalized expression
    expr_matrix <- tryCatch({
      SummarizedExperiment::assay(object, "logcounts")
    }, error = function(e) {
      SummarizedExperiment::assay(object, "counts")
    })
    
    expression <- extract_expression_matrix(
      as.matrix(expr_matrix[intersect(expr_genes, rownames(expr_matrix)), ]),
      expr_genes,
      cell_names
    )
  }
  
  result <- list(
    metadata = list(
      name = "Exported Dataset",
      description = sprintf("SingleCellExperiment exported for portal (%s reduction)", reduction),
      cellCount = ncol(object),
      geneCount = length(genes),
      clusterCount = length(unique_clusters),
      source = "SCE export"
    ),
    cells = cells,
    genes = genes,
    clusters = cluster_info,
    differentialExpression = list(),
    annotationOptions = annotation_options
  )
  
  if (!is.null(expression) && length(expression) > 0) {
    result$expression <- expression
  }
  
  return(result)
}

#' Generate cluster colors
generate_cluster_colors <- function(n) {
  # Distinct color palette
  base_colors <- c(
    "rgb(52, 152, 165)",   # teal
    "rgb(215, 95, 130)",   # pink
    "rgb(210, 180, 60)",   # gold
    "rgb(90, 165, 110)",   # green
    "rgb(165, 105, 180)",  # purple
    "rgb(215, 130, 65)",   # orange
    "rgb(75, 170, 155)",   # teal-green
    "rgb(190, 100, 165)",  # magenta
    "rgb(130, 170, 85)",   # lime
    "rgb(100, 140, 200)"   # blue
  )
  
  if (n <= length(base_colors)) {
    return(base_colors[1:n])
  }
  
  # Generate additional colors if needed
  hues <- seq(0, 360, length.out = n + 1)[1:n]
  additional <- sprintf("hsl(%d, 70%%, 50%%)", round(hues))
  return(additional)
}

#' Compute differential expression
compute_de <- function(object, obj_type, cluster_col) {
  
  if (obj_type == "Seurat") {
    if (!requireNamespace("Seurat", quietly = TRUE)) {
      return(list())
    }
    
    # Set identity
    Seurat::Idents(object) <- cluster_col
    
    # Find markers for all clusters
    markers <- tryCatch({
      Seurat::FindAllMarkers(
        object,
        only.pos = TRUE,
        min.pct = 0.25,
        logfc.threshold = 0.25,
        max.cells.per.ident = 500  # Speed up computation
      )
    }, error = function(e) {
      warning("Failed to compute DE: ", e$message)
      return(NULL)
    })
    
    if (is.null(markers) || nrow(markers) == 0) {
      return(list())
    }
    
    # Format results
    lapply(seq_len(nrow(markers)), function(i) {
      list(
        gene = markers$gene[i],
        cluster = sprintf("Cl_%s", markers$cluster[i]),
        logFC = markers$avg_log2FC[i],
        pValue = markers$p_val[i],
        pAdj = markers$p_val_adj[i]
      )
    })
    
  } else {
    # For SCE, return empty (user can provide pre-computed)
    warning("Automatic DE computation not implemented for SCE. Please provide de_results.")
    return(list())
  }
}

#' Format pre-computed DE results
format_de_results <- function(de_df) {
  
  required_cols <- c("gene", "cluster", "logFC")
  if (!all(required_cols %in% colnames(de_df))) {
    stop("DE results must contain columns: gene, cluster, logFC")
  }
  
  lapply(seq_len(nrow(de_df)), function(i) {
    list(
      gene = de_df$gene[i],
      cluster = de_df$cluster[i],
      logFC = de_df$logFC[i],
      pValue = if ("pValue" %in% colnames(de_df)) de_df$pValue[i] else de_df$p_val[i],
      pAdj = if ("pAdj" %in% colnames(de_df)) de_df$pAdj[i] else de_df$p_val_adj[i]
    )
  })
}


# ============================================================================
# COMMAND LINE INTERFACE
# ============================================================================

if (!interactive()) {
  args <- commandArgs(trailingOnly = TRUE)
  
  if (length(args) < 2) {
    cat("Usage: Rscript export_template.R --input data.rds --output output.json\n")
    cat("\nOptions:\n")
    cat("  --input           Input RDS file (Seurat or SCE object)\n")
    cat("  --output          Output JSON file path\n")
    cat("  --reduction       Dimensionality reduction to use (default: umap)\n")
    cat("  --clusters        Metadata column with cluster info (default: seurat_clusters)\n")
    cat("  --no-expression   Skip expression matrix export\n")
    cat("  --max-expr-genes  Max genes for expression export (default: 500)\n")
    quit(status = 1)
  }
  
  # Parse arguments
  input_file <- NULL
  output_file <- NULL
  reduction <- "umap"
  cluster_col <- "seurat_clusters"
  include_expression <- TRUE
  max_expression_genes <- 500
  
  i <- 1
  while (i <= length(args)) {
    if (args[i] == "--input") {
      input_file <- args[i + 1]
      i <- i + 2
    } else if (args[i] == "--output") {
      output_file <- args[i + 1]
      i <- i + 2
    } else if (args[i] == "--reduction") {
      reduction <- args[i + 1]
      i <- i + 2
    } else if (args[i] == "--clusters") {
      cluster_col <- args[i + 1]
      i <- i + 2
    } else if (args[i] == "--no-expression") {
      include_expression <- FALSE
      i <- i + 1
    } else if (args[i] == "--max-expr-genes") {
      max_expression_genes <- as.integer(args[i + 1])
      i <- i + 2
    } else {
      i <- i + 1
    }
  }
  
  if (is.null(input_file) || is.null(output_file)) {
    stop("Both --input and --output are required")
  }
  
  # Load and export
  cat(sprintf("Loading %s...\n", input_file))
  object <- readRDS(input_file)
  
  export_for_portal(
    object,
    output_file,
    reduction = reduction,
    cluster_col = cluster_col,
    include_expression = include_expression,
    max_expression_genes = max_expression_genes
  )
}


# ============================================================================
# EXAMPLE USAGE (in R/RStudio)
# ============================================================================

# # Load your Seurat object
# library(Seurat)
# seurat_obj <- readRDS("my_data.rds")
#
# # Basic export (includes expression for top 500 variable genes)
# export_for_portal(seurat_obj, "portal_data.json")
#
# # With custom options
# export_for_portal(
#   seurat_obj,
#   "portal_data.json",
#   reduction = "tsne",
#   cluster_col = "cell_type",
#   metadata_cols = c("nCount_RNA", "sample", "cell_type", "condition")
# )
#
# # Export with specific genes
# export_for_portal(
#   seurat_obj,
#   "portal_data.json",
#   expression_genes = c("MYH7", "TNNT2", "EMCN", "COL1A1"),  # Your genes of interest
#   max_expression_genes = 1000  # Allow more genes
# )
#
# # Skip expression to reduce file size
# export_for_portal(
#   seurat_obj,
#   "portal_data.json",
#   include_expression = FALSE
# )
#
# # With pre-computed DE results
# my_de <- FindAllMarkers(seurat_obj)
# export_for_portal(seurat_obj, "portal_data.json", de_results = my_de)
#
# # JSON structure exported:
# # {
# #   "metadata": { "name": "...", "cellCount": ..., ... },
# #   "cells": [{ "id": "cell_1", "x": 1.5, "y": -2.3, "cluster": 0, "metadata": {...} }, ...],
# #   "genes": ["GENE1", "GENE2", ...],
# #   "clusters": [{ "id": 0, "name": "Cluster 0", "cellCount": 500, "color": "rgb(...)" }, ...],
# #   "differentialExpression": [{ "gene": "...", "cluster": "...", "logFC": ..., ... }, ...],
# #   "expression": {
# #     "GENE1": { "cell_1": 2.5, "cell_3": 1.2, ... },
# #     "GENE2": { "cell_2": 0.8, ... },
# #     ...
# #   },
# #   "annotationOptions": ["cell_type", "sample"]
# # }
