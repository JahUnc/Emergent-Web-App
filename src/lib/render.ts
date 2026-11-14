/**
 * Canvas drawing helpers shared by the world map, the entity screen and the meeting stage.
 *
 * Glowing dots are the most-drawn thing on screen. Drawing each one with shadowBlur makes the browser
 * blur on every frame, so instead each color and size is drawn once into a small sprite canvas and
 * reused with drawImage, which is far cheaper.
 */

export const PALETTE = {
  female: '#ff6fae',
  male: '#5aa9ff',
  shelter: '#d9b26a',
  tree: '#2f6e3f',
  text: '#dde4f3',
  muted: '#8b96b2',
  ok: '#59d39a',
  warn: '#f2b84b',
} as const;

const sprites = new Map<string, HTMLCanvasElement>();

/**
 * Gets (or draws once) a glowing dot sprite.
 * @param color The dot color.
 * @param radius The dot radius in device pixels, rounded to keep the cache small.
 * @returns A square canvas with the dot centered; its size is radius * 6.
 */
export function glowSprite(color: string, radius: number): HTMLCanvasElement {
  const r = Math.max(1, Math.round(radius));
  const key = `${color}:${r}`;
  const hit = sprites.get(key);
  if (hit) return hit;

  const size = r * 6;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 2.4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.fill();
  sprites.set(key, canvas);
  return canvas;
}

/**
 * Draws a glowing dot centered on a point.
 * @param ctx The canvas context.
 * @param x Center x in device pixels.
 * @param y Center y in device pixels.
 * @param radius Dot radius in device pixels.
 * @param color Dot color.
 * @param alpha Opacity from 0 to 1.
 */
export function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha = 1): void {
  const sprite = glowSprite(color, radius);
  const scale = radius / Math.max(1, Math.round(radius));
  const size = sprite.width * scale;
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = 1;
}

/**
 * Color for a cell's food, from bare (dark) to rich (teal).
 * @param food Food in the cell.
 * @param max Food that counts as fully rich.
 * @returns An rgb() color.
 */
export function foodColor(food: number, max = 9): string {
  const [r, g, b] = foodRgb(food, max);
  return `rgb(${r},${g},${b})`;
}

/**
 * The same color as {@link foodColor}, as numbers, for writing straight into ImageData.
 * @param food Food in the cell.
 * @param max Food that counts as fully rich.
 * @returns Red, green and blue from 0 to 255.
 */
export function foodRgb(food: number, max = 9): [number, number, number] {
  const t = Math.max(0, Math.min(1, food / max));
  return [Math.round(13 + 39 * t), Math.round(20 + 120 * t), Math.round(36 + 80 * t)];
}

/** Where up to five entities sit inside one cell, as offsets from its center in cell units. */
const OFFSETS: [number, number][][] = [
  [[0, 0]],
  [[-0.18, 0], [0.18, 0]],
  [[-0.2, -0.12], [0.2, -0.12], [0, 0.18]],
  [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]],
  [[-0.22, -0.2], [0.22, -0.2], [0, 0], [-0.22, 0.22], [0.22, 0.22]],
];

/**
 * Spreads entities that share a cell so each one stays visible.
 * @param items The entities.
 * @param cellOf Returns an entity's cell as [x, y].
 * @returns Each entity's offset from its cell center, in cell units.
 */
export function spreadInCells<T>(items: readonly T[], cellOf: (item: T) => readonly [number, number]): Map<T, [number, number]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const [x, y] = cellOf(item);
    const key = `${x},${y}`;
    let group = groups.get(key);
    if (!group) groups.set(key, (group = []));
    group.push(item);
  }
  const offsets = new Map<T, [number, number]>();
  for (const group of groups.values()) {
    const pattern = OFFSETS[Math.min(group.length, 5) - 1]!;
    group.forEach((item, i) => offsets.set(item, pattern[Math.min(i, 4)]!));
  }
  return offsets;
}

/** Linear interpolation. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Ease in and out, for camera moves and tweened playback. */
export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
