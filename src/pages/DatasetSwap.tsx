import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  Link2,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import {
  DatasetSource,
  addRemoteSource,
  addUploadedDataset,
  getEffectiveSourceId,
  listDatasetSources,
  removeSource,
  setActiveSourceId,
  subscribeToSources,
} from "@/lib/datasetRegistry";
import { clearDatasetCaches, normalizeDataset } from "@/lib/datasetLoader";

const kindLabel: Record<DatasetSource["kind"], string> = {
  "built-in": "Built-in",
  remote: "Remote URLs",
  uploaded: "Uploaded (this session)",
};

const DatasetSwap = () => {
  const navigate = useNavigate();
  const [sources, setSources] = useState<DatasetSource[]>(() => listDatasetSources());
  const [activeId, setActiveId] = useState<string>(() => getEffectiveSourceId());
  const [selectedId, setSelectedId] = useState<string>(() => getEffectiveSourceId());
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [coreUrl, setCoreUrl] = useState("");
  const [exprUrl, setExprUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(
    () =>
      subscribeToSources(() => {
        setSources(listDatasetSources());
        setActiveId(getEffectiveSourceId());
      }),
    []
  );

  const selected = useMemo(
    () => sources.find((s) => s.id === selectedId),
    [sources, selectedId]
  );

  const activate = useCallback(
    (id: string) => {
      setActiveSourceId(id);
      clearDatasetCaches();
      navigate("/");
    },
    [navigate]
  );

  const handleAddRemote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coreUrl.trim()) return;
    const source = addRemoteSource({ name, coreUrl, exprUrl });
    setName("");
    setCoreUrl("");
    setExprUrl("");
    setSelectedId(source.id);
    toast({ title: "Dataset added", description: `"${source.name}" is ready to load.` });
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const dataset = normalizeDataset(parsed);
      if (dataset.cells.length === 0) {
        throw new Error("No cells found — the JSON needs a `cells` array with id, x, y and cluster.");
      }
      const source = addUploadedDataset(
        file.name.replace(/\.json$/i, "") || "Uploaded dataset",
        dataset
      );
      setSelectedId(source.id);
      toast({
        title: "Dataset parsed",
        description: `${dataset.cells.length.toLocaleString()} cells, ${dataset.genes.length.toLocaleString()} genes.`,
      });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Could not parse that file as dataset JSON."
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Dataset Swap | Single-Cell Explorer</title>
        <meta
          name="description"
          content="Switch the active single-cell dataset: pick a registered dataset, add core and expression URLs, or upload your own Seurat/Scanpy JSON."
        />
        <link rel="canonical" href="/dataset-swap" />
      </Helmet>

      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Dataset Swap</h1>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to explorer
          </Link>
        </div>
      </header>

      <main className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Available datasets</h2>
            <p className="text-sm text-muted-foreground">
              Select a dataset and load it — no config file edits needed.
            </p>
          </div>

          <div className="space-y-3">
            {sources.map((source) => {
              const isActive = source.id === activeId;
              const isSelected = source.id === selectedId;
              return (
                <Card
                  key={source.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(source.id)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedId(source.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? "border-primary ring-1 ring-primary/40" : "hover:border-primary/40"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-sm">
                          {source.name}
                          {isActive && (
                            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              <CheckCircle2 className="h-3 w-3" />
                              Active
                            </span>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {source.description || kindLabel[source.kind]}
                        </CardDescription>
                      </div>
                      {source.kind !== "built-in" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${source.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSource(source.id);
                            setSelectedId(getEffectiveSourceId());
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  {(source.coreUrl || source.exprUrl) && (
                    <CardContent className="space-y-1 pt-0 text-xs text-muted-foreground">
                      {source.coreUrl && <p className="break-all">core: {source.coreUrl}</p>}
                      {source.exprUrl && <p className="break-all">expression: {source.exprUrl}</p>}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => selected && activate(selected.id)}
              disabled={!selected || selected.id === activeId}
            >
              {selected?.id === activeId ? "Already loaded" : "Load this dataset"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Loading swaps the explorer over to the selected dataset immediately.
            </p>
          </div>
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Upload className="h-4 w-4 text-primary" />
                Upload a dataset JSON
              </CardTitle>
              <CardDescription>
                A single Seurat/Scanpy export with cells, genes, clusters and expression.
                Parsed in your browser and kept for this session only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              {uploading && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Parsing…
                </p>
              )}
              {uploadError && (
                <Alert variant="destructive">
                  <AlertTitle>Could not read that file</AlertTitle>
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                Files above ~500 MB should be split with{" "}
                <code>scripts/compress_dataset.py</code> and added via URLs instead.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 text-primary" />
                Add dataset by URL
              </CardTitle>
              <CardDescription>
                Point at a hosted <code>dataset_core.json</code> and{" "}
                <code>dataset_expression.msgpack</code>. Saved in this browser.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleAddRemote}>
                <div className="space-y-1.5">
                  <Label htmlFor="ds-name">Name</Label>
                  <Input
                    id="ds-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My kidney atlas"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ds-core">Core JSON URL</Label>
                  <Input
                    id="ds-core"
                    required
                    value={coreUrl}
                    onChange={(e) => setCoreUrl(e.target.value)}
                    placeholder="https://…/dataset_core.json"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ds-expr">Expression MessagePack URL</Label>
                  <Input
                    id="ds-expr"
                    value={exprUrl}
                    onChange={(e) => setExprUrl(e.target.value)}
                    placeholder="https://…/dataset_expression.msgpack"
                  />
                </div>
                <Button type="submit" variant="secondary" className="w-full">
                  Add dataset
                </Button>
              </form>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
};

export default DatasetSwap;
