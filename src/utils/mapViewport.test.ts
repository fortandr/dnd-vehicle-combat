import { describe, it, expect } from 'vitest';
import {
  getBackgroundBounds,
  getPointsBounds,
  unionBounds,
  constrainPanOffset,
  getMinZoom,
  scaleAboutPivot,
  isOnScreen,
  type Bounds,
} from './mapViewport';

// A 1000ft x 1000ft background centred on the origin: bounds are ±500 on both axes.
const bg = {
  url: '',
  opacity: 1,
  scale: 1,
  position: { x: 0, y: 0 },
  naturalWidth: 1000,
  naturalHeight: 1000,
  feetPerPixel: 1,
};
const viewport = { width: 800, height: 600 };
const ppf = 1; // pixels per foot

describe('getBackgroundBounds', () => {
  it('returns the image rectangle in feet, centred on its position', () => {
    expect(getBackgroundBounds(bg)).toEqual({ minX: -500, maxX: 500, minY: -500, maxY: 500 });
  });

  it('honours scale, feetPerPixel, and an offset position', () => {
    const b = getBackgroundBounds({ ...bg, scale: 0.5, feetPerPixel: 2, position: { x: 100, y: -50 } });
    // 1000px * 2 ft/px * 0.5 = 1000ft wide → ±500 around (100, -50)
    expect(b).toEqual({ minX: -400, maxX: 600, minY: -550, maxY: 450 });
  });

  it('returns null when there is no image or no natural size', () => {
    expect(getBackgroundBounds(undefined)).toBeNull();
    expect(getBackgroundBounds({ ...bg, naturalWidth: undefined })).toBeNull();
  });
});

describe('getPointsBounds / unionBounds', () => {
  it('pads the bounding box of the points', () => {
    expect(getPointsBounds([{ x: 10, y: 20 }, { x: -30, y: 5 }], 100)).toEqual({
      minX: -130,
      maxX: 110,
      minY: -95,
      maxY: 120,
    });
  });

  it('returns null for no points', () => {
    expect(getPointsBounds([], 100)).toBeNull();
  });

  it('unions bounds and ignores nulls', () => {
    const a: Bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    const b: Bounds = { minX: -5, maxX: 5, minY: 20, maxY: 30 };
    expect(unionBounds(a, null, b)).toEqual({ minX: -5, maxX: 10, minY: 0, maxY: 30 });
    expect(unionBounds(null, null)).toBeNull();
  });
});

describe('constrainPanOffset', () => {
  it('leaves the offset alone when there are no bounds', () => {
    expect(constrainPanOffset({ x: 123, y: -45 }, ppf, viewport, null)).toEqual({ x: 123, y: -45 });
  });

  it('clamps panning so the viewport stays inside the bounds', () => {
    const bounds = getBackgroundBounds(bg)!;
    // Try to centre on x=1000: viewport half-width is 400ft, so the furthest centre is 100.
    const out = constrainPanOffset({ x: -1000, y: 0 }, ppf, viewport, bounds);
    expect(out.x).toBe(-100);
  });

  it('centres on the bounds when the viewport is larger than them', () => {
    const small: Bounds = { minX: 90, maxX: 110, minY: -10, maxY: 10 };
    expect(constrainPanOffset({ x: -999, y: 999 }, ppf, viewport, small)).toEqual({ x: -100, y: 0 });
  });

  // This is the reported bug. A vehicle at x=900 sits outside the 1000ft background.
  // With the camera clamped to the background alone it can never appear on screen.
  it('cannot reach a token outside the background when only the background bounds are used', () => {
    const vehicle = { x: 900, y: 0 };
    const bgOnly = getBackgroundBounds(bg)!;
    const offset = constrainPanOffset({ x: -vehicle.x * ppf, y: 0 }, ppf, viewport, bgOnly);
    expect(isOnScreen(vehicle, offset, ppf, viewport)).toBe(false);
  });

  it('can reach a token outside the background when token bounds are unioned in', () => {
    const vehicle = { x: 900, y: 0 };
    const bounds = unionBounds(getBackgroundBounds(bg), getPointsBounds([vehicle], 100));
    const offset = constrainPanOffset({ x: -vehicle.x * ppf, y: 0 }, ppf, viewport, bounds);
    expect(isOnScreen(vehicle, offset, ppf, viewport)).toBe(true);
  });
});

describe('getMinZoom', () => {
  it('is the zoom at which the bounds just fill the viewport', () => {
    // mapScale 1 px/ft, bounds 1000ft wide/tall, viewport 800x600 → fit width needs 0.8, fit height 0.6.
    // Min zoom keeps the background covering the viewport, so the larger of the two.
    expect(getMinZoom(getBackgroundBounds(bg), viewport, 1)).toBeCloseTo(0.8);
  });

  it('allows zooming further out when tokens extend the bounds', () => {
    const bounds = unionBounds(getBackgroundBounds(bg), getPointsBounds([{ x: 900, y: 0 }], 100));
    // bounds now span -500..1000 = 1500ft wide → 800/1500 ≈ 0.533; height still 0.6 → 0.6
    expect(getMinZoom(bounds, viewport, 1)).toBeCloseTo(0.6);
  });

  it('falls back to the floor with no bounds', () => {
    expect(getMinZoom(null, viewport, 1)).toBe(0.1);
  });
});

describe('scaleAboutPivot', () => {
  it('scales the distance from the pivot, not from the origin', () => {
    expect(scaleAboutPivot({ x: 300, y: 100 }, { x: 100, y: 100 }, 0.5)).toEqual({ x: 200, y: 100 });
    expect(scaleAboutPivot({ x: 300, y: 100 }, { x: 0, y: 0 }, 0.5)).toEqual({ x: 150, y: 50 });
  });
});
