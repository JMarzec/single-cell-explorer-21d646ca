import { useEffect, useState } from "react";
import { Database } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getEffectiveSourceId, listDatasetSources, setActiveSourceId, subscribeToSources } from "@/lib/datasetRegistry";

function readSources() {
  return { sources: listDatasetSources(), activeId: getEffectiveSourceId() };
}

export function DatasetSelector() {
  const [{ sources, activeId }, setSources] = useState(readSources);

  useEffect(() => {
    const refresh = () => setSources(readSources());
    const unsubscribe = subscribeToSources(refresh);
    refresh();
    return unsubscribe;
  }, []);

  return (
    <div className="flex min-w-0 w-full items-center gap-2 sm:w-64">
      <Database className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Select value={activeId} onValueChange={setActiveSourceId}>
        <SelectTrigger aria-label="Choose dataset" className="min-w-0 h-9 flex-1 [&>span]:truncate [&>span]:text-left" title={sources.find(source => source.id === activeId)?.name}>
          <SelectValue placeholder="Choose dataset" />
        </SelectTrigger>
        <SelectContent className="max-w-[calc(100vw-2rem)]">
          {sources.map(source => (
            <SelectItem key={source.id} value={source.id} className="[&>span:last-child]:break-words">
              {source.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}