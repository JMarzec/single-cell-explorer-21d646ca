# Reduce dataset loading memory usage

The memory finding is real: loading the default dataset currently peaks at several gigabytes of browser RAM, which can hang the loading screen or crash the tab on an ordinary laptop.

## What causes it today

- The ~353 MB expression file is buffered as chunks and then copied into one more full byte array (two full copies).
- The decoded sparse structure is then re-expanded into a plain object per gene, keyed by cell ID strings, for every non-zero value. That string-keyed expansion is what multiplies memory roughly tenfold.
- The old fallback path decodes and JSON-parses the ~1 GB monolithic export, which is worse.
- The whole UI is blocked on this during mount.

## Proposed changes

1. Stream straight into the decoder
   Feed the fetch stream into the MessagePack stream decoder instead of collecting chunks and concatenating, removing both full byte copies.

2. Stop densifying into string-keyed objects
   Keep expression as typed arrays: for each gene store `Int32Array` cell indices plus a `Float32Array` of values, with a cell-ID to index map built once. Expose the same lookup API (`getExpressionData` returning per-cell values) so plots, tooltips and DE table code stay unchanged.

3. Drop the 1 GB JSON fallback
   Fail with a clear message pointing at the split files instead of attempting a parse that cannot succeed in a browser.

4. Non-blocking load
   Render the shell and controls while the expression matrix streams in, gating only gene-expression features until it is ready, and surface a clear error state instead of falling back silently.

## Expected result

Peak memory drops from multiple GB to roughly the size of the packed data, and the dashboard becomes usable before the expression matrix has finished streaming.

## Technical notes

Touched files: `src/lib/datasetLoader.ts` (streaming decode, typed-array store, fallback removal), `src/lib/expressionUtils.ts` (read from the typed-array store), `src/pages/Index.tsx` (progressive loading gate). No change to the on-disk dataset format or the compression script.
