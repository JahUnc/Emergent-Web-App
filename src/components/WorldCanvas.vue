<script setup lang="ts">
/**
 * Plays back one recorded seed on a canvas. Clicking an entity zooms the camera onto it and then hands off
 * to the entity screen.
 *
 * The parent owns playback: it binds the current frame and whether it is playing, and sets the speed and
 * which map layers are shown. The canvas advances the frame while playing and stops at the last one.
 * Remount it (with a key) for a new seed, so its per-frame caches start empty.
 *
 * The canvas keeps its own copy of the frame on screen ({@link shown}) and draws from that, never from
 * the bound model. Writing to a bound model only asks the parent to change it; reading it back in the
 * same animation frame still returns the old value until Vue updates the parent. Drawing from the model
 * made every tick flash back to the previous one for a frame before moving on.
 *
 * Drawing stays cheap enough for every frame: each tick's food grid becomes a tiny width by height image
 * once and is scaled up, entity positions and in-cell offsets are worked out once per tick, and the
 * glowing dots are cached sprites rather than live blur.
 */
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue';
import type { WorldData, WorldEntity } from '../types/data';
import { useAnimationLoop } from '../composables/useAnimationLoop';
import { useCanvas } from '../composables/useCanvas';
import { useReducedMotion } from '../composables/useReducedMotion';
import { S } from '../lib/catalog';
import { defaultLayers, type LayerState } from '../lib/layers';
import { drawGlow, drawReticle, easeInOut, foodRgb, lerp, PALETTE, spreadInCells } from '../lib/render';
import { CAUSE_KIND, EVENT_STYLE } from '../lib/worldStats';

const props = withDefaults(defineProps<{ world: WorldData; speed?: number; layers?: LayerState }>(), {
  speed: 1,
  layers: defaultLayers,
});
const emit = defineEmits<{ follow: [female: boolean] }>();

/** The frame on screen, shared with the parent. */
const frame = defineModel<number>('frame', { default: 0 });
/** Whether playback is running. Set to false by the canvas when it reaches the last frame. */
const playing = defineModel<boolean>('playing', { default: true });

const BASE_TICK_MS = 450;
const ZOOM_MS = 900;
const KILL_FADE = 4;
/** How many ticks back the trails layer reaches. */
const TRAIL_TICKS = 8;
/** How many ticks a new death stays highlighted on the deaths layer. */
const DEATH_FRESH = 6;
const canvas = useTemplateRef<HTMLCanvasElement>('canvas-el');
const host = useTemplateRef<HTMLElement>('host-el');
const reduceMotion = useReducedMotion();
const { context, size } = useCanvas(canvas, () => loop.drawOnce());

interface Placed { e: WorldEntity; x: number; y: number }

const W = props.world.width;
const H = props.world.height;
const last = props.world.frames.length - 1;
const tickMs = computed(() => BASE_TICK_MS / props.speed);
let frameStart = performance.now();
const hover = ref<number | null>(null);
const zoom = shallowRef<{ id: number; x: number; y: number; female: boolean; start: number } | null>(null);
const natural = new Set(props.world.natural);

/** The frame the canvas is drawing. The canvas changes it first and tells the parent afterwards. */
const shown = ref(Math.min(frame.value, last));
/** Whether the canvas is advancing frames, kept in step with the parent's model the same way. */
let running = playing.value;

// Changes from outside (the scrubber, the timeline markers, "watch again") restart the tick from the start.
watch(frame, (value) => {
  if (value === shown.value) return;
  shown.value = Math.max(0, Math.min(last, value));
  frameStart = performance.now();
  loop.drawOnce();
});
watch(playing, (value) => {
  running = value;
  frameStart = performance.now();
});
watch(() => props.layers, () => loop.drawOnce(), { deep: true });

/** The food image for each tick, built on first use. */
const foodImages: (HTMLCanvasElement | undefined)[] = [];
function foodImage(index: number): HTMLCanvasElement {
  const cached = foodImages[index];
  if (cached) return cached;
  const image = document.createElement('canvas');
  image.width = W;
  image.height = H;
  const ctx = image.getContext('2d')!;
  const pixels = ctx.createImageData(W, H);
  props.world.frames[index]!.food.forEach((f, i) => {
    const [r, g, b] = foodRgb(f);
    pixels.data.set([r, g, b, 255], i * 4);
  });
  ctx.putImageData(pixels, 0, 0);
  foodImages[index] = image;
  return image;
}

