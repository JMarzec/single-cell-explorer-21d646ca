import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TourStep {
  /** CSS selector for the target element */
  target: string;
  /** Title shown in the tooltip */
  title: string;
  /** Description text */
  description: string;
  /** Position of the tooltip relative to the target */
  position?: "top" | "bottom" | "left" | "right";
}

interface ProductTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return {
    top: r.top + window.scrollY,
    left: r.left + window.scrollX,
    width: r.width,
    height: r.height,
  };
}

export function ProductTour({ steps, isOpen, onClose }: ProductTourProps) {
  const [current, setCurrent] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[current];

  // Measure and scroll to target
  const measureTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // wait for scroll then measure
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTargetRect(getRect(el));
        });
      });
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!isOpen) return;
    setCurrent(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    measureTarget();
    const handleResize = () => measureTarget();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [isOpen, current, measureTarget]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        if (current < steps.length - 1) setCurrent((c) => c + 1);
        else onClose();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (current > 0) setCurrent((c) => c - 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, current, steps.length, onClose]);

  if (!isOpen) return null;

  // Tooltip positioning
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)", position: "fixed" };
    }

    const pos = step?.position || "bottom";
    const viewTop = targetRect.top - window.scrollY;
    const viewLeft = targetRect.left - window.scrollX;
    const tooltipWidth = 340;

    const base: React.CSSProperties = { position: "fixed", width: tooltipWidth, zIndex: 10002 };

    switch (pos) {
      case "top":
        return { ...base, bottom: window.innerHeight - viewTop + PADDING + 8, left: Math.max(16, viewLeft + targetRect.width / 2 - tooltipWidth / 2) };
      case "left":
        return { ...base, top: viewTop + targetRect.height / 2 - 60, right: window.innerWidth - viewLeft + PADDING + 8 };
      case "right":
        return { ...base, top: viewTop + targetRect.height / 2 - 60, left: viewLeft + targetRect.width + PADDING + 8 };
      case "bottom":
      default:
        return { ...base, top: viewTop + targetRect.height + PADDING + 8, left: Math.max(16, viewLeft + targetRect.width / 2 - tooltipWidth / 2) };
    }
  };

  // Spotlight cutout via clip-path
  const getOverlayClipPath = () => {
    if (!targetRect) return undefined;
    const viewTop = targetRect.top - window.scrollY;
    const viewLeft = targetRect.left - window.scrollX;
    const t = Math.max(0, viewTop - PADDING);
    const l = Math.max(0, viewLeft - PADDING);
    const b = viewTop + targetRect.height + PADDING;
    const r = viewLeft + targetRect.width + PADDING;
    const radius = 8;
    return `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${l + radius}px ${t}px,
      ${r - radius}px ${t}px,
      ${r}px ${t + radius}px,
      ${r}px ${b - radius}px,
      ${r - radius}px ${b}px,
      ${l + radius}px ${b}px,
      ${l}px ${b - radius}px,
      ${l}px ${t + radius}px,
      ${l + radius}px ${t}px
    )`;
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 transition-all duration-300"
        style={{ zIndex: 10000, clipPath: getOverlayClipPath() }}
        onClick={onClose}
      />

      {/* Spotlight background fill */}
      {targetRect && (
        <div
          className="fixed rounded-lg bg-card/30 backdrop-blur-[1px] pointer-events-none transition-all duration-300"
          style={{
            zIndex: 10000,
            top: targetRect.top - window.scrollY - PADDING,
            left: targetRect.left - window.scrollX - PADDING,
            width: targetRect.width + PADDING * 2,
            height: targetRect.height + PADDING * 2,
          }}
        />
      )}

      {/* Spotlight border ring */}
      {targetRect && (
        <div
          className="fixed rounded-lg border-2 border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.2)] pointer-events-none transition-all duration-300"
          style={{
            zIndex: 10001,
            top: targetRect.top - window.scrollY - PADDING,
            left: targetRect.left - window.scrollX - PADDING,
            width: targetRect.width + PADDING * 2,
            height: targetRect.height + PADDING * 2,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="bg-card border border-border rounded-xl shadow-2xl p-4 animate-in fade-in-0 zoom-in-95 duration-200"
        style={getTooltipStyle()}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === current
                    ? "w-6 bg-primary"
                    : i < current
                    ? "w-1.5 bg-primary/50"
                    : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-secondary transition-colors"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <h3 className="text-sm font-bold text-foreground mb-1">{step?.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          {step?.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {current + 1} / {steps.length}
          </span>
          <div className="flex gap-2">
            {current > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrent((c) => c - 1)}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="h-3 w-3 mr-1" /> Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                if (current < steps.length - 1) setCurrent((c) => c + 1);
                else onClose();
              }}
              className="h-7 px-3 text-xs"
            >
              {current < steps.length - 1 ? (
                <>
                  Next <ChevronRight className="h-3 w-3 ml-1" />
                </>
              ) : (
                "Finish"
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
