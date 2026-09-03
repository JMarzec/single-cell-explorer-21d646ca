# Loading your own dataset (Seurat / Scanpy)

Step-by-step guide to replace the built-in dataset with your own cells and genes.

The app reads **two files**:

| File | Contents | Format |
| --- | --- | --- |
| `dataset_core.json` | cells, tSNE/UMAP coordinates, metadata, clusters, gene list, DE results | JSON (a few MB) |
| `dataset_expression.msgpack` | sparse gene × cell expression matrix | MessagePack (typically 50–400 MB) |

Both are downloaded and decoded in a Web Worker with a progress bar, so the dashboard stays responsive.

---

## Step 1 — Export a single JSON from R or Python

### Seurat (R)

Use `scripts/SC_dashboard_export_template.R`, or export manually:

```r
library(Seurat); library(jsonlite)
emb <- Embeddings(obj, "umap")
cells <- lapply(seq_len(ncol(obj)), function(i) list(
  id      = colnames(obj)[i],
  x       = emb[i, 1],
  y       = emb[i, 2],
  cluster = as.integer(as.character(Idents(obj)[i])),
  metadata = list(
    cell_type = as.character(obj$cell_type[i]),
    sample    = as.character(obj$orig.ident[i])
  )
))
expr <- as.matrix(GetAssayData(obj, slot = "data"))          # genes x cells
write_json(list(
  metadata = list(name = "My dataset", organism = "Homo sapiens", tissue = "Heart"),
  cells    = cells,
  genes    = rownames(expr),
  clusters = lapply(levels(Idents(obj)), function(cl) list(name = cl)),
  expression = apply(expr, 1, function(v) as.list(setNames(v, colnames(expr)))),
  differentialExpression = list()   # optional: gene, cluster, logFC, pValue, pAdj
), "my_dataset.json", auto_unbox = TRUE, digits = 3)
```

### Scanpy (Python)

```python
import json, numpy as np, scanpy as sc
ad = sc.read_h5ad("my_data.h5ad")
X = ad.X.toarray() if hasattr(ad.X, "toarray") else np.asarray(ad.X)
emb = ad.obsm["X_umap"]

data = {
  "metadata": {"name": "My dataset", "organism": "Homo sapiens"},
  "cells": [{
      "id": str(bc), "x": float(emb[i, 0]), "y": float(emb[i, 1]),
      "cluster": int(ad.obs["leiden"].cat.codes[i]),
      "metadata": {"cell_type": str(ad.obs["cell_type"][i]),
                   "sample": str(ad.obs.get("sample", ["NA"] * ad.n_obs)[i])},
  } for i, bc in enumerate(ad.obs_names)],
  "genes": [str(g) for g in ad.var_names],
  "clusters": [{"name": c} for c in ad.obs["leiden"].cat.categories],
  "expression": {str(g): {str(b): round(float(X[i, j]), 3)
                          for i, b in enumerate(ad.obs_names) if X[i, j] != 0}
                 for j, g in enumerate(ad.var_names)},
  "differentialExpression": [],
}
json.dump(data, open("my_dataset.json", "w"))
```

Required per cell: `id`, `x`, `y`, `cluster`, and a `metadata` object. `metadata.cell_type` powers
the Cell Types counters and the left "Metadata Annotation" plot; every string key in `metadata`
becomes a selectable annotation.

## Step 2 — Split and compress it

```bash
python3 scripts/compress_dataset.py my_dataset.json public/
```

This writes `public/dataset_core.json` (small, loads first) and
`public/dataset_expression.msgpack` (sparse: only non-zero values, ~10× smaller than JSON).

## Step 3 — Test locally

Restart the dev server and open the app. The dashboard renders as soon as the core file lands;
the expression bar keeps counting MB in the background and can be cancelled/resumed.

## Step 4 — Point the app at your files

Edit **`src/lib/datasetConfig.ts`** — the only place URLs live:

```ts
export const REMOTE_CORE_URL = "https://.../dataset_core.json";
export const REMOTE_EXPR_URL = "https://.../dataset_expression.msgpack";
```

- Hosting on GitHub: commit the `.msgpack` via Git LFS and use the
  `https://media.githubusercontent.com/media/<user>/<repo>/main/public/...` URL (LFS-aware).
- Files under ~100 MB can simply stay in `public/` — the local paths are used automatically
  when the remote fetch fails, so you can leave the remote URLs untouched during development.
- Any host works as long as it sends CORS headers and `content-length` (needed for the progress bar).

## Step 5 — Check the numbers

Cells / Genes / Cell Types in the header and on the Showcase page are derived from your file —
no hardcoded values to update.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| "Could not load the core dataset" | Wrong URL or missing CORS headers on your host. |
| "Could not decode the expression matrix" | File truncated or not produced by `compress_dataset.py` — regenerate. |
| Gene shows "Not detected" | The gene has no non-zero values in your matrix (or isn't in it). Plots stay zeroed on purpose — no synthetic values are ever shown. |
| Progress bar stuck at 50% | Host doesn't send `content-length`; the download still completes. |

Timings (download, decode, peak heap) are logged to the browser console for QA.