/** Entity positions (cell center plus in-cell offset) for each tick, built on first use. */
const placements: (Map<number, Placed> | undefined)[] = [];
function placed(index: number): Map<number, Placed> {
  const cached = placements[index];
  if (cached) return cached;
  const list = props.world.frames[index]!.entities;
  const offsets = spreadInCells(list, (e) => [e.x, e.y]);
  const result = new Map<number, Placed>();
  for (const e of list) {
    const [ox, oy] = offsets.get(e)!;
    result.set(e.id, { e, x: e.x + 0.5 + ox, y: e.y + 0.5 + oy });
  }
  placements[index] = result;
  return result;
}

/** How many entities stand in each cell, per tick, built on first use. */
const crowds: (Uint8Array | undefined)[] = [];
function crowding(index: number): Uint8Array {
  const cached = crowds[index];
  if (cached) return cached;
  const counts = new Uint8Array(W * H);
  for (const e of props.world.frames[index]!.entities) counts[e.y * W + e.x]!++;
  crowds[index] = counts;
  return counts;
}

const current = computed(() => props.world.frames[shown.value]!);

/** How far the current tick has played, from 0 to 1. Zero whenever nothing is moving. */
function progress(now: number): number {
  const moving = running && !zoom.value && !reduceMotion.value && shown.value < last;
  return moving ? Math.min(1, (now - frameStart) / tickMs.value) : 0;
}

/** Where every entity is at this moment, sliding toward the next tick while playing. */
function positions(now: number): Placed[] {
  const t = progress(now);
  const from = placed(shown.value);
  const to = t > 0 ? placed(shown.value + 1) : from;
  return [...from.values()].map((a) => {
    const b = to.get(a.e.id);
    return b && t > 0 ? { e: a.e, x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) } : a;
  });
}

function camera(now: number) {
  const z = zoom.value;
  if (!z) return { cx: W / 2, cy: H / 2, s: 1, k: 0 };
  const k = easeInOut(Math.min(1, (now - z.start) / ZOOM_MS));
  return { cx: lerp(W / 2, z.x, k), cy: lerp(H / 2, z.y, k), s: lerp(1, 7, k), k };
}

/** Moves playback on by one tick when the current one has finished, and stops at the end. */
function advance(now: number) {
  if (!running || zoom.value) {
    frameStart = now;
    return;
  }
  if (shown.value >= last) {
    running = false;
    playing.value = false;
    return;
  }
  if (now - frameStart >= tickMs.value) {
    shown.value++;
    frameStart = now;
    frame.value = shown.value;
  }
}

