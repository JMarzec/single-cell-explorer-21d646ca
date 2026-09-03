/**
 * Fetch helpers shared by the main thread and the dataset worker.
 * Kept dependency-free so they can run inside a Web Worker.
 */

/** Try remote URL first, fall back to local when one is provided. */
export async function fetchJsonWithFallback(
  remoteUrl: string,
  localUrl?: string
): Promise<unknown> {
  try {
    const resp = await fetch(remoteUrl);
    if (resp.ok) return await resp.json();
  } catch {
    /* fall through */
  }

  if (!localUrl) {
    throw new Error(`Could not load the core dataset from ${remoteUrl}`);
  }

  const resp = await fetch(localUrl);
  if (!resp.ok) {
    throw new Error(
      `Could not load the core dataset from either ${remoteUrl} or ${localUrl}`
    );
  }
  return resp.json();
}

/**
 * Stream-fetch binary data with progress, trying remote then local.
 * Writes directly into a single preallocated buffer when the server reports a
 * content length, avoiding a second full copy of the payload.
 */
export async function streamFetchBytes(
  remoteUrl: string,
  localUrl: string,
  onProgress: (pct: number, msg: string) => void,
  signal?: AbortSignal
): Promise<Uint8Array> {
  let response: Response | null = null;

  try {
    const resp = await fetch(remoteUrl, { signal });
    if (resp.ok) response = resp;
  } catch {
    if (signal?.aborted) throw new DOMException("Download cancelled", "AbortError");
    /* fall through */
  }

  if (!response) {
    const resp = await fetch(localUrl, { signal });
    if (!resp.ok) {
      throw new Error(
        `Could not load the expression matrix from either ${remoteUrl} or ${localUrl}`
      );
    }
    response = resp;
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming downloads are not supported in this browser");

  const abortHandler = () => {
    reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", abortHandler);

  const ensureLive = () => {
    if (signal?.aborted) throw new DOMException("Download cancelled", "AbortError");
  };

  const totalMb = contentLength > 0 ? ` / ${(contentLength / 1e6).toFixed(0)}` : "";
  let receivedBytes = 0;

  const report = () => {
    const pct =
      contentLength > 0
        ? Math.min(99, Math.round((receivedBytes / contentLength) * 100))
        : 50;
    onProgress(
      pct,
      `Downloading expression… ${(receivedBytes / 1e6).toFixed(0)}${totalMb} MB`
    );
  };

  try {
    // Fast path: single preallocated buffer (no second copy)
    if (contentLength > 0) {
      const buffer = new Uint8Array(contentLength);
      let overflow: Uint8Array[] | null = null;

      while (true) {
        const { done, value } = await reader.read();
        ensureLive();
        if (done) break;
        if (receivedBytes + value.length <= contentLength) {
          buffer.set(value, receivedBytes);
        } else {
          // Server under-reported the size; keep the tail separately
          (overflow ||= []).push(value);
        }
        receivedBytes += value.length;
        report();
      }

      if (!overflow && receivedBytes === contentLength) return buffer;
      if (!overflow) return buffer.subarray(0, receivedBytes);

      const merged = new Uint8Array(receivedBytes);
      merged.set(buffer.subarray(0, contentLength), 0);
      let offset = contentLength;
      for (const chunk of overflow) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      return merged;
    }

    // Unknown length: collect chunks, then concatenate once
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      ensureLive();
      if (done) break;
      chunks.push(value);
      receivedBytes += value.length;
      report();
    }

    const fullBuffer = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      fullBuffer.set(chunk, offset);
      offset += chunk.length;
    }
    chunks.length = 0;
    return fullBuffer;
  } finally {
    signal?.removeEventListener("abort", abortHandler);
  }
}
