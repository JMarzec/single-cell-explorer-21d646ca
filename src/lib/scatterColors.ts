export function parseColorToRGBA(color: string, alpha = 1): [number, number, number, number] {
  const opacity = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) {
    const value = hex[1].length === 3 ? hex[1].split('').map(c => c + c).join('') : hex[1];
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16), opacity];
  }
  const rgb = color.match(/^rgb\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\s*\)$/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), opacity];
  const hsl = color.match(/^hsl\(\s*([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\s*\)$/);
  if (hsl) {
    const h = Number(hsl[1]) / 360, s = Number(hsl[2]) / 100, l = Number(hsl[3]) / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const hue = (t: number) => {
      t = (t % 1 + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [Math.round(hue(h + 1 / 3) * 255), Math.round(hue(h) * 255), Math.round(hue(h - 1 / 3) * 255), opacity];
  }
  return [100, 140, 200, opacity];
}
export function visualizationColor(name: string): string {
  return `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`;
}
export function visualizationColorAlpha(name: string, alpha: number): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return `hsl(${value} / ${Math.max(0, Math.min(1, alpha))})`;
}