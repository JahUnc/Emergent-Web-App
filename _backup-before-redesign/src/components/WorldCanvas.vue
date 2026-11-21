<script setup lang="ts">
/**
 * Plays back one recorded seed on a canvas. Clicking an entity zooms the camera onto it and then hands off
 * to the entity screen.
 *
 * The parent owns playback: it binds the current frame and whether it is playing, and sets the speed.
 * The canvas advances the frame while playing and stops at the last one. Remount it (with a key) for a
 * new seed, so its per-frame caches start empty.
 *
 * Drawing stays cheap enough for every frame: each tick's food grid becomes a tiny width by height image
 * once and is scaled up, entity positions and in-cell offsets are worked out once per tick, and the
 * glowing dots are cached sprites rather than live blur.
 */
import { computed, ref, shallowRef, useTemplateRef } from 'vue';
import type { WorldData, WorldEntity } from '../types/data';
import { useAnimationLoop } from '../composables/useAnimationLoop';
import { useCanvas } from '../composables/useCanvas';
import { useReducedMotion } from '../composables/useReducedMotion';
import { drawGlow, easeInOut, foodRgb, lerp, PALETTE, spreadInCells } from '../lib/render';

const props = withDefaults(defineProps<{ world: WorldData; speed?: number }>(), { speed: 1 });
const emit = defineEmits<{ follow: [female: boolean] }>();

/** The frame on screen. */
const frame = defineModel<number>('frame', { default: 0 });
/** Whether playback is running. Set to false by the canvas when it reaches the last frame. */
const playing = defineModel<boolean>('playing', { default: true });

const BASE_TICK_MS = 450;
const ZOOM_MS = 900;
const KILL_FADE = 4;
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

const current = computed(() => props.world.frames[frame.value]!);

/** Where every entity is at this moment, sliding toward the next tick while playing. */
function positions(now: number): Placed[] {
  const moving = playing.value && !zoom.value && !reduceMotion.value && frame.value < last;
  const t = moving ? Math.min(1, (now - frameStart) / tickMs.value) : 0;
  const from = placed(frame.value);
  const to = t > 0 ? placed(frame.value + 1) : from;
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

function draw(now: number) {
  const ctx = context.value;
  const { width, height, dpr } = size.value;
  if (!ctx || !width) return;

  if (playing.value && !zoom.value) {
    if (frame.value >= last) playing.value = false;
    else if (now - frameStart >= tickMs.value) {
      frame.value++;
      frameStart = now;
    }
  } else {
    frameStart = now;
  }

  const cam = camera(now);
  const cell = (width / W) * cam.s;
  const ox = width / 2 - cam.cx * cell;
  const oy = height / 2 - cam.cy * cell;
  const f = current.value;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(foodImage(frame.value), ox, oy, W * cell, H * cell);

  ctx.strokeStyle = 'rgba(8,12,22,0.9)';
  ctx.lineWidth = Math.max(1, cell * 0.06);
  ctx.beginPath();
  for (let x = 0; x <= W; x++) { ctx.moveTo(ox + x * cell, oy); ctx.lineTo(ox + x * cell, oy + H * cell); }
  for (let y = 0; y <= H; y++) { ctx.moveTo(ox, oy + y * cell); ctx.lineTo(ox + W * cell, oy + y * cell); }
  ctx.stroke();

  ctx.fillStyle = PALETTE.tree;
  ctx.beginPath();
  for (const [x, y] of props.world.trees) {
    ctx.moveTo(ox + (x + 0.8) * cell, oy + (y + 0.5) * cell);
    ctx.arc(ox + (x + 0.5) * cell, oy + (y + 0.5) * cell, cell * 0.3, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.strokeStyle = PALETTE.shelter;
  for (const i of f.shelterCells) {
    const x = i % W;
    const y = (i - x) / W;
    ctx.lineWidth = (natural.has(i) ? 2.4 : 1.1) * dpr * Math.max(1, cam.s / 2);
    ctx.strokeRect(ox + x * cell + 2 * dpr, oy + y * cell + 2 * dpr, cell - 4 * dpr, cell - 4 * dpr);
  }

  // Killings stay marked with a red X for a few ticks, fading out.
  ctx.lineWidth = 2 * dpr * Math.max(1, cam.s / 2);
  for (let back = 0; back < KILL_FADE; back++) {
    const past = props.world.frames[frame.value - back];
    if (!past) break;
    ctx.strokeStyle = `rgba(255,122,122,${1 - back / KILL_FADE})`;
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

  const radius = (width / W) * 0.17 * Math.max(1, cam.s * 0.75);
  for (const { e, x, y } of positions(now)) {
    const alpha = zoom.value ? (e.id === zoom.value.id ? 1 : 1 - 0.8 * cam.k) : 1;
    const r = (hover.value === e.id ? 1.4 : 1) * (e.child ? radius * 0.68 : radius);
    const px = ox + x * cell;
    const py = oy + y * cell;
    drawGlow(ctx, px, py, r, e.female ? PALETTE.female : PALETTE.male, alpha);
    if (e.pregnant || e.wood) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = e.pregnant ? '#fff' : '#a0703c';
      ctx.beginPath();
      ctx.arc(px, py, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  if (zoom.value && now - zoom.value.start > ZOOM_MS + 60) {
    const female = zoom.value.female;
    zoom.value = null;
    emit('follow', female);
  }
}

const loop = useAnimationLoop(host, draw);

/** Finds the entity under the pointer, if any. */
function pick(event: PointerEvent): Placed | null {
  const el = canvas.value;
  if (!el) return null;
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
