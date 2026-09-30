/**
 * Map viewport math: camera bounds, pan clamping, minimum zoom.
 *
 * All positions are in world feet. The camera is described by a pan offset in
 * screen pixels (the world origin is drawn at viewport-centre + offset) and a
 * pixels-per-foot factor.
 *
 * The important design rule: the camera may travel anywhere inside the UNION of
 * the background image and every token on the map. Clamping to the background
 * alone made tokens that ended up outside the image unreachable (see
 * mapViewport.test.ts).
 */

import type { BackgroundImageConfig, Position } from '../types';

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Rectangle covered by the background image, in feet, or null if there is none. */
export function getBackgroundBounds(bg: BackgroundImageConfig | undefined | null): Bounds | null {
  if (!bg || !bg.naturalWidth || !bg.naturalHeight) return null;
  const feetPerPixel = bg.feetPerPixel || 1;
  const scale = bg.scale || 1;
  const halfW = (bg.naturalWidth * feetPerPixel * scale) / 2;
  const halfH = (bg.naturalHeight * feetPerPixel * scale) / 2;
  return {
    minX: bg.position.x - halfW,
    maxX: bg.position.x + halfW,
    minY: bg.position.y - halfH,
    maxY: bg.position.y + halfH,
  };
}

/** Bounding box of a set of points, expanded by `padding` feet on every side. */
export function getPointsBounds(points: Position[], padding: number): Bounds | null {
  if (points.length === 0) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX: minX - padding, maxX: maxX + padding, minY: minY - padding, maxY: maxY + padding };
}

/** Smallest rectangle containing all the given bounds. Nulls are ignored. */
export function unionBounds(...list: (Bounds | null | undefined)[]): Bounds | null {
  let out: Bounds | null = null;
  for (const b of list) {
    if (!b) continue;
    out = out
      ? {
          minX: Math.min(out.minX, b.minX),
          maxX: Math.max(out.maxX, b.maxX),
          minY: Math.min(out.minY, b.minY),
          maxY: Math.max(out.maxY, b.maxY),
        }
      : { ...b };
  }
  return out;
}

/**
 * Clamp a pan offset so the viewport never leaves `bounds`. If the viewport is
 * wider (or taller) than the bounds on an axis, the camera is centred on the
 * bounds along that axis instead.
 */
export function constrainPanOffset(
  offset: { x: number; y: number },
  pixelsPerFoot: number,
  viewport: Viewport,
  bounds: Bounds | null,
): { x: number; y: number } {
  if (!bounds || pixelsPerFoot <= 0) return offset;

  const visibleW = viewport.width / pixelsPerFoot;
  const visibleH = viewport.height / pixelsPerFoot;
  const boundsW = bounds.maxX - bounds.minX;
  const boundsH = bounds.maxY - bounds.minY;

  let x = offset.x;
  let y = offset.y;

  if (visibleW >= boundsW) {
    x = -((bounds.minX + bounds.maxX) / 2) * pixelsPerFoot;
  } else {
    const minCenter = bounds.minX + visibleW / 2;
    const maxCenter = bounds.maxX - visibleW / 2;
    const center = Math.max(minCenter, Math.min(maxCenter, -offset.x / pixelsPerFoot));
    x = -center * pixelsPerFoot;
  }

  if (visibleH >= boundsH) {
    y = -((bounds.minY + bounds.maxY) / 2) * pixelsPerFoot;
  } else {
    const minCenter = bounds.minY + visibleH / 2;
    const maxCenter = bounds.maxY - visibleH / 2;
    const center = Math.max(minCenter, Math.min(maxCenter, -offset.y / pixelsPerFoot));
    y = -center * pixelsPerFoot;
  }

  // `|| 0` folds -0 into 0 so callers comparing offsets don't see spurious changes.
  return { x: x || 0, y: y || 0 };
}

/**
 * The smallest zoom at which `bounds` still fill the viewport on at least one
 * axis (so the user can't zoom out into empty space), never below `floor`.
 */
export function getMinZoom(bounds: Bounds | null, viewport: Viewport, mapScale: number, floor = 0.1): number {
  if (!bounds || mapScale <= 0) return floor;
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  if (w <= 0 || h <= 0) return floor;
  const fitW = viewport.width / (w * mapScale);
  const fitH = viewport.height / (h * mapScale);
  return Math.max(fitW, fitH, floor);
}

/** Scale a position's distance from `pivot` by `factor`. */
export function scaleAboutPivot(pos: Position, pivot: Position, factor: number): Position {
  return {
    x: pivot.x + (pos.x - pivot.x) * factor,
    y: pivot.y + (pos.y - pivot.y) * factor,
  };
}

/** True when a world position lands inside the viewport for the given camera. */
export function isOnScreen(
  worldPos: Position,
  offset: { x: number; y: number },
  pixelsPerFoot: number,
  viewport: Viewport,
): boolean {
  const sx = viewport.width / 2 + offset.x + worldPos.x * pixelsPerFoot;
  const sy = viewport.height / 2 + offset.y + worldPos.y * pixelsPerFoot;
  return sx >= 0 && sx <= viewport.width && sy >= 0 && sy <= viewport.height;
}
