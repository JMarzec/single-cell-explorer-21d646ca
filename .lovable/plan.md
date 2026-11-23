# Move dataset files out of Git LFS

## Scope and approval gates

This is an inventory and proposed migration only. No application code, dataset files, Git attributes, Git history, or Cloud settings have been changed.

First confirm whether the data may be public and approve this plan. Then provision storage and provide upload instructions. You will upload the real files yourself. Only after you confirm the uploads will application changes begin. Remove repository data only after storage loading has been verified.

## 1. Current-file inventory

The only tracked LFS patterns are in `public/.gitattributes`:

| Current repository file | Actual data size | Current use |
| --- | ---: | --- |
| `public/dataset_expression.msgpack` | 353,775,625 bytes (353.78 MB) | Default gene-expression matrix. Downloaded from GitHub's LFS-aware media URL; the same public path is configured as a local fallback. The dashboard loads it in a worker. |
| `public/heart_organoid_S1_3_annot.json` | 1,040,189,217 bytes (1.04 GB) | Original unsplit dataset; not referenced by the running app. Retain in storage as an archive, not a dashboard download. |

Both files in this checkout are **LFS pointers**, only 134 and 135 bytes respectively, not the real measurements. Do not upload these checkout copies. Upload your original full files and verify their sizes.

Also move this ordinary, non-LFS file:

| Current repository file | Size | Current use |
| --- | ---: | --- |
| `public/dataset_core.json` | 5,175,430 bytes (5.18 MB) | Default cells, coordinates, annotations, genes and marker statistics. Both the dashboard and Showcase fetch it; the expression matrix must match its ordered cells. |

The current LFS objects total **1,393,964,842 bytes (1.39 GB)**. This does not establish the reported 3.2 GB historical LFS storage: older objects are outside this current-version inventory. No history cleanup or older-object deletion is proposed. No other tracked ordinary file exceeds 2 MB in this checkout.

## 2. Proposed storage and access

Use a **Lovable Cloud storage bucket named `datasets`**, with immutable version folders. This project currently has no connected backend. Cloud will be enabled only after approval; dataset parsing and analysis will remain entirely in the browser. The existing session-only upload feature will continue to keep user-uploaded measurements off servers.

**Access is awaiting your answer:**
- **Public:** anyone with a file URL can download it; the explorer remains accessible without signing in.
- **Private:** require an authorized app session and obtain expiring signed URLs for permitted files. Never expose a service key. Define the allowed audience before implementing access rules; private access necessarily changes the current anonymous-access behavior.

Set the bucket and project upload limits to accommodate the 1.04 GB archive (for example 2 GB, subject to platform limits). Confirm storage allowance, upload method and pricing before provisioning. Storage can still have capacity and transfer costs; this migration removes GitHub LFS clone downloads, not all hosting costs. Large files may require a supported resumable upload method rather than a single dashboard upload.

## 3. Exact upload map

After the bucket exists, upload the following **unchanged originals**:

| Your local file | Bucket | Object path |
| --- | --- | --- |
| `dataset_core.json` | `datasets` | `v1/dataset_core.json` |
| `dataset_expression.msgpack` | `datasets` | `v1/dataset_expression.msgpack` |
| `heart_organoid_S1_3_annot.json` | `datasets` | `v1/archive/heart_organoid_S1_3_annot.json` |

Use JSON content type for the JSON files and `application/octet-stream` for MessagePack. If the original files are unavailable while LFS downloads are blocked, hold the migration until the real files are available; pointers cannot substitute for data.

I will prepare the small manifest after upload verification; you do not need to hand-author it. Its stable object path will be **`datasets/manifest.json`**, containing the active version, dataset name, file paths, sizes and checksums. It will reference `v1/` initially. Subsequent matched files can be uploaded under `v2/` and the manifest updated without rebuilding the app. The original unsplit JSON will be an archive entry, not an automatically downloaded file.

## 4. After upload confirmation

1. Verify actual object sizes and hashes against the originals. The expression SHA-256 must remain `3ab8a17a4888c59db4ac4e9bc038b2a52fc195f6d1daed4334a156b60d2585de`; the archive SHA-256 must remain `546543bb668b91b7ebe7bfb8bda27038a25df8ed84d9668ba4bd6d5fe9c39e28`. Compute and record the core checksum. Keep the existing pinned legacy ordered-cell validation; do not regenerate measurements or bypass identity checks.
2. Make the default source read the manifest first, then load its core and expression files from storage. Remove the GitHub URLs and repository-local fallbacks for these files. Preserve the dropdown, formats, scientific values, worker processing, cancellation and expression-only retry behavior.
3. Show manifest/download/validation progress and clear failures for missing, inaccessible, truncated or mismatched files. Preserve honest demo-fallback messaging; never present illustrative cells as the requested dataset.
4. Persist validated downloads in browser storage keyed by dataset version and checksum, not by an expiring signed URL. Reuse cached data on reload; refresh the small manifest to detect versions. Explain quota or cache-write failures without blocking exploration. Browsers may evict or clear caches, so zero repeat downloads cannot be guaranteed. Private cached data must be scoped to the authorized user and cleared on sign-out.
5. Update dataset instructions so future data goes into storage rather than Git LFS.

### Technical details

Use the existing browser registry and source-scoped loader safeguards. Add a manifest resolver and worker-compatible persistent download cache. Prefer streamed Cache Storage writes with deliberate response ownership instead of cloning the entire large buffer. Verify cached bytes as well as network bytes and evict invalid entries. Keep checksumming incremental and memory-bounded. Private access requires Cloud authentication, bucket access policies, and signed-URL renewal on cache misses.

Add regression tests for manifest validation, matching checksums, persistent cache reuse/version changes, cancellation, failures and unchanged gene values; include private-access tests if selected.

## 5. Verification, then repository cleanup

Before deleting anything, test the **actual complete storage-backed dataset**, not only small fixtures:
- Preview: core counts, scatter plots, gene search, analysis tabs and source switching.
- Reload: no full data-file download when a valid persistent cache exists.
- Missing/corrupt files: readable errors without fabricated values.
- Published app: same real-data loading and reload checks after publishing is approved.

Only after these pass:
- Remove the three repository data files listed above.
- Remove their two LFS patterns; remove the empty `public/.gitattributes` if nothing remains.
- Add explicit ignore entries for the removed public data paths so they cannot be reintroduced accidentally.
- Confirm no current tracked LFS pointers or data files over a few MB remain, and save changes through normal commits.

**Never rewrite, clean, force-push, or otherwise alter Git history.** Historical LFS storage may remain, but the current revision will no longer request these LFS files during fresh clones.

## Awaiting you

1. Public or private data access.
2. Approval of this plan before storage provisioning.
3. Later, confirmation that all real files are uploaded before code changes.