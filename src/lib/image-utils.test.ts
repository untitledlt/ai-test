import { describe, expect, it } from 'vitest';
import { computeResampledSize, MAX_IMAGE_DIMENSION } from './image-utils';

describe('computeResampledSize', () => {
  it('downscales a landscape image so its longest side is the max dimension', () => {
    expect(computeResampledSize(2048, 1024)).toEqual({ width: 1024, height: 512 });
  });

  it('downscales a portrait image so its longest side is the max dimension', () => {
    expect(computeResampledSize(1024, 2048)).toEqual({ width: 512, height: 1024 });
  });

  it('downscales a square image to a square at the max dimension', () => {
    expect(computeResampledSize(2000, 2000)).toEqual({ width: 1024, height: 1024 });
  });

  it('does not enlarge an image already smaller than the max dimension', () => {
    expect(computeResampledSize(500, 300)).toEqual({ width: 500, height: 300 });
  });

  it('leaves an image exactly at the max dimension unchanged', () => {
    expect(computeResampledSize(1024, 768)).toEqual({ width: 1024, height: 768 });
  });

  it('uses MAX_IMAGE_DIMENSION (1024) as the default cap', () => {
    expect(MAX_IMAGE_DIMENSION).toBe(1024);
  });

  it('respects an explicit maxDimension override', () => {
    expect(computeResampledSize(400, 200, 100)).toEqual({ width: 100, height: 50 });
  });
});
