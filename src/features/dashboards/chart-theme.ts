/**
 * recharts styling from Fluent tokens (Epic 11, B1). Tokens are CSS variables (`var(--…)`), passed as
 * strings to `fill` / `stroke`, so the charts follow the light / dark theme automatically.
 *
 * Series order was checked with the dataviz palette validator against the light theme's hex values:
 * brand → marigold → teal → berry → light green keeps adjacent pairs apart for normal vision; the
 * teal/berry pair is only ~6 ΔE for deuteranopes, so lines also differ by dash pattern (secondary
 * encoding), every chart has a legend and a "View as table" alternative.
 */
import { tokens } from "@fluentui/react-components";

export const SERIES_COLORS = [
  tokens.colorBrandBackground,
  tokens.colorPaletteMarigoldBorderActive,
  tokens.colorPaletteTealBorderActive,
  tokens.colorPaletteBerryBorderActive,
  tokens.colorPaletteLightGreenBorderActive,
] as const;

/** Dash patterns paired with `SERIES_COLORS` (solid first). */
export const SERIES_DASHES = [undefined, "6 3", "2 3", "8 3 2 3", "4 4"] as const;

/** Color of series `index`: assigned in fixed order, never cycled (extra series reuse the last slot). */
export function seriesColor(index: number): string {
  return SERIES_COLORS[Math.min(Math.max(index, 0), SERIES_COLORS.length - 1)];
}

export function seriesDash(index: number): string | undefined {
  return SERIES_DASHES[Math.min(Math.max(index, 0), SERIES_DASHES.length - 1)];
}

export const AXIS_COLOR = tokens.colorNeutralForeground3;
export const GRID_COLOR = tokens.colorNeutralStroke2;
export const CHART_FONT = tokens.fontFamilyBase;
export const CHART_FONT_SIZE = 12;
export const CHART_HEIGHT = 240;

/** `tick` props for recharts axes. */
export const AXIS_TICK = { fill: AXIS_COLOR, fontFamily: CHART_FONT, fontSize: CHART_FONT_SIZE } as const;

/** Common axis props: recessive axis line, no tick lines. */
export const AXIS_PROPS = {
  tick: AXIS_TICK,
  stroke: GRID_COLOR,
  tickLine: false,
} as const;

/** Tooltip surface (the custom tooltip component). */
export const TOOLTIP_SURFACE = {
  backgroundColor: tokens.colorNeutralBackground1,
  color: tokens.colorNeutralForeground1,
  boxShadow: tokens.shadow8,
  borderRadius: tokens.borderRadiusMedium,
  fontFamily: CHART_FONT,
  fontSize: `${CHART_FONT_SIZE}px`,
} as const;
