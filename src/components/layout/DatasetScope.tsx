import { Fragment, useSyncExternalStore, type ReactNode } from "react";
import { getEffectiveSourceId, subscribeToSources } from "@/lib/datasetRegistry";

/** Remount the explorer on source changes so filters, genes and edits cannot leak between datasets. */
export function DatasetScope({ children }: { children: ReactNode }) {
  const sourceId = useSyncExternalStore(subscribeToSources, getEffectiveSourceId);
  return <Fragment key={sourceId}>{children}</Fragment>;
}