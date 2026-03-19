import React, { useState, useCallback } from "react";
import { Upload, FileJson, AlertCircle, Check } from "lucide-react";
import { SingleCellDataset } from "@/types/singleCell";
import { normalizeDataset } from "@/lib/datasetLoader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DatasetUploaderProps {
  onDatasetLoad: (dataset: SingleCellDataset, name: string) => void;
  buttonVariant?: "default" | "outline" | "ghost";
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateDataset(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid JSON structure"], warnings: [] };
  }
  
  const obj = data as Record<string, unknown>;
  
  // Check required fields
  if (!obj.cells || !Array.isArray(obj.cells)) {
    errors.push("Missing or invalid 'cells' array");
  } else {
    const cells = obj.cells as Record<string, unknown>[];
    if (cells.length === 0) {
      errors.push("'cells' array is empty");
    } else {
      const first = cells[0];
      if (typeof first.x !== "number" || typeof first.y !== "number") {
        errors.push("Cells must have numeric 'x' and 'y' coordinates");
      }
      if (typeof first.cluster !== "number") {
        errors.push("Cells must have numeric 'cluster' field");
      }
      if (typeof first.id !== "string") {
        warnings.push("Cells should have string 'id' field (will be auto-generated)");
      }
    }
  }
  
  if (!obj.clusters || !Array.isArray(obj.clusters)) {
    errors.push("Missing or invalid 'clusters' array");
  }
  
  if (!obj.genes || !Array.isArray(obj.genes)) {
    warnings.push("Missing 'genes' array - gene search will be limited");
  }
  
  if (!obj.metadata || typeof obj.metadata !== "object") {
    warnings.push("Missing 'metadata' - default values will be used");
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}



export function DatasetUploader({ onDatasetLoad, buttonVariant = "outline" }: DatasetUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingData, setPendingData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".json")) {
      setValidation({
        valid: false,
        errors: ["Only JSON files are supported"],
        warnings: [],
      });
      return;
    }
    
    setIsLoading(true);
    setFileName(file.name);
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = validateDataset(data);
      
      setValidation(result);
      if (result.valid) {
        setPendingData(data);
      }
    } catch (err) {
      setValidation({
        valid: false,
        errors: [`Failed to parse JSON: ${(err as Error).message}`],
        warnings: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleConfirm = useCallback(() => {
    if (pendingData && validation?.valid) {
      const dataset = normalizeDataset(pendingData);
      onDatasetLoad(dataset, fileName || "uploaded-dataset.json");
      setIsOpen(false);
      setValidation(null);
      setPendingData(null);
      setFileName(null);
    }
  }, [pendingData, validation, fileName, onDatasetLoad]);

  const handleReset = useCallback(() => {
    setValidation(null);
    setPendingData(null);
    setFileName(null);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Dataset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Dataset</DialogTitle>
          <DialogDescription>
            Upload a pre-processed JSON file containing your single-cell data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragging 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
              }
            `}
          >
            <input
              type="file"
              accept=".json"
              onChange={handleInputChange}
              className="hidden"
              id="dataset-upload"
            />
            <label 
              htmlFor="dataset-upload" 
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <FileJson className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {isLoading ? "Processing..." : "Drop JSON file here or click to browse"}
              </span>
            </label>
          </div>
          
          {/* Validation results */}
          {validation && (
            <div className="space-y-2">
              {fileName && (
                <div className="flex items-center gap-2 text-sm">
                  <FileJson className="h-4 w-4" />
                  <span className="font-medium">{fileName}</span>
                </div>
              )}
              
              {validation.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {validation.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              {validation.warnings.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {validation.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              {validation.valid && (
                <Alert className="border-primary/50 bg-primary/5">
                  <Check className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-primary">
                    Dataset validated successfully!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex justify-end gap-2">
            {validation && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset
              </Button>
            )}
            <Button 
              size="sm" 
              onClick={handleConfirm}
              disabled={!validation?.valid}
            >
              Load Dataset
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
