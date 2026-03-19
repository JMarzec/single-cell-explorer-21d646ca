import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Image, FileCode } from "lucide-react";

interface ExportControlsProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  filename?: string;
}

export function ExportControls({ canvasRef, filename = "scatter-plot" }: ExportControlsProps) {
  const exportAsPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a temporary canvas with white background
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;
    
    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw original canvas content
    ctx.drawImage(canvas, 0, 0);
    
    // Create download link
    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = tempCanvas.toDataURL("image/png", 1.0);
    link.click();
  };

  const exportAsSVG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get canvas image data
    const dataUrl = canvas.toDataURL("image/png");
    
    // Create SVG wrapper with embedded image
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
     width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <title>${filename}</title>
  <rect width="100%" height="100%" fill="white"/>
  <image width="${canvas.width}" height="${canvas.height}" xlink:href="${dataUrl}"/>
</svg>`;

    // Create download link
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${filename}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAsHighResPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create high-resolution canvas (2x)
    const scale = 2;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width * scale;
    tempCanvas.height = canvas.height * scale;
    
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;
    
    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Scale and draw
    ctx.scale(scale, scale);
    ctx.drawImage(canvas, 0, 0);
    
    // Create download link
    const link = document.createElement("a");
    link.download = `${filename}-highres.png`;
    link.href = tempCanvas.toDataURL("image/png", 1.0);
    link.click();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportAsPNG} className="gap-2 cursor-pointer">
          <Image className="h-4 w-4" />
          Export as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsHighResPNG} className="gap-2 cursor-pointer">
          <Image className="h-4 w-4" />
          Export as PNG (High-res)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsSVG} className="gap-2 cursor-pointer">
          <FileCode className="h-4 w-4" />
          Export as SVG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
