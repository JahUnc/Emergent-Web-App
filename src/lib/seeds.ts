/**
 * Loads and unpacks the recorded seeds for the world screen.
 *
 * Each seed file (written by tools/trace/SeedRecorder.cs) is its own chunk, found with import.meta.glob, so
 * only the seeds someone actually watches are downloaded. A file holds a compact binary block (food
 * keyframes and one movement track per entity) that is unpacked here into ready-to-draw frames. The
 * format is described in SeedRecorder.cs; this file is the only reader of it.
 */
import { S } from './catalog';
import type { SeedRecord, WorldData, WorldDeath, WorldEntity, WorldFrame } from '../types/data';

const files = import.meta.glob<SeedRecord>('../data/seeds/seed-*.json', { import: 'default' });

/** Seed numbers that have a recording, in order. */
export const SEEDS: number[] = Object.keys(files)
  .map((path) => Number(/seed-(\d+)\.json$/.exec(path)?.[1]))
  .filter((n) => Number.isFinite(n))
  .sort((a, b) => a - b);

const loaders = new Map(Object.entries(files).map(([path, load]) => [Number(/seed-(\d+)\.json$/.exec(path)?.[1]), load]));

/** Decoded seeds kept in memory, most recent last. A handful is plenty and keeps memory flat. */
const cache = new Map<number, Promise<WorldData>>();
const CACHE_SIZE = 4;

/**
 * Loads and unpacks one seed. Repeat calls for the same seed share one download.
 * @param seed A seed number from {@link SEEDS}.
 * @returns The seed's frames.
 * @throws {Error} When the seed was not recorded.
 */
export function loadSeed(seed: number): Promise<WorldData> {
  const hit = cache.get(seed);
  if (hit) {
    cache.delete(seed);
    cache.set(seed, hit);
    return hit;
  }
  const load = loaders.get(seed);
  if (!load) return Promise.reject(new Error(`Seed ${seed} was not recorded.`));
  const pending = load().then(decode);
  cache.set(seed, pending);
  while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return pending;
}

/**
 * Picks a random recorded seed other than the given ones.
 * @param avoid Seeds not to pick, such as the one on screen.
 * @returns A seed number.
 */
export function randomSeed(...avoid: number[]): number {
  const choices = SEEDS.filter((s) => !avoid.includes(s));
  return choices[Math.floor(Math.random() * choices.length)] ?? SEEDS[0]!;
}

/**
 * Turns base64 into bytes, using the built-in decoder where the browser has one.
 * @param text Base64 text.
 * @returns The bytes.
 */
function fromBase64(text: string): Uint8Array {
  const native = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array }).fromBase64;
  if (native) return native(text);
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Cause codes in the file, in the order Simulation.RemoveDead counts them. */
const CAUSES = ['alive', 'killed', 'cold', 'starved', 'oldAge'] as const;

/**
 * Unpacks a seed record into one frame per tick.
 * @param record The seed file's contents.
 * @returns Frames ready for the world canvas, plus running totals.
 */
export function decode(record: SeedRecord): WorldData {
  const { width, height, ticks, foodStep, foodMax, foodBytes } = record;
  const cells = width * height;
  const bytes = fromBase64(record.data);
  const maturity = S.MaturityAge!;

  // Food keyframes sit at every foodStep frames, plus the last frame if it is not on the step.
  const keyFrames: number[] = [];
  for (let f = 0; f <= ticks; f += foodStep) keyFrames.push(f);
  if (keyFrames.at(-1) !== ticks) keyFrames.push(ticks);
  const half = Math.ceil(cells / 2);
  const keys = keyFrames.map((_, k) => {
    const values = new Float32Array(cells);
    for (let i = 0; i < cells; i++) {
      const byte = bytes[k * half + (i >> 1)]!;
      values[i] = (((i & 1) === 0 ? byte & 15 : byte >> 4) / 15) * foodMax;
    }
    return values;
  });
  if (keys.length * half !== foodBytes) throw new Error(`Seed ${record.seed}: food section has an unexpected size.`);

  const frames: WorldFrame[] = Array.from({ length: ticks + 1 }, (_, f) => {
    let k = keyFrames.findIndex((kf) => kf > f) - 1;
    if (k < 0) k = keyFrames.length - 1;
    const a = keys[k]!;
    const b = keys[Math.min(k + 1, keys.length - 1)]!;
    const span = (keyFrames[k + 1] ?? f) - keyFrames[k]! || 1;
    const t = (f - keyFrames[k]!) / span;
    const food = new Float32Array(cells);
    for (let i = 0; i < cells; i++) food[i] = a[i]! + (b[i]! - a[i]!) * t;
    return { tick: f, food, shelterCells: [...record.natural], entities: [], kills: [], born: 0, died: { killed: 0, cold: 0, starved: 0, oldAge: 0 } };
  });

  for (const [cell, from, to] of record.built) {
    for (let f = from; f <= to; f++) frames[f]!.shelterCells.push(cell);
  }
  for (const [frame, cell] of record.killings) frames[frame]?.kills.push(cell);

  const deaths: WorldDeath[] = [];
  let at = foodBytes;
  for (let id = 1; id <= record.entityCount; id++) {
    const first = bytes[at]!;
    const last = bytes[at + 1]!;
    const flags = bytes[at + 2]!;
    const startAge = bytes[at + 3]!;
    let cell = bytes[at + 4]! | (bytes[at + 5]! << 8);
    at += 6;
    const female = (flags & 1) === 1;
    const cause = CAUSES[(flags >> 1) & 7]!;
    let status = flags;

    for (let f = first; f <= last; f++) {
      if (f > first) {
        const byte = bytes[at++]!;
        const code = byte & 15;
        if (code === 15) {
          cell = bytes[at]! | (bytes[at + 1]! << 8);
          at += 2;
        } else {
          cell += (Math.floor(code / 3) - 1) * width + ((code % 3) - 1);
        }
        status = byte;
      }
      const entity: WorldEntity = {
        id, female, x: cell % width, y: Math.floor(cell / width),
        pregnant: (status & 16) !== 0, wood: (status & 32) !== 0, child: startAge + (f - first) < maturity,
      };
      frames[f]!.entities.push(entity);
    }

    if (first > 0) for (let f = first; f <= ticks; f++) frames[f]!.born++;
    if (cause !== 'alive') {
      for (let f = last + 1; f <= ticks; f++) frames[f]!.died[cause]++;
      // The entity is last seen on frame "last" in this cell, and is gone from the next frame on.
      deaths.push({ frame: Math.min(last + 1, ticks), cell, cause });
    }
  }
  if (at !== bytes.length) throw new Error(`Seed ${record.seed}: entity section has an unexpected size.`);

  return {
    seed: record.seed, width, height, ticks, foodMax,
    trees: record.trees, natural: record.natural, stats: record.stats, frames, deaths,
  };
}
