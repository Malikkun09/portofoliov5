import { describe, expect, it } from 'vitest';

import { IMAGE_MAX_EDGE, computeScaledDimensions } from '@src/lib/chat/imageCompress';

describe('computeScaledDimensions', () => {
  it('keeps small images unchanged', () => {
    expect(computeScaledDimensions(800, 600, IMAGE_MAX_EDGE)).toEqual({
      width: 800,
      height: 600,
      scale: 1,
    });
  });

  it('scales down images whose longest edge exceeds the limit', () => {
    const scaled = computeScaledDimensions(4000, 3000, IMAGE_MAX_EDGE);
    expect(Math.max(scaled.width, scaled.height)).toBe(IMAGE_MAX_EDGE);
    expect(scaled.scale).toBeLessThan(1);
  });
});