function draw(now: number) {
  const ctx = context.value;
  const { width, height, dpr } = size.value;
  if (!ctx || !width) return;

  advance(now);

  const layers = props.layers;
  const cam = camera(now);
  const cell = (width / W) * cam.s;
  const ox = width / 2 - cam.cx * cell;
  const oy = height / 2 - cam.cy * cell;
  const f = current.value;
  const thick = Math.max(1, cam.s / 2);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;
  if (layers.food) {
    ctx.drawImage(foodImage(shown.value), ox, oy, W * cell, H * cell);
  } else {
    ctx.fillStyle = '#04101a';
    ctx.fillRect(ox, oy, W * cell, H * cell);
  }

  // Crowding: cells shared by two or more entities glow from amber to hot red as they fill up.
  if (layers.crowding) {
    const counts = crowding(shown.value);
    const full = Math.max(2, S.MaxEntitiesPerCell ?? 5);
    for (let i = 0; i < counts.length; i++) {
      const n = counts[i]!;
      if (n < 2) continue;
      const k = Math.min(1, (n - 1) / (full - 1));
      ctx.fillStyle = `rgba(255,${Math.round(180 - 130 * k)},${Math.round(60 - 20 * k)},${0.28 + 0.5 * k})`;
      ctx.fillRect(ox + (i % W) * cell, oy + Math.floor(i / W) * cell, cell, cell);
    }
  }

  ctx.strokeStyle = PALETTE.gap;
  ctx.lineWidth = Math.max(1, cell * 0.1);
  ctx.beginPath();
  for (let x = 0; x <= W; x++) { ctx.moveTo(ox + x * cell, oy); ctx.lineTo(ox + x * cell, oy + H * cell); }
  for (let y = 0; y <= H; y++) { ctx.moveTo(ox, oy + y * cell); ctx.lineTo(ox + W * cell, oy + y * cell); }
  ctx.stroke();

  // Trees are drawn as thin green rings, so they read apart from food and do not hide the dots.
  if (layers.trees) {
    ctx.strokeStyle = PALETTE.tree;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(1, cell * 0.05);
    ctx.beginPath();
    for (const [x, y] of props.world.trees) {
      ctx.moveTo(ox + (x + 0.72) * cell, oy + (y + 0.5) * cell);
      ctx.arc(ox + (x + 0.5) * cell, oy + (y + 0.5) * cell, cell * 0.22, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (layers.shelters) {
    ctx.strokeStyle = PALETTE.shelter;
    for (const i of f.shelterCells) {
      const x = i % W;
      const y = (i - x) / W;
      ctx.lineWidth = (natural.has(i) ? 2.4 : 1.1) * dpr * thick;
      ctx.beginPath();
      ctx.rect(ox + x * cell + 2.5 * dpr, oy + y * cell + 2.5 * dpr, cell - 5 * dpr, cell - 5 * dpr);
      ctx.stroke();
    }
  }

  // Deaths: a small diamond where each entity died, in its cause's color. New ones get a ring.
  if (layers.deaths) {
    const perCell = new Map<number, number>();
    for (const d of props.world.deaths) {
      if (d.frame > shown.value) continue;
      const nth = perCell.get(d.cell) ?? 0;
      perCell.set(d.cell, nth + 1);
      const color = EVENT_STYLE[CAUSE_KIND[d.cause]].color;
      const angle = nth * 2.4;
      const spread = nth === 0 ? 0 : 0.22;
      const x = ox + ((d.cell % W) + 0.5 + Math.cos(angle) * spread) * cell;
      const y = oy + (Math.floor(d.cell / W) + 0.5 + Math.sin(angle) * spread) * cell;
      const r = cell * 0.16;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
      const age = shown.value - d.frame;
      if (age < DEATH_FRESH) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 1 - age / DEATH_FRESH;
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.arc(x, y, r * (1.6 + age * 0.35), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  const live = positions(now);

  // Trails: each entity's path over the last few ticks, fading toward the oldest point.
  if (layers.trails) {
    const t = progress(now);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, cell * 0.07);
    for (const p of live) {
      const points: [number, number][] = [];
      for (let back = TRAIL_TICKS; back >= 0; back--) {
        const at = placed(Math.max(0, shown.value - back)).get(p.e.id);
        if (at) points.push([at.x, at.y]);
      }
      if (t > 0) points.push([p.x, p.y]);
      if (points.length < 2) continue;
      ctx.strokeStyle = p.e.female ? PALETTE.female : PALETTE.male;
      for (let i = 1; i < points.length; i++) {
        const [ax, ay] = points[i - 1]!;
        const [bx, by] = points[i]!;
        if (Math.abs(ax - bx) > 2.5 || Math.abs(ay - by) > 2.5) continue;
        ctx.globalAlpha = 0.08 + 0.55 * (i / (points.length - 1));
        ctx.beginPath();
        ctx.moveTo(ox + ax * cell, oy + ay * cell);
        ctx.lineTo(ox + bx * cell, oy + by * cell);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  if (layers.entities) {
    // Killings stay marked with a red X for a few ticks, fading out.
    ctx.lineWidth = 2 * dpr * thick;
    for (let back = 0; back < KILL_FADE; back++) {
      const past = props.world.frames[shown.value - back];
      if (!past) break;
      ctx.strokeStyle = `rgba(${PALETTE.kill},${1 - back / KILL_FADE})`;
      for (const i of past.kills) {
        const x = ox + ((i % W) + 0.5) * cell;
        const y = oy + (Math.floor(i / W) + 0.5) * cell;
        const r = cell * 0.3;
        ctx.beginPath();
        ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
        ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
        ctx.stroke();
      }
    }

    const radius = (width / W) * 0.2 * Math.max(1, cam.s * 0.75);
    for (const { e, x, y } of live) {
      const alpha = zoom.value ? (e.id === zoom.value.id ? 1 : 1 - 0.8 * cam.k) : 1;
      const r = (hover.value === e.id ? 1.4 : 1) * (e.child ? radius * 0.68 : radius);
      const px = ox + x * cell;
      const py = oy + y * cell;
      drawGlow(ctx, px, py, r, e.female ? PALETTE.female : PALETTE.male, alpha);
      if (hover.value === e.id || zoom.value?.id === e.id) drawReticle(ctx, px, py, r * 2.6, dpr, now);
      if (e.pregnant || e.wood) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = e.pregnant ? PALETTE.pregnant : PALETTE.wood;
        ctx.beginPath();
        ctx.arc(px, py, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // A faint scan bar sweeps left to right once per tick while playing, so time passing is visible.
  const k = progress(now);
  if (k > 0) {
    const sx = ox + k * W * cell;
    const sweep = ctx.createLinearGradient(sx - cell * 3, 0, sx, 0);
    sweep.addColorStop(0, 'rgba(79,216,255,0)');
    sweep.addColorStop(1, 'rgba(79,216,255,0.12)');
    ctx.fillStyle = sweep;
    ctx.fillRect(sx - cell * 3, oy, cell * 3, H * cell);
    ctx.fillStyle = 'rgba(79,216,255,0.45)';
    ctx.fillRect(sx - dpr, oy, dpr, H * cell);
  }

  if (zoom.value && now - zoom.value.start > ZOOM_MS + 60) {
    const female = zoom.value.female;
    zoom.value = null;
    emit('follow', female);
  }
}

const loop = useAnimationLoop(host, draw);

/** Finds the entity under the pointer, if any. Nothing can be picked while entities are hidden. */
function pick(event: PointerEvent): Placed | null {
  const el = canvas.value;
  if (!el || !props.layers.entities) return null;
  const rect = el.getBoundingClientRect();
  const cell = rect.width / W;
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  let best: Placed | null = null;
  let bestDistance = Infinity;
  for (const p of positions(performance.now())) {
    const d = Math.hypot(p.x * cell - mx, p.y * cell - my);
    if (d < bestDistance) { bestDistance = d; best = p; }
  }
  return bestDistance < cell * 1.2 ? best : null;
}

function onMove(event: PointerEvent) {
  if (zoom.value) return;
  hover.value = pick(event)?.e.id ?? null;
}

function onClick(event: PointerEvent) {
  if (zoom.value) return;
  const target = pick(event);
  if (!target) return;
  if (reduceMotion.value) emit('follow', target.e.female);
  else zoom.value = { id: target.e.id, x: target.x, y: target.y, female: target.e.female, start: performance.now() };
}

defineExpose({ redraw: () => loop.drawOnce() });
</script>

<template>
  <div ref="host-el" class="world">
    <canvas
      ref="canvas-el"
      :style="{ aspectRatio: `${W} / ${H}`, cursor: hover !== null ? 'pointer' : 'crosshair' }"
      role="img"
      :aria-label="`Seed ${world.seed} at tick ${current.tick}: ${current.entities.length} entities alive. Click an entity to follow it.`"
      @pointermove="onMove"
      @pointerleave="hover = null"
      @click="onClick"
    />
    <div class="hud">
      <span>tick <b>{{ current.tick }}</b></span>
      <span>alive <b>{{ current.entities.length }}</b></span>
      <span>born <b>{{ current.born }}</b></span>
      <span>died <b>{{ current.died.killed + current.died.cold + current.died.starved + current.died.oldAge }}</b></span>
    </div>
  </div>
</template>

<style scoped>
.world { position: relative; }
canvas { display: block; width: 100%; }
</style>
