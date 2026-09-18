import { describe, expect, it } from 'vitest';
import { colorLabel } from './beadLabel';

describe('colorLabel', () => {
  it('returns the official code when present', () => {
    expect(colorLabel({ code: 'H01' }, 4)).toBe('H01');
  });

  it('falls back to a visible index placeholder', () => {
    expect(colorLabel({ code: '' }, 7)).toBe('#8');
  });
});
