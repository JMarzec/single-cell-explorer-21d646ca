/**
 * Lightweight performance / memory instrumentation.
 *
 * Used to trace dataset download and decode timings plus heap growth so QA can
 * spot hangs or memory blow-ups in the browser console (and in captured logs).
 * All measurements are best-effort: `performance.memory` is Chromium-only.
 */

interface PerfMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function memory(): PerfMemory | null {
  const perf = performance as Performance & { memory?: PerfMemory };
  return perf.memory ?? null;
}

/** Current used JS heap in MB, or null when the browser does not expose it. */
export function heapUsedMB(): number | null {
  const mem = memory();
  return mem ? mem.usedJSHeapSize / 1e6 : null;
}

/** Peak used heap observed across all `trackHeap` samples this session. */
let peakHeapMB = 0;

export function trackHeap(): number | null {
  const used = heapUsedMB();
  if (used !== null && used > peakHeapMB) peakHeapMB = used;
  return used;
}

export function getPeakHeapMB(): number {
  return peakHeapMB;
}

const fmt = (v: number | null) => (v === null ? "n/a" : `${v.toFixed(1)} MB`);

/**
 * Start a timed phase. Call the returned function when the phase ends to log
 * elapsed time, heap delta, peak heap and (optionally) the payload size.
 */
export function startPhase(label: string) {
  const t0 = performance.now();
  const heapBefore = trackHeap();
  console.info(`[perf] ${label} — start (heap ${fmt(heapBefore)})`);

  return function end(extra?: Record<string, string | number>) {
    const ms = performance.now() - t0;
    const heapAfter = trackHeap();
    const delta =
      heapBefore !== null && heapAfter !== null ? heapAfter - heapBefore : null;
    const mem = memory();
    console.info(
      `[perf] ${label} — done in ${ms.toFixed(0)} ms ` +
        `(heap ${fmt(heapAfter)}, Δ ${delta === null ? "n/a" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} MB`}, ` +
        `peak ${fmt(peakHeapMB || null)}` +
        (mem ? `, limit ${(mem.jsHeapSizeLimit / 1e6).toFixed(0)} MB` : "") +
        ")",
      extra ?? ""
    );
    return ms;
  };
}
