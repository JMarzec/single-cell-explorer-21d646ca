import { ColorPalette } from "@/types/singleCell";

// Each palette maps a normalized value (0-1) to [R, G, B]
// Sampled from matplotlib colormaps at key stops

type PaletteStops = Array<[number, number, number, number]>; // [position, r, g, b]

const VIRIDIS_STOPS: PaletteStops = [
  [0.0, 68, 1, 84],
  [0.1, 72, 36, 117],
  [0.2, 65, 68, 135],
  [0.3, 53, 95, 141],
  [0.4, 42, 120, 142],
  [0.5, 33, 145, 140],
  [0.6, 34, 168, 132],
  [0.7, 68, 191, 112],
  [0.8, 122, 209, 81],
  [0.9, 189, 223, 38],
  [1.0, 253, 231, 37],
];

const MAGMA_STOPS: PaletteStops = [
  [0.0, 0, 0, 4],
  [0.1, 28, 16, 68],
  [0.2, 79, 18, 123],
  [0.3, 129, 37, 129],
  [0.4, 181, 54, 122],
  [0.5, 229, 80, 100],
  [0.6, 251, 135, 97],
  [0.7, 254, 176, 120],
  [0.8, 254, 209, 154],
  [0.9, 254, 235, 195],
  [1.0, 252, 253, 191],
];

const PLASMA_STOPS: PaletteStops = [
  [0.0, 13, 8, 135],
  [0.1, 75, 3, 161],
  [0.2, 125, 3, 168],
  [0.3, 168, 34, 150],
  [0.4, 203, 70, 121],
  [0.5, 229, 107, 93],
  [0.6, 248, 148, 65],
  [0.7, 253, 187, 45],
  [0.8, 245, 224, 32],
  [0.9, 225, 248, 56],
  [1.0, 240, 249, 33],
];

const INFERNO_STOPS: PaletteStops = [
  [0.0, 0, 0, 4],
  [0.1, 22, 11, 57],
  [0.2, 66, 10, 104],
  [0.3, 106, 23, 110],
  [0.4, 147, 38, 103],
  [0.5, 188, 55, 84],
  [0.6, 221, 81, 58],
  [0.7, 243, 120, 25],
  [0.8, 252, 165, 10],
  [0.9, 246, 215, 70],
  [1.0, 252, 255, 164],
];

const GRRD_STOPS: PaletteStops = [
  [0.0, 180, 180, 180],
  [0.25, 210, 210, 210],
  [0.5, 255, 255, 255],
  [0.75, 255, 140, 120],
  [1.0, 255, 75, 55],
];

const BLUES_STOPS: PaletteStops = [
  [0.0, 247, 251, 255],
  [0.2, 198, 219, 239],
  [0.4, 158, 202, 225],
  [0.6, 107, 174, 214],
  [0.8, 49, 130, 189],
  [1.0, 8, 81, 156],
];

const PALETTE_MAP: Record<ColorPalette, PaletteStops> = {
  viridis: VIRIDIS_STOPS,
  magma: MAGMA_STOPS,
  plasma: PLASMA_STOPS,
  inferno: INFERNO_STOPS,
  grrd: GRRD_STOPS,
  blues: BLUES_STOPS,
};

function interpolateStops(stops: PaletteStops, t: number): [number, number, number] {
  // Clamp
  if (t <= 0) return [stops[0][1], stops[0][2], stops[0][3]];
  if (t >= 1) {
    const last = stops[stops.length - 1];
    return [last[1], last[2], last[3]];
  }

  // Find surrounding stops
  for (let i = 0; i < stops.length - 1; i++) {
    const [pos0, r0, g0, b0] = stops[i];
    const [pos1, r1, g1, b1] = stops[i + 1];
    if (t >= pos0 && t <= pos1) {
      const local = (t - pos0) / (pos1 - pos0);
      return [
        Math.round(r0 + (r1 - r0) * local),
        Math.round(g0 + (g1 - g0) * local),
        Math.round(b0 + (b1 - b0) * local),
      ];
    }
  }

  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3]];
}

/**
 * Maps an expression value to an RGBA color using the specified palette.
 * @param value  Raw expression value
 * @param min    Lower bound (or percentile-clipped min)
 * @param max    Upper bound (or percentile-clipped max)
 * @param scale  Power-scaling factor (>1 enhances high expression)
 * @param palette  Color palette name
 */
export function expressionToColor(
  value: number,
  min: number,
  max: number,
  scale: number = 1,
  palette: ColorPalette = "grrd",
): [number, number, number, number] {
  let normalized = max === min ? 0.5 : (value - min) / (max - min);
  normalized = Math.max(0, Math.min(1, normalized));

  // Apply power scaling
  normalized = Math.pow(normalized, 1 / scale);

  const stops = PALETTE_MAP[palette];
  const [r, g, b] = interpolateStops(stops, normalized);
  return [r, g, b, 255];
}

/**
 * Returns a CSS linear-gradient string for the legend bar.
 */
export function getPaletteGradientCSS(palette: ColorPalette): string {
  const stops = PALETTE_MAP[palette];
  const cssStops = stops.map(([pos, r, g, b]) => `rgb(${r}, ${g}, ${b}) ${pos * 100}%`);
  return `linear-gradient(to right, ${cssStops.join(", ")})`;
}

export const PALETTE_LABELS: Record<ColorPalette, string> = {
  viridis: "Viridis",
  magma: "Magma",
  plasma: "Plasma",
  inferno: "Inferno",
  grrd: "Gray → Red",
  blues: "Blues",
};
