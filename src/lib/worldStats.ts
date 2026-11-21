/**
 * Numbers about a recorded world, worked out once per world and reused by the telemetry panel, the
 * timeline's event markers and the map layers.
 *
 * Everything here is derived from the decoded frames in {@link WorldData}. Nothing is simulated or
 * estimated: a birth marker means an entity really appeared on that frame, a death marker means one
 * really disappeared, with the cause the recording gave it.
 */
import type { DeathCause, WorldData } from '../types/data';

/** The kinds of event the timeline marks, in the order they are stacked on a tick. */
export const EVENT_KINDS = ['birth', 'starved', 'cold', 'killed', 'oldAge'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Display name and color for each event kind. Colors match the CSS tokens in styles/main.css. */
export const EVENT_STYLE: Record<EventKind, { label: string; plural: string; color: string }> = {
  birth: { label: 'birth', plural: 'births', color: '#3dffb4' },
  starved: { label: 'starved', plural: 'starved', color: '#ff9d3d' },
  cold: { label: 'froze', plural: 'froze', color: '#bfefff' },
  killed: { label: 'killed', plural: 'killed', color: '#ff3b4f' },
  oldAge: { label: 'old age', plural: 'old age', color: '#84aabd' },
};

/** What happened on one frame, compared with the frame before it. */
export interface TickEvents {
  frame: number;
  counts: Record<EventKind, number>;
  total: number;
}

/** Per-frame series and totals for one world. */
export interface WorldStats {
  /** Entities alive on each frame. */
  alive: number[];
  /** Food on the whole map as a share of the most it could hold, from 0 to 1, per frame. */
  food: number[];
  /** Shelter cells standing on each frame, natural and built. */
  shelters: number[];
  /** The most entities alive on any frame. */
  peak: number;
  /** Only the frames where something happened, in order. */
  events: TickEvents[];
  /** Total events of each kind over the whole recording. */
  totals: Record<EventKind, number>;
}

const cache = new WeakMap<WorldData, WorldStats>();

/**
 * An empty count for every event kind.
 * @returns Zero for each kind.
 */
function zeroCounts(): Record<EventKind, number> {
  return { birth: 0, starved: 0, cold: 0, killed: 0, oldAge: 0 };
}

/**
 * Works out the series, totals and events for a world. The result is cached, so calling it again for the
 * same world is free.
 * @param world A decoded world.
 * @returns Its stats.
 */
export function worldStats(world: WorldData): WorldStats {
  const hit = cache.get(world);
  if (hit) return hit;

  const cells = world.width * world.height;
  const capacity = cells * world.foodMax;
  const alive = world.frames.map((f) => f.entities.length);
  const food = world.frames.map((f) => {
    let sum = 0;
    for (let i = 0; i < f.food.length; i++) sum += f.food[i]!;
    return capacity > 0 ? sum / capacity : 0;
  });
  const shelters = world.frames.map((f) => f.shelterCells.length);

  const events: TickEvents[] = [];
  const totals = zeroCounts();
  world.frames.forEach((f, i) => {
    if (i === 0) return;
    const p = world.frames[i - 1]!;
    const counts: Record<EventKind, number> = {
      birth: f.born - p.born,
      starved: f.died.starved - p.died.starved,
      cold: f.died.cold - p.died.cold,
      killed: f.died.killed - p.died.killed,
      oldAge: f.died.oldAge - p.died.oldAge,
    };
    let total = 0;
    for (const kind of EVENT_KINDS) {
      total += counts[kind];
      totals[kind] += counts[kind];
    }
    if (total > 0) events.push({ frame: i, counts, total });
  });

  const stats: WorldStats = { alive, food, shelters, peak: Math.max(1, ...alive), events, totals };
  cache.set(world, stats);
  return stats;
}

/**
 * Describes one tick's events in words, for screen readers and tooltips.
 * @param e The tick's events.
 * @returns Such as "Tick 42: 2 births, 1 starved".
 */
export function describeEvents(e: TickEvents): string {
  const parts = EVENT_KINDS.filter((k) => e.counts[k] > 0).map((k) => {
    const n = e.counts[k];
    return `${n} ${n === 1 ? EVENT_STYLE[k].label : EVENT_STYLE[k].plural}`;
  });
  return `Tick ${e.frame}: ${parts.join(', ')}`;
}

/** The event kind used for each death cause, which share names. */
export const CAUSE_KIND: Record<DeathCause, EventKind> = { killed: 'killed', cold: 'cold', starved: 'starved', oldAge: 'oldAge' };
