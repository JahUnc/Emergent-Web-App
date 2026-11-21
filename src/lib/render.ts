/**
 * Canvas drawing helpers shared by the world map, the entity screen and the meeting stage.
 *
 * Glowing dots are the most-drawn thing on screen. Drawing each one with shadowBlur makes the browser
 * blur on every frame, so instead each color and size is drawn once into a small sprite canvas and
 * reused with drawImage, which is far cheaper.
 */

/** Canvas colors. These match the CSS tokens in styles/main.css, since a canvas cannot read CSS variables cheaply. */
export const PALETTE = {
  female: '#ff4f9a',
  male: '#3f8cff',
  hud: '#4fd8ff',
  shelter: '#ffc53d',
  tree: '#3dffb4',
  text: '#dcf5ff',
  muted: '#84aabd',
  ok: '#3dffb4',
  warn: '#ffc53d',
  kill: '255,59,79',
  pregnant: '#ffffff',
  wood: '#ff9d3d',
  /** The color drawn between cells, so the grid reads as a lit lattice with dark gaps. */
  gap: '#01060b',
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
  // Filled twice so the halo is strong enough to read against the bright food cells.
  ctx.fill();
  ctx.fill();
  // A hot white center, so each entity reads as a lit blip rather than a flat dot.
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r * 0.38, 0, Math.PI * 2);
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
 * Draws a targeting reticle: four bracket arcs that turn slowly, used to mark the entity under the pointer.
 * @param ctx The canvas context.
 * @param x Center x in device pixels.
 * @param y Center y in device pixels.
 * @param radius Reticle radius in device pixels.
 * @param dpr Device pixel ratio, for line width.
 * @param now The current time in milliseconds, which sets the rotation.
 */
export function drawReticle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, dpr: number, now: number): void {
  const turn = (now / 1600) % (Math.PI * 2);
  ctx.save();
  ctx.strokeStyle = PALETTE.shelter;
  ctx.lineWidth = 1.5 * dpr;
  ctx.shadowColor = PALETTE.shelter;
  ctx.shadowBlur = 8 * dpr;
  for (let q = 0; q < 4; q++) {
    const start = turn + (q * Math.PI) / 2 + 0.25;
    ctx.beginPath();
    ctx.arc(x, y, radius, start, start + Math.PI / 3.2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Color for a cell's food, from bare (near black) through deep teal to rich (lit cyan-teal).
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
  // Three stops: bare ground, mid teal, rich lit teal. Two linear segments keep the middle from going muddy.
  const stops: [number, number, number][] = [[4, 14, 22], [8, 50, 70], [24, 128, 160]];
  const [a, b, k] = t < 0.5 ? [stops[0]!, stops[1]!, t * 2] : [stops[1]!, stops[2]!, (t - 0.5) * 2];
  return [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];
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
