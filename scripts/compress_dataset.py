#!/usr/bin/env python3
"""
Compress a single-cell dataset JSON into split files for efficient browser loading.

Usage:
    python scripts/compress_dataset.py <input.json> [--output-dir public/]

This produces:
    - dataset_core.json     (~5-10 MB) - metadata, cells, clusters, DE, genes
    - dataset_expression.msgpack (~300-400 MB) - sparse expression matrix in MessagePack

The expression matrix is stored sparsely: only non-zero values are kept as
{gene: [[cellIndex, value], ...]} which typically reduces size by 60-90%.

Re-run this script whenever you update the source JSON file.

Requirements:
    pip install msgpack
"""

import json
import sys
import os
import time

def main():
    import msgpack  # imported here so the error message is clear if missing

    if len(sys.argv) < 2:
        print("Usage: python scripts/compress_dataset.py <input.json> [--output-dir public/]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_dir = "public/"

    # Parse --output-dir flag
    for i, arg in enumerate(sys.argv):
        if arg == "--output-dir" and i + 1 < len(sys.argv):
            output_dir = sys.argv[i + 1]

    os.makedirs(output_dir, exist_ok=True)

    # --- Load ---
    print(f"Loading {input_path}...")
    t0 = time.time()
    with open(input_path, "r") as f:
        data = json.load(f)
    print(f"  Loaded in {time.time() - t0:.1f}s")

    # --- Extract expression matrix ---
    expression = data.pop("expression", None)
    if expression is None:
        print("WARNING: No 'expression' field found in dataset. Only core file will be created.")

    # --- Write core JSON (everything except expression) ---
    core_path = os.path.join(output_dir, "dataset_core.json")
    print(f"Writing core data to {core_path}...")
    t0 = time.time()
    with open(core_path, "w") as f:
        json.dump(data, f, separators=(",", ":"))  # compact JSON
    core_size = os.path.getsize(core_path)
    print(f"  Core: {core_size / 1e6:.1f} MB ({time.time() - t0:.1f}s)")

    if expression is None:
        print("Done (no expression data to compress).")
        return

    # --- Build cell ID index for sparse encoding ---
    cells = data.get("cells", [])
    cell_ids = [c.get("id", f"cell_{i}") for i, c in enumerate(cells)]
    cell_id_to_idx = {cid: i for i, cid in enumerate(cell_ids)}

    # --- Convert expression to sparse indexed format ---
    # Format: {gene: [[cellIndex, value], [cellIndex, value], ...]}
    # Only non-zero values are stored
    print("Converting expression to sparse format...")
    t0 = time.time()
    total_entries = 0
    nonzero_entries = 0
    sparse_expression = {}

    for gene, cell_values in expression.items():
        entries = []
        for cell_id, value in cell_values.items():
            total_entries += 1
            if value != 0:
                nonzero_entries += 1
                idx = cell_id_to_idx.get(cell_id)
                if idx is not None:
                    entries.append([idx, value])
        if entries:
            sparse_expression[gene] = entries

    sparsity = (1 - nonzero_entries / total_entries) * 100 if total_entries > 0 else 0
    print(f"  {total_entries:,} entries -> {nonzero_entries:,} non-zero ({sparsity:.1f}% sparse)")
    print(f"  Conversion took {time.time() - t0:.1f}s")

    # --- Write MessagePack ---
    expr_path = os.path.join(output_dir, "dataset_expression.msgpack")
    print(f"Writing expression data to {expr_path}...")
    t0 = time.time()
    with open(expr_path, "wb") as f:
        msgpack.pack(sparse_expression, f, use_bin_type=True)
    expr_size = os.path.getsize(expr_path)
    print(f"  Expression: {expr_size / 1e6:.1f} MB ({time.time() - t0:.1f}s)")

    # --- Summary ---
    orig_size = os.path.getsize(input_path)
    total_size = core_size + expr_size
    reduction = (1 - total_size / orig_size) * 100

    print(f"\n=== Summary ===")
    print(f"  Original:    {orig_size / 1e6:.0f} MB")
    print(f"  Core:        {core_size / 1e6:.1f} MB")
    print(f"  Expression:  {expr_size / 1e6:.1f} MB")
    print(f"  Total:       {total_size / 1e6:.1f} MB ({reduction:.0f}% reduction)")
    print(f"\nFiles written to {output_dir}")
    print(f"  {core_path}")
    print(f"  {expr_path}")
    print(f"\nNext steps:")
    print(f"  1. Commit these files to your repo (expression file needs Git LFS)")
    print(f"  2. The app will auto-detect and load the split files")


if __name__ == "__main__":
    main()
