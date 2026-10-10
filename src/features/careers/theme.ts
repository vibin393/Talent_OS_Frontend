/**
 * Tenant theming for the public Career Portal and the Candidate Portal (Epic 9, B1).
 *
 * A tenant picks one brand colour; `brandRampFromHex` turns it into the 16-shade Fluent `BrandVariants`
 * ramp (shade 80 = the input, darker shades below, lighter above, by HSL lightness interpolation) and
 * `careerThemes` builds Fluent light/dark themes from it. Fluent's light theme draws primary buttons with
 * shade 80 behind white text, so a brand colour below 4.5:1 against white falls back to the default
 * Fluent brand (the backend also refuses such colours; this guards legacy data and bad input).
 */
import { createDarkTheme, createLightTheme, webDarkTheme, webLightTheme, type BrandVariants, type Theme } from "@fluentui/react-components";

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
export const MIN_CONTRAST = 4.5;

type Rgb = [number, number, number];
type Hsl = [number, number, number];

export function hexToRgb(hex: string): Rgb | null {
  if (!HEX_COLOR.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const part = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function rgbToHsl([r, g, b]: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb([h, s, l]: Hsl): Rgb {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const hn = h / 360;
  return [hue(hn + 1 / 3) * 255, hue(hn) * 255, hue(hn - 1 / 3) * 255];
}

/** WCAG 2.1 relative luminance of a `#RRGGBB` colour. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#RRGGBB` colours (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const SHADES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160] as const;
const INPUT_INDEX = SHADES.indexOf(80);
const DARKEST = 0.05;
const LIGHTEST = 0.96;

/** 16-shade Fluent brand ramp from one hex colour; the input is shade 80. Invalid input -> null. */
export function brandRampFromHex(hex: string): BrandVariants | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [h, s, l] = rgbToHsl(rgb);
  const ramp = {} as Record<(typeof SHADES)[number], string>;
  SHADES.forEach((shade, i) => {
    if (i === INPUT_INDEX) {
      ramp[shade] = hex.toUpperCase();
      return;
    }
    const lightness =
      i < INPUT_INDEX
        ? DARKEST + (Math.min(l, 1) - DARKEST) * (i / INPUT_INDEX)
        : l + (LIGHTEST - l) * ((i - INPUT_INDEX) / (SHADES.length - 1 - INPUT_INDEX));
    ramp[shade] = rgbToHex(hslToRgb([h, s, Math.max(0, Math.min(1, lightness))]));
  });
  return ramp as BrandVariants;
}

/** True when the brand colour can carry white text (Fluent primary buttons) at WCAG AA. */
export function brandHasContrast(hex: string | null | undefined): boolean {
  return !!hex && HEX_COLOR.test(hex) && contrastRatio(hex, "#FFFFFF") >= MIN_CONTRAST;
}

export type CareerThemes = { light: Theme; dark: Theme; branded: boolean };

const DEFAULT_THEMES: CareerThemes = { light: webLightTheme, dark: webDarkTheme, branded: false };

/** Light/dark Fluent themes for a tenant brand colour, or the default Fluent themes (contrast guard). */
export function careerThemes(hex: string | null | undefined): CareerThemes {
  if (!brandHasContrast(hex)) return DEFAULT_THEMES;
  const ramp = brandRampFromHex(hex as string);
  if (!ramp) return DEFAULT_THEMES;
  return { light: createLightTheme(ramp), dark: createDarkTheme(ramp), branded: true };
}

/** The input darkened (same hue and saturation) just enough to reach 4.5:1 against white. */
export function suggestAccessibleColor(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  if (brandHasContrast(hex)) return hex.toUpperCase();
  const [h, s, l] = rgbToHsl(rgb);
  for (let lightness = l; lightness >= 0; lightness -= 0.01) {
    const candidate = rgbToHex(hslToRgb([h, s, Math.max(0, lightness)]));
    if (contrastRatio(candidate, "#FFFFFF") >= MIN_CONTRAST) return candidate;
  }
  return "#000000";
}
