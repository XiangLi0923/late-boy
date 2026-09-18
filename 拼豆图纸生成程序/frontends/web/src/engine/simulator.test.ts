import { describe, expect, it } from 'vitest';
import { loadPaletteFromJSON, mergeSimilarColors } from './simulator';

describe('mergeSimilarColors', () => {
  it('replaces a close color with the most-used representative', () => {
    const palette = loadPaletteFromJSON({
      brand: 'Test',
      colors: [
        { name: 'Gray', code: 'G01', hex: '#646464' },
        { name: 'Light Gray', code: 'G02', hex: '#686868' },
      ],
    });
    const result = {
      gridWidth: 2,
      gridHeight: 1,
      indices: new Int32Array([0, 1]),
      colorCounts: new Int32Array([1, 1]),
      paletteBrand: palette.brand,
      paletteHex: palette.colors.map(c => c.hex),
      paletteNames: palette.colors.map(c => c.name),
      paletteCodes: palette.colors.map(c => c.code),
    };

    const merged = mergeSimilarColors(result, palette, 6);
    expect(merged.indices[1]).toBe(0);
    expect(merged.colorCounts[0]).toBe(2);
    expect(merged.colorCounts[1]).toBe(0);
  });
});
