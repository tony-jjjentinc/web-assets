import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToHex, mix, tint, shade, contrastRatio, colorContrast, accessibleShade, WHITE } from '../src/build/color-math.mjs';

describe('color-math', () => {
  it('round-trips hex', () => expect(rgbToHex(hexToRgb('#1E90FF'))).toBe('#1e90ff'));
  it('mix matches Sass mix(white, #ffd700, 75%) = #fff5bf', () => expect(rgbToHex(tint(hexToRgb('#FFD700'), 75))).toBe('#fff5bf'));
  // v1's Python truncated (#3f3500); Sass/browsers round: 63.75 -> 64, 53.75 -> 54
  it('shade rounds like Sass: mix(black, #ffd700, 75%) = #403600', () => expect(rgbToHex(shade(hexToRgb('#FFD700'), 75))).toBe('#403600'));
  it('mix weight 100/0 returns the endpoints', () => {
    expect(mix([10, 20, 30], [200, 100, 0], 100)).toEqual([10, 20, 30]);
    expect(mix([10, 20, 30], [200, 100, 0], 0)).toEqual([200, 100, 0]);
  });
  it('WCAG ratios: black/white 21, same colour 1', () => {
    expect(contrastRatio([0, 0, 0], WHITE)).toBeCloseTo(21, 5);
    expect(contrastRatio(WHITE, WHITE)).toBe(1);
  });
  it('v1 report value: #FFD700 on white is 1.40', () => expect(contrastRatio(hexToRgb('#FFD700'), WHITE)).toBeCloseTo(1.4, 1));
  const fg = { light: hexToRgb('#F8F9FA'), dark: hexToRgb('#191C1F'), min: 4.5 };
  it('colorContrast picks light on dark colours and dark on light colours', () => {
    expect(colorContrast(hexToRgb('#800080'), fg)).toEqual(fg.light);
    expect(colorContrast(hexToRgb('#FFD700'), fg)).toEqual(fg.dark);
  });
  it('accessibleShade returns the smallest passing weight', () => {
    const { rgb, weight } = accessibleShade(hexToRgb('#2E8B57'), WHITE, 4.5);
    expect(contrastRatio(rgb, WHITE)).toBeGreaterThanOrEqual(4.5);
    if (weight > 0) expect(contrastRatio(accessibleShade(hexToRgb('#2E8B57'), WHITE, 4.5, { start: 0, max: weight - 5 }).rgb, WHITE)).toBeLessThan(4.5);
  });
});
